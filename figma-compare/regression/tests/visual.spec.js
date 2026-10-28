import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { digest, environmentSignature, preparePage, screenshotOptions } from '../scripts/shared.mjs';

test('已驗收畫面的視覺回歸', async ({ page, browser }, testInfo) => {
  expect(testInfo.config.updateSnapshots, '請用 capture → 人工驗收 → approve 流程；一般測試不得更新基準。').toBe('none');
  const baselinePath = testInfo.snapshotPath('page.png');
  let baseline;
  let metadata;
  try {
    baseline = await readFile(baselinePath);
    metadata = JSON.parse(await readFile(path.join(path.dirname(baselinePath), 'baseline.json'), 'utf8'));
  } catch (error) {
    throw new Error(`缺少已驗收基準或記錄。請先執行 npm run capture、人工比對設計稿，再 npm run approve -- --reviewed。\n${error.message}`);
  }
  expect(metadata.status, '基準須有人工驗收記錄').toBe('reviewed');
  expect(digest(baseline), '基準圖片的雜湊值與驗收記錄不符').toBe(metadata.sha256);
  expect(metadata.environment, '環境或截圖設定已改變，請使用原環境或重新擷取並驗收。').toEqual(environmentSignature(browser.version()));
  await preparePage(page);
  await expect(page).toHaveScreenshot('page.png', await screenshotOptions(page));
});
