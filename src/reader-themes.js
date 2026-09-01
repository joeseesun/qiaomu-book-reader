export const READER_THEMES = {
  auto: {
    label: "跟随 Obsidian",
    bg: "var(--background-primary)",
    text: "var(--text-normal)",
    ui: "var(--background-secondary)",
    border: "var(--background-modifier-border)",
    accent: "var(--interactive-accent)",
    muted: "var(--text-muted)",
  },
  paper: {
    label: "纸白",
    bg: "#f8f6f0",
    text: "#24231f",
    ui: "#efebe2",
    border: "#dcd5c8",
    accent: "#4f6758",
    muted: "#746f66",
  },
  warm: {
    label: "暖纸",
    bg: "#f3ebdd",
    text: "#30291f",
    ui: "#e9decb",
    border: "#d5c5ab",
    accent: "#755d3c",
    muted: "#776b59",
  },
  celadon: {
    label: "青瓷",
    bg: "#eaf0e8",
    text: "#243029",
    ui: "#dfe8dd",
    border: "#c6d3c4",
    accent: "#4f6d5a",
    muted: "#667269",
  },
  night: {
    label: "夜间",
    bg: "#181a1b",
    text: "#d9d7d1",
    ui: "#222526",
    border: "#383c3d",
    accent: "#91ab9a",
    muted: "#9a9a94",
  },
  eink: {
    label: "电子墨水",
    bg: "#ffffff",
    text: "#000000",
    ui: "#ffffff",
    border: "#000000",
    accent: "#000000",
    muted: "#444444",
  },
};

export const READER_THEME_CHOICES = ["auto", "paper", "warm", "celadon", "night", "eink"];

export function migrateReaderTheme(value) {
  if (value === "light") return "paper";
  if (value === "sepia") return "warm";
  if (value === "dark") return "night";
  return READER_THEMES[value] ? value : "auto";
}
