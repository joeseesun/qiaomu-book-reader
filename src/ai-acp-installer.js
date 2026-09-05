// Standard distribution only. The community build replaces this entire module
// with ai-acp-manual.js, so no dependency installation code ships in that build.
export const ACP_AUTO_INSTALL_ENABLED = true;
const installs = new Map();

export async function installAcpWithTools(id, options, tools) {
  const { cliMeta, cliError, runtime, resolveLocalTool, runProcess, acpNpmInstallArgs, managedAcpEntrypoint, resolveAcpPath } = tools;
  const meta = cliMeta(id);
  if (!meta?.acpAutoInstall || !meta.acpInstallPackage) {
    throw cliError("notconfigured", "Automatic ACP installation is unavailable");
  }
  if (installs.has(id)) return installs.get(id);
  const task = (async () => {
    const { fs, os, path } = runtime();
    const installRoot = String(options.installRoot || "").trim();
    if (!installRoot || !path.isAbsolute(installRoot)) {
      throw cliError("installlocation", "A private ACP install directory is required");
    }
    fs.mkdirSync(installRoot, { recursive: true, mode: 0o700 });
    const nodePath = await resolveLocalTool("node", { ...options, configuredPath: options.nodePath });
    if (!nodePath) throw cliError("nodemissing", "Node.js was not found");
    const nodeVersion = await runProcess({ command: nodePath, args: ["--version"], stdin: "", cwd: os.tmpdir() }, {
      timeoutMs: 10_000, signal: options.signal,
    });
    const nodeMajor = Number(String(nodeVersion.stdout || "").replace(/^v/, "").split(".")[0]);
    if (!Number.isFinite(nodeMajor) || nodeMajor < (meta.acpMinNodeMajor || 0)) {
      throw cliError("nodeversion", `Node.js ${meta.acpMinNodeMajor}+ is required`, { erNodeMajor: nodeMajor || 0 });
    }
    const npmPath = await resolveLocalTool("npm", { ...options, configuredPath: options.npmPath });
    if (!npmPath) throw cliError("npmmissing", "npm was not found");
    const delimiter = window.process.platform === "win32" ? ";" : ":";
    const installPath = [path.dirname(nodePath), window.process.env.PATH || ""].filter(Boolean).join(delimiter);
    try {
      await runProcess({ command: npmPath, args: acpNpmInstallArgs(id, installRoot), stdin: "", cwd: os.tmpdir() }, {
        timeoutMs: options.timeoutMs || 300_000, signal: options.signal, env: { PATH: installPath },
      });
    } catch (error) {
      const detail = `${error?.erStderr || ""}\n${error?.erStdout || ""}`;
      const reason = /EACCES|EPERM|permission denied|operation not permitted/i.test(detail) ? "installpermission"
        : /ENOTFOUND|EAI_AGAIN|getaddrinfo|network|socket|ECONN/i.test(detail) ? "installnetwork"
          : error?.erReason === "timeout" ? "timeout" : "installfailed";
      throw cliError(reason, "ACP installation failed", { erStatus: error?.erStatus });
    }
    const hintedPath = managedAcpEntrypoint(id, installRoot, path);
    const acpPath = await resolveAcpPath(id, hintedPath, { ...options, installRoot });
    if (!acpPath) throw cliError("installverify", "ACP installed but its executable was not found");
    return { acpPath, npmPath, nodePath, nodeMajor, installRoot, version: meta.acpInstallVersion };
  })();
  installs.set(id, task);
  try { return await task; }
  finally { installs.delete(id); }
}
