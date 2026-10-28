# Framecheck｜Figma 視覺稿與網頁比對工具

繁體中文、瀏覽器本機處理的圖片比對工具。使用 Figma 匯出的圖片與實際網頁截圖，將「首次設計驗收」和「後續回歸測試」分成兩個流程。

## 開始使用

直接用現代版 Edge、Chrome 或 Firefox 開啟 `index.html`，不需要安裝套件、啟動伺服器、登入、CDN 或 MCP。可先按「載入示範圖片」體驗操作。

單一 `index.html` 已包含介面、樣式、圖片比對核心與可下載的回歸測試範本。此頁不會自動擷取內網網站，請先取得截圖，再選取或拖放圖片。

圖片只在目前分頁的記憶體中處理，不會上傳，也不會儲存在 localStorage 或 IndexedDB。重新整理會清除圖片和設定；需要保留時，請主動下載報告或圖片。程式不使用遠端字型、分析追蹤或外部圖片，並以 Content Security Policy 禁止網路連線。

## A．首次設計驗收

1. 具有匯出權限的人員從 Figma 將 Frame 匯出為 **1× PNG**。
2. 使用相同的畫面尺寸取得實際網頁截圖，確認字型和圖片均已載入。
3. 將兩張圖片分別放進「Figma 設計稿」和「實際網頁截圖」。建議使用 PNG，減少 JPEG 壓縮雜訊。
4. 用下列模式找出差異；需要時新增比較範圍與忽略區域。
5. 匯出差異 PNG 與 JSON 比對報告，作為人工驗收的依據。

| 模式 | 用途 |
| --- | --- |
| 並排 | 同時檢查兩張圖的整體版型與內容 |
| 疊圖 | 調整網頁透明度，觀察邊界、間距與位置偏移 |
| 滑桿 | 拖動分界線或調整滑桿，交替查看同一位置 |
| 差異圖 | 以粉紅色標出超過容許值的像素 |

「框選區域」限制比較範圍；「忽略區域」排除日期、名稱等動態內容。可以在圖片上拖曳矩形，也可以展開「以座標新增區域」輸入 X、Y、寬、高。座標依比較畫布的原始像素計算，不隨螢幕縮放改變。忽略區可以重疊，重疊部分只排除一次；「全部重設」恢復全圖比較。

圖片尺寸預設採用原始像素並從左上對齊，尺寸不同會提示。也可以明確選擇將網頁等比例縮放到設計稿寬度；這只幫助檢視，縮放本身可能產生插值差異，不能取代相同尺寸的正式驗收。

### 差異數值怎麼算

- 將透明像素合成在白色背景後，計算每個像素 RGB 三個色版差值的最大值。
- 最大差值 **大於**「像素色差容許值」時，該像素計為不同。容許值是 0–255 色階，不是百分比；預設值為 16。
- **像素差異比例 = 差異像素 ÷ 有效比較像素**。分母排除框選範圍外、忽略區域，以及兩張圖都沒有像素的填補區。
- 只有其中一張圖存在的像素會計為差異，即使色差容許值調到 255 也一樣。
- 沒有任何有效比較像素時不產生比例；JSON 以 `null` 表示，避免顯示成通過或 0%。

**像素差異比例不是設計還原度分數，也不代表通過驗收。** 截圖能指出視覺差異，無法可靠推斷實際 DOM、精確 CSS 數值或真正原因。精確確認請搭配設計規格、元素尺寸與 computed styles。

### 圖片與記憶體限制

每張圖片最多 **12 MB、12 百萬像素**，合成畫布亦最多 12 百萬像素。支援 PNG、JPEG、WebP。檔案壓縮大小不等於解碼後大小：12 百萬像素的一份 RGBA 緩衝區約需 48 MB，比對同時需要原圖、畫布、輸出等多份緩衝區；瀏覽器記憶體用量可能達數百 MB。長頁面建議切成同尺寸的區段，或先從 Figma 匯出個別元件。

## B．後續回歸測試

此頁的 B 分頁可設定網址、視窗大小、載入完成元素及動態內容的 CSS selector，下載完整 Playwright 範本 ZIP。也可以直接使用隨附的 [`regression/`](regression/README.md)。

建議流程是：

```text
在固定環境擷取候選網頁 PNG
→ 回到 A 與 Figma 比對並人工驗收
→ 明確核准同一份候選圖作為基準
→ 後續修改執行 Playwright 截圖測試
```

Playwright 在可存取受測網頁的本機或內網 runner 執行；GitHub Pages 僅提供靜態工具，不會替你執行瀏覽器測試。內網受限時，請透過公司允許的方式事先準備 Node.js、Playwright 套件及對應瀏覽器。

B 使用 DOM selector 遮罩；A 的像素框選不會自動轉換成 selector。請固定瀏覽器版本、作業系統、字型、視窗尺寸、縮放、測試資料、時區與語系，並使用同一套擷取流程核准基準。缺少基準或出現差異都不應自動更新基準。詳細命令與核准方式以 [回歸範本說明](regression/README.md) 為準。

## 部署到 GitHub Pages

1. 建立或選擇 GitHub repository，將此工具的 **`index.html` 與 `.nojekyll` 放到 `main` 分支根目錄**。可以一併放入本說明與 `regression/` 範本，但不要把真實公司截圖或比對報告放入公開網站儲存庫。
2. 在 repository 進入 **Settings → Pages**。
3. 在 **Build and deployment → Source** 選擇 **Deploy from a branch**。
4. 在 **Branch** 選擇 **main**，資料夾選 **/(root)**，按 **Save**。
5. 等待 Pages 部署完成，使用 Pages 頁面顯示的網址。一般專案網站網址形式為 `https://帳號.github.io/repository名稱/`。

本工具不需要建置步驟，也不使用網站根目錄的絕對資源路徑，因此可直接放在 GitHub Pages 的專案子路徑。若選擇 `/docs` 作為發佈資料夾，請把 `index.html` 和 `.nojekyll` 一起放在該資料夾的頂層。

上述設定依據 GitHub 官方的 [發佈來源設定](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site)；入口檔與 `.nojekyll` 說明見 [建立 GitHub Pages 網站](https://docs.github.com/en/pages/getting-started-with-github-pages/creating-a-github-pages-site)。若公司封鎖 github.io，可將單一 `index.html` 複製到核准的內網主機，或直接離線開啟。

## 檔案

| 檔案 | 用途 |
| --- | --- |
| `index.html` | 可獨立離線使用與部署的完整工具 |
| `src/` | 可維護的介面、樣式及程式原始碼 |
| `regression/` | 在本機或內網環境執行的 Playwright 回歸範本 |
| `.nojekyll` | 讓 GitHub Pages 直接提供靜態檔案 |

## 維護原始碼

一般使用直接開啟 `index.html`，不需 Node.js。若要修改程式，編輯 `src/`；若要調整可下載的回歸範本，編輯 `regression/`。使用 Node.js 20 以上執行：

```sh
node build.cjs
node --test tests/diff-core.test.cjs
```

建置會把 HTML、CSS、JavaScript 與回歸範本重新合併為單一 `index.html`，沒有外部套件依賴。發布時使用重新建置後的檔案。測試檢查像素計算、透明色、閾值、忽略區域、框選與尺寸不一致等行為。
