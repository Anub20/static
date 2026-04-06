// ── Helpers ──────────────────────────────────────────────────────────────
const PI2 = Math.PI * 2;
const toRad = d => d * Math.PI / 180;
const $ = id => document.getElementById(id);
let currentView = 'static';
let animFrame = null;
let spinAngle = 0;

function getV(id){ return parseFloat($(id).value); }

function updateSliderFill(el){
  const min = parseFloat(el.min), max = parseFloat(el.max), val = parseFloat(el.value);
  const pct = ((val - min)/(max - min)*100).toFixed(1) + '%';
  el.style.setProperty('--pct', pct);
}

// ── Compute ──────────────────────────────────────────────────────────────
function compute(){
  const rpm = getV('rpm');
  const omega = rpm * 2 * Math.PI / 60;
  const m1 = getV('m1'), r1 = getV('r1'), a1 = toRad(getV('a1'));
  const m2 = getV('m2'), r2 = getV('r2'), a2 = toRad(getV('a2'));

  const x1 = m1*r1*Math.cos(a1), y1 = m1*r1*Math.sin(a1);
  const x2 = m2*r2*Math.cos(a2), y2 = m2*r2*Math.sin(a2);
  const rx = x1+x2, ry = y1+y2;
  const mr = Math.sqrt(rx*rx + ry*ry);
  const F = (mr/1e6)*omega*omega;
  const angDeg = mr < 0.1 ? null : (Math.atan2(ry,rx)*180/Math.PI+360)%360;
  const corrMass = mr/60;
  const corrAngle = angDeg !== null ? (angDeg+180)%360 : null;

  return { m1,r1,a1:getV('a1'), m2,r2,a2:getV('a2'), x1,y1,x2,y2,rx,ry,mr,F,angDeg,corrMass,corrAngle,omega,rpm };
}

// ── Arrow helper ──────────────────────────────────────────────────────────
function arrow(ctx, x1,y1,x2,y2,color,lw,dash=[]){
  const angle = Math.atan2(y2-y1,x2-x1);
  const hs = 7;
  ctx.save();
  ctx.setLineDash(dash);
  ctx.beginPath(); ctx.moveTo(x1,y1); ctx.lineTo(x2,y2);
  ctx.strokeStyle = color; ctx.lineWidth = lw; ctx.stroke();
  ctx.setLineDash([]);
  ctx.beginPath();
  ctx.moveTo(x2,y2);
  ctx.lineTo(x2-hs*Math.cos(angle-0.38), y2-hs*Math.sin(angle-0.38));
  ctx.lineTo(x2-hs*Math.cos(angle+0.38), y2-hs*Math.sin(angle+0.38));
  ctx.closePath(); ctx.fillStyle = color; ctx.fill();
  ctx.restore();
}

