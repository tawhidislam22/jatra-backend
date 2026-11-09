const fs = require("node:fs");
const path = require("node:path");

const generatedRoot = path.resolve(__dirname, "../src/generated/prisma");

const resolveSpecifier = (fileDir, specifier) => {
  if (!specifier.startsWith(".") || /\.(js|json|node)$/.test(specifier)) {
    return specifier;
  }

  if (fs.existsSync(path.resolve(fileDir, `${specifier}.ts`))) {
    return `${specifier}.js`;
  }

  if (fs.existsSync(path.resolve(fileDir, specifier, "index.ts"))) {
    return `${specifier.replace(/\/$/, "")}/index.js`;
  }

  return specifier;
};

const walk = (dir) => {
  if (!fs.existsSync(dir)) return [];

  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) return walk(fullPath);
    return entry.isFile() && entry.name.endsWith(".ts") ? [fullPath] : [];
  });
};

for (const filePath of walk(generatedRoot)) {
  const fileDir = path.dirname(filePath);
  const source = fs.readFileSync(filePath, "utf8");
  const updated = source.replace(
    /(from\s+["'])(\.[^"']+)(["'])/g,
    (_match, prefix, specifier, suffix) =>
      `${prefix}${resolveSpecifier(fileDir, specifier)}${suffix}`,
  );

  if (updated !== source) {
    fs.writeFileSync(filePath, updated);
  }
}
