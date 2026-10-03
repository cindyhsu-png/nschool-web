# 需求：文章列表的公開讀取端點（nSchool 財經學院官網）

**提出單位**：營運處
**日期**：2026-10-03
**影響**：nschool.tw 首頁「文章專欄」區塊

---

## 一句話需求

請提供一個**公開、唯讀**的端點，回傳某個 brand 最新已發布文章的
**標題、網址、封面圖、發布日期**。

---

## 現況與問題

官網首頁的文章專區，目前是用**無頭瀏覽器每天去 render `nschool.tw/blog`**，
再從畫面上把文章資料解析出來。兩個問題：

1. **IP 被擋。** 從 GitHub Actions（雲端機房 IP）連 `nschool.tw/blog` 會收到
   **403 Forbidden**；同一支程式從辦公室的電腦連則是 200。
   實測：帶完整 Chromium、桌機 UA、zh-TW/Asia-Taipei 仍是 403，
   不帶 User-Agent 從辦公室連反而正常 —— 所以判斷是**來源 IP 的封鎖規則**，
   不是爬蟲特徵。這條排程因此從 2026 年 6 月中起**每天失敗**，
   文章資料停在 2026-06-16，直到 10/02 才人工補上。

2. **解析畫面本身就不穩。** 版型一改就靜默失效。例如原本把作者名寫死在
   比對規則裡，新作者上稿後，作者名就會被留在標題裡顯示出來，而且不會報錯。

目前**已知資料就在 `rhdb.kolable.com` 的 GraphQL 後面**，只是需要平台認證。
我們要的不是新資料，是一條**公開的讀取路徑**。

---

## 希望的樣子

```
GET https://<kolable>/api/public/posts?brand=nschool&limit=4
```

回傳：

```json
{
  "items": [
    {
      "title": "晶片也要蓋立體城市？一次看懂先進製程與 ALD 的關鍵角色",
      "url": "https://nschool.tw/posts/8c48a44f-...",
      "cover": "https://static.kolable.com/post_covers/nschool/8c48a44f-.../1200",
      "published_at": "2026-10-02"
    }
  ]
}
```

- **必要欄位**：`title`、`url`、`cover`、`published_at`
- **加分欄位**：`author`、`excerpt`
- **排序**：發布日期新到舊
- **只回已發布的文章**（草稿、下架的不要）

## 條件

| 項目 | 需求 |
|---|---|
| 認證 | 公開即可。這些文章本來就對外開放、也進 sitemap 給搜尋引擎索引，沒有非公開資訊 |
| | 若貴方政策需要，給一組**唯讀** API key 也可以，我們放在 GitHub Secrets |
| 流量 | **每天 1 次**。不需要高頻 |
| 來源 IP | 會從 GitHub Actions 的雲端 IP 呼叫，請確認不在封鎖名單內 |

---

## 如果開 API 成本太高，這兩個替代方案我們也能接受

兩者都比做一支新 API 便宜很多：

1. **開啟 RSS／Atom feed**（例如 `nschool.tw/blog/rss`）。
   目前這個路徑是回 HTML，不是 feed。標準 feed 就包含我們要的四個欄位。

2. **在現有的 `sitemap.xml` 補上 `lastmod`**，並開放文章頁的
   **Open Graph meta 由伺服器端輸出**（`og:title`、`og:image`、
   `article:published_time`）。
   目前 sitemap 有 109 篇文章網址但**沒有 lastmod**，
   而文章頁的 OG 標籤是前端渲染的，所以一般的 HTTP 抓取讀不到 ——
   這同時也會影響社群分享的預覽縮圖與 SEO。

---

## 窗口

營運處 Cindy（許繻心）cindy_hsu@mogroup.tw
