"""API end to end with the fake executor."""

import hashlib
import json
import re
import subprocess
import threading
import time
from pathlib import Path

from fastapi.testclient import TestClient

from app.api import create_app
from app.mailer import Mailer
from app.runner import CANCELLED_LINE, INTERRUPTED_LINE

from .conftest import FASTA, Behaviour, Ctx, FakeExecutor, default_behaviour, make_settings

RUN_ID = re.compile(r"^genome_\d{8}-\d{6}(-\d+)?$")


def tree_hash(root: Path) -> str:
    h = hashlib.sha256()
    for p in sorted(root.rglob("*")):
        h.update(str(p.relative_to(root)).encode())
        if p.is_file():
            h.update(p.read_bytes())
    return h.hexdigest()


# ------------------------------------------------------------------ basics


def test_health(ctx: Ctx):
    body = ctx.client.get("/api/health").json()
    assert body["version"] == "0.1.0"
    assert body["condaEnvs"] == {"edta": "EDTAgui", "annotep": "annotepgui_3_11"}
    assert body["resultsDirWritable"] is True
    assert body["condaFound"] is False and body["status"] == "degraded"


def test_edta_run_end_to_end(ctx: Ctx):
    r = ctx.post_edta({"switches": {"evaluate": True}}, {"cds": ("genome.cds.fa", FASTA)})
    assert r.status_code == 202, r.text
    run_id = r.json()["runId"]
    assert RUN_ID.match(run_id)

    run = ctx.wait(run_id)
    assert run["status"] == "completed"
    assert run["statusText"] == "Annotation finalised"
    assert run["finalMessageFound"] is True
    assert run["kind"] == "edta" and run["genome"] == "genome.fa" and run["readOnly"] is False
    assert run["options"] == {"kind": "edta", "step": "all", "anno": True, "evaluate": True, "runLai": False}

    folder = ctx.settings.results_dir / run_id
    assert (folder / "status.txt").read_text() == "Annotation finalised"
    assert (folder / "genome.fa").read_bytes() == FASTA
    assert (folder / "genome.cds.fa").exists()
    assert "Evaluation of TE annotation finished!" in (folder / "log.txt").read_text()

    call = ctx.executor.calls[0]
    assert call["argv"][:5] == ["/fake/conda", "run", "--no-capture-output", "-n", "EDTAgui"]
    assert call["argv"][5] == str(ctx.settings.edta_dir / "EDTA.pl")
    assert call["argv"][6:] == [
        "--genome", "genome.fa", "--species", "others", "--step", "all", "--sensitive", "0",
        "--threads", "10", "--anno", "1", "--evaluate", "1", "--cds", "genome.cds.fa",
    ]  # fmt: skip
    assert call["cwd"] == folder
    assert call["env"]["PATH"].endswith(str(ctx.settings.edta_dir / "bin"))

    meta = json.loads((folder / "run.json").read_text())
    assert meta["kind"] == "edta" and meta["exitCode"] == 0 and meta["finishedAt"]
    assert meta["condaEnv"] == "EDTAgui" and "email" not in meta


def test_annotep_runs_report_after_edta(ctx: Ctx):
    r = ctx.post_edta({"mode": "annotep", "switches": {"runLai": True}})
    run_id = r.json()["runId"]
    run = ctx.wait(run_id)
    assert run["status"] == "completed" and run["finalMessageFound"] is True
    assert run["options"]["kind"] == "annotep" and run["options"]["anno"] is True

    edta_call, report_call = ctx.executor.calls
    assert edta_call["argv"][4] == "annotepgui_3_11"
    assert (
        "--sensitive" in edta_call["argv"]
        and edta_call["argv"][edta_call["argv"].index("--sensitive") + 1] == "1"
    )
    assert edta_call["argv"][-2:] == ["--run_LAI", "1"]
    assert report_call["argv"][5:] == [
        "bash",
        str(ctx.settings.annotep_root / "Scripts" / "generate_PLOTs-for-TE-pipe.sh"),
        "genome.fa",
    ]
    assert edta_call["env"]["PATH"].endswith(str(ctx.settings.annotep_root / "EDTA" / "util"))
    log = (ctx.settings.results_dir / run_id / "log.txt").read_text()
    assert log.index("Evaluation of TE annotation") < log.index("AnnoTEP annotation completed successfully")
    assert log.index("Starting report and chart generation") < log.index(
        "charts and reports has been completed"
    )


