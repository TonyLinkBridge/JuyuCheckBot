import { describe, expect, it } from "vitest";
import { loadConfig } from "../src/config.js";

describe("unified bot configuration", () => {
  it("accepts an optional Telegram administrator chat ID", () => {
    const config = loadConfig({
      BOT_TOKEN: "123456789:abcdefghijklmnopqrstuvwxyz",
      ADMIN_CHAT_ID: " 8831664659 ",
    });

    expect(config.ADMIN_CHAT_ID).toBe("8831664659");
  });
});
