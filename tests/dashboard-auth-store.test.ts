import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { reserveLoginAttempt, saveSession, sessionExists, revokeSession } from "../dashboard/lib/auth-store.js";

beforeEach(() => {
  vi.stubEnv("SUPABASE_URL", "https://current.example.test");
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "private-test-key");
});
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

describe("server-backed Dashboard auth", () => {
  it("fails closed if the shared login throttle cannot be read", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("offline", { status: 503 })));
    expect(await reserveLoginAttempt("opaque-bucket")).toBe("unavailable");
  });
  it("honours the database's cross-instance login lock", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Response.json([{ allowed: false }])));
    expect(await reserveLoginAttempt("opaque-bucket")).toBe("limited");
  });
  it("never stores the browser bearer token itself", async () => {
    const requests: string[] = [];
    vi.stubGlobal("fetch", vi.fn(async (_url: string, init: RequestInit) => {
      requests.push(String(init.body)); return new Response(null, { status: 201 });
    }));
    expect(await saveSession("raw-bearer-token")).toBe(true);
    expect(requests[0]).not.toContain("raw-bearer-token");
    expect(JSON.parse(requests[0]!).token_hash).toMatch(/^[a-f0-9]{64}$/);
  });
  it("checks server-side revocation as well as the signed cookie", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Response.json([])));
    expect(await sessionExists("test-token")).toBe(false);
  });
  it("targets only the current session on logout", async () => {
    const calls: Array<{ url: string; method: string }> = [];
    vi.stubGlobal("fetch", vi.fn(async (url: string, init: RequestInit) => {
      calls.push({ url, method: String(init.method) }); return new Response(null, { status: 204 });
    }));
    expect(await revokeSession("test-token")).toBe(true);
    expect(calls).toHaveLength(1);
    expect(calls[0]?.method).toBe("DELETE");
    expect(calls[0]?.url).toMatch(/token_hash=eq\.[a-f0-9]{64}$/);
  });
});
