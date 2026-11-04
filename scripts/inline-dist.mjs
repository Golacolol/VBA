import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join, posix } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const htmlPath = join(root, "dist", "index.html");
if (!existsSync(htmlPath)) {
  console.error("dist/index.html not found. Run vite build first.");
  process.exit(1);
}

let html = readFileSync(htmlPath, "utf8");

// Drop the source-only file-boot UI (everything from #file-boot through the start of #app).
html = html.replace(/<div id="file-boot"[\s\S]*?(?=<div id="app")/i, "");

// Drop the file:// probe script that only belongs to the source entry.
html = html.replace(
  /<script>\s*\([\s\S]*?location\.protocol\s*!==\s*["']file:["'][\s\S]*?<\/script>/i,
  "",
);

// Drop unused file-boot CSS from the head style block (keep other head styles).
html = html.replace(/#file-boot\s*\{[\s\S]*?\.file-boot-card a\s*\{[\s\S]*?\}\s*/i, "");

/**
 * After inlining CSS into index.html, relative url(...) must resolve from the HTML
 * document (dist/), not from dist/assets/*.css — otherwise half-court.png 404s.
 */
function rewriteCssUrlsForHtml(cssText, stylesheetHref) {
  const href = stylesheetHref.replace(/^\.\//, "").replace(/^\//, "");
  const cssDir = posix.dirname(href); // e.g. "assets"
  const prefix = cssDir && cssDir !== "." ? `${cssDir}/` : "";

  return cssText.replace(/url\(\s*(['"]?)([^'")]+)\1\s*\)/gi, (full, quote, raw) => {
    const target = raw.trim();
    if (!target || /^(data:|https?:|blob:)/i.test(target)) return full;
    // Root-absolute public assets → relative for file:// and Pages.
    if (target.startsWith("/") && !target.startsWith("//")) {
      return `url(${quote}./${target.slice(1)}${quote})`;
    }
    // Already rooted at dist/ (./assets/… or assets/…).
    if (/^(\.\/)?assets\//i.test(target)) return full;
    // Vite emits url(./half-court-HASH.png) next to the CSS file under assets/.
    if (target.startsWith("./")) {
      return `url(${quote}./${prefix}${target.slice(2)}${quote})`;
    }
    if (!target.startsWith("../")) {
      return `url(${quote}./${prefix}${target}${quote})`;
    }
    // ../ from assets/ → dist root
    const resolved = posix.normalize(posix.join(cssDir, target));
    return `url(${quote}./${resolved}${quote})`;
  });
}

const scriptRe = /<script type="module"[^>]*src="([^"]+)"[^>]*><\/script>/g;
html = html.replace(scriptRe, (full, src) => {
  const file = join(root, "dist", src.replace(/^\.\//, ""));
  if (!existsSync(file)) {
    console.warn(`inline-dist: missing script ${src}`);
    return full;
  }
  return `<script type="module">\n${readFileSync(file, "utf8")}\n</script>`;
});

const linkRe = /<link rel="stylesheet"[^>]*href="([^"]+)"[^>]*>/g;
html = html.replace(linkRe, (full, href) => {
  if (/^https?:\/\//i.test(href)) return full;
  const file = join(root, "dist", href.replace(/^\.\//, ""));
  if (!existsSync(file)) {
    console.warn(`inline-dist: missing stylesheet ${href}`);
    return full;
  }
  const css = rewriteCssUrlsForHtml(readFileSync(file, "utf8"), href);
  return `<style>\n${css}\n</style>`;
});

writeFileSync(htmlPath, html);
console.log("Inlined dist/index.html for file:// / static hosting play.");
