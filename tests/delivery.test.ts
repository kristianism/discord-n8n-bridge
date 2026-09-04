import { describe, expect, it, vi } from "vitest";
import { DeliveryService } from "../src/delivery.js";
import { buildEnvelope } from "../src/envelope.js";
import { inboundMessage, silentLogger, testConfig } from "./helpers.js";

function jsonResponse(status: number): Response {
  return new Response("{}", {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("webhook delivery", () => {
  it("POSTs the envelope with auth and idempotency headers", async () => {
    const fetchMock = vi.fn(async () => jsonResponse(200));
    const delivery = new DeliveryService(testConfig(), silentLogger(), {
      fetch: fetchMock,
      sleep: async () => undefined,
      random: () => 0,
    });
    const envelope = buildEnvelope(
      "discord.message.created",
      inboundMessage(),
      "test-instance",
      new Date("2026-01-02T03:05:00.000Z"),
    );

    await delivery.deliver(envelope);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const call = fetchMock.mock.calls[0] as
      | [string, RequestInit]
      | undefined;
    expect(call).toBeDefined();
    if (call === undefined) {
      throw new Error("expected fetch to be called");
    }
    const [url, init] = call;
    expect(url).toBe("https://n8n.example.com/webhook/ingress");
    expect(init).toMatchObject({ method: "POST" });
    const headers = new Headers(init?.headers);
    expect(headers.get("content-type")).toBe("application/json");
    expect(headers.get("X-Discord-Ingress-Key")).toBe("ingress-secret-value");
    expect(headers.get("idempotency-key")).toBe(envelope.idempotency_key);
    expect(JSON.parse(String(init?.body))).toMatchObject({
      event_type: "discord.message.created",
      spec_version: "1.0",
    });
  });

  it("retries retryable HTTP statuses and succeeds", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse(503))
      .mockResolvedValueOnce(jsonResponse(200));
    const sleep = vi.fn(async () => undefined);
    const delivery = new DeliveryService(testConfig(), silentLogger(), {
      fetch: fetchMock,
      sleep,
      random: () => 0,
    });

    await delivery.deliver(
      buildEnvelope(
        "discord.message.created",
        inboundMessage(),
        "test-instance",
        new Date(),
      ),
    );

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenCalledTimes(1);
  });

  it("does not retry a 400 response", async () => {
    const fetchMock = vi.fn(async () => jsonResponse(400));
    const delivery = new DeliveryService(testConfig(), silentLogger(), {
      fetch: fetchMock,
      sleep: async () => undefined,
      random: () => 0,
    });

    await delivery.deliver(
      buildEnvelope(
        "discord.message.created",
        inboundMessage(),
        "test-instance",
        new Date(),
      ),
    );

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("retries network failures up to the configured attempt limit", async () => {
    const fetchMock = vi.fn(async () => {
      throw new TypeError("fetch failed");
    });
    const delivery = new DeliveryService(
      testConfig({ retryMaxAttempts: 3 }),
      silentLogger(),
      {
        fetch: fetchMock,
        sleep: async () => undefined,
        random: () => 0,
      },
    );

    await delivery.deliver(
      buildEnvelope(
        "discord.message.created",
        inboundMessage(),
        "test-instance",
        new Date(),
      ),
    );

    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("bounds concurrent in-flight deliveries", async () => {
    let active = 0;
    let maxActive = 0;
    const fetchMock = vi.fn(async () => {
      active += 1;
      maxActive = Math.max(maxActive, active);
      await new Promise((resolve) => {
        setTimeout(resolve, 20);
      });
      active -= 1;
      return jsonResponse(200);
    });
    const delivery = new DeliveryService(
      testConfig({ maxInFlightDeliveries: 2 }),
      silentLogger(),
      {
        fetch: fetchMock,
        sleep: async () => undefined,
        random: () => 0,
      },
    );
    const envelope = buildEnvelope(
      "discord.message.created",
      inboundMessage(),
      "test-instance",
      new Date(),
    );

    await Promise.all([
      delivery.deliver(envelope),
      delivery.deliver(envelope),
      delivery.deliver(envelope),
    ]);

    expect(maxActive).toBeLessThanOrEqual(2);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });
});
