import { describe, expect, it } from "vitest";
import { selectedVisibleUser } from "../dashboard/lib/user-selection.js";

describe("filtered user details", () => {
  const visible = [{ telegramUserId: 2, username: "second_user" }];
  it("switches away from a selected user hidden by the search", () => {
    expect(selectedVisibleUser(visible, 1)?.telegramUserId).toBe(2);
  });
  it("clears details when no users match", () => {
    expect(selectedVisibleUser([], 1)).toBeNull();
  });
  it("keeps a selection that is still visible", () => {
    expect(selectedVisibleUser([{ telegramUserId: 1 }, { telegramUserId: 2 }], 2)?.telegramUserId).toBe(2);
  });
});
