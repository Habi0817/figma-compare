// Optional integration test: install Playwright separately or set PLAYWRIGHT_MODULE.
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const assert=require('node:assert/strict');
const path=require('node:path');const {pathToFileURL}=require('node:url');
(async()=>{const browser=await chromium.launch({channel:process.env.BROWSER_CHANNEL||'chrome',headless:true});try{
 const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(pathToFileURL(process.env.COMPARE_HTML||path.resolve(__dirname,'../index.html')).href);
 await page.click('#demoButton');await page.waitForFunction(()=>!document.getElementById('cropB').disabled);await page.click('#cropB');
 assert.equal(await page.isChecked('#cropLock'),true);
 const fields=async()=>page.evaluate(()=>Object.fromEntries(['X','Y','W','H'].map(k=>[k,Number(document.getElementById('crop'+k).value)])));
 async function set(v){for(const [k,n]of Object.entries(v))await page.fill('#crop'+k,String(n));}
 async function drag(x,y,dx,dy){await page.locator('#cropCanvas').scrollIntoViewIfNeeded();const b=await page.locator('#cropCanvas').boundingBox();const sx=b.width/960,sy=b.height/680;await page.mouse.move(b.x+x*sx,b.y+y*sy);await page.mouse.down();await page.mouse.move(b.x+(x+dx)*sx,b.y+(y+dy)*sy,{steps:5});await page.mouse.up();}
 await set({W:300,H:180,X:100,Y:100});assert.equal(await page.isDisabled('#applyCrop'),false);
 await drag(150,130,80,40);let r=await fields();assert.equal(r.W,300);assert.equal(r.H,180);assert.ok(Math.abs(r.X-180)<=1);assert.ok(Math.abs(r.Y-140)<=1);console.log('PASS dragging inside preserves entered dimensions');
 await drag(r.X+30,r.Y+30,1200,900);r=await fields();assert.deepEqual(r,{X:660,Y:500,W:300,H:180});console.log('PASS edge clamps position without shrinking');
 await set({W:400});r=await fields();assert.equal(r.X,560);assert.equal(r.W,400);await set({W:1000});assert.equal(await page.isDisabled('#applyCrop'),true);assert.match(await page.locator('#cropError').innerText(),/不能超過/);await set({W:300});assert.equal(await page.isDisabled('#applyCrop'),false);console.log('PASS invalid sizes show error; valid size repositions frame');
 await page.click('#applyCrop');await page.waitForFunction(()=>!document.getElementById('exportReport').disabled);await page.click('#cropB');assert.equal((await fields()).W,300);console.log('PASS applied crop survives reopening');
 await page.uncheck('#cropLock');await drag(10,10,150,80);r=await fields();assert.ok(Math.abs(r.W-150)<=2);assert.ok(Math.abs(r.H-80)<=2);console.log('PASS unlocked selection draws a new rectangle');
 await set({W:160,H:90,X:100,Y:100});assert.equal(await page.isChecked('#cropLock'),true);
 await page.setViewportSize({width:390,height:844});await drag(120,120,40,30);r=await fields();assert.equal(r.W,160);assert.equal(r.H,90);assert.ok(Math.abs(r.X-140)<=2);assert.ok(Math.abs(r.Y-130)<=2);console.log('PASS scaled mobile preview maps pointer to original pixels');
 await page.keyboard.press('Escape');await page.click('#cropA');assert.equal(await page.isChecked('#cropLock'),false);await drag(20,20,200,100);r=await fields();assert.ok(Math.abs(r.W-200)<=2);assert.ok(Math.abs(r.H-100)<=2);assert.deepEqual(errors,[]);console.log('PASS Figma free selection remains available; no page errors');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});

