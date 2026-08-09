import type { Metadata } from "next";
import { copy, type Locale } from "../i18n";
import { PageShell } from "../site-components";

export const metadata: Metadata = { title: "QRBeam 隐私政策", description: "了解 QRBeam 如何在设备本地处理文件、相机画面与订阅信息。" };

function PolicyText({ text }: { text: string }) {
  const [before, after] = text.split("lsl8315@163.com");
  return <p>{before}{after !== undefined && <><a href="mailto:lsl8315@163.com">lsl8315@163.com</a>{after}</>}</p>;
}

export function LocalizedPrivacy({ locale }: { locale: Locale }) {
  const t = copy[locale].privacy;
  return (
    <PageShell eyebrow={t.eyebrow} title={t.title} description={t.description} locale={locale} page="privacy">
      <section className="content-shell shell legal-layout" lang={locale}>
        <aside className="legal-summary"><span className="summary-icon">✓</span><h2>{t.summary}</h2><ul>{t.bullets.map(item => <li key={item}>{item}</li>)}</ul></aside>
        <article className="legal-copy">{t.sections.map((section, index) => <section key={section[0]}><span>{String(index + 1).padStart(2, "0")}</span><div><h2>{section[0]}</h2><PolicyText text={section[1]} /></div></section>)}</article>
      </section>
    </PageShell>
  );
}

export default function PrivacyPage() { return <LocalizedPrivacy locale="zh" />; }
