import { readFileSync } from "node:fs";

const viewsRoot = new URL("../views/", import.meta.url);
const cache = new Map<string, string>();

function loadView(name: string) {
  const existing = cache.get(name);
  if (existing) {
    return existing;
  }
  const template = readFileSync(new URL(name, viewsRoot), "utf8");
  cache.set(name, template);
  return template;
}

export function renderTemplate(name: string, values: Record<string, string>) {
  const template = loadView(name);
  return template.replace(/\{\{([a-zA-Z0-9_]+)\}\}/g, (_, key: string) => values[key] ?? "");
}

