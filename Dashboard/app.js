// Simple simulated data for campuses and devices
const data = {
  campuses: [
    { id: 'A', name: 'Campus A', x: 60, y: 60, w: 240, h: 140 },
    { id: 'B', name: 'Campus B', x: 360, y: 60, w: 240, h: 140 },
    { id: 'C', name: 'Campus C', x: 200, y: 240, w: 240, h: 140 }
  ],
  devices: []
};

// generate devices
const types = ['router','switch','ap','server'];
for(let c of data.campuses){
  for(let i=0;i<6;i++){
    const t = types[Math.floor(Math.random()*types.length)];
    data.devices.push({
      id: `${c.id}-${i+1}`,
      campus: c.id,
      type: t,
      name: `${t.toUpperCase()}-${c.id}-${i+1}`,
      ip: `10.${c.id.charCodeAt(0)%10}.${i+1}.1`,
      x: c.x + 20 + Math.random()*(c.w-40),
      y: c.y + 20 + Math.random()*(c.h-40),
      cpu: Math.round(10+Math.random()*80),
      mem: Math.round(15+Math.random()*70),
      temp: Math.round(30+Math.random()*30),
      uptime: Math.round(Math.random()*240),
      status: Math.random()<0.8? 'green': (Math.random()<0.5? 'yellow':'red')
    });
  }
}

// init UI
const mapEl = document.getElementById('campus-map');
const deviceCardsEl = document.getElementById('device-cards');
const alertsEl = document.getElementById('predictive-alerts');
const modal = document.getElementById('modal');
const modalBody = document.getElementById('modal-body');
const modalClose = document.getElementById('modal-close');

function renderMap(topology=false){
  mapEl.innerHTML = '';
  const svgNS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(svgNS,'svg');
  svg.setAttribute('width','100%');
  svg.setAttribute('height','100%');
  svg.setAttribute('viewBox','0 0 700 420');
  svg.style.cursor = 'grab';

  // add a top-level group so we can pan/zoom via transform
  const rootG = document.createElementNS(svgNS,'g');
  rootG.setAttribute('class','root-g');
  svg.appendChild(rootG);

  // campuses
  for(const c of data.campuses){
    const g = document.createElementNS(svgNS,'g');
    g.setAttribute('data-campus',c.id);
    const rect = document.createElementNS(svgNS,'rect');
    rect.setAttribute('x',c.x);
    rect.setAttribute('y',c.y);
    rect.setAttribute('width',c.w);
    rect.setAttribute('height',c.h);
    rect.setAttribute('rx',8);
    rect.setAttribute('fill','#eef6ff');
    rect.setAttribute('stroke','#cfe0fb');
    rect.setAttribute('stroke-width',1);
    g.appendChild(rect);
    const tx = document.createElementNS(svgNS,'text');
    tx.setAttribute('x',c.x+12);
    tx.setAttribute('y',c.y+22);
    tx.setAttribute('fill','#0b1220');
    tx.setAttribute('font-size',14);
    tx.textContent = c.name;
    g.appendChild(tx);

    // add devices
    const devs = data.devices.filter(d=>d.campus===c.id);
    for(const d of devs){
      const circle = document.createElementNS(svgNS,'g');
      circle.setAttribute('class','device');
      circle.setAttribute('transform',`translate(${d.x},${d.y})`);

      const ico = document.createElementNS(svgNS,'circle');
      ico.setAttribute('r',10);
      ico.setAttribute('fill', d.status==='green'? '#16a34a' : d.status==='yellow'? '#f59e0b' : '#ef4444');
      ico.setAttribute('stroke','#fff');
      ico.setAttribute('stroke-width',2);
      circle.appendChild(ico);

      const label = document.createElementNS(svgNS,'text');
      label.setAttribute('y',-14);
      label.setAttribute('font-size',10);
      label.setAttribute('fill','#0b1220');
      label.textContent = d.type.toUpperCase();
      circle.appendChild(label);

      circle.addEventListener('mouseenter', (ev)=>{
        showTooltip(ev, d);
      });
      circle.addEventListener('mouseleave', hideTooltip);
      circle.addEventListener('click', ()=>openDeviceModal(d));
      g.appendChild(circle);
    }

    // clicking campus
    rect.addEventListener('click', ()=>openCampusPanel(c));

    rootG.appendChild(g);
  }

  // draw connections between campuses
  const conn = [["A","B"],["A","C"],["B","C"]];
  for(const [a,b] of conn){
    const ca = data.campuses.find(x=>x.id===a);
    const cb = data.campuses.find(x=>x.id===b);
    const line = document.createElementNS(svgNS,'line');
    const x1 = ca.x + ca.w/2;
    const y1 = ca.y + ca.h/2;
    const x2 = cb.x + cb.w/2;
    const y2 = cb.y + cb.h/2;
    line.setAttribute('x1',x1);line.setAttribute('y1',y1);line.setAttribute('x2',x2);line.setAttribute('y2',y2);
    line.setAttribute('stroke','#8aaae6');
    line.setAttribute('stroke-width',2);
    line.setAttribute('stroke-dasharray','6 4');
    rootG.appendChild(line);
  }

  mapEl.appendChild(svg);

  // setup pan behaviour on svg
  setupPanZoom(svg, rootG);
}

