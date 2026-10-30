"""Run folders: new ones (read/write) and legacy ones (read-only).

Folder format kept from the legacy GUI:
  <genome>_<YYYYmmdd-HHMMSS>/ or panGenome_<YYYYmmdd-HHMMSS>/
  log.txt     stdout + stderr of the pipeline
  status.txt  only at the end: "Annotation finalised" | "Error in the annotation step"
New folders also get run.json (metadata that complements, never replaces, those files).
"""

import json
import os
import threading
from collections.abc import Callable
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Any

from .files import FASTA_EXTENSIONS, FOLDER_TS_RE, is_valid_run_id, strip_extension
from .models import RunSummary, TimelineContext
from .step_detector import final_message_found

LOG_FILE = "log.txt"
STATUS_FILE = "status.txt"
META_FILE = "run.json"
STATUS_OK = "Annotation finalised"
STATUS_ERROR = "Error in the annotation step"
TAIL_LINES = 20
META_SCHEMA = 1


@dataclass(frozen=True)
class RunLocation:
    id: str
    path: Path
    read_only: bool

    @property
    def log(self) -> Path:
        return self.path / LOG_FILE

    @property
    def status_file(self) -> Path:
        return self.path / STATUS_FILE

    @property
    def meta_file(self) -> Path:
        return self.path / META_FILE


def now_iso() -> str:
    return datetime.now().astimezone().isoformat(timespec="seconds")


def _mtime_iso(path: Path) -> str | None:
    try:
        return datetime.fromtimestamp(path.stat().st_mtime).astimezone().isoformat(timespec="seconds")
    except OSError:
        return None


def folder_started_at(name: str) -> str | None:
    """Legacy: timestamp at the end of the folder name, in the server's time zone."""
    m = FOLDER_TS_RE.search(name)
    if not m:
        return None
    try:
        return datetime.strptime(m.group(1), "%Y%m%d-%H%M%S").astimezone().isoformat(timespec="seconds")
    except ValueError:
        return None


def tail_lines(path: Path, n: int) -> list[str]:
    """Last n lines without reading the whole (possibly huge) file."""
    try:
        with path.open("rb") as f:
            f.seek(0, os.SEEK_END)
            size = f.tell()
            block, data = 64 * 1024, b""
            while size > 0 and data.count(b"\n") <= n:
                step = min(block, size)
                size -= step
                f.seek(size)
                data = f.read(step) + data
    except OSError:
        return []
    lines = data.decode("utf-8", errors="replace").splitlines()
    return lines[-n:]


def read_lines(path: Path, limit: int) -> tuple[list[str], int]:
    """(last `limit` lines, total line count)."""
    try:
        with path.open("r", encoding="utf-8", errors="replace") as f:
            lines = f.read().splitlines()
    except OSError:
        return [], 0
    return lines[-limit:], len(lines)


