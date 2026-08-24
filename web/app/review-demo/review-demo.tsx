"use client";

import QRCode from "qrcode/lib/browser";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

const FIXTURE_SHA256 = "764a2dca7d4481299879e4059ad2bd73cf5fa762571ac4a3174372a0ffb83aec";
const FRAMES = [
  {
    name: "Manifest",
    payload: "QRB1|M|0123456789abcdef|eyJjaHVua1NpemUiOjQ4MCwiZmlsZU5hbWUiOiJmaXh0dXJlLnR4dCIsImZpbGVTaXplIjoxMywibWltZSI6InRleHQvcGxhaW4iLCJwcm90b2NvbCI6IlFSQjEiLCJzaGEyNTYiOiI3NjRhMmRjYTdkNDQ4MTI5OTg3OWU0MDU5YWQyYmQ3M2NmNWZhNzYyNTcxYWM0YTMxNzQzNzJhMGZmYjgzYWVjIiwidG90YWxDaHVua3MiOjF9|2cfbaadd",
  },
  {
    name: "Data 1 of 1",
    payload: "QRB1|D|0123456789abcdef|0|1|aGVsbG8gUVJCZWFtCg|9370828f",
  },
] as const;

export default function ReviewDemo() {
  const [frameIndex, setFrameIndex] = useState(0);
  const [playing, setPlaying] = useState(true);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!canvasRef.current) return;
    QRCode.toCanvas(canvasRef.current, FRAMES[frameIndex].payload, {
      errorCorrectionLevel: "L",
      margin: 3,
      width: 760,
      color: { dark: "#101512", light: "#ffffff" },
    });
  }, [frameIndex]);

  useEffect(() => {
    if (!playing) return;
    const timer = window.setInterval(() => setFrameIndex(value => (value + 1) % FRAMES.length), 650);
    return () => window.clearInterval(timer);
  }, [playing]);

  async function toggleFullscreen() {
    if (document.fullscreenElement) await document.exitFullscreen();
    else await stageRef.current?.requestFullscreen();
  }

  return (
    <main className="review-demo-page">
      <header className="review-demo-header">
        <Link href="/" className="review-demo-brand" aria-label="QRBeam home"><span>Q</span> QRBeam</Link>
        <div><strong>App Review Demo</strong><small>QRB1 protocol fixture</small></div>
      </header>

      <section className="review-demo-grid">
        <div className="review-qr-stage" ref={stageRef}>
          <canvas ref={canvasRef} aria-label={`${FRAMES[frameIndex].name} QR code`} />
          <div className="review-frame-status">
            <span className={playing ? "live" : ""} />
            {playing ? "PLAYING" : "PAUSED"} · {FRAMES[frameIndex].name}
          </div>
        </div>

        <aside className="review-demo-panel">
          <p className="review-eyebrow">TEST ASSET · NO LOGIN REQUIRED</p>
          <h1>Scan a real two-frame QRBeam transfer.</h1>
          <p className="review-intro">This page continuously displays the exact QRB1 manifest and data frames for the public review fixture <code>fixture.txt</code>.</p>
          <div className="review-controls">
            <button type="button" onClick={() => setPlaying(value => !value)}>{playing ? "Pause" : "Continue"}</button>
            <button type="button" className="secondary" onClick={toggleFullscreen}>Fullscreen</button>
            <a href="/review-demo/fixture.txt" download>Download fixture.txt</a>
          </div>
          <dl className="review-facts">
            <div><dt>File</dt><dd>fixture.txt · 13 bytes</dd></div>
            <div><dt>Frames</dt><dd>Manifest + 1 data frame</dd></div>
            <div><dt>SHA-256</dt><dd><code>{FIXTURE_SHA256}</code></dd></div>
          </dl>
        </aside>
      </section>

      <section className="review-instructions">
        <article><span>RECEIVE</span><h2>Review the camera flow</h2><ol><li>Open QRBeam on the review device.</li><li>Choose <b>Receive</b>, then tap <b>Continue</b>.</li><li>Approve the iOS camera permission and point the camera at the QR above.</li><li>Confirm that <b>fixture.txt</b> completes with the SHA-256 shown here.</li></ol></article>
        <article><span>SEND</span><h2>Review the sending flow</h2><ol><li>Download <b>fixture.txt</b> using the button above.</li><li>In QRBeam choose <b>Send</b> and select the downloaded file.</li><li>The app displays the same looping manifest and data frames.</li><li>Pause, resume, brightness and fullscreen controls remain local to the device.</li></ol></article>
      </section>

      <footer className="review-demo-footer">QRBeam transfers files locally through visible QR frames. This page performs no upload and requires no account.</footer>
    </main>
  );
}
