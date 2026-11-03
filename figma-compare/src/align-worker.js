/* Executed after the pinned OpenCV bundle, inside a dedicated worker. */
const readyCV = new Promise(resolve => {
  // Older OpenCV modules are self-resolving thenables: do not resolve with cv.
  if (cv.Mat) resolve();
  else cv.onRuntimeInitialized = () => resolve();
});
const clamp = (n,a,b) => Math.max(a,Math.min(b,n));
function gray(image) {
  const rgba=cv.matFromImageData(image), out=new cv.Mat();
  // Composite transparency on white, matching the comparison engine.
  for(let i=0;i<rgba.data.length;i+=4){const a=rgba.data[i+3]/255;for(let j=0;j<3;j++)rgba.data[i+j]=Math.round(rgba.data[i+j]*a+255*(1-a));}
  cv.cvtColor(rgba,out,cv.COLOR_RGBA2GRAY);rgba.delete();return out;
}
function resize(src,w,h){const dst=new cv.Mat();cv.resize(src,dst,new cv.Size(w,h),0,0,cv.INTER_AREA);return dst;}
function edge(src){const dst=new cv.Mat();cv.Canny(src,dst,45,120);return dst;}
function texture(src){const mean=new cv.Mat(),sd=new cv.Mat();cv.meanStdDev(src,mean,sd);const v=sd.data64F[0];mean.delete();sd.delete();return v;}
function peaks(search,templ,scale,limit=3){
  const w=Math.round(templ.cols*scale),h=Math.round(templ.rows*scale);
  if(w<10||h<10||w>search.cols||h>search.rows)return [];
  const t=resize(templ,w,h),se=edge(search),te=edge(t),g=new cv.Mat(),e=new cv.Mat(),out=new cv.Mat();
  try{
    cv.matchTemplate(search,t,g,cv.TM_CCOEFF_NORMED);
    if(cv.countNonZero(te)>8){cv.matchTemplate(se,te,e,cv.TM_CCORR_NORMED);cv.addWeighted(g,.65,e,.35,0,out);}else g.copyTo(out);
    const hits=[];
    for(let i=0;i<limit;i++){
      const p=cv.minMaxLoc(out);if(!Number.isFinite(p.maxVal)||p.maxVal<.25)break;
      hits.push({x:p.maxLoc.x,y:p.maxLoc.y,scale,score:p.maxVal});
      cv.rectangle(out,new cv.Point(Math.max(0,p.maxLoc.x-w*.35),Math.max(0,p.maxLoc.y-h*.35)),new cv.Point(Math.min(out.cols-1,p.maxLoc.x+w*.35),Math.min(out.rows-1,p.maxLoc.y+h*.35)),new cv.Scalar(-1),-1);
    }return hits;
  }finally{[t,se,te,g,e,out].forEach(m=>m.delete());}
}
function unique(hits,w,h,limit=3){
  const out=[];
  for(const c of hits.sort((a,b)=>b.score-a.score)){
    if(out.every(o=>Math.abs(c.x-o.x)>Math.min(c.scale,o.scale)*w*.35||Math.abs(c.y-o.y)>Math.min(c.scale,o.scale)*h*.35))out.push(c);
    if(out.length===limit)break;
  }return out;
}
function searchTemplate(search,templ,fixed,progress){
  const q=Math.min(1,720/Math.max(search.cols,search.rows));
  const small=resize(search,Math.round(search.cols*q),Math.round(search.rows*q));
  const t=resize(templ,Math.max(1,Math.round(templ.cols*q)),Math.max(1,Math.round(templ.rows*q)));
  const scales=fixed?[fixed]:[...new Set([.25,.5,.75,.8,1,1.25,1.5,2,3,4,...Array.from({length:49},(_,i)=>.25*Math.pow(16,i/48))])].sort((a,b)=>a-b);
  let hits=[];
  try{scales.forEach((s,i)=>{hits.push(...peaks(small,t,s));progress?.(i/scales.length);});}
  finally{small.delete();t.delete();}
  hits=unique(hits,templ.cols*q,templ.rows*q,6).map(c=>({...c,x:c.x/q,y:c.y/q}));
  // Refine at original resolution in bounded neighborhoods; never warp axes separately.
  const refine=(c,range,steps)=>{
    let best=null;
    for(let i=-steps;i<=steps;i++){
      const s=fixed||clamp(c.scale*(1+i*range/steps),.25,4),w=Math.round(templ.cols*s),h=Math.round(templ.rows*s);
      const margin=Math.max(4,Math.ceil(Math.max(w,h)*range+3/q));
      const x=Math.max(0,Math.floor(c.x-margin)),y=Math.max(0,Math.floor(c.y-margin));
      const rw=Math.min(search.cols-x,w+2*margin),rh=Math.min(search.rows-y,h+2*margin);
      if(rw<w||rh<h)continue;
      const roi=search.roi(new cv.Rect(x,y,rw,rh));
      try{for(const p of peaks(roi,templ,s,1))if(!best||p.score>best.score+1e-6||(Math.abs(p.score-best.score)<=1e-6&&Math.abs(p.scale-c.scale)<Math.abs(best.scale-c.scale)))best={...p,x:p.x+x,y:p.y+y};}finally{roi.delete();}
      if(fixed)break;
    }return best||c;
  };
  return unique(hits.map(c=>refine(refine(c,.065,6),.01,5)),templ.cols,templ.rows,3);
}
function verify(search,templ,c){
  let good=0,visible=0,total=0;const regions=[];
  for(let gy=0;gy<2;gy++)for(let gx=0;gx<2;gx++){
    const x=Math.floor(gx*templ.cols/2),y=Math.floor(gy*templ.rows/2),w=Math.floor(templ.cols/2),h=Math.floor(templ.rows/2);
    if(w<10||h<10)continue;
    const t=templ.roi(new cv.Rect(x,y,w,h));
    try{
      if(texture(t)<6)continue;total++;
      const bx=Math.round(c.x+x*c.scale),by=Math.round(c.y+y*c.scale),bw=Math.round(w*c.scale),bh=Math.round(h*c.scale);
      if(bx<0||by<0||bx+bw>search.cols||by+bh>search.rows)continue;
      const r=search.roi(new cv.Rect(bx,by,bw,bh));
      try{const p=peaks(r,t,c.scale,1)[0];if(p){visible++;if(p.score>=.58){good++;regions.push(gx+2*gy);}}}finally{r.delete();}
    }finally{t.delete();}
  }
  return {good,visible,total,regions};
}

