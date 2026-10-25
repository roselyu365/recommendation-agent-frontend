(() => {
  const publicRow=row=>({book_path:row.key.replace(/^annotation:/,''),book_title:row.book_title,text:row.text,note:row.note,updated:row.updated});
  const escape=value=>String(value||'').replace(/[\\`*_{}\[\]()#+.!|<>-]/g,'\\$&');
  function exportNotes(rows,format,date=new Date().toISOString()){
    const notes=rows.map(publicRow);
    if(format==='json')return JSON.stringify({format:'shu-reader-notes',version:1,exported_at:date,notes},null,2);
    if(format!=='markdown')throw Error('不支持的导出格式');
    return '# 我的阅读批注\n\n导出时间：'+date+'\n\n'+notes.map(row=>'## '+escape(row.book_title||'未命名作品')+'\n\n'+row.text.split('\n').map(line=>'> '+escape(line)).join('\n')+'\n\n'+escape(row.note)+'\n\n记录时间：'+escape(row.updated)+'\n').join('\n---\n\n');
  }
  const api={exportNotes};if(typeof module!=='undefined')module.exports=api;else globalThis.SHUNotesFormat=api;
})();
