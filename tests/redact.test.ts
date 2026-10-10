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

  it("redacts configured secrets shorter than eight characters", () => {
    const secret = "k7";
    expect(redactSecrets(`header=${secret}`, [secret])).toBe(
      "header=[redacted]",
    );
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

  it("redacts short secrets inside error messages", () => {
    const secret = "k7";
    const error = toLogError(new Error(`failed ${secret}`), [secret]);
    expect(error.message).toBe("failed [redacted]");
  });

  it("redacts configured secrets inside error names", () => {
    const secret = "k7";
    const source = new Error("failed");
    source.name = `Error-${secret}`;

    expect(toLogError(source, [secret]).name).toBe("Error-[redacted]");
  });
});