// ── Draw Rotor ────────────────────────────────────────────────────────────
function drawRotor(c, offset=null){
  const canvas = $('rotor');
  const dpr = window.devicePixelRatio||1;
  const W = canvas.parentElement.clientWidth;
  const H = Math.min(W, 480);
  canvas.style.width = W+'px'; canvas.style.height = H+'px';
  canvas.width = W*dpr; canvas.height = H*dpr;
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr,dpr);
  ctx.clearRect(0,0,W,H);

  const cx = W/2, cy = H/2;
  const sc = Math.min(W,H)*0.004;

  // Grid rings
  [100,80,60,40,20].forEach((r,i) => {
    ctx.beginPath(); ctx.arc(cx,cy,r*sc,0,PI2);
    ctx.strokeStyle = i===0 ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.04)';
    ctx.lineWidth = i===0 ? 1 : 0.5; ctx.stroke();
  });

  // Radial spokes
  for(let d=0; d<360; d+=30){
    const rad = toRad(d);
    ctx.beginPath();
    ctx.moveTo(cx+18*sc*Math.cos(rad), cy+18*sc*Math.sin(rad));
    ctx.lineTo(cx+100*sc*Math.cos(rad), cy+100*sc*Math.sin(rad));
    ctx.strokeStyle = 'rgba(255,255,255,0.04)'; ctx.lineWidth = 0.5; ctx.stroke();
  }

  // Disc fill
  ctx.beginPath(); ctx.arc(cx,cy,100*sc,0,PI2);
  ctx.fillStyle = 'rgba(255,255,255,0.02)'; ctx.fill();

  // Outer ring
  ctx.beginPath(); ctx.arc(cx,cy,100*sc,0,PI2);
  ctx.strokeStyle = 'rgba(255,255,255,0.14)'; ctx.lineWidth = 1.5; ctx.stroke();

  // Angle labels
  ctx.font = `${Math.max(9,sc*2.8)}px IBM Plex Mono, monospace`;
  ctx.fillStyle = 'rgba(255,255,255,0.2)';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  [0,90,180,270].forEach(d => {
    const rad = toRad(d);
    ctx.fillText(d+'°', cx+113*sc*Math.cos(rad), cy+113*sc*Math.sin(rad));
  });

  const rot = offset || 0;

  function drawMass(md, rd, angD, color, label){
    if(md < 0.5) return;
    const rad = toRad(angD) + rot;
    const px = cx+rd*sc*Math.cos(rad), py = cy+rd*sc*Math.sin(rad);
    const sz = Math.max(5, Math.min(16, md/14));
    ctx.beginPath(); ctx.moveTo(cx,cy); ctx.lineTo(px,py);
    ctx.strokeStyle = color+'55'; ctx.lineWidth = 1;
    ctx.setLineDash([3,3]); ctx.stroke(); ctx.setLineDash([]);
    // glow
    const grd = ctx.createRadialGradient(px,py,0,px,py,sz*2.5);
    grd.addColorStop(0, color+'55'); grd.addColorStop(1, 'transparent');
    ctx.beginPath(); ctx.arc(px,py,sz*2.5,0,PI2);
    ctx.fillStyle = grd; ctx.fill();
    // mass
    ctx.beginPath(); ctx.arc(px,py,sz,0,PI2);
    ctx.fillStyle = color; ctx.fill();
    ctx.strokeStyle = '#fff3'; ctx.lineWidth = 0.5; ctx.stroke();
    // label
    const lx = cx+(rd+sz+10)*sc*Math.cos(rad), ly = cy+(rd+sz+10)*sc*Math.sin(rad);
    ctx.font = `${Math.max(9,sc*2.6)}px IBM Plex Mono, monospace`;
    ctx.fillStyle = color; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(label, lx, ly);
  }

  const d = compute();

  drawMass(d.m1, d.r1, d.a1, '#e05a38', 'm₁');
  drawMass(d.m2, d.r2, d.a2, '#3a8be0', 'm₂');

  // Resultant arrow
  if(d.mr > 1){
    const rad = Math.atan2(d.ry,d.rx) + rot;
    const arrowLen = Math.min(90, d.mr*0.06)*sc;
    arrow(ctx, cx,cy, cx+arrowLen*Math.cos(rad), cy+arrowLen*Math.sin(rad), '#2ab87a', 2);
  }

  // Correction position
  if(d.mr > 5 && d.corrAngle !== null){
    const corrRad = toRad(d.corrAngle) + rot;
    const pr = 60*sc;
    const px = cx+pr*Math.cos(corrRad), py = cy+pr*Math.sin(corrRad);
    const sz2 = Math.max(5, Math.min(16, d.corrMass/14));
    ctx.beginPath(); ctx.arc(px,py,sz2,0,PI2);
    ctx.fillStyle = 'rgba(136,135,128,0.2)'; ctx.fill();
    ctx.setLineDash([3,3]);
    ctx.strokeStyle = '#888780'; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.setLineDash([]);
    ctx.font = `${Math.max(8,sc*2.4)}px IBM Plex Mono, monospace`;
    ctx.fillStyle = '#888780'; ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.fillText('Mc', cx+(60+sz2+10)*sc*Math.cos(corrRad), cy+(60+sz2+10)*sc*Math.sin(corrRad));
  }

  // Shaft
  ctx.beginPath(); ctx.arc(cx,cy,5,0,PI2);
  ctx.fillStyle = '#888780'; ctx.fill();
  ctx.beginPath(); ctx.arc(cx,cy,9,0,PI2);
  ctx.strokeStyle = 'rgba(255,255,255,0.2)'; ctx.lineWidth=1; ctx.stroke();
}

