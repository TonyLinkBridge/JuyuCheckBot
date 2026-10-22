import { afterEach, describe, expect, it, vi } from "vitest";
const boundaries = vi.hoisted(() => ({ authorize: vi.fn(), save: vi.fn(), revalidate: vi.fn() }));
vi.mock("../dashboard/lib/auth", () => ({ requireDashboardSession: boundaries.authorize }));
vi.mock("../dashboard/lib/lead-follow-up-store", () => ({ saveLeadFollowUp: boundaries.save }));
vi.mock("../dashboard/node_modules/next/cache.js", () => ({ revalidatePath: boundaries.revalidate }));
import { updateLeadFollowUp } from "../dashboard/app/actions.js";

function form() { const value = new FormData(); value.set("leadId", "14"); value.set("revision", "1"); value.set("status", "following"); value.set("notes", "待回复"); return value; }
afterEach(() => vi.resetAllMocks());
describe("Dashboard follow-up authorization boundary", () => {
  it("never writes when the signed server session is absent or invalid", async () => {
    boundaries.authorize.mockRejectedValue(new Error("login required"));
    await expect(updateLeadFollowUp({ status: "idle" }, form())).rejects.toThrow("login required");
    expect(boundaries.save).not.toHaveBeenCalled();
  });
  it("does not save invalid input or report a stale edit as saved", async () => {
    const invalid = form(); invalid.set("leadId", "legacy:14");
    expect((await updateLeadFollowUp({ status: "idle" }, invalid)).status).toBe("error");
    expect(boundaries.save).not.toHaveBeenCalled();
    boundaries.save.mockResolvedValue("conflict");
    const result = await updateLeadFollowUp({ status: "idle" }, form());
    expect(result.status).toBe("error"); expect(result.message).toContain("刷新");
    expect(boundaries.revalidate).not.toHaveBeenCalled();
  });
  it("refreshes the Lead view after a confirmed save only", async () => {
    boundaries.save.mockResolvedValue("saved");
    expect(await updateLeadFollowUp({ status: "idle" }, form())).toMatchObject({ status: "saved" });
    expect(boundaries.save).toHaveBeenCalledWith({ leadId: 14, revision: 1, status: "following", notes: "待回复", isTest: false });
    expect(boundaries.revalidate).toHaveBeenCalledWith("/leads");
  });
  it("treats an interrupted save as unknown, not as proof that nothing changed", async () => {
    boundaries.save.mockResolvedValue("unavailable");
    const result = await updateLeadFollowUp({ status: "idle" }, form());
    expect(result.status).toBe("error");
    expect(result.message).toContain("无法确认是否保存");
    expect(result.message).not.toContain("未被覆盖");
    expect(boundaries.revalidate).not.toHaveBeenCalled();
  });
});
