import type { Metadata } from "next";
import { PageShell } from "../site-components";

export const metadata: Metadata = {
  title: "QRBeam 隐私政策",
  description: "了解 QRBeam 如何在设备本地处理文件、相机画面与订阅信息。",
};

export default function PrivacyPage() {
  return (
    <PageShell eyebrow="PRIVACY" title="隐私不是设置项，是默认值。" description="QRBeam 的核心设计很简单：传输发生在你眼前，也留在你的设备上。最后更新：2026 年 8 月 9 日。">
      <section className="content-shell shell legal-layout">
        <aside className="legal-summary"><span className="summary-icon">✓</span><h2>简要说明</h2><ul><li>不创建账户</li><li>不上传所选文件</li><li>不收集二维码内容</li><li>不投放广告或跨应用追踪</li></ul></aside>
        <article className="legal-copy">
          <section><span>01</span><div><h2>适用范围</h2><p>本政策适用于 QRBeam iOS 应用、Python / Node.js 命令行发送端，以及本官网。使用第三方软件包仓库、Apple App Store 或外部链接时，对应服务商的隐私政策也可能适用。</p></div></section>
          <section><span>02</span><div><h2>文件与二维码</h2><p>你选择发送或接收的文件在设备本地处理。电脑发送端仅在 <code>127.0.0.1</code> 启动播放器，不会把文件或二维码帧上传到 QRBeam 服务器。接收端会在本机组装文件，并使用 CRC32 与 SHA-256 检查完整性。</p></div></section>
          <section><span>03</span><div><h2>相机</h2><p>iOS 应用请求相机权限，只用于扫描 QRBeam 动态二维码。QRBeam 不会把相机画面上传到服务器，也不会将相机画面用于身份识别、广告或分析。</p></div></section>
          <section><span>04</span><div><h2>本地数据</h2><p>应用可能在设备上保存执行免费版限制所需的每日发送次数、设置和会员状态。已接收文件仅在你选择保存或分享时写入设备；删除应用或文件后，QRBeam 无法为你恢复。</p></div></section>
          <section><span>05</span><div><h2>订阅与付款</h2><p>订阅购买和恢复由 Apple StoreKit 处理。QRBeam 会读取提供会员权益所需的订阅状态，但不会取得或保存你的完整银行卡信息。付款数据由 Apple 按其政策处理。</p></div></section>
          <section><span>06</span><div><h2>官网数据</h2><p>官网当前不提供账户、广告、行为分析或营销 Cookie。网站托管服务商可能为安全、故障排查和稳定运行处理标准请求信息，例如 IP 地址、浏览器类型与访问时间。</p></div></section>
          <section><span>07</span><div><h2>安全边界</h2><p>QRBeam 会验证文件完整性，但当前传输协议不提供端到端加密。请只传输你有权处理的文件，并遵守所在组织的安全与数据管理要求。</p></div></section>
          <section><span>08</span><div><h2>联系我们</h2><p>如果你对隐私政策有疑问，请发送邮件至 <a href="mailto:lsl8315@163.com">lsl8315@163.com</a>。政策更新后，我们会在本页面修改“最后更新”日期。</p></div></section>
        </article>
      </section>
    </PageShell>
  );
}
