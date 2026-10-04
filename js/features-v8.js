// ShadowBorn v9 — extensões seguras sobre a base estável.
(()=>{
const INV_KEY='shadowborn_inventory_v9', ECO_KEY='shadowborn_economy_v9';
let inv=load(INV_KEY,{items:{}}), eco=load(ECO_KEY,{money:0,diamonds:0});
function load(k,d){try{return Object.assign(d,JSON.parse(localStorage.getItem(k)||'{}'))}catch{return d}}
function save(){localStorage.setItem(INV_KEY,JSON.stringify(inv));localStorage.setItem(ECO_KEY,JSON.stringify(eco));syncHeader();if(typeof scheduleProgressSync==='function')scheduleProgressSync()}
function home(){ if(typeof window.showTitle==='function')window.showTitle(); }
function show(id){if(typeof window.hideAllScreens==='function')window.hideAllScreens();else document.querySelectorAll('.screen').forEach(x=>x.classList.add('hidden'));document.getElementById(id)?.classList.remove('hidden')}
function safe(x){const d=document.createElement('div');d.textContent=x||'';return d.innerHTML}
function syncProfile(){
 let u=window.currentUser;try{u=u||JSON.parse(localStorage.getItem('jogoDeLuta_user')||'null')}catch{}
 const r=window.ShadowRPG?.getData?.()||{};
 const n=document.getElementById('v2-player-name'),lv=document.getElementById('v2-level');
 if(n)n.textContent=u?.nome||'Caçador'; if(lv)lv.textContent=r.level||u?.dadosJogo?.level||1;syncHeader();
}
function syncHeader(){const m=document.getElementById('v9-money'),d=document.getElementById('v9-diamonds');if(m)m.textContent=Number(typeof saveData!=='undefined'?saveData.coins:eco.money).toLocaleString('pt-BR');if(d)d.textContent=Number(window.ShadowEquipment?.getState()?.diamonds||0).toLocaleString('pt-BR')}

function itemName(id){return window.ShadowItems?.get(id)?.name||String(id||'item').replace(/_/g,' ').replace(/\b\w/g,x=>x.toUpperCase())}
function itemIcon(id){return window.ShadowItems?.get(id)?.icon||'./assets/icons/relic.svg'}
function addItem(id,qty=1){if(!id)return;inv.items[id]=(inv.items[id]||0)+qty;save()}
function rollDrops(type){(type?.drops||[]).forEach(d=>{if(Math.random()*100<Math.min(100,Number(d.chance||0)*(window.ShadowEvents?.multiplier("dropChance",type)||1))){let min=Number(d.min||1),max=Math.max(min,Number(d.max||min));addItem(d.itemId,Math.max(1,Math.floor((Math.floor(Math.random()*(max-min+1))+min)*(window.ShadowEvents?.multiplier("dropQuantity",type)||1))))}});renderInventory()}
function renderInventory(){let el=document.getElementById('v9-inventory');if(!el)return;let arr=Object.entries(inv.items).filter(x=>x[1]>0);document.getElementById('v9-inv-count').textContent=arr.reduce((a,x)=>a+x[1],0)+' itens';el.innerHTML=arr.length?arr.map(([id,q])=>`<article class="v9-item v10-rarity-${safe(window.ShadowItems?.get(id)?.rarity||'common')}"><img src="${safe(itemIcon(id))}" alt=""><b>${safe(itemName(id))}</b><small>x${q}</small></article>`).join(''):'<div class="v9-empty">Seu inventário está vazio.<br><small>Derrote NPCs e Bosses que possuam drops configurados pelo Admin.</small></div>'}
function cardNpc(n,boss){let src=window.getNpcSpriteSrc?.(n)||n.imageUrl||'';return `<article class="v8-card v10-npc-card"><span class="v10-npc-thumb">${src?`<img src="${safe(src)}" alt="">`:(boss?'♛':'👤')}</span><div><b>${safe(n.name||n.nome)}</b><p>${boss?'Boss':'NPC'} · HP ${Number(n.health||0)} · Dano ${Number(n.damage||0)}</p><small>${(n.drops||[]).length} drop(s) configurado(s)</small></div></article>`}
async function refreshContent(){try{await window.refreshAdminContentFromServer?.()}catch{}}
async function renderNpcs(){await refreshContent();let all=(window.getAllNpcTypes?.()||[]).filter(x=>!x.isBoss);document.getElementById('v8-npcs').innerHTML=all.length?all.map(x=>cardNpc(x,false)).join(''):'<p>Nenhum NPC encontrado.</p>'}
async function renderBosses(){await refreshContent();let all=(window.getAllNpcTypes?.()||[]).filter(x=>x.isBoss);document.getElementById('v8-bosses').innerHTML=all.length?all.map(x=>cardNpc(x,true)).join(''):'<p>Nenhum Boss encontrado.</p>'}
function renderSkills(){document.getElementById('v8-skills').innerHTML=[['✦','Corte Sombrio','Aumenta o poder dos ataques.'],['♥','Sangue do Abismo','Fortalece a vida do caçador.'],['➤','Passo Fantasma','Melhora mobilidade e esquiva.'],['☠','Ceifador','Especialização contra bosses.']].map(x=>`<article class="v8-card"><span>${x[0]}</span><div><b>${x[1]}</b><p>${x[2]}</p></div></article>`).join('')}
let cache=null,mode='level';
async function loadRank(force=false){const el=document.getElementById('v8-ranking');el.innerHTML='<p>Carregando ranking...</p>';try{if(!cache||force){const r=await window.apiCall('ranking',{});if(!r?.sucesso)throw Error(r?.mensagem||'Falha');cache=r.dados||{}}renderRank(mode)}catch(e){el.innerHTML='<p class="v8-error">Ranking indisponível: '+safe(e.message)+'</p>'}}
function renderRank(m){mode=m;document.querySelectorAll('[data-v8rank]').forEach(b=>b.classList.toggle('active',b.dataset.v8rank===m));const rows=cache?.[m]||[],key=m==='level'?'level':m==='coins'?'moedas':'diamonds',icon=m==='level'?'🏆':m==='coins'?'🪙':'💎';document.getElementById('v8-ranking').innerHTML=rows.length?rows.slice(0,100).map((j,i)=>`<div class="v8-rank-row"><strong>${'#'+(i+1)}</strong><span class="v14-rank-player">${window.ShadowV14?.rankMarkup(j.level)||''}<span>${safe(j.nome)}</span></span><small>Nv. ${Number(j.level)||1}${m==='level'?' · '+Number(j.xp||0)+' XP':''}</small><b>${icon} ${Number(j[key]||0).toLocaleString('pt-BR')}</b></div>`).join(''):'<p>Nenhum jogador encontrado.</p>'}

async function renderAdminItems(){
 await window.ShadowItems?.refresh?.(); const el=document.getElementById('admin-items-list'); if(!el)return;
 const rows=window.ShadowItems?.all?.()||[];
 el.innerHTML=rows.map(i=>`<article class="v10-admin-item v10-rarity-${safe(i.rarity)}"><img src="${safe(i.icon)}" alt=""><div><b>${safe(i.name)}</b><small>${safe(i.id)} · ${safe(i.type)} · ${safe(i.rarity)}</small></div></article>`).join('');
}
async function saveAdminItem(){
 const id=(document.getElementById('admin-item-id')?.value||'').trim().toLowerCase().replace(/[^a-z0-9_]+/g,'_');
 const name=(document.getElementById('admin-item-name')?.value||'').trim(); if(!id||!name){alert('Preencha ID e nome do item.');return}
 const config={type:document.getElementById('admin-item-type').value,rarity:document.getElementById('admin-item-rarity').value,icon:(document.getElementById('admin-item-icon').value||'').trim()||'./assets/icons/relic.svg',description:(document.getElementById('admin-item-desc').value||'').trim()};
 const u=(typeof currentUser!=='undefined'?currentUser:null); if(!u?.id){alert('Entre como admin.');return}
 const r=await apiCall('salvarItem',{adminID:u.id,id,nome:name,config}); if(!r?.sucesso){alert(r?.mensagem||'Erro ao salvar item');return} await window.ShadowItems.refresh(); renderAdminItems(); alert('Item salvo no catálogo!');
}
window.renderAdminItems=renderAdminItems;
function hookEnemyDrops(){if(window.Enemy?.prototype)return; /* classe pode não estar global; sprites chama hook abaixo */ }
window.ShadowV9={setInventory:x=>{inv=x||{items:{}};localStorage.setItem(INV_KEY,JSON.stringify(inv));renderInventory()},addItem,rollDrops,getInventory:()=>inv,getEconomy:()=>eco};
document.addEventListener('DOMContentLoaded',()=>{
 const bind=(id,screen,render)=>document.getElementById(id)?.addEventListener('click',async()=>{show(screen);await render?.()});
 bind('skills-btn-menu','skills-screen',renderSkills);bind('npcs-btn-menu','npcs-screen',renderNpcs);bind('bosses-btn-menu','bosses-screen',renderBosses);bind('ranking-btn-menu','ranking-screen',async()=>{await window.flushProgressSync?.();return loadRank(true)});bind('system-btn-menu','system-screen');
 bind('inventory-btn-menu','inventory-screen',renderInventory);
 document.getElementById('inventory-back-btn')?.addEventListener('click',home);
 document.querySelectorAll('.v8-back').forEach(b=>b.addEventListener('click',home));
 document.getElementById('v13-rank-refresh')?.addEventListener('click',async()=>{await window.flushProgressSync?.();loadRank(true)});
 setInterval(()=>{if(!document.getElementById('ranking-screen')?.classList.contains('hidden'))loadRank(true)},30000);
 document.querySelectorAll('[data-v8rank]').forEach(b=>b.addEventListener('click',()=>renderRank(b.dataset.v8rank)));
 document.getElementById('v8-fullscreen')?.addEventListener('click',()=>document.getElementById('v2-fullscreen-btn')?.click());
 document.getElementById('v8-reload')?.addEventListener('click',()=>location.reload());
 document.getElementById('v9-game-fullscreen')?.addEventListener('click',()=>document.getElementById('v2-fullscreen-btn')?.click());
 document.getElementById('admin-save-item')?.addEventListener('click',saveAdminItem);
 const url=document.getElementById('admin-npc-image-url'), preview=document.getElementById('admin-npc-image-preview'), status=document.getElementById('admin-npc-image-status');
 const previewUrl=()=>{const v=(url?.value||'').trim();if(!preview)return;if(!v){preview.removeAttribute('src');if(status)status.textContent='Nenhuma imagem por URL';return}preview.src=v;if(status)status.textContent='Carregando preview...'};

 document.getElementById('admin-npc-image-file')?.addEventListener('change',async e=>{
   const file=e.target.files?.[0]; if(!file)return;
   if(file.size>8*1024*1024){alert('Escolha uma imagem de até 8 MB.');e.target.value='';return}
   const objectUrl=URL.createObjectURL(file), img=new Image();
   try {
     await new Promise((resolve,reject)=>{img.onload=resolve;img.onerror=reject;img.src=objectUrl});
     let encoded='';
     for(const size of [256,192,128,96,64]){
       const canvas=document.createElement('canvas'), ratio=Math.min(1,size/Math.max(img.width,img.height));
       canvas.width=Math.max(1,Math.round(img.width*ratio));canvas.height=Math.max(1,Math.round(img.height*ratio));
       const c=canvas.getContext('2d');c.imageSmoothingEnabled=false;c.drawImage(img,0,0,canvas.width,canvas.height);encoded=canvas.toDataURL('image/png');
       if(encoded.length<40000)break;
     }
     if(encoded.length>=40000)throw Error('Imagem muito detalhada para salvar. Use um link direto.');
     url.value=encoded;previewUrl();
   }catch(err){alert(err.message||'Não foi possível abrir a imagem.');e.target.value=''}
   finally{URL.revokeObjectURL(objectUrl)}
 });
 url?.addEventListener('input',previewUrl); preview?.addEventListener('load',()=>{if(status)status.textContent='✓ Imagem carregada'}); preview?.addEventListener('error',()=>{if(status)status.textContent='⚠ Não foi possível carregar este link'});
 window.ShadowItems?.refresh?.().then(()=>{renderInventory()});
 setInterval(syncProfile,1000);syncProfile();
});
})();