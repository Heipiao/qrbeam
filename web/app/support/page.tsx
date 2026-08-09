import type { Metadata } from "next";
import { PageShell } from "../site-components";

export const metadata: Metadata = {
  title: "QRBeam 技术支持",
  description: "获取 QRBeam 安装、传输与 iPhone 扫描问题的帮助。",
};

const fixes = [
  ["找不到 qrbeam 命令", "关闭并重新打开终端。Python 用户可运行 python3 -m pip show qrbeam，Node.js 用户可运行 npm list --global qrbeam 检查安装位置。"],
  ["浏览器没有自动打开", "复制终端显示的本地地址到浏览器，通常是 http://127.0.0.1:8765。也可去掉 --no-open 后重新运行。"],
  ["端口已被占用", "指定另一个端口，例如 qrbeam send FILE --port 8766。播放器仍然只监听本机。"],
  ["扫描速度慢或识别不稳", "先使用默认 safe 模式。将浏览器全屏、提高屏幕亮度，避免反光，并让 iPhone 与屏幕保持稳定。"],
  ["传输一直没有完成", "动态二维码会循环播放，缺失帧会在下一轮补齐。保持应用在前台；如果进度长时间不变，重新开始并缩短扫描距离。"],
  ["文件无法发送", "确认文件存在且不超过 5 MiB。免费版在 iPhone 内还可能受每日次数与单文件 1 MiB 限制。"],
];

export default function SupportPage() {
  return (
    <PageShell eyebrow="SUPPORT" title="把问题留给我们，把文件带走。" description="先看看常见解决办法；如果仍然卡住，可以直接通过邮件联系我们。">
      <section className="content-shell shell">
        <div className="contact-grid">
          <a className="contact-card" href="mailto:lsl8315@163.com"><span className="contact-icon">@</span><div><span>邮件支持</span><h2>lsl8315@163.com</h2><p>适合账户、订阅或不便公开的问题</p></div><b>↗</b></a>
          <a className="contact-card" href="#quick-fixes"><span className="contact-icon">?</span><div><span>自助排查</span><h2>常见问题</h2><p>快速解决安装、端口和扫描问题</p></div><b>↓</b></a>
        </div>

        <section className="faq-section" id="quick-fixes">
          <div className="section-heading split-heading"><div><span className="kicker">QUICK FIXES</span><h2>常见问题</h2></div><p>QRBeam 不需要网络传输文件，但首次安装软件包仍需要网络连接。</p></div>
          <div className="faq-list">
            {fixes.map(([question, answer], index) => <details key={question} open={index === 0}><summary><span>{String(index + 1).padStart(2, "0")}</span>{question}<b>＋</b></summary><p>{answer}</p></details>)}
          </div>
        </section>

        <section className="report-panel">
          <div><span className="kicker">REPORT AN ISSUE</span><h2>让问题更快被定位</h2><p>联系我们时，请附上这些信息。不要发送你正在传输的文件本身，除非你确认可以公开分享。</p></div>
          <ul><li>QRBeam 版本（运行 <code>qrbeam --version</code>）</li><li>电脑系统与 Python / Node.js 版本</li><li>iPhone 型号与 iOS 版本</li><li>完整错误文字或问题出现的步骤</li></ul>
        </section>
      </section>
    </PageShell>
  );
}
