"""Fixtures: isolated folders, a fake executor (the real EDTA never runs) and a fake mailer."""

import json
import threading
from collections.abc import Callable, Iterator
from dataclasses import dataclass, field
from email.message import EmailMessage
from pathlib import Path
from typing import IO

import pytest
from fastapi.testclient import TestClient

from app.api import create_app
from app.mailer import Mailer
from app.settings import Settings

FASTA = b">chr01\nACGTACGTACGT\n"


@dataclass
class Behaviour:
    lines: list[str] = field(default_factory=list)
    exit_code: int = 0
    gate: threading.Event | None = None  # wait() blocks until set
    error: Exception | None = None  # raised by start()


class FakeProcess:
    _next_pid = 40_000

    def __init__(self, behaviour: Behaviour):
        FakeProcess._next_pid += 1
        self.pid = FakeProcess._next_pid
        self.b = behaviour
        self.terminated = False
        self.killed = False

    def wait(self) -> int:
        if self.b.gate is not None:
            self.b.gate.wait(10)
        return -15 if self.terminated else self.b.exit_code

    def terminate(self) -> None:
        self.terminated = True
        if self.b.gate is not None:
            self.b.gate.set()

    def kill(self) -> None:
        self.killed = True
        self.terminate()


def default_behaviour(argv: list[str]) -> Behaviour:
    """Real final messages, so finalMessageFound can be checked."""
    joined = " ".join(argv)
    genome = argv[argv.index("--genome") + 1] if "--genome" in argv else ""
    if "fail" in genome:
        return Behaviour(["Dependency checking:", "ERROR: something broke"], exit_code=1)
    if "panEDTA.sh" in joined:
        lst = argv[argv.index("-g") + 1]
        return Behaviour(
            [
                "Pan-genome Extensive de-novo TE Annotator (panEDTA)",
                f"\tpanEDTA annotation of {lst} is finished!",
            ]
        )
    if "generate_PLOTs" in joined:
        return Behaviour(
            ["Starting adapted ProcessRepeats ...", "The generation of charts and reports has been completed"]
        )
    return Behaviour(
        [
            "Mon Oct  6 10:00:00 2026\tDependency checking:",
            "Mon Oct  6 10:00:01 2026\tEDTA final stage finished! You may check out:",
            "Mon Oct  6 10:00:02 2026\tTE annotation using the EDTA library has finished! Check out:",
            "Mon Oct  6 10:00:03 2026\tEvaluation of TE annotation finished! Check out these files:",
        ]
    )


class FakeExecutor:
    def __init__(self) -> None:
        self.calls: list[dict] = []
        self.behaviour: Callable[[list[str]], Behaviour] = default_behaviour
        self.processes: list[FakeProcess] = []

    def start(self, argv: list[str], cwd: Path, env: dict[str, str], log: IO[bytes]) -> FakeProcess:
        b = self.behaviour(argv)
        self.calls.append({"argv": argv, "cwd": cwd, "env": env})
        if b.error is not None:
            raise b.error
        if b.lines:
            log.write(("\n".join(b.lines) + "\n").encode())
            log.flush()
        proc = FakeProcess(b)
        self.processes.append(proc)
        return proc


@dataclass
class Ctx:
    client: TestClient
    executor: FakeExecutor
    mails: list[EmailMessage]
    settings: Settings
    root: Path

    @property
    def runner(self):
        return self.client.app.state.runner  # type: ignore[attr-defined]

    def wait(self, run_id: str) -> dict:
        assert self.runner.wait(run_id, 10), "run did not finish"
        return self.client.get(f"/api/runs/{run_id}").json()

    def post_edta(
        self,
        config: dict,
        files: dict[str, tuple[str, bytes]] | None = None,
        genome: str | None = "genome.fa",
    ):
        parts: dict[str, tuple[str, bytes]] = {}
        if genome:
            parts["genome"] = (genome, FASTA)
        parts.update(files or {})
        cfg = {"mode": "edta", "threads": 10, **config}
        return self.client.post("/api/runs/edta", data={"config": json.dumps(cfg)}, files=parts)


def make_settings(root: Path, **over) -> Settings:
    (root / "repo").mkdir(exist_ok=True)
    values = {
        "results_dir": root / "new",
        "legacy_results_dirs": str(root / "legacy"),
        "edta_dir": root / "repo",
        "conda_exe": "/fake/conda",
        "edta_conda_env": "EDTAgui",
        "annotep_conda_env": "annotepgui_3_11",
        "max_concurrent_runs": 1,
        "cancel_grace_seconds": 0.2,
        "mail_server": None,
        # TestClient sends "Host: testserver"
        "allowed_hosts": "localhost,127.0.0.1,[::1],testserver",
    }
    values.update(over)
    return Settings(_env_file=None, **values)  # type: ignore[call-arg]


def make_legacy(root: Path) -> None:
    """A legacy results folder: EDTA run, panEDTA run, run still 'Annotating ...'."""
    legacy = root / "legacy"
    a = legacy / "example_20250726-103151"
    a.mkdir(parents=True)
    (a / "example.fa").write_bytes(FASTA)
    (a / "log.txt").write_text("Test file\n")
    (a / "status.txt").write_text("Annotation finalised")
    p = legacy / "panGenome_20250801-090000"
    p.mkdir()
    (p / "log.txt").write_text("\tpanEDTA annotation of genome_20250801-090000.cds.list is finished!\n")
    (p / "status.txt").write_text("Annotation finalised")
    r = legacy / "rice_20250901-120000"
    r.mkdir()
    (r / "log.txt").write_text("Dependency checking:\n")


@pytest.fixture
def ctx(tmp_path: Path) -> Iterator[Ctx]:
    make_legacy(tmp_path)
    settings = make_settings(tmp_path)
    executor = FakeExecutor()
    mails: list[EmailMessage] = []
    app = create_app(settings, executor, Mailer(settings, send=mails.append))
    with TestClient(app) as client:
        yield Ctx(client, executor, mails, settings, tmp_path)
