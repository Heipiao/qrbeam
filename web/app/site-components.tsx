import Link from "next/link";
import { copy, localeHref, type Locale } from "./i18n";
import { LanguageMenu, LanguageRedirect } from "./language-menu";

export function QrMark() {
  return <span className="brand-mark" aria-hidden="true"><i /><i /><i /><b /></span>;
}

export function Header({ locale = "zh", page = "" }: { locale?: Locale; page?: string }) {
  const t = copy[locale].common;
  return (
    <header className="site-header shell">
      <LanguageRedirect />
      <Link className="brand" href={localeHref(locale)} aria-label="QRBeam"><QrMark /><strong>QRBeam</strong></Link>
      <nav aria-label="Main navigation">
        <Link href={localeHref(locale, "install")}>{t.install}</Link>
        <Link href={localeHref(locale, "privacy")}>{t.privacy}</Link>
        <Link href={localeHref(locale, "support")}>{t.support}</Link>
      </nav>
      <div className="header-actions">
        <LanguageMenu locale={locale} page={page} />
        <Link className="header-cta" href={localeHref(locale, "install")}>{t.start}</Link>
      </div>
    </header>
  );
}

export function Footer({ locale = "zh" }: { locale?: Locale }) {
  const t = copy[locale].common;
  return (
    <footer className="footer">
      <div className="shell footer-inner">
        <div className="footer-brand"><Link className="brand" href={localeHref(locale)}><QrMark /><strong>QRBeam</strong></Link><p>{t.footer}</p></div>
        <div className="footer-links">
          <div><b>{t.product}</b><Link href={localeHref(locale, "install")}>{t.installGuide}</Link><Link href={`${localeHref(locale)}#how-it-works`}>{t.how}</Link></div>
          <div><b>{t.help}</b><Link href={localeHref(locale, "support")}>{t.techSupport}</Link><a href="mailto:lsl8315@163.com">{t.contact}</a></div>
          <div><b>{t.legal}</b><Link href={localeHref(locale, "privacy")}>{t.privacyPolicy}</Link></div>
        </div>
      </div>
      <div className="shell footer-bottom"><span>© 2026 QRBeam</span><span>{t.footerNote}</span></div>
    </footer>
  );
}

export function PageShell({ eyebrow, title, description, locale = "zh", page, children }: { eyebrow: string; title: string; description: string; locale?: Locale; page: string; children: React.ReactNode }) {
  return (
    <main>
      <Header locale={locale} page={page} />
      <section className="page-hero shell">
        <span className="kicker">{eyebrow}</span>
        <h1>{title}</h1>
        <p>{description}</p>
      </section>
      {children}
      <Footer locale={locale} />
    </main>
  );
}
