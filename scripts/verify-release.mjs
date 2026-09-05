import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";
import { buildProfile } from "./build-profile.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const profileArg = args.find((arg) => arg.startsWith("--profile="));
const profile = buildProfile(profileArg?.slice("--profile=".length) || "standard", root);
const installArg = args.find((arg) => !arg.startsWith("--"));
const installDir = installArg ? path.resolve(installArg) : "";
const releaseFiles = ["main.js", "manifest.json", "styles.css"];
const bundledFonts = [
  {
    file: "fonts/SourceHanSerifCN-Regular.otf.gz",
    family: "QBR Source Han Serif CN",
    sourceSha256: "3754ea669c530e2473354f8f6d9f79680a44d7e26ec7d00eeabee4a7e0753c5d",
  },
  {
    file: "fonts/SourceHanSansCN-Regular.otf.gz",
    family: "QBR Source Han Sans CN",
    sourceSha256: "e2bc8a2e7f37474b774fff8db758681ece40bb6947a90d571bce9dd60671a8e4",
  },
  {
    file: "fonts/LXGWWenKaiGBScreen-Regular.ttf.gz",
    family: "QBR LXGW WenKai GB Screen",
    sourceSha256: "23ec023913e1851925eb94462c4b0ccd1d78bb89533745aaa8cc682ccd339dc0",
  },
  {
    file: "fonts/LXGWZhenKaiGB-Regular.ttf.gz",
    family: "QBR LXGW ZhenKai GB",
    sourceSha256: "40876902a7ce25268ab710ad8fe6e2b63bc002aa4b68d22fd45fc1243726ced5",
  },
  {
    file: "fonts/ZhuqueFangsong-Regular.ttf.gz",
    family: "QBR Zhuque Fangsong",
    sourceSha256: "558c62730844fe54ba220146ed62f859d4e2880188d92d985f8921c6e3743bc4",
  },
];

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function sha256(file) {
  return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
}

function requireCheck(condition, message) {
  if (!condition) throw new Error(message);
}

const pkg = readJson(path.join(root, "package.json"));
const manifest = readJson(path.join(profile.outputDir, "manifest.json"));
const versions = readJson(path.join(root, "versions.json"));

requireCheck(manifest.id === "qiaomu-book-reader", `unexpected plugin id: ${manifest.id}`);
requireCheck(pkg.version === manifest.version, "package.json and manifest.json versions differ");
requireCheck(versions[manifest.version] === manifest.minAppVersion, "versions.json is missing the current release");

const assets = Object.fromEntries(releaseFiles.map((name) => {
  const file = path.join(profile.outputDir, name);
  requireCheck(fs.existsSync(file), `missing release asset: ${name}`);
  requireCheck(fs.statSync(file).size > 0, `empty release asset: ${name}`);
  return [name, { bytes: fs.statSync(file).size, sha256: sha256(file) }];
}));

const mainSource = fs.readFileSync(path.join(profile.outputDir, "main.js"), "utf8");
requireCheck(mainSource.includes(`Build channel: ${profile.name}`), "bundle channel does not match verification profile");
if (profile.name === "community") {
  const info = readJson(path.join(profile.outputDir, "build-info.json"));
  requireCheck(info.profile === "community", "community build metadata missing");
  requireCheck(info.inputs.includes("src/ai-acp-manual.js"), "manual ACP module is missing");
  requireCheck(!info.inputs.includes("src/ai-acp-installer.js"), "community bundle includes the dependency installer");
  requireCheck(!mainSource.includes("ACP installed but its executable was not found"), "installer execution code leaked into the community bundle");
}
const fontPayloads = bundledFonts.map(({ file, family, sourceSha256 }) => {
  const archive = path.join(root, file);
  requireCheck(fs.existsSync(archive), `missing bundled font source: ${file}`);
  const source = zlib.gunzipSync(fs.readFileSync(archive));
  const actualSourceHash = crypto.createHash("sha256").update(source).digest("hex");
  requireCheck(actualSourceHash === sourceSha256, `bundled font source hash differs: ${file}`);
  requireCheck(mainSource.includes(family), `main.js is missing bundled font family: ${family}`);
  return { file, bytes: fs.statSync(archive).size, sourceSha256 };
});
requireCheck(mainSource.includes("SIL OPEN FONT LICENSE Version 1.1"), "main.js is missing the bundled font license");

if (installDir) {
  const installedManifest = readJson(path.join(installDir, "manifest.json"));
  requireCheck(installedManifest.id === manifest.id, "installed plugin id differs from the build");
  requireCheck(installedManifest.version === manifest.version, "installed plugin version differs from the build");
  for (const name of releaseFiles) {
    const installed = path.join(installDir, name);
    requireCheck(fs.existsSync(installed), `installed asset missing: ${name}`);
    requireCheck(sha256(installed) === assets[name].sha256, `installed asset hash differs: ${name}`);
  }
}

console.log(JSON.stringify({
  ok: true,
  profile: profile.name,
  id: manifest.id,
  version: manifest.version,
  minAppVersion: manifest.minAppVersion,
  installVerified: Boolean(installDir),
  assets,
  fontPayloads,
}, null, 2));
