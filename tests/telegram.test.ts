import { describe, expect, it } from "vitest";
import { TELEGRAM_ALLOWED_UPDATES } from "../src/telegram.js";

describe("Telegram update configuration", () => {
  it("subscribes the webhook to inline sharing queries", () => {
    expect(TELEGRAM_ALLOWED_UPDATES).toContain("inline_query");
    expect(TELEGRAM_ALLOWED_UPDATES).toContain("message");
    expect(TELEGRAM_ALLOWED_UPDATES).toContain("callback_query");
  });
});