def test_failure_writes_error_status_and_skips_report(ctx: Ctx):
    run_id = ctx.post_edta({"mode": "annotep"}, genome="will_fail.fa").json()["runId"]
    run = ctx.wait(run_id)
    assert run["status"] == "failed" and run["statusText"] == "Error in the annotation step"
    assert len(ctx.executor.calls) == 1  # report script not started


def test_executor_exception_still_writes_status(ctx: Ctx):
    ctx.executor.behaviour = lambda argv: Behaviour(error=OSError("conda not found"))
    run_id = ctx.post_edta({}).json()["runId"]
    run = ctx.wait(run_id)
    assert run["status"] == "failed"
    log = (ctx.settings.results_dir / run_id / "log.txt").read_text()
    assert "[Pipeline Error]" in log and "conda not found" in log


def test_final_message_missing_is_reported(ctx: Ctx):
    ctx.executor.behaviour = lambda argv: Behaviour(["no final message here"])
    run_id = ctx.post_edta({"switches": {"anno": True}}).json()["runId"]
    run = ctx.wait(run_id)
    assert run["status"] == "completed" and run["finalMessageFound"] is False


# ------------------------------------------------------------------ validation


def test_validation_errors_use_frontend_field_names(ctx: Ctx):
    r = ctx.post_edta({"threads": 4, "maxDiv": 101, "mutationRate": "abc"}, genome=None)
    assert r.status_code == 422
    body = r.json()
    assert body["message"].startswith("The run was not started")
    assert set(body["fieldErrors"]) == {"threads", "maxDiv", "mutationRate", "genome"}

    r = ctx.post_edta({}, {"exclude": ("r.bed", b"chr1\t1\t2\n")})
    assert r.status_code == 422 and "files.exclude" in r.json()["fieldErrors"]
    r = ctx.post_edta({}, genome="genome.txt")
    assert r.json()["fieldErrors"]["genome"].startswith("Accepted extensions")
    r = ctx.post_edta({"species": "banana"})
    assert r.status_code == 422 and "species" in r.json()["fieldErrors"]
    r = ctx.post_edta({"unknown": 1})
    assert r.status_code == 422
    r = ctx.client.post("/api/runs/edta", data={"config": "not json"})
    assert r.status_code == 422
    assert not any(ctx.settings.results_dir.iterdir())  # nothing created


def test_file_names_are_sanitized(ctx: Ctx):
    r = ctx.post_edta(
        {"switches": {"anno": True}}, {"exclude": ("../../evil regions.bed", b"x")}, genome="My genome.fa"
    )
    run_id = r.json()["runId"]
    assert run_id.startswith("My_genome_")
    ctx.wait(run_id)
    folder = ctx.settings.results_dir / run_id
    assert (folder / "My_genome.fa").exists() and (folder / "evil_regions.bed").exists()
    argv = ctx.executor.calls[0]["argv"]
    assert argv[argv.index("--genome") + 1] == "My_genome.fa"
    assert argv[argv.index("--exclude") + 1] == "evil_regions.bed"


# ------------------------------------------------------------------ reuse (step ≠ all)


def test_continue_previous_run_without_genome(ctx: Ctx):
    first = ctx.post_edta({}).json()["runId"]
    ctx.wait(first)
    r = ctx.post_edta({"step": "final", "previousRunId": first}, genome=None)
    assert r.status_code == 202, r.text
    assert r.json()["runId"] == first
    run = ctx.wait(first)
    assert run["status"] == "completed" and run["options"]["step"] == "final"
    argv = ctx.executor.calls[-1]["argv"]
    assert argv[argv.index("--genome") + 1] == "genome.fa"
    assert argv[argv.index("--step") + 1] == "final"


def test_legacy_runs_are_read_only(ctx: Ctx):
    before = tree_hash(ctx.root / "legacy")
    r = ctx.post_edta({"step": "anno", "previousRunId": "example_20250726-103151"}, genome=None)
    assert r.status_code == 422
    assert "read-only" in r.json()["fieldErrors"]["previousRunId"]
    assert ctx.client.post("/api/runs/example_20250726-103151/cancel").status_code == 409
    ctx.client.get("/api/runs")
    assert tree_hash(ctx.root / "legacy") == before


def test_continue_unknown_or_pan_run(ctx: Ctx):
    r = ctx.post_edta({"step": "anno", "previousRunId": "nope_20260101-000000"}, genome=None)
    assert r.json()["fieldErrors"]["previousRunId"] == "The selected run was not found."


