/* ================================================================
   CHART HELPERS (pure inline SVG — no libraries)
   ================================================================ */
function donutSVG(items){
  const S=190, r=72, sw=30, c=S/2, C=2*Math.PI*r;
  const total=items.reduce((a,b)=>a+b.val,0);
  let off=C*0.25, segs='';
  for(const it of items){ if(it.val<=0) continue;
    const len=Math.max(0,it.val/ (total||1) *C);
    segs+=`<circle cx="${c}" cy="${c}" r="${r}" fill="none" stroke="${it.color}" stroke-width="${sw}" stroke-dasharray="${len.toFixed(2)} ${(C-len).toFixed(2)}" stroke-dashoffset="${off.toFixed(2)}"/>`;
    off-=len; }
  return `<svg viewBox="0 0 ${S} ${S}" class="chart" style="max-width:200px;display:block;margin:auto">${segs}
    <text x="${c}" y="${c-4}" text-anchor="middle" font-size="11" fill="#67707f">TOTAL</text>
    <text x="${c}" y="${c+15}" text-anchor="middle" font-size="14.5" font-weight="700" fill="#1c2333">${fmt0(total)}</text></svg>`;
}
function bars12SVG(data){
  const W=780, H=250, padL=58, padR=8, padB=26, padT=12;
  const max=Math.max(1,...data.map(d=>Math.max(d.inc,d.exp)));
  const iw=(W-padL-padR)/data.length, bw=Math.max(5,Math.min(15,iw*0.30));
  let grid='', bars='', labels='';
  for(let g=0; g<=4; g++){ const v=max*g/4, y=H-padB-(v/max)*(H-padB-padT);
    grid+=`<line x1="${padL}" y1="${y}" x2="${W-padR}" y2="${y}" stroke="#e9edf4"/><text x="${padL-7}" y="${y+4}" text-anchor="end" font-size="10.5" fill="#8a93a5">${fmtK(v)}</text>` }
  data.forEach((d,i)=>{ const cx=padL+i*iw+iw/2;
    const hi=Math.max(1,d.inc), he=Math.max(1,d.exp);
    const yi=H-padB-(hi/max)*(H-padB-padT), ye=H-padB-(he/max)*(H-padB-padT);
    bars+=`<rect x="${(cx-bw-1.5).toFixed(1)}" y="${yi.toFixed(1)}" width="${bw}" height="${(H-padB-yi).toFixed(1)}" rx="2.5" fill="#2f9e5f"/>
           <rect x="${(cx+1.5).toFixed(1)}" y="${ye.toFixed(1)}" width="${bw}" height="${(H-padB-ye).toFixed(1)}" rx="2.5" fill="#e05252"/>`;
    labels+=`<text x="${cx}" y="${H-8}" text-anchor="middle" font-size="10.5" fill="#67707f">${d.label}</text>` });
  return `<svg viewBox="0 0 ${W} ${H}" class="chart">${grid}${bars}${labels}</svg>`;
}
function lineNetSVG(maxG, netFn, needAnnual, marks){
  const W=780, H=270, padL=64, padR=14, padB=34, padT=14;
  const maxY=Math.max(netFn(maxG), needAnnual)*1.06;
  const X=g=>padL+(g/maxG)*(W-padL-padR), Y=v=>H-padB-(v/maxY)*(H-padB-padT);
  let pts=''; const steps=64;
  for(let i=0;i<=steps;i++){ const g=maxG*i/steps; pts+=(i?' L':'M')+X(g).toFixed(1)+' '+Y(netFn(g)).toFixed(1) }
  let grid=''; for(let g=0;g<=4;g++){ const v=maxY*g/4, y=Y(v);
    grid+=`<line x1="${padL}" y1="${y.toFixed(1)}" x2="${W-padR}" y2="${y.toFixed(1)}" stroke="#e9edf4"/><text x="${padL-7}" y="${(y+4).toFixed(1)}" text-anchor="end" font-size="10.5" fill="#8a93a5">${fmtK(v)}</text>` }
  for(let g=0;g<=4;g++){ const gv=maxG*g/4, x=X(gv);
    grid+=`<text x="${x.toFixed(1)}" y="${H-10}" text-anchor="middle" font-size="10.5" fill="#8a93a5">${fmtK(gv)}</text>` }
  let mk='';
  for(const m of marks){ const x=X(m.gross), y=Y(netFn(m.gross));
    mk+=`<line x1="${x.toFixed(1)}" y1="${padT}" x2="${x.toFixed(1)}" y2="${H-padB}" stroke="${m.color}" stroke-dasharray="4 4" opacity=".8"/>
         <circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="4.5" fill="${m.color}"/>
         <text x="${Math.min(x+6,W-150).toFixed(1)}" y="${Math.max(padT+12,y-10).toFixed(1)}" font-size="11" font-weight="600" fill="${m.color}">${esc(m.label)}</text>` }
  const yNeed=Y(needAnnual);
  return `<svg viewBox="0 0 ${W} ${H}" class="chart">${grid}
    <line x1="${padL}" y1="${yNeed.toFixed(1)}" x2="${W-padR}" y2="${yNeed.toFixed(1)}" stroke="#b45309" stroke-width="2" stroke-dasharray="7 5"/>
    <text x="${W-padR-4}" y="${(yNeed-7).toFixed(1)}" text-anchor="end" font-size="11" font-weight="600" fill="#b45309">Lifestyle + savings need ${fmt0(needAnnual)}</text>
    <path d="${pts}" fill="none" stroke="#3450b4" stroke-width="2.5"/>${mk}</svg>`;
}
function growthSVG(contrib, ratePct, years, lump){
  const W=780, H=250, padL=64, padR=14, padB=28, padT=12;
  const i=ratePct/100/12, n=years*12;
  const series=[]; let bal=lump||0;
  for(let m=0;m<=n;m++){ if(m>0){ bal=bal*(1+i)+contrib } series.push(bal) }
  const maxV=Math.max(...series,1);
  const X=m=>padL+(m/n)*(W-padL-padR), Y=v=>H-padB-(v/maxV)*(H-padB-padT);
  let grid=''; for(let g=0;g<=4;g++){ const v=maxV*g/4,y=Y(v);
    grid+=`<line x1="${padL}" y1="${y.toFixed(1)}" x2="${W-padR}" y2="${y.toFixed(1)}" stroke="#e9edf4"/><text x="${padL-7}" y="${(y+4).toFixed(1)}" text-anchor="end" font-size="10.5" fill="#8a93a5">${fmtK(v)}</text>` }
  let ticks=''; for(let yr=0;yr<=years;yr+=Math.max(1,Math.round(years/6))){ ticks+=`<text x="${X(yr*12).toFixed(1)}" y="${H-8}" text-anchor="middle" font-size="10.5" fill="#67707f">${yr}y</text>` }
  let path=''; series.forEach((v,m)=>{ path+=(m?' L':'M')+X(m).toFixed(1)+' '+Y(v).toFixed(1) });
  const contribTotal=lump+contrib*n;
  const area=`M${X(0)} ${Y(0)} L${path.slice(1)} L${X(n)} ${Y(0)} Z`;
  return { svg:`<svg viewBox="0 0 ${W} ${H}" class="chart">${grid}
      <path d="${area}" fill="#6d28d9" opacity="0.08"/>
      <path d="M${X(0)} ${Y(contribTotal).toFixed(1)} L${X(n)} ${Y(contribTotal).toFixed(1)}" stroke="#94a3b8" stroke-dasharray="5 5"/>
      <text x="${W-padR-4}" y="${(Y(contribTotal)-6).toFixed(1)}" text-anchor="end" font-size="11" fill="#67707f">contributed ${fmt0(contribTotal)}</text>
      <path d="${path}" fill="none" stroke="#6d28d9" stroke-width="2.5"/>${ticks}</svg>`,
    fv: series[series.length-1], contributed: contribTotal };
}
function fmtK(v){ if(Math.abs(v)>=1000000) return (v/1000000).toFixed(1).replace(/\.0$/,'')+'M';
  if(Math.abs(v)>=1000) return (v/1000).toFixed(v>=10000?0:1).replace(/\.0$/,'')+'k'; return Math.round(v) }

