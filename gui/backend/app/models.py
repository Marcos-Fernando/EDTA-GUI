"""Pydantic v2 models. JSON uses camelCase, the same names as the frontend types."""

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field
from pydantic.alias_generators import to_camel

PipelineMode = Literal["edta", "annotep"]
RunKind = Literal["edta", "annotep", "pan", "unknown"]
Species = Literal["others", "rice", "maize"]
Step = Literal["all", "filter", "final", "anno"]
RunStatus = Literal["running", "completed", "failed"]


class CamelModel(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)


class StrictCamelModel(CamelModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True, extra="forbid")


class Switches(StrictCamelModel):
    overwrite: bool = False
    sensitive: bool = False
    anno: bool = False
    evaluate: bool = False
    maker: bool = False
    force: bool = False
    tir_filter: bool = False
    annot_type: bool = False
    run_lai: bool = False


class EdtaConfigIn(StrictCamelModel):
    """`config` part of POST /api/runs/edta (files travel as separate parts)."""

    mode: PipelineMode
    email: str | None = None
    # Name of the new run folder (<name>_<YYYYmmdd-HHMMSS>); None = genome name.
    run_name: str | None = None
    species: Species = "others"
    step: Step = "all"
    previous_run_id: str | None = None
    switches: Switches = Field(default_factory=Switches)
    mutation_rate: str | None = None
    max_div: int | None = None
    threads: int = 10


class PanConfigIn(StrictCamelModel):
    """`config` part of POST /api/runs/pan. `pairs` is the number of genome rows sent."""

    email: str | None = None
    threads: int = 10
    copies: int = 3
    pairs: int = Field(ge=1, le=500)


class TimelineContext(CamelModel):
    kind: RunKind
    step: Step = "all"
    anno: bool = False
    evaluate: bool = False
    run_lai: bool = False
    # EDTA runs with the charts step (REPORT/). Absent in runs from older versions.
    charts: bool = False


class RunSummary(CamelModel):
    id: str
    kind: RunKind
    genome: str | None
    started_at: str | None
    finished_at: str | None
    status: RunStatus
    status_text: str | None
    final_message_found: bool | None
    options: TimelineContext | None
    last_log_lines: list[str]
    read_only: bool
    queue_position: int | None = None
    path: str | None = None


class RunCreated(CamelModel):
    run_id: str


class ErrorBody(CamelModel):
    message: str
    field_errors: dict[str, str] = Field(default_factory=dict)


class LogResponse(CamelModel):
    lines: list[str]
    total: int


class FileEntry(CamelModel):
    path: str
    size: int
    modified_at: str


class Health(CamelModel):
    status: Literal["ok", "degraded"]
    version: str
    results_dir_writable: bool
    conda_envs: dict[str, str]
    conda_found: bool
    mail_configured: bool
    max_concurrent_runs: int
