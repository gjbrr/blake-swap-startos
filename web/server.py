#!/usr/bin/env python3

import base64
import binascii
import hmac
import json
import os
import subprocess
import ssl
from http.server import (
    SimpleHTTPRequestHandler,
    ThreadingHTTPServer,
)
from pathlib import Path
from urllib.parse import urlparse


HOST = os.environ.get(
    "BLAKE_SWAP_WEB_HOST",
    "0.0.0.0",
)

PORT = int(
    os.environ.get(
        "BLAKE_SWAP_WEB_PORT",
        "3000",
    )
)

WEB_ROOT = Path(__file__).resolve().parent
STATIC_ROOT = WEB_ROOT / "static"

ENGINE = Path(
    os.environ.get(
        "BLAKE_SWAP_ENGINE",
        "/opt/blake-swap/src/swap_v2.py",
    )
)


AUTH_FILE = Path(
    os.environ.get(
        "BLAKE_SWAP_WEB_AUTH_FILE",
        "/data/config/web-auth.json",
    )
)


def load_auth():
    """Fail closed if browser credentials are unavailable."""
    data = json.loads(AUTH_FILE.read_text())

    username = data.get("username")
    password = data.get("password")

    if (
        not isinstance(username, str)
        or not username
        or ":" in username
        or not isinstance(password, str)
        or len(password) < 32
    ):
        raise ValueError("Invalid web authentication configuration")

    return username, password


def json_bytes(value):
    return (
        json.dumps(
            value,
            indent=2,
            sort_keys=True,
        )
        + "\n"
    ).encode()


class Handler(SimpleHTTPRequestHandler):
    credentials = None

    def authenticated(self):
        header = self.headers.get("Authorization", "")

        if header.startswith("Basic ") and len(header) < 4096:
            try:
                raw = base64.b64decode(
                    header[6:], validate=True
                ).decode("utf-8")
                supplied_user, supplied_password = raw.split(":", 1)

                expected_user, expected_password = self.credentials

                if (
                    hmac.compare_digest(supplied_user, expected_user)
                    and hmac.compare_digest(
                        supplied_password, expected_password
                    )
                ):
                    return True
            except (
                ValueError,
                UnicodeError,
                binascii.Error,
            ):
                pass

        self.send_response(401)
        self.send_header(
            "WWW-Authenticate",
            'Basic realm="BLAKE Swap", charset="UTF-8"',
        )
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Length", "0")
        self.end_headers()
        return False

    def do_HEAD(self):
        if self.authenticated():
            super().do_HEAD()

    def __init__(self, *args, **kwargs):
        super().__init__(
            *args,
            directory=str(STATIC_ROOT),
            **kwargs,
        )

    def send_json(self, status, value):
        body = json_bytes(value)

        self.send_response(status)
        self.send_header(
            "Content-Type",
            "application/json; charset=utf-8",
        )
        self.send_header(
            "Content-Length",
            str(len(body)),
        )
        self.send_header(
            "Cache-Control",
            "no-store",
        )
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        if not self.authenticated():
            return

        path = urlparse(self.path).path

        if path == "/api/health":
            self.send_json(
                200,
                {
                    "ok": True,
                    "service": "blake-swap-web",
                },
            )
            return

        if path == "/api/status":
            self.handle_status()
            return

        if path == "/":
            self.path = "/index.html"

        super().do_GET()

    def handle_status(self):
        if os.environ.get("BLAKE_SWAP_WEB_STATUS_ENABLED", "0") != "1":
            self.send_json(
                503,
                {
                    "ok": False,
                    "error": (
                        "Live status is disabled until "
                        "node providers are verified"
                    ),
                },
            )
            return

        try:
            result = subprocess.run(
                [
                    "python3",
                    str(ENGINE),
                    "dashboard",
                    "--json",
                ],
                text=True,
                capture_output=True,
                timeout=110,
            )
        except subprocess.TimeoutExpired:
            self.send_json(
                504,
                {
                    "ok": False,
                    "error": "Swap status timed out",
                },
            )
            return

        if result.returncode != 0:
            self.send_json(
                503,
                {
                    "ok": False,
                    "error": (
                        result.stderr.strip()
                        or result.stdout.strip()
                        or "Swap status failed"
                    ),
                },
            )
            return

        try:
            dashboard = json.loads(
                result.stdout
            )
        except Exception:
            self.send_json(
                500,
                {
                    "ok": False,
                    "error": (
                        "Swap engine returned "
                        "invalid dashboard JSON"
                    ),
                },
            )
            return

        self.send_json(
            200,
            {
                "ok": True,
                "dashboard": dashboard,
            },
        )

    def log_message(self, fmt, *args):
        print(
            f"web: {self.address_string()} "
            + (fmt % args),
            flush=True,
        )


def main():
    Handler.credentials = load_auth()

    server = ThreadingHTTPServer(
        (HOST, PORT),
        Handler,
    )

    if os.environ.get("BLAKE_SWAP_WEB_TLS", "0") == "1":
        cert = os.environ.get(
            "BLAKE_SWAP_WEB_TLS_CERT",
            "/data/config/web-tls.crt",
        )
        key = os.environ.get(
            "BLAKE_SWAP_WEB_TLS_KEY",
            "/data/config/web-tls.key",
        )

        context = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
        context.minimum_version = ssl.TLSVersion.TLSv1_2
        context.load_cert_chain(certfile=cert, keyfile=key)
        server.socket = context.wrap_socket(
            server.socket,
            server_side=True,
        )

    print(
        f"BLAKE Swap web UI listening "
        f"on {HOST}:{PORT}",
        flush=True,
    )

    server.serve_forever()


if __name__ == "__main__":
    main()
