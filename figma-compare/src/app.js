(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const MAX_PIXELS = 12000000, MAX_FILE = 12 * 1024 * 1024, MAX_SIDE = 16384;
  const state = { a: null, b: null, width: 0, height: 0, bWidth: 0, bHeight: 0, mode: 'side', blend: 50, threshold: 16, sizeMode: 'original', region: null, ignores: [], tool: null, draft: null, result: null, scale: 1, busy: false };
  const baseA = document.createElement('canvas'), baseB = document.createElement('canvas'), diff = document.createElement('canvas');
  let dataA, dataB, pending, toastTimer, loadSequence = { a: 0, b: 0 };
  const number = n => n.toLocaleString('zh-TW');
  const ctx = c => c.getContext('2d', { willReadFrequently: true });
  function toast(message) { $('toast').textContent = message; $('toast').hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(() => { $('toast').hidden = true; }, 5500); }
  function hasPair() { return !!(state.a && state.b); }
  function resetApproval() { $('approved').checked = false; $('saveBaseline').disabled = true; }
  function safeDimensions(a, b, mode) {
    let bw = b?.width || 0, bh = b?.height || 0;
    if (a && b && mode === 'width') { bw = a.width; bh = Math.max(1, Math.round(b.height * a.width / b.width)); }
    const width = Math.max(a?.width || 0, bw), height = Math.max(a?.height || 0, bh);
    if (width * height > MAX_PIXELS || width > MAX_SIDE || height > MAX_SIDE) throw new Error('合成畫布超過 1,200 萬像素或單邊 16,384 px，請先裁切圖片或改用較小的截圖。');
    return { width, height, bw, bh };
  }
  function resetRegions() { state.region = null; state.ignores = []; state.draft = null; setTool(null); updateRegions(); }
  async function importFile(file, key) {
    if (!file) return;
    const sequence = ++loadSequence[key];
    let url;
    try {
      if (!/\.(png|jpe?g|webp)$/i.test(file.name) || (file.type && !['image/png', 'image/jpeg', 'image/webp'].includes(file.type))) throw new Error('請使用 PNG、JPG 或 WebP 圖片。');
      if (file.size > MAX_FILE) throw new Error('圖片超過 12 MB，請先裁切或減少匯出尺寸。');
      url = URL.createObjectURL(file);
      const img = new Image(); img.src = url;
      await img.decode();
      if (sequence !== loadSequence[key]) { URL.revokeObjectURL(url); return; }
      if (!img.naturalWidth || !img.naturalHeight || img.naturalWidth * img.naturalHeight > MAX_PIXELS || Math.max(img.naturalWidth, img.naturalHeight) > MAX_SIDE) throw new Error('圖片超過 1,200 萬像素或單邊 16,384 px，請先裁切。');
      const source = { image: img, width: img.naturalWidth, height: img.naturalHeight, name: file.name, url, fileBytes: file.size, demo: false };
      safeDimensions(key === 'a' ? source : state.a, key === 'b' ? source : state.b, state.sizeMode);
      if (state[key]?.url) URL.revokeObjectURL(state[key].url);
      state[key] = source;
      resetRegions(); resetApproval(); updateSource(key); preparePair();
      toast(`${key === 'a' ? '設計稿' : '網頁截圖'}已加入`);
    } catch (e) { if (url) URL.revokeObjectURL(url); if (sequence === loadSequence[key]) toast(e.name === 'EncodingError' ? '無法解碼這張圖片，請確認檔案沒有損毀。' : e.message || '無法讀取圖片，請確認檔案沒有損毀。'); }
  }
  function updateSource(key) {
    const source = state[key], suffix = key.toUpperCase();
    $('name' + suffix).textContent = source.name;
    $('meta' + suffix).textContent = `${number(source.width)} × ${number(source.height)} px`;
    $('thumb' + suffix).src = source.url; $('thumb' + suffix).hidden = false;
    $('drop' + suffix).classList.add('loaded');
    $('drop' + suffix).querySelector('.upload-icon').textContent = '更換圖片 ↗';
  }
  function enablePairControls(ready) {
    ['regionTool','ignoreTool','addRegion','addIgnore','approved'].forEach(id => { $(id).disabled = !ready; });
  }
  function preparePair() {
    state.result = null; resetApproval();
    $('exportDiff').disabled = true; $('exportReport').disabled = true;
    enablePairControls(hasPair());
    if (!hasPair()) {
      const count = Number(!!state.a) + Number(!!state.b);
      $('emptyMessage').textContent = state.a ? '設計稿已就緒，再加入一張實際網頁截圖。' : state.b ? '網頁截圖已就緒，再加入一張 Figma 設計稿。' : '加入設計稿與網頁截圖，開始你的第一次比對。';
      $('emptyUpload').textContent = state.a ? '選擇網頁截圖 ↗' : '選擇設計稿 ↗';
      $('canvasStatus').textContent = count ? '已加入 1 / 2 張圖片' : '等待加入兩張圖片';
      return;
    }
    const dims = safeDimensions(state.a, state.b, state.sizeMode);
    Object.assign(state, { width: dims.width, height: dims.height, bWidth: dims.bw, bHeight: dims.bh });
    [baseA,baseB,diff,$('canvasA'),$('canvasB')].forEach(c => { c.width = state.width; c.height = state.height; });
    ctx(baseA).fillStyle = '#fff'; ctx(baseA).fillRect(0,0,state.width,state.height); ctx(baseA).drawImage(state.a.image,0,0);
    ctx(baseB).fillStyle = '#fff'; ctx(baseB).fillRect(0,0,state.width,state.height); ctx(baseB).drawImage(state.b.image,0,0,state.bWidth,state.bHeight);
    dataA = ctx(baseA).getImageData(0,0,state.width,state.height).data;
    dataB = ctx(baseB).getImageData(0,0,state.width,state.height).data;
    $('emptyState').hidden = true; $('imageStage').hidden = false;
    $('canvasSize').textContent = `${state.width} × ${state.height}`;
    const notices = [];
    if (state.sizeMode === 'width' && state.a.width !== state.b.width) notices.push(`網頁圖已按 ${Math.round(state.bWidth / state.b.width * 10000)/100}% 等比例縮放；插值會影響像素色差。`);
    if (state.a.width !== state.bWidth || state.a.height !== state.bHeight) notices.push(`尺寸不一致：設計稿 ${state.a.width} × ${state.a.height}，網頁 ${state.bWidth} × ${state.bHeight}。左上對齊，單側缺失區計入差異。`);
    $('dimensionNotice').textContent = notices.join(' '); $('dimensionNotice').hidden = notices.length === 0;
    applyZoom(); draw(); calculate();
  }
  function calculate() {
    if (!hasPair()) return;
    clearTimeout(pending); state.result = null; state.busy = true; resetApproval();
    $('exportDiff').disabled = true; $('exportReport').disabled = true;
    $('ratio').textContent = '…'; $('changed').textContent = '…'; $('canvasStatus').textContent = '正在計算像素差異…';
    pending = setTimeout(() => {
      try {
        const result = PixelCompare.compare({ a: dataA, b: dataB, width: state.width, height: state.height, threshold: state.threshold, region: state.region, ignores: state.ignores, aSize: {width:state.a.width,height:state.a.height}, bSize:{width:state.bWidth,height:state.bHeight} });
        state.result = result; ctx(diff).putImageData(new ImageData(result.data,state.width,state.height),0,0);
        $('ratio').innerHTML = result.ratio === null ? '—' : `${(result.ratio * 100).toFixed(2)}<small>%</small>`;
        $('changed').textContent = number(result.changed);
        $('compared').textContent = result.compared ? `共 ${number(result.compared)} 個有效比較像素` : '沒有有效比較像素，請調整範圍';
        $('ignored').innerHTML = `${state.ignores.length}<small>區</small>`;
        $('ignoredPixels').textContent = `排除 ${number(result.ignored)} 個範圍內像素`;
        $('canvasStatus').textContent = result.ratio === null ? '所有像素已排除，沒有可比較的內容' : `比對完成 · ${state.region ? '所選範圍' : '整張圖片'}${state.a.demo || state.b.demo ? ' · 示範資料' : ''}`;
        $('exportDiff').disabled = false; $('exportReport').disabled = false;
      } catch (e) { $('canvasStatus').textContent = '比對失敗，請減少圖片尺寸後重試'; toast(e.message); }
      state.busy = false; draw();
    }, 55);
  }
  function setMode(mode) {
    state.mode = mode;
    document.querySelectorAll('[data-mode]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.mode === mode)));
    $('figureB').hidden = mode !== 'side';
    $('modeControls').hidden = !['overlay','wipe'].includes(mode);
    $('blendLabel').textContent = mode === 'wipe' ? '分界線位置' : '網頁透明度';
    $('modeHelp').textContent = mode === 'wipe' ? '左側設計稿，右側網頁；可直接拖曳圖片' : '設計稿在下方，網頁在上方';
    $('captionA').textContent = {side:'Figma 設計稿',overlay:'設計稿 + 網頁疊圖',wipe:'Figma 設計稿 ↔ 實際網頁',diff:'差異圖 · 粉紅色為差異像素'}[mode];
    applyZoom(); draw(); updateCursor();
  }
  function applyZoom() {
    if (!hasPair()) return;
    const available = Math.max(120,$('viewport').clientWidth - (window.innerWidth <= 760 ? 32 : 48));
    state.scale = $('zoom').value === 'fit' ? Math.min(1, (available - (state.mode === 'side' ? 20 : 0)) / ((state.mode === 'side' ? 2 : 1) * state.width)) : Number($('zoom').value);
    for (const suffix of ['A','B']) {
      $('canvas' + suffix).style.width = state.width * state.scale + 'px'; $('canvas' + suffix).style.height = state.height * state.scale + 'px';
      $('wrap' + suffix).style.width = state.width * state.scale + 'px';
    }
    drawMarks();
  }
  function draw() {
    if (!hasPair()) return;
    const out = ctx($('canvasA')); out.globalAlpha = 1; out.clearRect(0,0,state.width,state.height);
    if (state.mode === 'diff' && state.result) out.drawImage(diff,0,0);
    else {
      out.drawImage(baseA,0,0);
      if (state.mode === 'overlay') { out.globalAlpha = state.blend / 100; out.drawImage(baseB,0,0); out.globalAlpha = 1; }
      if (state.mode === 'wipe') { out.save(); out.beginPath(); out.rect(state.width * state.blend / 100,0,state.width,state.height); out.clip(); out.drawImage(baseB,0,0); out.restore(); }
    }
    if (state.mode === 'side') ctx($('canvasB')).drawImage(baseB,0,0);
    $('wipeHandle').hidden = state.mode !== 'wipe'; $('wipeHandle').style.left = state.blend + '%';
    drawMarks();
  }
  function svgNode(tag,attrs) { const el = document.createElementNS('http://www.w3.org/2000/svg',tag); Object.entries(attrs).forEach(([key,value]) => el.setAttribute(key,value)); return el; }
  function drawMarks() {
    if (!hasPair()) return;
    for (const id of ['marksA','marksB']) {
      const svg = $(id); svg.replaceChildren(); svg.setAttribute('viewBox',`0 0 ${state.width} ${state.height}`);
      const stroke = 1.5 / state.scale;
      if (state.region) {
        const {x,y,width:w,height:h} = state.region;
        svg.append(svgNode('path',{d:`M0 0H${state.width}V${state.height}H0Z M${x} ${y}H${x+w}V${y+h}H${x}Z`,'fill-rule':'evenodd',fill:'#263b34',opacity:'.17'}));
        svg.append(svgNode('rect',{x,y,width:w,height:h,fill:'none',stroke:'#326653','stroke-width':stroke}));
      }
      state.ignores.forEach((r,i) => {
        svg.append(svgNode('rect',{x:r.x,y:r.y,width:r.width,height:r.height,fill:'#dba04a','fill-opacity':'.18',stroke:'#c48e41','stroke-width':stroke,'stroke-dasharray':`${4/state.scale} ${3/state.scale}`}));
        const t = svgNode('text',{x:r.x+4/state.scale,y:r.y+13/state.scale,'font-size':10/state.scale,fill:'#976b2f','font-family':'sans-serif'}); t.textContent = `忽略 ${i+1}`; svg.append(t);
      });
      if (state.draft) { const r = state.draft; svg.append(svgNode('rect',{x:r.x,y:r.y,width:r.width,height:r.height,fill:state.tool==='ignore'?'#dba04a':'#326653','fill-opacity':'.16',stroke:state.tool==='ignore'?'#b17f38':'#326653','stroke-width':stroke,'stroke-dasharray':`${4/state.scale} ${3/state.scale}`})); }
    }
  }
  function updateCursor() { ['wrapA','wrapB'].forEach(id => { $(id).classList.toggle('drawing',!!state.tool); $(id).classList.toggle('wiping',!state.tool && state.mode === 'wipe'); }); }
  function setTool(tool) { state.tool = tool; state.draft = null; $('regionTool').setAttribute('aria-pressed',String(tool === 'region')); $('ignoreTool').setAttribute('aria-pressed',String(tool === 'ignore')); $('toolHint').textContent = tool ? `在圖片上拖曳${tool === 'region' ? '比較' : '忽略'}區域。Esc 取消。` : '選取工具後，在圖片上拖曳矩形。Esc 取消。'; updateCursor(); drawMarks(); }
  function addRect(rect,type) {
    const valid = PixelCompare.normalizeRect(rect,state.width,state.height);
    if (!valid) { toast('區域必須落在圖片內，且寬高大於 0。'); return; }
    if (type === 'region') state.region = valid;
    else { if (state.ignores.length >= 50) { toast('最多支援 50 個忽略區域。'); return; } state.ignores.push(valid); }
    state.draft = null; updateRegions(); drawMarks(); calculate();
  }
  function updateRegions() {
    $('clearRegions').disabled = !state.region && !state.ignores.length;
    const list = $('regionList'); list.replaceChildren();
    if (!state.region && !state.ignores.length) { const p = document.createElement('p'); p.className='no-region'; p.textContent='目前比對整張圖片'; list.append(p); return; }
    function row(r,label,remove) { const div = document.createElement('div'); div.className='region-item'; const text = document.createElement('span'); text.textContent=label; const detail=document.createElement('small'); detail.textContent=`${r.x},${r.y} · ${r.width}×${r.height}`; const button=document.createElement('button'); button.type='button';button.textContent='×';button.setAttribute('aria-label',`移除${label}`);button.onclick=remove;div.append(text,detail,button);list.append(div); }
    if (state.region) row(state.region,'比較範圍',()=>{state.region=null;updateRegions();drawMarks();calculate();});
    state.ignores.forEach((r,i)=>row(r,`忽略 ${i+1}`,()=>{state.ignores.splice(i,1);updateRegions();drawMarks();calculate();}));
  }
  function setBlend(value) { state.blend=Math.max(0,Math.min(100,Math.round(value)));$('blend').value=state.blend;$('blendValue').textContent=state.blend+'%';draw(); }
  ['wrapA','wrapB'].forEach(id=>{
    const wrap=$(id); let start=null, pointerId=null, drawingTool=null;
    const point=e=>{const box=wrap.getBoundingClientRect();return {x:Math.max(0,Math.min(state.width,(e.clientX-box.left)/state.scale)),y:Math.max(0,Math.min(state.height,(e.clientY-box.top)/state.scale))};};
    wrap.addEventListener('pointerdown',e=>{if(!hasPair()||e.button!==0)return; if(!state.tool&&state.mode!=='wipe')return; e.preventDefault();pointerId=e.pointerId;wrap.setPointerCapture(pointerId);start=point(e);drawingTool=state.tool;if(!drawingTool)setBlend(start.x/state.width*100);});
    wrap.addEventListener('pointermove',e=>{if(!hasPair())return;const p=point(e);$('coordStatus').textContent=`X ${Math.round(p.x)} · Y ${Math.round(p.y)} px`;if(!start||e.pointerId!==pointerId)return;if(!drawingTool){setBlend(p.x/state.width*100);return;}state.draft=PixelCompare.normalizeRect({x:start.x,y:start.y,width:p.x-start.x,height:p.y-start.y},state.width,state.height);drawMarks();});
    wrap.addEventListener('pointerup',e=>{if(!start||e.pointerId!==pointerId)return;const p=point(e),from=start,type=drawingTool;start=null;pointerId=null;drawingTool=null;if(wrap.hasPointerCapture(e.pointerId))wrap.releasePointerCapture(e.pointerId);if(type&&state.tool===type&&Math.abs(p.x-from.x)*state.scale>=3&&Math.abs(p.y-from.y)*state.scale>=3)addRect({x:from.x,y:from.y,width:p.x-from.x,height:p.y-from.y},type);state.draft=null;drawMarks();});
    wrap.addEventListener('pointercancel',()=>{start=null;pointerId=null;drawingTool=null;state.draft=null;drawMarks();});
    wrap.addEventListener('lostpointercapture',()=>{start=null;pointerId=null;drawingTool=null;state.draft=null;drawMarks();});
  });
  function download(blob,name) { const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),30000); }
  function canvasDownload(canvas,name) { canvas.toBlob(blob=>{if(blob)download(blob,name);else toast('圖片匯出失敗，請減少圖片尺寸。');},'image/png'); }
  function report() {
    const r=state.result;
    const source=s=>({name:s.name,width:s.width,height:s.height,bytes:s.fileBytes,demo:s.demo});
    return {schemaVersion:1,tool:'Framecheck',createdAt:new Date().toISOString(),reference:source(state.a),web:source(state.b),canvas:{width:state.width,height:state.height},settings:{threshold:state.threshold,algorithm:'max RGB channel delta > threshold; alpha composited on white; missing source area is always changed',sizeMode:state.sizeMode,effectiveWebSize:{width:state.bWidth,height:state.bHeight},region:state.region,ignores:state.ignores},result:{changed:r.changed,compared:r.compared,ignored:r.ignored,ratio:r.ratio,bounds:r.bounds},review:{approved:$('approved').checked,note:$('reviewNote').value},notice:'像素差異比例不等於設計還原度分數。忽略區域與比較範圍以合成畫布像素為單位。'};
  }
  function drawDemo(variant) {
    const c=document.createElement('canvas');c.width=960;c.height=680;const x=ctx(c);
    const box=(left,top,w,h,color,r=0)=>{x.fillStyle=color;x.beginPath();x.roundRect(left,top,w,h,r);x.fill();};
    const text=(str,left,top,size=14,color='#566356',weight=400)=>{x.font=`${weight} ${size}px "Segoe UI", "Microsoft JhengHei", sans-serif`;x.fillStyle=color;x.fillText(str,left,top);};
    box(0,0,960,680,'#f5f7f2');box(0,0,960,70,'#fff');text('folio.',32,44,24,'#315c48',700);text('工作空間',185,41,13);text('專案',291,41,13);text('團隊',355,41,13);box(822,23,105,28,'#e8efe4',14);text(variant?'Hello, Alex':'Hello, Jamie',837,42,12,'#4d6c44');
    text('WORKSPACE / OVERVIEW',42,115,10,'#91a186',600);text('專案總覽',42,158,29,'#263d2c',600);text('把每個想法，變成值得期待的作品。',43,187,13,'#83917a');
    box(784,131,132,39,variant?'#648662':'#355d46',7);text('＋ 建立新專案',800,156,13,'#fff',500);
    [['進行中的專案','12','本月新增 3 個'],['待確認項目','08','需要你的回覆'],['完成率','86%','較上月增加 12%']].forEach((v,i)=>{const left=42+i*295,top=226;box(left,top,281,115,'#fff',9);text(v[0],left+20,top+28,12,'#86957d');text(v[1],left+20,top+69,30,'#2f4f37',600);text(v[2],left+20,top+94,11,'#8e9d85');});
    text('最近的專案',43,389,16,'#324b36',600);text('查看全部 →',843,389,11,'#78906c');
    const shift=variant?12:0;
    [['品牌網站改版','設計系統 / 網頁設計','#e4eadd'],['會員中心優化','介面設計 / 使用者體驗','#ebe6db'],['年度視覺計畫','品牌策略 / 視覺設計','#e0e7e9']].forEach((v,i)=>{const left=42+i*295,top=412+(i===1?shift:0);box(left,top,281,224,'#fff',9);box(left+12,top+12,257,119,v[2],6);box(left+67,top+35,145,76,'#ffffff99',5);box(left+79,top+48,70,8,'#a4b69d',2);box(left+79,top+66,116,4,'#d3ddce',2);box(left+79,top+77,90,4,'#d3ddce',2);box(left+79,top+90,36,10,'#79956d',2);text(v[0],left+17,top+157,14,'#42583c',600);text(v[1],left+17,top+179,11,'#8b9980');box(left+17,top+195,47,17,'#ecf1e7',8);text('進行中',left+23,top+207,9,'#79916a');text(variant?'10/28 更新':'10/26 更新',left+193,top+207,9,'#9aa690');});
    if(variant){box(344,270,100,32,'#fff');text('09',357,295,30,'#2f4f37',600);}
    return c;
  }
  async function demo() {
    const sequence = { a: ++loadSequence.a, b: ++loadSequence.b };
    try {
      const pair=await Promise.all([false,true].map(async variant=>{const canvas=drawDemo(variant);const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));return {image:canvas,width:canvas.width,height:canvas.height,name:variant?'demo-web.png':'demo-design.png',url:URL.createObjectURL(blob),fileBytes:blob.size,demo:true};}));
      if (sequence.a !== loadSequence.a || sequence.b !== loadSequence.b) { pair.forEach(source=>URL.revokeObjectURL(source.url)); return; }
      for(const key of ['a','b'])if(state[key]?.url)URL.revokeObjectURL(state[key].url);
      state.a=pair[0];state.b=pair[1];state.sizeMode='original';$('sizeMode').value='original';resetRegions();updateSource('a');updateSource('b');switchTab('a');preparePair();toast('示範圖片已加入：試試疊圖，看看中間卡片的位置。');
    } catch(e){toast('示範載入失敗：'+e.message);}
  }
  function switchTab(tab) { const isA=tab==='a';$('panelA').hidden=!isA;$('panelB').hidden=isA;for(const [id,active] of [['tabA',isA],['tabB',!isA]]){$(id).setAttribute('aria-selected',String(active));$(id).tabIndex=active?0:-1;} if(isA)requestAnimationFrame(applyZoom); }
  function settings() { return {url:$('testUrl').value.trim(),viewport:{width:Number($('testWidth').value),height:Number($('testHeight').value)},maskSelectors:$('maskSelectors').value.split('\n').map(s=>s.trim()).filter(Boolean),readySelector:$('readySelector').value.trim()}; }
  function previewSettings() { $('settingsPreview').textContent=JSON.stringify(settings(),null,2); }
  // ZIP STORE format: no external library and no network. UTF-8 entry names and CRC-32.
  function zipFiles(files) {
    const encoder=new TextEncoder();const locals=[],centrals=[];let offset=0;
    const table=new Uint32Array(256);for(let i=0;i<256;i++){let c=i;for(let j=0;j<8;j++)c=c&1?0xedb88320^(c>>>1):c>>>1;table[i]=c>>>0;}
    for(const [name,content] of Object.entries(files)){
      const filename=encoder.encode(name),bytes=encoder.encode(content);let crc=0xffffffff;for(const byte of bytes)crc=table[(crc^byte)&255]^(crc>>>8);crc=(crc^0xffffffff)>>>0;
      const local=new Uint8Array(30+filename.length),l=new DataView(local.buffer);l.setUint32(0,0x04034b50,true);l.setUint16(4,20,true);l.setUint16(6,0x0800,true);l.setUint16(12,33,true);l.setUint32(14,crc,true);l.setUint32(18,bytes.length,true);l.setUint32(22,bytes.length,true);l.setUint16(26,filename.length,true);local.set(filename,30);locals.push(local,bytes);
      const central=new Uint8Array(46+filename.length),v=new DataView(central.buffer);v.setUint32(0,0x02014b50,true);v.setUint16(4,20,true);v.setUint16(6,20,true);v.setUint16(8,0x0800,true);v.setUint16(14,33,true);v.setUint32(16,crc,true);v.setUint32(20,bytes.length,true);v.setUint32(24,bytes.length,true);v.setUint16(28,filename.length,true);v.setUint32(42,offset,true);central.set(filename,46);centrals.push(central);offset+=local.length+bytes.length;
    }
    const centralLength=centrals.reduce((total,b)=>total+b.length,0),end=new Uint8Array(22),e=new DataView(end.buffer);e.setUint32(0,0x06054b50,true);e.setUint16(8,centrals.length,true);e.setUint16(10,centrals.length,true);e.setUint32(12,centralLength,true);e.setUint32(16,offset,true);return new Blob([...locals,...centrals,end],{type:'application/zip'});
  }
  for(const key of ['a','b']){
    const suffix=key.toUpperCase();$('file'+suffix).addEventListener('change',e=>{importFile(e.target.files[0],key);e.target.value='';});
    const drop=$('drop'+suffix);drop.addEventListener('dragover',e=>{e.preventDefault();drop.classList.add('drag-over');});drop.addEventListener('dragleave',()=>drop.classList.remove('drag-over'));drop.addEventListener('drop',e=>{e.preventDefault();drop.classList.remove('drag-over');if(e.dataTransfer.files.length>1)toast('每個來源一次選擇一張圖片。');else importFile(e.dataTransfer.files[0],key);});
  }
  window.addEventListener('dragover',e=>e.preventDefault());window.addEventListener('drop',e=>e.preventDefault());
  document.querySelectorAll('[data-mode]').forEach(button=>button.addEventListener('click',()=>setMode(button.dataset.mode)));
  $('zoom').addEventListener('change',applyZoom);new ResizeObserver(()=>{if(!$('panelA').hidden)applyZoom();}).observe($('viewport'));
  $('blend').addEventListener('input',e=>setBlend(Number(e.target.value)));
  $('threshold').addEventListener('input',e=>{state.threshold=Number(e.target.value);$('thresholdValue').textContent=`${state.threshold} / 255`;calculate();});
  $('sizeMode').addEventListener('change',e=>{try{safeDimensions(state.a,state.b,e.target.value);state.sizeMode=e.target.value;resetRegions();preparePair();}catch(error){e.target.value=state.sizeMode;toast(error.message);}});
  $('regionTool').onclick=()=>setTool(state.tool==='region'?null:'region');$('ignoreTool').onclick=()=>setTool(state.tool==='ignore'?null:'ignore');
  $('clearRegions').onclick=()=>{resetRegions();calculate();drawMarks();};
  for(const [id,type] of [['addRegion','region'],['addIgnore','ignore']])$(id).onclick=()=>{const r={x:Number($('rectX').value),y:Number($('rectY').value),width:Number($('rectW').value),height:Number($('rectH').value)};if(!Object.values(r).every(Number.isFinite)||r.width<=0||r.height<=0||r.x<0||r.y<0){toast('請輸入有效的非負座標與正數寬高。');return;}addRect(r,type);};
  $('exportDiff').onclick=()=>{if(state.result)canvasDownload(diff,'framecheck-diff.png');};
  $('exportReport').onclick=()=>{if(state.result)download(new Blob([JSON.stringify(report(),null,2)],{type:'application/json'}),'framecheck-report.json');};
  $('approved').onchange=()=>{$('saveBaseline').disabled=!$('approved').checked||!hasPair();};
  $('saveBaseline').onclick=()=>{if(!$('approved').checked||!state.b)return;const c=document.createElement('canvas');c.width=state.b.width;c.height=state.b.height;ctx(c).drawImage(state.b.image,0,0);canvasDownload(c,'approved-web-baseline.png');toast('已保存原始網頁 PNG。請同時下載比對報告，留存核准紀錄。');};
  $('demoButton').onclick=demo;$('emptyDemo').onclick=demo;$('emptyUpload').onclick=()=>$(state.a?'fileB':'fileA').click();
  $('tabA').onclick=()=>switchTab('a');$('tabB').onclick=()=>switchTab('b');
  for(const id of ['tabA','tabB'])$(id).addEventListener('keydown',e=>{if(['ArrowLeft','ArrowRight','Home','End'].includes(e.key)){e.preventDefault();const tab=e.key==='Home'?'a':e.key==='End'?'b':id==='tabA'?'b':'a';switchTab(tab);$(tab==='a'?'tabA':'tabB').focus();}});
  $('regressionForm').addEventListener('input',previewSettings);
  $('regressionForm').addEventListener('submit',e=>{e.preventDefault();const values=settings();try{const url=new URL(values.url);if(!['http:','https:'].includes(url.protocol))throw new Error();}catch{toast('請輸入 http 或 https 網址。');return;}if(!Number.isInteger(values.viewport.width)||!Number.isInteger(values.viewport.height)){toast('畫面尺寸請使用整數。');return;}const files={...REGRESSION_TEMPLATES,'regression.settings.json':JSON.stringify(values,null,2)+'\n'};download(zipFiles(files),'framecheck-playwright.zip');toast('範本已下載。解壓縮後請先閱讀 README.md。');});
  $('helpButton').onclick=()=>{if(!$('helpDialog').open)$('helpDialog').showModal();};$('closeHelp').onclick=()=>$('helpDialog').close();$('helpDone').onclick=()=>$('helpDialog').close();
  document.addEventListener('keydown',e=>{if(e.key==='Escape')setTool(null);});
  previewSettings();
})();
