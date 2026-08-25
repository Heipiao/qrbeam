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
      <a className="brand" href={localeHref(locale)} aria-label="QRBeam"><QrMark /><strong>QRBeam</strong></a>
      <nav aria-label="Main navigation">
        <a href={localeHref(locale, "install")}>{t.install}</a>
        <a href={localeHref(locale, "privacy")}>{t.privacy}</a>
        <a href={localeHref(locale, "support")}>{t.support}</a>
      </nav>
      <div className="header-actions">
        <LanguageMenu locale={locale} page={page} />
        <a className="header-cta" href={localeHref(locale, "install")}>{t.start}</a>
      </div>
    </header>
  );
}

export function Footer({ locale = "zh" }: { locale?: Locale }) {
  const t = copy[locale].common;
  return (
    <footer className="footer">
      <div className="shell footer-inner">
        <div className="footer-brand"><a className="brand" href={localeHref(locale)}><QrMark /><strong>QRBeam</strong></a><p>{t.footer}</p></div>
        <div className="footer-links">
          <div><b>{t.product}</b><a href={localeHref(locale, "install")}>{t.installGuide}</a><a href={`${localeHref(locale)}#how-it-works`}>{t.how}</a></div>
          <div><b>{t.help}</b><a href={localeHref(locale, "support")}>{t.techSupport}</a><a href="mailto:lsl8315@163.com">{t.contact}</a></div>
          <div><b>{t.legal}</b><a href={localeHref(locale, "privacy")}>{t.privacyPolicy}</a></div>
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
