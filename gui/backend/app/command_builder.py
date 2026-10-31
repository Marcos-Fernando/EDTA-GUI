"""Pipeline commands as argument lists (never a shell string).

Mirror of gui/frontend/src/config/commandBuilder.ts: same flags, same order, same
defaults. tests/test_command_builder.py uses the same cases as the frontend tests.
"""

import re
from dataclasses import dataclass
from pathlib import Path

from .models import PipelineMode, Species, Step, Switches

_SAFE_ARG = re.compile(r"^[\w./:=+-]+$")

DEFAULT_MUTATION_RATE = "1.3e-8"
DEFAULT_MAX_DIV = 40

# Extra files: (key in the API, EDTA.pl flag). Order follows the legacy GUI.
EXTRA_FILES: tuple[tuple[str, str], ...] = (
    ("cds", "--cds"),
    ("curatedlib", "--curatedlib"),
    ("exclude", "--exclude"),
    ("rmlib", "--rmlib"),
    ("rmout", "--rmout"),
)
ANNO_ONLY_FILES = ("exclude", "rmout")
# EDTA mode: also need --maker 1 (EDTA.pl v2.3 only uses them for MAKER.masked).
MAKER_ONLY_FILES = ("exclude",)


@dataclass(frozen=True)
class ScriptPaths:
    edta: str
    annotep: str
    annotep_report: str
    edta_report: str
    pan: str

    @classmethod
    def from_dirs(cls, edta_dir: Path, annotep_dir: Path) -> "ScriptPaths":
        return cls(
            edta=str(edta_dir / "EDTA.pl"),
            annotep=str(annotep_dir / "EDTA" / "EDTA.pl"),
            annotep_report=str(annotep_dir / "Scripts" / "generate_PLOTs-for-TE-pipe.sh"),
            edta_report=str(annotep_dir / "Scripts" / "generate_PLOTs-for-EDTA.sh"),
            pan=str(edta_dir / "panEDTA.sh"),
        )


# Relative names, as shown by the frontend command preview and in e-mails.
DISPLAY_SCRIPTS = ScriptPaths(
    edta="EDTA.pl",
    annotep="AnnoTEP/EDTA/EDTA.pl",
    annotep_report="AnnoTEP/Scripts/generate_PLOTs-for-TE-pipe.sh",
    edta_report="AnnoTEP/Scripts/generate_PLOTs-for-EDTA.sh",
    pan="panEDTA.sh",
)


@dataclass(frozen=True)
class EdtaCommandInput:
    mode: PipelineMode
    species: Species
    step: Step
    switches: Switches
    threads: int
    mutation_rate: str | None  # None = pipeline default (flag omitted)
    max_div: int | None  # None = pipeline default (flag omitted)
    files: dict[str, str]  # key → sanitized file name inside the run folder


def normalize_mutation_rate(value: str | None) -> str | None:
    v = (value or "").strip()
    return None if v in ("", DEFAULT_MUTATION_RATE) else v


def normalize_max_div(value: int | None) -> int | None:
    return None if value is None or value == DEFAULT_MAX_DIV else value


def _bit(v: bool) -> str:
    return "1" if v else "0"


def build_edta_commands(cmd: EdtaCommandInput, genome_name: str, scripts: ScriptPaths) -> list[list[str]]:
    s = cmd.switches
    annotep = cmd.mode == "annotep"
    args = [
        scripts.annotep if annotep else scripts.edta,
        "--genome", genome_name,
        "--species", cmd.species,
        "--step", cmd.step,
        # AnnoTEP: Sensitivity is always 1.
        "--sensitive", _bit(annotep or s.sensitive),
        "--threads", str(cmd.threads),
    ]  # fmt: skip
    if s.overwrite:
        args += ["--overwrite", "1"]
    # AnnoTEP: Annotation is always 1. With --anno 1, --evaluate is always explicit.
    if annotep or s.anno:
        args += ["--anno", "1", "--evaluate", _bit(s.evaluate)]
    # --maker exists only in the root EDTA.pl.
    if not annotep and s.maker:
        args += ["--maker", "1"]
    if s.force:
        args += ["--force", "1"]
    mu = normalize_mutation_rate(cmd.mutation_rate)
    if mu is not None:
        args += ["--u", mu]
    max_div = normalize_max_div(cmd.max_div)
    if max_div is not None:
        args += ["--maxdiv", str(max_div)]
    if annotep:
        if s.tir_filter:
            args += ["--TIR_filter", "1"]
        if s.annot_type:
            args += ["--ANNOT_TYPE", "1"]
        # --run_LAI exists only in AnnoTEP/EDTA/EDTA.pl.
        args += ["--run_LAI", _bit(s.run_lai)]
    for key, flag in EXTRA_FILES:
        name = cmd.files.get(key)
        if name:
            args += [flag, name]

    commands = [args]
    if annotep:
        commands.append(["bash", scripts.annotep_report, genome_name])
    elif s.anno:
        # The charts need the whole-genome annotation (--anno 1).
        commands.append(["bash", scripts.edta_report, genome_name])
    return commands


def build_pan_command(
    list_name: str,
    cds_name: str,
    library_name: str | None,
    threads: int,
    copies: int,
    scripts: ScriptPaths,
) -> list[str]:
    args = ["bash", scripts.pan, "-g", list_name, "-c", cds_name]
    if library_name:
        args += ["-l", library_name]
    args += ["-t", str(threads), "-f", str(copies), "-o", "1"]
    return args


def build_pan_list(pairs: list[tuple[str, str | None]]) -> str:
    """genome_<ts>.cds.list: one "genome[<TAB>cds]" line per pair, newline-terminated."""
    return "".join(f"{g}\t{c}\n" if c else f"{g}\n" for g, c in pairs)


def format_command(args: list[str]) -> str:
    """Display form (quoting only for readability; never executed by a shell)."""
    return " ".join(a if _SAFE_ARG.match(a) else "'" + a.replace("'", "'\\''") + "'" for a in args)
