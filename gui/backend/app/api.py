"""FastAPI application factory (routes under /api). The module-level app is in main.py."""

import logging
import os
import shutil
from contextlib import asynccontextmanager
from datetime import datetime
from pathlib import Path
from typing import Any, TypeVar
from urllib.parse import urlsplit

from fastapi import FastAPI, Query, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse, Response, StreamingResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, ValidationError
from starlette.datastructures import FormData, UploadFile
from starlette.middleware.trustedhost import TrustedHostMiddleware

from .command_builder import (
    DISPLAY_SCRIPTS,
    EXTRA_FILES,
    EdtaCommandInput,
    ScriptPaths,
    build_edta_commands,
    build_pan_command,
    build_pan_list,
    format_command,
)
from .events import run_events
from .executor import Executor, SubprocessExecutor
from .files import safe_child, secure_filename, strip_extension
from .mailer import Mailer
from .models import (
    EdtaConfigIn,
    ErrorBody,
    FileEntry,
    Health,
    LogResponse,
    PanConfigIn,
    RunCreated,
    RunSummary,
    TimelineContext,
)
from .results_store import (
    LOG_FILE,
    META_SCHEMA,
    ResultsStore,
    RunLocation,
    now_iso,
    read_lines,
    write_meta,
)
from .runner import Job, Runner
from .settings import VERSION, Settings, get_settings
from .validation import normalize_switches, pydantic_errors, validate_edta, validate_pan

log = logging.getLogger("edta_gui")

MAX_LISTED_FILES = 2_000
REPORT_DIR = "REPORT"
COPY_CHUNK = 1024 * 1024
# Files of the "Run test analysis" buttons, relative to the repository root (also in the
# Docker image). Only these names can be downloaded.
TEST_FILES = {
    "TAIR10_chr1.fa": Path("test"),
    "Col.test.fa": Path("test"),
    "Ler.test.fa": Path("test"),
    "genome.cds.fa": Path("test"),
    "athrep.updated.nonredun.fasta": Path("database"),
}


class ApiError(Exception):
    def __init__(self, status: int, message: str, field_errors: dict[str, str] | None = None):
        self.status = status
        self.body = ErrorBody(message=message, field_errors=field_errors or {})


def _error(status: int, message: str, field_errors: dict[str, str] | None = None) -> ApiError:
    return ApiError(status, message, field_errors)


INVALID = "The run was not started: check the highlighted fields."

M = TypeVar("M", bound=BaseModel)


