// Included inside workbench, sharing immutable originals and original-pixel crops.
let autoWorker=null,autoURL=null,autoTimer=null,autoJob=0,autoCandidates=[],autoSelected=null,autoContext=null,lockedScale=null,autoReview=null;
function cancelAuto(message='已取消搜尋；可繼續手動比對。'){
  autoJob++;autoWorker?.terminate();autoWorker=null;if(autoURL)URL.revokeObjectURL(autoURL);autoURL=null;clearTimeout(autoTimer);
  $('autoSearch').disabled=loadPending.a||loadPending.b||!originals.a||!originals.b;$('autoCancel').disabled=true;$('autoProgress').value=0;$('autoStatus').textContent=message;
  $('quickAutoSearch').disabled=$('autoSearch').disabled;
}
function invalidateAuto(resetScale=false){cancelAuto('圖片或選取範圍已更新，請重新搜尋。');autoCandidates=[];autoSelected=null;autoContext=null;autoReview=null;$('autoCandidates').replaceChildren();$('autoApply').disabled=true;if(resetScale){lockedScale=null;$('autoMode').value='estimate';$('autoScale').value=1;}if($('autoDialog').open)$('autoDialog').close();}
function areaImage(o,r){const c=document.createElement('canvas');c.width=r.width;c.height=r.height;ctx(c).drawImage(o.image,r.x,r.y,r.width,r.height,0,0,c.width,c.height);return ctx(c).getImageData(0,0,c.width,c.height);}
function autoRect(){const base=autoSelected.designRect||autoContext.rect,p=Number($('autoPadding').value);if(!Number.isInteger(p)||p<0||p>1000)throw Error('比較邊界請填 0～1000 的整數像素。');return PixelCompare.normalizeRect({x:base.x-p,y:base.y-p,width:base.width+2*p,height:base.height+2*p},originals.a.width,originals.a.height);}
function autoValues(){const c={...autoSelected,x:Number($('autoX').value),y:Number($('autoY').value),scale:Number($('autoScalePreview').value)};if(![c.x,c.y,c.scale].every(Number.isFinite)||c.scale<.1||c.scale>8||Math.abs(c.x)>MAX_SIDE||Math.abs(c.y)>MAX_SIDE)throw Error('位移需在 ±16384，倍率需在 0.1～8。');return c;}
function mapped(c,r){const base=autoSelected.designRect||autoContext.rect;return {x:c.x+(r.x-base.x)*c.scale,y:c.y+(r.y-base.y)*c.scale,width:r.width*c.scale,height:r.height*c.scale};}
function drawAutoPreview(){
  try{
    const c=autoValues(),r=autoRect(),o=originals.b,box=mapped(c,r),canvas=$('autoCanvas'),k=Math.min(1,1000/o.width,900/o.height);canvas.width=Math.round(o.width*k);canvas.height=Math.round(o.height*k);const g=ctx(canvas);
    g.drawImage(o.image,0,0,canvas.width,canvas.height);g.strokeStyle='#18855b';g.lineWidth=3;g.strokeRect(box.x*k,box.y*k,box.width*k,box.height*k);
    const design=$('autoDesign'),d=originals.a,dk=Math.min(1,1000/d.width,900/d.height);design.width=Math.round(d.width*dk);design.height=Math.round(d.height*dk);const dg=ctx(design);dg.drawImage(d.image,0,0,design.width,design.height);dg.fillStyle='#18382e66';dg.beginPath();dg.rect(0,0,design.width,design.height);dg.rect(r.x*dk,r.y*dk,r.width*dk,r.height*dk);dg.fill('evenodd');dg.strokeStyle='#18855b';dg.lineWidth=3;dg.strokeRect(r.x*dk,r.y*dk,r.width*dk,r.height*dk);
    const preview=$('autoOverlay'),z=Math.min(1,800/r.width,500/r.height);preview.width=Math.max(1,Math.round(r.width*z));preview.height=Math.max(1,Math.round(r.height*z));const pg=ctx(preview);pg.fillStyle='#fff';pg.fillRect(0,0,preview.width,preview.height);pg.drawImage(originals.a.image,r.x,r.y,r.width,r.height,0,0,preview.width,preview.height);pg.globalAlpha=.5;pg.drawImage(o.image,-box.x/c.scale*z,-box.y/c.scale*z,o.width/c.scale*z,o.height/c.scale*z);pg.globalAlpha=1;
    const covered=Math.max(0,Math.min(o.width,box.x+box.width)-Math.max(0,box.x))*Math.max(0,Math.min(o.height,box.y+box.height)-Math.max(0,box.y))/(box.width*box.height);
    $('autoPreviewInfo').textContent=`設計範圍 ${r.width} × ${r.height} px；網頁對應 ${box.width.toFixed(1)} × ${box.height.toFixed(1)} px；網頁／設計倍率 ${c.scale.toFixed(4)}（網頁校正倍率 ${(1/c.scale).toFixed(4)}）。此範圍覆蓋 ${(covered*100).toFixed(1)}%。${covered<.999?'部分未擷取，不能視為完整驗收。':''} ${autoContext.estimated?'倍率為影像估測，僅供視覺檢查。':'固定倍率；是否能換算 CSS px 取決於參考尺寸。'}`;
    $('autoApply').disabled=covered<=0;$('autoPreviewError').textContent='';
  }catch(e){$('autoPreviewError').textContent=e.message;$('autoApply').disabled=true;}
}
function chooseAuto(c){autoSelected=c;for(const [id,v]of [['autoX',c.x],['autoY',c.y],['autoScalePreview',c.scale]])$(id).value=Number(v.toFixed(5));$('autoScalePreview').disabled=autoContext.fixed;$('autoPadding').value=0;$('autoLocalNotice').hidden=!c.localOnly;$('autoApply').textContent=c.localOnly?'確認並比對此局部區塊':'確認並套用對齊';$('autoDialog').showModal();drawAutoPreview();}
function candidateThumb(o,r,label){const wrapper=document.createElement('span'),canvas=document.createElement('canvas'),caption=document.createElement('small');wrapper.className='auto-thumb';canvas.width=140;canvas.height=90;const scale=Math.min(140/r.width,90/r.height),w=r.width*scale,h=r.height*scale;ctx(canvas).drawImage(o.image,r.x,r.y,r.width,r.height,(140-w)/2,(90-h)/2,w,h);caption.textContent=label;wrapper.append(canvas,caption);return wrapper;}
function renderCandidates(){
  const list=$('autoCandidates');list.replaceChildren();
  autoCandidates.forEach((c,i)=>{const b=document.createElement('button');b.className='auto-candidate'+(c.localOnly?' local-candidate':'');b.type='button';const r=c.designRect||autoContext.rect,thumbs=document.createElement('span');thumbs.className='auto-thumb-pair';thumbs.append(candidateThumb(originals.a,r,'設計稿'),candidateThumb(originals.b,{x:c.x,y:c.y,width:r.width*c.scale,height:r.height*c.scale},'網頁'));const label=document.createElement('span');label.textContent=c.localOnly?`局部線索 ${i+1} · ${c.evidence.inliers} 個共同特徵 · ${c.scale.toFixed(3)} 倍（僅此區塊）`:`候選 ${i+1} · 匹配指標 ${c.score.toFixed(3)} · ${c.scale.toFixed(3)} 倍`;b.append(thumbs,label);b.onclick=()=>chooseAuto(c);list.append(b);});
}
async function startAuto(){
  cancelAuto('載入本機辨識引擎…');autoCandidates=[];autoSelected=null;$('autoCandidates').replaceChildren();
  if(loadPending.a||loadPending.b||!originals.a||!originals.b)return;
  const whole=$('autoScope').value==='page'||(!crops.a&&originals.a.height>originals.a.width*2),rect=whole?full(originals.a):(crops.a||full(originals.a)),search=$('autoUseSearch').checked&&crops.b?crops.b:full(originals.b);
  const fixed=$('autoMode').value==='fixed',scale=Number($('autoScale').value);
  if(fixed&&(!Number.isFinite(scale)||scale<.1||scale>8)){toast('固定倍率請填 0.1～8（網頁像素／設計圖片像素）。');return;}
  autoContext={rect:{...rect},search:{...search},fixed,estimated:!fixed||lockedScale?.estimated===true,whole};
  const id=autoJob,aSource=originals.a,bSource=originals.b;
  $('autoSearch').disabled=true;$('autoCancel').disabled=false;
  $('quickAutoSearch').disabled=true;
  try{
    let engine=window.FRAMECHECK_CV;
    if(!engine){if(location.protocol==='file:')throw Error('直接開啟檔案時，請改開 offline.html 使用完整離線辨識。手動比對仍可使用。');const response=await fetch('vendor/opencv-4.13.0.js');if(!response.ok)throw Error('無法載入本機 OpenCV 檔案。請使用完整工具資料夾或離線 HTML。');engine=await response.text();}
    if(id!==autoJob)return;
    autoURL=URL.createObjectURL(new Blob([engine,'\n',ALIGN_WORKER_SOURCE],{type:'text/javascript'}));autoWorker=new Worker(autoURL);
    autoTimer=setTimeout(()=>cancelAuto('搜尋逾時，請粗框較小的網頁搜尋範圍或改用手動對齊。'),90000);
    autoWorker.onerror=e=>{console.error('OpenCV worker:',e.message);if(id===autoJob)cancelAuto('辨識引擎無法執行，請確認瀏覽器支援 WebAssembly，或使用手動比對。');};
    autoWorker.onmessage=e=>{
      const m=e.data;if(id!==autoJob||originals.a!==aSource||originals.b!==bSource)return;
      if(m.error){cancelAuto(m.error);return;}
      if(m.progress){$('autoProgress').value=m.progress;$('autoStatus').textContent=m.label;}
      if(m.done){
        autoCandidates=m.candidates.map(c=>({...c,x:c.x+search.x,y:c.y+search.y}));
        if(!autoCandidates.length)autoCandidates=(m.localCandidates||[]).map(c=>({...c,x:c.x+search.x+c.anchorRect.x*c.scale,y:c.y+search.y+c.anchorRect.y*c.scale,designRect:{...c.anchorRect,x:rect.x+c.anchorRect.x,y:rect.y+c.anchorRect.y}}));
        cancelAuto(autoCandidates.length?(autoCandidates[0].localOnly?'整個範圍無法一致對齊，但找到共同圖樣。請點「局部線索」比對；文字、區塊間距或倍率可能不同。':'找到候選，請點選預覽並確認；匹配指標不是設計還原度。'):'沒有找到可靠的共同圖樣。請按「① 選設計稿元件」圈選同一張插畫、圖示或卡片後重試；不同文字與版型無法靠縮放變成相同。');$('autoProgress').value=100;renderCandidates();
      }
    };
    const a=areaImage(aSource,rect),b=areaImage(bSource,search);autoWorker.postMessage({id,a,b,fixed:fixed?scale:null,whole},[a.data.buffer,b.data.buffer]);
  }catch(e){if(id===autoJob)cancelAuto(e.message||'辨識失敗，請改用手動比對。');}
}
function applyAuto(){
  try{
    const c=autoValues(),r=autoRect(),box=mapped(c,r),a=originals.a,b=originals.b,ratio=applied.designRatio,w=Math.max(1,Math.round(r.width/ratio)),h=Math.max(1,Math.round(r.height/ratio));safeDimensions({width:w,height:h},{width:w,height:h},'original');
    const ca=document.createElement('canvas'),cb=document.createElement('canvas');ca.width=cb.width=w;ca.height=cb.height=h;
    ctx(ca).drawImage(a.image,r.x,r.y,r.width,r.height,0,0,w,h);
    ctx(cb).drawImage(b.image,-box.x/box.width*w,-box.y/box.height*h,b.width/box.width*w,b.height/box.height*h);
    const x=Math.max(0,Math.ceil(-box.x/box.width*w)),y=Math.max(0,Math.ceil(-box.y/box.height*h)),right=Math.min(w,Math.floor((b.width-box.x)/box.width*w)),bottom=Math.min(h,Math.floor((b.height-box.y)/box.height*h));
    const valid={x:Math.min(w,x),y:Math.min(h,y),width:Math.max(0,right-x),height:Math.max(0,bottom-y)};
    state.a={...a,image:ca,width:w,height:h,offsetX:0,offsetY:0};state.b={...b,image:cb,width:w,height:h,offsetX:0,offsetY:0,validRect:valid};
    const manualChanged=Math.abs(c.scale-autoSelected.scale)>1e-5||Math.abs(c.x-autoSelected.x)>.01||Math.abs(c.y-autoSelected.y)>.01;
    autoReview={method:autoSelected.method||'opencv-multiscale-gray-edge',engine:'4.13.0',scope:autoSelected.localOnly?'component':autoContext.whole?'page':'component',requestedScope:autoContext.whole?'page':'component',localOnly:!!autoSelected.localOnly,scale:c.scale,scaleSource:autoContext.estimated?'image-estimated':'user-reference',confirmed:true,manualAdjusted:manualChanged,designRect:r,webRect:box,searchRect:autoContext.search,score:autoSelected.score,evidence:autoSelected.evidence,coverage:valid.width*valid.height/(w*h)};
    if(!autoSelected.localOnly){lockedScale={scale:c.scale,estimated:autoContext.estimated};$('autoScale').value=c.scale;$('autoMode').value='fixed';}
    state.sizeMode='original';$('sizeMode').value='original';resetRegions();preparePair();refresh();$('autoDialog').close();$('autoStatus').textContent=autoSelected.localOnly?'已比對此局部區塊。此倍率不會鎖定為整頁倍率；請繼續檢查其他區塊。':'已套用；同一對圖片後續搜尋將固定此倍率。局部對齊不驗證元件在整頁的位置。';
  }catch(e){$('autoPreviewError').textContent=e.message;}
}
$('autoSearch').onclick=startAuto;$('autoCancel').onclick=()=>cancelAuto();$('autoApply').onclick=applyAuto;$('autoClose').onclick=()=>$('autoDialog').close();
$('quickAutoSearch').onclick=()=>{startAuto();$('autoStatus').scrollIntoView({behavior:'smooth',block:'center'});};
function searchSettingsChanged(){cancelAuto('搜尋設定已更新，請重新搜尋。');autoCandidates=[];autoSelected=null;autoContext=null;$('autoCandidates').replaceChildren();$('autoApply').disabled=true;}
$('autoMode').onchange=()=>{if($('autoMode').value==='estimate')lockedScale=null;searchSettingsChanged();};
$('autoScale').oninput=()=>{lockedScale=null;searchSettingsChanged();};
for(const id of ['autoScope','autoUseSearch'])$(id).onchange=searchSettingsChanged;
for(const id of ['autoX','autoY','autoScalePreview','autoPadding'])$(id).oninput=drawAutoPreview;
let autoDrag=null;
$('autoCanvas').onpointerdown=e=>{if(e.button!==0)return;e.preventDefault();autoDrag={x:e.clientX,y:e.clientY,start:autoValues(),pointer:e.pointerId};$('autoCanvas').setPointerCapture(e.pointerId);};
$('autoCanvas').onpointermove=e=>{if(!autoDrag||autoDrag.pointer!==e.pointerId)return;const b=$('autoCanvas').getBoundingClientRect();$('autoX').value=(autoDrag.start.x+(e.clientX-autoDrag.x)*originals.b.width/b.width).toFixed(2);$('autoY').value=(autoDrag.start.y+(e.clientY-autoDrag.y)*originals.b.height/b.height).toFixed(2);drawAutoPreview();};
for(const name of ['onpointerup','onpointercancel','onlostpointercapture'])$('autoCanvas')[name]=()=>{autoDrag=null;};
$('autoDialog').addEventListener('close',()=>{autoDrag=null;});
window.addEventListener('pagehide',()=>cancelAuto());
