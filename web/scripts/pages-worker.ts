import vinextWorker from "../dist/server/index.js";

interface PagesEnv {
  ASSETS: Fetcher;
  IMAGES?: {
    input(stream: ReadableStream): {
      transform(options: Record<string, unknown>): {
        output(options: { format: string; quality: number }): Promise<{ response(): Response }>;
      };
    };
  };
}

interface PagesExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
}

function isStaticAsset(pathname: string): boolean {
  return pathname.startsWith("/_next/") || /\.[a-z0-9]+$/i.test(pathname);
}

export default {
  async fetch(request: Request, env: PagesEnv, context: PagesExecutionContext): Promise<Response> {
    const pathname = new URL(request.url).pathname;

    if (pathname !== "/_vinext/image" && isStaticAsset(pathname)) {
      const asset = await env.ASSETS.fetch(request);
      if (asset.status !== 404) return asset;
    }

    return vinextWorker.fetch(request, env, {
      waitUntil: promise => context.waitUntil(promise),
      // Advanced Mode Pages Functions do not expose passThroughOnException.
      passThroughOnException() {},
    });
  },
};
