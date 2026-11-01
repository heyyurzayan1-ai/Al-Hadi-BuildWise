/* Al Hadi BuildWise interactive 2D floor-plan editor */
(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const KEY = 'alhadi-buildwise-floorplan-v1';
  const state = { width:30, height:24, wallThickness:0.5, rooms:[], selected:null, grid:true, entranceSide:'south', entranceRoom:null, showRoute:true, routeWidth:3 };
  const palette = ['#244b68','#315b70','#3b536f','#365f5a','#5a4b70'];
  let nextId = 1;
  let geminiKey = '';
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
        state.rooms = d.rooms.map(r=>Object.assign({doorSide:'south',windowSide:'north',doorOffset:0.5,doorSwing:'in',ceilingHeight:10,floorFinish:'Ceramic tile',wallFinish:'Paint / plaster',ceilingFinish:'Painted ceiling',lightingPoints:1,socketPoints:2,switchPoints:1,ventilation:'Window / natural',plumbing:'None',notes:''},r)); state.selected = d.selected || (d.rooms[0] && d.rooms[0].id) || null; state.entranceSide=d.entranceSide||'south'; state.entranceRoom=d.entranceRoom||state.rooms[0]?.id||null; state.showRoute=d.showRoute!==false; state.routeWidth=Number(d.routeWidth)||3;
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
    const r = {id:nextId++,name:name,x:x,y:y,w:w,h:h,door:true,window:true,doorWidth:3,windowWidth:4,doorSide:'south',windowSide:'north',doorOffset:0.5,doorSwing:'in',ceilingHeight:10,floorFinish:'Ceramic tile',wallFinish:'Paint / plaster',ceilingFinish:'Painted ceiling',lightingPoints:1,socketPoints:2,switchPoints:1,ventilation:'Window / natural',plumbing:'None',notes:''};
    if(!state.entranceRoom) state.entranceRoom=r.id;
    state.rooms.push(r); state.selected = r.id; render();
  }
  function validateAiPlan(plan,width,height) {
    if(!plan||!Array.isArray(plan.rooms)||plan.rooms.length<1||plan.rooms.length>20) throw new Error('AI response did not contain a valid room list (1–20 rooms).');
    const allowed=['Bedroom','Master bedroom','Bathroom','Kitchen','Lounge','Dining room','Drawing room','Store','Garage','Office','Shop','Staircase','Laundry','Balcony','Corridor'];
    const rooms=plan.rooms.map((r,i)=>{
      const x=Number(r.x),y=Number(r.y),w=Number(r.w),h=Number(r.h);
      if(![x,y,w,h].every(Number.isFinite)||w<3||h<3||x<0||y<0||x+w>width+0.05||y+h>height+0.05) throw new Error('AI produced room dimensions outside the plot. Try a larger plot or simpler brief.');
      const name=allowed.includes(r.name)?r.name:'Room '+(i+1);
      return {id:nextId++,name,x:Number(x.toFixed(2)),y:Number(y.toFixed(2)),w:Number(w.toFixed(2)),h:Number(h.toFixed(2)),door:r.door!==false,window:r.window!==false,doorWidth:Math.min(Math.max(2,Number(r.doorWidth)||3),w),windowWidth:Math.min(Math.max(2,Number(r.windowWidth)||4),w),doorSide:['north','south','east','west'].includes(r.doorSide)?r.doorSide:'south',windowSide:['north','south','east','west'].includes(r.windowSide)?r.windowSide:'north',doorOffset:0.5,doorSwing:'in'};
    });
    for(let i=0;i<rooms.length;i++) for(let k=i+1;k<rooms.length;k++) {
      const a=rooms[i],b=rooms[k];
      if(overlap(a,b)) throw new Error('AI layout contains overlapping rooms. Please generate again or simplify your requirements.');
    }
    return rooms;
  }
  async function generateWithGemini() {
    const keyInput=$('fpGeminiKey'),brief=$('fpAiBrief').value.trim();
    const width=Number($('fpSiteW').value),height=Number($('fpSiteH').value);
    const status=$('fpAiResult');
    const key=(keyInput&&keyInput.value.trim())||geminiKey;
    if(!key){status.innerHTML='<div class="result warn">Enter your Gemini API key first. Create one in Google AI Studio.</div>';return;}
    if(!brief){status.innerHTML='<div class="result warn">Describe the rooms and requirements first.</div>';return;}
    if(!(width>=10&&height>=10&&width<=200&&height<=200)){status.innerHTML='<div class="result warn">Enter a plot size between 10 and 200 feet.</div>';return;}
    geminiKey=key;
    const button=$('fpAiRealGenerate');button.disabled=true;button.textContent='AI is designing…';
    status.innerHTML='<div class="result">Connecting to Gemini AI and preparing your floor plan…</div>';
    const schema={
      type:'OBJECT',
      properties:{
        summary:{type:'STRING'},
        rooms:{type:'ARRAY',items:{type:'OBJECT',properties:{
          name:{type:'STRING'},x:{type:'NUMBER'},y:{type:'NUMBER'},w:{type:'NUMBER'},h:{type:'NUMBER'},
          door:{type:'BOOLEAN'},window:{type:'BOOLEAN'},doorWidth:{type:'NUMBER'},windowWidth:{type:'NUMBER'}
        },required:['name','x','y','w','h','door','window','doorWidth','windowWidth']}}
      },required:['summary','rooms']
    };
    const prompt='You are a careful conceptual residential space planner. Return a practical 2D room layout in feet for a rectangular plot. Plot width='+width+' ft (x axis), plot depth='+height+' ft (y axis). User requirements: '+brief+'. Generate room rectangles with x,y measured from the top-left plot corner, and w,h. Every room must be fully inside plot bounds; no room rectangles may overlap. Use sensible approximate room sizes, include circulation/corridor if requested or needed, and keep a usable entrance/door opening on each room. Place bathrooms sensibly near bedrooms and kitchen near dining if possible. Do not claim code compliance, structural safety, setbacks, ventilation compliance or construction approval. Return 4 to 20 spaces only if the brief needs them; otherwise return the requested spaces. Ensure x>=0,y>=0,w>=3,h>=3,x+w<=plot width,y+h<=plot depth. Door and window widths in feet. Summary should state this is conceptual and mention assumptions.';
    try{
      const response=await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent?key='+encodeURIComponent(key),{
        method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({contents:[{parts:[{text:prompt}]}],generationConfig:{responseMimeType:'application/json',responseJsonSchema:schema,temperature:0.35}})
      });
      const data=await response.json();
      if(!response.ok) throw new Error((data.error&&data.error.message)||('Gemini API request failed ('+response.status+'). Check the key, quota and API access.'));
      const raw=data.candidates&&data.candidates[0]&&data.candidates[0].content&&data.candidates[0].content.parts&&data.candidates[0].content.parts.map(p=>p.text||'').join('');
      if(!raw) throw new Error('Gemini returned no plan. Please try a shorter brief.');
      const plan=JSON.parse(raw),rooms=validateAiPlan(plan,width,height);
      state.width=width;state.height=height;state.rooms=rooms;state.selected=rooms[0].id;state.entranceRoom=rooms[0].id;render();
      status.innerHTML='<div class="result"><b>Gemini AI created your concept plan.</b><br>'+esc(plan.summary||'AI generated room layout')+'<br>'+rooms.length+' rooms added to the editable drawing.</div><p class="fp-help">Review every room size and position. If the layout is unsuitable, regenerate or edit it. This is not an approved architectural or structural plan.</p>';
      $('fpDrawing').scrollIntoView({behavior:'smooth',block:'center'});
    }catch(error){
      status.innerHTML='<div class="result warn"><b>AI generation failed:</b> '+esc(error.message||'Unknown error')+'</div><p class="fp-help">Your existing floor plan has not been replaced. Check internet, API key, Gemini API access and quota.</p>';
    }finally{button.disabled=false;button.textContent='Generate with Gemini AI';}
  }
  function generateFromBrief() {
    const brief=(($('fpAiBrief')&&$('fpAiBrief').value)||'').toLowerCase();
    const width=Number($('fpSiteW').value),height=Number($('fpSiteH').value);
    if(!(width>=5&&height>=5&&width<=200&&height<=200)){
      $('fpAiResult').innerHTML='<div class="result warn">Enter plot dimensions between 5 and 200 feet first.</div>';return;
    }
    state.width=width;state.height=height;
    const specs=[
      {name:'Bedroom',keys:['bedroom','bed room','bed'],fallback:2,size:[11,12]},
      {name:'Master bedroom',keys:['master bedroom','master bed'],fallback:0,size:[13,14]},
      {name:'Bathroom',keys:['bathroom','bath room','washroom','toilet'],fallback:1,size:[6,7]},
      {name:'Kitchen',keys:['kitchen'],fallback:1,size:[9,10]},
      {name:'Lounge',keys:['lounge','living room','living'],fallback:1,size:[12,13]},
      {name:'Drawing room',keys:['drawing room','guest room'],fallback:0,size:[11,12]},
      {name:'Dining room',keys:['dining'],fallback:0,size:[9,10]},
      {name:'Garage',keys:['garage','car porch','car parking'],fallback:0,size:[10,16]},
      {name:'Store',keys:['store','storage'],fallback:0,size:[5,6]}
    ];
    const names=[];
    specs.forEach(spec=>{
      const key=spec.keys.find(k=>brief.includes(k));
      let count=0;
      if(key){
        const match=brief.match(new RegExp('(?:^|\\b)(\\d+)\\s*'+key+'s?(?:\\b)'));
        count=match?Math.min(6,Number(match[1])):1;
      } else if(spec.fallback && !brief.trim()) count=spec.fallback;
      else if(spec.fallback && (spec.name==='Bedroom'||spec.name==='Bathroom'||spec.name==='Kitchen'||spec.name==='Lounge')) {
        const generic=brief.includes('house')||brief.includes('home')||brief.includes('family');
        if(generic)count=spec.fallback;
      }
      for(let i=0;i<count;i++)names.push({name:spec.name,size:spec.size});
    });
    if(!names.length){
      names.push({name:'Bedroom',size:[11,12]},{name:'Bedroom',size:[11,12]},{name:'Bathroom',size:[6,7]},{name:'Kitchen',size:[9,10]},{name:'Lounge',size:[12,13]});
    }
    if(names.length>16){$('fpAiResult').innerHTML='<div class="result warn">This first generator supports up to 16 spaces. Reduce the room count and try again.</div>';return;}
    const cols=Math.ceil(Math.sqrt(names.length*width/height)),rows=Math.ceil(names.length/cols);
    const cellW=width/cols,cellH=height/rows;
    if(cellW<5||cellH<5){$('fpAiResult').innerHTML='<div class="result warn">The plot is too small for this many rooms. Increase plot size or reduce room count.</div>';return;}
    state.rooms=names.map((item,index)=>{
      const col=index%cols,row=Math.floor(index/cols);
      const x=col*cellW,y=row*cellH;
      const w=cellW,h=cellH;
      return {id:nextId++,name:item.name,x:Number(x.toFixed(2)),y:Number(y.toFixed(2)),w:Number(w.toFixed(2)),h:Number(h.toFixed(2)),door:true,window:item.name!=='Bathroom',doorWidth:Math.min(3,w),windowWidth:Math.min(4,w)};
    });
    state.selected=state.rooms[0]?state.rooms[0].id:null;state.entranceRoom=state.selected;
    render();
    const area=state.rooms.reduce((sum,r)=>sum+r.w*r.h,0);
    $('fpAiResult').innerHTML='<div class="result"><b>Concept plan generated.</b> '+state.rooms.length+' spaces arranged inside '+width+' × '+height+' ft plot. Approximate allocated area: '+area.toFixed(1)+' sq ft. Edit individual rooms below, then export PDF or DXF.</div><p class="fp-help">Generated from your written room requirements using an on-device layout rule engine. It is not a connected generative-AI model and does not verify circulation, setbacks, building codes, structure or site conditions.</p>';
    $('fpDrawing').scrollIntoView({behavior:'smooth',block:'center'});
  }
  function selected() { return state.rooms.find(r => r.id === state.selected) || null; }
  function update(key,value) {
    if (key === 'wallThickness') { const n=Number(value); if(!Number.isFinite(n))return; state.wallThickness=Math.max(0.1,Math.min(1.5,n)); render(); return; }
    if (key === 'entranceSide') { if(['north','south','east','west'].includes(value))state.entranceSide=value; render(); return; }
    if (key === 'entranceRoom') { state.entranceRoom=Number(value)||null; render(); return; }
    if (key === 'showRoute') { state.showRoute=!!value; render(); return; }
    if (key === 'routeWidth') { const n=Number(value); if(Number.isFinite(n))state.routeWidth=Math.max(2,Math.min(8,n)); render(); return; }
    const r = selected(); if (!r) return;
    if (key === 'name') r.name = String(value).slice(0,35);
    else if (key === 'door' || key === 'window') r[key] = Boolean(value);
    else if (key === 'doorSide' || key === 'windowSide') { if(['north','south','east','west'].includes(value))r[key]=value; }
    else if (key === 'doorSwing') { if(['in','out'].includes(value))r[key]=value; }
    else if (['floorFinish','wallFinish','ceilingFinish','ventilation','plumbing','notes'].includes(key)) r[key]=String(value).slice(0,300);
    else if (['ceilingHeight','lightingPoints','socketPoints','switchPoints'].includes(key)) { const n=Number(value);if(!Number.isFinite(n)||n<0)return;r[key]=Math.min(key==='ceilingHeight'?30:50,n); }
    else if (key === 'doorWidth' || key === 'windowWidth') { const n=Number(value); if(!Number.isFinite(n))return; r[key]=Math.max(1,Math.min(key==='doorWidth'?r.w:r.w,n)); }
    else if (['x','y','w','h'].includes(key)) {
      const n = Number(value); if (!Number.isFinite(n)) return;
      if (key === 'w') r.w = Math.max(1, Math.min(state.width - r.x, n));
      else if (key === 'h') r.h = Math.max(1, Math.min(state.height - r.y, n));
      else if (key === 'x') r.x = Math.max(0, Math.min(state.width - r.w, n));
      else if (key === 'y') r.y = Math.max(0, Math.min(state.height - r.h, n));
      r.doorWidth = Math.min(Number(r.doorWidth) || 3, (r.doorSide === 'east' || r.doorSide === 'west') ? r.h : r.w);
      r.windowWidth = Math.min(Number(r.windowWidth) || 4, (r.windowSide === 'east' || r.windowSide === 'west') ? r.h : r.w);
    }
    render();
  }
  function overlap(a,b) {
    return a.x < b.x+b.w && a.x+a.w > b.x && a.y < b.y+b.h && a.y+a.h > b.y;
  }
  function draw() {
    const svg = $('fpDrawing'); if (!svg) return;
    const s=Math.min(25,760/state.width,560/state.height),p=64,w=state.width*s,h=state.height*s;
    svg.setAttribute('viewBox','0 0 '+(w+2*p)+' '+(h+2*p+42));
    let out='<rect width="100%" height="100%" fill="#fff"/>';
    if(state.grid) out+='<defs><pattern id="fpGrid" width="'+s+'" height="'+s+'" patternUnits="userSpaceOnUse"><path d="M '+s+' 0 L 0 0 0 '+s+'" fill="none" stroke="#e9edf2" stroke-width=".7"/></pattern></defs><rect x="'+p+'" y="'+p+'" width="'+w+'" height="'+h+'" fill="url(#fpGrid)"/>';
    out+='<rect x="'+p+'" y="'+p+'" width="'+w+'" height="'+h+'" fill="none" stroke="#111827" stroke-width="5"/>';
    out+='<text x="'+(p+w/2)+'" y="'+(p-25)+'" text-anchor="middle" fill="#111827" font-size="13" font-weight="700">'+state.width+"'-0\""+'</text>';
    out+='<text x="'+(p-22)+'" y="'+(p+h/2)+'" text-anchor="middle" fill="#111827" font-size="13" transform="rotate(-90 '+(p-22)+' '+(p+h/2)+')">'+state.height+"'-0\""+'</text>';
    function rect(x,y,ww,hh,rx=1){return '<rect x="'+x+'" y="'+y+'" width="'+ww+'" height="'+hh+'" rx="'+rx+'" fill="#fff" stroke="#555" stroke-width="1.4"/>';}
    function line(x1,y1,x2,y2,sw=1.4,color='#555'){return '<path d="M '+x1+' '+y1+' L '+x2+' '+y2+'" fill="none" stroke="'+color+'" stroke-width="'+sw+'"/>';}
    function furniture(r,x,y,rw,rh){
      const n=r.name.toLowerCase(),cx=x+rw/2,cy=y+rh/2,unit=Math.max(1.5,s*.12);
      let z='';
      if(n.includes('bedroom')){
        const bw=Math.min(rw*.48,s*5.4),bh=Math.min(rh*.55,s*6.5),bx=x+rw*.12,by=y+rh*.2;
        z+=rect(bx,by,bw,bh,2)+rect(bx+2,by+2,bw/2-3,bh*.19,3)+rect(bx+bw/2+1,by+2,bw/2-3,bh*.19,3);
        z+=line(bx,by+bh*.25,bx+bw,by+bh*.25,1,'#888');
        const wx=x+rw*.68,wy=y+rh*.22;
        z+=rect(wx,wy,Math.min(rw*.2,s*2.2),Math.min(rh*.42,s*4),1);
        z+='<text x="'+(wx+Math.min(rw*.2,s*2.2)/2)+'" y="'+(wy+Math.min(rh*.42,s*4)/2+3)+'" font-size="7" text-anchor="middle" fill="#777">W</text>';
      } else if(n.includes('bath')){
        const fx=x+rw*.12,fy=y+rh*.12;
        z+=rect(fx,fy,Math.min(rw*.38,s*2.8),Math.min(rh*.24,s*1.6),2);
        z+='<ellipse cx="'+(x+rw*.72)+'" cy="'+(y+rh*.28)+'" rx="'+Math.min(rw*.11,s*.8)+'" ry="'+Math.min(rh*.09,s*.65)+'" fill="none" stroke="#555" stroke-width="1.5"/>';
        z+=line(x+rw*.62,y+rh*.42,x+rw*.82,y+rh*.42,1.2);
        z+=rect(x+rw*.12,y+rh*.62,Math.min(rw*.24,s*1.6),Math.min(rh*.18,s*1.1),4);
        z+='<circle cx="'+(x+rw*.24)+'" cy="'+(y+rh*.71)+'" r="2" fill="none" stroke="#555"/>';
      } else if(n.includes('kitchen')){
        const t=Math.max(5,Math.min(s*1.05,rw*.18,rh*.18));
        z+=rect(x+rw*.08,y+rh*.08,rw*.84,t,1)+rect(x+rw*.08,y+rh*.08,t,rh*.78,1);
        z+=rect(x+rw*.2,y+rh*.13,t*.72,t*.55,1);
        z+='<circle cx="'+(x+rw*.72)+'" cy="'+(y+rh*.14)+'" r="'+Math.max(2,t*.18)+'" fill="none" stroke="#555"/><circle cx="'+(x+rw*.82)+'" cy="'+(y+rh*.14)+'" r="'+Math.max(2,t*.18)+'" fill="none" stroke="#555"/>';
        z+=rect(cx-t*1.2,y+rh*.55,t*2.4,t*1.5,1);
      } else if(n.includes('lounge')||n.includes('drawing')||n.includes('living')){
        const sw=Math.min(rw*.62,s*7),sh=Math.min(rh*.18,s*1.7);
        z+=rect(cx-sw/2,y+rh*.16,sw,sh,5)+line(cx-sw/2+sw*.33,y+rh*.16,cx-sw/2+sw*.33,y+rh*.16+sh,1);
        z+=rect(x+rw*.1,cy-sh*.45,Math.min(rw*.16,s*1.7),sh*2.2,5)+rect(x+rw*.74,cy-sh*.45,Math.min(rw*.16,s*1.7),sh*2.2,5);
        z+=rect(cx-sw*.25,cy+rh*.15,sw*.5,sh*.8,2);
      } else if(n.includes('dining')){
        z+=rect(cx-rw*.22,cy-rh*.13,rw*.44,rh*.26,2);
        [[-.3,0],[.3,0],[0,-.32],[0,.32]].forEach(a=>z+=rect(cx+rw*a[0]-unit,cy+rh*a[1]-unit,unit*2,unit*2,2));
      } else if(n.includes('garage')||n.includes('porch')){
        const cw=Math.min(rw*.42,s*4.2),ch=Math.min(rh*.72,s*7.5),carX=cx-cw/2,carY=cy-ch/2;
        z+=rect(carX,carY,cw,ch,Math.min(cw*.22,8));
        z+=rect(carX+cw*.14,carY+ch*.16,cw*.72,ch*.24,4)+rect(carX+cw*.14,carY+ch*.59,cw*.72,ch*.2,4);
        z+=line(carX,carY+ch*.38,carX+cw,carY+ch*.38,1);
        z+=line(carX,carY+ch*.52,carX+cw,carY+ch*.52,1);
      } else if(n.includes('stair')){
        const steps=8,vertical=rw>rh;
        for(let k=0;k<=steps;k++){if(vertical)z+=line(x+rw*.15+k*rw*.7/steps,y+rh*.2,x+rw*.15+k*rw*.7/steps,y+rh*.8,1);else z+=line(x+rw*.2,y+rh*.15+k*rh*.7/steps,x+rw*.8,y+rh*.15+k*rh*.7/steps,1);}
        z+='<text x="'+cx+'" y="'+cy+'" font-size="9" fill="#555" text-anchor="middle">UP ↑</text>';
      } else if(n.includes('store')||n.includes('office')){
        z+=rect(x+rw*.12,y+rh*.12,rw*.28,Math.min(rh*.18,s*1.3),1)+rect(x+rw*.58,y+rh*.35,rw*.28,Math.min(rh*.18,s*1.3),1);
      }
      return z;
    }
    state.rooms.forEach((r,i)=>{
      const x=p+r.x*s,y=p+r.y*s,rw=r.w*s,rh=r.h*s,chosen=r.id===state.selected;
      out+='<g data-room="'+r.id+'" style="cursor:pointer">';
      out+='<rect x="'+x+'" y="'+y+'" width="'+rw+'" height="'+rh+'" fill="#fff" stroke="'+(chosen?'#087f5b':'#111827')+'" stroke-width="'+(chosen?4:3)+'"/>';
      out+=furniture(r,x,y,rw,rh);
      const dw=Math.min(r.doorWidth||3,(r.doorSide==='east'||r.doorSide==='west'?r.h:r.w)),ww=Math.min(r.windowWidth||4,(r.windowSide==='east'||r.windowSide==='west'?r.h:r.w)),doff=Math.max(0,Math.min(1,Number(r.doorOffset)||.5));
      let dsx=x,dsy=y,dex=x,dey=y;
      if(r.doorSide==='south'){dsx=x+(rw-dw*s)*doff;dsy=y+rh;dex=dsx+dw*s;dey=dsy;}
      if(r.doorSide==='north'){dsx=x+(rw-dw*s)*doff;dsy=y;dex=dsx+dw*s;dey=dsy;}
      if(r.doorSide==='east'){dsx=x+rw;dsy=y+(rh-dw*s)*doff;dex=dsx;dey=dsy+dw*s;}
      if(r.doorSide==='west'){dsx=x;dsy=y+(rh-dw*s)*doff;dex=dsx;dey=dsy+dw*s;}
      if(r.door){out+='<path d="M '+dsx+' '+dsy+' L '+dex+' '+dey+'" stroke="#fff" stroke-width="7"/>';
        const arc=dw*s,sign=(r.doorSide==='south'?-1:r.doorSide==='north'?1:r.doorSide==='east'?-1:1)*(r.doorSwing==='out'?-1:1);
        if(r.doorSide==='north'||r.doorSide==='south')out+='<path d="M '+dsx+' '+dsy+' L '+dsx+' '+(dsy+sign*arc)+' A '+arc+' '+arc+' 0 0 '+(sign>0?1:0)+' '+dex+' '+dey+'" fill="none" stroke="#555" stroke-width="1.3"/>';
        else out+='<path d="M '+dsx+' '+dsy+' L '+(dsx+sign*arc)+' '+dsy+' A '+arc+' '+arc+' 0 0 '+(sign>0?1:0)+' '+dex+' '+dey+'" fill="none" stroke="#555" stroke-width="1.3"/>';
      }
      if(r.window){let wx=x,wy=y,wx2=x,wy2=y;if(r.windowSide==='north'||r.windowSide==='south'){wy=r.windowSide==='north'?y:y+rh;wx=x+(rw-ww*s)/2;wx2=wx+ww*s;wy2=wy;}else{wx=r.windowSide==='west'?x:x+rw;wy=y+(rh-ww*s)/2;wy2=wy+ww*s;wx2=wx;}out+='<path d="M '+wx+' '+wy+' L '+wx2+' '+wy2+'" stroke="#fff" stroke-width="8"/><path d="M '+wx+' '+wy+' L '+wx2+' '+wy2+'" stroke="#111827" stroke-width="2"/><path d="M '+wx+' '+(wy-2)+' L '+wx2+' '+(wy2-2)+'" stroke="#777" stroke-width="1"/>';}
      out+='<text x="'+(x+rw/2)+'" y="'+(y+rh*.88)+'" text-anchor="middle" fill="#111827" font-size="'+Math.max(8,Math.min(12,s*.58))+'" font-weight="700" pointer-events="none">'+esc(r.name.toUpperCase())+'</text>';
      out+='<text x="'+(x+rw/2)+'" y="'+(y+rh*.88+12)+'" text-anchor="middle" fill="#444" font-size="9" pointer-events="none">'+r.w+"'-"+Math.round((r.w%1)*12)+'\" × '+r.h+"'-"+Math.round((r.h%1)*12)+'\"'+'</text>';
      out+='</g>';
    });
    out+='<text x="'+p+'" y="'+(p+h+28)+'" fill="#333" font-size="10">AL HADI BUILDWISE • ARCHITECTURAL CONCEPT PLAN • DIMENSIONS IN FEET</text>';
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
      '<div class="row"><div><label>Door on which wall?</label><select id="fpDoorSide"><option value="north" '+((r.doorSide||'south')==='north'?'selected':'')+'>North / top</option><option value="south" '+((r.doorSide||'south')==='south'?'selected':'')+'>South / bottom</option><option value="east" '+((r.doorSide||'south')==='east'?'selected':'')+'>East / right</option><option value="west" '+((r.doorSide||'south')==='west'?'selected':'')+'>West / left</option></select></div><div><label>Window on which wall?</label><select id="fpWindowSide"><option value="north" '+((r.windowSide||'north')==='north'?'selected':'')+'>North / top</option><option value="south" '+((r.windowSide||'north')==='south'?'selected':'')+'>South / bottom</option><option value="east" '+((r.windowSide||'north')==='east'?'selected':'')+'>East / right</option><option value="west" '+((r.windowSide||'north')==='west'?'selected':'')+'>West / left</option></select></div></div><div class="row"><div><label>Door swing</label><select id="fpDoorSwing"><option value="in" '+((r.doorSwing||'in')==='in'?'selected':'')+'>Opens inward</option><option value="out" '+(r.doorSwing==='out'?'selected':'')+'>Opens outward</option></select></div><div><label>Door position along wall (0–1)</label><input id="fpDoorOffset" type="number" min="0" max="1" step=".05" value="'+(r.doorOffset===undefined?0.5:r.doorOffset)+'"></div></div><h4>Room specification</h4><div class="row"><div><label>Ceiling height (ft)</label><input id="fpCeilingHeight" type="number" min="7" max="30" step=".5" value="'+(r.ceilingHeight||10)+'"></div><div><label>Floor finish</label><select id="fpFloorFinish">'+['Ceramic tile','Porcelain tile','Marble','Granite','Wood / laminate','Concrete','Other / TBD'].map(v=>'<option '+((r.floorFinish||'Ceramic tile')===v?'selected':'')+'>'+v+'</option>').join('')+'</select></div></div>'+
      '<div class="row"><div><label>Wall finish</label><select id="fpWallFinish">'+['Paint / plaster','Tile','Exposed brick','Wall panel','Other / TBD'].map(v=>'<option '+((r.wallFinish||'Paint / plaster')===v?'selected':'')+'>'+v+'</option>').join('')+'</select></div><div><label>Ceiling finish</label><select id="fpCeilingFinish">'+['Painted ceiling','Gypsum board','False ceiling','Exposed concrete','Other / TBD'].map(v=>'<option '+((r.ceilingFinish||'Painted ceiling')===v?'selected':'')+'>'+v+'</option>').join('')+'</select></div></div>'+
      '<div class="row"><div><label>Lighting points</label><input id="fpLightingPoints" type="number" min="0" max="50" value="'+(r.lightingPoints||0)+'"></div><div><label>Socket points</label><input id="fpSocketPoints" type="number" min="0" max="50" value="'+(r.socketPoints||0)+'"></div></div>'+
      '<div class="row"><div><label>Switch points</label><input id="fpSwitchPoints" type="number" min="0" max="50" value="'+(r.switchPoints||0)+'"></div><div><label>Ventilation</label><select id="fpVentilation">'+['Window / natural','Mechanical exhaust','Supply and exhaust','TBD / professional design'].map(v=>'<option '+((r.ventilation||'Window / natural')===v?'selected':'')+'>'+v+'</option>').join('')+'</select></div></div>'+
      '<div><label>Plumbing / sanitary provision</label><select id="fpPlumbing">'+['None','Wash basin','WC / toilet','Shower','Bath','Kitchen sink','Laundry connection','Multiple / TBD'].map(v=>'<option '+((r.plumbing||'None')===v?'selected':'')+'>'+v+'</option>').join('')+'</select></div>'+
      '<label>Room notes / special requirements</label><textarea id="fpRoomNotes" rows="2">'+esc(r.notes||'')+'</textarea>'+
      <button type="button" class="fp-danger" id="fpDelete">Delete selected room</button>';
    $('fpName').addEventListener('change',e=>update('name',e.target.value));
    [['fpRoomW','w'],['fpRoomH','h'],['fpX','x'],['fpY','y']].forEach(pair=>$(pair[0]).addEventListener('change',e=>update(pair[1],e.target.value)));
    $('fpDoor').addEventListener('change',e=>update('door',e.target.checked));
    $('fpWindow').addEventListener('change',e=>update('window',e.target.checked));
    $('fpDoorW').addEventListener('change',e=>update('doorWidth',e.target.value));
    $('fpDoorSide').addEventListener('change',e=>update('doorSide',e.target.value));
    $('fpWindowSide').addEventListener('change',e=>update('windowSide',e.target.value));
    $('fpDoorSwing').addEventListener('change',e=>update('doorSwing',e.target.value));
    $('fpDoorOffset').addEventListener('change',e=>{r.doorOffset=Math.max(0,Math.min(1,Number(e.target.value)||0));render();});
    ['fpCeilingHeight','fpLightingPoints','fpSocketPoints','fpSwitchPoints'].forEach((id)=>$(id).addEventListener('change',e=>update(({fpCeilingHeight:'ceilingHeight',fpLightingPoints:'lightingPoints',fpSocketPoints:'socketPoints',fpSwitchPoints:'switchPoints'})[id],e.target.value)));
    [['fpFloorFinish','floorFinish'],['fpWallFinish','wallFinish'],['fpCeilingFinish','ceilingFinish'],['fpVentilation','ventilation'],['fpPlumbing','plumbing'],['fpRoomNotes','notes']].forEach(pair=>$(pair[0]).addEventListener('change',e=>update(pair[1],e.target.value)));
    $('fpWindowW').addEventListener('change',e=>update('windowWidth',e.target.value));
    $('fpDelete').addEventListener('click',()=>{const removed=state.selected;state.rooms=state.rooms.filter(x=>x.id!==removed);state.selected=state.rooms[0]?state.rooms[0].id:null;if(state.entranceRoom===removed)state.entranceRoom=state.selected;render();});
  }
  function render() {
    $('fpSiteW').value=state.width; $('fpSiteH').value=state.height;
    if($('fpWallThickness')) $('fpWallThickness').value=state.wallThickness;
    draw(); roomList(); inspector();
    const entrySelect=$('fpEntryRoom'); if(entrySelect){entrySelect.innerHTML=state.rooms.map(r=>'<option value="'+r.id+'" '+(r.id===state.entranceRoom?'selected':'')+'>'+esc(r.name)+' #'+r.id+'</option>').join('');entrySelect.disabled=!state.rooms.length;}
    if($('fpEntranceSide'))$('fpEntranceSide').value=state.entranceSide;
    if($('fpRouteWidth'))$('fpRouteWidth').value=state.routeWidth;
    if($('fpShowRoute'))$('fpShowRoute').checked=state.showRoute;
    const collisions=[];
    state.rooms.forEach((a,i)=>state.rooms.slice(i+1).forEach(b=>{if(overlap(a,b))collisions.push(a.name+' and '+b.name);}));
    $('fpWarnings').innerHTML=collisions.length?'<div class="result warn"><b>Layout warning:</b> Overlapping rooms: '+collisions.map(esc).join(', ')+'. Move them apart.</div>':'<div class="result">No room overlaps detected by this basic 2D check.</div>';
    $('fpArea').textContent=(state.width*state.height).toFixed(1)+' sq ft site area';
    const schedule=$('fpSchedules');
    if(schedule){
      const total=state.rooms.reduce((n,r)=>n+r.w*r.h,0);
      const counts=state.rooms.reduce((a,r)=>{if(r.door)a.doors++;if(r.window)a.windows++;a.lights+=Number(r.lightingPoints)||0;a.sockets+=Number(r.socketPoints)||0;a.switches+=Number(r.switchPoints)||0;return a;},{doors:0,windows:0,lights:0,sockets:0,switches:0});
      schedule.innerHTML='<h4>Live room & building schedules</h4><div class="fp-table-wrap"><table class="fp-schedule"><thead><tr><th>Room</th><th>Size (ft)</th><th>Area (sq ft)</th><th>Ceiling</th><th>Floor</th><th>Wall finish</th><th>Door</th><th>Window</th><th>Lights</th><th>Sockets</th><th>Plumbing</th></tr></thead><tbody>'+state.rooms.map(r=>'<tr><td>'+esc(r.name)+'</td><td>'+r.w+' × '+r.h+'</td><td>'+(r.w*r.h).toFixed(1)+'</td><td>'+(r.ceilingHeight||10)+' ft</td><td>'+esc(r.floorFinish||'TBD')+'</td><td>'+esc(r.wallFinish||'TBD')+'</td><td>'+(r.door?(r.doorWidth||3)+' ft':'None')+'</td><td>'+(r.window?(r.windowWidth||4)+' ft':'None')+'</td><td>'+(r.lightingPoints||0)+'</td><td>'+(r.socketPoints||0)+'</td><td>'+esc(r.plumbing||'None')+'</td></tr>').join('')+'</tbody></table></div><div class="fp-stats"><span><b>'+total.toFixed(1)+'</b> sq ft allocated</span><span><b>'+counts.doors+'</b> doors</span><span><b>'+counts.windows+'</b> windows</span><span><b>'+counts.lights+'</b> lights</span><span><b>'+counts.sockets+'</b> sockets</span><span><b>'+counts.switches+'</b> switches</span></div><p class="fp-help">Schedules update from room properties. Electrical point counts are placeholders, not circuit/load design.</p>';
    }

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
    const data={app:'Al Hadi BuildWise',formatVersion:3,units:'feet',exportedAt:new Date().toISOString(),site:{width:state.width,height:state.height,wallThickness:state.wallThickness,entranceSide:state.entranceSide,entranceRoom:state.entranceRoom,routeWidth:state.routeWidth},rooms:state.rooms,documentation:{note:'Concept specifications only; verify with licensed professionals.'}};
    downloadFile('Al-Hadi-BuildWise-Project.json',JSON.stringify(data,null,2),'application/json;charset=utf-8');
  }
  function exportDxf() {
    // Wall segments follow each room's selected door/window wall and offset.
    // Coordinates are feet; room loops remain independent (not a joined BIM wall network).
    let d='0\nSECTION\n2\nHEADER\n9\n$INSUNITS\n70\n2\n0\nENDSEC\n0\nSECTION\n2\nTABLES\n0\nTABLE\n2\nLAYER\n70\n6\n';
    [['SITE',7],['WALLS',7],['OPENINGS',3],['DIMENSIONS',2],['LABELS',4],['PATH',3]].forEach(v=>{d+='0\nLAYER\n2\n'+v[0]+'\n70\n0\n62\n'+v[1]+'\n6\nCONTINUOUS\n';});
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
    function wallEdge(r,side,opening){
      const x=r.x,y=r.y,w=r.w,h=r.h,t=Math.min(state.wallThickness,Math.min(w,h)/2);
      let x1,y1,x2,y2,nx,ny,length;
      if(side==='north'){x1=x;y1=y;x2=x+w;y2=y;nx=0;ny=1;length=w;}
      else if(side==='south'){x1=x;y1=y+h;x2=x+w;y2=y+h;nx=0;ny=-1;length=w;}
      else if(side==='east'){x1=x+w;y1=y;x2=x+w;y2=y+h;nx=-1;ny=0;length=h;}
      else {x1=x;y1=y;x2=x;y2=y+h;nx=1;ny=0;length=h;}
      const width=opening?Math.min(Math.max(0,Number(opening.width)||0),length):0;
      const offset=opening?Math.max(0,Math.min(1,Number(opening.offset)))*Math.max(0,length-width):0;
      const a=offset,b=offset+width;
      function segment(from,to,shift){
        if(to-from<0.001)return;
        line(x1+(x2-x1)*from/length+nx*shift,y1+(y2-y1)*from/length+ny*shift,
             x1+(x2-x1)*to/length+nx*shift,y1+(y2-y1)*to/length+ny*shift,'WALLS');
      }
      segment(0,a,0);segment(b,length,0);
      segment(0,a,t);segment(b,length,t);
      if(opening&&width>0){
        const ax=x1+(x2-x1)*a/length,ay=y1+(y2-y1)*a/length;
        const bx=x1+(x2-x1)*b/length,by=y1+(y2-y1)*b/length;
        line(ax,ay,ax+nx*t,ay+ny*t,'OPENINGS');
        line(bx,by,bx+nx*t,by+ny*t,'OPENINGS');
        text((ax+bx)/2+nx*(t+0.25),(ay+by)/2+ny*(t+0.25),opening.label+' '+width.toFixed(2)+' ft',0.28,'OPENINGS');
      }
    }
    line(0,0,state.width,0,'SITE');line(state.width,0,state.width,state.height,'SITE');
    line(state.width,state.height,0,state.height,'SITE');line(0,state.height,0,0,'SITE');
    dimensionH(0,state.width,-1.4,state.width+' ft');dimensionV(0,state.height,state.width+1.4,state.height+' ft');
    state.rooms.forEach(r=>{
      const doorVertical=r.doorSide==='east'||r.doorSide==='west';
      const windowVertical=r.windowSide==='east'||r.windowSide==='west';
      const doorOpening=r.door?{width:Math.min(Number(r.doorWidth)||3,doorVertical?r.h:r.w),offset:Number.isFinite(Number(r.doorOffset))?Number(r.doorOffset):0.5,label:'DOOR'}:null;
      const windowOpening=r.window?{width:Math.min(Number(r.windowWidth)||4,windowVertical?r.h:r.w),offset:0.5,label:'WINDOW'}:null;
      ['north','south','east','west'].forEach(side=>{
        wallEdge(r,side,r.door&&r.doorSide===side?doorOpening:r.window&&r.windowSide===side?windowOpening:null);
      });
      text(r.x+r.w/2-1,r.y+r.h/2,r.name,0.45,'LABELS');
      dimensionH(r.x,r.x+r.w,r.y-0.75,r.w+' ft');
      dimensionV(r.y,r.y+r.h,r.x+r.w+0.75,r.h+' ft');
    });
    text(0,-2.4,'AL HADI BUILDWISE | FEET | WALL THICKNESS '+state.wallThickness+' ft',0.4,'LABELS');
    d+='0\nENDSEC\n0\nEOF\n';
    downloadFile('Al-Hadi-BuildWise-Wall-Plan.dxf',d,'application/dxf');
  }
  function exportPdf() {
    const svg=$('fpDrawing').cloneNode(true);svg.setAttribute('xmlns','http://www.w3.org/2000/svg');
    const svgText=new XMLSerializer().serializeToString(svg);
    const rows=state.rooms.map(r=>'<tr><td>'+esc(r.name)+'</td><td>'+r.w+' × '+r.h+' ft</td><td>'+r.x+', '+r.y+' ft</td><td>'+(r.w*r.h).toFixed(1)+' sq ft</td><td>'+(r.ceilingHeight||10)+' ft</td><td>'+esc(r.floorFinish||'TBD')+'</td><td>'+esc(r.wallFinish||'TBD')+'</td><td>'+(r.door?(r.doorWidth||3)+' ft / '+(r.doorSide||'south'):'None')+'</td><td>'+(r.window?(r.windowWidth||4)+' ft / '+(r.windowSide||'north'):'None')+'</td><td>'+esc(r.plumbing||'None')+'</td><td>'+(r.lightingPoints||0)+' / '+(r.socketPoints||0)+' / '+(r.switchPoints||0)+'</td></tr>').join('');
    const w=window.open('','_blank');
    if(!w){alert('Allow pop-ups for this site, then try PDF export again.');return;}
    w.document.write('<!doctype html><html><head><meta charset="utf-8"><title>Al Hadi BuildWise Floor Plan</title><style>body{font:14px Arial,sans-serif;color:#172334;margin:28px}h1{font-size:22px}svg{width:100%;max-height:650px}table{width:100%;border-collapse:collapse;margin-top:18px}td,th{border:1px solid #bbb;padding:7px;text-align:left}.note{font-size:11px;color:#555;margin-top:18px}@media print{button{display:none}}</style></head><body><h1>Al Hadi BuildWise — Floor Plan</h1><p>Site: '+state.width+' × '+state.height+' ft · Area: '+(state.width*state.height).toFixed(1)+' sq ft</p>'+svgText+'<h2>Room and finish schedule</h2><table><thead><tr><th>Room</th><th>Size</th><th>Position</th><th>Area</th><th>Ceiling</th><th>Floor finish</th><th>Wall finish</th><th>Door</th><th>Window</th><th>Plumbing</th><th>Light / Socket / Switch</th></tr></thead><tbody>'+rows+'</tbody></table><p class="note">Concept layout only. Not a construction-ready, code-approved or structural drawing. Have all plans reviewed by qualified local professionals.</p><button onclick="window.print()">Print / Save as PDF</button><script>window.onload=function(){setTimeout(function(){window.print()},400)};<\\/script></body></html>');
    w.document.close();
  }
  function init() {
    if(!$('fpDrawing'))return; load();
    $('fpAddRoom').addEventListener('click',()=>addRoom($('fpRoomType').value));
    $('fpAiGenerate').addEventListener('click',generateFromBrief);
    $('fpAiRealGenerate').addEventListener('click',generateWithGemini);
    $('fpGeminiKeySave').addEventListener('click',()=>{geminiKey=$('fpGeminiKey').value.trim();$('fpGeminiKeyStatus').textContent=geminiKey?'Key ready for this browser tab only.':'Enter a valid API key.';});
    $('fpGeminiKeyClear').addEventListener('click',()=>{geminiKey='';$('fpGeminiKey').value='';$('fpGeminiKeyStatus').textContent='API key cleared from this page.';});
    $('fpWallThickness').addEventListener('change',e=>update('wallThickness',e.target.value));
    if($('fpEntryRoom'))$('fpEntryRoom').addEventListener('change',e=>update('entranceRoom',e.target.value));
    if($('fpEntranceSide'))$('fpEntranceSide').addEventListener('change',e=>update('entranceSide',e.target.value));
    if($('fpRouteWidth'))$('fpRouteWidth').addEventListener('change',e=>update('routeWidth',e.target.value));
    if($('fpShowRoute'))$('fpShowRoute').addEventListener('change',e=>update('showRoute',e.target.checked));
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
      state.rooms=[];state.selected=null;state.entranceRoom=null;nextId=1;render();
    });
    render(); if(!state.rooms.length){addRoom('Lounge');addRoom('Bedroom');addRoom('Kitchen');addRoom('Bathroom');}
  }
  document.addEventListener('DOMContentLoaded',init);
})();