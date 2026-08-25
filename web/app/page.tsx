import { copy, localeHref, type Locale } from "./i18n";
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
        LOCAL
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

export function LocalizedHome({ locale }: { locale: Locale }) {
  const t = copy[locale].home;
  const common = copy[locale].common;
  return (
    <main lang={locale}>
      <Header locale={locale} page="" />

      <section className="hero shell">
        <div className="hero-copy">
          <div className="eyebrow"><span />{t.eyebrow}</div>
          <h1>{t.h1}<br /><em>{t.h2}</em></h1>
          <p className="hero-lede">{t.lede}</p>
          <div className="hero-actions">
            <a className="button button-primary" href={localeHref(locale, "install")}>{common.start} <span>↗</span></a>
            <a className="button button-ghost" href="#how-it-works">{t.learn}</a>
          </div>
          <div className="hero-facts">
            {t.facts.map(item => <span key={item}>{item}</span>)}
          </div>
        </div>
        <QrVisual />
      </section>

      <section className="ticker" aria-label="QRBeam">
        <div>{t.ticker.map((item, index) => <span key={item}>{item}{index < t.ticker.length - 1 && <i />}</span>)}</div>
      </section>

      <section className="section shell" id="how-it-works">
        <div className="section-heading split-heading">
          <div>
            <span className="kicker">{t.howKicker}</span>
            <h2>{t.howTitle}</h2>
          </div>
          <p>{t.howBody}</p>
        </div>
        <div className="steps-grid">
          <article className="step-card">
            <span className="step-number">01</span>
            <div className="step-symbol terminal-symbol"><b>›_</b></div>
            <h3>{t.steps[0][0]}</h3>
            <p>{t.steps[0][1]}</p>
          </article>
          <article className="step-card featured-step">
            <span className="step-number">02</span>
            <div className="step-symbol play-symbol"><b>▶</b></div>
            <h3>{t.steps[1][0]}</h3>
            <p>{t.steps[1][1]}</p>
          </article>
          <article className="step-card">
            <span className="step-number">03</span>
            <div className="step-symbol phone-symbol"><b /></div>
            <h3>{t.steps[2][0]}</h3>
            <p>{t.steps[2][1]}</p>
          </article>
        </div>
      </section>

      <section className="section shell install-preview" id="install">
        <div className="install-copy">
          <span className="kicker">{t.installKicker}</span>
          <h2>{t.installTitle}</h2>
          <p>{t.installBody}</p>
          <a className="text-link" href={localeHref(locale, "install")}>{t.installLink} <span>→</span></a>
        </div>
        <div className="code-window">
          <div className="window-bar"><span /><span /><span /><b>Terminal</b></div>
          <div className="code-tabs"><span className="active">Python</span><span>Node.js</span></div>
          <pre><span className="comment">{t.comment1}</span>{"\n"}<span className="prompt">$</span> python3 -m pip install --upgrade qrbeam{"\n\n"}<span className="comment">{t.comment2}</span>{"\n"}<span className="prompt">$</span> qrbeam send ./example.zip</pre>
          <div className="code-status"><span>●</span> {t.status}</div>
        </div>
      </section>

      <section className="section shell trust-section">
        <div className="trust-panel">
          <div className="trust-copy">
            <span className="kicker">{t.trustKicker}</span>
            <h2>{t.trustTitle}</h2>
            <p>{t.trustBody}</p>
            <a className="text-link light-link" href={localeHref(locale, "privacy")}>{t.trustLink} <span>→</span></a>
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
          <span className="kicker">{t.supportKicker}</span>
          <h2>{t.supportTitle}</h2>
        </div>
        <a className="button button-dark" href={localeHref(locale, "support")}>{t.supportButton} <span>→</span></a>
      </section>

      <Footer locale={locale} />
    </main>
  );
}

export default function Home() {
  return <LocalizedHome locale="zh" />;
}