// ── Draw Vector Diagram ───────────────────────────────────────────────────
function drawVectors(d){
  const canvas = $('vec');
  const ctx = canvas.getContext('2d');
  const W=140, H=140, cx=70, cy=70;
  ctx.clearRect(0,0,W,H);

  const maxMR = Math.max(1, Math.hypot(d.x1,d.y1), Math.hypot(d.x2,d.y2), d.mr);
  const sc = 50/maxMR;

  // Axes
  ctx.strokeStyle='rgba(255,255,255,0.06)'; ctx.lineWidth=0.5;
  ctx.beginPath(); ctx.moveTo(cx,20); ctx.lineTo(cx,120); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(20,cy); ctx.lineTo(120,cy); ctx.stroke();

  // Vectors
  if(Math.hypot(d.x1,d.y1)>0.1) arrow(ctx,cx,cy,cx+d.x1*sc,cy+d.y1*sc,'#e05a38',1.5);
  if(Math.hypot(d.x2,d.y2)>0.1) arrow(ctx,cx,cy,cx+d.x2*sc,cy+d.y2*sc,'#3a8be0',1.5);
  if(d.mr > 0.1){
    arrow(ctx,cx,cy,cx+d.rx*sc,cy+d.ry*sc,'#2ab87a',2);
    ctx.setLineDash([4,3]);
    ctx.beginPath(); ctx.moveTo(cx,cy); ctx.lineTo(cx-d.rx*sc,cy-d.ry*sc);
    ctx.strokeStyle='#888780'; ctx.lineWidth=1.5; ctx.stroke();
    ctx.setLineDash([]);
  }
}

// ── Update UI ─────────────────────────────────────────────────────────────
function update(){
  ['m1','r1','a1','m2','r2','a2','rpm'].forEach(id => updateSliderFill($(id)));

  const m1=getV('m1'), r1=getV('r1'), a1=getV('a1');
  const m2=getV('m2'), r2=getV('r2'), a2=getV('a2');
  const rpm=getV('rpm');

  $('m1v').textContent = m1+' g';  $('r1v').textContent = r1;  $('a1v').textContent = a1+'°';
  $('m2v').textContent = m2+' g';  $('r2v').textContent = r2;  $('a2v').textContent = a2+'°';
  $('rpmv').textContent = rpm;
  $('rpm-val').textContent = rpm;
  $('omega-val').textContent = (rpm*2*Math.PI/60).toFixed(1);

  const d = compute();

  $('mF').textContent = d.F.toFixed(2);
  $('mA').textContent = d.angDeg !== null ? d.angDeg.toFixed(1) : '—';
  $('mC').textContent = d.corrMass.toFixed(2);
  $('mMR').textContent = Math.round(d.mr);

  // Status
  const dot = $('sdot'), stxt = $('stxt'), tag = $('balance-tag');
  if(d.mr < 5){
    dot.style.background='#2ab87a'; dot.style.boxShadow='0 0 6px rgba(42,184,122,0.6)';
    stxt.textContent = 'System is balanced — centre of mass on rotation axis.';
    tag.textContent='Balanced'; tag.className='tag';
  } else if(d.mr < 4000){
    dot.style.background='#d4900a'; dot.style.boxShadow='0 0 6px rgba(212,144,10,0.6)';
    stxt.textContent = `Imbalance detected — add ${d.corrMass.toFixed(2)} g at ${d.corrAngle !== null ? d.corrAngle.toFixed(1) : '—'}° (r = 60 mm)`;
    tag.textContent='Imbalanced'; tag.className='tag amber';
  } else {
    dot.style.background='#e05a38'; dot.style.boxShadow='0 0 6px rgba(224,90,56,0.6)';
    stxt.textContent = `Severe imbalance — add ${d.corrMass.toFixed(2)} g at ${d.corrAngle !== null ? d.corrAngle.toFixed(1) : '—'}° (r = 60 mm)`;
    tag.textContent='Severe'; tag.className='tag red';
  }

  if(currentView === 'static') drawRotor();
  drawVectors(d);
}

