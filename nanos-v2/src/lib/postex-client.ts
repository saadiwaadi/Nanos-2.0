const BASE = (process.env.POSTEX_BASE_URL || "https://api.postex.pk").replace(/\/+$/, "");
const PREFIX = "/services/integration/api";

export class PostexError extends Error {
  constructor(
    public code: "CONFIG" | "AUTH" | "REQUEST" | "SERVER" | "TIMEOUT" | "NETWORK",
    message: string,
    public retryable: boolean,
    public status?: number
  ) {
    super(message);
    this.name = "PostexError";
  }
}

export function postexToken(): string {
  const t = (process.env.POSTEX_API_TOKEN ?? "").trim().replace(/^["']|["']$/g, "");
  if (!t) throw new PostexError("CONFIG", "POSTEX_API_TOKEN is not set on this server", false);
  return t;
}

export async function postexFetch<T = any>(
  path: string,
  opts: { method?: string; body?: unknown; timeoutMs?: number } = {}
): Promise<T> {
  const token = postexToken();
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), opts.timeoutMs ?? 15000);
  try {
    const res = await fetch(`${BASE}${PREFIX}${path}`, {
      method: opts.method ?? "GET",
      headers: { token, "Content-Type": "application/json" },
      body: opts.body ? JSON.stringify(opts.body) : undefined,
      signal: ctrl.signal,
      cache: "no-store",
    });
    const text = await res.text();
    let json: any;
    try {
      json = JSON.parse(text);
    } catch {
      json = { raw: text };
    }
    const msg = String(json?.statusMessage || json?.message || text.slice(0, 200));
    const looksAuth =
      res.status === 401 ||
      res.status === 403 ||
      (/token/i.test(msg) && /invalid|expired/i.test(msg));
    if (looksAuth)
      throw new PostexError("AUTH", `PostEx rejected the token: ${msg}`, false, res.status);
    if (res.status === 429 || res.status >= 500)
      throw new PostexError("SERVER", `PostEx error ${res.status}: ${msg}`, true, res.status);
    if (!res.ok) throw new PostexError("REQUEST", msg, false, res.status);
    // PostEx sometimes returns HTTP 200 with statusCode "400" in the body
    if (json?.statusCode !== undefined && String(json.statusCode) !== "200")
      throw new PostexError("REQUEST", msg, false, res.status);
    return json as T;
  } catch (e: any) {
    if (e instanceof PostexError) throw e;
    if (e?.name === "AbortError") throw new PostexError("TIMEOUT", "PostEx timed out", true);
    throw new PostexError("NETWORK", String(e?.message ?? e), true);
  } finally {
    clearTimeout(timer);
  }
}
