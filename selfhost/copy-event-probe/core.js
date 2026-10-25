/* Chrome content scripts must use a supported JavaScript file extension. */
(() => {
  function captureDuringClick(target, click) {
    let events = 0;
    let text = '';
    let status = 'no-event';
    const receive = event => {
      if (!event.isTrusted) return;
      events++;
      try {
        text = event.clipboardData?.getData('text/plain') || '';
        status = text.trim() ? (text.length > 5000 ? 'too-long' : 'captured') : 'empty-event';
      } catch {
        text = '';
        status = 'unreadable-event';
      }
    };
    // Only the synchronous call stack of our click, not a timed clipboard watcher.
    target.addEventListener('copy', receive);
    try { click(); } catch { status = 'click-failed'; }
    finally { target.removeEventListener('copy', receive); }
    if (events > 1) status = 'ambiguous';
    return { status, text: status === 'captured' ? text : '', events };
  }
  async function readAfterCopy({copy, confirmed, current, read}) {
    const failure = status => ({status, text:'', events:copy.events});
    if (copy.events !== 1 || !['captured', 'empty-event'].includes(copy.status) || !confirmed)
      return failure('copy-unconfirmed');
    if (!current()) return failure('cancelled');
    try {
      const text = await read();
      if (!current()) return failure('cancelled');
      if (typeof text !== 'string' || !text.trim()) return failure('empty-clipboard');
      if (text.length > 5000) return failure('too-long');
      return {status:'captured', text, events:copy.events};
    } catch { return failure('read-failed'); }
  }
  if (typeof module !== 'undefined') module.exports = { captureDuringClick, readAfterCopy };
  else globalThis.SHUCopyEventProbe = { captureDuringClick, readAfterCopy };
})();
