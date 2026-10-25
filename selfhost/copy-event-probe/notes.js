'use strict';
const $=id=>document.getElementById(id);
let records=[],revision='',visible=[],busy=false;
const make=(tag,text,className)=>{const node=document.createElement(tag);if(text!==undefined)node.textContent=text;if(className)node.className=className;return node;};
async function send(message){const response=await chrome.runtime.sendMessage(message);if(!response||response.error)throw Error(response?.error||'插件尚未就绪，请刷新插件后重试');return response;}
function controls(){for(const id of ['refresh','clear','export-json','export-markdown'])$(id).disabled=busy||(id==='clear'?records.length===0:id.startsWith('export-')?visible.length===0:false);document.querySelectorAll('[data-delete]').forEach(button=>button.disabled=busy);}
function render(){
  const query=$('search').value.trim().toLowerCase(),book=$('book').value;
  visible=records.filter(row=>(!book||row.key===book)&&(!query||[row.book_title,row.text,row.note].join(' ').toLowerCase().includes(query))).sort((a,b)=>b.updated.localeCompare(a.updated));
  $('count').textContent=`共 ${records.length} 条批注 · 当前显示 ${visible.length} 条 · 导出仅包含当前结果`;
  $('notes').replaceChildren();
  for(const row of visible){
    const article=make('article',undefined,'note'),top=make('div',undefined,'note-top'),info=make('div'),del=make('button','删除','danger');
    const time=new Date(row.updated);info.append(make('h2',row.book_title||'未命名作品'),make('time',Number.isNaN(time.getTime())?'时间未记录':time.toLocaleString('zh-CN')));
    del.dataset.delete='true';del.onclick=()=>remove(row);top.append(info,del);article.append(top,make('blockquote',row.text),make('p',row.note,'thought'));
    const link=make('a','回到微信读书 ↗','reading-link');link.href='https://weread.qq.com'+row.key.replace(/^annotation:/,'');link.target='_blank';link.rel='noopener noreferrer';article.append(link);$('notes').append(article);
  }
  if(!visible.length){const box=make('div',undefined,'empty');box.append(make('strong',records.length?'这次没有找到':'还没有留下批注'),make('p',records.length?'换个书名、原文或关键词试试。':'在阅读页选中原文，点击陪读 → 批注 → 保存，就会出现在这里。'));$('notes').append(box);}
  controls();
}
async function load(){busy=true;controls();try{const data=await send({type:'notes-list'});records=data.notes;revision=data.revision;const selected=$('book').value;const groups=new Map(records.map(row=>[row.key,row.book_title||'未命名作品']));$('book').replaceChildren(new Option('全部书籍',''),...[...groups].map(([key,title])=>new Option(title,key)));if(groups.has(selected))$('book').value=selected;render();}catch(error){$('status').textContent=error.message;}finally{busy=false;controls();}}
function confirmDelete(title,description,all=false,action='确认删除'){
  const dialog=$('confirm-dialog');$('confirm-title').textContent=title;$('confirm-description').textContent=description;$('confirm-label').hidden=!all;$('confirm-input').value='';$('confirm-delete').disabled=all;$('confirm-delete').textContent=action;
  $('confirm-cancel').textContent=action==='确认断开'?'取消，保留连接':'取消，保留批注';
  $('confirm-input').oninput=()=>{$('confirm-delete').disabled=all&&$('confirm-input').value!=='删除全部';};
  dialog.returnValue='cancel';dialog.showModal();
  return new Promise(resolve=>dialog.addEventListener('close',()=>resolve(dialog.returnValue==='delete'),{once:true}));
}
async function remove(row){
  const expected=revision;
  if(!await confirmDelete('删除这条批注？',`${row.book_title||'未命名作品'}\n${row.text.slice(0,90)}\n\n只删除本插件的本机记录，不修改微信读书。删除后无法恢复。`))return;
  busy=true;controls();try{await send({type:'notes-delete',key:row.key,text:row.text,revision:expected});$('status').textContent='已删除这条本机批注。';await load();}catch(error){$('status').textContent=error.message;await load();}finally{busy=false;controls();}
}
$('clear').onclick=async()=>{
  const count=records.length,expected=revision;
  if(!await confirmDelete(`清空全部 ${count} 条批注？`,'这会删除当前 Chrome 资料夹里本插件的全部批注，不受筛选影响。建议先导出。不会删除微信读书内容；删除后无法恢复。',true))return;
  busy=true;controls();try{const result=await send({type:'notes-clear',revision:expected});$('status').textContent=`已清空 ${result.deleted} 条本机批注。`;await load();}catch(error){$('status').textContent=error.message;await load();}finally{busy=false;controls();}
};
function download(format){
  if(!visible.length||busy)return;
  const text=SHUNotesFormat.exportNotes(visible,format),extension=format==='json'?'json':'md';
  const url=URL.createObjectURL(new Blob([text],{type:format==='json'?'application/json;charset=utf-8':'text/markdown;charset=utf-8'}));
  const link=make('a');link.href=url;link.download=`纸间批注-${new Date().toISOString().slice(0,10)}.${extension}`;document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);
  $('status').textContent=`已发起导出当前 ${visible.length} 条批注，请在浏览器下载列表确认文件；导出不会删除记录。`;
}
$('export-json').onclick=()=>download('json');$('export-markdown').onclick=()=>download('markdown');$('search').oninput=render;$('book').onchange=render;$('refresh').onclick=load;
async function connection(){try{const state=await send({type:'connection-status'});$('connection-status').textContent=!state.service?'本机服务离线 · 批注仍可管理':state.paired?'本机服务在线 · 插件已连接':'本机服务在线 · 插件尚未连接';$('disconnect').disabled=!state.paired;}catch{$('connection-status').textContent='插件连接检查未完成 · 批注可单独刷新';}}
$('check-connection').onclick=connection;
$('connect').onclick=async()=>{try{const state=await send({type:'connect'});$('connection-status').textContent=state.paired?'已连接；没有调用模型。':'已打开本机确认页。批准后回来点击“检查连接”，或再点一次“连接本机”。';$('disconnect').disabled=!state.paired;}catch(error){$('connection-status').textContent=error.message;}};
$('disconnect').onclick=async()=>{if(!await confirmDelete('断开陪读连接？','停止后续模型请求的连接权限，不删除批注，也不会撤回已经发送的请求。',false,'确认断开'))return;try{const result=await send({type:'disconnect'});$('connection-status').textContent=result.disconnected?'已断开连接；批注仍在本机。':'请在本机“使用与连接”页面检查并断开。';$('disconnect').disabled=true;}catch(error){$('connection-status').textContent=error.message;}};
load();connection();
