import type { Metadata } from "next";
import { copy, type Locale } from "../i18n";
import { PageShell } from "../site-components";

export const metadata: Metadata = { title: "QRBeam 技术支持", description: "获取 QRBeam 安装、传输与 iPhone 扫描问题的帮助。" };

export function LocalizedSupport({ locale }: { locale: Locale }) {
  const t = copy[locale].support;
  return (
    <PageShell eyebrow={t.eyebrow} title={t.title} description={t.description} locale={locale} page="support">
      <section className="content-shell shell" lang={locale}>
        <div className="contact-grid">
          <a className="contact-card" href="mailto:lsl8315@163.com"><span className="contact-icon">@</span><div><span>{t.email}</span><h2>lsl8315@163.com</h2><p>{t.emailHint}</p></div><b>↗</b></a>
          <a className="contact-card" href="#quick-fixes"><span className="contact-icon">?</span><div><span>{t.selfHelp}</span><h2>{t.faqTitle}</h2><p>{t.faqHint}</p></div><b>↓</b></a>
        </div>
        <section className="faq-section" id="quick-fixes">
          <div className="section-heading split-heading"><div><span className="kicker">QUICK FIXES</span><h2>{t.faqTitle}</h2></div><p>{t.faqIntro}</p></div>
          <div className="faq-list">{t.faqs.map((faq, index) => <details key={faq[0]} open={index === 0}><summary><span>{String(index + 1).padStart(2, "0")}</span>{faq[0]}<b>＋</b></summary><p>{faq[1]}</p></details>)}</div>
        </section>
        <section className="report-panel"><div><span className="kicker">REPORT AN ISSUE</span><h2>{t.report}</h2><p>{t.reportBody}</p></div><ul>{t.reportItems.map(item => <li key={item}>{item}</li>)}</ul></section>
      </section>
    </PageShell>
  );
}

export default function SupportPage() { return <LocalizedSupport locale="zh" />; }
