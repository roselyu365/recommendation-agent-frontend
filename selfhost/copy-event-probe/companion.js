(() => {
  function createSession(send) {
    let text = '', revision = 0, closed = false, busy = false;
    return {
      edit(value) { text = value; revision++; },
      close() { closed = true; text = ''; revision++; },
      async ask(mode, book_title, question = '') {
        if (closed) throw Error('面板已关闭');
        if (busy) throw Error('正在生成，请稍候');
        if (!['understand','question'].includes(mode)) throw Error('不支持的模式');
        if (!text.trim() || text.length > 5000) throw Error('原文请保持在 1–5000 字符');
        if (question.length > 1500 || (mode === 'question' && !question.trim())) throw Error('请填写 1–1500 字的问题');
        const at = revision;
        busy = true;
        try {
          const result = await send({type:'explain', text, book_title:book_title.slice(0,200), mode, question});
          return !closed && revision === at ? result : null;
        } finally { busy = false; }
      }
    };
  }
  if (typeof module !== 'undefined') module.exports = {createSession};
  else globalThis.SHUCompanion = {createSession};
})();
