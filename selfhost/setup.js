'use strict';
const el=id=>document.getElementById(id);
let session;
async function request(path,data){
  if(!session){const response=await fetch('/session',{signal:AbortSignal.timeout(5000)});if(!response.ok)throw Error('连接已失效，请刷新页面');session=(await response.json()).token;}
  const response=await fetch(path,{method:data===undefined?'GET':'POST',headers:{Authorization:'Bearer '+session,...(data===undefined?{}:{'Content-Type':'application/json'})},...(data===undefined?{}:{body:JSON.stringify(data)}),signal:AbortSignal.timeout(5000)});
  if(response.status===403){session=null;throw Error('本机连接已更新，请再次刷新状态');}
  const body=await response.json();if(!response.ok)throw Error(body.error||'这次操作未完成');return body;
}
function state(id,text,ok){el(id).textContent=text;el(id).dataset.level=ok?'ready':'warning';}
function confirmAction(message){const dialog=el('connection-confirm');el('confirm-message').textContent=message;dialog.returnValue='cancel';dialog.showModal();return new Promise(resolve=>dialog.addEventListener('close',()=>resolve(dialog.returnValue==='revoke'),{once:true}));}
function row(origin,label,action){
  const box=document.createElement('div'),title=document.createElement('strong'),code=document.createElement('code'),button=document.createElement('button');
  box.className='connection';title.textContent=label;code.textContent=origin;button.className='outline';button.textContent=action.label;
  button.onclick=async()=>{if(action.confirm&&!await confirmAction(action.confirm))return;button.disabled=true;try{await request(action.path,action.body);el('status').textContent=action.done;await refresh();}catch(error){el('status').textContent=error.message;button.disabled=false;}};
  box.append(title,code,button);return box;
}
async function refresh(){
  el('refresh').disabled=true;
  try{
    const [service,connections,pending]=await Promise.all([request('/api/status'),request('/pair/connections'),request('/pair/pending')]);
    state('service-state','本机服务可访问',true);
    state('weread-state',service.configured?'微信读书：已配置 · 未联网验证':'微信读书：待配置',service.configured);
    state('model-state',service.model_configured?'模型：已配置 · 未联网验证':'模型：待配置',service.model_configured);
    state('plugin-state',connections.connections.length?'已批准 '+connections.connections.length+' 个插件':'未连接或等待批准',connections.connections.length>0);
    state('shelf-state',service.shelf_status==='ready'?'本次会话已同步':'尚未同步',service.shelf_status==='ready');
    el('connections').replaceChildren(...connections.connections.map(item=>row(item.origin,'已批准的本机连接',{label:'断开连接',path:'/pair/revoke',body:{origin:item.origin},confirm:'断开这个插件？之后使用模型需要重新批准。已发送的模型请求不会撤回，批注不会删除。',done:'已断开连接；旧连接凭证立即失效。'})));
    el('pending').replaceChildren(...pending.requests.map(item=>row(item.origin,'等待你核对并批准',{label:'允许连接',path:'/pair/approve',body:{id:item.id},done:'已批准。回到插件检查连接，再点击要用的功能；不会自动发送原文。'})));
    if(!el('status').textContent||el('status').textContent==='正在检查本机连接…')el('status').textContent='本轮只检查本机配置和连接状态，没有读取书架或调用模型。';
  }catch(error){state('service-state','连接未完成',false);for(const id of ['weread-state','model-state','plugin-state','shelf-state'])state(id,'状态暂不可用',false);el('status').textContent=error.message||'请检查本机服务是否仍在运行';el('connections').replaceChildren();el('pending').replaceChildren();}
  finally{el('refresh').disabled=false;}
}
el('refresh').onclick=refresh;refresh();
