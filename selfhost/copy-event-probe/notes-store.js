/* One worker owns every note mutation, including management-page requests. */
(() => {
  class NotesError extends Error { constructor(message){super(message);this.name='SHUNotesError';} }
  function createStore(storage) {
    let tail = Promise.resolve();
    const isKey = key => typeof key === 'string' && /^annotation:\/web\/reader\/[^/?#]+$/.test(key);
    const serialize = fn => { const result=tail.then(fn);tail=result.catch(()=>{});return result; };
    async function snapshot() {
      const raw = await storage.get(null), rows=[], keys=[];
      for (const key of Object.keys(raw).filter(isKey).sort()) {
        const records=raw[key];
        if(!Array.isArray(records))throw new NotesError('部分批注格式异常，未修改数据。请先保留插件数据再检查。');
        keys.push(key);
        const seen=new Set();
        for (const row of records) {
          if(!row || typeof row.text!=='string' || !row.text.trim() || row.text.length>5000 ||
             typeof row.note!=='string' || row.note.length>5000 || seen.has(row.text))
            throw new NotesError('部分批注格式异常，未修改数据。请先保留插件数据再检查。');
          seen.add(row.text);
          rows.push({key,text:row.text,note:row.note,book_title:String(row.book_title||'').slice(0,200),updated:String(row.updated||'')});
        }
      }
      const bytes=new TextEncoder().encode(JSON.stringify(rows));
      const digest=await crypto.subtle.digest('SHA-256',bytes);
      const revision=Array.from(new Uint8Array(digest),n=>n.toString(16).padStart(2,'0')).join('');
      return {rows,keys,revision};
    }
    function keyFor(path) { const key='annotation:'+path;if(!isKey(key))throw new NotesError('书籍地址格式不正确');return key; }
    return {
      list: () => serialize(async()=>{const {rows,revision}=await snapshot();return {notes:rows,revision};}),
      get: (path,text) => serialize(async()=>{
        const key=keyFor(path), data=await storage.get(key), notes=data[key]||[];
        return {note:notes.find(n=>n.text===text)?.note||''};
      }),
      save: (path,record) => serialize(async()=>{
        const key=keyFor(path);
        if(typeof record.text!=='string'||!record.text.trim()||record.text.length>5000||
           typeof record.note!=='string'||!record.note.trim()||record.note.length>5000)
          throw new NotesError('原文和批注请保持在1–5000字符');
        const data=await storage.get(key),notes=data[key]||[];
        if(!Array.isArray(notes))throw new NotesError('本书批注格式异常，未覆盖原数据');
        const rest=notes.filter(n=>n.text!==record.text);
        if(rest.length>=200)throw new NotesError('本书已保存200条批注，请到“我的批注”导出后删除不需要的记录。');
        await storage.set({[key]:[...rest,{text:record.text,note:record.note,book_title:String(record.book_title||'').slice(0,200),updated:new Date().toISOString()}]});
        return {saved:true};
      }),
      remove: (key,text,expected) => serialize(async()=>{
        if(!isKey(key)||typeof text!=='string')throw new NotesError('批注位置不正确');
        const state=await snapshot();
        if(state.revision!==expected)throw new NotesError('批注刚刚发生变化，请刷新列表后重新确认。');
        if(!state.rows.some(row=>row.key===key&&row.text===text))throw new NotesError('批注已不存在，请刷新列表。');
        const data=await storage.get(key),rest=data[key].filter(n=>n.text!==text);
        if(rest.length)await storage.set({[key]:rest});else await storage.remove(key);
        return {deleted:1};
      }),
      clear: expected => serialize(async()=>{
        const state=await snapshot();
        if(state.revision!==expected)throw new NotesError('批注刚刚发生变化，请刷新列表后重新确认。');
        if(state.keys.length)await storage.remove(state.keys);
        return {deleted:state.rows.length};
      })
    };
  }
  const api={createStore};
  if(typeof module!=='undefined')module.exports=api;else globalThis.SHUNotes=api;
})();
