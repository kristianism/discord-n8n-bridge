import { describe, expect, it } from "vitest";
import { ConfigError } from "../src/errors.js";
import {
  formatStartupError,
  startupSecretsFromEnv,
} from "../src/startup-error.js";

describe("startup error formatting", () => {
  it("redacts a configured secret when config loading fails", () => {
    const secret = "k7";
    const secrets = startupSecretsFromEnv({
      N8N_AUTH_HEADER_VALUE: secret,
    });

    const output = JSON.parse(
      formatStartupError(new ConfigError(`Invalid config: ${secret}`), secrets),
    ) as { level: string; msg: string };

    expect(output).toEqual({
      level: "error",
      msg: "Invalid config: [redacted]",
    });
  });

  it("redacts a configured secret from fatal startup errors", () => {
    const secret = "k7";
    const secrets = startupSecretsFromEnv({
      N8N_AUTH_HEADER_VALUE: secret,
    });

    const output = JSON.parse(
      formatStartupError(new Error(`startup failed: ${secret}`), secrets),
    ) as { level: string; msg: string; err: { name: string; message: string } };

    expect(output).toEqual({
      level: "error",
      msg: "fatal startup error",
      err: { name: "Error", message: "startup failed: [redacted]" },
    });
  });
});
