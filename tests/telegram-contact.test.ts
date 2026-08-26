import { describe, expect, it } from "vitest";
import { telegramContactUrl } from "../dashboard/lib/telegram-contact.js";

describe("telegramContactUrl", () => {
  it("opens the public profile when a username is available", () => {
    expect(telegramContactUrl({ telegramUserId: 123, username: "@tonymumu" }))
      .toBe("https://t.me/tonymumu?profile");
  });

  it("falls back to Telegram's numeric user link when no username exists", () => {
    expect(telegramContactUrl({ telegramUserId: 123, username: null }))
      .toBe("tg://user?id=123");
  });
});
