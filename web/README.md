# QRBeam 官网

QRBeam 的产品官网，包含：

- 产品首页
- Python / Node.js 安装指南
- 隐私政策
- 技术支持

## 本地运行

需要 Node.js 22.13 或更高版本。

```bash
npm install
npm run dev
```

## 验证

```bash
npm test
```

## Cloudflare Pages

仓库已包含 Pages Functions Advanced Mode 配置，以支持服务端渲染和全部多语言路由。

Cloudflare Pages 的 Git 构建设置：

- Production branch：`main`
- Root directory：`web`
- Build command：`npm run build:pages`
- Build output directory：`dist/pages`
- Node.js：`22.13.0` 或更高版本

`wrangler.jsonc` 会为 Pages Functions 启用 `nodejs_compat`。也可以从本地直接预览或部署：

```bash
npm run preview:pages
npm run deploy:pages
```
