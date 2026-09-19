import { readFileSync } from "node:fs";
import { join } from "node:path";
import ejs from "ejs";

const viewsDir = join(import.meta.dir, "..", "views");
const cache = new Map<string, string>();

export function renderView(name: string, locals: Record<string, unknown>) {
  let template = cache.get(name);
  if (!template) {
    template = readFileSync(join(viewsDir, `${name}.ejs`), "utf8");
    cache.set(name, template);
  }
  return ejs.render(template, locals, {
    filename: join(viewsDir, `${name}.ejs`)
  });
}
