export async function fetchWithRetry(
  input: RequestInfo | URL,
  init: RequestInit = {},
  opts: { retries?: number; timeoutMs?: number } = {},
) {
  const retries = opts.retries ?? 3;
  const timeoutMs = opts.timeoutMs ?? 20000;
  let last: unknown;

  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(
        input,
        init.signal ? init : { ...init, signal: controller.signal },
      );

      if ((response.status === 429 || response.status >= 500) && attempt < retries) {
        const wait =
          Number(response.headers.get("retry-after") ?? 0) * 1000 ||
          Math.min(1000 * 2 ** attempt, 8000);
        clearTimeout(timer);
        await new Promise((resolve) => setTimeout(resolve, wait));
        continue;
      }

      clearTimeout(timer);
      return response;
    } catch (error) {
      last =
        error instanceof Error && error.name === "AbortError"
          ? new Error("Upstream request timed out.")
          : error;

      clearTimeout(timer);
      if (attempt < retries) {
        await new Promise((resolve) => setTimeout(resolve, Math.min(1000 * 2 ** attempt, 8000)));
        continue;
      }
    }
  }

  throw last instanceof Error ? last : new Error("Network request failed.");
}
