// Optional maintainer build. The delivered index.html already works without Node.js.
const fs = require('node:fs');
const path = require('node:path');
const root = __dirname;
const read = name => fs.readFileSync(path.join(root,name),'utf8');
const files = ['package.json','.gitignore','regression.settings.json','visual.settings.js','playwright.config.js','README.md','scripts/shared.mjs','scripts/capture.mjs','scripts/approve.mjs','tests/visual.spec.js'];
const templates = Object.fromEntries(files.map(name=>[name,read('regression/'+name)]));
const inline = text => text.replace(/<\/script/gi,'<\\/script');
let html = read('src/index.template.html');
html = html.replace('/* STYLES */',()=>read('src/styles.css'));
html = html.replace('/* CORE */',()=>inline(read('src/diff-core.js')));
html = html.replace('/* TEMPLATES */',()=>`const REGRESSION_TEMPLATES = ${JSON.stringify(templates).replace(/</g,'\\u003c')};`);
html = html.replace('/* APP */',()=>inline(read('src/app.js').replace('/* WORKBENCH */',()=>read('src/workbench.js'))));
fs.writeFileSync(path.join(root,'index.html'),html);
console.log('Built self-contained index.html ('+Buffer.byteLength(html)+' bytes)');
