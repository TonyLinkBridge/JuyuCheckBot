import { afterEach, describe, expect, it, vi } from "vitest";
import { checkAhrefs, checkCrux, checkTranco, checkWayback } from "../src/domain/intelligence.js";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("third-party domain intelligence", () => {
  it("returns the latest exact Tranco rank", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({
      ranks: [
        { date: "2026-08-15", rank: 50 },
        { date: "2026-08-16", rank: 42 },
      ],
    }), { status: 200 })));

    const result = await checkTranco("example.com", 1000);

    expect(result).toMatchObject({ status: "available", rank: 42, rankedAt: "2026-08-16" });
  });

  it("does not call CrUX or Ahrefs without their free API keys", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(checkCrux("example.com", undefined, 1000)).resolves.toMatchObject({ status: "not_configured" });
    await expect(checkAhrefs("example.com", undefined, 1000)).resolves.toMatchObject({ status: "not_configured" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("parses Google CrUX p75 field data", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({
      record: {
        collectionPeriod: {
          firstDate: { year: 2026, month: 7, day: 20 },
          lastDate: { year: 2026, month: 8, day: 16 },
        },
        metrics: {
          largest_contentful_paint: { percentiles: { p75: 1800 } },
          interaction_to_next_paint: { percentiles: { p75: 150 } },
          cumulative_layout_shift: { percentiles: { p75: 0.05 } },
        },
      },
    }), { status: 200 })));

    const result = await checkCrux("example.com", "free-google-key", 1000);

    expect(result).toMatchObject({
      status: "available",
      lcpP75Ms: 1800,
      inpP75Ms: 150,
      clsP75: 0.05,
      periodStart: "2026-07-20",
      periodEnd: "2026-08-16",
    });
  });

  it("parses free Ahrefs Domain Rating", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({
      domain_rating: { domain_rating: 93, license: "https://ahrefs.com/legal/domain-rating-license" },
    }), { status: 200 })));

    await expect(checkAhrefs("example.com", "free-ahrefs-key", 1000)).resolves.toMatchObject({
      status: "available",
      domainRating: 93,
    });
  });

  it("parses first and latest Wayback captures", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify([
        ["timestamp", "original"],
        ["19960101000000", "https://example.com/"],
      ]), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify([
        ["timestamp", "original"],
        ["20260801000000", "https://example.com/"],
      ]), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await checkWayback("example.com", 1000);

    expect(result.status).toBe("available");
    expect(result.firstCaptureAt?.getUTCFullYear()).toBe(1996);
    expect(result.latestCaptureAt?.getUTCFullYear()).toBe(2026);
  });
});
