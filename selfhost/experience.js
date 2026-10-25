'use strict';
const $ = id => document.getElementById(id);
let tokenPromise, shelf = [], shelfKnown = false, recRun = 0, explainRun = 0, ocrRun = 0, screenshot = '', recAbort, explainAbort;
function element(tag, className, text) { const n=document.createElement(tag); if(className)n.className=className;if(text!==undefined)n.textContent=text;return n; }
async function token() { if(!tokenPromise)tokenPromise=fetch('/session').then(async r=>{if(!r.ok)throw Error('本机连接失效，请刷新页面。');const d=await r.json();if(!d.token)throw Error('未取得本机连接凭证。');return d.token;}).catch(e=>{tokenPromise=null;throw e;});return tokenPromise; }
async function api(path, data, signal) { const timeout=AbortSignal.timeout(['/api/explain','/api/recommend'].includes(path)?600000:60000);const r=await fetch(path,{method:data===undefined?'GET':'POST',headers:{Authorization:'Bearer '+await token(),...(data===undefined?{}:{'Content-Type':'application/json'})},...(data===undefined?{}:{body:JSON.stringify(data)}),signal:signal?AbortSignal.any([signal,timeout]):timeout});let d;try{d=await r.json();}catch{throw Error('暂时没有收到完整结果，请再试一次。');}if(!r.ok)throw Error(d.error||d.detail||'请求没有完成，请稍后重试。');return d; }
function tab(name){if(!['shelf','discover','companion'].includes(name))name='shelf';document.querySelectorAll('main>.panel').forEach(n=>n.hidden=n.id!==name);document.querySelectorAll('nav button').forEach(n=>{n.classList.toggle('active',n.dataset.tab===name);n.setAttribute('aria-current',n.dataset.tab===name?'page':'false');});history.replaceState(null,'','#'+name);}
document.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>tab(b.dataset.tab));
window.addEventListener('hashchange',()=>tab(location.hash.slice(1)));tab(location.hash.slice(1));
function safeURL(raw,kind='link'){try{const u=new URL(raw);if(u.protocol!=='https:')return '';if(kind==='link'&&u.hostname!=='weread.qq.com')return '';return u.href;}catch{return '';}}
function cover(b){const box=element('div','cover-wrap');const src=safeURL(b.cover||b.cover_url||b.coverUrl,'image');const fallback=()=>{box.replaceChildren(element('div','cover-placeholder',b.title||b.name||'暂无封面'));};if(src){const img=element('img');img.src=src;img.alt=(b.title||b.name||'书籍')+'封面';img.loading='lazy';img.referrerPolicy='no-referrer';img.onerror=fallback;box.append(img);}else fallback();return box;}
function linkFor(b){return safeURL(b.readerLink||b.weread_url||b.url||b.read_url||b.wereadUrl);}
function bookAction(b){const url=linkFor(b);if(url){const a=element('a','','去微信读书 ↗');a.href=url;a.target='_blank';a.rel='noopener noreferrer';return a;}return element('span','footnote','暂未取得阅读链接');}
function renderShelf(){const q=$('shelf-search').value.trim().toLowerCase();const shown=shelf.filter(b=>(String(b.title||b.name||'')+' '+String(b.author||'')).toLowerCase().includes(q));$('books').replaceChildren();if(!shown.length){$('books').append(element('div','empty-state',!shelfKnown?'还没有同步书架。点击「同步微信读书」，读取你已授权的书籍信息。':q?'没有找到这本书，换个书名或作者试试。':'本次同步没有返回书籍。'));return;}shown.forEach(b=>{const c=element('article','book');const progress=b.progress===null||b.progress===undefined?'进度暂不可用':Number.isFinite(Number(b.progress))?'已读 '+Number(b.progress)+'%':'进度暂不可用';c.append(cover(b),element('h3','',b.title||b.name||'未命名作品'),element('p','',b.author||''),element('p','',progress),bookAction(b));if(b.progress!==null&&b.progress!==undefined&&Number.isFinite(Number(b.progress))){const bar=element('progress','book-progress');bar.max=100;bar.value=Math.max(0,Math.min(100,Number(b.progress)));bar.setAttribute('aria-label','阅读进度');c.append(bar);}$('books').append(c);});}
function acceptShelf(d){shelf=Array.isArray(d)?d:(d.books||d.shelf||d.items||[]);const date=d.last_sync||d.synced_at;shelfKnown=d.status==='ready'||!!date||shelf.length>0;renderShelf();$('shelf-status').textContent=shelfKnown?`已载入 ${shelf.length} 本书`+(date?' · 最近同步 '+new Date(date).toLocaleString('zh-CN'):'')+(d.is_live===false?' · 本机缓存':'')+' · 部分书籍进度暂未读取':'尚未同步微信读书书架';if(d.sync_error)$('shelf-status').textContent+=' · 上次同步未完成';}
$('shelf-search').oninput=renderShelf;
$('sync').onclick=async()=>{$('sync').disabled=true;$('shelf-status').textContent='正在同步已授权的书架…';try{const d=await api('/api/shelf-sync',{});if(d.books||d.shelf||d.items)acceptShelf(d);else acceptShelf(await api('/api/shelf'));}catch(e){$('shelf-status').textContent=e.message;}finally{$('sync').disabled=false;}};
api('/api/shelf').then(acceptShelf).catch(e=>{$('shelf-status').textContent=e.message;renderShelf();});
const setupHint=element('aside','setup-hint');setupHint.hidden=true;$('shelf').prepend(setupHint);
api('/api/status').then(state=>{if(state.configured&&state.model_configured)return;setupHint.append(element('strong','','第一次使用？先把自己的授权接过来。'),element('p','','本机只检查是否配置，不会自动验证Key或调用模型。'));const link=element('a','','打开使用与连接引导 ↗');link.href='/setup.html';setupHint.append(link);setupHint.hidden=false;}).catch(()=>{});
const importSelection=element('button','outline','取回插件刚刚校对的选段');$('passage').before(importSelection)
importSelection.onclick=async()=>{if($('passage').value.trim()&&!confirm('替换这里已编辑的原文？'))return;try{const d=await api('/api/capture');if(!d.text){$('ocr-status').textContent='插件尚未送来可用选段。请在侧栏完成识别和校对，再点击送到阅读花园。';return}invalidateExplanation();ocrRun++;$('passage').value=d.text;$('book-title').value=d.book_title||'';$('ocr-status').textContent='已取回本机选段，尚未发送模型。'}catch(e){$('ocr-status').textContent=e.message}}
document.querySelectorAll('[data-query]').forEach(b=>b.onclick=()=>{cancelRecommendation();$('query').value=b.dataset.query;$('recommend-status').textContent='方向已选好，点击「帮我找找」开始。';$('query').focus();});
function cancelRecommendation(){recRun++;recAbort?.abort();$('recommend-submit').disabled=false;}
function revealRecommendations(){document.querySelector('.examples').hidden=true;const target=$('direction').hidden?$('recommendations'):$('direction');target.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'start'});}
function reviseRecommendation(){cancelRecommendation();$('recommend-form').hidden=false;$('direction').hidden=true;$('decision-details').hidden=true;$('recommend-status').textContent='原来的方向还在，可以改一改，再帮你找。';$('recommend-form').scrollIntoView({behavior:'smooth',block:'center'});$('query').focus();}
$('revise-recommendation').onclick=reviseRecommendation;
$('query').oninput=()=>{if(recAbort){cancelRecommendation();$('recommend-status').textContent='方向已修改，请重新找书。';}};
function renderCards(cards){document.querySelector('.recommendation-recovery').hidden=false;$('recommendations').replaceChildren();if(!cards.length){$('recommendations').append(element('div','empty-state','这次还没有足够合适的作品。可以换个方向，或补充一点期待。'));return;}cards.forEach(b=>{const c=element('article','recommendation');c.append(cover(b));const inside=b.in_shelf===true||b.pool==='shelf'||b.pool==='书架内'||b.source==='shelf'||b.source==='bookshelf';c.append(element('span','source-label',inside?'书架已有 · 再次遇见':b.in_shelf===false||b.pool==='external'||b.pool==='书架外'||b.source==='external'?'书架之外 · 新发现':'候选作品'),element('h3','',b.title||b.name||'未命名作品'),element('p','author',b.author||''));const quote=typeof b.quote==='object'?b.quote?.text:b.quote;const verified=b.quote_verified===true||b.quote?.verified===true;if(quote&&verified)c.append(element('blockquote','',quote));c.append(element('p','reason',b.reason||b.recommendation_reason||b.copy||''));const actions=element('div','card-actions');actions.append(bookAction(b));const chat=element('button','outline','带一段来聊');chat.onclick=()=>{invalidateExplanation();$('book-title').value=b.title||b.name||'';tab('companion');$('passage').focus();};actions.append(chat);c.append(actions);$('recommendations').append(c);});}
const limitations=element('p','footnote');$('recommendations').after(limitations);
$('recommend-form').onsubmit=async e=>{
 e.preventDefault();const query=$('query').value.trim();if(!query){$('recommend-status').textContent='先说说你现在想读点什么。';return;}
 cancelRecommendation();const run=recRun;recAbort=new AbortController();$('recommend-submit').disabled=true;$('recommend-status').textContent='正在找书、核对这次是否合适…';$('direction').hidden=true;$('decision-details').hidden=true;$('recommendations').replaceChildren();limitations.textContent='';
 try{const d=await api('/api/recommend',{query},recAbort.signal);if(run!==recRun)return;
 if(d.requires_clarification||d.clarification){$('direction').textContent=typeof d.clarification==='string'?d.clarification:d.clarification?.text||'你更希望从阅读中获得什么？';$('direction').hidden=false;$('recommend-status').textContent='把你的期待补充到上面的输入框，再点击「帮我找找」。';revealRecommendations();return;}
 const cards=d.cards||d.recommendations||d.books||[];renderCards(cards);const opening=d.opening_line||d.opening||d.direction_summary;if(opening){$('direction').textContent=opening;$('direction').hidden=false;}$('recommend-status').textContent=d.notice||d.message||`这次找到 ${cards.length} 本作品。`;revealRecommendations();
 limitations.textContent='本次仅在已整理的 13 本书中选择，不代表微信读书全库。'+(cards.length<3?' 合适且资料齐全的作品不足三本，不强凑。 ':' ')+(Array.isArray(d.limitations)?d.limitations.join(' '):d.limitations||'');
 const detail=d.explanation||d.selection_reason||d.trace||d.strategy;if(detail){$('decision').textContent=typeof detail==='string'?detail:JSON.stringify(detail,null,2);$('decision-details').hidden=false;}
 }catch(e){if(run===recRun)$('recommend-status').textContent=e.name==='AbortError'?'已停止本次找书。':e.name==='TimeoutError'?'这次找书用时较长，请稍后再试。':e.message;}finally{if(run===recRun){$('recommend-submit').disabled=false;recAbort=null;}}
};
$('recommend-submit').disabled=false;
const stopExplanation=element('button','outline','停止生成');stopExplanation.hidden=true;$('ask').after(stopExplanation);stopExplanation.onclick=()=>{invalidateExplanation();$('answer-status').textContent='已停止等待解读，未展示未完成内容。';};
function invalidateExplanation(){explainRun++;explainAbort?.abort();explainAbort=null;$('understand').disabled=false;$('ask').disabled=false;stopExplanation.hidden=true;}
$('passage').oninput=()=>{ocrRun++;invalidateExplanation();$('answer-status').textContent='原文已修改，下一次发送将使用新选段。';};$('question').oninput=invalidateExplanation;$('book-title').oninput=invalidateExplanation;
async function explain(mode){
 const text=$('passage').value.trim(),question=$('question').value.trim();
 if(!text){$('answer-status').textContent='先粘贴或识别一段原文，再发送。';$('passage').focus();return;}
 if(mode==='question'&&!question){$('answer-status').textContent='先写下你想问的问题。';$('question').focus();return;}
 invalidateExplanation();const run=explainRun;explainAbort=new AbortController();
 $('understand').disabled=true;$('ask').disabled=true;stopExplanation.hidden=false;
 $('answer-status').textContent='正在结合原文展开解读，并检查是否越过选段…';$('answer').replaceChildren();
 try{
  const d=await api('/api/explain',{text,book_title:$('book-title').value.trim(),mode,...(mode==='question'?{question}:{})},explainAbort.signal);
  if(run!==explainRun)return;
  const result=d.answer||d.text||d.response||d.content;if(!result)throw Error('这次没有生成可展示的解读，请重试。');
  $('answer').textContent=typeof result==='string'?result:JSON.stringify(result,null,2);
  $('answer-status').textContent=d.background_used?'解读完成 · 已结合下方来源':'解读完成 · 本次未采用书外背景';
  for(const source of d.sources||[]){try{
   const url=new URL(source.url);if(url.protocol!=='https:'||url.username||url.password)continue;
   const a=element('a','footnote',source.title||url.hostname);a.href=url.href;a.target='_blank';a.rel='noopener noreferrer';
   const p=element('p','footnote','');p.append(a);$('answer').append(p);
  }catch{}}
  if(d.boundary)$('answer').append(element('p','footnote','未读取后文。解读已经过检查，仍可能存在错误。'));
 }catch(e){if(run===explainRun)$('answer-status').textContent=e.name==='AbortError'?'已停止本次解读。':e.name==='TimeoutError'?'这次解读用时较长，未展示未完成内容。可以稍后重试。':e.message;}
 finally{if(run===explainRun){$('understand').disabled=false;$('ask').disabled=false;explainAbort=null;stopExplanation.hidden=true;}}
}
$('understand').onclick=()=>explain('understand');$('ask').onclick=()=>explain('question');
$('screenshot').onchange=async()=>{const f=$('screenshot').files[0];if(!f)return;if(f.size>12*1024*1024){$('ocr-status').textContent='截图较大，请使用12MB以内的图片。';return;}const run=++ocrRun;const value=await new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=reject;r.readAsDataURL(f);});if(run!==ocrRun)return;screenshot=value;$('preview').src=value;$('preview').hidden=false;$('ocr').disabled=false;$('ocr-status').textContent='截图已导入。点击本机识别后，检查原文，再决定是否发送模型。';};
$('ocr').onclick=async()=>{if(!screenshot)return;if($('passage').value.trim()&&!confirm('识别结果会替换当前原文，是否继续？'))return;const run=++ocrRun;$('ocr').disabled=true;$('ocr-status').textContent='正在本机识别高亮选段…';try{const d=await api('/recognize',{image:screenshot});if(run!==ocrRun)return;invalidateExplanation();$('passage').value=d.text||'';$('ocr-status').textContent=(d.text?'识别完成，请校对后再发送。':'没有识别到高亮选段，可以直接粘贴原文。')+' '+(d.warnings||[]).join(' ');}catch(e){if(run===ocrRun)$('ocr-status').textContent=e.message;}finally{$('ocr').disabled=!screenshot;}};
