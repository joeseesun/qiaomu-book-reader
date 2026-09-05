// Shared by desktop and mobile. Keep unfinished input local to this control;
// an earlier failed request must never overwrite a newly typed follow-up.
export function bindAiComposer(input, send, chat, { blurOnSend = false, onDraftChange = () => {} } = {}) {
  let composing = false;
  let pending = false;
  let revision = 0;
  const isComposing = (event) => composing || event?.isComposing || event?.keyCode === 229;
  const resize = () => {
    if (input.tagName !== "TEXTAREA") return;
    input.setCssProps({ height: "auto" });
    input.setCssProps({ height: `${Math.min(input.scrollHeight, 128)}px` });
  };
  const refresh = () => { resize(); chat._setSending(!!chat.busy); };
  const submit = async (providedQuestion) => {
    if (chat.busy || composing || pending) return;
    const question = providedQuestion || input.value.trim();
    if (!question) return;
    const sentRevision = revision;
    pending = true;
    if (blurOnSend) input.blur();
    input.value = "";
    refresh();
    let accepted = false;
    try { accepted = await chat._send(question); }
    catch { /* Keep the question available when a provider rejects unexpectedly. */ }
    if (!accepted && revision === sentRevision && !input.value) input.value = question;
    onDraftChange(input.value, { settled: true });
    pending = false;
    refresh();
  };
  input.addEventListener("compositionstart", () => { composing = true; });
  input.addEventListener("compositionend", () => { composing = false; });
  input.addEventListener("input", () => { revision += 1; onDraftChange(input.value); refresh(); });
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
  return { isComposing, refresh, submit, get pending() { return pending; } };
}
