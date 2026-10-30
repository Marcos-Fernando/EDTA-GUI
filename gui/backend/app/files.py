"""File-name sanitization and safe paths."""

import re
from pathlib import Path

from werkzeug.utils import secure_filename as _werkzeug_secure

# Legacy GUI (app.py → allowed_file).
FASTA_EXTENSIONS = (".fa", ".fasta", ".fna", ".ffn", ".faa", ".frn")

RUN_ID_RE = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._-]*$")
FOLDER_TS_RE = re.compile(r"(\d{8}-\d{6})$")


def secure_filename(name: str) -> str:
    """Same function as the legacy GUI (werkzeug)."""
    return _werkzeug_secure(name or "")


def extension_of(name: str) -> str:
    dot = name.rfind(".")
    return name[dot:].lower() if dot > 0 else ""


def has_allowed_extension(name: str, allowed: tuple[str, ...] | list[str]) -> bool:
    return not allowed or extension_of(name) in allowed


def strip_extension(name: str) -> str:
    dot = name.rfind(".")
    return name[:dot] if dot > 0 else name


def is_valid_run_id(run_id: str) -> bool:
    return bool(RUN_ID_RE.match(run_id)) and run_id not in {".", ".."}


def safe_child(base: Path, relative: str) -> Path | None:
    """Resolve `relative` under `base`; None if it escapes `base` (.., absolute, symlinks)."""
    base = base.resolve()
    try:
        target = (base / relative).resolve()
    except (OSError, RuntimeError):
        return None
    if target == base or base not in target.parents:
        return None
    return target
