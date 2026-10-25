importScripts('notes-store.js','bridge.js');
chrome.action.onClicked.addListener(async tab => {
  const url = new URL(tab.url || 'about:blank');
  if (url.origin !== 'https://weread.qq.com' || !url.pathname.startsWith('/web/reader/')) {
    await chrome.action.setBadgeText({tabId: tab.id, text: '读书'});
    return;
  }
  let stage = '加载取文逻辑';
  try {
    await chrome.scripting.executeScript({
      target: {tabId: tab.id},
      world: 'ISOLATED',
      files: ['core.js', 'companion.js']
    });
    stage = '启动页面面板';
    await chrome.scripting.executeScript({
      target: {tabId: tab.id},
      world: 'ISOLATED',
      files: ['probe.js']
    });
    stage = '更新按钮状态';
    await chrome.action.setBadgeText({tabId: tab.id, text: ''});
    await chrome.action.setTitle({tabId: tab.id, title: '验证本次选段取文'});
  } catch (error) {
    // Diagnostic contains only the API error, never copied text or clipboard data.
    const reason = String(error?.message || '未知错误').slice(0, 220);
    await chrome.action.setBadgeText({tabId: tab.id, text: '失败'});
    await chrome.action.setTitle({tabId: tab.id, title: `${stage}失败：${reason}`});
  }
});
