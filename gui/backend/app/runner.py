"""Background execution: queue (MAX_CONCURRENT_RUNS), processes, cancellation.

Guarantees:
- the HTTP request never waits for the pipeline;
- status.txt is ALWAYS written at the end (success, error, exception, cancel);
- queued runs say they will start right after the current one;
- runs interrupted by a server restart are closed on the next start.
"""

import contextlib
import logging
import os
import threading
from collections import deque
from dataclasses import dataclass, field
from pathlib import Path

from .executor import Executor, RunningProcess
from .mailer import Mailer
from .models import TimelineContext
from .results_store import (
    STATUS_ERROR,
    STATUS_OK,
    ResultsStore,
    RunLocation,
    now_iso,
    read_meta,
    read_status,
    update_meta,
)
from .settings import Settings
from .step_detector import final_message_found

log = logging.getLogger("edta_gui.runner")

# Lines the legacy GUI echoed between EDTA.pl and the AnnoTEP report script.
ANNOTEP_MARKERS = [
    "################## AnnoTEP annotation completed successfully ##################",
    " ",
    "################## Starting report and chart generation #######################",
]
CANCELLED_LINE = "[Pipeline cancelled by user]"
INTERRUPTED_LINE = "[Pipeline interrupted: the server was restarted]"


def queued_line(position: int) -> str:
    return f"[Queued: position {position}. The run will start right after the current one finishes.]"


@dataclass
class Job:
    loc: RunLocation
    commands: list[list[str]]  # pipeline argv, without the conda wrapper
    conda_env: str
    extra_path: list[str]
    options: TimelineContext
    email: str | None = None
    cancelled: bool = False
    process: RunningProcess | None = None
    done: threading.Event = field(default_factory=threading.Event)


