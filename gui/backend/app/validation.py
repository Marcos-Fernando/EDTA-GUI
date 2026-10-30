"""Server-side validation (the server never trusts the frontend).

Same rules as gui/frontend/src/config/rules.ts (taken from the legacy GUI).
Error keys are the frontend field names, so the UI can show them inline.
"""

import re
from collections.abc import Mapping

from pydantic import ValidationError

from .command_builder import ANNO_ONLY_FILES, EXTRA_FILES
from .files import FASTA_EXTENSIONS, has_allowed_extension, secure_filename
from .models import EdtaConfigIn, PanConfigIn, Switches

EMAIL_RE = re.compile(r"^[^\s@]+@[^\s@]+\.[^\s@]+$")
POSITIVE_FLOAT_RE = re.compile(r"^(\d+(\.\d*)?|\.\d+)([eE][-+]?\d+)?$")

MIN_THREADS = 10
MIN_PAN_COPIES = 3
MAX_DIV_RANGE = (0, 100)

EXTRA_FILE_EXTENSIONS: dict[str, tuple[str, ...]] = {
    "cds": FASTA_EXTENSIONS,
    "curatedlib": (),
    "exclude": (".bed",),
    "rmlib": (),
    "rmout": (".out",),
}

FieldErrors = dict[str, str]


def pydantic_errors(exc: ValidationError) -> FieldErrors:
    """Pydantic errors → {"switches.anno": "..."} with camelCase keys."""
    errors: FieldErrors = {}
    for err in exc.errors():
        key = ".".join(str(p) for p in err["loc"] if p != "body") or "config"
        errors.setdefault(key, err["msg"])
    return errors


def validate_email(value: str | None) -> str | None:
    v = (value or "").strip()
    return None if v == "" or EMAIL_RE.match(v) else "Enter a valid email address, or leave it empty."


def validate_mutation_rate(value: str | None) -> str | None:
    v = (value or "").strip()
    if v == "":
        return None
    if not POSITIVE_FLOAT_RE.match(v) or not float(v) > 0:
        return "Enter a positive number, e.g. 1.3e-8."
    return None


def validate_min_int(value: int, minimum: int) -> str | None:
    return None if value >= minimum else f"Enter a whole number of at least {minimum}."


LEADING_DASH = "File names cannot start with '-': rename the file."


def extension_error(name: str | None, allowed: tuple[str, ...]) -> str | None:
    """Extension check, plus no leading '-': it would make the run folder invalid (the run
    would not be listed) and could be read as an option by the pipeline scripts."""
    if not name:
        return None
    if secure_filename(name).startswith("-"):
        return LEADING_DASH
    if has_allowed_extension(name, allowed):
        return None
    return f"Accepted extensions: {' '.join(allowed)}"


def normalize_switches(cfg: EdtaConfigIn) -> Switches:
    """Mode rules: AnnoTEP forces sensitive/anno; EDTA drops AnnoTEP-only switches.
    Evaluate implies Annotation."""
    s = cfg.switches.model_copy()
    if cfg.mode == "annotep":
        s.sensitive = True
        s.anno = True
    else:
        s.tir_filter = s.annot_type = s.run_lai = False
    if s.evaluate:
        s.anno = True
    return s


def validate_edta(
    cfg: EdtaConfigIn,
    genome_name: str | None,
    file_names: Mapping[str, str],
) -> FieldErrors:
    """genome_name / file_names are the ORIGINAL upload names (None/absent = not sent)."""
    errors: FieldErrors = {}

    def put(key: str, msg: str | None) -> None:
        if msg:
            errors.setdefault(key, msg)

    put("email", validate_email(cfg.email))
    put("mutationRate", validate_mutation_rate(cfg.mutation_rate))
    lo, hi = MAX_DIV_RANGE
    if cfg.max_div is not None and not lo <= cfg.max_div <= hi:
        put("maxDiv", f"Enter a whole number from {lo} to {hi}.")
    put("threads", validate_min_int(cfg.threads, MIN_THREADS))

    reusing = cfg.step != "all"
    if reusing and not cfg.previous_run_id:
        put("previousRunId", "Select the previous run to continue from.")
    if not reusing and cfg.previous_run_id:
        put("previousRunId", 'A previous run can only be used when the step is not "all".')
    if genome_name is None and not reusing:
        put("genome", "Select a genome FASTA file.")
    put("genome", extension_error(genome_name, FASTA_EXTENSIONS))
    if genome_name is not None and not secure_filename(genome_name):
        put("genome", "Invalid file name.")

    anno = normalize_switches(cfg).anno
    used: dict[str, str] = {}
    if genome_name:
        used[secure_filename(genome_name)] = "genome"
    for key, _flag in EXTRA_FILES:
        name = file_names.get(key)
        if name is None:
            continue
        field = f"files.{key}"
        if key in ANNO_ONLY_FILES and not anno:
            put(field, 'Enable "Annotation" to use this file.')
        put(field, extension_error(name, EXTRA_FILE_EXTENSIONS[key]))
        safe = secure_filename(name)
        if not safe:
            put(field, "Invalid file name.")
        elif safe in used:
            put(field, f"Same file name as {used[safe]}; rename one of them.")
        else:
            used[safe] = field
    return errors


def validate_pan(
    cfg: PanConfigIn,
    pairs: list[tuple[str | None, str | None]],
    cds_name: str | None,
    library_name: str | None,
) -> FieldErrors:
    """pairs: (genome, cds) original names per row index."""
    errors: FieldErrors = {}

    def put(key: str, msg: str | None) -> None:
        if msg:
            errors.setdefault(key, msg)

    put("email", validate_email(cfg.email))
    put("threads", validate_min_int(cfg.threads, MIN_THREADS))
    put("copies", validate_min_int(cfg.copies, MIN_PAN_COPIES))

    seen: set[str] = set()
    for i, (genome, cds) in enumerate(pairs):
        if not genome:
            put(
                f"pairs.{i}.genome",
                "Select a genome FASTA file." if not cds else "A CDS file needs a genome in the same row.",
            )
            continue
        put(f"pairs.{i}.genome", extension_error(genome, FASTA_EXTENSIONS))
        safe = secure_filename(genome)
        if not safe:
            put(f"pairs.{i}.genome", "Invalid file name.")
        elif safe in seen:
            put(f"pairs.{i}.genome", "This genome file name is already in the list.")
        seen.add(safe)
        put(f"pairs.{i}.cds", extension_error(cds, FASTA_EXTENSIONS))
    if not pairs:
        put("pairs", "Select at least one genome.")

    if not cds_name:
        put("cds", "The coding DNA sequence (CDS) file is required.")
    put("cds", extension_error(cds_name, FASTA_EXTENSIONS))
    put("library", extension_error(library_name, FASTA_EXTENSIONS))
    return errors
