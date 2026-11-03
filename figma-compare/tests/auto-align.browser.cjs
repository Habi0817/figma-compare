const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const root=path.resolve(__dirname,'..');
(async()=>{
 const server=http.createServer((req,res)=>{const name=decodeURIComponent(req.url.split('?')[0]);const f=path.resolve(root,'.'+name);if(!f.startsWith(root+path.sep)){res.writeHead(403).end();return;}fs.readFile(f,(e,b)=>{if(e){res.writeHead(404).end();return;}res.setHeader('Content-Type',f.endsWith('.js')?'text/javascript':'text/html');res.end(b);});});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({channel:process.env.BROWSER_CHANNEL||'chrome',headless:true});
 try{
  const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')console.log('CONSOLE',m.text());});
  await page.goto(require('url').pathToFileURL(path.join(root,'offline.html')).href);
  await page.context().setOffline(true);
  // Generate a deterministic UI-like fixture with distinct content in all quadrants.
  async function fixture(opts={}){return page.evaluate(o=>{
   const a=document.createElement('canvas');a.width=240;a.height=160;const g=a.getContext('2d');g.fillStyle=o.plain?'#fff':'#f2f5ee';g.fillRect(0,0,240,160);
   if(!o.plain){g.fillStyle='#244830';g.fillRect(9,12,80,9);g.fillStyle='#c1cbd5';g.fillRect(136,8,87,45);g.fillStyle='#6278a3';g.fillRect(150,20,20,20);g.fillStyle='#c98458';g.fillRect(17,60,69,33);g.fillStyle='#243a61';g.font='bold 16px sans-serif';g.fillText('Review 42',103,86);g.fillStyle='#629455';g.fillRect(12,110,90,30);g.fillStyle='#fff';g.fillText('START',20,131);g.fillStyle='#483851';g.fillRect(145,115,77,6);g.fillRect(145,130,51,6);}
   if(o.large){const copy=document.createElement('canvas');copy.width=240;copy.height=160;copy.getContext('2d').drawImage(a,0,0);a.width=1660;a.height=860;g.drawImage(copy,0,0,1660,860);}
   const b=document.createElement('canvas');b.width=o.large?1900:o.partial?240:Math.max(700,Math.ceil(a.width*(o.scale||1.25)+200));b.height=o.large?1200:o.partial?110:Math.max(500,Math.ceil(a.height*(o.scale||1.25)+150));const q=b.getContext('2d');q.fillStyle='#d1c6b4';q.fillRect(0,0,b.width,b.height);const s=o.scale||1.25,x=o.partial?0:151,y=o.partial?0:83;
   if(!o.absent){q.drawImage(a,x,y,a.width*s,a.height*s);if(o.repeat)q.drawImage(a,390,290,240*s,160*s);if(o.changed){q.fillStyle='#882233';q.fillRect(x+12*s,y+110*s,125*s,30*s);}if(o.reflow){q.fillStyle='#d1c6b4';q.fillRect(x,y+80,240,80);q.drawImage(a,0,80,120,80,x+180,y+180,120,80);q.drawImage(a,120,80,120,80,x-50,y+220,120,80);}}
   window.fixtureA=a;window.fixtureB=b;
   return {a:a.toDataURL().split(',')[1],b:b.toDataURL().split(',')[1],x,y,scale:s};
  },opts);}
  async function inputs(f){await page.setInputFiles('#fileA',{name:'design.png',mimeType:'image/png',buffer:Buffer.from(f.a,'base64')});await page.setInputFiles('#fileB',{name:'web.png',mimeType:'image/png',buffer:Buffer.from(f.b,'base64')});await page.waitForFunction(()=>!document.getElementById('autoSearch').disabled);}
  async function search(){await page.click('#autoSearch');await page.waitForFunction(()=>document.getElementById('autoCancel').disabled,{},{timeout:100000});console.log('SEARCH',await page.locator('#autoStatus').innerText());}
  const f=await fixture();await inputs(f);await search();assert.ok(await page.locator('.auto-candidate').count());await page.locator('.auto-candidate').first().click();
  const c=await page.evaluate(()=>({x:+document.getElementById('autoX').value,y:+document.getElementById('autoY').value,s:+document.getElementById('autoScalePreview').value}));console.log('MATCH',c);
  assert.ok(Math.abs(c.x-f.x)/f.scale<=2);assert.ok(Math.abs(c.y-f.y)/f.scale<=2);assert.ok(Math.abs((c.x+240*c.s)-(f.x+240*f.scale))/f.scale<=2);
  await page.click('#autoApply');await page.waitForFunction(()=>!document.getElementById('exportReport').disabled);assert.equal(await page.inputValue('#autoMode'),'fixed');console.log('PASS offline original-resolution alignment and locked scale');
  // Capture exports in memory; no OS download required.
  await page.evaluate(()=>{window.exported=[];const original=URL.createObjectURL.bind(URL);URL.createObjectURL=b=>{if(b.type==='application/json')b.text().then(t=>window.exported.push(JSON.parse(t)));return original(b);};HTMLAnchorElement.prototype.click=function(){};});
  await page.click('#exportReport');await page.waitForFunction(()=>window.exported.length);const report=await page.evaluate(()=>window.exported.pop());assert.equal(report.schemaVersion,3);assert.equal(report.alignment.autoAlignment.confirmed,true);assert.equal(report.alignment.autoAlignment.scaleSource,'image-estimated');console.log('PASS report v3 includes alignment and coverage');
  await inputs(await fixture({scale:1,repeat:true}));await page.selectOption('#autoMode','fixed');await page.fill('#autoScale','1');await search();assert.ok(await page.locator('.auto-candidate').count()>=2);console.log('PASS repeated components produce distinct candidates');
  await inputs(await fixture({scale:1,changed:true}));await page.selectOption('#autoMode','fixed');await page.fill('#autoScale','1');await search();await page.locator('.auto-candidate').first().click();assert.equal(await page.isDisabled('#autoScalePreview'),true);await page.click('#autoApply');await page.waitForFunction(()=>!document.getElementById('exportReport').disabled);assert.ok(Number((await page.locator('#changed').innerText()).replaceAll(',',''))>100);console.log('PASS fixed-scale mode preserves genuine component differences');
  await inputs(await fixture({scale:1,partial:true}));await page.selectOption('#autoMode','fixed');await search();assert.ok(await page.locator('.auto-candidate').count());await page.locator('.auto-candidate').first().click();await page.click('#autoApply');await page.waitForFunction(()=>!document.getElementById('exportReport').disabled);assert.equal(await page.isVisible('#coverageNotice'),true);assert.equal(await page.isDisabled('#approved'),true);console.log('PASS partial capture marked and approval blocked');
  await inputs(await fixture({plain:true}));await search();assert.equal(await page.locator('.auto-candidate').count(),0);assert.match(await page.locator('#autoStatus').innerText(),/特徵太少/);console.log('PASS textureless input rejected');
  await inputs(await fixture({absent:true}));await search();assert.equal(await page.locator('.auto-candidate').count(),0);console.log('PASS unrelated content rejected');
  await inputs(await fixture({scale:1}));await page.click('#autoSearch');await page.click('#autoCancel');assert.match(await page.locator('#autoStatus').innerText(),/取消/);await page.waitForTimeout(500);assert.equal(await page.locator('.auto-candidate').count(),0);
  await page.click('#autoSearch');await inputs(await fixture({plain:true}));await page.waitForTimeout(500);assert.equal(await page.locator('.auto-candidate').count(),0);console.log('PASS cancel and replace invalidate workers');
  await inputs(await fixture({scale:1}));await page.selectOption('#autoScope','page');await page.selectOption('#autoMode','fixed');await search();assert.ok(await page.locator('.auto-candidate').count());console.log('PASS full-page distributed verification');
  await inputs(await fixture({scale:1,reflow:true}));await page.selectOption('#autoMode','fixed');await search();assert.equal(await page.locator('.auto-candidate:not(.local-candidate)').count(),0);console.log('PASS full-page reflow is not offered as a global alignment');
  await page.selectOption('#autoScope','component');
  for(const opt of [{scale:.25},{scale:4},{scale:.8,large:true}]){
   const f=await fixture(opt);await inputs(f);await search();assert.ok(await page.locator('.auto-candidate').count());await page.locator('.auto-candidate').first().click();
   const p=await page.evaluate(()=>({x:+document.getElementById('autoX').value,y:+document.getElementById('autoY').value,s:+document.getElementById('autoScalePreview').value}));const w=opt.large?1660:240,h=opt.large?860:160;
   for(const [d,n]of [[w,'x'],[h,'y']]){assert.ok(Math.abs(p[n]-f[n])/f.scale<=2,JSON.stringify(p));assert.ok(Math.abs(p[n]+d*p.s-f[n]-d*f.scale)/f.scale<=2,JSON.stringify(p));}
   await page.click('#autoClose');console.log('PASS corner accuracy',opt,p);
  }
  await page.context().setOffline(false);await page.goto(`http://127.0.0.1:${server.address().port}/index.html`);await inputs(await fixture({scale:.8}));await search();assert.ok(await page.locator('.auto-candidate').count());console.log('PASS static HTTP version loads same-origin OpenCV');
  await page.setViewportSize({width:390,height:844});await page.locator('.auto-candidate').first().click();assert.ok(await page.locator('#autoApply').isVisible());await page.screenshot({path:path.join(root,'tests/auto-preview.png'),fullPage:false});console.log('PASS narrow viewport preview');
  assert.deepEqual(errors,[]);console.log('ALL AUTO ALIGN TESTS PASSED');
 }finally{await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});
