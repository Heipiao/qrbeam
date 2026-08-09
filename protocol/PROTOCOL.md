# QRB1 protocol

QRB1 is the MVP wire format shared by the Python CLI, Node CLI, and iOS app. Every QR code contains one UTF-8 ASCII frame.

```text
QRB1|M|<16-hex-session-id>|<base64url-manifest-json>|<crc32>
QRB1|D|<16-hex-session-id>|<zero-based-index>|<total>|<base64url-chunk>|<crc32>
```

- Base64URL padding is omitted.
- CRC32 is eight lowercase hexadecimal characters computed over decoded payload bytes.
- Manifest JSON is UTF-8 and contains `protocol`, `fileName`, `mime`, `fileSize`, `chunkSize`, `totalChunks`, and `sha256`.
- A receiver must not mix sessions. It ignores data until it has a valid manifest, then accepts chunks in any order and ignores duplicates.
- The sender repeats the manifest after each 20 data frames and loops forever. QR-level error correction handles damaged symbols; the outer protocol handles only whole-frame loss by repetition.
- Filename values are basenames, stripped of control characters and filesystem-reserved punctuation.

QRB1 deliberately has no compression, encryption, fountain coding, acknowledgements, or compatibility negotiation.
