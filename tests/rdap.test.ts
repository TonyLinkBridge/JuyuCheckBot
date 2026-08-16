import { afterEach, describe, expect, it, vi } from "vitest";
import { checkRdapWithRetry } from "../src/domain/rdap.js";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("checkRdapWithRetry", () => {
  it("retries a transient failure and returns the next valid response", async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new Error("temporary network failure"))
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            events: [{ eventAction: "registration", eventDate: "2010-01-01T00:00:00Z" }],
            status: ["active"],
          }),
          { status: 200, headers: { "Content-Type": "application/rdap+json" } },
        ),
      );
    vi.stubGlobal("fetch", fetchMock);

    const result = await checkRdapWithRetry("example.com", 4000);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result.status).toBe("registered");
    expect(result.createdAt).toEqual(new Date("2010-01-01T00:00:00Z"));
  });
});
