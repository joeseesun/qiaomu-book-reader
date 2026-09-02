export function deriveAiSetupState({
  provider,
  transport = "http",
  base = "",
  model = "",
  needsKey = false,
  key = "",
  desktop = true,
  needsVerification = false,
  enabled = false,
} = {}) {
  if (!provider) {
    return { kind: "unconfigured", ready: false, enabled: false, reason: "provider" };
  }
  if (transport === "cli" && !desktop) {
    return { kind: "needs-attention", ready: false, enabled: false, reason: "desktop" };
  }
  if (transport !== "cli" && !base) {
    return { kind: "incomplete", ready: false, enabled: false, reason: "base" };
  }
  if (transport !== "cli" && !model) {
    return { kind: "incomplete", ready: false, enabled: false, reason: "model" };
  }
  if (transport !== "cli" && needsKey && !key) {
    return { kind: "incomplete", ready: false, enabled: false, reason: "key" };
  }
  if (needsVerification) {
    return { kind: "incomplete", ready: false, enabled: false, reason: "verify" };
  }
  return {
    kind: enabled ? "ready" : "disabled",
    ready: true,
    enabled: enabled === true,
    reason: "",
  };
}
