# Framecheck｜Figma 視覺稿與網頁比對工具

純網頁、繁體中文、圖片在瀏覽器本機處理。自動找出網頁截圖中的 Figma 元件，等比例校正大小與位置，再進行視覺驗收。無需擴充功能、Python、MCP 或外部 AI API。

## 使用方式

1. 離線請下載並開啟 [offline.html](figma-compare/offline.html)，已內嵌完整運算引擎。
2. 網站版使用 [index.html](figma-compare/index.html)，需同時部署 `figma-compare/vendor/`。
3. 加入兩張圖片 → 選設計元件 → 自動尋找 → 點候選預覽 → 確認對齊 → 檢查差異。

支援最多 3 個候選、框線拖曳、倍率鎖定、外擴比較邊界、部分截圖提示、並排／疊圖／滑桿／差異圖及 JSON 報告。

**v1.2.1：** 長頁或文字不同時，會進一步尋找共同插畫／圖示的「局部線索」。來源圖片下方按「③ 自動找共同區塊」，選取局部線索後即可預覽並確認；局部倍率不會被當成整張頁面的倍率。

**自動估測倍率僅供視覺檢查。** 精確尺寸驗收請使用可信的參考尺寸或擷取倍率；響應式重排無法靠縮放修正，像素差異比例也不是設計還原度。

完整操作、倍率說明、限制、隱私及測試命令，見 [工具說明](figma-compare/README.md)。後續回歸另用 [Playwright 範本](figma-compare/regression/README.md)，不會自動更新已核准基準。

## GitHub Pages

本儲存庫工具位於 `figma-compare/` 子資料夾。若從 main 根目錄發布，請在 Settings → Pages 顯示的網站網址後接 `figma-compare/index.html`。也可把整個工具資料夾內容作為網站根目錄部署，保留 vendor 與相對路徑。

圖片只在瀏覽器記憶體處理，不上傳、不儲存在瀏覽器資料庫，重新整理即清除。無 CDN。網頁版僅讀取同站辨識資源，離線版不需要網路。
