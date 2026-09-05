// Community candidate: detecting/running user-installed ACP remains supported.
// This module intentionally has no installer, filesystem, or subprocess access.
export const ACP_AUTO_INSTALL_ENABLED = false;

export async function installAcpWithTools() {
  throw Object.assign(new Error("Install the ACP adapter manually, then detect it in settings."), { erReason: "acpmissing" });
}
