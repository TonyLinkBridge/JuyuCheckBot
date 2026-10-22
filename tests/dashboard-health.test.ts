import { afterEach, describe, expect, it, vi } from "vitest";
import { loadBotHealth } from "../dashboard/lib/bot-health.js";
afterEach(() => vi.unstubAllGlobals());
describe("Dashboard live status", () => {
  it("shows unknown when the Bot status endpoint cannot be reached", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("offline"); }));
    expect((await loadBotHealth()).status).toBe("unavailable");
  });
  it("does not accept a generic HTTP 200 or stale status as a passing check", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ ok: true })));
    expect((await loadBotHealth()).status).toBe("unavailable");
  });
  it("displays the failing check even when the endpoint returns HTTP 503", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ ok: false, status: "degraded", checkedAt: new Date().toISOString(),
      checks: { database: "healthy", commerce: "healthy", telegram: "healthy", webhook: "degraded", notifications: "healthy" } }, { status: 503 })));
    expect(await loadBotHealth()).toMatchObject({ status: "degraded", checks: { webhook: "degraded" } });
  });
});