// pan/zoom state and handlers
let pan = {x:0,y:0};
let scale = 1;
function setupPanZoom(svg, rootG){
  let dragging=false, startX=0, startY=0, origX=0, origY=0;
  svg.onpointerdown = (e)=>{
    dragging=true; svg.setPointerCapture(e.pointerId); startX=e.clientX; startY=e.clientY; origX=pan.x; origY=pan.y; svg.style.cursor='grabbing';
  };
  svg.onpointermove = (e)=>{
    if(!dragging) return; const dx = (e.clientX-startX)/scale; const dy=(e.clientY-startY)/scale; pan.x = origX + dx; pan.y = origY + dy; rootG.setAttribute('transform', `translate(${pan.x},${pan.y}) scale(${scale})`);
  };
  svg.onpointerup = svg.onpointercancel = (e)=>{ if(dragging){ dragging=false; try{ svg.releasePointerCapture(e.pointerId); }catch(e){} svg.style.cursor='grab'; } };
  // wheel zoom (ctrl+wheel for finer control)
  svg.onwheel = (e)=>{
    e.preventDefault(); const delta = -e.deltaY; const zoomFactor = Math.exp(delta*0.001);
    const prevScale = scale; scale = Math.max(0.4, Math.min(3, scale * zoomFactor));
    // zoom towards pointer
    const rect = svg.getBoundingClientRect();
    const px = (e.clientX - rect.left);
    const py = (e.clientY - rect.top);
    // convert to svg coordinates
    const sx = (px - pan.x) / prevScale;
    const sy = (py - pan.y) / prevScale;
    pan.x = px - sx * scale; pan.y = py - sy * scale;
    rootG.setAttribute('transform', `translate(${pan.x},${pan.y}) scale(${scale})`);
  };
  // ensure buttons also update scale variable
  document.getElementById('btn-zoom-in').onclick = ()=>{ scale = Math.min(3, scale+0.2); rootG.setAttribute('transform', `translate(${pan.x},${pan.y}) scale(${scale})`); };
  document.getElementById('btn-zoom-out').onclick = ()=>{ scale = Math.max(0.4, scale-0.2); rootG.setAttribute('transform', `translate(${pan.x},${pan.y}) scale(${scale})`); };
}

// tooltip that follows pointer and respects map transforms
function showTooltip(ev, d){
  hideTooltip();
  const tip = document.createElement('div');
  tip.className = 'tooltip';
  tip.style.position='fixed';
  tip.style.left = (ev.clientX+12)+'px';
  tip.style.top = (ev.clientY+12)+'px';
  tip.style.padding='8px';
  tip.style.background='white';
  tip.style.border='1px solid #e6eef8';
  tip.style.borderRadius='6px';
  tip.style.boxShadow='0 6px 12px rgba(2,6,23,0.04)';
  tip.innerHTML = `<strong>${d.name}</strong><br/>IP: ${d.ip}<br/>CPU: ${d.cpu}% MEM: ${d.mem}%<br/>Uptime: ${d.uptime}h`;
  tip.id = 'map-tooltip';
  document.body.appendChild(tip);
  // move with pointer
  const move = (e)=>{
    const t = document.getElementById('map-tooltip'); if(!t) return;
    t.style.left = (e.clientX+12)+'px'; t.style.top = (e.clientY+12)+'px';
  };
  window.addEventListener('pointermove', move);
  tip._move = move; // store to remove later
}
function hideTooltip(){
  const t = document.getElementById('map-tooltip');
  if(t){
    window.removeEventListener('pointermove', t._move);
    t.remove();
  }
}

