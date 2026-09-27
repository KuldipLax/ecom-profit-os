export async function fetchWithRetry(
  input: RequestInfo | URL,
  init: RequestInit = {},
  opts: { retries?: number; timeoutMs?: number } = {},
) {
  const retries = opts.retries ?? 3;
  const timeoutMs = opts.timeoutMs ?? 20000;
  let last: unknown;

  for (let i = 0; i <= retries; i++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const abortParent = () => controller.abort();
    init.signal?.addEventListener("abort", abortParent, { once: true });

    try {
      const r = await fetch(input, { ...init, signal: controller.signal });
      if ((r.status === 429 || r.status >= 500) && i < retries) {
        const wait =
          Number(r.headers.get("retry-after") ?? 0) * 1000 ||
          Math.min(1000 * 2 ** i, 8000);
        await new Promise((resolve) => setTimeout(resolve, wait));
        continue;
      }
      return r;
    } catch (error) {
      last = error;
      if (i < retries) {
        await new Promise((resolve) => setTimeout(resolve, Math.min(1000 * 2 ** i, 8000)));
        continue;
      }
    } finally {
      clearTimeout(timer);
      init.signal?.removeEventListener("abort", abortParent);
    }
  }

  throw last instanceof Error ? last : new Error("Network request failed.");
}
