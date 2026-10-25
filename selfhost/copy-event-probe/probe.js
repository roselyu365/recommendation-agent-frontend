(async () => {
  if (location.origin !== 'https://weread.qq.com' || !location.pathname.startsWith('/web/reader/')) return;
  const id = 'shu-copy-event-probe';
  globalThis.SHUCompanionDispose?.();
  globalThis.SHUCopyAttempt?.abort();
  const attempt = new AbortController();
  globalThis.SHUCopyAttempt = attempt;
  const startURL = location.href;
  const started = performance.now();
  const current = () => !attempt.signal.aborted && location.href === startURL &&
    document.visibilityState === 'visible' && document.hasFocus() && performance.now() - started < 3000;
  const invalidate = () => attempt.abort();
  document.addEventListener('visibilitychange', invalidate, {signal:attempt.signal});
  window.addEventListener('pagehide', invalidate, {signal:attempt.signal});
  document.getElementById(id)?.remove();
  const visible = element => {
    const rect = element.getBoundingClientRect();
    const style = getComputedStyle(element);
    return rect.width > 0 && rect.height > 0 && rect.bottom > 0 &&
      rect.top < innerHeight && rect.right > 0 && rect.left < innerWidth &&
      style.visibility === 'visible' && style.display !== 'none';
  };
  const selected = [...document.querySelectorAll('.wr_selection')].filter(visible);
  const controls = [...document.querySelectorAll('button, [role="button"]')]
    .filter(element => visible(element) &&
      (element.getAttribute('aria-label') || element.textContent).trim() === '复制');
  let result = {status: 'no-selection', text: '', events: 0};
  const bookTitle = document.title;
  if (selected.length) {
    if (controls.length === 1) {
      // Require a fresh success toast, not one left over from another copy.
      const success = () => [...document.querySelectorAll('body *')]
        .some(el => el.children.length === 0 && el.textContent.trim() === '已复制到剪贴板' && visible(el));
      const oldToast = success();
      let finish;
      const confirmed = new Promise(resolve => {finish = resolve;});
      const observer = new MutationObserver(() => {
        if (!oldToast && success()) finish(true);
      });
      const timer = setTimeout(() => finish(false), 1200);
      const abortWait = () => finish(false);
      attempt.signal.addEventListener('abort', abortWait, {once:true});
      observer.observe(document.body, {subtree:true, childList:true, characterData:true, attributes:true, attributeFilter:['style','class']});
      try {
        result = globalThis.SHUCopyEventProbe.captureDuringClick(window, () => controls[0].click());
        const copied = !oldToast && (success() || await confirmed);
        result = await globalThis.SHUCopyEventProbe.readAfterCopy({
          copy:result, confirmed:copied, current,
          read:() => navigator.clipboard.readText()
        });
      } finally {
        clearTimeout(timer);
        observer.disconnect();
        attempt.signal.removeEventListener('abort', abortWait);
      }
    } else result = {status: 'copy-control-missing', text:'', events:0};
  }
  if (attempt.signal.aborted) return;
  // Remove temporary event listeners before presenting an editable result.
  attempt.abort();
  const messages = {
    captured: '已在本次复制提示出现后读取一次。原文可直接修改；请核对是否与选段一致。',
    'copy-unconfirmed': '没有确认到唯一的本次复制及新的成功提示，未读取剪贴板。请等提示消失后重新选段。',
    'cancelled': '页面焦点或本次操作已变化，未展示读取结果。请回到阅读页重试。',
    'empty-clipboard': '本次读取没有文字，不展示旧内容。',
    'read-failed': '本次读取失败。请确认已允许新版剪贴板读取权限，并回到阅读页重试。',
    'no-selection': '未找到当前可见选区。请先在正文中拖选文字，让“复制”菜单出现，再点击本插件。',
    'copy-control-missing': '没有找到唯一、可见的“复制”按钮。未尝试猜测或点击其他控件。',
    'no-event': '这次点击没有收到同步复制事件。不能据此判断复制是否成功，也没有读取剪贴板补取。',
    'empty-event': '收到了复制事件，但事件没有提供文字。没有读取系统剪贴板，也没有使用 OCR 补取。',
    'unreadable-event': '收到了事件，但无法读取事件中提供的文字。',
    'too-long': '本次文字超过验证上限（5000 字符），未截断展示。',
    ambiguous: '本次出现多个复制事件，无法确定唯一来源，已丢弃文字。',
    'click-failed': '触发复制失败，未保留任何文字。'
  };
  const host = document.createElement('aside');
  host.id = id;
  host.style.cssText = 'position:fixed;right:16px;top:16px;width:min(400px,90vw);z-index:2147483647';
  const root = host.attachShadow({mode: 'open'});
  const style = document.createElement('style');
  style.textContent = `
    section{box-sizing:border-box;padding:22px;background:#faf6eb;color:#234b40;border:1px solid #a9b5a7;
      border-radius:18px;box-shadow:0 8px 40px #0003;font:15px/1.7 system-ui;max-height:85vh;overflow:auto}
    h2{font:24px/1.4 Georgia,"Songti SC",serif;margin:0 0 10px}p{margin:10px 0}small{color:#666}
    textarea{box-sizing:border-box;width:100%;height:220px;padding:12px;font:16px/1.8 system-ui;
      background:white;color:#222;border:1px solid #bbc1b4;border-radius:8px}
    button{padding:9px 12px;background:#234b40;color:white;border:0;border-radius:8px;cursor:pointer;margin:4px 5px 4px 0}
    button:disabled{opacity:.45;cursor:wait}button:focus-visible,textarea:focus-visible{outline:3px solid #c28a3e}
    .answer{white-space:pre-wrap;border-top:1px solid #d8cfbd;padding-top:16px;font:16px/1.9 Georgia,"Songti SC",serif}
    .notice{font-size:12px;color:#766d5d}a{color:#234b40}textarea{resize:vertical;min-height:90px}
  `;
  const section = document.createElement('section');
  const heading = document.createElement('h2');
  heading.textContent = 'SHU · 在文字旁，聊一会儿';
  const status = document.createElement('p');
  status.textContent = messages[result.status];
  status.setAttribute('role', 'status');
  const metadata = document.createElement('small');
  metadata.textContent = bookTitle.replace(/ - 微信读书$/, '')+' · '+chrome.runtime.getManifest().version;
  section.append(heading, status, metadata);
  let disposed = false, revision = 0, session;
  const lifecycle = new AbortController();
  const send = async payload => {
    const response = await chrome.runtime.sendMessage(payload);
    if (!response) throw Error('插件连接已失效，请重新点击陪读');
    if (response.error) throw Error(response.error);
    return response;
  };
  const dispose = () => {
    disposed=true; revision++; session?.close(); lifecycle.abort();
    root.querySelectorAll('textarea').forEach(el=>{el.value='';});
    result.text=''; host.remove();
  };
  globalThis.SHUCompanionDispose=dispose;
  window.addEventListener('pagehide',dispose,{signal:lifecycle.signal});
  const connectionText=document.createElement('p'),connectionActions=document.createElement('div');
  connectionText.className='notice';connectionText.setAttribute('role','status');
  async function checkConnection(){try{const state=await send({type:'connection-status'});if(disposed)return;connectionText.textContent=!state.service?'本机服务未连接；批注仍可保存和管理。':state.paired?'本机服务在线 · 插件已连接。':'本机服务在线 · 需要批准插件连接。';}catch{if(!disposed)connectionText.textContent='连接检查未完成；请检查插件和本机服务。';}}
  for(const [label,action] of [
    ['我的批注',async()=>{await send({type:'open-notes'});} ],
    ['检查连接',checkConnection],
    ['连接本机',async()=>{const state=await send({type:'connect'});if(!disposed)connectionText.textContent=state.paired?'已连接。点击要用的功能才会发送原文。':'已打开本机确认页；批准后回到这里检查连接。不会自动发送原文。';}]
  ]){const button=document.createElement('button');button.textContent=label;button.onclick=async()=>{try{await action();}catch{if(!disposed)connectionText.textContent='操作未完成，请检查本机服务或刷新插件。';}};connectionActions.append(button);}
  section.append(connectionText,connectionActions);checkConnection();
  if (result.status === 'captured') {
    const textarea = document.createElement('textarea');
    textarea.setAttribute('aria-label', '本次选段文字，可修改');
    textarea.value = result.text;
    section.append(textarea);
    status.textContent = '已取得选段，可直接修改。注释标记可能显示为“[插图]”。';
    const actions=document.createElement('div'), editor=document.createElement('div');
    const responseStatus=document.createElement('p'), answer=document.createElement('div');
    responseStatus.setAttribute('role','status'); answer.className='answer';answer.hidden=true;
    const sources=document.createElement('div');
    const button=(label,handler,parent=actions)=>{
      const el=document.createElement('button');el.textContent=label;el.onclick=handler;parent.append(el);return el;
    };
    const cleanTitle=bookTitle.replace(/ - 微信读书$/,'');
    session=globalThis.SHUCompanion.createSession(send);
    session.edit(textarea.value);
    const clearAnswer=()=>{
      revision++;session.edit(textarea.value); answer.textContent='';answer.hidden=true;sources.replaceChildren();
    };
    textarea.addEventListener('input',()=>{
      clearAnswer();editor.replaceChildren();
      responseStatus.textContent='原文已修改；下次使用当前文字。';
    },{signal:lifecycle.signal});
    const modelButtons=[];
    async function run(mode,question='') {
      const at=revision;
      modelButtons.forEach(b=>{b.disabled=true;});
      answer.textContent='';answer.hidden=true;sources.replaceChildren();
      responseStatus.textContent='正在阅读这段文字…';
      try {
        let data=await session.ask(mode,cleanTitle,question);
        if(disposed || at!==revision || !data)return;
        if(data.needsPairing){
          responseStatus.textContent='已打开本机连接确认页。允许后回到这里，再点击功能；不会自动发送原文。';
          return;
        }
        const deadline=Date.now()+600000;
        while(data.job && data.status==='pending'){
          const job=data.job;
          await new Promise(resolve=>setTimeout(resolve,1800));
          if(disposed || at!==revision || location.href!==startURL)return;
          const polled=await send({type:'job-result',job});
          if(polled.status==='done'){data=polled.result;break;}
          if(polled.status!=='pending' || Date.now()>deadline)throw Error(polled.error||'等待已结束，未展示未完成的回答。');
        }
        if(disposed || at!==revision || location.href!==startURL)return;
        answer.textContent=data.text || data.content || '没有收到可展示的回答。'; answer.hidden=false;
        responseStatus.textContent='基于当前选段的陪读';
        for(const source of data.sources || []){
          try {
            const url=new URL(source.url);
            if(url.protocol!=='https:')continue;
            const a=document.createElement('a');a.href=url.href;a.target='_blank';a.rel='noopener noreferrer';
            a.textContent=source.title||source.name||'背景来源';sources.append(a,document.createElement('br'));
          }catch{}
        }
      }catch(error){if(!disposed && at===revision)responseStatus.textContent=error.message||'本次未完成，请重试';}
      finally{modelButtons.forEach(b=>{b.disabled=false;});}
    }
    modelButtons.push(button('看懂这段',()=>{editor.replaceChildren();run('understand');}));
    button('批注',async()=>{
      clearAnswer();editor.replaceChildren();responseStatus.textContent='';
      const at=revision, note=document.createElement('textarea');
      note.setAttribute('aria-label','我的批注');note.placeholder='记下你自己的理解…';note.style.height='110px';
      editor.append(note);
      button('保存批注',async()=>{
        const selection=textarea.value, contents=note.value;
        try{
          await send({type:'note-save',text:selection,note:contents,book_title:cleanTitle});
          if(!disposed && at===revision)responseStatus.textContent='已保存到这台电脑；不会同步到微信读书或发送给模型。';
        }catch(error){if(!disposed && at===revision)responseStatus.textContent=error.message;}
      },editor);
      try {
        const data=await send({type:'note-get',text:textarea.value});
        if(!disposed && at===revision && !note.value)note.value=data.note||'';
      }catch(error){if(!disposed && at===revision)responseStatus.textContent=error.message;}
    });
    button('自由提问',()=>{
      clearAnswer();editor.replaceChildren();responseStatus.textContent='';
      const question=document.createElement('textarea');question.setAttribute('aria-label','想问的问题');
      question.placeholder='关于这段，你想了解什么？';question.maxLength=1500;question.style.height='90px';editor.append(question);
      question.addEventListener('input',()=>{clearAnswer();},{signal:lifecycle.signal});
      const submit=button('发送问题',()=>run('question',question.value),editor);modelButtons.push(submit);
    });
    section.append(actions,editor,responseStatus,answer,sources);
  }
  const notice = document.createElement('p');
  notice.className='notice';
  notice.textContent = '取文只读取一次，不自动上传。点击“看懂这段”或“发送问题”才将当前原文、书名和问题经本机服务发送给项目配置的模型。批注仅在点保存时留在本机。复制会替换剪贴板，其他程序同时复制仍可能影响结果。';
  const close = document.createElement('button');
  close.textContent = '关闭并清空';
  close.onclick = dispose;
  section.append(notice, close);
  root.append(style, section);
  document.documentElement.append(host);
})();
