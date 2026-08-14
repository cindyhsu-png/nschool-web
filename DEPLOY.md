# 部署與文章自動更新

repo 根目錄就是網站根目錄（純靜態、無 build、無後端）。
文章專區讀取同目錄的 `articles.json`；一個排程（GitHub Action）每天用無頭瀏覽器
抓 nschool.tw/blog 的最新四則、更新 `articles.json` 並 push，push 再觸發重新部署。

```
（repo 根 = 網站根）
├─ index.html / style.css / hero.js / main.js   ← 網站本體（純靜態）
├─ articles.json                                 ← 文章資料（CI 自動更新）
├─ img/                                          ← logo + 師資照片（自包含）
├─ scripts/fetch-articles.mjs                    ← 抓文章腳本（Playwright，僅 CI 用）
├─ .github/workflows/deploy.yml                  ← 推 main → 部署到 GitHub Pages
├─ .github/workflows/update-articles.yml         ← 每日抓文章
└─ archive/v1/                                   ← v1.0 舊版封存（不是正式站）
```

## 一、GitHub Pages（目前的正式部署方式）

已由 `.github/workflows/deploy.yml` 自動處理，設定同 `nova-web`：

1. repo → **Settings → Pages → Build and deployment → Source** 選 **GitHub Actions**（一次性）。
2. 之後每次 push 到 `main`，或到 **Actions → Deploy to GitHub Pages → Run workflow** 手動觸發，
   1–2 分鐘後生效。
3. 網址：`https://cindyhsu-png.github.io/nschool-web/`

> 綁自訂網域：Settings → Pages → Custom domain 填入網域，再到 DNS 加 CNAME 指到
> `cindyhsu-png.github.io`。（若網站要走 Kolable 平台網域，見下方「三」。）

## 二、開啟文章自動更新（排程）

`.github/workflows/update-articles.yml` 每天台灣時間 **08:00**（UTC 00:00）執行。

1. repo → Settings → Actions → General → Workflow permissions → 選 **Read and write permissions**
   （讓 Action 能把更新後的 `articles.json` commit 回 repo）。
2. 改頻率：編輯 workflow 裡的 `cron`（UTC 時間）
   - 每天：`0 0 * * *`　每 6 小時：`0 */6 * * *`　每週一：`0 0 * * 1`
3. 想立即跑一次：repo → Actions →「Update latest articles」→ Run workflow。

## 三、遷入 Kolable（比照 nova）

**做法：把 public GitHub Pages 網址交給 Kolable，對方遷入後會回一個驗證網址供預覽。**
站台本體始終留在這個 repo，Kolable 端只是把它接進平台。

要交出去的網址：

```
https://cindyhsu-png.github.io/nschool-web/
```

（nova 的對應網址是 `https://cindyhsu-png.github.io/nova-web/`，同一套規格。）

前提條件（本 repo 已符合）：

- repo 必須是 **public**（GitHub Pages 免費方案的限制）
- Pages 來源設為 **GitHub Actions**，且 `deploy.yml` 已成功跑過一次

其他注意：

- 站台最底已放 Kolable 平台樣式白色版權頁尾（`index.html` 的 `.kolable-footer`），
  連到 `https://nschool.tw/statement-of-terms` 與 `https://nschool.tw/terms-tech`。
  若遷入後平台本身已有頁尾造成重複，把該區塊整段移除再推一次即可。
- 遷入後官網要改版，一樣是改這個 repo 推 `main`，Pages 自動重新部署；
  Kolable 端不用重設。

## 本機預覽

使用 ES Modules（Three.js import map），需經 HTTP 伺服器開啟：

```bash
python3 -m http.server 5500
# 瀏覽 http://localhost:5500
```

## 本機測試抓取腳本（選用）

```bash
npm install -D playwright
npx playwright install chromium
node scripts/fetch-articles.mjs   # 會更新 articles.json
```

（這些 Node 套件只在本機／CI 用，不會進 repo。）

## 運作原理 / 注意

- 部落格封面是 CSS background-image、且站台是 SPA（私有 Hasura GraphQL，需平台 auth），
  所以用 Playwright 渲染真實頁面抓取，比硬打私有 API 穩定。
- 若 nschool.tw 部落格版型大改，`fetch-articles.mjs` 的選擇器可能要調整
  （Action 會失敗並保留上一版 `articles.json`，網站不會壞）。
- 前端讀不到 `articles.json` 時，會自動沿用 `index.html` 內建的四則作為 fallback。
- 3D 場景與字體走 CDN（unpkg three、Google Fonts），需要對外網路；離線環境會退化但不會壞版。
