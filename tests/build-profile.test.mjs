import assert from "node:assert/strict";
import path from "node:path";
import vm from "node:vm";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";
import { buildProfile } from "../scripts/build-profile.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

async function compiled(entry, profileName) {
  const profile = buildProfile(profileName, root);
  const result = await build({
    absWorkingDir: root, entryPoints: [entry], bundle: true, format: "cjs",
    write: false, metafile: true, plugins: profile.plugins,
  });
  const module = { exports: {} };
  vm.runInNewContext(result.outputFiles[0].text, { module, window: { process: { platform: "darwin", env: { PATH: "/usr/bin" } } } });
  return { api: module.exports, inputs: Object.keys(result.metafile.inputs), code: result.outputFiles[0].text };
}

test("build profiles isolate output and reject unknown distribution names", () => {
  assert.equal(buildProfile("standard", root).outputDir, root);
  assert.equal(buildProfile("community", root).outputDir, path.join(root, "dist/community"));
  assert.throws(() => buildProfile("commmunity", root), /Unknown build profile/);
});

test("community build excludes the installer module, even if an internal caller requests installation", async () => {
  const community = await compiled("src/ai-cli.js", "community");
  const standard = await compiled("src/ai-cli.js", "standard");
  assert.ok(community.inputs.includes("src/ai-acp-manual.js"));
  assert.ok(!community.inputs.includes("src/ai-acp-installer.js"));
  assert.ok(standard.inputs.includes("src/ai-acp-installer.js"));
  assert.doesNotMatch(community.code, /ACP installed but its executable was not found/);
  assert.match(standard.code, /ACP installed but its executable was not found/);
  for (const id of standard.api.CLI_AI_PROVIDER_IDS) {
    const manual = community.api.cliAcpSupport(id);
    const normal = standard.api.cliAcpSupport(id);
    assert.equal(manual.autoInstall, false);
    for (const key of ["supported", "mode", "binary", "installCommand", "installUrl", "community"]) {
      assert.equal(manual[key], normal[key], `${id} retains ${key}`);
    }
  }
  assert.equal(standard.api.cliAcpSupport("claude-cli").autoInstall, true);
  assert.equal(standard.api.cliAcpSupport("zcode-cli").autoInstall, true);
  assert.equal(typeof community.api.resolveAcpPath, "function");
  assert.equal(typeof community.api.probeCliAcp, "function");
  assert.equal(typeof community.api.runCliAi, "function");
  await assert.rejects(community.api.installCliAcp("claude-cli", { installRoot: "/not-a-real-install" }), (error) => error.erReason === "acpmissing");
  await assert.rejects(community.api.installCliAcp("zcode-cli", { installRoot: "/not-a-real-install" }), (error) => error.erReason === "acpmissing");
});

test("extracted standard installer preserves pinned install, permissions, and error classification", async () => {
  const { api } = await compiled("src/ai-acp-installer.js", "standard");
  const commands = [];
  const dirs = [];
  let failure;
  const meta = { acpAutoInstall: true, acpInstallPackage: "example-acp", acpInstallVersion: "1.2.3", acpMinNodeMajor: 22 };
  const services = {
    cliMeta: () => meta,
    cliError: (erReason, message, extra) => Object.assign(new Error(message), { erReason }, extra),
    runtime: () => ({ fs: { mkdirSync: (...args) => dirs.push(args) }, os: { tmpdir: () => "/temporary" }, path }),
    resolveLocalTool: async (name) => `/bin/${name}`,
    runProcess: async (command) => {
      commands.push(command);
      if (command.command === "/bin/node") return { stdout: "v22.10.0" };
      if (failure) throw failure;
      return { stdout: "" };
    },
    acpNpmInstallArgs: () => ["install", "--prefix", "/private/acp", "example-acp@1.2.3"],
    managedAcpEntrypoint: () => "/private/acp/index.js",
    resolveAcpPath: async (_id, hint) => hint,
  };
  const result = await api.installAcpWithTools("example", { installRoot: "/private/acp" }, services);
  assert.equal(result.version, "1.2.3");
  assert.equal(result.acpPath, "/private/acp/index.js");
  assert.equal(dirs[0][1].mode, 0o700);
  assert.equal(commands.filter((command) => command.command === "/bin/npm").length, 1);
  for (const [erStderr, reason] of [["EACCES", "installpermission"], ["ENOTFOUND", "installnetwork"]]) {
    failure = { erStderr };
    await assert.rejects(api.installAcpWithTools("example", { installRoot: "/private/acp" }, services), (error) => error.erReason === reason);
  }
  await assert.rejects(api.installAcpWithTools("example", { installRoot: "relative" }, services), (error) => error.erReason === "installlocation");
});
