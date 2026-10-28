import { readFileSync } from 'node:fs';
// 此 JSON 可由工具的「後續回歸」分頁設定並下載。
const settings = JSON.parse(readFileSync(new URL('./regression.settings.json', import.meta.url), 'utf8'));
const viewport = settings.viewport;
if (!viewport || !Number.isInteger(viewport.width) || !Number.isInteger(viewport.height) || viewport.width < 1 || viewport.height < 1 || viewport.width > 16384 || viewport.height > 16384) {
  throw new Error('regression.settings.json 的 viewport 寬高必須是 1～16384 的整數。');
}
// 尺寸、字型、資料集或遮罩變動後，重新擷取並人工驗收候選。
export const contextSettings = {
  viewport,
  deviceScaleFactor: 1,
  locale: 'zh-TW',
  timezoneId: 'Asia/Taipei',
  colorScheme: 'light',
  reducedMotion: 'reduce',
  isMobile: false,
  hasTouch: false,
};

export const screenshotSettings = {
  fullPage: false,
  animations: 'disabled',
  caret: 'hide',
  scale: 'css',
  maskColor: '#FF00FF',
};

// 資料集版本應對應應用程式已固定的測試資料；此欄不會自動建立資料。
export const datasetVersion = 'review-fixture-v1';
// 如有 @font-face，填入精確 family 名稱；空陣列仍會等待 document.fonts.ready。
export const requiredWebFonts = [];

export function runtimeSettings() {
  const rawUrl = process.env.TEST_URL || settings.url;
  if (!rawUrl) throw new Error('請設定 TEST_URL，例如 http://127.0.0.1:3000/review');
  const url = new URL(rawUrl);
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error('TEST_URL 只支援 HTTP / HTTPS。');
  if (url.username || url.password) throw new Error('請勿將登入憑證放入 TEST_URL，請使用獨立登入 fixture。');
  const maskSelectors = process.env.MASK_SELECTORS ? JSON.parse(process.env.MASK_SELECTORS) : (settings.maskSelectors || []);
  if (!Array.isArray(maskSelectors) || maskSelectors.some(x => typeof x !== 'string' || !x.trim())) {
    throw new Error('MASK_SELECTORS 必須為非空 CSS selector 的 JSON 陣列。');
  }
  return {
    url: url.href,
    readySelector: process.env.READY_SELECTOR || settings.readySelector || 'body',
    maskSelectors,
  };
}
