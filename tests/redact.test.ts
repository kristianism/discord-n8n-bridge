import { describe, expect, it } from "vitest";
import { redactSecrets, redactUrl, toLogError } from "../src/redact.js";

describe("redaction", () => {
  it("redacts extra secrets and discord token patterns", () => {
    const token = "ingress-secret-value";
    const discordShaped =
      "abcdefghijklmnopqrstuvwx.abcdef.abcdefghijklmnopqrstuvwxyz12345";
    const input = `Authorization: Bot ${discordShaped} header=${token}`;
    const redacted = redactSecrets(input, [token]);
    expect(redacted).not.toContain(token);
    expect(redacted).not.toContain(discordShaped);
    expect(redacted).toContain("[redacted]");
  });

  it("logs webhook origin without the path", () => {
    expect(redactUrl("https://n8n.example.com/webhook/secret-path")).toBe(
      "https://n8n.example.com",
    );
  });

  it("redacts secrets inside error messages", () => {
    const secret = "ingress-secret-value";
    const error = toLogError(new Error(`failed ${secret}`), [secret]);
    expect(error.message).not.toContain(secret);
    expect(error.name).toBe("Error");
  });
});
