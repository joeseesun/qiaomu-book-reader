import path from "node:path";

export function buildProfile(name = "standard", root = process.cwd()) {
  if (!["standard", "community"].includes(name)) throw new Error(`Unknown build profile: ${name}`);
  return {
    name,
    outputDir: name === "community" ? path.join(root, "dist", "community") : root,
    plugins: name === "community" ? [{
      name: "community-manual-acp",
      setup(build) {
        build.onResolve({ filter: /^\.\/ai-acp-installer\.js$/ }, () => ({ path: path.join(root, "src", "ai-acp-manual.js") }));
      },
    }] : [],
  };
}
