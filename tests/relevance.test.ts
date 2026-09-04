import { describe, expect, it } from "vitest";
import { isRelevantMessageEdit } from "../src/relevance.js";
import { inboundMessage } from "./helpers.js";

describe("message edit relevance", () => {
  it("skips an update when content, attachments, and embeds are unchanged", () => {
    const oldMessage = inboundMessage({ content: "same" });
    const newMessage = inboundMessage({ content: "same" });
    expect(isRelevantMessageEdit(oldMessage, newMessage)).toBe(false);
  });

  it("delivers when content changes", () => {
    const oldMessage = inboundMessage({ content: "before" });
    const newMessage = inboundMessage({ content: "after" });
    expect(isRelevantMessageEdit(oldMessage, newMessage)).toBe(true);
  });

  it("delivers when attachments change even if content is empty", () => {
    const oldMessage = inboundMessage({ content: "" });
    const newMessage = inboundMessage({
      content: "",
      attachments: [
        {
          id: "att-1",
          filename: "a.png",
          contentType: "image/png",
          size: 1,
          url: "https://cdn.discordapp.com/a.png",
          proxyUrl: "https://media.discordapp.net/a.png",
        },
      ],
    });
    expect(isRelevantMessageEdit(oldMessage, newMessage)).toBe(true);
  });

  it("delivers when embeds change even if content is empty", () => {
    const oldMessage = inboundMessage({ content: "" });
    const newMessage = inboundMessage({
      content: "",
      embeds: [
        {
          title: "Title",
          description: "Desc",
          url: "https://example.com",
          type: "rich",
        },
      ],
    });
    expect(isRelevantMessageEdit(oldMessage, newMessage)).toBe(true);
  });

  it("treats a missing or partial old message as potentially relevant", () => {
    const newMessage = inboundMessage({ content: "hello" });
    expect(isRelevantMessageEdit(null, newMessage)).toBe(true);
    expect(
      isRelevantMessageEdit(inboundMessage({ partial: true }), newMessage),
    ).toBe(true);
  });
});
