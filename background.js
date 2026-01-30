// 创建右键菜单
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'send-to-gemini',
    title: '发送选中文本到 Gemini',
    contexts: ['selection']
  });

  chrome.contextMenus.create({
    id: 'summarize-page',
    title: '用 Gemini 总结此页面',
    contexts: ['page']
  });
});

// 点击扩展图标时打开侧边栏
chrome.action.onClicked.addListener((tab) => {
  chrome.sidePanel.open({ tabId: tab.id });
});

// 当标签页切换或更新时，自动提取页面内容并推送给 Gemini iframe
chrome.tabs.onActivated.addListener(async (activeInfo) => {
  const tab = await chrome.tabs.get(activeInfo.tabId);
  if (tab.url) {
    autoExtractAndPush(tab);
  }
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.active) {
    autoExtractAndPush(tab);
  }
});

async function autoExtractAndPush(tab) {
  if (!tab.url || tab.url.startsWith('chrome') || tab.url.includes('gemini.google.com')) {
    // 清除旧缓存，避免侧边栏显示上一个页面的内容
    await chrome.storage.session.remove('currentPageContext');
    chrome.runtime.sendMessage({ action: 'pageContextCleared' }).catch(() => {});
    return;
  }
  let content = null;
  // 先尝试发消息
  try {
    content = await chrome.tabs.sendMessage(tab.id, { action: 'extractContent' });
  } catch (e) {
    // content script 未注入，动态注入
    try {
      const isYouTube = tab.url.includes('youtube.com/watch');
      const files = isYouTube
        ? ['content-script.js', 'youtube-content-script.js']
        : ['content-script.js'];
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: files
      });
      await new Promise(r => setTimeout(r, 300));
      content = await chrome.tabs.sendMessage(tab.id, { action: 'extractContent' });
    } catch (e2) {}
  }
  if (content) {
    await chrome.storage.session.set({ currentPageContext: content });
    chrome.runtime.sendMessage({ action: 'pageContextUpdated', context: content }).catch(() => {});
  }
}

function broadcastToGemini(message) {
  // 通过 runtime 广播（会到达所有 content script，包括 iframe 里的）
  chrome.runtime.sendMessage(message).catch(() => {});
  // 也向所有 Gemini 标签页发
  chrome.tabs.query({ url: 'https://gemini.google.com/*' }, (tabs) => {
    tabs.forEach(tab => {
      chrome.tabs.sendMessage(tab.id, message).catch(() => {});
    });
  });
}

// 右键菜单处理
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === 'send-to-gemini') {
    await chrome.storage.session.set({
      extractedContent: {
        type: 'selection',
        text: info.selectionText,
        url: tab.url,
        title: tab.title
      }
    });
    chrome.sidePanel.open({ tabId: tab.id });
  } else if (info.menuItemId === 'summarize-page') {
    try {
      const response = await chrome.tabs.sendMessage(tab.id, { action: 'extractContent' });
      if (response) {
        await chrome.storage.session.set({
          extractedContent: { ...response, type: 'summarize' }
        });
        chrome.sidePanel.open({ tabId: tab.id });
      }
    } catch (e) {
      console.error('Failed to extract content:', e);
    }
  }
});

// 消息路由
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'fetchUrl') {
    // 代理 fetch 请求，background 有完整网络权限
    const fetchOptions = message.options || {};
    if (!fetchOptions.headers) fetchOptions.headers = {};
    if (message.url.includes('youtube.com')) {
      fetchOptions.headers['Referer'] = 'https://www.youtube.com/';
      fetchOptions.headers['Origin'] = 'https://www.youtube.com';
    }
    fetch(message.url, fetchOptions)
      .then(async (resp) => {
        const text = await resp.text();
        console.log('[Gemini Sidebar BG] fetchUrl:', message.url.substring(0, 80), 'status:', resp.status, 'length:', text.length);
        if (text.length === 0) {
          console.log('[Gemini Sidebar BG] Empty response, headers:', JSON.stringify(Object.fromEntries(resp.headers.entries())));
        }
        sendResponse({ text });
      })
      .catch(err => {
        console.log('[Gemini Sidebar BG] fetchUrl error:', err);
        sendResponse({ text: '' });
      });
    return true;
  } else if (message.action === 'saveContent') {
    chrome.storage.session.set({ extractedContent: message.data });
    sendResponse({ success: true });
  } else if (message.action === 'getContent') {
    chrome.storage.session.get('extractedContent', (result) => {
      sendResponse(result.extractedContent || null);
    });
    return true;
  } else if (message.action === 'clearContent') {
    chrome.storage.session.remove('extractedContent');
    sendResponse({ success: true });
  } else if (message.action === 'getPageContext') {
    // Gemini inject 脚本请求当前页面上下文
    chrome.storage.session.get('currentPageContext', (result) => {
      sendResponse(result.currentPageContext || null);
    });
    return true;
  } else if (message.action === 'sendToGeminiFrame') {
    broadcastToGemini({ action: 'injectToGemini', text: message.text });
    sendResponse({ success: true });
  } else if (message.action === 'extractFromTab') {
    // 查询所有窗口的活动标签，找到真正的用户网页
    chrome.tabs.query({ active: true }, async (allTabs) => {
      // 按 lastAccessed 排序，最近访问的排前面
      allTabs.sort((a, b) => (b.lastAccessed || 0) - (a.lastAccessed || 0));
      // 过滤掉 chrome:// 和扩展页面，找到真正的网页标签
      let tab = allTabs.find(t => t.url && !t.url.startsWith('chrome') && !t.url.includes('gemini.google.com'));
      if (!tab) tab = allTabs[0];
      if (!tab) { sendResponse(null); return; }
      // 先尝试发消息给已有的 content script
      try {
        const response = await chrome.tabs.sendMessage(tab.id, {
          action: message.extractAction || 'extractContent'
        });
        if (response) { sendResponse(response); return; }
      } catch (e) {
        // content script 未注入，使用动态注入
      }
      // Fallback: 动态注入提取脚本
      try {
        const isYouTube = tab.url && tab.url.includes('youtube.com/watch');
        const files = isYouTube
          ? ['content-script.js', 'youtube-content-script.js']
          : ['content-script.js'];
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: files
        });
        // 注入后再次尝试提取
        await new Promise(r => setTimeout(r, 300));
        const response = await chrome.tabs.sendMessage(tab.id, {
          action: message.extractAction || 'extractContent'
        });
        sendResponse(response || null);
      } catch (e2) {
        sendResponse(null);
      }
    });
    return true;
  }
});
