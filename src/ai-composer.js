// Shared by desktop and mobile. Keep unfinished input local to this control;
// an earlier failed request must never overwrite a newly typed follow-up.
export function bindAiComposer(input, send, chat, { blurOnSend = false } = {}) {
  let composing = false;
  let revision = 0;
  const isComposing = (event) => composing || event?.isComposing || event?.keyCode === 229;
  const resize = () => {
    if (input.tagName !== "TEXTAREA") return;
    input.setCssProps({ height: "auto" });
    input.setCssProps({ height: `${Math.min(input.scrollHeight, 128)}px` });
  };
  const refresh = () => { resize(); chat._setSending(!!chat.busy); };
  const submit = async () => {
    if (chat.busy || composing) return;
    const question = input.value.trim();
    if (!question) return;
    const sentRevision = revision;
    if (blurOnSend) input.blur();
    input.value = "";
    refresh();
    const accepted = await chat._send(question);
    if (!accepted && revision === sentRevision && !input.value) input.value = question;
    refresh();
  };
  input.addEventListener("compositionstart", () => { composing = true; });
  input.addEventListener("compositionend", () => { composing = false; });
  input.addEventListener("input", () => { revision += 1; refresh(); });
  input.addEventListener("keydown", (event) => {
    if (event.defaultPrevented || isComposing(event)) return;
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void submit();
    }
  });
  send.addEventListener("click", () => {
    if (chat.busy) {
      if (chat.canCancel) chat.abortController?.abort();
      return;
    }
    void submit();
  });
  refresh();
  return { isComposing, refresh };
}