def create_app(
    settings: Settings | None = None,
    executor: Executor | None = None,
    mailer: Mailer | None = None,
) -> FastAPI:
    settings = settings or get_settings()
    store = ResultsStore(settings.results_dir, settings.legacy_dirs, settings.display_path)
    store.ensure_write_dir()
    mail = mailer or Mailer(settings)
    runner = Runner(settings, store, executor or SubprocessExecutor(), mail)
    scripts = ScriptPaths.from_dirs(settings.edta_dir, settings.annotep_root)

    @asynccontextmanager
    async def lifespan(_: FastAPI):
        closed = runner.recover_interrupted()
        if closed:
            log.warning("closed runs interrupted by a previous server: %s", ", ".join(closed))
        yield

    app = FastAPI(title="EDTA-GUI backend", version=VERSION, lifespan=lifespan)
    app.state.settings, app.state.store, app.state.runner = settings, store, runner

    app.add_middleware(
        CORSMiddleware,
        allow_origins=[settings.frontend_dev_origin],
        allow_methods=["GET", "POST"],
        allow_headers=["*"],
    )

    # The API has no login: it trusts that only this computer reaches it. A web page open in
    # another tab can still send requests to localhost, so (1) only local host names are
    # answered (DNS rebinding) and (2) POSTs from a page of another site are refused (CSRF).
    allowed_hosts = settings.allowed_host_list

    @app.middleware("http")
    async def _same_site_only(request: Request, call_next):  # type: ignore[no-untyped-def]
        if request.method not in SAFE_METHODS:
            origin = request.headers.get("origin")
            if origin is not None and not _origin_allowed(origin, allowed_hosts):
                body = ErrorBody(message="Request refused: it did not come from this interface.")
                return JSONResponse(body.model_dump(by_alias=True), status_code=403)
        response: Response = await call_next(request)
        return response

    # Added last = runs first: unknown Host names never reach the routes. Starlette compares
    # the Host header without its port and keeps IPv6 brackets ("[::1]").
    app.add_middleware(TrustedHostMiddleware, allowed_hosts=allowed_hosts)

    @app.exception_handler(ApiError)
    async def _api_error(_: Request, exc: ApiError) -> JSONResponse:
        return JSONResponse(exc.body.model_dump(by_alias=True), status_code=exc.status)

    @app.exception_handler(RequestValidationError)
    async def _validation_error(_: Request, exc: RequestValidationError) -> JSONResponse:
        fields = {".".join(str(p) for p in e["loc"][1:]) or "request": e["msg"] for e in exc.errors()}
        body = ErrorBody(message="Invalid request.", field_errors=fields)
        return JSONResponse(body.model_dump(by_alias=True), status_code=422)

    # ------------------------------------------------------------ helpers

    def locate(run_id: str) -> RunLocation:
        loc = store.locate(run_id)
        if loc is None:
            raise _error(404, f'Run "{run_id}" not found.')
        return loc

    def summary_of(loc: RunLocation) -> RunSummary:
        return store.summary(loc, runner.queue_positions().get(loc.id))

    def parse_config(form: FormData, model: type[M]) -> M:
        raw = form.get("config")
        if not isinstance(raw, str):
            raise _error(422, INVALID, {"config": "Missing JSON configuration."})
        try:
            return model.model_validate_json(raw)
        except ValidationError as exc:
            raise _error(422, INVALID, pydantic_errors(exc)) from exc

    def upload(form: FormData, key: str) -> UploadFile | None:
        value = form.get(key)
        return value if isinstance(value, UploadFile) and value.filename else None

    def save(up: UploadFile, dest: Path) -> None:
        limit = int(settings.max_upload_gb * 1024**3)
        written = 0
        up.file.seek(0)
        with dest.open("wb") as out:
            while chunk := up.file.read(COPY_CHUNK):
                written += len(chunk)
                if written > limit:
                    raise _error(413, f"{up.filename} is larger than {settings.max_upload_gb:g} GB.")
                out.write(chunk)

    def timestamp() -> str:
        return datetime.now().strftime("%Y%m%d-%H%M%S")

    # ------------------------------------------------------------ routes

    @app.get("/api/health", response_model=Health, response_model_by_alias=True)
    def health() -> Health:
        writable = os.access(settings.results_dir, os.W_OK)
        conda = Path(settings.conda_exe).exists()
        return Health(
            status="ok" if writable and conda else "degraded",
            version=VERSION,
            results_dir_writable=writable,
            conda_envs={"edta": settings.edta_conda_env, "annotep": settings.annotep_conda_env},
            conda_found=conda,
            mail_configured=settings.mail_enabled,
            max_concurrent_runs=settings.max_concurrent_runs,
        )

    @app.post("/api/runs/edta", status_code=202, response_model=RunCreated, response_model_by_alias=True)
    async def start_edta(request: Request) -> RunCreated:
        form = await request.form()
        cfg = parse_config(form, EdtaConfigIn)
        genome_up = upload(form, "genome")
        extra_ups = {key: up for key, _ in EXTRA_FILES if (up := upload(form, key))}

        errors = validate_edta(
            cfg,
            genome_up.filename if genome_up else None,
            {k: up.filename or "" for k, up in extra_ups.items()},
        )
        previous: RunLocation | None = None
        if cfg.step != "all" and cfg.previous_run_id and "previousRunId" not in errors:
            previous = store.locate(cfg.previous_run_id)
            if previous is None:
                errors["previousRunId"] = "The selected run was not found."
            elif previous.read_only:
                errors["previousRunId"] = (
                    "Runs from the old results folder are read-only and cannot be continued."
                )
            elif runner.is_busy(previous.id) or not previous.status_file.exists():
                raise _error(
                    409,
                    "The selected run is still running.",
                    {"previousRunId": "The selected run is still running."},
                )
            elif store.summary(previous).kind == "pan":
                errors["previousRunId"] = "A panEDTA run cannot be continued here."
        genome_name = secure_filename(genome_up.filename) if genome_up and genome_up.filename else None
        if previous is not None and genome_name is None and "previousRunId" not in errors:
            genome_name = store.genome_of(previous)
            if genome_name is None:
                errors["genome"] = "No genome was found in the previous run folder; select one."
        if errors:
            raise _error(422, INVALID, errors)
        assert genome_name is not None

        switches = normalize_switches(cfg)
        options = TimelineContext(
            kind=cfg.mode,
            step=cfg.step,
            anno=switches.anno,
            evaluate=switches.evaluate,
            run_lai=cfg.mode == "annotep" and switches.run_lai,
            charts=cfg.mode == "edta" and switches.anno,
        )
        file_names = {k: secure_filename(up.filename or "") for k, up in extra_ups.items()}
        cmd_input = EdtaCommandInput(
            mode=cfg.mode,
            species=cfg.species,
            step=cfg.step,
            switches=switches,
            threads=cfg.threads,
            mutation_rate=cfg.mutation_rate,
            max_div=cfg.max_div,
            files=file_names,
        )

        created = previous is None
        run_name = (cfg.run_name or "").strip() or strip_extension(genome_name)
        loc = previous or store.create_run_dir(f"{run_name}_{timestamp()}")
        try:
            if not created:
                # Legacy behaviour when continuing a run: status.txt removed, log restarted.
                loc.status_file.unlink(missing_ok=True)
            (loc.path / LOG_FILE).write_bytes(b"")
            if genome_up:
                save(genome_up, loc.path / genome_name)
            for key, up in extra_ups.items():
                save(up, loc.path / file_names[key])
            commands = build_edta_commands(cmd_input, genome_name, scripts)
            display = build_edta_commands(cmd_input, genome_name, DISPLAY_SCRIPTS)
            conda_env = settings.annotep_conda_env if cfg.mode == "annotep" else settings.edta_conda_env
            write_meta(loc, _meta(cfg.mode, genome_name, options, commands, conda_env))
        except BaseException:
            if created:
                shutil.rmtree(loc.path, ignore_errors=True)
            raise

        extra_path = (
            [str(settings.annotep_root / "EDTA" / "util")]
            if cfg.mode == "annotep"
            # AnnoTEP/Scripts: break_fasta.pl, used by the EDTA charts script.
            else [str(settings.edta_dir / "bin"), str(settings.annotep_root / "Scripts")]
        )
        # EDTA charts: the R/Python packages of the charts are in the AnnoTEP env.
        command_envs = [conda_env, settings.annotep_conda_env] if options.charts else []
        mail.send_checking(cfg.email, "\n".join(format_command(c) for c in display))
        runner.submit(Job(loc, commands, conda_env, extra_path, options, cfg.email, command_envs))
        return RunCreated(run_id=loc.id)

    @app.post("/api/runs/pan", status_code=202, response_model=RunCreated, response_model_by_alias=True)
    async def start_pan(request: Request) -> RunCreated:
        form = await request.form()
        cfg = parse_config(form, PanConfigIn)
        pair_ups = [
            (upload(form, f"pairs.{i}.genome"), upload(form, f"pairs.{i}.cds")) for i in range(cfg.pairs)
        ]
        cds_up, lib_up = upload(form, "cds"), upload(form, "library")
        errors = validate_pan(
            cfg,
            [(g.filename if g else None, c.filename if c else None) for g, c in pair_ups],
            cds_up.filename if cds_up else None,
            lib_up.filename if lib_up else None,
        )
        if errors:
            raise _error(422, INVALID, errors)
        assert cds_up is not None

        ts = timestamp()
        loc = store.create_run_dir(f"panGenome_{ts}")
        list_name = f"genome_{ts}.cds.list"
        options = TimelineContext(kind="pan", step="all", anno=True)
        try:
            (loc.path / LOG_FILE).write_bytes(b"")
            rows: list[tuple[str, str | None]] = []
            for g, c in pair_ups:
                assert g is not None
                g_name = secure_filename(g.filename or "")
                save(g, loc.path / g_name)
                c_name = secure_filename(c.filename or "") if c else None
                if c and c_name:
                    save(c, loc.path / c_name)
                rows.append((g_name, c_name))
            cds_name = secure_filename(cds_up.filename or "")
            save(cds_up, loc.path / cds_name)
            lib_name = secure_filename(lib_up.filename or "") if lib_up else None
            if lib_up and lib_name:
                save(lib_up, loc.path / lib_name)
            (loc.path / list_name).write_text(build_pan_list(rows), encoding="utf-8")

            command = build_pan_command(list_name, cds_name, lib_name, cfg.threads, cfg.copies, scripts)
            display = build_pan_command(
                list_name, cds_name, lib_name, cfg.threads, cfg.copies, DISPLAY_SCRIPTS
            )
            write_meta(loc, _meta("pan", None, options, [command], settings.edta_conda_env))
        except BaseException:
            shutil.rmtree(loc.path, ignore_errors=True)
            raise

        mail.send_checking(cfg.email, format_command(display))
        runner.submit(
            Job(loc, [command], settings.edta_conda_env, [str(settings.edta_dir / "bin")], options, cfg.email)
        )
        return RunCreated(run_id=loc.id)

    @app.get("/api/runs", response_model=list[RunSummary], response_model_by_alias=True)
    def list_runs() -> list[RunSummary]:
        positions = runner.queue_positions()
        runs = [store.summary(loc, positions.get(loc.id)) for loc in store.locations()]
        runs.sort(key=lambda r: r.started_at or "", reverse=True)
        runs.sort(key=lambda r: r.status != "running")
        return runs

    @app.get("/api/runs/{run_id}", response_model=RunSummary, response_model_by_alias=True)
    def get_run(run_id: str) -> RunSummary:
        return summary_of(locate(run_id))

    @app.get("/api/runs/{run_id}/log", response_model=LogResponse, response_model_by_alias=True)
    def get_log(run_id: str, tail: int | None = Query(default=None, ge=1)) -> LogResponse:
        loc = locate(run_id)
        limit = min(tail or settings.log_max_lines, settings.log_max_lines)
        lines, total = read_lines(loc.log, limit)
        return LogResponse(lines=lines, total=total)

    @app.get("/api/runs/{run_id}/events")
    async def events(run_id: str, request: Request) -> StreamingResponse:
        loc = locate(run_id)
        last = request.headers.get("last-event-id")
        last_id = int(last) if last and last.isdigit() else None
        stream = run_events(
            loc, lambda: summary_of(loc), last_id, settings.log_max_lines, request.is_disconnected
        )
        return StreamingResponse(
            stream,
            media_type="text/event-stream",
            headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
        )

    @app.post("/api/runs/{run_id}/cancel", status_code=202)
    def cancel(run_id: str) -> dict[str, str]:
        loc = locate(run_id)
        if loc.read_only:
            raise _error(409, "Runs from the old results folder are read-only.")
        if not runner.cancel(run_id):
            raise _error(409, "This run is not queued or running in this server.")
        return {"runId": run_id}

    @app.get("/api/runs/{run_id}/files", response_model=list[FileEntry], response_model_by_alias=True)
    def list_files(run_id: str) -> list[FileEntry]:
        loc = locate(run_id)
        base = loc.path.resolve()
        entries: list[FileEntry] = []
        for root, dirs, files in os.walk(base, followlinks=False):
            dirs.sort()
            for name in sorted(files):
                entry = _file_entry(base, Path(root) / name)
                if entry:
                    entries.append(entry)
                if len(entries) >= MAX_LISTED_FILES:
                    return entries
        return entries

    @app.get("/api/runs/{run_id}/report", response_model=list[FileEntry], response_model_by_alias=True)
    def report_files(run_id: str) -> list[FileEntry]:
        """Files the report view uses: the run folder's top level plus REPORT/ (recursive).
        Skips the big intermediate folders (*.EDTA.raw, *.EDTA.combine…) that /files walks."""
        loc = locate(run_id)
        base = loc.path.resolve()
        entries = [e for p in sorted(base.iterdir()) if p.is_file() and (e := _file_entry(base, p))]
        report = base / REPORT_DIR
        if report.is_dir() and not report.is_symlink():
            for root, dirs, files in os.walk(report, followlinks=False):
                dirs.sort()
                for name in sorted(files):
                    if e := _file_entry(base, Path(root) / name):
                        entries.append(e)
                    if len(entries) >= MAX_LISTED_FILES:
                        return entries
        return entries

    @app.get("/api/runs/{run_id}/files/{path:path}")
    def download(run_id: str, path: str, inline: bool = False) -> FileResponse:
        loc = locate(run_id)
        target = safe_child(loc.path, path)
        if target is None or not target.is_file():
            raise _error(404, "File not found.")
        if not inline:
            return FileResponse(target, filename=target.name)
        # Shown in the browser (images, PDFs, RepeatLandscape.html). The sandbox gives HTML
        # pages an opaque origin, so their scripts cannot reach this API.
        return FileResponse(
            target,
            filename=target.name,
            content_disposition_type="inline",
            headers={
                "Content-Security-Policy": "sandbox allow-scripts",
                "X-Content-Type-Options": "nosniff",
            },
        )

    @app.get("/api/test-data/{name}")
    def test_data(name: str) -> FileResponse:
        folder = TEST_FILES.get(name)
        if folder is None:
            raise _error(404, "Unknown test file.")
        target = settings.edta_dir / folder / name
        if not target.is_file():
            raise _error(404, f"Test file not found on the server ({folder / name}).")
        return FileResponse(target, filename=name)

    # ------------------------------------------------------------ web interface

    # The React build, at / (one address for everything; used by the Docker image). Registered
    # last so the /api routes win. The frontend uses a hash router, so index.html is enough.
    if (settings.frontend_dist / "index.html").is_file():
        app.mount("/", StaticFiles(directory=settings.frontend_dist, html=True), name="frontend")
    else:
        log.info("frontend build not found in %s; serving the API only", settings.frontend_dist)

    return app


