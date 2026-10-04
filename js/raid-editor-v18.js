// Editor integrado de mapas de raid. Reutiliza o editor original de NPCs/Bosses.
(()=>{
'use strict';
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let dock=null,active=null;
function restore(){if(!dock)return;dock.marker.replaceWith(dock.node);dock.node.classList.add('hidden');dock=null;}
function mount(parent,msg){
 restore();
 const section=document.createElement('section');section.className='v18-raid-editor';
 parent.querySelector('#raid-drops-parent').before(section);
 section.innerHTML=`<h3>Mapa e inimigos da raid</h3><p>Use um mapa já criado ou monte um novo aqui. Salve o mapa antes de salvar a raid.</p><div class="v18-toolbar"><button type="button" class="btn" id="v18-load-map">Editar mapa selecionado</button><button type="button" class="btn" id="v18-new-map">Criar novo mapa</button><button type="button" class="btn" id="v18-open-npc">Criar NPC / Boss</button><button type="button" class="btn" id="v18-refresh-types">Atualizar inimigos</button></div><div id="v18-npc-dock"></div><div id="v18-map-form" hidden></div>`;
 let draft=null,dirty=false,saving=false;
 const form=section.querySelector('#v18-map-form');
 const selected=()=>document.getElementById('raid-phaseId');
 const field=(id,label,value,type='number',attrs='')=>`<label>${label}<input id="v18-${id}" class="admin-input" type="${type}" value="${esc(value)}" ${attrs}></label>`;
 const types=(boss)=>getAllNpcTypes().filter(x=>!!x.isBoss===boss);
 const options=(arr,value)=>arr.map(x=>`<option value="${esc(x.id)}" ${x.id===value?'selected':''}>${esc(x.name)}</option>`).join('');
 function syncOptions(id){selected().innerHTML=getAllPhases().map(p=>`<option value="${esc(p.id)}">${esc(p.name)}</option>`).join('');selected().value=id;}
 function open(p){
  if(dirty&&!confirm('Descartar alterações não salvas do mapa?'))return;
  draft=p?JSON.parse(JSON.stringify(p)):{name:'',bgType:'image',bgValue:'',worldWidth:6144,groundSource:.773,spawns:[],bossTypeId:null,bossX:5644};
  dirty=false;render();
 }
 function render(){
  form.hidden=false;
  form.innerHTML=`<h4>${draft.id&&!draft.builtin?'Editar mapa':'Novo mapa / cópia do mapa padrão'}</h4><div class="v10-form-grid">${field('map-name','Nome do mapa',draft.name,'text')}${field('map-width','Largura em telas de 1024 px',draft.worldWidth/1024,'number','min="2" max="12" step="1"')}${field('ground','Linha do chão (0,1 a 0,95)',draft.groundSource??.773,'number','min=".1" max=".95" step=".001"')}<label>Fundo<select id="v18-bg-type" class="admin-input"><option value="image">Imagem</option><option value="gradient">Gradiente</option></select></label>${field('bg-url','Link da imagem do mapa',draft.bgValue||'','text')}${field('color-top','Cor superior',draft.bgColors?.top||'#161020','color')}${field('color-bottom','Cor inferior',draft.bgColors?.bottom||'#42324f','color')}</div><label>Enviar imagem do mapa<input id="v18-bg-file" type="file" accept="image/png,image/jpeg,image/webp,image/gif"></label><small>A imagem enviada é reduzida e salva no mapa. GIF é convertido em imagem estática.</small><div id="v18-map-preview"><img id="v18-bg-preview" alt="Prévia do mapa"><div id="v18-ground-line"></div></div><p id="v18-image-status" role="status"></p><h4>NPCs e posições</h4><div class="v10-form-grid"><label>NPC<select id="v18-type" class="admin-input">${options(types(false))}</select></label>${field('spawn-x','Posição X (px)',650,'number','min="0" step="1"')}</div><button type="button" class="btn" id="v18-add-spawn">Adicionar NPC ao mapa</button><div id="v18-spawns"></div><h4>Boss final</h4><label><input id="v18-has-boss" type="checkbox" ${draft.bossTypeId?'checked':''}> Incluir boss final</label><div class="v10-form-grid"><label>Boss<select id="v18-boss" class="admin-input">${options(types(true),draft.bossTypeId)}</select></label>${field('boss-x','Posição X do boss',draft.bossX??draft.worldWidth-500,'number','min="0" step="1"')}</div><button type="button" class="btn btn-primary" id="v18-save-map">Salvar mapa e selecionar na raid</button><p id="v18-map-status" role="status"></p>`;
  document.getElementById('v18-bg-type').value=draft.bgType||'image';
  const preview=()=>{const img=document.getElementById('v18-bg-preview');const url=document.getElementById('v18-bg-url').value.trim();img.onload=()=>document.getElementById('v18-image-status').textContent='Imagem carregada.';img.onerror=()=>document.getElementById('v18-image-status').textContent='Não foi possível carregar a imagem. Confira o link.';if(url)img.src=url;else img.removeAttribute('src');document.getElementById('v18-ground-line').style.top=(Number(document.getElementById('v18-ground').value)*100)+'%';};
  document.getElementById('v18-bg-url').onchange=preview;document.getElementById('v18-ground').addEventListener('input',()=>document.getElementById('v18-ground-line').style.top=(Number(document.getElementById('v18-ground').value)*100)+'%');preview();
  form.oninput=()=>dirty=true;form.onchange=()=>dirty=true;
  document.getElementById('v18-bg-file').onchange=async e=>{const file=e.target.files[0];if(!file)return;const status=document.getElementById('v18-image-status');if(file.size>10*1024*1024){status.textContent='Use uma imagem de até 10 MB.';return;}const url=URL.createObjectURL(file);try{const img=new Image();img.src=url;await img.decode();const scale=Math.min(1,1600/img.naturalWidth,900/img.naturalHeight),c=document.createElement('canvas');c.width=Math.max(1,Math.round(img.naturalWidth*scale));c.height=Math.max(1,Math.round(img.naturalHeight*scale));c.getContext('2d').drawImage(img,0,0,c.width,c.height);const data=c.toDataURL('image/webp',.85);if(data.length>40000)throw Error('Imagem grande para a planilha. Use um link de imagem ou uma imagem menor/simplificada.');document.getElementById('v18-bg-url').value=data;dirty=true;preview();}catch(err){status.textContent=err.message||'Arquivo de imagem inválido.';}finally{URL.revokeObjectURL(url);}};
  document.getElementById('v18-add-spawn').onclick=()=>{const id=document.getElementById('v18-type').value,x=Number(document.getElementById('v18-spawn-x').value);if(!id||!Number.isFinite(x)||x<0||x>=Number(document.getElementById('v18-map-width').value)*1024){alert('Selecione um NPC e uma posição dentro do mapa.');return;}draft.spawns.push({typeId:id,x});dirty=true;rows();document.getElementById('v18-spawn-x').value=x+700;};
  document.getElementById('v18-save-map').onclick=save;
  rows();
 }
 function rows(){const el=document.getElementById('v18-spawns');el.innerHTML=draft.spawns.map((s,i)=>`<div class="v18-spawn"><span>${esc(getNpcTypeById(s.typeId)?.name||s.npcSnapshot?.name||s.typeId)}</span><label>X <input class="admin-input" type="number" min="0" value="${esc(s.x)}" data-position="${i}"></label><button type="button" class="btn" data-remove="${i}">Remover</button></div>`).join('')||'<p>Nenhum NPC adicionado.</p>';el.querySelectorAll('[data-position]').forEach(x=>x.oninput=()=>{draft.spawns[Number(x.dataset.position)].x=Number(x.value);dirty=true;});el.querySelectorAll('[data-remove]').forEach(b=>b.onclick=()=>{draft.spawns.splice(Number(b.dataset.remove),1);dirty=true;rows();});}
 async function save(){
  if(saving)return;const status=document.getElementById('v18-map-status'),button=document.getElementById('v18-save-map');
  try{
   if(currentUser?.role!=='admin')throw Error('Entre como administrador.');
   const val=id=>document.getElementById('v18-'+id).value;
   const name=val('map-name').trim(),width=Number(val('map-width')),ground=Number(val('ground')),hasBoss=document.getElementById('v18-has-boss').checked,bossId=val('boss'),bossX=Number(val('boss-x'));
   if(!name||!Number.isInteger(width)||width<2||width>12||!Number.isFinite(ground)||ground<.1||ground>.95)throw Error('Confira nome, largura (2–12 telas) e linha do chão.');
   if(!draft.spawns.length)throw Error('Adicione pelo menos um NPC.');
   if(draft.spawns.length>100||draft.spawns.some(s=>!Number.isFinite(s.x)||s.x<0||s.x>=width*1024||!getNpcTypeById(s.typeId)))throw Error('Confira os NPCs e as posições dentro do mapa (máximo 100).');
   if(hasBoss&&(!getNpcTypeById(bossId)?.isBoss||!Number.isFinite(bossX)||bossX<0||bossX>=width*1024))throw Error('Selecione um boss e uma posição válida.');
   const bgType=val('bg-type'),bgValue=val('bg-url').trim();if(bgType==='image'&&!/^(https:\/\/|\.\/|data:image\/(png|jpeg|webp|gif);base64,)/i.test(bgValue))throw Error('Use um link HTTPS, uma imagem enviada ou caminho ./assets/.');
   if(draft.id&&!draft.builtin&&getAllPhases().find(p=>p.id===draft.id)?.mapKind!=='raid'&&!confirm('Este mapa também é usado em fases. Alterá-lo afeta esses usos. Continuar?'))return;
   const config={schemaVersion:3,mapKind:'raid',previousPhaseId:'',groundSource:ground,worldWidth:width*1024,bgType,bgValue,bgColors:{top:val('color-top'),bottom:val('color-bottom')},spawns:draft.spawns.map(s=>({...s,npcSnapshot:JSON.parse(JSON.stringify(getNpcTypeById(s.typeId)))})),bossTypeId:hasBoss?bossId:null,bossX:hasBoss?bossX:null,bossSnapshot:hasBoss?JSON.parse(JSON.stringify(getNpcTypeById(bossId))):null};
   if(JSON.stringify(config).length>45000)throw Error('Mapa excede o limite da planilha. Use links de imagens nos NPCs/bosses e no fundo.');
   saving=true;button.disabled=true;status.textContent='Salvando mapa...';
   const res=await apiCall('salvarFase',{adminID:currentUser.id,id:draft.builtin?undefined:draft.id,nome:name,config});if(!res?.sucesso)throw Error(res?.mensagem||'Falha ao salvar mapa.');
   draft={...config,id:res.dados.id,name,builtin:false};dirty=false;await refreshPhasesFromServer();syncOptions(draft.id);status.textContent='Mapa salvo e selecionado. Agora salve a raid para publicar o calendário e recompensas.';msg(status.textContent);
  }catch(e){status.textContent=e.message;}finally{saving=false;button.disabled=false;}
 }
 document.getElementById('v18-load-map').onclick=()=>open(getPhaseById(selected().value));
 document.getElementById('v18-new-map').onclick=()=>open(null);
 document.getElementById('v18-refresh-types').onclick=async e=>{e.target.disabled=true;try{await refreshAdminContentFromServer();if(draft){document.getElementById('v18-type').innerHTML=options(types(false));const id=document.getElementById('v18-boss').value;document.getElementById('v18-boss').innerHTML=options(types(true),id);}msg('Catálogo de NPCs e bosses atualizado.');}catch(err){msg(err.message);}finally{e.target.disabled=false;}};
 document.getElementById('v18-open-npc').onclick=()=>{if(dock){restore();return;}const node=document.getElementById('admin-npcs-tab'),marker=document.createElement('span');node.before(marker);dock={node,marker};section.querySelector('#v18-npc-dock').appendChild(node);node.classList.remove('hidden');refreshAdminSelects();renderAdminNpcList();};
 selected().addEventListener('change',()=>{if(draft)msg('Mapa selecionado alterado. O rascunho aberto permanece até você salvar ou abrir outro mapa.');});
 active={hasUnsaved:()=>dirty||saving};return active;
}
window.ShadowRaidEditor={mount,restore,canDiscard:()=>!active?.hasUnsaved()||confirm('Descartar as alterações não salvas do mapa?')};
document.addEventListener('click',e=>{if(e.target.closest('.admin-tab')&&!e.target.closest('#admin-tab-raids'))restore();},true);
})();
