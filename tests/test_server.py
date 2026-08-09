import urllib.request
from pathlib import Path

from qrbeam.protocol import PROFILES, TransferSession
from qrbeam.server import start_server


def test_local_server_page_health_and_qr(tmp_path: Path) -> None:
    source = tmp_path / "hello.txt"
    source.write_text("hello QRBeam", encoding="utf-8")
    session = TransferSession(source, PROFILES["safe"], session_id="eeeeeeeeeeeeeeee")
    server, thread = start_server(session, 0)
    port = server.server_address[1]
    try:
        with urllib.request.urlopen(f"http://127.0.0.1:{port}/", timeout=3) as response:
            page = response.read()
            assert response.status == 200
            assert b"QRBeam" in page
            assert b"hello.txt" in page
        with urllib.request.urlopen(f"http://127.0.0.1:{port}/health", timeout=3) as response:
            assert response.read() == b'{"status":"ok"}'
        with urllib.request.urlopen(
            f"http://127.0.0.1:{port}/frame.png?position=0", timeout=3
        ) as response:
            assert response.headers["Content-Type"] == "image/png"
            assert response.read(8) == b"\x89PNG\r\n\x1a\n"
    finally:
        server.shutdown()
        server.server_close()
        thread.join(timeout=2)