SAFE_METHODS = frozenset({"GET", "HEAD", "OPTIONS"})


def _origin_allowed(origin: str, allowed_hosts: list[str]) -> bool:
    """Origin of a page on one of the allowed host names (any port, http or https).
    'null' (sandboxed pages, such as RepeatLandscape.html) is refused."""
    parts = urlsplit(origin)
    if parts.scheme not in ("http", "https") or not parts.hostname:
        return False
    host = parts.hostname.lower()
    return host in allowed_hosts or f"[{host}]" in allowed_hosts


def _file_entry(base: Path, p: Path) -> FileEntry | None:
    """Listing entry, or None for links leaving the run folder and unreadable files."""
    rel = str(p.relative_to(base))
    if p.is_symlink() and safe_child(base, rel) is None:
        return None
    try:
        st = p.stat()
    except OSError:
        return None
    if not p.is_file():
        return None
    modified = datetime.fromtimestamp(st.st_mtime).astimezone().isoformat(timespec="seconds")
    return FileEntry(path=rel, size=st.st_size, modified_at=modified)


def _meta(
    kind: str,
    genome: str | None,
    options: TimelineContext,
    commands: list[list[str]],
    conda_env: str,
) -> dict[str, Any]:
    return {
        "schema": META_SCHEMA,
        "kind": kind,
        "genome": genome,
        "options": options.model_dump(by_alias=True),
        "startedAt": now_iso(),
        "finishedAt": None,
        "commands": commands,
        "condaEnv": conda_env,
        "pid": None,
        "exitCode": None,
        "cancelled": False,
        "finalMessageFound": None,
        "backendVersion": VERSION,
    }
