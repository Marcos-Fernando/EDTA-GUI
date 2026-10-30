"""Port of the legacy extensions/sendemail.py (Flask-Mail) to the standard library.

Same subjects and texts as the legacy GUI, without its accidental indentation.
Sending happens in a background thread and never blocks or prevents a run.
"""

import logging
import smtplib
import ssl
import threading
from collections.abc import Callable
from email.message import EmailMessage
from pathlib import Path

from .settings import Settings

log = logging.getLogger("edta_gui.mail")

TAIL_LINES_WHEN_TOO_BIG = 5_000

CHECKING_SUBJECT = "Verification email"
COMPLETE_SUBJECT = "Annotation Completed Successfully"
ERROR_SUBJECT = "Annotation Failed - Error Report"

_INTRO = (
    "Thank you for choosing EDTA-GUI, your reliable tool for annotating transposable elements. "
    "We are excited to be part of your research journey!"
)
_OUTRO = (
    "Please remember to mention our work in your research to help advance our study. If you "
    "have any questions or need assistance, do not hesitate to contact us. Happy researching!"
)


def checking_body(parameters: str) -> str:
    return f"{_INTRO}\n\nHere are the parameters you used for the annotation:\n{parameters}\n\n{_OUTRO}\n"


def complete_body(folder: str) -> str:
    return (
        "Your genome annotation has been successfully completed!\n\n"
        f"Results location: {folder}\n\n"
        "The detailed execution log is attached to this email.\n\n"
        "We hope you find this information useful in your research.\n\n"
        "Best regards,\nAnnotation Team\n"
    )


def error_body(folder: str) -> str:
    return (
        "We regret to inform you that your genome annotation process failed.\n\n"
        "- The execution log is attached to this email\n"
        f"- Folder location: {folder}\n\n"
        "Please review the attached log file for detailed error information.\n"
        "If the problem persists, contact our support team.\n\n"
        "We apologize for the inconvenience.\n"
    )


SendFn = Callable[[EmailMessage], None]


class Mailer:
    def __init__(self, settings: Settings, send: SendFn | None = None):
        self.settings = settings
        self._custom_send = send is not None
        self._send = send or self._smtp_send

    @property
    def enabled(self) -> bool:
        return self.settings.mail_enabled or self._custom_send

    # ------------------------------------------------------------ public

    def send_checking(self, to: str | None, parameters: str) -> None:
        self._dispatch(to, CHECKING_SUBJECT, checking_body(parameters))

    def send_final(self, to: str | None, folder: str, ok: bool, log_path: Path) -> None:
        if ok:
            self._dispatch(to, COMPLETE_SUBJECT, complete_body(folder), log_path, "annotation_log.txt")
        else:
            self._dispatch(to, ERROR_SUBJECT, error_body(folder), log_path, "error_log.txt")

    # ------------------------------------------------------------ internals

    def build(
        self,
        to: str,
        subject: str,
        body: str,
        attachment: Path | None = None,
        attachment_name: str | None = None,
    ) -> EmailMessage:
        msg = EmailMessage()
        msg["Subject"] = subject
        msg["From"] = self.settings.mail_default_sender
        msg["To"] = to
        if attachment is not None:
            data, truncated = self._attachment_bytes(attachment)
            if truncated:
                body += (
                    f"\nNote: the log is larger than {self.settings.mail_max_attachment_mb:g} MB; "
                    f"only its last {TAIL_LINES_WHEN_TOO_BIG} lines are attached.\n"
                )
            msg.set_content(body)
            msg.add_attachment(data, maintype="text", subtype="plain", filename=attachment_name)
        else:
            msg.set_content(body)
        return msg

    def _attachment_bytes(self, path: Path) -> tuple[bytes, bool]:
        limit = int(self.settings.mail_max_attachment_mb * 1024 * 1024)
        try:
            size = path.stat().st_size
            if size <= limit:
                return path.read_bytes(), False
            with path.open("rb") as f:
                lines = f.read().splitlines(keepends=True)
            return b"".join(lines[-TAIL_LINES_WHEN_TOO_BIG:]), True
        except OSError:
            return b"(log file not found)\n", False

    def _dispatch(
        self,
        to: str | None,
        subject: str,
        body: str,
        attachment: Path | None = None,
        attachment_name: str | None = None,
    ) -> None:
        if not to:
            return
        if not self.enabled:
            log.warning("[Mail] %r to %s not sent: MAIL_SERVER is not configured", subject, to)
            return

        def work() -> None:
            try:
                self._send(self.build(to, subject, body, attachment, attachment_name))
            except Exception:  # never let e-mail break a run
                log.exception("[Mail] failed to send %r to %s", subject, to)

        threading.Thread(target=work, name="mailer", daemon=True).start()

    def _smtp_send(self, msg: EmailMessage) -> None:
        s = self.settings
        if not s.mail_server:
            return
        if s.mail_use_ssl:
            with smtplib.SMTP_SSL(
                s.mail_server, s.mail_port, context=ssl.create_default_context(), timeout=30
            ) as smtp:
                self._login_and_send(smtp, msg)
        else:
            with smtplib.SMTP(s.mail_server, s.mail_port, timeout=30) as smtp:
                if s.mail_use_tls:
                    smtp.starttls(context=ssl.create_default_context())
                self._login_and_send(smtp, msg)

    def _login_and_send(self, smtp: smtplib.SMTP, msg: EmailMessage) -> None:
        if self.settings.mail_username:
            smtp.login(self.settings.mail_username, self.settings.mail_password or "")
        smtp.send_message(msg)
