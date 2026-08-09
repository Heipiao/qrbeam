import type { Metadata } from "next";
import { copy, type Locale } from "../i18n";
import { PageShell } from "../site-components";

export const metadata: Metadata = { title: "安装 QRBeam — Python 与 Node.js", description: "通过 Python 或 Node.js 安装 QRBeam，并从电脑向 iPhone 发送文件。" };

function Command({ children }: { children: string }) { return <pre className="command-line"><span>$</span> {children}</pre>; }

export function LocalizedInstall({ locale }: { locale: Locale }) {
  const t = copy[locale].install;
  const optionCodes = ["--profile safe", "--profile fast", "--port 8765", "--no-open"];
  return (
    <PageShell eyebrow={t.eyebrow} title={t.title} description={t.description} locale={locale} page="install">
      <section className="content-shell shell" lang={locale}>
        <div className="install-options">
          <article className="install-card">
            <div className="runtime-head"><span className="runtime-icon">Py</span><div><h2>Python</h2><p>{t.pyReq}</p></div><span className="recommended">{t.recommended}</span></div>
            <ol className="install-steps"><li><b>{t.install}</b><Command>python3 -m pip install --upgrade qrbeam</Command></li><li><b>{t.send}</b><Command>qrbeam send ./example.zip</Command></li></ol>
            <a className="package-link" href="https://pypi.org/project/qrbeam/" target="_blank" rel="noreferrer">{t.pypi} ↗</a>
          </article>
          <article className="install-card">
            <div className="runtime-head"><span className="runtime-icon node-icon">JS</span><div><h2>Node.js</h2><p>{t.nodeReq}</p></div></div>
            <ol className="install-steps"><li><b>{t.globalInstall}</b><Command>npm install --global qrbeam</Command></li><li><b>{t.send}</b><Command>qrbeam send ./example.zip</Command></li></ol>
            <a className="package-link" href="https://www.npmjs.com/package/qrbeam" target="_blank" rel="noreferrer">{t.npm} ↗</a>
          </article>
        </div>
        <section className="guide-section">
          <div className="section-heading split-heading"><div><span className="kicker">USAGE</span><h2>{t.usage}</h2></div><p>{t.usageBody}</p></div>
          <div className="usage-grid">{t.steps.map((step, index) => <div className="usage-flow" key={step[0]}><span>{index + 1}</span><div><b>{step[0]}</b><p>{step[1]}</p></div></div>)}</div>
        </section>
        <section className="options-panel"><div><span className="kicker">COMMAND OPTIONS</span><h2>{t.options}</h2></div><div className="option-list">{optionCodes.map((code, index) => <div key={code}><code>{code}</code><span>{t.optionText[index]}</span></div>)}</div></section>
      </section>
    </PageShell>
  );
}

export default function InstallPage() { return <LocalizedInstall locale="zh" />; }
