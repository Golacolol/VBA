/**
 * Import classic portraits from 2kratings.com (via an already-cleared browser session).
 *
 * Step 1 (this file as server): node scripts/import-2kratings-portraits.mjs --serve
 * Step 2: browser posts {name,b64,ext} to http://127.0.0.1:3847/save
 * Step 3: node scripts/import-2kratings-portraits.mjs --apply  (wire into players.json)
 */
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outDir = path.join(root, "public/assets/portraits/classic");
const playersPath = path.join(root, "public/data/players.json");
const headshotsPath = path.join(root, "scripts/lib/nbaClassicHeadshots.mjs");

const mode = process.argv.includes("--apply")
  ? "apply"
  : process.argv.includes("--serve")
    ? "serve"
    : "help";

function slugify(name) {
  return String(name)
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

function localPathFor(name, ext = "png") {
  return `/assets/portraits/classic/${slugify(name)}.${ext}`;
}

async function serve() {
  fs.mkdirSync(outDir, { recursive: true });
  let saved = 0;
  const server = http.createServer(async (req, res) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS, GET");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    if (req.method === "OPTIONS") {
      res.writeHead(204);
      res.end();
      return;
    }
    if (req.method === "GET" && req.url === "/status") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ saved, outDir }));
      return;
    }
    if (req.method === "POST" && req.url === "/save") {
      const chunks = [];
      for await (const c of req) chunks.push(c);
      try {
        const body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
        const name = String(body.name || "").trim();
        const ext = body.ext === "jpg" ? "jpg" : "png";
        const b64 = String(body.b64 || "");
        if (!name || !b64) {
          res.writeHead(400);
          res.end("bad body");
          return;
        }
        const buf = Buffer.from(b64, "base64");
        if (buf.length < 8000) {
          res.writeHead(400);
          res.end("too small");
          return;
        }
        // PNG/JPEG magic
        const isPng = buf[0] === 0x89 && buf[1] === 0x50;
        const isJpg = buf[0] === 0xff && buf[1] === 0xd8;
        if (!isPng && !isJpg) {
          res.writeHead(400);
          res.end("not image");
          return;
        }
        const file = `${slugify(name)}.${isPng ? "png" : "jpg"}`;
        fs.writeFileSync(path.join(outDir, file), buf);
        saved += 1;
        console.log(`saved ${name} → ${file} (${buf.length})`);
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ ok: true, file, size: buf.length }));
      } catch (e) {
        res.writeHead(500);
        res.end(String(e));
      }
      return;
    }
    res.writeHead(404);
    res.end("not found");
  });
  server.listen(3847, "127.0.0.1", () => {
    console.log("portrait import server on http://127.0.0.1:3847/save");
  });
}

function applyToPlayers() {
  const players = JSON.parse(fs.readFileSync(playersPath, "utf8"));
  const files = new Map();
  for (const f of fs.readdirSync(outDir)) {
    if (!/\.(png|jpg|jpeg|webp)$/i.test(f)) continue;
    files.set(f.replace(/\.(png|jpg|jpeg|webp)$/i, ""), f);
  }

  let linked = 0;
  const localEntries = [];
  for (const p of players) {
    if (!String(p.id).startsWith("classic_")) continue;
    const name = p.appearance?.fullName || p.displayName || p.name;
    if (!name) continue;
    const slug = slugify(name);
    const file = files.get(slug);
    if (!file) continue;
    const rel = `/assets/portraits/classic/${file}`;
    const abs = path.join(outDir, file);
    if (!fs.existsSync(abs) || fs.statSync(abs).size < 8000) continue;
    const existing = p.appearance?.portraitAsset;
    // Prefer new local file over missing/null; keep existing local if already set to this path.
    if (!existing || existing === rel || /cdn\.nba\.com|espncdn\.com/i.test(existing)) {
      p.appearance = { ...(p.appearance || {}), fullName: name, portraitAsset: rel };
      linked += 1;
    } else if (!existing) {
      p.appearance = { ...(p.appearance || {}), fullName: name, portraitAsset: rel };
      linked += 1;
    }
    localEntries.push([name, rel]);
  }

  // Refresh CLASSIC_LOCAL_PORTRAITS block for key forced locals (merge Randy/Ewing/etc.).
  let src = fs.readFileSync(headshotsPath, "utf8");
  const unique = new Map(localEntries);
  // Keep prior forced entries that still exist.
  const forced = {
    "Rick Mahorn": "/assets/portraits/classic/rick-mahorn.jpg",
    "Kenny Smith": "/assets/portraits/classic/kenny-smith.png",
    "Patrick Ewing": "/assets/portraits/classic/patrick-ewing.png",
  };
  for (const [n, rel] of unique) forced[n] = rel;
  const body = Object.entries(forced)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([n, rel]) => `  ${JSON.stringify(n)}: ${JSON.stringify(rel)},`)
    .join("\n");
  src = src.replace(
    /export const CLASSIC_LOCAL_PORTRAITS = \{[\s\S]*?\n\};/,
    `export const CLASSIC_LOCAL_PORTRAITS = {\n${body}\n};`,
  );

  fs.writeFileSync(playersPath, `${JSON.stringify(players, null, 2)}\n`);
  fs.writeFileSync(headshotsPath, src);
  console.log(`Applied portraits to ${linked} classic player records; updated CLASSIC_LOCAL_PORTRAITS (${Object.keys(forced).length} entries)`);
}

if (mode === "serve") serve();
else if (mode === "apply") applyToPlayers();
else {
  console.log(`Usage:
  node scripts/import-2kratings-portraits.mjs --serve
  node scripts/import-2kratings-portraits.mjs --apply`);
}
