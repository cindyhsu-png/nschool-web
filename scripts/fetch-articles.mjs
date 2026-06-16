// ============================================================
//  fetch-articles.mjs
//  Renders nschool.tw/blog in a headless browser, extracts the
//  latest 4 articles (title / url / cover / date) and writes
//  articles.json. Run by the GitHub Action on a schedule.
//
//  Why a headless browser (not a direct API call)?
//  The blog is a JS-rendered SPA backed by a private Hasura
//  GraphQL endpoint (rhdb.kolable.com) that needs platform auth.
//  Rendering the real page is far more robust than reverse-
//  engineering that private API.
// ============================================================
import { chromium } from "playwright";
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const BLOG = "https://nschool.tw/blog";
const OUT = fileURLToPath(new URL("../articles.json", import.meta.url));

const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1400 } });
  await page.goto(BLOG, { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForSelector('a[href^="/posts/"]', { timeout: 30000 });

  // scroll to trigger lazy-loaded cover images
  for (let i = 0; i < 6; i++) {
    await page.mouse.wheel(0, 1400);
    await page.waitForTimeout(500);
  }
  await page.waitForTimeout(1500);

  const items = await page.evaluate(() => {
    // cover images are CSS background-images; key them by the post id in the URL
    const covers = {};
    document.querySelectorAll("*").forEach((e) => {
      const b = getComputedStyle(e).backgroundImage;
      if (b && b.includes("post_covers")) {
        const u = b.slice(b.indexOf("url(") + 4).replace(/["')]/g, "").replace(/\)$/, "");
        const m = u.match(/post_covers\/nschool\/([0-9a-f-]{36})\//);
        if (m && !covers[m[1]]) covers[m[1]] = u;
      }
    });
    const seen = new Set();
    const out = [];
    document.querySelectorAll('a[href^="/posts/"]').forEach((a) => {
      const href = a.getAttribute("href");
      const id = href.split("/").pop();
      if (seen.has(id)) return;
      seen.add(id);
      const txt = (a.innerText || a.textContent || "").replace(/\s+/g, " ").trim();
      const dm = txt.match(/20\d{2}-\d{2}-\d{2}/);
      const title = txt
        .replace(/20\d{2}-\d{2}-\d{2}/, "")
        .replace(/Dadazhi|游凱翔|撲滿日記|pin/g, "")
        .replace(/\s+/g, " ")
        .trim();
      out.push({ id, title, url: "https://nschool.tw" + href, cover: covers[id] || null, date: dm ? dm[0] : null });
    });
    return out;
  });

  const latest = items
    .filter((i) => i.cover && i.date && i.title)
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 4)
    .map(({ title, url, cover, date }) => ({ title, url, cover, date }));

  if (latest.length < 1) {
    console.error("No articles extracted — page structure may have changed.");
    process.exit(1);
  }

  const json = { updatedAt: new Date().toISOString().slice(0, 10), source: BLOG, items: latest };
  writeFileSync(OUT, JSON.stringify(json, null, 2) + "\n");
  console.log(`Wrote ${latest.length} articles to articles.json`);
} finally {
  await browser.close();
}
