"""How a pipeline process is started. Replaceable by a fake in the tests.

The command is always a list of arguments: no shell, nothing interpolated.
"""

import contextlib
import os
import signal
import subprocess
from pathlib import Path
from typing import IO, Protocol


class RunningProcess(Protocol):
    pid: int

    def wait(self) -> int: ...
    def terminate(self) -> None: ...
    def kill(self) -> None: ...


class Executor(Protocol):
    def start(self, argv: list[str], cwd: Path, env: dict[str, str], log: IO[bytes]) -> RunningProcess: ...


class _SubprocessHandle:
    def __init__(self, popen: subprocess.Popen[bytes]):
        self._p = popen
        self.pid = popen.pid

    def wait(self) -> int:
        return self._p.wait()

    def _signal_group(self, sig: int) -> None:
        # start_new_session=True: the whole pipeline (conda run → perl → children) is one group.
        with contextlib.suppress(ProcessLookupError):
            os.killpg(self._p.pid, sig)

    def terminate(self) -> None:
        self._signal_group(signal.SIGTERM)

    def kill(self) -> None:
        self._signal_group(signal.SIGKILL)


class SubprocessExecutor:
    def start(self, argv: list[str], cwd: Path, env: dict[str, str], log: IO[bytes]) -> RunningProcess:
        popen = subprocess.Popen(
            argv,
            cwd=cwd,
            env=env,
            stdin=subprocess.DEVNULL,
            stdout=log,
            stderr=subprocess.STDOUT,
            start_new_session=True,
        )
        return _SubprocessHandle(popen)
