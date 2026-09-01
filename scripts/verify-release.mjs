import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const installDir = process.argv[2] ? path.resolve(process.argv[2]) : "";
const releaseFiles = ["main.js", "manifest.json", "styles.css"];

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
const manifest = readJson(path.join(root, "manifest.json"));
const versions = readJson(path.join(root, "versions.json"));

requireCheck(manifest.id === "qiaomu-book-reader", `unexpected plugin id: ${manifest.id}`);
requireCheck(pkg.version === manifest.version, "package.json and manifest.json versions differ");
requireCheck(versions[manifest.version] === manifest.minAppVersion, "versions.json is missing the current release");

const assets = Object.fromEntries(releaseFiles.map((name) => {
  const file = path.join(root, name);
  requireCheck(fs.existsSync(file), `missing release asset: ${name}`);
  requireCheck(fs.statSync(file).size > 0, `empty release asset: ${name}`);
  return [name, { bytes: fs.statSync(file).size, sha256: sha256(file) }];
}));

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
  id: manifest.id,
  version: manifest.version,
  minAppVersion: manifest.minAppVersion,
  installVerified: Boolean(installDir),
  assets,
}, null, 2));
