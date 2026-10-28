# B · 後續視覺回歸測試

這份範本在本機或能存取內網的測試機執行。GitHub Pages 只提供圖片比對介面與範本下載，無法替你在伺服器執行 Playwright、讀取內網 DOM 或自動截取任意網站。

流程：**擷取網頁候選 → 用 A 與 Figma 人工驗收 → 原樣保存已驗收截圖 → 後續修改自動比較**。

## 1. 準備執行環境

使用 Node.js 20 以上；在這個 `regression` 目錄執行：

```sh
npm install
npx playwright install chromium
```

`@playwright/test` 固定為 `1.64.1`。第一次安裝後，把產生的 `package-lock.json` 納入版本控制，其他機器使用 `npm ci`。瀏覽器與 npm 套件需事先由公司核准來源安裝；內網隔離環境可使用公司套件鏡像與對應 Playwright 版本的瀏覽器快取。安裝完成後，測試只需能連到待測網站及其資源。

## 2. 設定待測頁面

編輯 `regression.settings.json`；也可先在圖片工具的「後續回歸」分頁設定，再下載範本。

```json
{
  "url": "http://localhost:3000/review",
  "viewport": { "width": 1440, "height": 900 },
  "maskSelectors": ["[data-testid='current-time']"],
  "readySelector": "[data-visual-ready='true']"
}
```

`readySelector` 應指向「資料與版面已完成」的可見元素。空字串只等待 `body`，請依實際網站補上明確條件。遮罩使用 CSS selector，而不是 A 分頁的圖片座標；找不到遮罩元素會使流程失敗，避免默默漏掉動態區域。

進一步固定條件在 `visual.settings.js`：DPR 1、zh-TW、Asia/Taipei、light、reduced motion、1440×900 預設視窗；截圖以 CSS 像素輸出、隱藏游標、停用動畫。預設只截可見視窗；改成 `fullPage: true` 時，請另外處理虛擬清單與無限載入。

`requiredWebFonts` 可填入專案的 `@font-face` family 名稱，範本會驗證與等待載入；空陣列仍等待 `document.fonts.ready`。本機系統字型及 CSS background 圖片、canvas、跨頁 iframe 等，需在專案準備步驟加入適當的完成條件。請固定字型檔版本、資料 fixture、瀏覽器版本、OS／容器映像及 headless 模式；字型載入完畢不代表它就是指定的設計字型。

需要登入或 mock API 時，在 `scripts/shared.mjs` 的 `preparePage()` 加入專案步驟；不要把登入金鑰寫入公開 repo。`datasetVersion` 只是記錄資料集版本，不會自動建立或固定後端資料。

可選環境變數覆寫（PowerShell）：

```powershell
$env:TEST_URL = 'http://localhost:3000/review'
$env:READY_SELECTOR = '[data-visual-ready="true"]'
$env:MASK_SELECTORS = '["[data-testid=\"current-time\"]"]'
```

設定會記入本機候選與基準的 JSON，供測試檢查環境一致性。請使用固定且可分享給團隊的測試 URL，避免 URL 查詢字串含機密。

## 3. 擷取候選，人工驗收

```sh
npm run capture
```

截圖存於 `candidates/chromium-<平台>/page.png`，例如 Windows 是 `chromium-win32`。會等待指定元素、字型、可見圖片解碼，並確認兩次連續截圖相同；產生候選不代表符合設計。

把這張候選與 Figma 匯出 PNG 放入 A 分頁，檢查間距、對齊、換行與視覺層級。兩者最好使用相同尺寸與 1× 像素比例；Figma 匯出需具有權限。

## 4. 人工確認通過後才建立基準

```sh
npm run approve -- --reviewed
```

此命令只將剛才驗收的候選 PNG 原樣複製到 `baselines/chromium-<平台>/page.png`，保留 SHA-256 與環境記錄，不會重新擷取。`--reviewed` 是操作人的確認，工具無法替人判定設計已通過。請把 `page.png` 與 `baseline.json` 一起提交版本控制。

## 5. 每次修改後執行

```sh
npm test
npm run report
```

一般測試有以下行為：缺基準會失敗；環境或設定變更會失敗；偵測到差異會產生 Playwright HTML 報告；**不會產生或更新基準**。也會拒絕 `--update-snapshots` 覆寫模式。

預設顏色差異容差 `threshold: 0.1`、允許差異像素 `maxDiffPixels: 0`。可依團隊規範在 `playwright.config.js` 調整；它們是測試判定條件，不是設計還原度分數，也不等同 A 分頁的 RGB 通道差異算法。

設計確實變更時，重新 `capture` → 人工驗收 → 明確替換：

```sh
npm run approve -- --reviewed --replace
```

查看圖片 diff 與驗收記錄後再提交變更；不要因測試失敗就直接接受新基準。

## 6. 內網 CI

在可存取內網且已準備固定依賴與瀏覽器的受控 runner 執行 `npm ci`、`npm test` 即可。不要假設 GitHub 公用 runner 能存取公司內網。使用固定 OS／映像與字型，並在同一環境擷取和人工核准基準；這份範本記錄 OS release、架構與瀏覽器版本，不一致時會要求重新驗收。

若使用 self-hosted runner，請依公司既有 CI 流程限制可執行的分支與程式碼來源。報告可含截圖與測試 URL，請存於公司核准的報告空間。此範本不會自動上傳報告或提交基準。

## 官方參考

- [Playwright 視覺比對](https://playwright.dev/docs/test-snapshots)
- [toHaveScreenshot 選項](https://playwright.dev/docs/api/class-pageassertions#page-assertions-to-have-screenshot-1)
- [updateSnapshots 設定](https://playwright.dev/docs/api/class-testconfig#test-config-update-snapshots)
- [1.64.1 官方版本](https://github.com/microsoft/playwright/releases/tag/v1.64.1)

範本固定套件版本與 API 依官方文件於 2026-10-28 查核。尚未套用你的真實網站；登入、測試資料與 ready 條件須依專案調整。
