import { describe, expect, it } from "vitest";
import { dashboardSections, getDashboardSection, isDashboardSection } from "../dashboard/lib/dashboard-sections.js";

describe("dashboard section routing", () => {
  it("defines a real route for every primary workspace page", () => {
    expect(dashboardSections.map((section) => section.href)).toEqual([
      "/inbox",
      "/users",
      "/funnel",
      "/sources",
      "/quality",
      "/activity",
      "/settings",
    ]);
  });

  it("accepts known sections and rejects arbitrary route values", () => {
    expect(isDashboardSection("inbox")).toBe(true);
    expect(isDashboardSection("quality")).toBe(true);
    expect(isDashboardSection("everything-on-one-page")).toBe(false);
  });

  it("returns the page label used by the dashboard header", () => {
    expect(getDashboardSection("sources")).toMatchObject({ label: "来源分析", eyebrow: "ACQUISITION" });
  });
});
