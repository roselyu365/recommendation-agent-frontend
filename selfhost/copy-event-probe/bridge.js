(() => {
  const base = 'http://127.0.0.1:8769';
  let token = '', consentOpened = false, busy = false;
  const notes = SHUNotes.createStore(chrome.storage.local);
  async function request(path, data, auth = false) {
    const response = await fetch(base + path, {
      method:data === undefined ? 'GET' : 'POST',
      headers:{...(data === undefined ? {} : {'Content-Type':'application/json'}),
        ...(auth ? {Authorization:`Bearer ${token}`} : {})},
      ...(data === undefined ? {} : {body:JSON.stringify(data)}),
      signal:AbortSignal.timeout(15000)
    });
    if (response.status === 403) {token=''; throw Error('连接已过期，请再次点击功能重新连接');}
    const body = await response.json();
    if (!response.ok) throw Error(body.error || '本机服务暂时不可用');
    return body;
  }
  async function pair(openConsent = true) {
    if (token) return true;
    const created = await request('/pair/request', {});
    const polled = await request('/pair/poll', {id:created.id});
    if (polled.token) {token=polled.token; consentOpened=false; return true;}
    if (openConsent && !consentOpened) {await chrome.tabs.create({url:base+'/pair.html'}); consentOpened=true;}
    return false;
  }
  chrome.runtime.onMessage.addListener((message, sender, reply) => {
    (async () => {
      const url = new URL(sender.url || 'about:blank');
      const manager = sender.id === chrome.runtime.id && sender.url === chrome.runtime.getURL('notes.html');
      const reader = sender.id === chrome.runtime.id && sender.frameId === 0 && sender.tab &&
          url.origin === 'https://weread.qq.com' && url.pathname.startsWith('/web/reader/');
      if (!manager && !reader)
        throw Error('仅允许阅读页使用');
      const m=message || {};
      if(m.type==='open-notes' && reader){await chrome.runtime.openOptionsPage();return {opened:true};}
      if(m.type==='connection-status'){
        try{
          let state=await request('/connection/status',{},true);
          if(!state.paired){
            token='';
            if(state.approved && await pair(false))state=await request('/connection/status',{},true);
          }
          return state;
        }catch{return {service:false,paired:false};}
      }
      if(m.type==='connect'){consentOpened=false;return {paired:await pair(),service:true};}
      if(m.type==='disconnect'){
        if(!await pair(false))return {disconnected:false,needsPairing:true};
        const result=await request('/pair/disconnect',{},true);token='';consentOpened=false;return result;
      }
      if(manager){
        if(m.type==='notes-list')return notes.list();
        if(m.type==='notes-delete')return notes.remove(m.key,m.text,m.revision);
        if(m.type==='notes-clear')return notes.clear(m.revision);
        throw Error('管理页不发送模型请求');
      }
      if (m.type === 'job-result') {
        if (!token || typeof m.job !== 'string' || !/^[a-zA-Z0-9_-]{20,100}$/.test(m.job)) throw Error('任务已失效');
        return request('/api/explain-result',{id:m.job},true);
      }
      if (typeof m.text !== 'string' || !m.text.trim() || m.text.length > 5000) throw Error('原文请保持在 1–5000 字符');
      if (m.type === 'note-get') {
        return notes.get(url.pathname,m.text);
      }
      if (m.type === 'note-save') {
        if (typeof m.note !== 'string' || !m.note.trim() || m.note.length > 5000) throw Error('批注请保持在 1–5000 字符');
        return notes.save(url.pathname,{text:m.text,note:m.note,book_title:m.book_title});
      }
      if(m.type !== 'explain' || !['understand','question'].includes(m.mode)) throw Error('不支持的模式');
      const question=m.question || '';
      if(typeof question !== 'string' || question.length>1500 || (m.mode==='question' && !question.trim()))throw Error('请填写 1–1500 字的问题');
      if(busy)throw Error('请求正在提交，请稍候');
      busy=true;
      try {
        if(!await pair())return {needsPairing:true};
        return await request('/api/explain-start',{text:m.text,book_title:String(m.book_title||'').slice(0,200),mode:m.mode,question},true);
      } finally {busy=false;}
    })().then(reply, error => reply({error:error?.name==='SHUNotesError'?error.message:'操作未完成。请检查本机服务是否运行、连接是否批准；确认后再次点击功能。'}));
    return true;
  });
})();
