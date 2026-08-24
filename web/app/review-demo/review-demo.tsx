"use client";

import QRCode from "qrcode/lib/browser";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { languageInfo, locales, type Locale } from "../i18n";

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

const REVIEW_COPY: Record<Locale, {
  language: string; pageTitle: string; protocol: string; eyebrow: string; title: string;
  intro: string; pause: string; continue: string; fullscreen: string; download: string;
  playing: string; paused: string; manifest: string; dataFrame: string; file: string;
  frames: string; frameValue: string; receive: string; receiveTitle: string;
  receiveSteps: string[]; send: string; sendTitle: string; sendSteps: string[]; footer: string;
}> = {
  zh: {
    language: "语言", pageTitle: "App 审核演示", protocol: "QRB1 协议测试文件", eyebrow: "公开测试文件 · 无需登录",
    title: "扫描一次真实的双帧 QRBeam 传输。", intro: "本页面循环显示审核测试文件 fixture.txt 对应的真实 QRB1 清单帧和数据帧。",
    pause: "暂停", continue: "继续", fullscreen: "全屏", download: "下载 fixture.txt", playing: "播放中", paused: "已暂停",
    manifest: "清单帧", dataFrame: "数据帧 1/1", file: "文件", frames: "帧", frameValue: "清单帧 + 1 个数据帧",
    receive: "接收", receiveTitle: "检查相机接收流程", receiveSteps: ["在审核设备上打开 QRBeam。", "选择“接收”，然后点击“继续”。", "允许 iOS 相机权限，并将相机对准上方二维码。", "确认 fixture.txt 接收完成，且 SHA-256 与页面一致。"],
    send: "发送", sendTitle: "检查文件发送流程", sendSteps: ["使用上方按钮下载 fixture.txt。", "在 QRBeam 中选择“发送”，并选择刚下载的文件。", "App 会显示相同的循环清单帧和数据帧。", "暂停、继续、亮度和全屏控制均仅在本机运行。"],
    footer: "QRBeam 通过可见二维码帧在本地传输文件。本页面不上传文件，也不需要账户。",
  },
  en: {
    language: "Language", pageTitle: "App Review Demo", protocol: "QRB1 protocol fixture", eyebrow: "TEST ASSET · NO LOGIN REQUIRED",
    title: "Scan a real two-frame QRBeam transfer.", intro: "This page continuously displays the exact QRB1 manifest and data frames for the public review fixture fixture.txt.",
    pause: "Pause", continue: "Continue", fullscreen: "Fullscreen", download: "Download fixture.txt", playing: "PLAYING", paused: "PAUSED",
    manifest: "Manifest", dataFrame: "Data 1 of 1", file: "File", frames: "Frames", frameValue: "Manifest + 1 data frame",
    receive: "RECEIVE", receiveTitle: "Review the camera flow", receiveSteps: ["Open QRBeam on the review device.", "Choose Receive, then tap Continue.", "Approve the iOS camera permission and point the camera at the QR above.", "Confirm that fixture.txt completes with the SHA-256 shown here."],
    send: "SEND", sendTitle: "Review the sending flow", sendSteps: ["Download fixture.txt using the button above.", "In QRBeam choose Send and select the downloaded file.", "The app displays the same looping manifest and data frames.", "Pause, resume, brightness and fullscreen controls remain local to the device."],
    footer: "QRBeam transfers files locally through visible QR frames. This page performs no upload and requires no account.",
  },
  ja: {
    language: "言語", pageTitle: "App 審査デモ", protocol: "QRB1 プロトコルテスト", eyebrow: "公開テストファイル · ログイン不要",
    title: "実際の 2 フレーム QRBeam 転送をスキャン。", intro: "このページは、審査用 fixture.txt の正確な QRB1 マニフェストとデータフレームを繰り返し表示します。",
    pause: "一時停止", continue: "続ける", fullscreen: "全画面", download: "fixture.txt をダウンロード", playing: "再生中", paused: "一時停止中",
    manifest: "マニフェスト", dataFrame: "データ 1/1", file: "ファイル", frames: "フレーム", frameValue: "マニフェスト + データ 1 フレーム",
    receive: "受信", receiveTitle: "カメラ受信フローを確認", receiveSteps: ["審査端末で QRBeam を開きます。", "「受信」を選び、「続ける」をタップします。", "iOS のカメラ権限を許可し、上の QR にカメラを向けます。", "fixture.txt が完了し、SHA-256 が一致することを確認します。"],
    send: "送信", sendTitle: "ファイル送信フローを確認", sendSteps: ["上のボタンで fixture.txt をダウンロードします。", "QRBeam で「送信」を選び、ファイルを指定します。", "App に同じマニフェストとデータフレームが表示されます。", "一時停止、再開、明るさ、全画面は端末内だけで動作します。"],
    footer: "QRBeam は表示された QR フレームでローカル転送します。このページはアップロードもアカウントも不要です。",
  },
  ko: {
    language: "언어", pageTitle: "App 심사 데모", protocol: "QRB1 프로토콜 테스트", eyebrow: "공개 테스트 파일 · 로그인 불필요",
    title: "실제 2프레임 QRBeam 전송을 스캔하세요.", intro: "이 페이지는 심사용 fixture.txt의 정확한 QRB1 매니페스트와 데이터 프레임을 반복 표시합니다.",
    pause: "일시정지", continue: "계속", fullscreen: "전체 화면", download: "fixture.txt 다운로드", playing: "재생 중", paused: "일시정지",
    manifest: "매니페스트", dataFrame: "데이터 1/1", file: "파일", frames: "프레임", frameValue: "매니페스트 + 데이터 프레임 1개",
    receive: "수신", receiveTitle: "카메라 수신 흐름 확인", receiveSteps: ["심사 기기에서 QRBeam을 엽니다.", "수신을 선택하고 계속을 누릅니다.", "iOS 카메라 권한을 허용하고 위 QR을 비춥니다.", "fixture.txt 완료 후 SHA-256이 일치하는지 확인합니다."],
    send: "전송", sendTitle: "파일 전송 흐름 확인", sendSteps: ["위 버튼으로 fixture.txt를 다운로드합니다.", "QRBeam에서 전송을 선택하고 파일을 고릅니다.", "App이 같은 매니페스트와 데이터 프레임을 반복 표시합니다.", "일시정지, 재개, 밝기, 전체 화면은 기기에서만 작동합니다."],
    footer: "QRBeam은 보이는 QR 프레임으로 로컬 전송합니다. 이 페이지는 업로드나 계정이 필요하지 않습니다.",
  },
  fr: {
    language: "Langue", pageTitle: "Démo pour l’examen de l’App", protocol: "Fichier test du protocole QRB1", eyebrow: "FICHIER TEST PUBLIC · SANS CONNEXION",
    title: "Scannez un véritable transfert QRBeam en deux images.", intro: "Cette page affiche en boucle les images QRB1 exactes du fichier d’examen fixture.txt.",
    pause: "Pause", continue: "Continuer", fullscreen: "Plein écran", download: "Télécharger fixture.txt", playing: "LECTURE", paused: "PAUSE",
    manifest: "Manifeste", dataFrame: "Données 1 sur 1", file: "Fichier", frames: "Images", frameValue: "Manifeste + 1 image de données",
    receive: "RECEVOIR", receiveTitle: "Vérifier le flux caméra", receiveSteps: ["Ouvrez QRBeam sur l’appareil d’examen.", "Choisissez Recevoir, puis Continuer.", "Autorisez la caméra iOS et visez le QR ci-dessus.", "Vérifiez que fixture.txt se termine avec le SHA-256 affiché."],
    send: "ENVOYER", sendTitle: "Vérifier l’envoi", sendSteps: ["Téléchargez fixture.txt avec le bouton ci-dessus.", "Dans QRBeam, choisissez Envoyer et sélectionnez le fichier.", "L’app affiche les mêmes images QRB1 en boucle.", "Pause, reprise, luminosité et plein écran restent locaux."],
    footer: "QRBeam transfère localement par QR visibles. Cette page ne téléverse rien et ne nécessite aucun compte.",
  },
  de: {
    language: "Sprache", pageTitle: "App-Review-Demo", protocol: "QRB1-Protokolltest", eyebrow: "ÖFFENTLICHE TESTDATEI · KEINE ANMELDUNG",
    title: "Einen echten QRBeam-Transfer mit zwei Frames scannen.", intro: "Diese Seite zeigt fortlaufend die exakten QRB1-Manifest- und Datenframes für fixture.txt.",
    pause: "Pause", continue: "Fortfahren", fullscreen: "Vollbild", download: "fixture.txt herunterladen", playing: "WIEDERGABE", paused: "PAUSIERT",
    manifest: "Manifest", dataFrame: "Daten 1 von 1", file: "Datei", frames: "Frames", frameValue: "Manifest + 1 Datenframe",
    receive: "EMPFANGEN", receiveTitle: "Kameraablauf prüfen", receiveSteps: ["QRBeam auf dem Prüfgerät öffnen.", "Empfangen wählen und Fortfahren tippen.", "iOS-Kamerazugriff erlauben und die Kamera auf den QR-Code richten.", "Prüfen, dass fixture.txt mit der angezeigten SHA-256 abgeschlossen wird."],
    send: "SENDEN", sendTitle: "Sendeablauf prüfen", sendSteps: ["fixture.txt über die Schaltfläche herunterladen.", "In QRBeam Senden wählen und die Datei auswählen.", "Die App zeigt dieselben Manifest- und Datenframes in Schleife.", "Pause, Fortsetzen, Helligkeit und Vollbild bleiben lokal."],
    footer: "QRBeam überträgt Dateien lokal über sichtbare QR-Frames. Diese Seite lädt nichts hoch und benötigt kein Konto.",
  },
};