# ------------------------------------------------------------------ panEDTA


def post_pan(ctx: Ctx, pairs, cds=("genome.cds.fa", FASTA), library=None, **cfg):
    files = []
    for i, (g, c) in enumerate(pairs):
        if g:
            files.append((f"pairs.{i}.genome", (g, FASTA)))
        if c:
            files.append((f"pairs.{i}.cds", (c, FASTA)))
    if cds:
        files.append(("cds", cds))
    if library:
        files.append(("library", library))
    config = {"threads": 10, "copies": 3, "pairs": len(pairs), **cfg}
    return ctx.client.post("/api/runs/pan", data={"config": json.dumps(config)}, files=files)


def test_pan_run(ctx: Ctx):
    r = post_pan(
        ctx, [("Ler.test.fa", None), ("Col.test.fa", "Col.cds.fa")], library=("lib.fa", FASTA), threads=20
    )
    assert r.status_code == 202, r.text
    run_id = r.json()["runId"]
    assert re.match(r"^panGenome_\d{8}-\d{6}$", run_id)
    run = ctx.wait(run_id)
    assert run["kind"] == "pan" and run["status"] == "completed" and run["finalMessageFound"] is True

    folder = ctx.settings.results_dir / run_id
    ts = run_id.removeprefix("panGenome_")
    lst = folder / f"genome_{ts}.cds.list"
    assert lst.read_text() == "Ler.test.fa\nCol.test.fa\tCol.cds.fa\n"
    argv = ctx.executor.calls[0]["argv"]
    assert argv[4] == "EDTAgui"
    assert argv[5:] == [
        "bash", str(ctx.settings.edta_dir / "panEDTA.sh"), "-g", lst.name, "-c", "genome.cds.fa",
        "-l", "lib.fa", "-t", "20", "-f", "3", "-o", "1",
    ]  # fmt: skip


def test_file_names_starting_with_dash_are_refused(ctx: Ctx):
    r = ctx.post_edta({}, genome="-chr.fa")
    assert r.status_code == 422
    assert "cannot start with '-'" in r.json()["fieldErrors"]["genome"]
    r = ctx.post_edta({}, {"cds": ("--cds.fa", b">a\nACGT\n")})
    assert "cannot start with '-'" in r.json()["fieldErrors"]["files.cds"]
    assert not any(ctx.settings.results_dir.iterdir())


# ------------------------------------------------------------------ requests from other sites


def test_unknown_host_names_are_refused(ctx: Ctx):
    """DNS rebinding: a site pointing its own name at 127.0.0.1 must not read the runs."""
    assert ctx.client.get("/api/runs", headers={"Host": "attacker.example:8000"}).status_code == 400
    for host in ("localhost:8000", "127.0.0.1:8000", "[::1]:8000", "localhost"):
        assert ctx.client.get("/api/runs", headers={"Host": host}).status_code == 200, host


def test_posts_from_other_sites_are_refused(ctx: Ctx):
    """CSRF: a page of another site (or a sandboxed page, Origin "null") cannot start or
    cancel runs."""
    for origin in ("https://evil.example", "http://localhost.evil.example", "null"):
        r = ctx.client.post("/api/runs/x_20260101-000000/cancel", headers={"Origin": origin})
        assert r.status_code == 403, origin
        r = ctx.client.post(
            "/api/runs/edta",
            headers={"Origin": origin},
            data={"config": json.dumps({"mode": "edta", "threads": 10})},
            files={"genome": ("g.fa", FASTA)},
        )
        assert r.status_code == 403, origin
    assert not any(ctx.settings.results_dir.iterdir())
    assert ctx.executor.calls == []


def test_posts_from_the_interface_are_accepted(ctx: Ctx):
    for origin in ("http://localhost:8000", "http://127.0.0.1:8000", "http://localhost:5173"):
        r = ctx.client.post(
            "/api/runs/edta",
            headers={"Origin": origin},
            data={"config": json.dumps({"mode": "edta", "threads": 10})},
            files={"genome": ("g.fa", FASTA)},
        )
        assert r.status_code == 202, origin
        ctx.wait(r.json()["runId"])
    # no Origin (curl, scripts on this machine): accepted
    r = ctx.post_edta({})
    assert r.status_code == 202
    ctx.wait(r.json()["runId"])


