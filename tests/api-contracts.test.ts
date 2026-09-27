import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

function appApiPathFromUrl(url: string) {
  const normalized = url
    .replace(/\$\{[^}]+\}/g, "[param]")
    .split("?")[0]
    .replace(/\/$/, "");
  const parts = normalized.split("/").filter(Boolean).slice(1);
  const routeParts = parts.map((part) => part === "[param]" ? "[businessId]" : part);
  return path.join(process.cwd(), "app", "api", ...routeParts, "route.ts");
}

describe("API route contract", () => {
  it("has a route for every API endpoint referenced by application components", () => {
    const roots = [path.join(process.cwd(), "app"), path.join(process.cwd(), "components")];
    const files: string[] = [];
    const walk = (dir: string) => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        if (entry.name === "node_modules" || entry.name === ".next") continue;
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) walk(full);
        else if (/\.(ts|tsx)$/.test(entry.name)) files.push(full);
      }
    };
    roots.forEach(walk);
    const referenced = new Set<string>();
    for (const file of files) {
      const source = fs.readFileSync(file, "utf8");
      for (const match of source.matchAll(/[\x27\x60"](\/api\/[^\x27\x60"? ]+)/g)) referenced.add(match[1]);
    }
    const missing = [...referenced].filter((url) => !fs.existsSync(appApiPathFromUrl(url)));
    expect(missing).toEqual([]);
  });
});