// Feature descriptors tolerate changed titles and independently reflowed sections.
// Fit only b = scale * a + translation. No rotation, shear, or perspective warp.
function featureAnchors(search,templ,fixed){
  if(!cv.ORB||!cv.BFMatcher)return [];
  const qa=Math.min(2,1400/Math.max(templ.cols,templ.rows)),qb=Math.min(2,1400/Math.max(search.cols,search.rows));
  const a=resize(templ,Math.round(templ.cols*qa),Math.round(templ.rows*qa)),b=resize(search,Math.round(search.cols*qb),Math.round(search.rows*qb));
  const detector=new cv.ORB(2200,1.15,12,15,0,2,cv.ORB_HARRIS_SCORE,31,8),matcher=new cv.BFMatcher(cv.NORM_HAMMING,false);
  const ka=new cv.KeyPointVector(),kb=new cv.KeyPointVector(),da=new cv.Mat(),db=new cv.Mat(),mask=new cv.Mat(),ab=new cv.DMatchVectorVector(),ba=new cv.DMatchVectorVector();
  try{
    detector.detectAndCompute(a,mask,ka,da);detector.detectAndCompute(b,mask,kb,db);
    if(da.rows<8||db.rows<8)return [];
    matcher.knnMatch(da,db,ab,2);matcher.knnMatch(db,da,ba,2);
    const reverse=new Map();
    for(let i=0;i<ba.size();i++){const v=ba.get(i);try{if(v.size()>=2){const m=v.get(0),n=v.get(1);if(m.distance<.8*n.distance)reverse.set(m.queryIdx,m.trainIdx);}}finally{v.delete();}}
    const pairs=[];
    for(let i=0;i<ab.size();i++){
      const v=ab.get(i);
      try{if(v.size()<2)continue;const m=v.get(0),n=v.get(1);if(m.distance>=70||m.distance>=.78*n.distance||reverse.get(m.trainIdx)!==m.queryIdx)continue;
        const p=ka.get(m.queryIdx),q=kb.get(m.trainIdx);let angle=Math.abs(p.angle-q.angle);angle=Math.min(angle,360-angle);if(angle>18)continue;
        pairs.push({ax:p.pt.x/qa,ay:p.pt.y/qa,bx:q.pt.x/qb,by:q.pt.y/qb,distance:m.distance});
      }finally{v.delete();}
    }
    const pool=pairs.sort((x,y)=>x.distance-y.distance).slice(0,180),out=[];
    const tolerance=s=>Math.max(2,1.6*s);
    const inliers=(c,points)=>points.filter(p=>Math.hypot(p.bx-c.x-p.ax*c.scale,p.by-c.y-p.ay*c.scale)<=tolerance(c.scale));
    const fit=points=>{
      const avg=k=>points.reduce((n,p)=>n+p[k],0)/points.length,ax=avg('ax'),ay=avg('ay'),bx=avg('bx'),by=avg('by');
      const den=points.reduce((n,p)=>n+(p.ax-ax)**2+(p.ay-ay)**2,0);
      const scale=fixed||points.reduce((n,p)=>n+(p.ax-ax)*(p.bx-bx)+(p.ay-ay)*(p.by-by),0)/den;
      return {scale,x:bx-scale*ax,y:by-scale*ay};
    };
    let remaining=pool;
    for(let round=0;round<3&&remaining.length>=8;round++){
      let best=[];
      // Deterministic pair hypotheses make failures reproducible in tests.
      for(let i=0;i<remaining.length;i++)for(let j=i+1;j<remaining.length;j++){
        const p=remaining[i],q=remaining[j],dx=q.ax-p.ax,dy=q.ay-p.ay,den=dx*dx+dy*dy;if(den<24*24)continue;
        const scale=fixed||((q.bx-p.bx)*dx+(q.by-p.by)*dy)/den;if(!Number.isFinite(scale)||scale<(fixed?.1:.25)||scale>(fixed?8:4))continue;
        const c={scale,x:p.bx-p.ax*scale,y:p.by-p.ay*scale};const support=inliers(c,remaining);
        if(support.length>best.length)best=support;
      }
      if(best.length<8)break;
      let c=fit(best);for(let i=0;i<3;i++){best=inliers(c,remaining);if(best.length<8)break;c=fit(best);}if(best.length<8)break;
      remaining=remaining.filter(p=>!best.includes(p));
      const xs=best.map(p=>p.ax),ys=best.map(p=>p.ay),x=Math.min(...xs),y=Math.min(...ys),w=Math.max(...xs)-x,h=Math.max(...ys)-y;
      const cells=new Set(best.map(p=>Math.floor(p.ax/12)+','+Math.floor(p.ay/12)));
      if(w<20||h<20||cells.size<5||!Number.isFinite(c.scale)||c.scale<(fixed?.1:.25)||c.scale>(fixed?8:4))continue;
      const pad=12,anchorRect={x:Math.max(0,Math.floor(x-pad)),y:Math.max(0,Math.floor(y-pad)),width:0,height:0};
      anchorRect.width=Math.min(templ.cols,Math.ceil(x+w+pad))-anchorRect.x;anchorRect.height=Math.min(templ.rows,Math.ceil(y+h+pad))-anchorRect.y;
      const residual=best.reduce((n,p)=>n+Math.hypot(p.bx-c.x-p.ax*c.scale,p.by-c.y-p.ay*c.scale),0)/best.length;
      // Corroborate descriptors with small image patches. This does not certify
      // surrounding text/layout; that remains visible as a difference.
      let checked=0,matched=0;const seen=new Set();
      for(const p of best){const cell=Math.floor(p.ax/20)+','+Math.floor(p.ay/20);if(seen.has(cell))continue;seen.add(cell);
        const size=24,tx=Math.round(p.ax-size/2),ty=Math.round(p.ay-size/2),bx=Math.round(c.x+tx*c.scale),by=Math.round(c.y+ty*c.scale),bw=Math.round(size*c.scale);
        if(tx<0||ty<0||tx+size>templ.cols||ty+size>templ.rows||bx<0||by<0||bx+bw>search.cols||by+bw>search.rows)continue;
        const t=templ.roi(new cv.Rect(tx,ty,size,size)),r=search.roi(new cv.Rect(bx,by,bw,bw));
        try{const hit=peaks(r,t,c.scale,1)[0];checked++;if(hit&&hit.score>=.58)matched++;}finally{t.delete();r.delete();}
        if(checked>=16)break;
      }
      if(checked<4||matched<Math.max(4,Math.ceil(checked*.55)))continue;
      out.push({...c,score:matched/checked,localOnly:true,method:'orb-scale-translation',anchorRect,evidence:{inliers:best.length,cells:cells.size,residual,patchesMatched:matched,patchesChecked:checked},points:best.slice(0,40).map(p=>({x:p.ax,y:p.ay}))});
    }
    return out.sort((a,b)=>b.evidence.inliers-a.evidence.inliers);
  }finally{[a,b,detector,matcher,ka,kb,da,db,mask,ab,ba].forEach(m=>m.delete());}
}
self.onmessage=async event=>{
  const {id,a,b,fixed,whole}=event.data;let ta,sb;
  try{
    await readyCV;self.postMessage({id,progress:3,label:'分析灰階與邊緣…'});
    ta=gray(a);sb=gray(b);
    if(texture(ta)<6)throw Error('所選設計範圍特徵太少，請包含文字、圖示或邊框。');
    let hits=searchTemplate(sb,ta,fixed,p=>self.postMessage({id,progress:Math.round(5+p*45),label:'搜尋位置與倍率…'}));
    // Partial captures and full pages: use distributed anchors to propose a global transform.
    if(whole||!hits.length||hits[0].score<.58){
      for(let gy=0;gy<2;gy++)for(let gx=0;gx<2;gx++){
        const x=Math.floor(gx*ta.cols/2),y=Math.floor(gy*ta.rows/2),w=Math.floor(ta.cols/2),h=Math.floor(ta.rows/2);
        if(w<24||h<24)continue;const t=ta.roi(new cv.Rect(x,y,w,h));
        try{if(texture(t)>=6)hits.push(...searchTemplate(sb,t,fixed).map(c=>({...c,x:c.x-x*c.scale,y:c.y-y*c.scale,anchor:true})));}finally{t.delete();}
        self.postMessage({id,progress:55+(gy*2+gx)*9,label:'交叉檢查分散區塊…'});
      }
    }
    const candidates=[];
    for(const c of unique(hits,ta.cols,ta.rows,12)){
      if(c.score<.58)continue;
      const evidence=verify(sb,ta,c);
      if(whole&&evidence.good<3)continue;
      if(c.anchor&&evidence.good<2)continue;
      candidates.push({...c,evidence});
    }
    const accepted=unique(candidates,ta.cols,ta.rows,3);
    let localCandidates=[];
    if(!accepted.length){self.postMessage({id,progress:92,label:'改用局部特徵尋找共同插畫／圖示…'});localCandidates=featureAnchors(sb,ta,fixed);}
    self.postMessage({id,candidates:accepted,localCandidates,diagnosis:accepted.length?'matched':localCandidates.length?'local-only':'no-match',done:true});
  }catch(e){self.postMessage({id,error:typeof e==='number'?'影像處理失敗，請縮小搜尋範圍或使用手動對齊。':e.message||String(e)});}
  finally{ta?.delete();sb?.delete();}
};
