"""Configuration from environment variables (and an optional gui/backend/.env file)."""

from functools import lru_cache
from pathlib import Path

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict

BACKEND_DIR = Path(__file__).resolve().parents[1]
GUI_DIR = BACKEND_DIR.parent

VERSION = "0.1.0"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=BACKEND_DIR / ".env", env_file_encoding="utf-8", extra="ignore"
    )

    host: str = "127.0.0.1"
    port: int = 8000

    # New runs are created here (read/write).
    results_dir: Path = BACKEND_DIR / "results"
    # Optional older result folders, listed read-only. ':'-separated; missing folders are ignored.
    # (The legacy gui/results was merged into results_dir on 07/10/2026.)
    legacy_results_dirs: str = ""

    # Repository root: EDTA.pl, panEDTA.sh, bin/.
    edta_dir: Path = GUI_DIR.parent
    annotep_dir: Path | None = None

    conda_exe: str = str(Path.home() / "miniconda3" / "bin" / "conda")
    edta_conda_env: str = "EDTAgui"
    annotep_conda_env: str = "annotepgui_3_11"

    max_concurrent_runs: int = Field(default=1, ge=1)
    max_upload_gb: float = Field(default=10, gt=0)
    log_max_lines: int = Field(default=20_000, ge=100)
    cancel_grace_seconds: float = Field(default=10, ge=0)

    frontend_dev_origin: str = "http://localhost:5173"
    # Host names this server answers to (comma-separated). Blocks DNS rebinding: another site
    # pointing its own name at 127.0.0.1 gets 400. POSTs must come from a page on one of them.
    allowed_hosts: str = "localhost,127.0.0.1,[::1]"
    # Built React app (npm run build). Served at / when the folder exists.
    frontend_dist: Path = GUI_DIR / "frontend" / "dist"
    # Paths shown to the user, for Docker: "container_dir=host_dir;container_dir=host_dir".
    # The result folders then appear with the address they have on the user's own machine.
    display_path_map: str = ""

    mail_server: str | None = None
    mail_port: int = 587
    mail_username: str | None = None
    mail_password: str | None = None
    mail_use_tls: bool = False
    mail_use_ssl: bool = False
    mail_default_sender: str = "noreply@app.com"
    mail_max_attachment_mb: float = 10

    @property
    def annotep_root(self) -> Path:
        return self.annotep_dir or self.edta_dir / "AnnoTEP"

    @property
    def allowed_host_list(self) -> list[str]:
        return [h.strip().lower() for h in self.allowed_hosts.split(",") if h.strip()]

    @property
    def legacy_dirs(self) -> list[Path]:
        return [Path(p) for p in self.legacy_results_dirs.split(":") if p.strip()]

    def display_path(self, path: Path) -> str:
        text = str(path)
        for pair in self.display_path_map.split(";"):
            inner, sep, outer = pair.partition("=")
            inner, outer = inner.strip().rstrip("/"), outer.strip().rstrip("/")
            if not sep or not inner or not outer:
                continue
            if text == inner or text.startswith(inner + "/"):
                return outer + text[len(inner) :]
        return text

    @property
    def mail_enabled(self) -> bool:
        return bool(self.mail_server)


@lru_cache
def get_settings() -> Settings:
    return Settings()
