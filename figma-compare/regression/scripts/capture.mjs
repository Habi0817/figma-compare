import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { contextSettings } from '../visual.settings.js';
import { candidateDirectory, digest, environmentSignature, preparePage, screenshotOptions } from './shared.mjs';

const browser = await chromium.launch({ headless: true });
try {
  const context = await browser.newContext(contextSettings);
  const page = await context.newPage();
  page.setDefaultTimeout(15_000);
  page.setDefaultNavigationTimeout(30_000);
  await Promise.race([
    preparePage(page),
    new Promise((_, reject) => { const timer = setTimeout(() => reject(new Error('頁面準備逾時。請檢查字型、圖片與 READY_SELECTOR。')), 45_000); timer.unref(); }),
  ]);
  const options = await screenshotOptions(page);
  let previous;
  let stable;
  for (let attempt = 0; attempt < 20; attempt++) {
    const current = await page.screenshot(options);
    if (previous?.equals(current)) { stable = current; break; }
    previous = current;
    await page.waitForTimeout(150);
  }
  if (!stable) throw new Error('連續截圖仍不穩定；請固定資料、停用動態內容或設定遮罩。');
  await mkdir(candidateDirectory, { recursive: true });
  await writeFile(path.join(candidateDirectory, 'page.png'), stable);
  await writeFile(path.join(candidateDirectory, 'candidate.json'), JSON.stringify({
    status: 'unreviewed',
    capturedAt: new Date().toISOString(),
    sha256: digest(stable),
    environment: environmentSignature(browser.version()),
  }, null, 2));
  console.log(`候選截圖已儲存：${path.join(candidateDirectory, 'page.png')}\n請先與 Figma 設計稿驗收，尚未建立或更新基準。`);
} finally {
  await browser.close();
}
