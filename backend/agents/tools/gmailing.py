import smtplib
import os
import asyncio
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

GMAIL_ADDRESS = os.environ.get("GMAIL_ADDRESS")
GMAIL_APP_PASSWORD = os.environ.get("GMAIL_APP_PASSWORD")

async def send_email(to: str, subject: str, body: str) -> str:
    if not GMAIL_ADDRESS or not GMAIL_APP_PASSWORD:
        raise ValueError(
            "Missing credentials. Set GMAIL_ADDRESS and GMAIL_APP_PASSWORD env vars."
        )

    msg = MIMEMultipart()
    msg["From"] = GMAIL_ADDRESS
    msg["To"] = to
    msg["Subject"] = subject
    msg.attach(MIMEText(body, "plain"))

    # Run the blocking SMTP call in a thread pool so it doesn't block the event loop
    loop = asyncio.get_event_loop()
    await loop.run_in_executor(None, _send_smtp, msg, to)

    return f"Email sent to {to}"

def _send_smtp(msg: MIMEMultipart, to: str) -> None:
    with smtplib.SMTP_SSL("smtp.gmail.com", 465) as server:
        server.login(GMAIL_ADDRESS, GMAIL_APP_PASSWORD)
        server.sendmail(GMAIL_ADDRESS, to, msg.as_string())
