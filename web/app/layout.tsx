import type { Metadata } from "next";
import { headers } from "next/headers";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export async function generateMetadata(): Promise<Metadata> {
  const incoming = await headers();
  const host = incoming.get("x-forwarded-host") ?? incoming.get("host") ?? "localhost:3000";
  const protocol = incoming.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return {
    title: { default: "QRBeam — 屏幕到相机的本地文件传输", template: "%s | QRBeam" },
    description: "用动态二维码把小文件从电脑传到 iPhone。无需登录、数据线或云端上传。",
    metadataBase: new URL(`${protocol}://${host}`),
    icons: { icon: "/icon.png", apple: "/icon.png" },
    openGraph: { title: "QRBeam — 让文件从屏幕跃入手机", description: "屏幕到相机的本地文件传输。无需登录、数据线或云端上传。", type: "website", locale: "zh_CN", images: [{ url: "/og.png", width: 1730, height: 909, alt: "QRBeam 本地文件传输" }] },
    twitter: { card: "summary_large_image", title: "QRBeam — 让文件从屏幕跃入手机", description: "屏幕到相机的本地文件传输。", images: ["/og.png"] },
  };
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="zh-CN"><body className={`${geistSans.variable} ${geistMono.variable}`}>{children}</body></html>;
}
