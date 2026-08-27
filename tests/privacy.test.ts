import { describe, expect, it } from "vitest";
import { privacyBotText, privacyHtml } from "../src/privacy.js";

describe("unified Bot privacy notice", () => {
  it("discloses voluntary Lead details and their deletion behavior", () => {
    const html = privacyHtml("JUYU 域名体检");

    expect(privacyBotText).toContain("购买、注册、出售或咨询资料");
    expect(privacyBotText).toContain("联系方式");
    expect(privacyBotText).not.toContain("不会保存 Bot Token、密码或其他私人聊天内容");
    expect(html).toContain("新版 Lead");
    expect(html).toContain("未完成会话");
  });
});
