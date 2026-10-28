import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import os from 'node:os';
import { contextSettings, screenshotSettings, requiredWebFonts, datasetVersion, runtimeSettings } from '../visual.settings.js';

export const root = fileURLToPath(new URL('../', import.meta.url));
export const key = `chromium-${process.platform}`;
export const candidateDirectory = path.join(root, 'candidates', key);
export const baselineDirectory = path.join(root, 'baselines', key);
export const digest = bytes => createHash('sha256').update(bytes).digest('hex');

export function environmentSignature(browserVersion) {
  return {
    playwright: JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8')).devDependencies['@playwright/test'],
    platform: process.platform,
    arch: process.arch,
    osRelease: os.release(),
    browserVersion,
    contextSettings,
    screenshotSettings,
    requiredWebFonts,
    datasetVersion,
    ...runtimeSettings(),
  };
}

export async function preparePage(page) {
  const { url, readySelector } = runtimeSettings();
  const response = await page.goto(url, { waitUntil: 'load' });
  if (response && !response.ok()) throw new Error(`網頁回應 HTTP ${response.status()}。`);
  await page.locator(readySelector).first().waitFor({ state: 'visible' });

  // 需要登入、固定 API fixture、等應用程式資料完成時，在這裡加入專案的明確條件。
  // 例如 await page.getByTestId('orders-loaded').waitFor({ state: 'visible' });
  // 不把 networkidle 或固定 sleep 當成所有應用程式都已準備好的證明。
  await page.evaluate(async ({ fonts, fullPage }) => {
    for (const family of fonts) {
      const faces = await document.fonts.load(`16px ${JSON.stringify(family)}`);
      if (!faces.length) throw new Error(`找不到指定的網頁字型：${family}`);
    }
    await document.fonts.ready;
    const images = [...document.images].filter(img => {
      const box = img.getBoundingClientRect();
      return fullPage || (box.width > 0 && box.height > 0 && box.bottom > 0 && box.right > 0 && box.top < innerHeight && box.left < innerWidth);
    });
    // fullPage 時也啟動 lazy 圖片；自訂虛擬清單需在上方準備步驟另外展開。
    await Promise.all(images.map(async img => {
      if (fullPage) img.loading = 'eager';
      if (!img.complete) await new Promise((resolve, reject) => {
        img.addEventListener('load', resolve, { once: true });
        img.addEventListener('error', () => reject(new Error('圖片載入失敗')), { once: true });
      });
      if (!img.naturalWidth) throw new Error('截圖範圍內有未載入的圖片。');
      await img.decode();
    }));
  }, { fonts: requiredWebFonts, fullPage: screenshotSettings.fullPage });
  await page.mouse.move(-1, -1);
}

export async function screenshotOptions(page) {
  const { maskSelectors } = runtimeSettings();
  const mask = maskSelectors.map(selector => page.locator(selector));
  // selector 寫錯時直接失敗，避免使用者以為已排除敏感動態資料。
  for (let i = 0; i < mask.length; i++) {
    if (await mask[i].count() === 0) throw new Error(`忽略區域找不到元素：${maskSelectors[i]}`);
  }
  return { ...screenshotSettings, mask };
}
