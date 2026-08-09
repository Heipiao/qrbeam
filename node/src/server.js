import http from "node:http";

import QRCode from "qrcode";

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#x27;");
}

export function renderPage(session) {
  const config = {
    cycleLength: session.cycleLength,
    fileName: session.manifest.fileName,
    fileSize: session.manifest.fileSize,
    fps: session.profile.fps,
    profile: session.profile.name,
  };
  const safeConfig = JSON.stringify(config).replaceAll("<", "\\u003c");
  const safeTitle = escapeHtml(session.manifest.fileName);
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>QRBeam — ${safeTitle}</title>
  <style>
    :root { color-scheme: dark; font-family: -apple-system, BlinkMacSystemFont, sans-serif; }
    * { box-sizing: border-box; }
    body { margin: 0; background: #090b10; color: #f7f8fa; min-height: 100vh; display: grid; place-items: center; }
    main { width: min(96vw, 1120px); display: grid; grid-template-columns: minmax(0, 1fr) 280px; gap: 24px; align-items: center; }
    .stage { background: white; border-radius: 22px; padding: 18px; aspect-ratio: 1; display: grid; place-items: center; box-shadow: 0 20px 80px #0009; }
    #qr { display: block; width: 100%; height: 100%; object-fit: contain; image-rendering: pixelated; }
    aside { display: grid; gap: 16px; }
    h1 { margin: 0; font-size: 28px; }
    .file { color: #b9c0cc; overflow-wrap: anywhere; }
    .metric { display: flex; justify-content: space-between; border-bottom: 1px solid #272c35; padding: 10px 0; }
    button { border: 0; border-radius: 12px; padding: 13px 16px; font: inherit; font-weight: 650; cursor: pointer; }
    #toggle { background: #67e8a5; color: #07120c; }
    #fullscreen { background: #242a34; color: white; }
    .notice { color: #8f98a7; font-size: 13px; line-height: 1.45; }
    @media (max-width: 760px) { main { grid-template-columns: 1fr; padding: 16px; } aside { grid-template-columns: 1fr 1fr; } aside > * { grid-column: 1 / -1; } }
  </style>
</head>
<body>
<main>
  <section class="stage"><img id="qr" alt="Animated QR transfer frame"></section>
  <aside>
    <div><h1>QRBeam</h1><div class="file">${safeTitle}</div></div>
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
  const config = ${safeConfig};
  const image = document.querySelector('#qr');
  let position = 0;
  let running = true;
  let shown = 0;
  let started = performance.now();
  document.querySelector('#profile').textContent = \`${"${config.profile}"} · ${"${config.fps}"} fps\`;

  function updateStats() {
    document.querySelector('#loop').textContent = Math.floor(position / config.cycleLength);
    document.querySelector('#shown').textContent = shown;
    const elapsed = Math.max((performance.now() - started) / 1000, 0.001);
    document.querySelector('#measured').textContent = (shown / elapsed).toFixed(1);
  }

  function schedule() {
    if (!running) return;
    const requestedAt = performance.now();
    const next = new Image();
    next.onload = () => {
      image.src = next.src;
      position += 1;
      shown += 1;
      updateStats();
      const generationTime = performance.now() - requestedAt;
      window.setTimeout(schedule, Math.max(0, 1000 / config.fps - generationTime));
    };
    next.onerror = () => window.setTimeout(schedule, 500);
    next.src = \`/frame.png?position=${"${position}"}&t=${"${Date.now()}"}\`;
  }

  document.querySelector('#toggle').onclick = event => {
    running = !running;
    event.currentTarget.textContent = running ? 'Pause' : 'Resume';
    if (running) schedule();
  };
  document.querySelector('#fullscreen').onclick = () => document.documentElement.requestFullscreen();
  schedule();
</script>
</body>
</html>`;
}

function send(response, statusCode, contentType, body) {
  response.writeHead(statusCode, {
    "Cache-Control": "no-store",
    "Content-Length": body.length,
    "Content-Security-Policy":
      "default-src 'self'; img-src 'self' data:; style-src 'unsafe-inline'; script-src 'unsafe-inline'",
    "Content-Type": contentType,
    "Cross-Origin-Resource-Policy": "same-origin",
    "Referrer-Policy": "no-referrer",
    "X-Content-Type-Options": "nosniff",
  });
  response.end(body);
}

export async function qrPng(frame, errorCorrection) {
  return QRCode.toBuffer(frame, {
    errorCorrectionLevel: errorCorrection,
    margin: 4,
    scale: 8,
    type: "png",
  });
}

export function createServer(session) {
  return http.createServer(async (request, response) => {
    try {
      const url = new URL(request.url ?? "/", "http://127.0.0.1");
      if (request.method !== "GET") {
        send(
          response,
          405,
          "text/plain; charset=utf-8",
          Buffer.from("method not allowed")
        );
        return;
      }
      if (url.pathname === "/") {
        send(
          response,
          200,
          "text/html; charset=utf-8",
          Buffer.from(renderPage(session))
        );
        return;
      }
      if (url.pathname === "/health") {
        send(response, 200, "application/json", Buffer.from('{"status":"ok"}'));
        return;
      }
      if (url.pathname === "/frame.png") {
        const rawPosition = url.searchParams.get("position") ?? "0";
        if (!/^\d+$/.test(rawPosition)) {
          send(
            response,
            400,
            "text/plain; charset=utf-8",
            Buffer.from("invalid position")
          );
          return;
        }
        const position = Number(rawPosition);
        if (!Number.isSafeInteger(position)) {
          send(
            response,
            400,
            "text/plain; charset=utf-8",
            Buffer.from("invalid position")
          );
          return;
        }
        const frame = session.frameAt(position);
        const image = await qrPng(frame, session.profile.errorCorrection);
        send(response, 200, "image/png", image);
        return;
      }
      send(
        response,
        404,
        "text/plain; charset=utf-8",
        Buffer.from("not found")
      );
    } catch (error) {
      if (!response.headersSent) {
        send(
          response,
          500,
          "text/plain; charset=utf-8",
          Buffer.from("internal error")
        );
      } else {
        response.destroy(error);
      }
    }
  });
}

export function startServer(session, port) {
  const server = createServer(session);
  return new Promise((resolve, reject) => {
    const onError = (error) => {
      server.off("listening", onListening);
      reject(error);
    };
    const onListening = () => {
      server.off("error", onError);
      const address = server.address();
      resolve({ server, port: address.port });
    };
    server.once("error", onError);
    server.once("listening", onListening);
    server.listen(port, "127.0.0.1");
  });
}