def test_pan_validation(ctx: Ctx):
    r = post_pan(ctx, [("A.fa", None), ("A.fa", None), (None, "orphan.cds.fa")], cds=None, copies=2)
    assert r.status_code == 422
    assert set(r.json()["fieldErrors"]) == {"pairs.1.genome", "pairs.2.genome", "cds", "copies"}


# ------------------------------------------------------------------ queue and cancel


def test_queue_runs_one_after_the_other(ctx: Ctx):
    gate = threading.Event()
    ctx.executor.behaviour = lambda argv: Behaviour(["working"], gate=gate)
    first = ctx.post_edta({}).json()["runId"]
    time.sleep(0.2)
    second = ctx.post_edta({}, genome="other.fa").json()["runId"]

    queued = ctx.client.get(f"/api/runs/{second}").json()
    assert queued["status"] == "running" and queued["queuePosition"] == 1
    assert ctx.client.get(f"/api/runs/{first}").json()["queuePosition"] is None
    log = (ctx.settings.results_dir / second / "log.txt").read_text()
    assert "[Queued: position 1. The run will start right after the current one finishes.]" in log
    assert len(ctx.executor.calls) == 1

    gate.set()
    assert ctx.wait(first)["status"] == "completed"
    assert ctx.wait(second)["status"] == "completed"
    assert len(ctx.executor.calls) == 2


def test_cancel_running_and_queued(ctx: Ctx):
    gate = threading.Event()
    ctx.executor.behaviour = lambda argv: Behaviour(["working"], gate=gate)
    running = ctx.post_edta({}).json()["runId"]
    time.sleep(0.2)
    queued = ctx.post_edta({}, genome="other.fa").json()["runId"]

    assert ctx.client.post(f"/api/runs/{queued}/cancel").status_code == 202
    q = ctx.wait(queued)
    assert q["status"] == "failed"
    assert CANCELLED_LINE in (ctx.settings.results_dir / queued / "log.txt").read_text()

    assert ctx.client.post(f"/api/runs/{running}/cancel").status_code == 202
    run = ctx.wait(running)
    assert run["status"] == "failed" and run["statusText"] == "Error in the annotation step"
    assert ctx.executor.processes[0].terminated
    meta = json.loads((ctx.settings.results_dir / running / "run.json").read_text())
    assert meta["cancelled"] is True
    assert ctx.client.post(f"/api/runs/{running}/cancel").status_code == 409
    assert len(ctx.executor.calls) == 1  # the queued run never started


# ------------------------------------------------------------------ listing, log, files


def test_list_runs_new_and_legacy(ctx: Ctx):
    new_id = ctx.post_edta({}).json()["runId"]
    ctx.wait(new_id)
    runs = ctx.client.get("/api/runs").json()
    ids = [r["id"] for r in runs]
    assert ids[0] == "rice_20250901-120000"  # running first (legacy, no status.txt)
    by_id = {r["id"]: r for r in runs}
    assert by_id["example_20250726-103151"]["readOnly"] is True
    assert by_id["panGenome_20250801-090000"]["kind"] == "pan"
    assert by_id[new_id]["readOnly"] is False
    # absolute folder path, shown in the run header
    assert by_id[new_id]["path"] == str(ctx.settings.results_dir.resolve() / new_id)
    assert by_id["example_20250726-103151"]["path"].endswith("/example_20250726-103151")
    assert ids.index(new_id) < ids.index("example_20250726-103151")  # most recent first


def test_log_and_files(ctx: Ctx):
    run_id = ctx.post_edta({}).json()["runId"]
    ctx.wait(run_id)
    log = ctx.client.get(f"/api/runs/{run_id}/log?tail=2").json()
    assert log["total"] == 4 and len(log["lines"]) == 2

    files = {f["path"] for f in ctx.client.get(f"/api/runs/{run_id}/files").json()}
    assert {"genome.fa", "log.txt", "status.txt", "run.json"} <= files
    r = ctx.client.get(f"/api/runs/{run_id}/files/genome.fa")
    assert r.status_code == 200 and r.content == FASTA

    assert (
        ctx.client.get(
            f"/api/runs/{run_id}/files/..%2F..%2Flegacy%2Fexample_20250726-103151%2Flog.txt"
        ).status_code
        == 404
    )
    assert ctx.client.get(f"/api/runs/{run_id}/files/missing.txt").status_code == 404
    assert ctx.client.get("/api/runs/..%2Flegacy").status_code == 404
    assert ctx.client.get("/api/runs/does_not_exist").status_code == 404