class Runner:
    def __init__(self, settings: Settings, store: ResultsStore, executor: Executor, mailer: Mailer):
        self.settings = settings
        self.store = store
        self.executor = executor
        self.mailer = mailer
        self._cond = threading.Condition()
        self._queue: deque[Job] = deque()
        self._active: dict[str, Job] = {}
        self._workers = [
            threading.Thread(target=self._worker, name=f"runner-{i}", daemon=True)
            for i in range(settings.max_concurrent_runs)
        ]
        for t in self._workers:
            t.start()

    # ------------------------------------------------------------ queries

    def is_busy(self, run_id: str) -> bool:
        with self._cond:
            return run_id in self._active or any(j.loc.id == run_id for j in self._queue)

    def queue_positions(self) -> dict[str, int]:
        with self._cond:
            if len(self._active) < self.settings.max_concurrent_runs:
                return {}
            return {j.loc.id: i + 1 for i, j in enumerate(self._queue)}

    def job(self, run_id: str) -> Job | None:
        with self._cond:
            if run_id in self._active:
                return self._active[run_id]
            return next((j for j in self._queue if j.loc.id == run_id), None)

    # ------------------------------------------------------------ submit / cancel

    def submit(self, job: Job) -> None:
        with self._cond:
            self._queue.append(job)
            waiting = len(self._active) >= self.settings.max_concurrent_runs
            position = len(self._queue)
            self._cond.notify_all()
        if waiting:
            self._append(job.loc, [queued_line(position)])

    def cancel(self, run_id: str) -> bool:
        """True if the run was queued or running here; False otherwise."""
        with self._cond:
            queued = next((j for j in self._queue if j.loc.id == run_id), None)
            if queued is not None:
                self._queue.remove(queued)
                remaining = list(self._queue)
            active = self._active.get(run_id)
            if active is not None:
                active.cancelled = True
                proc = active.process
        if queued is not None:
            queued.cancelled = True
            self._finish(queued, ok=False, exit_code=None)
            self._announce_positions(remaining)
            return True
        if active is not None:
            if proc is not None:
                proc.terminate()
                threading.Thread(target=self._kill_later, args=(active, proc), daemon=True).start()
            return True
        return False

    def wait(self, run_id: str, timeout: float | None = None) -> bool:
        job = self.job(run_id)
        return True if job is None else job.done.wait(timeout)

    # ------------------------------------------------------------ worker

    def _worker(self) -> None:
        while True:
            with self._cond:
                while not self._queue:
                    self._cond.wait()
                job = self._queue.popleft()
                self._active[job.loc.id] = job
                remaining = list(self._queue)
            self._announce_positions(remaining)
            try:
                self._execute(job)
            finally:
                with self._cond:
                    self._active.pop(job.loc.id, None)
                    self._cond.notify_all()

    def _announce_positions(self, waiting: list[Job]) -> None:
        with self._cond:
            busy = len(self._active) >= self.settings.max_concurrent_runs
        if busy:
            for i, j in enumerate(waiting):
                self._append(j.loc, [queued_line(i + 1)])

    def _env(self, job: Job) -> dict[str, str]:
        env = dict(os.environ)
        extra = [p for p in job.extra_path if p]
        # Appended (low priority): conda run puts the env's bin/ in front anyway.
        env["PATH"] = os.pathsep.join([env.get("PATH", ""), *extra]).strip(os.pathsep)
        return env

    def _execute(self, job: Job) -> None:
        exit_code: int | None = None
        try:
            env = self._env(job)
            with job.loc.log.open("ab") as logf:
                for i, argv in enumerate(job.commands):
                    if job.cancelled:
                        break
                    if i > 0 and job.options.kind == "annotep":
                        logf.write(("\n".join(ANNOTEP_MARKERS) + "\n").encode())
                        logf.flush()
                    full = [
                        self.settings.conda_exe, "run", "--no-capture-output",
                        "-n", job.conda_env, *argv,
                    ]  # fmt: skip
                    proc = self.executor.start(full, cwd=job.loc.path, env=env, log=logf)
                    job.process = proc
                    update_meta(job.loc, pid=proc.pid)
                    exit_code = proc.wait()
                    job.process = None
                    if exit_code != 0:
                        break
            self._finish(job, ok=exit_code == 0 and not job.cancelled, exit_code=exit_code)
        except Exception as exc:  # legacy wrote "[Pipeline Error]" and then forgot status.txt
            log.exception("run %s failed to execute", job.loc.id)
            self._append(job.loc, ["", "[Pipeline Error]", str(exc)])
            self._finish(job, ok=False, exit_code=exit_code)

    def _kill_later(self, job: Job, proc: RunningProcess) -> None:
        if not job.done.wait(self.settings.cancel_grace_seconds):
            proc.kill()

    # ------------------------------------------------------------ end of run

    def _finish(self, job: Job, ok: bool, exit_code: int | None) -> None:
        """Always writes status.txt and run.json, then the final e-mail."""
        loc = job.loc
        try:
            if job.cancelled:
                self._append(loc, ["", CANCELLED_LINE])
            loc.status_file.write_text(STATUS_OK if ok else STATUS_ERROR, encoding="utf-8")
            found = None
            if ok:
                with loc.log.open("r", encoding="utf-8", errors="replace") as f:
                    found = final_message_found(job.options, f)
            update_meta(
                loc,
                finishedAt=now_iso(),
                exitCode=exit_code,
                cancelled=job.cancelled,
                finalMessageFound=found,
                pid=None,
            )
        except Exception:
            log.exception("could not finalize run %s", loc.id)
            with contextlib.suppress(OSError):
                loc.status_file.write_text(STATUS_ERROR, encoding="utf-8")
        finally:
            job.done.set()
        self.mailer.send_final(job.email, loc.id, ok, loc.log)

    @staticmethod
    def _append(loc: RunLocation, lines: list[str]) -> None:
        with loc.log.open("a", encoding="utf-8") as f:
            f.write("\n".join(lines) + "\n")

    # ------------------------------------------------------------ startup recovery

    def recover_interrupted(self) -> list[str]:
        """New runs (with run.json) left without status.txt by a previous server process.

        If the pipeline is still alive (it runs in its own session), a watcher closes it
        when it ends; otherwise the run is closed now. Legacy folders are never touched.
        """
        recovered: list[str] = []
        for loc in self.store.locations():
            if loc.read_only or read_status(loc) is not None:
                continue
            meta = read_meta(loc)
            if not meta or self.is_busy(loc.id):
                continue
            pid = meta.get("pid")
            if isinstance(pid, int) and _pid_alive(pid):
                threading.Thread(target=self._watch_orphan, args=(loc, pid), daemon=True).start()
                continue
            self._close_orphan(loc)
            recovered.append(loc.id)
        return recovered

    def _watch_orphan(self, loc: RunLocation, pid: int) -> None:
        stop = threading.Event()
        while _pid_alive(pid):
            stop.wait(5)
        self._close_orphan(loc)

    def _close_orphan(self, loc: RunLocation) -> None:
        """Exit code unknown: success only if the expected final message is in the log."""
        meta = read_meta(loc) or {}
        try:
            options = TimelineContext.model_validate(meta.get("options") or {"kind": "unknown"})
        except ValueError:
            options = TimelineContext(kind="unknown")
        try:
            with loc.log.open("r", encoding="utf-8", errors="replace") as f:
                found = final_message_found(options, f)
        except OSError:
            found = None
        ok = bool(found)
        if not ok:
            self._append(loc, ["", INTERRUPTED_LINE])
        loc.status_file.write_text(STATUS_OK if ok else STATUS_ERROR, encoding="utf-8")
        update_meta(loc, finishedAt=now_iso(), exitCode=None, finalMessageFound=found, pid=None)


def _pid_alive(pid: int) -> bool:
    try:
        os.kill(pid, 0)
    except ProcessLookupError:
        return False
    except PermissionError:
        return True
    # A zombie or a reused PID is not our pipeline.
    try:
        stat = Path(f"/proc/{pid}/stat").read_text()
        return ") Z " not in stat
    except OSError:
        return True
