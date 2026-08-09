from __future__ import annotations

import html
import io
import json
import threading
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, urlparse

import qrcode
from qrcode.constants import ERROR_CORRECT_L, ERROR_CORRECT_M

from .protocol import TransferSession


def _page(session: TransferSession) -> bytes:
    config = {
        "cycleLength": session.cycle_length,
        "fileName": session.manifest["fileName"],
        "fileSize": session.manifest["fileSize"],
        "fps": session.profile.fps,
        "profile": session.profile.name,
    }
    safe_config = json.dumps(config).replace("<", "\\u003c")
    safe_title = html.escape(str(session.manifest["fileName"]))
    return f"""<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>QRBeam — {safe_title}</title>
  <style>
    :root {{ color-scheme: dark; font-family: -apple-system, BlinkMacSystemFont, sans-serif; }}
    * {{ box-sizing: border-box; }}
    body {{ margin: 0; background: #090b10; color: #f7f8fa; min-height: 100vh; display: grid; place-items: center; }}
    main {{ width: min(96vw, 1120px); display: grid; grid-template-columns: minmax(0, 1fr) 280px; gap: 24px; align-items: center; }}
    .stage {{ background: white; border-radius: 22px; padding: 18px; aspect-ratio: 1; display: grid; place-items: center; box-shadow: 0 20px 80px #0009; }}
    #qr {{ display: block; width: 100%; height: 100%; object-fit: contain; image-rendering: pixelated; }}
    aside {{ display: grid; gap: 16px; }}
    h1 {{ margin: 0; font-size: 28px; }}
    .file {{ color: #b9c0cc; overflow-wrap: anywhere; }}
    .metric {{ display: flex; justify-content: space-between; border-bottom: 1px solid #272c35; padding: 10px 0; }}
    button {{ border: 0; border-radius: 12px; padding: 13px 16px; font: inherit; font-weight: 650; cursor: pointer; }}
    #toggle {{ background: #67e8a5; color: #07120c; }}
    #fullscreen {{ background: #242a34; color: white; }}
    .notice {{ color: #8f98a7; font-size: 13px; line-height: 1.45; }}
    @media (max-width: 760px) {{ main {{ grid-template-columns: 1fr; padding: 16px; }} aside {{ grid-template-columns: 1fr 1fr; }} aside > * {{ grid-column: 1 / -1; }} }}
  </style>
</head>
<body>
<main>
  <section class="stage"><img id="qr" alt="Animated QR transfer frame"></section>
  <aside>
    <div><h1>QRBeam</h1><div class="file">{safe_title}</div></div>
    <div>
      <div class="metric"><span>Profile</span><strong id="profile"></strong></div>
      <div class="metric"><span>Loop</span><strong id="loop">0</strong></div>
      <div class="metric"><span>Displayed</span><strong id="shown">0</strong></div>
      <div class="metric"><span>Measured FPS</span><strong id="measured">0.0</strong></div>
    </div>
    <button id="toggle">Pause</button>
    <button id="fullscreen">Enter full screen</button>
    <div class="notice">Keep this page visible and the phone steady. Transfer is local and offline. Only use it for files you are authorized to move.</div>
  </aside>
</main>
<script>
  const config = {safe_config};
  const image = document.querySelector('#qr');
  let position = 0;
  let running = true;
  let shown = 0;
  let started = performance.now();
  document.querySelector('#profile').textContent = `${{config.profile}} · ${{config.fps}} fps`;

  function updateStats() {{
    document.querySelector('#loop').textContent = Math.floor(position / config.cycleLength);
    document.querySelector('#shown').textContent = shown;
    const elapsed = Math.max((performance.now() - started) / 1000, 0.001);
    document.querySelector('#measured').textContent = (shown / elapsed).toFixed(1);
  }}

  function schedule() {{
    if (!running) return;
    const requestedAt = performance.now();
    const next = new Image();
    next.onload = () => {{
      image.src = next.src;
      position += 1;
      shown += 1;
      updateStats();
      const generationTime = performance.now() - requestedAt;
      window.setTimeout(schedule, Math.max(0, 1000 / config.fps - generationTime));
    }};
    next.onerror = () => window.setTimeout(schedule, 500);
    next.src = `/frame.png?position=${{position}}&t=${{Date.now()}}`;
  }}

  document.querySelector('#toggle').onclick = event => {{
    running = !running;
    event.currentTarget.textContent = running ? 'Pause' : 'Resume';
    if (running) schedule();
  }};
  document.querySelector('#fullscreen').onclick = () => document.documentElement.requestFullscreen();
  schedule();
</script>
</body>
</html>""".encode("utf-8")


class QRBeamServer(ThreadingHTTPServer):
    daemon_threads = True

    def __init__(self, address: tuple[str, int], session: TransferSession) -> None:
        self.session = session
        super().__init__(address, QRBeamRequestHandler)


class QRBeamRequestHandler(BaseHTTPRequestHandler):
    server: QRBeamServer

    def do_GET(self) -> None:  # noqa: N802 - BaseHTTPRequestHandler API
        parsed = urlparse(self.path)
        if parsed.path == "/":
            self._send(HTTPStatus.OK, "text/html; charset=utf-8", _page(self.server.session))
            return
        if parsed.path == "/frame.png":
            try:
                position = int(parse_qs(parsed.query).get("position", ["0"])[0])
                frame = self.server.session.frame_at(position)
            except (ValueError, IndexError):
                self._send(HTTPStatus.BAD_REQUEST, "text/plain", b"invalid position")
                return
            self._send(HTTPStatus.OK, "image/png", self._qr_png(frame))
            return
        if parsed.path == "/health":
            self._send(HTTPStatus.OK, "application/json", b'{"status":"ok"}')
            return
        self._send(HTTPStatus.NOT_FOUND, "text/plain", b"not found")

    def _qr_png(self, frame: str) -> bytes:
        correction = (
            ERROR_CORRECT_M
            if self.server.session.profile.error_correction == "M"
            else ERROR_CORRECT_L
        )
        qr = qrcode.QRCode(error_correction=correction, box_size=8, border=4)
        qr.add_data(frame, optimize=0)
        qr.make(fit=True)
        output = io.BytesIO()
        qr.make_image(fill_color="black", back_color="white").save(output, format="PNG")
        return output.getvalue()

    def _send(self, status: HTTPStatus, content_type: str, body: bytes) -> None:
        self.send_response(status)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, _format: str, *_args: object) -> None:
        return


def start_server(session: TransferSession, port: int) -> tuple[QRBeamServer, threading.Thread]:
    server = QRBeamServer(("127.0.0.1", port), session)
    thread = threading.Thread(target=server.serve_forever, name="qrbeam-http", daemon=True)
    thread.start()
    return server, thread
