# nSchool — 財經教育平台官網

「資本的語言」— 亮白底 × 紫羅蘭光束 × 黑墨粗黑體的品牌官網。
配色依據品牌主視覺（nshcool_style.png），Three.js 粒子場貫穿全頁敘事。

## 啟動方式

純靜態網站，但因使用 ES Modules（Three.js import map），需經由 HTTP 伺服器開啟：

```bash
cd "nschool v2"
python3 -m http.server 4173
# 瀏覽 http://localhost:4173
```

## 技術棧

| 層 | 技術 |
|---|---|
| 3D | Three.js 0.160（CDN import map）· 自訂 ShaderMaterial |
| 動態 | GSAP 3.12 + ScrollTrigger · Lenis 慣性捲動 |
| 字體 | Noto Sans TC（中文，900 大標）· Schibsted Grotesk（拉丁 display）· IBM Plex Mono（數據） |
| 圖表 | 原生 SVG + GSAP stroke-dash 繪線動畫 |
| 影像 | Unsplash CDN（lazy loading · 視差 · 灰階轉彩 hover） |

## 結構

```
index.html              — 單頁全部內容（語意化區段）
assets/css/main.css     — 設計 tokens 與全部樣式
assets/js/scene.js      — WebGL 粒子場（三形態 morph）
assets/js/main.js       — 互動層（捲動編排、市場面板、游標、計數、圖表）
nshcool_style.png       — 品牌主視覺參考
```

## 設計要點

- **Hero**：左側編輯式大標（建立你個人的投資 DNA）× 右側懸浮「Market Snapshot」終端面板（報價列 + sparkline + 面積圖）；背景為金融 graph-paper 細格線 + 紫色光暈
- **品牌識別**：hero 的粒子形態是「3D 動態山谷」（與後段市場波浪共用同一張網格，捲動時只改高度、過渡無位移），四態變形 山谷 → 波浪 → 球體 → 複利螺旋
- **AR 財經卡片軌道（曲面）**：hero 面板周圍環繞一組玻璃 UI 卡（94% 完課率 / 資產配置圓環 / F-03 課程籌碼 / TAIEX 迷你 K 線）+ 前景失焦 bokeh 卡。用 CSS 3D transforms（perspective + 每張卡 rotateX/Y/translateZ）讓卡片貼在微凸的曲面上、各自朝焦點傾斜；滑鼠移動時整面卡片朝游標翻轉（holographic，避開 preserve-3d 以保住 backdrop-filter 玻璃）。三層景深、緩慢軌道飄移、卡片發光照亮環境、部分被面板遮擋製造電影感。1080px 以下隱藏
- **跑馬燈**：fixed 磁吸於畫面底部，台股慣例紅漲綠跌
- **WebGL**：26,000 顆粒子（手機 13,000）四態 morph（DNA → 地形 → 球體 → 螺旋）；normal blending（亮底）；內容密集區自動調光至 15% 確保可讀性；螺旋尺寸依視錐動態計算
- **國際級細節**：頂部捲動進度條、nav scroll-spy、pill 按鈕、`focus-visible` 焦點環、卡片 hover 浮起、報價列 hover、自訂捲軸、favicon、OG meta、`scroll-margin-top`
- **影像層**：三張場景圖（實體講座／線上課程／研究例會）+ 師資人像，建立視覺信任
- **Footer**：黑色收尾區塊，含投資風險合規聲明
- 不使用 emoji；裝飾一律 inline SVG 與文字符號
- 支援 `prefers-reduced-motion` 與分頁隱藏暫停渲染
