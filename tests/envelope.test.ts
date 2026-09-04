import { describe, expect, it } from "vitest";
import { buildEnvelope, buildIdempotencyKey } from "../src/envelope.js";
import { inboundMessage } from "./helpers.js";

describe("event envelope", () => {
  it("builds a created event with a create idempotency key", () => {
    const message = inboundMessage({ content: "" });
    const envelope = buildEnvelope(
      "discord.message.created",
      message,
      "test-instance",
      new Date("2026-01-02T03:05:00.000Z"),
    );

    expect(envelope.spec_version).toBe("1.0");
    expect(envelope.event_type).toBe("discord.message.created");
    expect(envelope.instance_id).toBe("test-instance");
    expect(envelope.message.content).toBe("");
    expect(envelope.message.edited_timestamp).toBeNull();
    expect(envelope.idempotency_key).toBe(`${message.id}:create`);
    expect(envelope.event_id).toBe(envelope.idempotency_key);
    expect(envelope.occurred_at).toBe("2026-01-02T03:04:05.000Z");
    expect(envelope.ingested_at).toBe("2026-01-02T03:05:00.000Z");
  });

  it("preserves edits as a separate event with an edited timestamp key", () => {
    const created = inboundMessage({ content: "first" });
    const edited = inboundMessage({
      content: "second",
      editedTimestamp: Date.parse("2026-01-02T03:06:07.000Z"),
    });

    const createdEnvelope = buildEnvelope(
      "discord.message.created",
      created,
      "test-instance",
      new Date("2026-01-02T03:04:06.000Z"),
    );
    const editedEnvelope = buildEnvelope(
      "discord.message.edited",
      edited,
      "test-instance",
      new Date("2026-01-02T03:06:08.000Z"),
    );

    expect(createdEnvelope.event_type).toBe("discord.message.created");
    expect(editedEnvelope.event_type).toBe("discord.message.edited");
    expect(createdEnvelope.idempotency_key).not.toBe(
      editedEnvelope.idempotency_key,
    );
    expect(editedEnvelope.idempotency_key).toBe(
      `${edited.id}:2026-01-02T03:06:07.000Z`,
    );
    expect(editedEnvelope.occurred_at).toBe("2026-01-02T03:06:07.000Z");
    expect(editedEnvelope.message.content).toBe("second");
  });

  it("keeps empty content when an edit only changes attachments", () => {
    const message = inboundMessage({
      content: "",
      editedTimestamp: Date.parse("2026-01-02T04:00:00.000Z"),
      attachments: [
        {
          id: "att-1",
          filename: "file.png",
          contentType: "image/png",
          size: 12,
          url: "https://cdn.discordapp.com/file.png",
          proxyUrl: "https://media.discordapp.net/file.png",
        },
      ],
    });
    const envelope = buildEnvelope(
      "discord.message.edited",
      message,
      "test-instance",
      new Date("2026-01-02T04:00:01.000Z"),
    );
    expect(envelope.message.content).toBe("");
    expect(envelope.message.attachments).toHaveLength(1);
  });

  it("uses the thread channel id as the routable channel and preserves parent_id", () => {
    const message = inboundMessage({
      channelId: "333333333333333333",
      parentId: "222222222222222222",
      isThread: true,
    });
    const envelope = buildEnvelope(
      "discord.message.created",
      message,
      "test-instance",
      new Date("2026-01-02T03:05:00.000Z"),
    );
    expect(envelope.source.channel_id).toBe("333333333333333333");
    expect(envelope.source.parent_id).toBe("222222222222222222");
    expect(envelope.source.thread).toBe(true);
  });

  it("builds a stable idempotency key from message id and edited timestamp", () => {
    const message = inboundMessage({
      editedTimestamp: Date.parse("2026-01-02T03:06:07.000Z"),
    });
    expect(buildIdempotencyKey(message, "discord.message.edited")).toBe(
      `${message.id}:2026-01-02T03:06:07.000Z`,
    );
    expect(buildIdempotencyKey(message, "discord.message.edited")).toBe(
      buildIdempotencyKey(message, "discord.message.edited"),
    );
  });

  it("does not reuse a create idempotency key for an edit without an edited timestamp", () => {
    const message = inboundMessage({ editedTimestamp: null });
    expect(buildIdempotencyKey(message, "discord.message.created")).toBe(
      `${message.id}:create`,
    );
    expect(buildIdempotencyKey(message, "discord.message.edited")).toBe(
      `${message.id}:unknown`,
    );
  });
});