// ── Spin animation ────────────────────────────────────────────────────────
function showView(v){
  currentView = v;
  $('btn-static').classList.toggle('active', v==='static');
  $('btn-spin').classList.toggle('active', v==='spin');

  if(v === 'spin'){
    $('rotor').classList.add('hidden');
    setupSpinCanvas();
    spinLoop();
  } else {
    if(animFrame) cancelAnimationFrame(animFrame);
    $('rotor').classList.remove('hidden');
    update();
  }
}

function setupSpinCanvas(){
  const sc = $('spin-canvas');
  sc.classList.add('visible');
  const W = sc.parentElement.clientWidth;
  const H = Math.min(W,480);
  sc.style.width=W+'px'; sc.style.height=H+'px';
  sc.width=W*(window.devicePixelRatio||1); sc.height=H*(window.devicePixelRatio||1);
}

function spinLoop(){
  const canvas = $('spin-canvas');
  const dpr = window.devicePixelRatio||1;
  const W = canvas.width/dpr, H = canvas.height/dpr;
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr,dpr);

  const rpm = getV('rpm');
  const angSpeed = (rpm/60)*PI2/60; // radians per frame at 60fps
  spinAngle += angSpeed;

  ctx.clearRect(0,0,W,H);
  const cx=W/2, cy=H/2, sc2=Math.min(W,H)*0.004;

  // Background disc
  [100,80,60,40,20].forEach((r,i) => {
    ctx.beginPath(); ctx.arc(cx,cy,r*sc2,0,PI2);
    ctx.strokeStyle=i===0?'rgba(255,255,255,0.1)':'rgba(255,255,255,0.04)';
    ctx.lineWidth=i===0?1:0.5; ctx.stroke();
  });

  const d=compute();

  // Draw spinning masses
  function drawSpinMass(md, rd, angDeg, color){
    if(md<0.5) return;
    const rad=toRad(angDeg)+spinAngle;
    const px=cx+rd*sc2*Math.cos(rad), py=cy+rd*sc2*Math.sin(rad);
    const sz=Math.max(5,Math.min(16,md/14));
    // trail
    ctx.beginPath(); ctx.moveTo(cx,cy); ctx.lineTo(px,py);
    ctx.strokeStyle=color+'33'; ctx.lineWidth=1; ctx.setLineDash([2,4]); ctx.stroke(); ctx.setLineDash([]);
    const grd=ctx.createRadialGradient(px,py,0,px,py,sz*3);
    grd.addColorStop(0,color+'66'); grd.addColorStop(1,'transparent');
    ctx.beginPath(); ctx.arc(px,py,sz*3,0,PI2); ctx.fillStyle=grd; ctx.fill();
    ctx.beginPath(); ctx.arc(px,py,sz,0,PI2); ctx.fillStyle=color; ctx.fill();
  }

  drawSpinMass(d.m1,d.r1,d.a1,'#e05a38');
  drawSpinMass(d.m2,d.r2,d.a2,'#3a8be0');

  // Resultant arrow (rotates with disc)
  if(d.mr>1){
    const rad=Math.atan2(d.ry,d.rx)+spinAngle;
    const alen=Math.min(90,d.mr*0.06)*sc2;
    arrow(ctx,cx,cy,cx+alen*Math.cos(rad),cy+alen*Math.sin(rad),'#2ab87a',2);
  }

  // Shake indicator when imbalanced
  if(d.mr>100){
    const shake=(d.mr/20000)*Math.sin(spinAngle*12)*2;
    ctx.save(); ctx.translate(shake,0);
  }

  // Shaft
  ctx.beginPath(); ctx.arc(cx,cy,5,0,PI2); ctx.fillStyle='#888780'; ctx.fill();
  ctx.restore && ctx.restore();

  // Outer ring
  ctx.beginPath(); ctx.arc(cx,cy,100*sc2,0,PI2);
  ctx.strokeStyle='rgba(255,255,255,0.14)'; ctx.lineWidth=1.5; ctx.stroke();

  animFrame = requestAnimationFrame(spinLoop);
}

// ── Init ──────────────────────────────────────────────────────────────────
['m1','r1','a1','m2','r2','a2','rpm'].forEach(id => {
  $(id).addEventListener('input', update);
});

window.addEventListener('resize', () => {
  if(currentView==='spin') setupSpinCanvas();
  else drawRotor();
});

update();
