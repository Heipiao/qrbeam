# QRBeam MVP

QRBeam transfers a small file through an animated QR stream without a network, cable, or cloud service. A computer can send through the Python or Node CLI, or one iPhone can display the same QRB1 stream for another iPhone to scan. The React Native iOS app verifies CRC32 and SHA-256 before saving or sharing the restored file.

> Use QRBeam only for files you are authorized to move. It is a technical feasibility MVP, not a way to bypass company security or DLP controls.

## Computer sender

Python 3.10 or newer:

```bash
python3 -m venv .venv
.venv/bin/python -m pip install -e '.[dev]'
.venv/bin/qrbeam send ./example.zip
```

Node.js 20 or newer:

```bash
cd node
npm install
npm link
qrbeam send ./example.zip
```

The page listens only on `127.0.0.1:8765` and normally opens automatically. Click **Enter full screen**, open the receiver on the iPhone, and point the rear camera at the QR code.

```text
qrbeam send FILE [--profile safe|fast] [--port 8765] [--no-open]
```

| Profile | Chunk | Target rate | QR correction | Intended use                                    |
| ------- | ----: | ----------: | ------------- | ----------------------------------------------- |
| `safe`  | 480 B |       6 fps | M             | Default, more tolerant of distance and movement |
| `fast`  | 900 B |      10 fps | L             | Fixed phone, bright display, larger files       |

The sender rejects files larger than 5 MiB. It repeats the manifest every 20 data frames and loops until stopped with `Ctrl+C`.

## iOS app

Requirements: Node 20.19.4+, Xcode, CocoaPods, and an iPhone for camera validation.

```bash
cd mobile
npm install
bundle install
cd ios && bundle exec pod install && cd ..
npm start
```

Open `mobile/ios/QRBeamReceiver.xcworkspace`, select the `QRBeamReceiver` scheme and an iPhone, then Run. The development bundle identifier is `com.leoliu.qrbeamreceiver`.

The app has two tabs:

- **电脑传手机** scans a QRBeam from the Python CLI or another iPhone. Frames may arrive out of order and missing frames are recovered on the next loop.
- **手机传手机** selects one file from the system document picker, verifies its SHA-256, and plays a looping `safe` or `fast` QR stream. The receiving phone uses the first tab.

Files can also be shared to **Send with QRBeam** from another iOS app. The Share Extension copies one file of at most 5 MiB into the App Group, then asks the user to open QRBeam. The main app consumes the pending file and opens the send confirmation screen.

The main app and Share Extension require the App Group `group.com.leoliu.qrbeam`. Add that capability to both identifiers in the Apple Developer account and refresh their provisioning profiles before installing on a physical device. The extension bundle id is `com.leoliu.qrbeamreceiver.ShareExtension`.

The Simulator can verify builds, navigation, document picker, App Group consumption, QR playback, fixture assembly, native save, and the share sheet. It exposes no rear camera here and therefore cannot prove the optical transfer; two physical iPhones are required for phone-to-phone acceptance.

## Verification

```bash
.venv/bin/pytest -q
(cd node && npm test && npm run pack:check)
(cd mobile && npx tsc --noEmit && npm run lint && npm test -- --runInBand)
```

The shared Python/Node/TypeScript fixture is in `protocol/test-vector.json`; the wire format is documented in `protocol/PROTOCOL.md`.

Current local verification:

- Python protocol/server tests: passing.
- Node protocol/server/CLI tests and npm package dry-run: passing.
- TypeScript compile, ESLint, and 10 Jest protocol/sender/assembler tests: passing.
- iOS 18.2 Simulator Debug build and launch: passing, including the embedded Share Extension.
- Dual-tab navigation, document picker presentation, App Group pending-file consumption and cleanup: passing.
- On-device QR playback fixture: rendered at about 6.1 FPS in `safe`, with pause and restart controls available.
- Saved fixture verified as 13 bytes with SHA-256 `764a2dca7d4481299879e4059ad2bd73cf5fa762571ac4a3174372a0ffb83aec`.
- Generic arm64 iOS device Debug build without signing: passing.
- Signed device installation is currently blocked because the local Xcode account/profile does not include the required App Group capability.
- Physical computer-to-phone and phone-to-phone camera transfers remain pending.

## Benchmark worksheet

Do not infer feasibility from a successful build. Record real optical transfers here.

| Date    | Device            | Display / brightness | Distance |   File | Profile | Result  | Time | Effective KB/s | Notes                              |
| ------- | ----------------- | -------------------- | -------- | -----: | ------- | ------- | ---: | -------------: | ---------------------------------- |
| Pending | iPhone 15 Pro Max | Pending              | Pending  | 100 KB | safe    | Not run |    — |              — | Basic byte-identical loop          |
| Pending | iPhone 15 Pro Max | Pending              | Pending  |   1 MB | safe    | Not run |    — |              — | Target: 3/3, median ≤ 8 min        |
| Pending | iPhone 15 Pro Max | Pending              | Pending  |   5 MB | fast    | Not run |    — |              — | Target: 2/3, median ≤ 15 min       |
| Pending | iPhone → iPhone   | Pending              | Pending  | 100 KB | safe    | Not run |    — |              — | Phone-to-phone byte-identical loop |
| Pending | iPhone → iPhone   | Pending              | Pending  |   1 MB | safe    | Not run |    — |              — | Target: 3/3, median ≤ 10 min       |
| Pending | iPhone → iPhone   | Pending              | Pending  |   5 MB | fast    | Not run |    — |              — | Target: 2/3, median ≤ 15 min       |

If these thresholds are not met, the correct conclusion is: the software loop works, but the MVP is not yet product-viable. Fountain coding, encryption, compression, Android, MP4 output, TestFlight, and App Store distribution are intentionally out of scope.
