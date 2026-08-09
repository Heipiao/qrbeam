import Link from "next/link";
import { Footer, Header, QrMark } from "./site-components";

const qrPattern = [
  "111111100101111",
  "100000101001001",
  "101110101111101",
  "101110100010101",
  "101110101110101",
  "100000100100001",
  "111111101010111",
  "000000001110000",
  "101101111011101",
  "011010001110010",
  "111011101011111",
  "001000011010001",
  "111110110111101",
  "100010001001010",
  "111110111101111",
];

function QrVisual() {
  return (
    <div className="qr-stage" aria-label="动态二维码传输示意图">
      <div className="qr-glow" />
      <div className="qr-card">
        <div className="qr-grid" aria-hidden="true">
          {qrPattern.join("").split("").map((cell, index) => (
            <span className={cell === "1" ? "qr-cell filled" : "qr-cell"} key={index} />
          ))}
        </div>
        <div className="scan-line" />
      </div>
      <div className="transfer-pill">
        <span className="pulse-dot" />
        本地传输中
        <span className="mono">68%</span>
      </div>
      <div className="file-chip file-chip-one">
        <span className="file-icon">ZIP</span>
        <span>project.zip</span>
      </div>
      <div className="file-chip file-chip-two">
        <span className="file-icon">PDF</span>
        <span>notes.pdf</span>
      </div>
    </div>
  );
}

export default function Home() {
  return (
    <main>
      <Header />

      <section className="hero shell">
        <div className="hero-copy">
          <div className="eyebrow"><span />屏幕到相机 · 无需云端</div>
          <h1>让文件，<br /><em>从屏幕跃入手机。</em></h1>
          <p className="hero-lede">
            QRBeam 把小文件编码成动态二维码。电脑负责播放，iPhone 负责扫描——不需要登录、数据线或云盘。
          </p>
          <div className="hero-actions">
            <Link className="button button-primary" href="/install">开始安装 <span>↗</span></Link>
            <a className="button button-ghost" href="#how-it-works">了解工作方式</a>
          </div>
          <div className="hero-facts">
            <span>不上传文件</span><span>CRC32 + SHA-256 校验</span><span>最大 5 MiB</span>
          </div>
        </div>
        <QrVisual />
      </section>

      <section className="ticker" aria-label="产品特点">
        <div>OFFLINE FIRST <i /> LOCAL ONLY <i /> VERIFIED TRANSFER <i /> SCREEN TO CAMERA <i /> NO ACCOUNT</div>
      </section>

      <section className="section shell" id="how-it-works">
        <div className="section-heading split-heading">
          <div>
            <span className="kicker">HOW IT WORKS</span>
            <h2>三步，隔空传过去</h2>
          </div>
          <p>QRBeam 在电脑本地启动播放器。每一帧都带有校验信息，手机收齐后再恢复原文件。</p>
        </div>
        <div className="steps-grid">
          <article className="step-card">
            <span className="step-number">01</span>
            <div className="step-symbol terminal-symbol"><b>›_</b></div>
            <h3>安装命令行工具</h3>
            <p>任选 Python 或 Node.js，一条命令完成安装。</p>
          </article>
          <article className="step-card featured-step">
            <span className="step-number">02</span>
            <div className="step-symbol play-symbol"><b>▶</b></div>
            <h3>播放你的文件</h3>
            <p>运行 <code>qrbeam send FILE</code>，浏览器自动打开动态二维码。</p>
          </article>
          <article className="step-card">
            <span className="step-number">03</span>
            <div className="step-symbol phone-symbol"><b /></div>
            <h3>用 iPhone 扫描</h3>
            <p>QRBeam 收齐、校验并保存文件，然后可直接分享。</p>
          </article>
        </div>
      </section>

      <section className="section shell install-preview" id="install">
        <div className="install-copy">
          <span className="kicker">INSTALL IN SECONDS</span>
          <h2>选你熟悉的方式</h2>
          <p>Python 与 Node.js 发送端使用同一种 QRB1 协议，接收体验完全一致。</p>
          <Link className="text-link" href="/install">查看完整安装指南 <span>→</span></Link>
        </div>
        <div className="code-window">
          <div className="window-bar"><span /><span /><span /><b>Terminal</b></div>
          <div className="code-tabs"><span className="active">Python</span><span>Node.js</span></div>
          <pre><span className="comment"># 需要 Python 3.10+</span>{"\n"}<span className="prompt">$</span> python3 -m pip install --upgrade qrbeam{"\n\n"}<span className="comment"># 发送一个文件</span>{"\n"}<span className="prompt">$</span> qrbeam send ./example.zip</pre>
          <div className="code-status"><span>●</span> 播放器将在 127.0.0.1 自动打开</div>
        </div>
      </section>

      <section className="section shell trust-section">
        <div className="trust-panel">
          <div className="trust-copy">
            <span className="kicker">PRIVATE BY DESIGN</span>
            <h2>你的文件，没有绕路。</h2>
            <p>文件内容和二维码帧都留在你的设备上。QRBeam 不创建账户，不上传所选文件，也不使用广告追踪。</p>
            <Link className="text-link light-link" href="/privacy">阅读隐私政策 <span>→</span></Link>
          </div>
          <div className="privacy-orbit" aria-hidden="true">
            <div className="orbit-ring ring-one" /><div className="orbit-ring ring-two" />
            <div className="orbit-core"><QrMark /></div>
            <span className="orbit-label label-local">LOCAL</span>
            <span className="orbit-label label-private">PRIVATE</span>
          </div>
        </div>
      </section>

      <section className="section shell support-callout">
        <div>
          <span className="kicker">NEED A HAND?</span>
          <h2>卡住了，我们一起解决。</h2>
        </div>
        <Link className="button button-dark" href="/support">前往技术支持 <span>→</span></Link>
      </section>

      <Footer />
    </main>
  );
}
