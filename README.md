# nSchool 財經學院 — 首頁

「先認知，再投資」的品牌官網首頁。沉浸式 WebGL Hero（粒子光球 + 玻璃色散環）、
中英雙語文案、可自動更新的文章專區。純靜態，無 build、無後端，可直接部署到 Zeabur。

## 本機預覽

使用 ES Modules（Three.js import map），需經 HTTP 伺服器開啟：

```bash
cd clone
python3 -m http.server 5500
# 瀏覽 http://localhost:5500
```

## 結構

```
index.html       — 單頁全部區段（語意化）
style.css        — 設計 tokens 與全部樣式
hero.js          — 持續性 WebGL 場景（粒子光球 + 結晶核心 + 六角玻璃環 + 殘影）
main.js          — Hero 股市標註、文章專區動態渲染、師資輪播、計數、進場、彈窗
articles.json    — 文章專區資料（由 CI 每日自動更新）
img/             — logo 與師資照片（自包含）
scripts/         — 文章抓取腳本（Playwright，僅 CI 用）
.github/         — 每日排程 workflow
```

## 技術棧

| 層 | 技術 |
|---|---|
| 3D | Three.js 0.170（CDN import map）· MeshPhysicalMaterial transmission/dispersion · AfterimagePass · SMAA |
| 動態 | 原生 scroll scrub · IntersectionObserver · requestAnimationFrame |
| 字體 | Noto Sans TC（中文）· Space Grotesk（英數字 display）· Schibsted Grotesk（內文）· IBM Plex Mono（數據） |
| 配色 | 冷調淺灰 + 品牌紫漸層 `#7c3aed → #ff6fd6` |

## 區段

導覽 → Hero（建構你的專屬投資 DNA）→ 教育宣言 → 合作夥伴（含前往開戶）→
你會學到（3 主題）→ 文章專區（最新 4 篇，自動更新）→ 為什麼選擇 →
學習旅程 → 關鍵數據 → 學員成果 → 顧問師資（可切換輪播）→ CTA → Footer

## 部署與文章自動更新

見 [DEPLOY.md](DEPLOY.md)。

## 外部連結

- 一對一諮詢 / 預約：SurveyCake 表單
- 前往開戶：群益金鼎證券
- 文章 / 課程 / 試看：nschool.tw

不使用 emoji；裝飾一律 inline SVG 與文字符號。
