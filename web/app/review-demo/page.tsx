import type { Metadata } from "next";
import ReviewDemo from "./review-demo";

export const metadata: Metadata = {
  title: "App Review Demo",
  description: "QRBeam App Review fixture and live QRB1 transfer frames.",
  robots: { index: false, follow: false },
};

export default function ReviewDemoPage() {
  return <ReviewDemo />;
}
