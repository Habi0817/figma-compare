  // Runs inside the app closure; originals remain untouched for baseline export.
  workbench = (() => {
    const originals={a:null,b:null}, crops={a:null,b:null};
    let applied={designRatio:1,webRatio:1,webRatioKnown:false,offsetX:0,offsetY:0};
    let cropKey=null,cropDraft=null,cropStart=null,cropVersion=null,stream=null,captureGeneration=0,capturePending=false;
    const full=s=>({x:0,y:0,width:s.width,height:s.height});
    function sourceChanged(key,source){
      originals[key]=source;crops[key]=null;
      if(cropKey===key && $('cropDialog').open)$('cropDialog').close();
      if(key==='a'){$('designRatio').value=1;applied.designRatio=1;$('frameWidth').value='';}
      else{$('webRatio').value=1;$('webRatioKnown').checked=false;applied.webRatio=1;applied.webRatioKnown=false;}
      applied.offsetX=applied.offsetY=0;$('offsetX').value=0;$('offsetY').value=0;
      if(state.b){state.b.offsetX=0;state.b.offsetY=0;}
      refresh();
    }
    function refresh(){
      $('cropA').disabled=!originals.a;$('cropB').disabled=!originals.b;
      $('resetAlignment').disabled=!originals.a&&!originals.b;
      $('applyAlignment').disabled=!hasPair();$('alignTopLeft').disabled=!hasPair();$('alignCenter').disabled=!hasPair();
      $('cropSummary').textContent=['a','b'].map(k=>{const r=crops[k];return `${k==='a'?'設計':'網頁'}：${r?`${r.x},${r.y} · ${r.width}×${r.height}`:'整張圖片'}`;}).join(' ／ ');
      if(hasPair())$('sizeComparison').textContent=`校正後：設計 ${state.a.width}×${state.a.height}；網頁 ${state.b.width}×${state.b.height}。寬差 ${state.b.width-state.a.width}、高差 ${state.b.height-state.a.height} ${applied.webRatioKnown?'校正 px（手動框選估測）':'比較像素（非精確 CSS px）'}。`;
    }
    function values(){
      const v={designRatio:Number($('designRatio').value),webRatio:Number($('webRatio').value),webRatioKnown:$('webRatioKnown').checked,offsetX:Number($('offsetX').value),offsetY:Number($('offsetY').value)};
      if(![v.designRatio,v.webRatio].every(n=>Number.isFinite(n)&&n>=.1&&n<=8))throw Error('倍率請輸入 0.1～8。');
      if(!v.webRatioKnown&&v.webRatio!==1)throw Error('調整網頁倍率前，請確認並勾選已知擷取倍率。');
      if(![v.offsetX,v.offsetY].every(n=>Number.isSafeInteger(n)&&Math.abs(n)<=MAX_SIDE))throw Error('位移請輸入 ±16,384 內的整數。');
      return v;
    }
    function dimensionsFor(key,v){const o=originals[key];if(!o)return null;const r=crops[key]||full(o),ratio=key==='a'?v.designRatio:v.webRatio;return {width:Math.max(1,Math.round(r.width/ratio)),height:Math.max(1,Math.round(r.height/ratio)),offsetX:key==='b'?v.offsetX:0,offsetY:key==='b'?v.offsetY:0};}
    function transformed(key,v,d){
      const o=originals[key];if(!o)return null;const r=crops[key]||full(o);
      const c=document.createElement('canvas');c.width=d.width;c.height=d.height;
      ctx(c).drawImage(o.image,r.x,r.y,r.width,r.height,0,0,c.width,c.height);
      return {...o,...d,image:c};
    }
    function apply(v=values()){
      const a=dimensionsFor('a',v),b=dimensionsFor('b',v);safeDimensions(a,b,'original');
      const nextA=transformed('a',v,a),nextB=transformed('b',v,b);
      state.a=nextA;state.b=nextB;state.sizeMode='original';$('sizeMode').value='original';applied={...v};
      resetRegions();preparePair();refresh();
    }
    function attempt(fn){try{fn();}catch(e){toast(e.message);}}
    $('applyAlignment').onclick=()=>attempt(()=>{apply();toast('已套用；舊的比較範圍、忽略區域與核准狀態已重設。');});
    $('useFrameWidth').onclick=()=>attempt(()=>{if(!originals.a)throw Error('請先加入設計稿。');const w=Number($('frameWidth').value);const ratio=originals.a.width/w;if(!Number.isFinite(w)||w<=0||ratio<.1||ratio>8)throw Error('請填入整張圖片對應的 Frame 寬度；換算倍率需介於 0.1～8。');$('designRatio').value=Number(ratio.toFixed(6));toast('已換算設計倍率；按「套用倍率與位移」生效。');});
    $('alignTopLeft').onclick=()=>attempt(()=>{$('offsetX').value=0;$('offsetY').value=0;apply();});
    $('alignCenter').onclick=()=>attempt(()=>{const v=values(),a=dimensionsFor('a',v),b=dimensionsFor('b',v);v.offsetX=Math.round((a.width-b.width)/2);v.offsetY=Math.round((a.height-b.height)/2);apply(v);$('offsetX').value=v.offsetX;$('offsetY').value=v.offsetY;});
    $('resetAlignment').onclick=()=>attempt(()=>{const previous={...crops};crops.a=crops.b=null;const v={designRatio:1,webRatio:1,webRatioKnown:false,offsetX:0,offsetY:0};try{apply(v);}catch(e){Object.assign(crops,previous);throw e;}$('designRatio').value=1;$('webRatio').value=1;$('webRatioKnown').checked=false;$('offsetX').value=0;$('offsetY').value=0;});
    function cropFields(){for(const [id,key] of [['cropX','x'],['cropY','y'],['cropW','width'],['cropH','height']])$(id).value=cropDraft[key];}
    function paintCrop(){
      const o=originals[cropKey],c=$('cropCanvas'),x=ctx(c),scale=c.width/o.width;
      x.clearRect(0,0,c.width,c.height);x.drawImage(o.image,0,0,c.width,c.height);
      if(cropDraft){const r=cropDraft;x.fillStyle='#18382e66';x.beginPath();x.rect(0,0,c.width,c.height);x.rect(r.x*scale,r.y*scale,r.width*scale,r.height*scale);x.fill('evenodd');x.strokeStyle='#3b8b63';x.lineWidth=2;x.strokeRect(r.x*scale,r.y*scale,r.width*scale,r.height*scale);}
    }
    function openCrop(key){
      if(!originals[key])return;cropKey=key;cropVersion=originals[key];cropDraft={...(crops[key]||full(originals[key]))};cropStart=null;
      $('cropTitle').textContent=key==='a'?'選取設計稿中的元件':'選取網頁中的同一元件';
      const o=originals[key],scale=Math.min(1,1400/o.width,2400/o.height);$('cropCanvas').width=Math.max(1,Math.round(o.width*scale));$('cropCanvas').height=Math.max(1,Math.round(o.height*scale));
      cropFields();paintCrop();$('cropDialog').showModal();
    }
    $('cropA').onclick=()=>openCrop('a');$('cropB').onclick=()=>openCrop('b');$('closeCrop').onclick=()=>$('cropDialog').close();
    const cropPoint=e=>{const box=$('cropCanvas').getBoundingClientRect(),o=originals[cropKey];return{x:Math.max(0,Math.min(o.width,(e.clientX-box.left)*o.width/box.width)),y:Math.max(0,Math.min(o.height,(e.clientY-box.top)*o.height/box.height))};};
    $('cropCanvas').onpointerdown=e=>{if(e.button!==0)return;e.preventDefault();cropStart=cropPoint(e);$('cropCanvas').setPointerCapture(e.pointerId);};
    $('cropCanvas').onpointermove=e=>{if(!cropStart)return;const p=cropPoint(e),o=originals[cropKey],r=PixelCompare.normalizeRect({x:cropStart.x,y:cropStart.y,width:p.x-cropStart.x,height:p.y-cropStart.y},o.width,o.height);if(r){cropDraft=r;cropFields();paintCrop();}};
    $('cropCanvas').onpointerup=e=>{cropStart=null;if($('cropCanvas').hasPointerCapture(e.pointerId))$('cropCanvas').releasePointerCapture(e.pointerId);};
    $('cropCanvas').onpointercancel=()=>{cropStart=null;};
    function readCrop(){const r={x:Number($('cropX').value),y:Number($('cropY').value),width:Number($('cropW').value),height:Number($('cropH').value)},o=originals[cropKey];if(!Object.values(r).every(Number.isSafeInteger)||r.x<0||r.y<0||r.width<1||r.height<1||r.x+r.width>o.width||r.y+r.height>o.height)throw Error('請輸入落在原圖內的整數座標及正數寬高。');return r;}
    for(const id of ['cropX','cropY','cropW','cropH'])$(id).oninput=()=>{try{cropDraft=readCrop();paintCrop();}catch{}};
    function commitCrop(r){if(cropVersion!==originals[cropKey])throw Error('來源已更新，請重新選取。');const previous=crops[cropKey];crops[cropKey]=r;try{apply({...applied,offsetX:0,offsetY:0});}catch(e){crops[cropKey]=previous;throw e;}$('offsetX').value=0;$('offsetY').value=0;$('cropDialog').close();toast('已選取元件；元件尺寸差異會保留。');}
    $('applyCrop').onclick=()=>attempt(()=>commitCrop(readCrop()));$('fullCrop').onclick=()=>attempt(()=>commitCrop(null));
    let pasteDestination='b';
    function choosePasteTarget(key){
      pasteDestination=key;
      $('pasteToDesign').setAttribute('aria-pressed',String(key==='a'));
      $('pasteToWeb').setAttribute('aria-pressed',String(key==='b'));
      $('pasteHint').textContent='Ctrl / ⌘ + V → '+(key==='a'?'Figma 設計稿':'網頁截圖');
    }
    $('pasteToDesign').onclick=()=>choosePasteTarget('a');
    $('pasteToWeb').onclick=()=>choosePasteTarget('b');
    document.addEventListener('paste',e=>{
      if(/INPUT|TEXTAREA/.test(e.target.tagName)||e.target.isContentEditable||$('cropDialog').open||$('captureDialog').open)return;
      const destination=pasteDestination;
      const item=[...(e.clipboardData?.items||[])].find(i=>i.type.startsWith('image/'));
      const blob=item?.getAsFile()||[...(e.clipboardData?.files||[])].find(f=>f.type.startsWith('image/'));
      if(!blob)return;
      e.preventDefault();
      const ext=blob.type==='image/jpeg'?'jpg':blob.type==='image/webp'?'webp':'png';
      importFile(new File([blob],'pasted-'+Date.now()+'.'+ext,{type:blob.type}),destination);
    });
    function stopShare(message='分享已停止；畫面只在本機處理。'){
      ++captureGeneration;const old=stream;stream=null;if(old)old.getTracks().forEach(t=>t.stop());
      $('captureVideo').srcObject=null;$('freezeCapture').disabled=true;
      if($('captureDialog').open)$('captureDialog').close();
      $('captureStatus').textContent=message;$('startCapture').disabled=capturePending;
    }
    async function startShare(){
      if(capturePending||stream)return;
      if(!window.isSecureContext||!navigator.mediaDevices?.getDisplayMedia){$('captureStatus').textContent='此環境不支援分頁擷取。請使用 HTTPS 網站（例如 GitHub Pages）及支援的桌面瀏覽器，或改用貼上／拖放圖片。';toast('目前無法分享分頁，仍可貼上或拖放圖片。');return;}
      capturePending=true;$('startCapture').disabled=true;const token=++captureGeneration;
      $('captureStatus').textContent='請在瀏覽器的分享視窗選擇受測網站分頁。';
      try{
        const acquired=await navigator.mediaDevices.getDisplayMedia({video:true,audio:false});
        if(token!==captureGeneration){acquired.getTracks().forEach(t=>t.stop());return;}
        stream=acquired;const track=stream.getVideoTracks()[0];if(!track)throw Error('No video');
        track.addEventListener('ended',()=>{if(stream===acquired)stopShare('你已停止分享。可重新擷取或貼上圖片。');},{once:true});
        const video=$('captureVideo');video.srcObject=stream;$('captureDialog').showModal();
        const ready=()=>{if(stream!==acquired)return;$('freezeCapture').disabled=!(video.videoWidth&&video.videoHeight&&video.readyState>=2);$('captureDimensions').textContent=`擷取影像 ${video.videoWidth} × ${video.videoHeight} px；這不是 CSS 視窗尺寸。${track.getSettings().displaySurface==='browser'?'':'目前來源可能包含整個視窗或螢幕；請確認預覽中只有需要的內容。'}`;};
        video.onloadeddata=ready;video.onresize=ready;await video.play();ready();$('captureStatus').textContent='分享中：確認預覽後按「擷取這一刻」，或隨時停止分享。';
      }catch(e){stopShare(e.name==='NotAllowedError'?'未取得分享權限：可能已取消，或公司政策禁止。可改用貼上／拖放圖片。':e.name==='NotFoundError'?'找不到可分享來源，請改用圖片輸入。':'無法擷取畫面，請確認瀏覽器權限或改用貼上／拖放圖片。');}
      finally{capturePending=false;$('startCapture').disabled=!!stream;}
    }
    $('startCapture').onclick=startShare;$('cancelCapture').onclick=()=>stopShare();$('stopCapture').onclick=()=>stopShare();
    $('captureDialog').addEventListener('cancel',e=>{e.preventDefault();stopShare();});
    $('captureDialog').addEventListener('close',()=>{if(stream)stopShare();});
    $('freezeCapture').onclick=async()=>{
      if(!stream)return;const video=$('captureVideo'),w=video.videoWidth,h=video.videoHeight;
      if(!w||!h||video.readyState<2){toast('影像尚未就緒，請稍候。');return;}
      if(w*h>MAX_PIXELS||Math.max(w,h)>MAX_SIDE){stopShare('分享畫面超過圖片上限；請縮小受測視窗後重新分享。');return;}
      const c=document.createElement('canvas');c.width=w;c.height=h;
      try{ctx(c).drawImage(video,0,0);const sequence=++loadSequence.b;stopShare('已擷取，分享已停止。正在加入網頁圖片…');const blob=await new Promise(resolve=>c.toBlob(resolve,'image/png'));if(sequence!==loadSequence.b)return;if(!blob)throw Error('擷取圖片失敗');if(blob.size>MAX_FILE)throw Error('擷取圖片超過 12 MB，請縮小視窗後重試。');const loaded=await importFile(new File([blob],`web-capture-${Date.now()}.png`,{type:'image/png'}),'b');if(!loaded){$('captureStatus').textContent='分享已停止；圖片未加入，請依提示調整圖片尺寸後重試。';return;}$('captureStatus').textContent='畫面已加入，分享已停止。接著分別選取設計稿與網頁元件。';}catch(e){stopShare('畫面擷取失敗，可重新嘗試或改用貼上圖片。');toast(e.message);}
    };
    window.addEventListener('pagehide',()=>stopShare());
    refresh();
    return {sourceChanged,original:key=>originals[key],notice:()=>`${applied.webRatioKnown?'使用手動確認倍率；框選尺寸屬估測。':'網頁倍率未確認：僅供視覺檢查，不宣稱精確 CSS 尺寸。'} 網頁位移 X ${applied.offsetX} / Y ${applied.offsetY}。`,metadata:()=>({originals:Object.fromEntries(['a','b'].map(k=>[k,originals[k]?{name:originals[k].name,width:originals[k].width,height:originals[k].height}:null])),crops:{...crops},...applied,coordinateSystem:'Aligned comparison canvas; crop rectangles use original source pixels',manualCropMeasurements:true})};
  })();