def test_report_listing_and_inline_files(ctx: Ctx):
    run_id = ctx.post_edta({}).json()["runId"]
    ctx.wait(run_id)
    folder = ctx.settings.results_dir / run_id
    (folder / "REPORT" / "TREE").mkdir(parents=True)
    (folder / "REPORT" / "TE-Report-bar.png").write_bytes(b"\x89PNG")
    (folder / "REPORT" / "TREE" / "all.nwk").write_text("(a,b);")
    (folder / "REPORT" / "RepeatLandscape.html").write_text("<script>1</script>")
    (folder / "genome.fa.mod.EDTA.raw").mkdir()
    (folder / "genome.fa.mod.EDTA.raw" / "tmp.txt").write_text("x")

    paths = [f["path"] for f in ctx.client.get(f"/api/runs/{run_id}/report").json()]
    assert {"genome.fa", "log.txt", "REPORT/TE-Report-bar.png", "REPORT/TREE/all.nwk"} <= set(paths)
    assert not any(p.startswith("genome.fa.mod.EDTA.raw") for p in paths)

    attached = ctx.client.get(f"/api/runs/{run_id}/files/REPORT/TE-Report-bar.png")
    assert attached.headers["content-disposition"].startswith("attachment")
    shown = ctx.client.get(f"/api/runs/{run_id}/files/REPORT/RepeatLandscape.html?inline=1")
    assert shown.headers["content-disposition"].startswith("inline")
    assert shown.headers["content-security-policy"] == "sandbox allow-scripts"
    assert ctx.client.get("/api/runs/does_not_exist/report").status_code == 404


# ------------------------------------------------------------------ SSE


def read_sse(client: TestClient, url: str, headers=None) -> list[tuple[str, dict]]:
    events: list[tuple[str, dict]] = []
    with client.stream("GET", url, headers=headers or {}) as r:
        assert r.headers["content-type"].startswith("text/event-stream")
        name = None
        for line in r.iter_lines():
            if line.startswith("event: "):
                name = line[7:]
            elif line.startswith("data: ") and name:
                events.append((name, json.loads(line[6:])))
                if name == "end":
                    break
    return events


def test_events_stream_follows_log_until_end(ctx: Ctx):
    gate = threading.Event()

    def behaviour(argv):
        return Behaviour(["first line"], gate=gate)

    ctx.executor.behaviour = behaviour
    run_id = ctx.post_edta({}).json()["runId"]
    time.sleep(0.2)

    def finish():
        time.sleep(0.8)
        with (ctx.settings.results_dir / run_id / "log.txt").open("a") as f:
            f.write("second line\n")
        time.sleep(0.6)
        gate.set()

    threading.Thread(target=finish).start()
    events = read_sse(ctx.client, f"/api/runs/{run_id}/events")
    names = [n for n, _ in events]
    assert names[0] == "log" and events[0][1]["replace"] is True
    assert "first line" in events[0][1]["lines"]
    all_lines = [ln for n, d in events if n == "log" for ln in d["lines"]]
    assert "second line" in all_lines
    statuses = [d["status"] for n, d in events if n == "status"]
    assert statuses[0] == "running" and statuses[-1] == "completed"
    assert names[-1] == "end"

    # Resume from Last-Event-ID: only the lines after it.
    resumed = read_sse(ctx.client, f"/api/runs/{run_id}/events", headers={"Last-Event-ID": "1"})
    assert resumed[0][0] == "log" and resumed[0][1]["replace"] is False
    assert "first line" not in resumed[0][1]["lines"]


# ------------------------------------------------------------------ mail


def test_mail_checking_and_final(ctx: Ctx):
    run_id = ctx.post_edta({"email": "user@example.org"}).json()["runId"]
    ctx.wait(run_id)
    deadline = time.time() + 5
    while len(ctx.mails) < 2 and time.time() < deadline:
        time.sleep(0.05)
    subjects = [m["Subject"] for m in ctx.mails]
    assert subjects == ["Verification email", "Annotation Completed Successfully"]
    body = ctx.mails[0].get_content()
    assert "EDTA.pl --genome genome.fa --species others" in body
    assert ctx.mails[1].get_payload()[1].get_filename() == "annotation_log.txt"