def read_meta(loc: RunLocation) -> dict[str, Any] | None:
    try:
        data = json.loads(loc.meta_file.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return None
    return data if isinstance(data, dict) else None


def write_meta(loc: RunLocation, data: dict[str, Any]) -> None:
    """Atomic write (tmp + rename) so readers never see a half-written file."""
    if loc.read_only:
        raise PermissionError(f"{loc.id} is read-only")
    tmp = loc.meta_file.with_suffix(".json.tmp")
    tmp.write_text(json.dumps(data, indent=2, ensure_ascii=False), encoding="utf-8")
    tmp.replace(loc.meta_file)


def update_meta(loc: RunLocation, **changes: Any) -> dict[str, Any]:
    data = read_meta(loc) or {"schema": META_SCHEMA}
    data.update(changes)
    write_meta(loc, data)
    return data


def read_status(loc: RunLocation) -> str | None:
    try:
        return loc.status_file.read_text(encoding="utf-8", errors="replace").strip()
    except OSError:
        return None


class ResultsStore:
    def __init__(
        self,
        write_dir: Path,
        legacy_dirs: list[Path],
        display_path: Callable[[Path], str] = str,
    ):
        self.write_dir = write_dir
        self._display_path = display_path
        self.legacy_dirs = [d for d in legacy_dirs if d.resolve() != write_dir.resolve()]
        self._final_cache: dict[tuple[str, float, int], bool | None] = {}
        self._create_lock = threading.Lock()

    # ------------------------------------------------------------ locating

    def ensure_write_dir(self) -> None:
        self.write_dir.mkdir(parents=True, exist_ok=True)

    def _roots(self) -> list[tuple[Path, bool]]:
        return [(self.write_dir, False)] + [(d, True) for d in self.legacy_dirs]

    def locate(self, run_id: str) -> RunLocation | None:
        if not is_valid_run_id(run_id):
            return None
        for root, read_only in self._roots():
            path = root / run_id
            if path.is_dir() and not path.is_symlink():
                return RunLocation(run_id, path, read_only)
        return None

    def locations(self) -> list[RunLocation]:
        seen: set[str] = set()
        result: list[RunLocation] = []
        for root, read_only in self._roots():
            try:
                entries = sorted(root.iterdir())
            except OSError:
                continue
            for p in entries:
                if p.name in seen or not p.is_dir() or p.is_symlink() or not is_valid_run_id(p.name):
                    continue
                seen.add(p.name)
                result.append(RunLocation(p.name, p, read_only))
        return result

    def create_run_dir(self, base: str) -> RunLocation:
        """New folder; a name clash within the same second gets -2, -3… (legacy crashed)."""
        self.ensure_write_dir()
        with self._create_lock:
            name, i = base, 2
            while True:
                try:
                    (self.write_dir / name).mkdir()
                    return RunLocation(name, self.write_dir / name, False)
                except FileExistsError:
                    name, i = f"{base}-{i}", i + 1

    # ------------------------------------------------------------ summaries

    def genome_of(self, loc: RunLocation, meta: dict[str, Any] | None = None) -> str | None:
        meta = meta if meta is not None else read_meta(loc)
        if meta and isinstance(meta.get("genome"), str):
            return meta["genome"]
        # Legacy: the FASTA named like the folder prefix (<genome>_<ts>).
        prefix = FOLDER_TS_RE.sub("", loc.id).rstrip("_")
        try:
            for p in sorted(loc.path.iterdir()):
                if p.is_file() and p.suffix.lower() in FASTA_EXTENSIONS and strip_extension(p.name) == prefix:
                    return p.name
        except OSError:
            pass
        return None

    def options_of(self, loc: RunLocation, meta: dict[str, Any] | None) -> TimelineContext | None:
        if meta and isinstance(meta.get("options"), dict):
            try:
                return TimelineContext.model_validate(meta["options"])
            except ValueError:
                return None
        if loc.id.startswith("panGenome_"):
            return TimelineContext(kind="pan", anno=True)
        return None

    def _final_found(self, loc: RunLocation, ctx: TimelineContext | None) -> bool | None:
        if ctx is None:
            return None
        try:
            st = loc.log.stat()
        except OSError:
            return False
        key = (str(loc.log), st.st_mtime, st.st_size)
        if key not in self._final_cache:
            try:
                with loc.log.open("r", encoding="utf-8", errors="replace") as f:
                    self._final_cache[key] = final_message_found(ctx, f)
            except OSError:
                self._final_cache[key] = None
        return self._final_cache[key]

    def summary(self, loc: RunLocation, queue_position: int | None = None) -> RunSummary:
        meta = read_meta(loc)
        status_text = read_status(loc)
        options = self.options_of(loc, meta)
        if status_text is None:
            status = "running"
        elif status_text == STATUS_OK:
            status = "completed"
        else:
            status = "failed"

        if meta:
            kind = meta.get("kind", "unknown")
            started_at = meta.get("startedAt") or folder_started_at(loc.id)
            finished_at = meta.get("finishedAt") if status != "running" else None
        else:
            kind = "pan" if loc.id.startswith("panGenome_") else "unknown"
            started_at = folder_started_at(loc.id)
            finished_at = None
        if status != "running" and not finished_at:
            finished_at = _mtime_iso(loc.status_file)

        final_found: bool | None = None
        if status == "completed":
            stored = meta.get("finalMessageFound") if meta else None
            final_found = stored if isinstance(stored, bool) else self._final_found(loc, options)

        return RunSummary(
            id=loc.id,
            kind=kind if kind in ("edta", "annotep", "pan", "unknown") else "unknown",
            genome=self.genome_of(loc, meta),
            started_at=started_at,
            finished_at=finished_at,
            status=status,
            status_text=status_text,
            final_message_found=final_found,
            options=options,
            last_log_lines=tail_lines(loc.log, TAIL_LINES),
            read_only=loc.read_only,
            queue_position=queue_position,
            path=self._display_path(loc.path),
        )
