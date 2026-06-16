# 部署到 Zeabur + 文章自動更新

這個資料夾就是要上 GitHub 並部署到 Zeabur 的**純靜態網站**（無 build、無後端）。
文章專區讀取同目錄的 `articles.json`；一個排程（GitHub Action）每天用無頭瀏覽器
抓 nschool.tw/blog 的最新四則、更新 `articles.json` 並 push，觸發 Zeabur 重新部署。

```
（repo 根 = 這個資料夾）
├─ index.html / style.css / hero.js / main.js   ← 網站本體（純靜態）
├─ articles.json                                 ← 文章資料（CI 自動更新）
├─ img/                                           ← logo + 師資照片（自包含）
├─ scripts/fetch-articles.mjs                    ← 抓文章腳本（Playwright，僅 CI 用）
├─ .github/workflows/update-articles.yml         ← 每日排程
└─ .gitignore
```

## 一、推上 GitHub

```bash
cd clone
git init
git add .
git commit -m "init nSchool 官網"
# 在 GitHub 建一個新 repo，然後：
git remote add origin https://github.com/<你的帳號>/<repo>.git
git branch -M main
git push -u origin main
```

## 二、部署到 Zeabur

1. 登入 [Zeabur](https://zeabur.com)，建立 Project → Add Service → Deploy from GitHub，選這個 repo。
2. Zeabur 會偵測到沒有 `package.json`、根目錄有 `index.html` → **自動以「Static」靜態網站方式部署**（不會跑 build）。
   - 若它沒自動判成靜態，在該 service 的設定把類型手動選為 **Static**，root / output 留在根目錄即可。
3. 部署完成後綁定網域（Zeabur 提供免費 `*.zeabur.app` 子網域，或綁自訂網域）。
4. 之後 CI 更新 `articles.json` 並 push，Zeabur 會自動重新部署。

> 注意：`scripts/`、`.github/`、`*.md` 會一起在 repo 裡，但只有 `index.html` 與其引用的
> 檔案會被使用者看到，不影響靜態部署，也沒有機密外洩。

## 三、開啟文章自動更新（排程）

`.github/workflows/update-articles.yml` 已設定每天台灣時間 **08:00**（UTC 00:00）執行。

1. repo → Settings → Actions → General → Workflow permissions → 選 **Read and write permissions**
   （讓 Action 能把更新後的 `articles.json` commit 回 repo）。
2. 改頻率：編輯 workflow 裡的 `cron`（UTC 時間）
   - 每天：`0 0 * * *`　每 6 小時：`0 */6 * * *`　每週一：`0 0 * * 1`
3. 想立即跑一次：repo → Actions →「Update latest articles」→ Run workflow。

## 本機測試抓取腳本（選用）

```bash
cd clone
npm install -D playwright
npx playwright install chromium
node scripts/fetch-articles.mjs   # 會更新 articles.json
```

（這些 Node 套件只在本機／CI 用，不會進 repo，也不影響 Zeabur 靜態部署。）

## 運作原理 / 注意

- 部落格封面是 CSS background-image、且站台是 SPA（私有 Hasura GraphQL，需平台 auth），
  所以用 Playwright 渲染真實頁面抓取，比硬打私有 API 穩定。
- 若 nschool.tw 部落格版型大改，`fetch-articles.mjs` 的選擇器可能要調整
  （Action 會失敗並保留上一版 `articles.json`，網站不會壞）。
- 前端讀不到 `articles.json` 時，會自動沿用 `index.html` 內建的四則作為 fallback。
- 3D 場景與字體走 CDN（unpkg three、Google Fonts），需要對外網路；離線環境會退化但不會壞版。
