// ============================================================
//  fetch-articles.mjs
//  Renders nschool.tw/blog in a headless browser, extracts the
//  latest 4 articles (title / url / cover / date) and writes
//  articles.json. Run by the GitHub Action on a schedule.
//
//  Why a headless browser (not a direct API call)?
//  The blog is a JS-rendered SPA backed by a private Hasura
//  GraphQL endpoint (rhdb.kolable.com) that needs platform auth.
//  The sitemap lists post URLs but carries no titles, dates or
//  covers, and the post pages render their OG tags client-side —
//  so plain HTTP gets us nothing. Rendering the page is the only
//  option that does not involve reverse-engineering private auth.
//
//  2026-10-02: the job had been failing silently since mid-June
//  (waitForSelector timing out on the runner). The extraction
//  logic itself was still correct — verified against the live
//  page, 104 links / 104 covers. So the fixes here are all about
//  making the RUNNER look like a normal browser, and about
//  leaving evidence behind when it still doesn't:
//    - full Chromium instead of the headless shell that newer
//      Playwright defaults to (more detectable, renders less)
//    - zh-TW locale / Asia-Taipei timezone / desktop UA
//    - domcontentloaded + explicit wait, not networkidle
//      (an SPA that polls never goes idle)
//    - 3 attempts, and a screenshot + HTML dump on the last one
// ============================================================
import { chromium } from "playwright";
import { writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";

const BLOG = "https://nschool.tw/blog";
const OUT = fileURLToPath(new URL("../articles.json", import.meta.url));
// 不要用 . 開頭：upload-artifact 預設會把隱藏檔案整個跳過
const DEBUG_DIR = fileURLToPath(new URL("../playwright-debug/", import.meta.url));
const ATTEMPTS = 3;

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36";

function extract() {
  // 封面是 CSS background-image，用網址裡的文章 id 當 key 對回文章
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
      .replace(/Dadazhi|游凱翔|撲滿日記|Minor|nSchool|pin/g, "")
      .replace(/\s+/g, " ")
      .trim();
    out.push({ id, title, url: "https://nschool.tw" + href, cover: covers[id] || null, date: dm ? dm[0] : null });
  });
  return out;
}

async function attempt(n) {
  const browser = await chromium.launch({ channel: "chromium" });
  let page;
  try {
    const ctx = await browser.newContext({
      viewport: { width: 1440, height: 1400 },
      userAgent: UA,
      locale: "zh-TW",
      timezoneId: "Asia/Taipei",
      extraHTTPHeaders: { "Accept-Language": "zh-TW,zh;q=0.9,en;q=0.8" },
    });
    page = await ctx.newPage();
    await page.goto(BLOG, { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.waitForSelector('a[href^="/posts/"]', { timeout: 45000 });

    // 捲動觸發封面圖的 lazy load
    for (let i = 0; i < 6; i++) {
      await page.mouse.wheel(0, 1400);
      await page.waitForTimeout(500);
    }
    await page.waitForTimeout(1500);

    const items = await page.evaluate(extract);
    console.log(`attempt ${n}: ${items.length} links, ${items.filter((i) => i.cover).length} with cover`);
    return items;
  } catch (err) {
    // 最後一次才留證據：下次再壞的時候看得到 runner 到底拿到什麼頁面，
    // 不必再瞎猜是被擋、沒渲染、還是版型改了
    if (n === ATTEMPTS && page) {
      try {
        mkdirSync(DEBUG_DIR, { recursive: true });
        await page.screenshot({ path: DEBUG_DIR + "blog.png", fullPage: false });
        writeFileSync(DEBUG_DIR + "blog.html", await page.content());
        console.error("Saved playwright-debug/blog.png and playwright-debug/blog.html");
      } catch (e2) {
        console.error("Could not save debug artifacts:", e2.message);
      }
    }
    throw err;
  } finally {
    await browser.close();
  }
}

let items = [];
let lastErr;
for (let n = 1; n <= ATTEMPTS; n++) {
  try {
    items = await attempt(n);
    if (items.length) break;
  } catch (err) {
    lastErr = err;
    console.error(`attempt ${n} failed: ${err.message.split("\n")[0]}`);
    if (n < ATTEMPTS) await new Promise((r) => setTimeout(r, 5000));
  }
}

const latest = items
  .filter((i) => i.cover && i.date && i.title)
  .sort((a, b) => b.date.localeCompare(a.date))
  .slice(0, 4)
  .map(({ title, url, cover, date }) => ({ title, url, cover, date }));

if (latest.length < 1) {
  console.error("No articles extracted — page did not render, or structure changed.");
  if (lastErr) console.error(lastErr.message);
  process.exit(1);
}

const json = { updatedAt: new Date().toISOString().slice(0, 10), source: BLOG, items: latest };
writeFileSync(OUT, JSON.stringify(json, null, 2) + "\n");
console.log(`Wrote ${latest.length} articles to articles.json (newest ${latest[0].date})`);
