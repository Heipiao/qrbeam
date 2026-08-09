import type { Metadata } from "next";
import { PageShell } from "../site-components";

export const metadata: Metadata = {
  title: "安装 QRBeam — Python 与 Node.js",
  description: "通过 Python 或 Node.js 安装 QRBeam，并从电脑向 iPhone 发送文件。",
};

function Command({ children }: { children: string }) {
  return <pre className="command-line"><span>$</span> {children}</pre>;
}

export default function InstallPage() {
  return (
    <PageShell eyebrow="INSTALL" title="两种语言，一种简单体验。" description="选择电脑上已有的运行环境。Python 与 Node.js 版本都来自官方包仓库，并生成完全相同的 QRB1 动态二维码。">
      <section className="content-shell shell">
        <div className="install-options">
          <article className="install-card">
            <div className="runtime-head"><span className="runtime-icon">Py</span><div><h2>Python</h2><p>需要 Python 3.10 或更高版本</p></div><span className="recommended">推荐</span></div>
            <ol className="install-steps">
              <li><b>安装 QRBeam</b><Command>python3 -m pip install --upgrade qrbeam</Command></li>
              <li><b>发送文件</b><Command>qrbeam send ./example.zip</Command></li>
            </ol>
            <a className="package-link" href="https://pypi.org/project/qrbeam/" target="_blank" rel="noreferrer">在 PyPI 查看软件包 ↗</a>
          </article>
          <article className="install-card">
            <div className="runtime-head"><span className="runtime-icon node-icon">JS</span><div><h2>Node.js</h2><p>需要 Node.js 20 或更高版本</p></div></div>
            <ol className="install-steps">
              <li><b>全局安装 QRBeam</b><Command>npm install --global qrbeam</Command></li>
              <li><b>发送文件</b><Command>qrbeam send ./example.zip</Command></li>
            </ol>
            <a className="package-link" href="https://www.npmjs.com/package/qrbeam" target="_blank" rel="noreferrer">在 npm 查看软件包 ↗</a>
          </article>
        </div>

        <section className="guide-section">
          <div className="section-heading split-heading"><div><span className="kicker">USAGE</span><h2>开始第一次传输</h2></div><p>命令运行后，QRBeam 会在浏览器中打开本地播放器。把 iPhone 后置相机对准屏幕即可。</p></div>
          <div className="usage-grid">
            <div className="usage-flow"><span>1</span><div><b>选择文件</b><p>文件需不超过 5 MiB。</p></div></div>
            <div className="usage-flow"><span>2</span><div><b>运行命令</b><p><code>qrbeam send FILE</code></p></div></div>
            <div className="usage-flow"><span>3</span><div><b>保持画面清晰</b><p>浏览器全屏、提高亮度，手机稳定对准。</p></div></div>
            <div className="usage-flow"><span>4</span><div><b>等待校验完成</b><p>收齐后由 SHA-256 校验文件。</p></div></div>
          </div>
        </section>

        <section className="options-panel">
          <div><span className="kicker">COMMAND OPTIONS</span><h2>常用参数</h2></div>
          <div className="option-list">
            <div><code>--profile safe</code><span>默认，6 fps，更适合手持扫描</span></div>
            <div><code>--profile fast</code><span>10 fps，适合固定手机与明亮屏幕</span></div>
            <div><code>--port 8765</code><span>更改本地播放器端口</span></div>
            <div><code>--no-open</code><span>不自动打开浏览器</span></div>
          </div>
        </section>
      </section>
    </PageShell>
  );
}