function openCampusPanel(c){
  modalBody.innerHTML = `<h2>${c.name} Devices</h2>`;
  const list = data.devices.filter(d=>d.campus===c.id).map(d=>`<div class="device-row"><strong>${d.name}</strong> <span style='color:${d.status==='green'?"#16a34a":d.status==='yellow'?"#f59e0b":"#ef4444"}'>●</span></div>`).join('');
  modalBody.innerHTML += `<div>${list}</div>`;
  modal.classList.remove('hidden');
}

function openDeviceModal(d){
  modalBody.innerHTML = `
    <h2>${d.name}</h2>
    <p><strong>Type:</strong> ${d.type}</p>
    <p><strong>IP:</strong> ${d.ip}</p>
    <p><strong>CPU:</strong> ${d.cpu}%</p>
    <p><strong>Memory:</strong> ${d.mem}%</p>
    <p><strong>Temperature:</strong> ${d.temp}°C</p>
    <p><strong>Uptime:</strong> ${d.uptime} hours</p>
  `;
  modal.classList.remove('hidden');
}
modalClose.addEventListener('click', ()=>modal.classList.add('hidden'));
modal.addEventListener('click', (e)=>{ if(e.target===modal) modal.classList.add('hidden') });

// populate right panel
function renderDeviceCards(){
  deviceCardsEl.innerHTML='';
  for(const d of data.devices.slice(0,6)){
    const div = document.createElement('div');
    div.className = 'device-card';
    div.innerHTML = `<div style='display:flex;align-items:center'><div class='status-dot status-${d.status}'></div><div><strong>${d.name}</strong><div style='font-size:12px;color:#6b7280'>${d.ip}</div></div></div><div style='text-align:right'><div style='font-size:12px;color:#6b7280'>CPU ${d.cpu}%</div><div style='font-size:12px;color:#6b7280'>MEM ${d.mem}%</div></div>`;
    deviceCardsEl.appendChild(div);
  }
}

// predictive alerts simulation
function renderAlerts(){
  alertsEl.innerHTML='';
  const alerts = [
    {msg:'Predicted Wi-Fi congestion at Campus B in 48 minutes', level:'warning'},
    {msg:'Server C-3 projected SSD wear-out in 7 days', level:'critical'},
    {msg:'Intermittent packet loss on link A-B', level:'info'}
  ];
  for(const a of alerts){
    const li = document.createElement('li');
    li.innerHTML = `<strong>${a.level.toUpperCase()}</strong>: ${a.msg}`;
    alertsEl.appendChild(li);
  }
}

// charts
let wanChart, topChart;
function initCharts(){
  const times = Array.from({length:24}, (_,i)=> `${i}h`);
  const usage = times.map(()=> Math.round(20+Math.random()*80));
  const ctx = document.getElementById('wanChart').getContext('2d');
  wanChart = new Chart(ctx, { type:'line', data:{labels:times,datasets:[{label:'WAN Mbps',data:usage,borderColor:'#2b6fb6',backgroundColor:'rgba(43,111,182,0.12)'}]}, options:{responsive:true}});

  const topCtx = document.getElementById('topDevices').getContext('2d');
  const topLabels = data.devices.slice(0,5).map(d=>d.name);
  const topVals = data.devices.slice(0,5).map(d=>d.cpu+d.mem);
  topChart = new Chart(topCtx,{type:'bar',data:{labels:topLabels,datasets:[{label:'Load',data:topVals,backgroundColor:'#60a5fa'}]},options:{responsive:true}});

  // simple heatmap
  const hm = document.getElementById('heatmap');
  const hctx = hm.getContext('2d');
  const w = hm.width, h = hm.height;
  const grd = hctx.createLinearGradient(0,0,w,0);
  grd.addColorStop(0,'#fff');grd.addColorStop(1,'#bae6fd');
  hctx.fillStyle = grd;hctx.fillRect(0,0,w,h);
  // draw some hotspots
  for(let i=0;i<10;i++){
    const x = Math.random()*w;const y=Math.random()*h;const r=20+Math.random()*60;
    hctx.beginPath();
    hctx.fillStyle = `rgba(239,68,68,${Math.random()*0.3})`;
    hctx.arc(x,y,r,0,Math.PI*2);hctx.fill();
  }
}

