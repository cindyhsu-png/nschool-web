// ============================================================
//  fetch-articles.mjs
//  直接向 Kolable 的 GraphQL（rhdb.kolable.com）查 nschool 最新已發布的
//  4 篇文章（標題／網址／封面／日期），寫成 articles.json。
//  由 GitHub Action 每天跑一次，也可以在本機跑。
//
//  為什麼不再用無頭瀏覽器渲染 nschool.tw/blog（2026-10-06）：
//    - nschool.tw 擋掉 GitHub Actions 的機房 IP（403），從 6 月中起每天失敗。
//    - 解析畫面本身就不穩：版型一改就靜默抓錯（例如作者名留在標題上）。
//  文章資料本來就在 Kolable 的 GraphQL 後面，用品牌的 clientId／clientKey
//  換一張 token 就能直接讀結構化欄位，不必再猜畫面。
//
//  需要兩個環境變數（GitHub → Settings → Secrets and variables → Actions）：
//    KOLABLE_CLIENT_ID   nschool 品牌的 clientId
//    KOLABLE_CLIENT_KEY  nschool 品牌的 clientKey
//  token 只用在這次執行，不寫檔、不印出來。
// ============================================================
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const AUTH_URL = "https://api.kolable.app/api/v1/auth/token";
const GRAPHQL_URL = "https://rhdb.kolable.com/v1/graphql";
const SITE = "https://nschool.tw";
const OUT = fileURLToPath(new URL("../articles.json", import.meta.url));
const LIMIT = 4;

function fail(msg) {
  console.error(msg);
  process.exit(1);
}

const clientId = process.env.KOLABLE_CLIENT_ID;
const clientKey = process.env.KOLABLE_CLIENT_KEY;
if (!clientId || !clientKey) fail("缺 KOLABLE_CLIENT_ID 或 KOLABLE_CLIENT_KEY，停在這裡（articles.json 不動）。");

async function post(url, body, headers = {}) {
  const r = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(30000),
  });
  const text = await r.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* 非 JSON（例如被擋時的 HTML 頁）*/ }
  return { status: r.status, json, text };
}

// 1. 換 token。permission 給空陣列＝不要求額外權限，只讀文章用不到更多。
const auth = await post(AUTH_URL, { clientId, key: clientKey, permission: [] });
const token = auth.json?.result?.authToken;
if (!token) {
  // 403 多半是來源 IP 被擋，跟帳密錯誤分開講，下次壞掉才知道要找誰
  const hint = auth.status === 403 ? "（403：來源 IP 可能被 Kolable 擋了，不是帳密問題）" : "";
  fail(`換不到 Kolable token：HTTP ${auth.status}${hint}`);
}

// 2. 只拿已發布的：沒刪除、有發布時間、而且發布時間已經到了（排程中的未來文章不算）
const now = new Date().toISOString();
const query = `query ($now: timestamptz!, $limit: Int!) {
  post(
    where: { is_deleted: { _eq: false }, published_at: { _is_null: false, _lte: $now } }
    order_by: { published_at: desc }
    limit: $limit
  ) {
    id
    title
    cover_url
    published_at
    abstract
    post_roles(where: { name: { _eq: "author" } }) { member { name } }
  }
}`;
const res = await post(GRAPHQL_URL, { query, variables: { now, limit: LIMIT } },
  { Authorization: `Bearer ${token}` });
if (res.status !== 200 || res.json?.errors || !Array.isArray(res.json?.data?.post)) {
  const err = res.json?.errors?.[0]?.message || res.text.slice(0, 200);
  fail(`GraphQL 查詢失敗：HTTP ${res.status} ${err}`);
}

// 發布時間存 UTC，首頁顯示的是台灣日期
const taipeiDate = (iso) =>
  new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Taipei" }).format(new Date(iso));

const items = res.json.data.post
  .filter((p) => p.title && p.cover_url)
  .map((p) => ({
    title: p.title.trim(),
    url: `${SITE}/posts/${p.id}`,
    cover: p.cover_url,
    date: taipeiDate(p.published_at),
    author: p.post_roles?.[0]?.member?.name || null,
    excerpt: p.abstract?.trim() || null,
  }));

// 一篇都沒有就不覆蓋：前端讀到空清單會退回寫死的舊文章，畫面看不出壞掉
if (items.length < 1) fail("Kolable 回來 0 篇已發布文章，停在這裡（articles.json 不動）。");

// 文章沒變就不重寫：不然每天只因 updatedAt 換日就多一個 commit、多部署一次
let prev = null;
try { prev = JSON.parse(readFileSync(OUT, "utf8")); } catch { /* 第一次或檔案壞掉就照寫 */ }
if (prev && JSON.stringify(prev.items) === JSON.stringify(items)) {
  console.log(`No change: ${items.length} articles, newest ${items[0].date}`);
  process.exit(0);
}

const json = { updatedAt: taipeiDate(now), source: `${SITE}/blog`, items };
writeFileSync(OUT, JSON.stringify(json, null, 2) + "\n");
console.log(`Wrote ${items.length} articles to articles.json (newest ${items[0].date})`);
