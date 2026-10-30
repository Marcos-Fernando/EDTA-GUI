"""Server-Sent Events for one run: log lines and status changes.

The log is followed on disk (log.txt), so this also works for runs started before
a server restart. Event id = number of complete log lines sent, which lets the
browser's EventSource resume with Last-Event-ID.
"""

import asyncio
import json
from collections.abc import AsyncIterator, Awaitable, Callable

from .models import RunSummary
from .results_store import RunLocation

POLL_SECONDS = 0.5
KEEPALIVE_SECONDS = 15.0


def _status_key(d: dict) -> dict:
    """lastLogLines changes with every log line; it is not a status change."""
    return {k: v for k, v in d.items() if k != "lastLogLines"}


def sse(event: str, data: object, event_id: int | None = None) -> str:
    head = f"id: {event_id}\n" if event_id is not None else ""
    return f"{head}event: {event}\ndata: {json.dumps(data, ensure_ascii=False)}\n\n"


class _LogFollower:
    """Reads complete lines appended to a file; detects a restarted (truncated) log."""

    def __init__(self, loc: RunLocation):
        self.loc = loc
        self.offset = 0
        self.pending = b""
        self.count = 0

    def read(self) -> tuple[list[str], bool]:
        """(new complete lines, replace). replace=True when the file was restarted."""
        try:
            size = self.loc.log.stat().st_size
        except OSError:
            return [], False
        replace = False
        if size < self.offset:
            self.offset, self.pending, self.count, replace = 0, b"", 0, True
        if size == self.offset:
            return [], replace
        with self.loc.log.open("rb") as f:
            f.seek(self.offset)
            chunk = f.read(size - self.offset)
        self.offset += len(chunk)
        parts = (self.pending + chunk).split(b"\n")
        self.pending = parts.pop()
        lines = [p.decode("utf-8", errors="replace").rstrip("\r") for p in parts]
        self.count += len(lines)
        return lines, replace

    def flush(self) -> list[str]:
        """The last line, when the file does not end with a newline."""
        if not self.pending:
            return []
        line = self.pending.decode("utf-8", errors="replace")
        self.pending = b""
        self.count += 1
        return [line]


async def run_events(
    loc: RunLocation,
    summary: Callable[[], RunSummary],
    last_event_id: int | None,
    max_initial_lines: int,
    is_disconnected: Callable[[], Awaitable[bool]],
) -> AsyncIterator[str]:
    follower = _LogFollower(loc)

    # Initial snapshot: whole log (capped), or the part after Last-Event-ID.
    lines, _ = follower.read()
    if last_event_id is not None and 0 <= last_event_id <= len(lines):
        yield sse("log", {"lines": lines[last_event_id:], "replace": False}, follower.count)
    else:
        yield sse("log", {"lines": lines[-max_initial_lines:], "replace": True}, follower.count)

    last_status = summary().model_dump(by_alias=True)
    yield sse("status", last_status)
    idle = 0.0

    while True:
        if last_status["status"] != "running":
            tail = follower.flush()
            if tail:
                yield sse("log", {"lines": tail, "replace": False}, follower.count)
            yield sse("end", {})
            return
        if await is_disconnected():
            return
        await asyncio.sleep(POLL_SECONDS)
        idle += POLL_SECONDS

        new, replace = follower.read()
        if new or replace:
            yield sse("log", {"lines": new, "replace": replace}, follower.count)
            idle = 0.0
        current = summary().model_dump(by_alias=True)
        if _status_key(current) != _status_key(last_status):
            # Read what was written right before status.txt appeared.
            more, _ = follower.read()
            if more:
                yield sse("log", {"lines": more, "replace": False}, follower.count)
            last_status = current
            yield sse("status", current)
            idle = 0.0
        if idle >= KEEPALIVE_SECONDS:
            yield ": keep-alive\n\n"
            idle = 0.0
