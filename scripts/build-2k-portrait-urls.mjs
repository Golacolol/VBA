import fs from "node:fs";

const names = fs
  .readFileSync("/tmp/missing-classic-names.txt", "utf8")
  .trim()
  .split(/\n/)
  .filter((l) => l && !l.startsWith("COUNT"));

function candidates(name) {
  const clean = name.replace(/\./g, "").replace(/'/g, "").trim();
  const hyphen = clean.replace(/\s+/g, "-");
  return [...new Set([`${hyphen}.png`, `${hyphen}.jpg`])];
}

const map = {};
for (const n of names) {
  map[n] = candidates(n).map((f) => `https://www.2kratings.com/wp-content/uploads/${f}`);
}
fs.writeFileSync("/tmp/2k-portrait-urls.json", JSON.stringify(map, null, 2));
console.log(names.length, "players", Object.values(map).flat().length, "urls");
