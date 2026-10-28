import { mkdir, readFile, writeFile, access } from 'node:fs/promises';
import path from 'node:path';
import { candidateDirectory, baselineDirectory, digest } from './shared.mjs';

const args = process.argv.slice(2);
if (args.some(arg => !['--reviewed', '--replace'].includes(arg)) || !args.includes('--reviewed')) {
  throw new Error('先完成設計驗收，再執行 npm run approve -- --reviewed。更新既有基準需另加 --replace。');
}
const candidate = await readFile(path.join(candidateDirectory, 'page.png'));
const metadata = JSON.parse(await readFile(path.join(candidateDirectory, 'candidate.json'), 'utf8'));
if (metadata.status !== 'unreviewed' || metadata.sha256 !== digest(candidate)) {
  throw new Error('候選圖片或記錄已改變，請重新擷取並驗收。');
}
const baselinePath = path.join(baselineDirectory, 'page.png');
let exists = true;
try { await access(baselinePath); } catch (error) { if (error.code === 'ENOENT') exists = false; else throw error; }
if (exists && !args.includes('--replace')) throw new Error('已有基準。確認這次候選也完成驗收後，明確加上 --replace。');
await mkdir(baselineDirectory, { recursive: true });
await writeFile(baselinePath, candidate);
await writeFile(path.join(baselineDirectory, 'baseline.json'), JSON.stringify({
  ...metadata,
  status: 'reviewed',
  approvedAt: new Date().toISOString(),
}, null, 2));
console.log(`已將人工驗收的候選原樣儲存為基準：${baselinePath}\n請連同 baseline.json 提交至版本控制。`);
