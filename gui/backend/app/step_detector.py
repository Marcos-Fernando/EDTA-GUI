"""Expected final log messages (the proof that a run really finished).

Mirror of expectedFinalMessage() in gui/frontend/src/config/stepMatchers.ts.
Messages verified against EDTA.pl, panEDTA.sh and the AnnoTEP report script.
The per-step timeline is computed by the frontend from the log itself.
"""

import re
from collections.abc import Iterable

from .models import TimelineContext

PAN_FINAL = re.compile(r"panEDTA annotation of .* is finished!")
REPORT_FINAL = re.compile(r"The generation of charts and reports has been completed")
EDTA_FINAL_LIBRARY = re.compile(r"EDTA final stage finished!")
EDTA_FINAL_ANNO = re.compile(r"TE annotation using the EDTA library has finished!")
EDTA_FINAL_EVALUATE = re.compile(r"Evaluation of TE annotation finished!")


def expected_final_message(ctx: TimelineContext | None) -> re.Pattern[str] | None:
    if ctx is None:
        return None
    if ctx.kind == "pan":
        return PAN_FINAL
    if ctx.kind == "annotep":
        return REPORT_FINAL
    if ctx.kind == "edta":
        if not ctx.anno:
            return EDTA_FINAL_LIBRARY
        if ctx.charts:
            return REPORT_FINAL
        return EDTA_FINAL_EVALUATE if ctx.evaluate else EDTA_FINAL_ANNO
    return None


def final_message_found(ctx: TimelineContext | None, lines: Iterable[str]) -> bool | None:
    pattern = expected_final_message(ctx)
    if pattern is None:
        return None
    return any(pattern.search(line) for line in lines)
