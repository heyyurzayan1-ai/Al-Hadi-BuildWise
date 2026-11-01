/* Al Hadi BuildWise interactive 2D floor-plan editor */
(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const KEY = 'alhadi-buildwise-floorplan-v1';
  const state = { width:30, height:24, wallThickness:0.5, rooms:[], selected:null, grid:true };
  const palette = ['#244b68','#315b70','#3b536f','#365f5a','#5a4b70'];
  let nextId = 1;
  function esc(v) {
    return String(v).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch(e) {}
    if ($('fpStatus')) $('fpStatus').textContent = 'Saved on this device';
  }
  function load() {
    try {
      const d = JSON.parse(localStorage.getItem(KEY) || 'null');
      if (d && Array.isArray(d.rooms)) {
        state.width = Number(d.width) || 30; state.height = Number(d.height) || 24; state.wallThickness = Number(d.wallThickness) || 0.5;
        state.rooms = d.rooms; state.selected = d.selected || (d.rooms[0] && d.rooms[0].id) || null;
        nextId = d.rooms.reduce((m,r) => Math.max(m,Number(r.id)||0),0)+1;
      }
    } catch(e) {}
  }
  function defaults(name) {
    const map = {'Bedroom':[12,12],'Master bedroom':[14,14],'Bathroom':[7,6],'Kitchen':[10,9],
      'Lounge':[15,13],'Store':[6,6],'Dining room':[10,10],'Drawing room':[14,12],
      'Office':[12,10],'Shop':[15,12]};
    return map[name] || [10,10];
  }
  function addRoom(name) {
    const d = defaults(name), w = Math.min(d[0],state.width), h = Math.min(d[1],state.height);
    const i = state.rooms.length, x = Math.min((i%2)*Math.max(1,Math.floor((state.width-w)/2)),state.width-w);
    const y = Math.min(Math.floor(i/2)*Math.max(1,h+1),state.height-h);
    const r = {id:nextId++,name:name,x:x,y:y,w:w,h:h,door:true,window:true,doorWidth:3,windowWidth:4};
    state.rooms.push(r); state.selected = r.id; render();
  }
  function selected() { return state.rooms.find(r => r.id === state.selected) || null; }
  function update(key,value) {
    const r = selected(); if (!r) return;
    if (key === 'name') r.name = String(value).slice(0,35);
    else if (key === 'door' || key === 'window') r[key] = Boolean(value);
    else if (key === 'doorWidth' || key === 'windowWidth') { const n=Number(value); if(!Number.isFinite(n))return; r[key]=Math.max(1,Math.min(key==='doorWidth'?r.w:r.w,n)); }
    else if (key === 'wallThickness') { const n=Number(value); if(!Number.isFinite(n))return; state.wallThickness=Math.max(0.1,Math.min(1.5,n)); }
    else {
      const n = Number(value); if (!Number.isFinite(n)) return;
      r[key] = Math.max(0,Math.min(key==='w'?state.width:key==='h'?state.height:10000,n));
    }
    render();
  }
  function overlap(a,b) {
    return a.x < b.x+b.w && a.x+a.w > b.x && a.y < b.y+b.h && a.y+a.h > b.y;
  }
  function draw() {
    const svg = $('fpDrawing'); if (!svg) return;
    const s = Math.min(25,760/state.width,560/state.height), p=48, w=state.width*s, h=state.height*s;
    svg.setAttribute('viewBox','0 0 '+(w+2*p)+' '+(h+2*p));
    let out = '<defs><pattern id="fpGrid" width="'+s+'" height="'+s+'" patternUnits="userSpaceOnUse"><path d="M '+s+' 0 L 0 0 0 '+s+'" fill="none" stroke="#31445e" stroke-width=".7"/></pattern></defs>';
    if (state.grid) out += '<rect x="'+p+'" y="'+p+'" width="'+w+'" height="'+h+'" fill="url(#fpGrid)"/>';
    out += '<rect x="'+p+'" y="'+p+'" width="'+w+'" height="'+h+'" fill="none" stroke="#d9e9fa" stroke-width="4"/>';
    out += '<text x="'+(p+w/2)+'" y="'+(p-18)+'" text-anchor="middle" fill="#b7c9df" font-size="12">'+state.width+' ft</text>';
    out += '<text x="'+(p-12)+'" y="'+(p+h/2)+'" text-anchor="middle" fill="#b7c9df" font-size="12" transform="rotate(-90 '+(p-12)+' '+(p+h/2)+')">'+state.height+' ft</text>';
    state.rooms.forEach((r,i) => {
      const x=p+r.x*s,y=p+r.y*s,rw=r.w*s,rh=r.h*s,chosen=r.id===state.selected;
      out += '<g data-room="'+r.id+'" style="cursor:pointer">';
      out += '<rect x="'+x+'" y="'+y+'" width="'+rw+'" height="'+rh+'" fill="'+palette[i%palette.length]+'" fill-opacity=".82" stroke="'+(chosen?'#48d6a5':'#d9e9fa')+'" stroke-width="'+(chosen?4:2.5)+'"/>';
      out += '<text x="'+(x+rw/2)+'" y="'+(y+rh/2-4)+'" text-anchor="middle" fill="#fff" font-size="'+Math.max(10,Math.min(15,s*.7))+'" pointer-events="none">'+esc(r.name)+'</text>';
      out += '<text x="'+(x+rw/2)+'" y="'+(y+rh/2+13)+'" text-anchor="middle" fill="#e4edf8" font-size="10" pointer-events="none">'+r.w+' × '+r.h+' ft</text>';
      if(r.door) out += '<path d="M '+(x+(rw-Math.min(r.doorWidth||3,r.w)) * s/2)+' '+(y+rh)+' h '+(Math.min(r.doorWidth||3,r.w)*s)+'" stroke="#ffc66d" stroke-width="6"/>';
      if(r.window) out += '<path d="M '+(x+(rw-Math.min(r.windowWidth||4,r.w)) * s/2)+' '+y+' h '+(Math.min(r.windowWidth||4,r.w)*s)+'" stroke="#48d6d8" stroke-width="6"/>'
      out += '</g>';
    });
    out += '<text x="'+p+'" y="'+(p+h+27)+'" fill="#91a7c2" font-size="11">Concept layout • grid unit = 1 foot • not a construction drawing</text>';
    svg.innerHTML=out;
    svg.querySelectorAll('[data-room]').forEach(g=>g.addEventListener('click',()=>{state.selected=Number(g.getAttribute('data-room'));render();}));
  }
  function roomList() {
    const el=$('fpRoomList'); if(!el)return;
    el.innerHTML=state.rooms.length?state.rooms.map(r=>'<button type="button" class="fp-room-chip '+(r.id===state.selected?'selected':'')+'" data-pick="'+r.id+'">'+esc(r.name)+' <small>'+r.w+'×'+r.h+' ft</small></button>').join(''):'<p class="muted small">No rooms yet. Add your first room above.</p>';
    el.querySelectorAll('[data-pick]').forEach(b=>b.addEventListener('click',()=>{state.selected=Number(b.dataset.pick);render();}));
  }
  function inspector() {
    const panel=$('fpInspector'),r=selected(); if(!panel)return;
    if(!r){panel.innerHTML='<p class="muted small">Select a room in the drawing or add a room to edit it.</p>';return;}
    panel.innerHTML='<div class="row"><div><label>Room name</label><input id="fpName" maxlength="35" value="'+esc(r.name)+'"></div><div><label>Room width (ft)</label><input id="fpRoomW" type="number" min="1" step=".5" value="'+r.w+'"></div></div>'+
      '<div class="row"><div><label>Room depth (ft)</label><input id="fpRoomH" type="number" min="1" step=".5" value="'+r.h+'"></div><div><label>Position X / Y (ft)</label><div class="row"><input aria-label="Position X" id="fpX" type="number" min="0" step=".5" value="'+r.x+'"><input aria-label="Position Y" id="fpY" type="number" min="0" step=".5" value="'+r.y+'"></div></div></div>'+
      '<div class="row"><label class="fp-check"><input id="fpDoor" type="checkbox" '+(r.door?'checked':'')+'> Show door opening</label><label class="fp-check"><input id="fpWindow" type="checkbox" '+(r.window?'checked':'')+'> Show window opening</label></div>'+
      '<div class="row"><div><label>Door width (ft)</label><input id="fpDoorW" type="number" min="1" step="0.5" value="'+(r.doorWidth||3)+'"></div><div><label>Window width (ft)</label><input id="fpWindowW" type="number" min="1" step="0.5" value="'+(r.windowWidth||4)+'"></div></div>'+
      '<button type="button" class="fp-danger" id="fpDelete">Delete selected room</button>';
    $('fpName').addEventListener('change',e=>update('name',e.target.value));
    [['fpRoomW','w'],['fpRoomH','h'],['fpX','x'],['fpY','y']].forEach(pair=>$(pair[0]).addEventListener('change',e=>update(pair[1],e.target.value)));
    $('fpDoor').addEventListener('change',e=>update('door',e.target.checked));
    $('fpWindow').addEventListener('change',e=>update('window',e.target.checked));
    $('fpDoorW').addEventListener('change',e=>update('doorWidth',e.target.value));
    $('fpWindowW').addEventListener('change',e=>update('windowWidth',e.target.value));
    $('fpDelete').addEventListener('click',()=>{state.rooms=state.rooms.filter(x=>x.id!==state.selected);state.selected=state.rooms[0]?state.rooms[0].id:null;render();});
  }
  function render() {
    $('fpSiteW').value=state.width; $('fpSiteH').value=state.height;
    if($('fpWallThickness')) $('fpWallThickness').value=state.wallThickness;
    draw(); roomList(); inspector();
    const collisions=[];
    state.rooms.forEach((a,i)=>state.rooms.slice(i+1).forEach(b=>{if(overlap(a,b))collisions.push(a.name+' and '+b.name);}));
    $('fpWarnings').innerHTML=collisions.length?'<div class="result warn"><b>Layout warning:</b> Overlapping rooms: '+collisions.map(esc).join(', ')+'. Move them apart.</div>':'<div class="result">No room overlaps detected by this basic 2D check.</div>';
    $('fpArea').textContent=(state.width*state.height).toFixed(1)+' sq ft site area';
    save();
  }
  function downloadFile(name,content,type) {
    const blob=new Blob([content],{type:type}),url=URL.createObjectURL(blob),a=document.createElement('a');
    a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();
    setTimeout(()=>URL.revokeObjectURL(url),1500);
  }
  function exportSvg() {
    const clone=$('fpDrawing').cloneNode(true); clone.setAttribute('xmlns','http://www.w3.org/2000/svg');
    downloadFile('Al-Hadi-BuildWise-Floor-Plan.svg',new XMLSerializer().serializeToString(clone),'image/svg+xml;charset=utf-8');
  }
  function exportJson() {
    const data={app:'Al Hadi BuildWise',formatVersion:1,units:'feet',exportedAt:new Date().toISOString(),site:{width:state.width,height:state.height},rooms:state.rooms};
    downloadFile('Al-Hadi-BuildWise-Project.json',JSON.stringify(data,null,2),'application/json;charset=utf-8');
  }
  function exportDxf() {
    let d='0\nSECTION\n2\nHEADER\n9\n$INSUNITS\n70\n2\n0\nENDSEC\n0\nSECTION\n2\nTABLES\n0\nTABLE\n2\nLAYER\n70\n5\n';
    [['SITE',7],['WALLS',7],['OPENINGS',3],['DIMENSIONS',2],['LABELS',4]].forEach(v=>{d+='0\nLAYER\n2\n'+v[0]+'\n70\n0\n62\n'+v[1]+'\n6\nCONTINUOUS\n';});
    d+='0\nENDTAB\n0\nENDSEC\n0\nSECTION\n2\nENTITIES\n';
    function line(x1,y1,x2,y2,layer){d+='0\nLINE\n8\n'+layer+'\n10\n'+x1+'\n20\n'+y1+'\n30\n0\n11\n'+x2+'\n21\n'+y2+'\n31\n0\n';}
    function text(x,y,value,height,layer){d+='0\nTEXT\n8\n'+layer+'\n10\n'+x+'\n20\n'+y+'\n30\n0\n40\n'+height+'\n1\n'+String(value).replace(/[\r\n]/g,' ')+'\n';}
    function dimensionH(x1,x2,y,label){
      line(x1,y,x2,y,'DIMENSIONS');line(x1,y-0.18,x1,y+0.18,'DIMENSIONS');line(x2,y-0.18,x2,y+0.18,'DIMENSIONS');
      text((x1+x2)/2-0.5,y+0.22,label,0.35,'DIMENSIONS');
    }
    function dimensionV(y1,y2,x,label){
      line(x,y1,x,y2,'DIMENSIONS');line(x-0.18,y1,x+0.18,y1,'DIMENSIONS');line(x-0.18,y2,x+0.18,y2,'DIMENSIONS');
      text(x+0.22,(y1+y2)/2,label,0.35,'DIMENSIONS');
    }
    line(0,0,state.width,0,'SITE');line(state.width,0,state.width,state.height,'SITE');
    line(state.width,state.height,0,state.height,'SITE');line(0,state.height,0,0,'SITE');
    dimensionH(0,state.width,-1.4,state.width+' ft');dimensionV(0,state.height,state.width+1.4,state.height+' ft');
    const t=state.wallThickness;
    state.rooms.forEach(r=>{
      const x=r.x,y=r.y,w=r.w,h=r.h,door=r.door?Math.min(r.doorWidth||3,w):0,win=r.window?Math.min(r.windowWidth||4,w):0;
      const dx=x+(w-door)/2,wx=x+(w-win)/2;
      // Each room exports paired wall-face lines. Door is centered on the lower wall; window on the upper wall.
      const edges=[
        [x,y,x+Math.max(0,(w-door)/2),y],[dx+door,y,x+w,y],
        [x,y+h,x+Math.max(0,(w-win)/2),y+h],[wx+win,y+h,x+w,y+h],
        [x,y,x,y+h],[x+w,y,x+w,y+h]
      ];
      edges.forEach(e=>{line(e[0],e[1],e[2],e[3],'WALLS');});
      const inner=[
        [x+t,y+t,x+t+Math.max(0,(w-door)/2),y+t],
        [dx+door,y+t,x+w-t,y+t],
        [x+t,y+h-t,x+t+Math.max(0,(w-win)/2),y+h-t],
        [wx+win,y+h-t,x+w-t,y+h-t],
        [x+t,y+t,x+t,y+h-t],[x+w-t,y+t,x+w-t,y+h-t]
      ];
      inner.forEach(e=>line(e[0],e[1],e[2],e[3],'WALLS'));
      if(door>0){line(dx,y,dx,y+Math.min(door,2.5),'OPENINGS');line(dx+door,y,dx+door,y+Math.min(door,2.5),'OPENINGS');text(dx,y-0.65,'DOOR '+door+' ft',0.3,'OPENINGS');}
      if(win>0){line(wx,y+h,wx,y+h-0.35,'OPENINGS');line(wx+win,y+h,wx+win,y+h-0.35,'OPENINGS');text(wx,y+h+0.45,'WINDOW '+win+' ft',0.3,'OPENINGS');}
      text(x+w/2-1,y+h/2,r.name,0.45,'LABELS');
      dimensionH(x,x+w,y-0.75,w+' ft');
      dimensionV(y,y+h,x+w+0.75,h+' ft');
    });
    text(0,-2.4,'AL HADI BUILDWISE | UNITS: FEET | WALL THICKNESS: '+t+' ft',0.4,'LABELS');
    d+='0\nENDSEC\n0\nEOF\n';
    downloadFile('Al-Hadi-BuildWise-Advanced-Floor-Plan.dxf',d,'application/dxf');
  }
  function exportPdf() {
    const svg=$('fpDrawing').cloneNode(true);svg.setAttribute('xmlns','http://www.w3.org/2000/svg');
    const svgText=new XMLSerializer().serializeToString(svg);
    const rows=state.rooms.map(r=>'<tr><td>'+esc(r.name)+'</td><td>'+r.w+' × '+r.h+' ft</td><td>'+r.x+', '+r.y+' ft</td><td>'+(r.w*r.h).toFixed(1)+' sq ft</td></tr>').join('');
    const w=window.open('','_blank');
    if(!w){alert('Allow pop-ups for this site, then try PDF export again.');return;}
    w.document.write('<!doctype html><html><head><meta charset="utf-8"><title>Al Hadi BuildWise Floor Plan</title><style>body{font:14px Arial,sans-serif;color:#172334;margin:28px}h1{font-size:22px}svg{width:100%;max-height:650px}table{width:100%;border-collapse:collapse;margin-top:18px}td,th{border:1px solid #bbb;padding:7px;text-align:left}.note{font-size:11px;color:#555;margin-top:18px}@media print{button{display:none}}</style></head><body><h1>Al Hadi BuildWise — Floor Plan</h1><p>Site: '+state.width+' × '+state.height+' ft · Area: '+(state.width*state.height).toFixed(1)+' sq ft</p>'+svgText+'<h2>Room schedule</h2><table><thead><tr><th>Room</th><th>Size</th><th>Position</th><th>Area</th></tr></thead><tbody>'+rows+'</tbody></table><p class="note">Concept layout only. Not a construction-ready, code-approved or structural drawing. Have all plans reviewed by qualified local professionals.</p><button onclick="window.print()">Print / Save as PDF</button><script>window.onload=function(){setTimeout(function(){window.print()},400)};<\\/script></body></html>');
    w.document.close();
  }
  function init() {
    if(!$('fpDrawing'))return; load();
    $('fpAddRoom').addEventListener('click',()=>addRoom($('fpRoomType').value));
    $('fpWallThickness').addEventListener('change',e=>update('wallThickness',e.target.value));
    $('fpSiteApply').addEventListener('click',()=>{
      const w=Number($('fpSiteW').value),h=Number($('fpSiteH').value);
      if(!(w>=5&&h>=5&&w<=200&&h<=200)){$('fpWarnings').innerHTML='<div class="result warn">Site dimensions must be between 5 and 200 feet.</div>';return;}
      state.width=w;state.height=h;render();
    });
    $('fpGridToggle').addEventListener('change',e=>{state.grid=e.target.checked;render();});
    $('fpExport').addEventListener('click',exportSvg);
    $('fpExportPdf').addEventListener('click',exportPdf);
    $('fpExportDxf').addEventListener('click',exportDxf);
    $('fpExportJson').addEventListener('click',exportJson);
    $('fpReset').addEventListener('click',()=>{
      if(!confirm('Start a new blank plan? This clears the saved plan on this device.'))return;
      state.rooms=[];state.selected=null;nextId=1;render();
    });
    render(); if(!state.rooms.length){addRoom('Lounge');addRoom('Bedroom');addRoom('Kitchen');addRoom('Bathroom');}
  }
  document.addEventListener('DOMContentLoaded',init);
})();