# QRBeam Node CLI

Send a file from a computer screen to the QRBeam iOS receiver without a network, cable, or cloud service.

```bash
npm install --global qrbeam
qrbeam send ./example.zip
```

Options:

```text
qrbeam send FILE [--profile safe|fast] [--port 8765] [--no-open]
```

- `safe` is the default: 480-byte chunks, 6 FPS, QR error correction M.
- `fast` uses 900-byte chunks, 10 FPS, QR error correction L.
- Files are limited to 5 MiB.
- The local player listens only on `127.0.0.1` and loops until `Ctrl+C`.

The Node and Python CLIs emit the same QRB1 wire format. Transfer remains offline, but QRBeam should only be used for files you are authorized to move; it is not designed to bypass security or DLP controls.

Source and protocol documentation: https://github.com/Heipiao/qrbeam
