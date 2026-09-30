'use strict';
const NODE_W=150,NODE_H=152,GAP_X=30,GAP_Y=88,PAD=16;
function computeLayout(data) {
    const people = data.people;
    const ids = new Set(people.map(p => p.id));
    const partnersOf = new Map();
    const addPartner = (a,b) => {
        const list = partnersOf.get(a) || [];
        list.push(b);
        partnersOf.set(a, list);
    };
    for (const [a, b] of data.partners) {
        if (!ids.has(a) || !ids.has(b) || a === b) continue;
        addPartner(a, b);
        addPartner(b, a);
    }
    const edges = data.edges.filter(e => ids.has(e.p) && ids.has(e.c) && e.p !== e.c);
    const gen = new Map(people.map(p => [p.id, 0]));
    for (let i = 0; i < people.length + 2; i++) {
        for (const [a, b] of data.partners) {
            if (!ids.has(a) || !ids.has(b)) continue;
            const g = Math.max(gen.get(a), gen.get(b));
            gen.set(a, g);
            gen.set(b, g);
        }
        for (const e of edges) gen.set(e.c, Math.max(gen.get(e.c), gen.get(e.p) + 1));
    }
    const units = [];
    const personUnit = new Map();
    const seen = new Set();
    for (const p of people) {
        if (seen.has(p.id)) continue;
        const members = [p.id];
        seen.add(p.id);
        const q = (partnersOf.get(p.id) || []).find(x => !seen.has(x));
        if (q) {
            members.push(q);
            seen.add(q);
        }
        for (const m of members) personUnit.set(m, units.length);
        units.push({ members, children: [] });
    }
    const unitClaimed = new Set();
    for (const e of edges) {
        const u = personUnit.get(e.p);
        const v = personUnit.get(e.c);
        if (u === v || unitClaimed.has(v)) continue;
        unitClaimed.add(v);
        units[u].children.push(e.c);
    }
    const widthMemo = new Map();
    const visiting = new Set();
    const widthOf = (u) => {
        const memo = widthMemo.get(u);
        if (memo !== undefined) return memo;
        if (visiting.has(u)) return units[u].members.length;
        visiting.add(u);
        const childWidth = units[u].children.reduce((s, c) => s + widthOf(personUnit.get(c)), 0);
        visiting.delete(u);
        const w = Math.max(units[u].members.length, childWidth);
        widthMemo.set(u, w);
        return w;
    };
    const slotPos = new Map();
    const placed = new Set();
    const place = (u,left) => {
        if (placed.has(u)) return;
        placed.add(u);
        const unit = units[u];
        const w = widthOf(u);
        const childTotal = unit.children.reduce((s, c) => s + widthOf(personUnit.get(c)), 0);
        const memberStart = left + (w - unit.members.length) / 2;
        unit.members.forEach((m, i) => slotPos.set(m, { x: memberStart + i, y: gen.get(m) }));
        let childLeft = left + (w - childTotal) / 2;
        for (const c of unit.children) {
            const v = personUnit.get(c);
            const cw = widthOf(v);
            place(v, childLeft);
            childLeft += cw;
        }
    };
    let rootLeft = 0;
    // Lay out ancestors first, even if they were added after their children.
    // Otherwise a child is placed as a root and cannot move under a new parent.
    const childUnits = new Set(edges.map(e => personUnit.get(e.c)).filter((u, i) => u !== personUnit.get(edges[i].p)));
    const placeRoot = (u) => {
        if (placed.has(u)) return;
        place(u, rootLeft);
        rootLeft += widthOf(u) + 1;
    };
    units.forEach((_, u) => { if (!childUnits.has(u)) placeRoot(u); });
    // Keep malformed/cyclic imports visible rather than dropping their nodes.
    units.forEach((_, u) => placeRoot(u));
    const px = (sx) => PAD + sx * (NODE_W + GAP_X);
    const py = (gy) => PAD + gy * (NODE_H + GAP_Y);
    const pos = new Map();
    let right = PAD * 2 + NODE_W;
    let bottom = PAD * 2 + NODE_H;
    for (const [id, s] of slotPos) {
        const x = px(s.x);
        const y = py(s.y);
        pos.set(id, { x, y });
        right = Math.max(right, x + NODE_W + PAD);
        bottom = Math.max(bottom, y + NODE_H + PAD);
    }
    const center = (id) => {
        const p = pos.get(id);
        return { cx: p.x + NODE_W / 2, cy: p.y + 48, top: p.y, bottom: p.y + 96 };
    };
    const partnerLines = [];
    const drawnPairs = new Set();
    for (const [a, b] of data.partners) {
        if (!pos.has(a) || !pos.has(b)) continue;
        const key = [a, b].sort().join('|');
        if (drawnPairs.has(key)) continue;
        drawnPairs.add(key);
        const ca = center(a);
        const cb = center(b);
        partnerLines.push({ x1: ca.cx, y1: ca.cy, x2: cb.cx, y2: cb.cy });
    }
    const childPaths = [];
    units.forEach((unit, u) => {
        // Layout chooses one ancestor group to position a child. Drawing must
        // still include every recorded parent, including unpartnered parents.
        const children = [...new Set(edges.filter(e => personUnit.get(e.p) === u && personUnit.get(e.c) !== u).map(e => e.c))];
        if (children.length === 0) return;
        const bottoms = unit.members.map(m => center(m).bottom);
        const cxs = unit.members.map(m => center(m).cx);
        const fromY = unit.members.length > 1 ? Math.max(...bottoms) - 48 : Math.max(...bottoms);
        const fromX = cxs.reduce((s, x) => s + x, 0) / cxs.length;
        const midY = Math.max(...bottoms) + 62;
        for (const c of children) {
            const cc = center(c);
            childPaths.push(`M ${fromX} ${fromY} V ${midY} H ${cc.cx} V ${cc.top}`);
        }
    });
    return { pos, partnerLines, childPaths, width: right, height: bottom };
}