def test_mail_failure_never_blocks_a_run(tmp_path: Path):
    def broken(_msg):
        raise ConnectionError("SMTP down")

    settings = make_settings(tmp_path)
    app = create_app(settings, FakeExecutor(), Mailer(settings, send=broken))
    with TestClient(app) as client:
        r = client.post(
            "/api/runs/edta",
            data={"config": json.dumps({"mode": "edta", "email": "a@b.org"})},
            files={"genome": ("g.fa", FASTA)},
        )
        assert r.status_code == 202
        assert app.state.runner.wait(r.json()["runId"], 5)
        assert client.get(f"/api/runs/{r.json()['runId']}").json()["status"] == "completed"


def test_mail_disabled_logs_a_warning(tmp_path: Path, caplog):
    settings = make_settings(tmp_path)
    assert not settings.mail_enabled
    with caplog.at_level("WARNING", logger="edta_gui.mail"):
        Mailer(settings).send_checking("a@b.org", "EDTA.pl --genome g.fa")
    assert "MAIL_SERVER is not configured" in caplog.text


def test_serves_frontend_build_when_present(tmp_path: Path):
    dist = tmp_path / "dist"
    (dist / "assets").mkdir(parents=True)
    (dist / "index.html").write_text("<!doctype html><title>EDTA-GUI</title>")
    (dist / "assets" / "app.js").write_text("console.log(1)")
    app = create_app(make_settings(tmp_path, frontend_dist=dist), FakeExecutor())
    with TestClient(app) as client:
        assert "EDTA-GUI" in client.get("/").text
        assert client.get("/assets/app.js").status_code == 200
        assert client.get("/api/health").json()["version"]  # API still wins
        assert client.get("/api/runs/nope").status_code == 404


def test_api_only_without_frontend_build(tmp_path: Path):
    app = create_app(make_settings(tmp_path, frontend_dist=tmp_path / "missing"), FakeExecutor())
    with TestClient(app) as client:
        assert client.get("/").status_code == 404
        assert client.get("/api/health").status_code == 200


def test_display_path_map_shows_host_folders(tmp_path: Path):
    settings = make_settings(
        tmp_path, display_path_map=f"{tmp_path / 'new'}=/home/ana/edta/results; bad-entry"
    )
    assert settings.display_path(tmp_path / "new" / "g_1") == "/home/ana/edta/results/g_1"
    assert settings.display_path(tmp_path / "newer") == str(tmp_path / "newer")
    app = create_app(settings, FakeExecutor())
    with TestClient(app) as client:
        r = client.post(
            "/api/runs/edta",
            data={"config": json.dumps({"mode": "edta"})},
            files={"genome": ("g.fa", FASTA)},
        )
        run = client.get(f"/api/runs/{r.json()['runId']}").json()
        assert run["path"] == f"/home/ana/edta/results/{run['id']}"


# ------------------------------------------------------------------ restart recovery


def dead_pid() -> int:
    p = subprocess.Popen(["true"])
    p.wait()
    return p.pid


def test_interrupted_runs_are_closed_on_start(tmp_path: Path):
    settings = make_settings(tmp_path)
    new = settings.results_dir
    for name, log, opts in [
        ("broken_20260101-000000", "Dependency checking:\n", {"kind": "edta", "anno": False}),
        ("done_20260101-000000", "EDTA final stage finished!\n", {"kind": "edta", "anno": False}),
    ]:
        d = new / name
        d.mkdir(parents=True)
        (d / "log.txt").write_text(log)
        (d / "run.json").write_text(
            json.dumps({"schema": 1, "kind": "edta", "options": opts, "pid": dead_pid()})
        )
    legacy_running = tmp_path / "legacy" / "old_20250101-000000"
    legacy_running.mkdir(parents=True)
    (legacy_running / "log.txt").write_text("x\n")

    app = create_app(settings, FakeExecutor(), Mailer(settings, send=lambda m: None))
    with TestClient(app) as client:
        broken = client.get("/api/runs/broken_20260101-000000").json()
        assert broken["status"] == "failed"
        assert INTERRUPTED_LINE in (new / "broken_20260101-000000" / "log.txt").read_text()
        assert client.get("/api/runs/done_20260101-000000").json()["status"] == "completed"
        assert client.get("/api/runs/old_20250101-000000").json()["status"] == "running"
        assert not (legacy_running / "status.txt").exists()


def test_default_behaviour_is_deterministic():
    assert default_behaviour(["x", "--genome", "a_fail.fa"]).exit_code == 1
