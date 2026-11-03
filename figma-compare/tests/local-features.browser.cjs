// Generated long-page fixtures only. No user screenshots are included.
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const assert=require('node:assert/strict'),path=require('node:path'),{pathToFileURL}=require('node:url');
(async()=>{const browser=await chromium.launch({channel:process.env.BROWSER_CHANNEL||'chrome',headless:true});try{
  const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(pathToFileURL(path.resolve(__dirname,'../offline.html')).href);await page.context().setOffline(true);
  assert.equal(await page.isDisabled('#quickAutoSearch'),true);
  const fixture=await page.evaluate(()=>{
    function canvas(w,h){const c=document.createElement('canvas');c.width=w;c.height=h;return c;}
    function art(seed){const c=canvas(224,180),g=c.getContext('2d');g.fillStyle='#ffe46a';g.fillRect(0,0,c.width,c.height);
      const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
      for(let i=0;i<95;i++){const x=12+random()*200,y=12+random()*155,r=3+random()*9;g.lineWidth=1.5;g.strokeStyle='#172c24';g.fillStyle=i%3===0?'#35bd35':'#ffffff';g.beginPath();g.arc(x,y,r,0,Math.PI*2);g.fill();g.stroke();g.beginPath();g.moveTo(x-r,y);g.lineTo(x+r,y+r);g.stroke();}return c;}
    const a=canvas(260,890),b=canvas(189,818),ag=a.getContext('2d'),bg=b.getContext('2d'),shared=art(613),second=art(123);
    for(const [g,w,h]of [[ag,260,890],[bg,189,818]]){g.fillStyle='#fff9df';g.fillRect(0,0,w,h);g.fillStyle='#ffdf53';g.fillRect(0,25,w,300);}
    ag.fillStyle='#122a15';ag.font='bold 28px sans-serif';ag.fillText('DESIGN PLAN',6,70);ag.font='18px sans-serif';ag.fillText('Original headline',15,104);
    bg.fillStyle='#122a15';bg.font='bold 15px sans-serif';bg.fillText('DIFFERENT WEB TITLE',4,48);bg.font='10px sans-serif';bg.fillText('New text and line breaks',9,65);
    ag.drawImage(shared,18,130);bg.drawImage(shared,11,78,224*.735,180*.735);
    ag.fillStyle='#32ae25';ag.fillRect(15,335,230,28);bg.fillStyle='#32ae25';bg.fillRect(8,245,172,40);
    ag.drawImage(second,18,470);bg.drawImage(second,11,490,224*.74,180*.74);
    ag.fillStyle='#172c24';ag.font='bold 24px sans-serif';ag.fillText('A component',12,420);bg.fillStyle='#172c24';bg.font='bold 18px sans-serif';bg.fillText('B card layout',13,380);
    return {a:a.toDataURL().split(',')[1],b:b.toDataURL().split(',')[1]};
  });
  await page.setInputFiles('#fileA',{name:'design-long.png',mimeType:'image/png',buffer:Buffer.from(fixture.a,'base64')});await page.setInputFiles('#fileB',{name:'web-long.png',mimeType:'image/png',buffer:Buffer.from(fixture.b,'base64')});await page.waitForFunction(()=>!document.getElementById('autoSearch').disabled);
  await page.click('#quickAutoSearch');await page.waitForFunction(()=>document.getElementById('autoCancel').disabled,{},{timeout:100000});
  assert.equal(await page.locator('.auto-candidate:not(.local-candidate)').count(),0,'no whole-page candidate for reflow');assert.ok(await page.locator('.local-candidate').count()>=1,await page.locator('#autoStatus').innerText());
  assert.match(await page.locator('#autoStatus').innerText(),/局部線索/);assert.equal(await page.locator('#autoDialog').isVisible(),false);console.log('PASS changed text and reflow produce local suggestions without applying');
  await page.locator('.local-candidate').first().click();assert.equal(await page.locator('#autoLocalNotice').isVisible(),true);assert.equal(await page.locator('#autoDesign').isVisible(),true);
  const s=Number(await page.inputValue('#autoScalePreview'));assert.ok(Math.abs(s-.735)<.025,`scale ${s}`);await page.fill('#autoPadding','8');await page.click('#autoApply');await page.waitForFunction(()=>!document.getElementById('exportReport').disabled);
  assert.equal(await page.inputValue('#autoMode'),'estimate','a local estimate must not become the global scale');assert.match(await page.locator('#autoStatus').innerText(),/不會鎖定/);assert.equal(await page.isChecked('#approved'),false);console.log('PASS local confirmation stays local and does not lock the page scale');
  await page.evaluate(()=>{window.exported=[];const old=URL.createObjectURL.bind(URL);URL.createObjectURL=b=>{if(b.type==='application/json')b.text().then(t=>window.exported.push(JSON.parse(t)));return old(b);};HTMLAnchorElement.prototype.click=function(){};});
  await page.click('#exportReport');await page.waitForFunction(()=>window.exported.length);const report=await page.evaluate(()=>window.exported.pop());const ar=report.alignment.autoAlignment;
  assert.equal(ar.scope,'component');assert.equal(ar.requestedScope,'page');assert.equal(ar.localOnly,true);assert.equal(ar.method,'orb-scale-translation');assert.ok(ar.designRect.height<400);assert.ok(ar.evidence.inliers>=8);assert.ok(report.canvas.height<400);console.log('PASS report records local evidence and true comparison bounds');
  // Replacing the source invalidates the feature candidates and preview too.
  await page.locator('.local-candidate').first().click();await page.keyboard.press('Escape');await page.setInputFiles('#fileB',{name:'web-new.png',mimeType:'image/png',buffer:Buffer.from(fixture.b,'base64')});await page.waitForFunction(()=>!document.getElementById('autoSearch').disabled);assert.equal(await page.locator('.local-candidate').count(),0);assert.deepEqual(errors,[]);console.log('PASS source replacement invalidates local matches; no page errors');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
