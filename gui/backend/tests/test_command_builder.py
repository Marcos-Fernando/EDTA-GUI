"""Same cases as gui/frontend/src/config/commandBuilder.test.ts (keep both in sync)."""

from app.command_builder import (
    DISPLAY_SCRIPTS,
    EdtaCommandInput,
    build_edta_commands,
    build_pan_command,
    build_pan_list,
    format_command,
)
from app.models import Switches


def cmd(mode="edta", files=None, mutation_rate=None, max_div=None, threads=10, **sw) -> EdtaCommandInput:
    return EdtaCommandInput(
        mode=mode,
        species="others",
        step="all",
        switches=Switches(**sw),
        threads=threads,
        mutation_rate=mutation_rate,
        max_div=max_div,
        files=files or {},
    )


def text(c: EdtaCommandInput) -> str:
    return format_command(build_edta_commands(c, "genome.fa", DISPLAY_SCRIPTS)[0])


def test_edta_defaults():
    cmds = build_edta_commands(cmd(), "genome.fa", DISPLAY_SCRIPTS)
    assert cmds == [
        ["EDTA.pl", "--genome", "genome.fa", "--species", "others", "--step", "all",
         "--sensitive", "0", "--threads", "10"]
    ]  # fmt: skip


def test_evaluate_always_explicit_with_anno():
    assert "--anno 1 --evaluate 0" in text(cmd(anno=True))
    assert "--anno 1 --evaluate 1" in text(cmd(anno=True, evaluate=True))


def test_edta_never_sends_annotep_flags():
    t = text(cmd(run_lai=True, tir_filter=True, annot_type=True))
    assert "--run_LAI" not in t and "--TIR_filter" not in t and "--ANNOT_TYPE" not in t


def test_defaults_are_omitted_and_values_kept():
    assert "--u" not in text(cmd(mutation_rate="1.3e-8", max_div=40))
    t = text(
        cmd(
            mutation_rate="7e-9",
            max_div=30,
            threads=20,
            anno=True,
            overwrite=True,
            force=True,
            files={"cds": "my_cds.fa", "exclude": "regions.bed"},
        )
    )
    assert t == (
        "EDTA.pl --genome genome.fa --species others --step all --sensitive 0 --threads 20 "
        "--overwrite 1 --anno 1 --evaluate 0 --force 1 --u 7e-9 --maxdiv 30 "
        "--cds my_cds.fa --exclude regions.bed"
    )


def test_annotep_forces_sensitive_anno_and_adds_report():
    edta, report = build_edta_commands(cmd(mode="annotep", run_lai=True), "genome.fa", DISPLAY_SCRIPTS)
    assert format_command(edta) == (
        "AnnoTEP/EDTA/EDTA.pl --genome genome.fa --species others --step all --sensitive 1 "
        "--threads 10 --anno 1 --evaluate 0 --run_LAI 1"
    )
    assert report == ["bash", "AnnoTEP/Scripts/generate_PLOTs-for-TE-pipe.sh", "genome.fa"]


def test_annotep_optional_flags():
    t = text(cmd(mode="annotep", tir_filter=True, annot_type=True, run_lai=False))
    assert "--TIR_filter 1 --ANNOT_TYPE 1 --run_LAI 0" in t


def test_pan_command_and_list():
    assert build_pan_command(
        "genome_20260101-000000.cds.list", "genome.cds.fa", "lib.fa", 20, 3, DISPLAY_SCRIPTS
    ) == ["bash", "panEDTA.sh", "-g", "genome_20260101-000000.cds.list", "-c", "genome.cds.fa",
          "-l", "lib.fa", "-t", "20", "-f", "3", "-o", "1"]  # fmt: skip
    assert build_pan_list([("Ler.test.fa", None), ("Col.test.fa", "genome.cds.fa")]) == (
        "Ler.test.fa\nCol.test.fa\tgenome.cds.fa\n"
    )


def test_format_command_quotes():
    assert format_command(["a", "b c", "it's"]) == "a 'b c' 'it'\\''s'"
