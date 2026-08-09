import Link from "next/link";

export function QrMark() {
  return <span className="brand-mark" aria-hidden="true"><i /><i /><i /><b /></span>;
}

export function Header() {
  return (
    <header className="site-header shell">
      <Link className="brand" href="/" aria-label="QRBeam 首页"><QrMark /><strong>QRBeam</strong></Link>
      <nav aria-label="主导航">
        <Link href="/install">安装</Link>
        <Link href="/privacy">隐私</Link>
        <Link href="/support">支持</Link>
      </nav>
      <Link className="header-cta" href="/install">立即开始</Link>
    </header>
  );
}

export function Footer() {
  return (
    <footer className="footer">
      <div className="shell footer-inner">
        <div className="footer-brand"><Link className="brand" href="/"><QrMark /><strong>QRBeam</strong></Link><p>屏幕到相机的本地文件传输。</p></div>
        <div className="footer-links">
          <div><b>产品</b><Link href="/install">安装指南</Link><Link href="/#how-it-works">工作方式</Link></div>
          <div><b>帮助</b><Link href="/support">技术支持</Link><a href="mailto:lsl8315@163.com">联系我们</a></div>
          <div><b>法律</b><Link href="/privacy">隐私政策</Link></div>
        </div>
      </div>
      <div className="shell footer-bottom"><span>© 2026 QRBeam</span><span>Made for files that should stay close.</span></div>
    </footer>
  );
}

export function PageShell({ eyebrow, title, description, children }: { eyebrow: string; title: string; description: string; children: React.ReactNode }) {
  return (
    <main>
      <Header />
      <section className="page-hero shell">
        <span className="kicker">{eyebrow}</span>
        <h1>{title}</h1>
        <p>{description}</p>
      </section>
      {children}
      <Footer />
    </main>
  );
}