const config=window.FAMILYTREE_CONFIG||{};
const $=id=>document.getElementById(id);
let doc={people:[],partners:[],edges:[],rev:0},selectedId=null,treeId=new URLSearchParams(location.search).get('tree'),accessToken=new URLSearchParams(location.hash.slice(1)).get('edit'),serverVersion=0,kind='partner',timer=null,dirty=false,uploading=false,conflict=false,saving=false;
const LOCAL_KEY='family-tree.local.v1';
let seq=0;
const newId=()=>`p${Date.now().toString(36)}-${++seq}-${Math.random().toString(36).slice(2,7)}`;
const selected=()=>doc.people.find(p=>p.id===selectedId);
function status(text,error=false){$('status').textContent=text;$('status').className=error?'error':'';}
function years(p){return p.birth&&p.death?`${p.birth} - ${p.death}`:p.birth?`b. ${p.birth}`:p.death?`d. ${p.death}`:'';}
function initials(name){return name.trim().split(/\s+/).slice(0,2).map(s=>s[0]||'').join('').toUpperCase()||'?';}
async function rpc(name,params){if(!/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(config.supabaseUrl)||!config.publishableKey?.startsWith('sb_publishable_'))throw Error('Supabase is not configured yet. Follow README.md.');if(new Blob([JSON.stringify(params)]).size>4900000)throw Error('Tree exceeds the 5 MB limit. Export a backup before removing photos.');const res=await fetch(config.supabaseUrl+'/rest/v1/rpc/familytree_'+name,{method:'POST',headers:{apikey:config.publishableKey,'Content-Type':'application/json'},body:JSON.stringify(params)});const result=await res.json();if(!res.ok){const e=Error(result.message||'Shared tree request failed');e.code=result.code;throw e;}return result;}
function valid(d){return d&&Array.isArray(d.people)&&d.people.length<5000&&d.people.every(p=>p&&typeof p.id==='string'&&typeof p.name==='string')&&Array.isArray(d.partners)&&d.partners.every(p=>Array.isArray(p)&&p.length===2&&p.every(x=>typeof x==='string'))&&Array.isArray(d.edges)&&d.edges.every(e=>e&&typeof e.p==='string'&&typeof e.c==='string');}
function sharedUrl(){const u=new URL(location.href);u.search='';u.hash='';u.searchParams.set('tree',treeId);u.hash='edit='+accessToken;return u.href;}
function showShare(){if(treeId){$('share').textContent='Copy share link';$('sharebox').hidden=false;$('shareurl').value=sharedUrl();}}
async function push(){if(!treeId||!dirty||saving||conflict)return;saving=true;const snapshot=JSON.parse(JSON.stringify(doc));try{const result=await rpc('save',{p_id:treeId,p_token:accessToken,p_version:serverVersion,p_payload:snapshot});serverVersion=result.version;if(doc.rev===snapshot.rev)dirty=false;status('Shared tree saved.');}catch(e){if(e.code==='40001')conflict=true;status(e.message+' Export a backup before reloading.',true);}finally{saving=false;if(dirty&&!conflict)status('Unsaved edits. Use Retry save or export a backup.',true);}}
async function pull(){if(!treeId||saving)return;if(dirty){await push();return;}try{if(!accessToken)throw Error('This link is missing its edit token. Ask for the complete link.');const result=await rpc('get',{p_id:treeId,p_token:accessToken});if(!valid(result.payload))throw Error('Invalid family tree');doc=result.payload;serverVersion=result.version;conflict=false;render();showShare();status('Shared tree loaded. Everyone with the complete link can edit.');}catch(e){status(e.message,true);}}
function update(next){doc={...next,rev:doc.rev+1};dirty=true;render();if(!treeId){try{localStorage.setItem(LOCAL_KEY,JSON.stringify(doc));dirty=false;}catch{status('This browser could not save the tree. Export a backup.',true);}}if(treeId){clearTimeout(timer);timer=setTimeout(push,700);status('Saving shared changes…');}else status(dirty?'Local save failed. Export a backup before leaving.':'Saved on this browser only. Export a backup or create a share link.');}
function avatar(p){const el=document.createElement('span');el.className='avatar';el.textContent=initials(p.name);if(p.photoData&&/^data:image\/(jpeg|png|webp);base64,/.test(p.photoData))putImage(el,p.photoData,p.name);return el;}
function putImage(el,src,name){const img=document.createElement('img');img.src=src;img.alt=`Portrait of ${name}`;img.onload=()=>{el.textContent='';el.append(img);};}
function render(){const empty=doc.people.length===0;$('empty').hidden=!empty;$('scroll').hidden=empty;const canvas=$('canvas');canvas.replaceChildren();if(!empty){const l=computeLayout(doc);canvas.style.width=l.width+'px';canvas.style.height=l.height+'px';const ns='http://www.w3.org/2000/svg';const svg=document.createElementNS(ns,'svg');svg.setAttribute('class','links');svg.setAttribute('width',l.width);svg.setAttribute('height',l.height);svg.setAttribute('aria-hidden','true');for(const line of l.partnerLines){const el=document.createElementNS(ns,'line');for(const k of ['x1','y1','x2','y2'])el.setAttribute(k,line[k]);el.setAttribute('class','partner-line');svg.append(el);}for(const d of l.childPaths){const el=document.createElementNS(ns,'path');el.setAttribute('d',d);el.setAttribute('class','child-line');svg.append(el);}canvas.append(svg);for(const p of doc.people){const at=l.pos.get(p.id);if(!at)continue;const node=document.createElement('button');node.className='node'+(selectedId===p.id?' selected':'');node.style.left=at.x+'px';node.style.top=at.y+'px';node.dataset.personId=p.id;node.title=`Edit ${p.name}`;node.setAttribute('aria-label',`Edit ${p.name}`);node.append(avatar(p));const name=document.createElement('span');name.className='node-name';name.textContent=p.name;node.append(name);if(years(p)){const y=document.createElement('span');y.className='node-years';y.textContent=years(p);node.append(y);}node.onclick=()=>openPerson(p.id);canvas.append(node);}}if(!selected())$('panel').hidden=true;}
function openPerson(id){selectedId=id;render();const p=selected();if(!p)return;$('panel').hidden=false;$('paneltitle').textContent=p.name;for(const k of ['name','birth','death','note'])$(k).value=p[k]||'';$('portrait').replaceChildren(avatar(p));$('removephoto').hidden=!p.photo&&!p.photoData;$('recropphoto').hidden=!p.photoData;$('confirm').hidden=true;$('relative').hidden=true;$('panel').scrollIntoView({behavior:'smooth',block:'nearest'});requestAnimationFrame(()=>{const node=[...$('canvas').querySelectorAll('.node')].find(n=>n.dataset.personId===id);if(node){const x=parseFloat(node.style.left),view=$('scroll');view.scrollLeft=Math.max(0,x+NODE_W/2-view.clientWidth/2);}});}
$('add').onclick=()=>{const id=newId();update({...doc,people:[...doc.people,{id,name:'New relative'}]});openPerson(id);};
$('close').onclick=()=>{selectedId=null;render();$('panel').hidden=true;};
$('edit').onsubmit=e=>{e.preventDefault();const p=selected();if(!p)return;update({...doc,people:doc.people.map(x=>x.id===p.id?{...x,name:$('name').value.trim()||p.name,birth:$('birth').value.trim(),death:$('death').value.trim(),note:$('note').value.trim()}:x)});$('paneltitle').textContent=selected().name;};
$('share').onclick=async()=>{if(treeId){try{await navigator.clipboard.writeText(sharedUrl());status('Share link copied.');}catch{$('shareurl').focus();$('shareurl').select();status('Copy the selected share link.');}return;}$('share').disabled=true;try{const id=crypto.randomUUID(),token=crypto.randomUUID(),snapshot=JSON.parse(JSON.stringify(doc));const result=await rpc('create',{p_id:id,p_token:token,p_payload:snapshot});treeId=id;accessToken=token;serverVersion=result.version;dirty=false;history.replaceState(null,'',sharedUrl());showShare();status('Share link ready. Anyone with the complete link can edit.');}catch(e){status(e.message,true);}finally{$('share').disabled=false;}};
$('retry').onclick=()=>{if(conflict){status('Another person saved changes. Export your edits, then reload.',true);return;}void push();};
// Keep the original upload in memory only while choosing its crop.
let cropState=null, cropDrag=null;
const cropDialog=$('cropdialog'), cropCanvas=$('croppreview');
function cropSide(){return Math.min(cropState.img.naturalWidth,cropState.img.naturalHeight)/Number($('cropzoom').value);}
function cropPosition(){const s=cropSide(),img=cropState.img;return {s,x:(img.naturalWidth-s)*(1-Number($('cropx').value)/100)/2,y:(img.naturalHeight-s)*(1-Number($('cropy').value)/100)/2};}
function drawCrop(){if(!cropState)return;const {s,x,y}=cropPosition(),ctx=cropCanvas.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,600,600);ctx.drawImage(cropState.img,x,y,s,s,0,0,600,600);ctx.save();ctx.fillStyle='rgba(0,0,0,.38)';ctx.beginPath();ctx.rect(0,0,600,600);ctx.arc(300,300,298,0,Math.PI*2,true);ctx.fill('evenodd');ctx.strokeStyle='white';ctx.lineWidth=3;ctx.beginPath();ctx.arc(300,300,298,0,Math.PI*2);ctx.stroke();ctx.restore();$('cropzoomvalue').textContent=Number($('cropzoom').value).toFixed(1)+'×';}
function resetCrop(){$('cropzoom').value='1';$('cropx').value=$('cropy').value='0';drawCrop();}
function finishCrop(){if(cropState?.url)URL.revokeObjectURL(cropState.url);cropState=null;cropDrag=null;uploading=false;$('photo').disabled=false;$('photo').value='';if(cropDialog.open)cropDialog.close();}
async function openCrop(src,id,url=null){uploading=true;$('photo').disabled=true;try{const img=new Image();img.src=src;await img.decode();if(!doc.people.some(p=>p.id===id))throw Error('This person is no longer in the tree.');cropState={img,id,url};resetCrop();cropDialog.showModal();$('cropzoom').focus();}catch(e){if(url)URL.revokeObjectURL(url);finishCrop();status('Could not open photo: '+e.message,true);}}
for(const id of ['cropzoom','cropx','cropy'])$(id).oninput=drawCrop;
$('cropreset').onclick=resetCrop;
$('cropcancel').onclick=finishCrop;
cropDialog.addEventListener('cancel',e=>{e.preventDefault();finishCrop();});
cropDialog.addEventListener('close',()=>{if(cropState)finishCrop();});
cropCanvas.onpointerdown=e=>{if(!cropState)return;e.preventDefault();cropCanvas.setPointerCapture(e.pointerId);const pos=cropPosition();cropDrag={px:e.clientX,py:e.clientY,x:pos.x,y:pos.y,s:pos.s};};
cropCanvas.onpointermove=e=>{if(!cropDrag||!cropState)return;const {img}=cropState,b=cropCanvas.getBoundingClientRect();const x=cropDrag.x-(e.clientX-cropDrag.px)*cropDrag.s/b.width,y=cropDrag.y-(e.clientY-cropDrag.py)*cropDrag.s/b.height;const dx=img.naturalWidth-cropSide(),dy=img.naturalHeight-cropSide();$('cropx').value=dx?Math.max(-100,Math.min(100,100-200*x/dx)):0;$('cropy').value=dy?Math.max(-100,Math.min(100,100-200*y/dy)):0;drawCrop();};
for(const event of ['pointerup','pointercancel','lostpointercapture'])cropCanvas.addEventListener(event,()=>{cropDrag=null;});
$('cropapply').onclick=()=>{if(!cropState)return;try{const {id,img}=cropState,{s,x,y}=cropPosition(),canvas=document.createElement('canvas');canvas.width=canvas.height=240;const ctx=canvas.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,240,240);ctx.drawImage(img,x,y,s,s,0,0,240,240);let image;for(const q of [.82,.65,.48,.3]){const result=canvas.toDataURL('image/jpeg',q);if(result.length<70000){image=result;break;}}if(!image)throw Error('This image could not be compressed enough. Try a simpler photo.');if(!doc.people.some(p=>p.id===id))throw Error('This person is no longer in the tree.');update({...doc,people:doc.people.map(p=>{if(p.id!==id)return p;const next={...p,photoData:image};delete next.photo;return next;})});if(selectedId===id){$('portrait').replaceChildren(avatar(selected()));$('removephoto').hidden=false;$('recropphoto').hidden=false;}finishCrop();}catch(e){status(e.message,true);}};
$('photo').onchange=()=>{const p=selected(),file=$('photo').files[0];if(!p||!file)return;if(!/^image\/(jpeg|png|webp|gif)$/.test(file.type)||file.size>15*1024*1024){status(file.size>15*1024*1024?'Choose a photo smaller than 15 MB.':'Choose a JPG, PNG, WebP or GIF photo.',true);$('photo').value='';return;}const url=URL.createObjectURL(file);void openCrop(url,p.id,url);};
$('recropphoto').onclick=()=>{const p=selected();if(p?.photoData)void openCrop(p.photoData,p.id);};
$('removephoto').onclick=()=>{const p=selected();if(!p)return;update({...doc,people:doc.people.map(x=>{if(x.id!==p.id)return x;const next={...x};delete next.photo;delete next.photoData;return next;})});$('portrait').replaceChildren(avatar(selected()));$('removephoto').hidden=true;$('recropphoto').hidden=true;};
document.querySelectorAll('[data-kind]').forEach(b=>b.onclick=()=>{kind=b.dataset.kind;$('relative').hidden=false;$('reltitle').textContent=`Add a ${kind}`;$('relname').value='';const p=selected();const partners=doc.partners.filter(([a,b])=>a===p.id||b===p.id).map(([a,b])=>a===p.id?b:a);$('coparentbox').hidden=kind!=='child'||!partners.length;$('coparent').replaceChildren(new Option('No other parent',''),...partners.map(id=>new Option(doc.people.find(x=>x.id===id)?.name||'Partner',id)));$('partnerbox').hidden=kind!=='parent'||doc.edges.filter(e=>e.c===p.id).length!==1;$('linkpartner').checked=true;$('relname').focus();});
$('cancelrelative').onclick=()=>{$('relative').hidden=true;};
$('relative').onsubmit=e=>{e.preventDefault();const p=selected();if(!p)return;const name=$('relname').value.trim();if(!name)return;const id=newId();const next={...doc,people:[...doc.people,{id,name}],partners:[...doc.partners],edges:[...doc.edges]};if(kind==='partner')next.partners.push([p.id,id]);if(kind==='child'){next.edges.push({p:p.id,c:id});if($('coparent').value)next.edges.push({p:$('coparent').value,c:id});}if(kind==='parent'){const other=doc.edges.filter(e=>e.c===p.id);next.edges.push({p:id,c:p.id});if(other.length===1&&$('linkpartner').checked)next.partners.push([other[0].p,id]);}update(next);openPerson(id);};
$('remove').onclick=()=>{$('confirm').hidden=false;};$('keep').onclick=()=>{$('confirm').hidden=true;};$('confirmremove').onclick=()=>{const id=selectedId;selectedId=null;update({...doc,people:doc.people.filter(p=>p.id!==id),partners:doc.partners.filter(pair=>!pair.includes(id)),edges:doc.edges.filter(e=>e.p!==id&&e.c!==id)});};
$('export').onclick=()=>{const url=URL.createObjectURL(new Blob([JSON.stringify(doc,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='family-tree-backup.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),3000);status('Backup exported, including uploaded portraits.');};
$('import').onclick=()=>{if(doc.people.length||treeId){status('Open the app without a tree link to import a backup into an empty tree. Your current tree has not changed.',true);return;}$('backup').click();};
$('backup').onchange=async()=>{const f=$('backup').files[0];if(!f)return;try{if(f.size>5*1024*1024)throw Error('Backup exceeds 5 MB.');const b=JSON.parse(await f.text());if(!valid(b))throw Error('Choose a valid family-tree backup.');for(const p of b.people){if(p.photoData&&!/^data:image\/(jpeg|png|webp);base64,/.test(p.photoData))throw Error('Invalid portrait in backup.');}selectedId=null;update(b);}catch(e){status(e.message,true);}finally{$('backup').value='';}};
window.addEventListener('focus',()=>{if(!uploading)pull();});document.addEventListener('visibilitychange',()=>{if(!document.hidden&&!uploading)pull();});window.addEventListener('beforeunload',e=>{if(dirty||uploading){e.preventDefault();e.returnValue='';}});
if(!treeId){try{const saved=JSON.parse(localStorage.getItem(LOCAL_KEY));if(valid(saved))doc=saved;}catch{}}
render();if(treeId){showShare();status('Loading shared tree…');pull();}else status(doc.people.length?'Local tree loaded from this browser. Export backups regularly.':'Start a tree. It is saved on this browser; export backups regularly.');

