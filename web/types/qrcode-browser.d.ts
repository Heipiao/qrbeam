declare module "qrcode/lib/browser" {
  import type * as QRCode from "qrcode";

  const QRCodeBrowser: typeof QRCode;
  export default QRCodeBrowser;
}
