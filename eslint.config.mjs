import obsidianmd from "eslint-plugin-obsidianmd";

// The community scanner runs this rule set against the repository and publishes
// the result as a Scorecard, so warnings matter as much as errors here.
export default [
  {
    ignores: ["main.js", "pdf.worker.js", "node_modules/**", "promo-video/**"],
  },
  ...obsidianmd.configs.recommended,
  {
    files: ["src/**/*.js"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      globals: {
        // Replaced at build time by esbuild's `define` with the pdf.js worker
        // source, so it never exists as a variable in the shipped file.
        __PDF_WORKER_CODE__: "readonly",
        // CSS Custom Highlight API, used for the in-book search paint.
        Highlight: "readonly",
        // Provided by Obsidian at runtime rather than imported.
        activeDocument: "readonly",
        activeWindow: "readonly",
        document: "readonly",
        window: "readonly",
        globalThis: "readonly",
        console: "readonly",
        setTimeout: "readonly",
        clearTimeout: "readonly",
        setInterval: "readonly",
        clearInterval: "readonly",
        requestAnimationFrame: "readonly",
        DOMParser: "readonly",
        FileReader: "readonly",
        Node: "readonly",
        NodeFilter: "readonly",
        HTMLElement: "readonly",
        Event: "readonly",
        ResizeObserver: "readonly",
        performance: "readonly",
        fetch: "readonly",
        Blob: "readonly",
        URL: "readonly",
      },
    },
    rules: {
      "obsidianmd/ui/sentence-case": ["warn", {
        mode: "loose",
        brands: ["Qiaomu Book Reader", "Obsidian Sync", "Remotely Save"],
        ignoreRegex: ["^swayinfo/elton-reader$"],
      }],
    },
  },
];