// simulate dynamic updates
function simulateUpdates(){
  setInterval(()=>{
    for(const d of data.devices){
      // small fluctuations
      d.cpu = Math.max(1, Math.min(99, d.cpu + Math.round((Math.random()-0.45)*6)));
      d.mem = Math.max(1, Math.min(99, d.mem + Math.round((Math.random()-0.45)*4)));
      // status change
      if(Math.random()<0.02) d.status = 'yellow';
      if(Math.random()<0.01) d.status = 'red';
    }
    // update UI
    renderMap();renderDeviceCards();updateCharts();renderAlerts();
  }, 3000);
}

function updateCharts(){
  if(wanChart){
    wanChart.data.datasets[0].data.shift();
    wanChart.data.datasets[0].data.push(Math.round(20+Math.random()*120));
    wanChart.update();
  }
  if(topChart){
    topChart.data.datasets[0].data = data.devices.slice(0,5).map(d=>d.cpu+d.mem);
    topChart.update();
  }
}

// filters
const filterCampus = document.getElementById('filter-campus');
const filterType = document.getElementById('filter-type');
const filterStatus = document.getElementById('filter-status');

filterCampus.addEventListener('change', ()=>applyFilters());
filterType.addEventListener('change', ()=>applyFilters());
filterStatus.addEventListener('change', ()=>applyFilters());

function applyFilters(){
  const c = filterCampus.value;const t=filterType.value;const s=filterStatus.value;
  // persist filters
  try{ localStorage.setItem('egs_filters', JSON.stringify({c,t,s})); } catch(e){}
  // for simplicity re-generate map with filtered devices
  const originalDevices = data.devices;
  const filtered = originalDevices.filter(d=> (c==='all'||d.campus===c) && (t==='all'||d.type===t) && (s==='all'||d.status===s));
  data.devices = filtered;
  renderMap();
  data.devices = originalDevices;
}

// load persisted filters
try{
  const saved = JSON.parse(localStorage.getItem('egs_filters') || 'null');
  if(saved){ filterCampus.value = saved.c || 'all'; filterType.value = saved.t || 'all'; filterStatus.value = saved.s || 'all'; }
}catch(e){}


// export CSV
document.getElementById('export-csv').addEventListener('click', ()=>{
  const rows = [ ['id','name','campus','type','ip','cpu','mem','temp','uptime','status'] ];
  for(const d of data.devices){ rows.push([d.id,d.name,d.campus,d.type,d.ip,d.cpu,d.mem,d.temp,d.uptime,d.status]); }
  const csv = rows.map(r=>r.map(c=>`"${String(c).replace(/"/g,'""') }"`).join(',')).join('\n');
  const blob = new Blob([csv],{type:'text/csv'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');a.href = url;a.download='devices.csv';a.click();URL.revokeObjectURL(url);
});

// init
renderMap();renderDeviceCards();renderAlerts();initCharts();simulateUpdates();

// nav
const navItems = document.querySelectorAll('.nav-item');
navItems.forEach(n=>n.addEventListener('click', ()=>{
  navItems.forEach(x=>x.classList.remove('active'));
  n.classList.add('active');
  document.querySelector('.main-header h1').textContent = n.textContent.trim();
}));

// topology toggle
let topology=false;document.getElementById('btn-toggle-topology').addEventListener('click', ()=>{ topology=!topology; renderMap(topology); });

// minimal accessibility: keyboard close modal
window.addEventListener('keydown',(e)=>{ if(e.key==='Escape') modal.classList.add('hidden') });
