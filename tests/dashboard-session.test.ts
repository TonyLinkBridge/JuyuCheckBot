import { describe, expect, it } from "vitest";
import { issueSessionToken, verifySessionToken } from "../dashboard/lib/session-token.js";

describe("Dashboard session tokens", () => {
  const password = "a-long-private-test-password";
  it("expires on the server, not just in the browser cookie", () => {
    const token = issueSessionToken(password, 1000);
    expect(verifySessionToken(token, password, 1001)).toBe(true);
    expect(verifySessionToken(token, password, 1000 + 7 * 86400000)).toBe(false);
  });
  it("rejects modified tokens and tokens signed before a password change", () => {
    const token = issueSessionToken(password, 1000);
    expect(verifySessionToken(token + "x", password, 1001)).toBe(false);
    expect(verifySessionToken(token, "another-private-password", 1001)).toBe(false);
    expect(verifySessionToken("legacy-static-cookie", password, 1001)).toBe(false);
  });
  it("issues different sessions for separate logins", () => {
    expect(issueSessionToken(password, 1000)).not.toBe(issueSessionToken(password, 1000));
  });
});
