"""Validation, file names, results store and step detector."""

from pathlib import Path

import pytest

from app.files import is_valid_run_id, safe_child, secure_filename
from app.models import EdtaConfigIn, PanConfigIn, TimelineContext
from app.results_store import ResultsStore, folder_started_at, tail_lines
from app.step_detector import final_message_found
from app.validation import normalize_switches, validate_edta, validate_mutation_rate, validate_pan

from .conftest import make_legacy


def edta(**kw) -> EdtaConfigIn:
    return EdtaConfigIn.model_validate({"mode": "edta", **kw})


@pytest.mark.parametrize("v", ["1.3e-8", "1e-8", "7.0e-9", "0.000000013", "2E-9", ".5", ""])
def test_mutation_rate_ok(v):
    assert validate_mutation_rate(v) is None


@pytest.mark.parametrize("v", ["abc", "-1e-8", "0", "1.3e", "1,3e-8"])
def test_mutation_rate_bad(v):
    assert validate_mutation_rate(v) is not None


def test_validate_edta_rules():
    assert "genome" in validate_edta(edta(), None, {})
    assert validate_edta(edta(), "genome.fa", {}) == {}
    assert "genome" in validate_edta(edta(), "genome.txt", {})
    errs = validate_edta(edta(threads=4, maxDiv=101, email="x"), "g.fa", {})
    assert set(errs) == {"threads", "maxDiv", "email"}
    # exclude/rmout need Annotation; Evaluate and MAKER mask imply Annotation
    assert "files.exclude" in validate_edta(edta(), "g.fa", {"exclude": "r.bed"})
    assert validate_edta(edta(switches={"evaluate": True}), "g.fa", {"rmout": "r.out"}) == {}
    # run name: optional, folder-safe, only for new runs
    assert validate_edta(edta(runName="TAIR10_test-1.2"), "g.fa", {}) == {}
    assert "runName" in validate_edta(edta(runName="my run"), "g.fa", {})
    assert "runName" in validate_edta(edta(runName="-x"), "g.fa", {})
    assert "runName" in validate_edta(edta(runName="a" * 81), "g.fa", {})
    assert "runName" in validate_edta(edta(step="final", previousRunId="x", runName="n"), None, {})
    # step "anno" implies Annotation (EDTA.pl does nothing without --anno 1)
    assert validate_edta(edta(step="anno", previousRunId="x"), "g.fa", {"rmout": "r.out"}) == {}
    # EDTA mode: exclude also needs MAKER mask; AnnoTEP: Annotation is enough
    errs = validate_edta(edta(switches={"anno": True}), "g.fa", {"exclude": "r.bed"})
    assert "MAKER mask" in errs["files.exclude"]
    assert validate_edta(edta(switches={"maker": True}), "g.fa", {"exclude": "r.bed"}) == {}
    assert validate_edta(edta(mode="annotep"), "g.fa", {"exclude": "r.bed"}) == {}
    assert "files.rmout" in validate_edta(edta(switches={"anno": True}), "g.fa", {"rmout": "x.txt"})
    # same sanitized name as the genome
    assert "files.cds" in validate_edta(edta(), "g.fa", {"cds": "g.fa"})


def test_validate_edta_reuse():
    assert validate_edta(edta(step="final"), None, {}) == {
        "previousRunId": "Select the previous run to continue from."
    }
    assert validate_edta(edta(step="final", previousRunId="x_20260101-000000"), None, {}) == {}
    assert "previousRunId" in validate_edta(edta(previousRunId="x"), "g.fa", {})


def test_normalize_switches():
    s = normalize_switches(edta(mode="annotep"))
    assert s.sensitive and s.anno
    s = normalize_switches(edta(switches={"runLai": True, "tirFilter": True}))
    assert not s.run_lai and not s.tir_filter
    assert normalize_switches(edta(switches={"evaluate": True})).anno
    assert normalize_switches(edta(switches={"maker": True})).anno
    assert normalize_switches(edta(step="anno")).anno
    assert not normalize_switches(edta(step="final")).anno


def test_validate_pan():
    cfg = PanConfigIn(threads=10, copies=3, pairs=2)
    assert validate_pan(cfg, [("A.fa", None), ("B.fa", "B.cds.fa")], "g.cds.fa", None) == {}
    errs = validate_pan(
        PanConfigIn(threads=9, copies=2, pairs=3),
        [("A.fa", None), ("A.fa", None), (None, "c.fa")],
        None,
        None,
    )
    assert set(errs) == {"threads", "copies", "pairs.1.genome", "pairs.2.genome", "cds"}
    assert errs["pairs.2.genome"] == "A CDS file needs a genome in the same row."


def test_files_helpers(tmp_path: Path):
    assert secure_filename("../../etc/passwd") == "etc_passwd"
    assert secure_filename("My Genome.fa") == "My_Genome.fa"
    assert is_valid_run_id("genome_20260101-000000")
    assert not is_valid_run_id("../x") and not is_valid_run_id(".hidden") and not is_valid_run_id("a/b")
    (tmp_path / "a").mkdir()
    assert safe_child(tmp_path, "a") == (tmp_path / "a").resolve()
    assert safe_child(tmp_path, "../etc/passwd") is None
    assert safe_child(tmp_path, "/etc/passwd") is None


def test_tail_and_timestamp(tmp_path: Path):
    f = tmp_path / "log.txt"
    f.write_text("".join(f"line {i}\n" for i in range(50_000)))
    assert tail_lines(f, 3) == ["line 49997", "line 49998", "line 49999"]
    assert folder_started_at("genome_20260102-030405").startswith("2026-01-02T03:04:05")
    assert folder_started_at("no_timestamp") is None


def test_store_reads_legacy_read_only(tmp_path: Path):
    make_legacy(tmp_path)
    store = ResultsStore(tmp_path / "new", [tmp_path / "legacy"])
    runs = {loc.id: store.summary(loc) for loc in store.locations()}
    ex = runs["example_20250726-103151"]
    assert ex.read_only and ex.kind == "unknown" and ex.status == "completed"
    assert ex.genome == "example.fa" and ex.final_message_found is None
    assert ex.started_at.startswith("2025-07-26T10:31:51") and ex.finished_at
    pan = runs["panGenome_20250801-090000"]
    assert pan.kind == "pan" and pan.final_message_found is True
    rice = runs["rice_20250901-120000"]
    assert rice.status == "running" and rice.finished_at is None
    assert store.locate("../legacy") is None


def test_final_message():
    ctx = TimelineContext(kind="edta", anno=True, evaluate=True)
    assert final_message_found(ctx, ["x\tEvaluation of TE annotation finished! Check out"]) is True
    assert final_message_found(ctx, ["EDTA final stage finished!"]) is False
    assert final_message_found(TimelineContext(kind="edta"), ["EDTA final stage finished!"]) is True
    assert final_message_found(TimelineContext(kind="unknown"), []) is None
    # EDTA with charts ends with the report script; older runs (no charts) do not.
    charts = TimelineContext(kind="edta", anno=True, charts=True)
    assert final_message_found(charts, ["TE annotation using the EDTA library has finished!"]) is False
    assert final_message_found(charts, ["The generation of charts and reports has been completed"]) is True
