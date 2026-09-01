export function createOpenAiSseParser(onDelta) {
  let buffer = "";
  let done = false;

  const emitBlock = (block) => {
    for (const line of block.split("\n")) {
      if (!line.startsWith("data:")) continue;
      const raw = line.slice(5).trim();
      if (!raw) continue;
      if (raw === "[DONE]") {
        done = true;
        continue;
      }
      let data;
      try { data = JSON.parse(raw); } catch { continue; }
      const delta = data?.choices?.[0]?.delta || {};
      const content = typeof delta.content === "string" ? delta.content : "";
      const reasoning = typeof delta.reasoning_content === "string"
        ? delta.reasoning_content
        : typeof delta.reasoning === "string"
          ? delta.reasoning
          : "";
      if (content || reasoning) onDelta({ content, reasoning });
    }
  };

  return {
    push(chunk) {
      if (done) return;
      buffer += String(chunk || "").replaceAll("\r\n", "\n");
      let splitAt;
      while ((splitAt = buffer.indexOf("\n\n")) !== -1) {
        emitBlock(buffer.slice(0, splitAt));
        buffer = buffer.slice(splitAt + 2);
      }
    },
    finish() {
      if (!done && buffer.trim()) emitBlock(buffer);
      buffer = "";
      return done;
    },
  };
}