const STORAGE_KEY = "qrbeam.locale";

function isLocale(value: string | null): value is Locale {
  return value !== null && locales.includes(value as Locale);
}

export default function ReviewDemo() {
  const [locale, setLocale] = useState<Locale>("en");
  const [frameIndex, setFrameIndex] = useState(0);
  const [playing, setPlaying] = useState(true);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const t = REVIEW_COPY[locale];
  const frameName = frameIndex === 0 ? t.manifest : t.dataFrame;

  useEffect(() => {
    let preferred: Locale | null = null;
    try {
      preferred = window.localStorage.getItem(STORAGE_KEY) as Locale | null;
    } catch {
      // Continue with browser language when storage is unavailable.
    }
    if (!isLocale(preferred)) {
      preferred = navigator.languages
        .map(language => language.toLowerCase().split("-")[0])
        .find(isLocale) ?? "en";
    }
    const frame = window.requestAnimationFrame(() => setLocale(preferred));
    return () => window.cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    document.documentElement.lang = languageInfo[locale].htmlLang;
  }, [locale]);

  function changeLocale(next: Locale) {
    setLocale(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // The selected language still applies for this visit.
    }
  }

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
        <div className="review-demo-header-actions">
          <div className="review-demo-title"><strong>{t.pageTitle}</strong><small>{t.protocol}</small></div>
          <label className="review-language"><span>{t.language}</span><select value={locale} onChange={event => changeLocale(event.target.value as Locale)}>{locales.map(item => <option value={item} key={item}>{languageInfo[item].label}</option>)}</select></label>
        </div>
      </header>

      <section className="review-demo-grid">
        <div className="review-qr-stage" ref={stageRef}>
          <canvas ref={canvasRef} aria-label={`${frameName} QR code`} />
          <div className="review-frame-status">
            <span className={playing ? "live" : ""} />
            {playing ? t.playing : t.paused} · {frameName}
          </div>
        </div>

        <aside className="review-demo-panel">
          <p className="review-eyebrow">{t.eyebrow}</p>
          <h1>{t.title}</h1>
          <p className="review-intro">{t.intro}</p>
          <div className="review-controls">
            <button type="button" onClick={() => setPlaying(value => !value)}>{playing ? t.pause : t.continue}</button>
            <button type="button" className="secondary" onClick={toggleFullscreen}>{t.fullscreen}</button>
            <a href="/review-demo/fixture.txt" download>{t.download}</a>
          </div>
          <dl className="review-facts">
            <div><dt>{t.file}</dt><dd>fixture.txt · 13 bytes</dd></div>
            <div><dt>{t.frames}</dt><dd>{t.frameValue}</dd></div>
            <div><dt>SHA-256</dt><dd><code>{FIXTURE_SHA256}</code></dd></div>
          </dl>
        </aside>
      </section>

      <section className="review-instructions">
        <article><span>{t.receive}</span><h2>{t.receiveTitle}</h2><ol>{t.receiveSteps.map(step => <li key={step}>{step}</li>)}</ol></article>
        <article><span>{t.send}</span><h2>{t.sendTitle}</h2><ol>{t.sendSteps.map(step => <li key={step}>{step}</li>)}</ol></article>
      </section>

      <footer className="review-demo-footer">{t.footer}</footer>
    </main>
  );
}
