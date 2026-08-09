from __future__ import annotations

import argparse
import sys
import time
import webbrowser
from pathlib import Path

from .protocol import MAX_FILE_SIZE, PROFILES, TransferSession
from .server import start_server


def _parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(prog="qrbeam", description="Send files as animated QR codes")
    subcommands = parser.add_subparsers(dest="command", required=True)
    send = subcommands.add_parser("send", help="display a file as a looping QR stream")
    send.add_argument("file", type=Path)
    send.add_argument("--profile", choices=sorted(PROFILES), default="safe")
    send.add_argument("--port", type=int, default=8765)
    send.add_argument("--no-open", action="store_true", help="do not open the browser")
    return parser


def _send(args: argparse.Namespace) -> int:
    file_path: Path = args.file.expanduser()
    if not file_path.is_file():
        print(f"error: file does not exist: {file_path}", file=sys.stderr)
        return 2
    size = file_path.stat().st_size
    if size > MAX_FILE_SIZE:
        print(
            f"error: file is {size} bytes; MVP limit is {MAX_FILE_SIZE} bytes (5 MiB)",
            file=sys.stderr,
        )
        return 2
    if not 1 <= args.port <= 65535:
        print("error: port must be between 1 and 65535", file=sys.stderr)
        return 2

    session = TransferSession(file_path, PROFILES[args.profile])
    try:
        server, thread = start_server(session, args.port)
    except OSError as exc:
        print(f"error: could not listen on 127.0.0.1:{args.port}: {exc}", file=sys.stderr)
        return 2

    url = f"http://127.0.0.1:{args.port}/"
    print(f"QRBeam session: {session.session_id}")
    print(f"File: {session.manifest['fileName']} ({size} bytes)")
    print(
        f"Profile: {session.profile.name} — {session.profile.chunk_size} bytes/chunk, "
        f"{session.profile.fps} fps, ECC {session.profile.error_correction}"
    )
    print(f"Frames per loop: {session.cycle_length}")
    print(f"Open: {url}")
    print("Press Ctrl+C to stop.")
    if not args.no_open:
        webbrowser.open(url)

    try:
        while thread.is_alive():
            time.sleep(0.25)
    except KeyboardInterrupt:
        print("\nStopping QRBeam…")
    finally:
        server.shutdown()
        server.server_close()
        thread.join(timeout=2)
    return 0


def main(argv: list[str] | None = None) -> int:
    args = _parser().parse_args(argv)
    if args.command == "send":
        return _send(args)
    return 2


if __name__ == "__main__":
    raise SystemExit(main())
