const contextInfo = document.getElementById('context-info');
const contextActions = document.getElementById('context-actions');
const contextIcon = document.getElementById('context-icon');
const contextTitle = document.getElementById('context-title');
const noContext = document.getElementById('no-context');
const toast = document.getElementById('toast');
const geminiFrame = document.getElementById('gemini-frame');

let currentContent = null;

async function getSettings() {
  return chrome.storage.sync.get({
    geminiUrl: 'https://gemini.google.com/app',
    youtubeEnhanced: true
  });
}

(async () => {
  const settings = await getSettings();
  geminiFrame.src = settings.geminiUrl;
  requestExtract();
})();

// 监听 background 推送
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'pageContextUpdated' && message.context) {
    currentContent = message.context;
    showContextBar(currentContent);
    sendResponse({ success: true });
  } else if (message.action === 'pageContextCleared') {
    currentContent = null;
    noContext.classList.remove('hidden');
    contextInfo.classList.add('hidden');
    contextActions.classList.add('hidden');
    noContext.querySelector('span').textContent = '🔄 切换到新页面，点击下方按钮提取内容';
    sendResponse({ success: true });
  }
});

chrome.storage.session.onChanged.addListener((changes) => {
  if (changes.currentPageContext) {
    if (changes.currentPageContext.newValue) {
      currentContent = changes.currentPageContext.newValue;
      showContextBar(currentContent);
    } else {
      // 被清除了（切换到新标签页等）
      currentContent = null;
      noContext.classList.remove('hidden');
      contextInfo.classList.add('hidden');
      contextActions.classList.add('hidden');
    }
  }
});

document.getElementById('btn-manual-extract').addEventListener('click', requestExtract);

// 每次点击按钮都实时提取当前页面，避免读到旧内容
async function freshExtractAndDo(callback) {
  showToast('⏳ 正在提取当前页面...');
  const content = await new Promise(resolve => {
    chrome.runtime.sendMessage({ action: 'extractFromTab', extractAction: 'extractContent' }, resolve);
  });
  if (!content) {
    showToast('❌ 无法提取当前页面内容');
    return;
  }
  currentContent = content;
  showContextBar(content);
  callback(content);
}

// 分析此页：发送完整页面内容 + URL
document.getElementById('btn-ask').addEventListener('click', () => {
  freshExtractAndDo((content) => {
    if (content.type === 'pdf') {
      sendTextToGemini(`请分析这个 PDF 文档：${content.url}`);
    } else {
      const isVideo = content.type === 'youtube' || (content.url && (content.url.includes('youtube.com/watch') || content.url.includes('x.com') || content.url.includes('twitter.com')));
      const prompt = isVideo
        ? '请详细分析以下视频内容，并附上时间帧码：'
        : '请详细分析以下网页内容：';
      sendTextToGemini(formatForPrompt(content, prompt));
    }
  });
});

// 总结：只发送正文摘要
document.getElementById('btn-summarize').addEventListener('click', () => {
  freshExtractAndDo((content) => {
    const summary = (content.text || '').substring(0, 5000);
    sendTextToGemini(`请用简洁的要点总结以下内容：\n\n---\n标题: ${content.title}\n链接: ${content.url}\n\n${summary}`);
  });
});

// 翻译：发送正文
document.getElementById('btn-translate').addEventListener('click', () => {
  freshExtractAndDo((content) => {
    sendTextToGemini(formatForPrompt(content, '请将以下内容翻译成中文：'));
  });
});

document.getElementById('btn-clear').addEventListener('click', () => {
  geminiFrame.contentWindow.postMessage({ type: 'GEMINI_SIDEBAR_CLEAR' }, '*');
  chrome.runtime.sendMessage({ action: 'sendToGeminiFrame', text: '', clear: true });
  showToast('已发送清空指令');
});

document.getElementById('btn-reset').addEventListener('click', async () => {
  const settings = await getSettings();
  geminiFrame.src = settings.geminiUrl;
  showToast('Gemini 已清屏');
});

document.getElementById('btn-reload-ext').addEventListener('click', () => {
  chrome.runtime.reload();
});

document.getElementById('btn-settings').addEventListener('click', () => {
  chrome.tabs.create({ url: 'settings.html' });
});

// 监听 iframe 回传消息
window.addEventListener('message', (event) => {
  if (event.data?.type === 'GEMINI_SIDEBAR_INJECTED') {
    showToast('✅ 已填入 Gemini 输入框，请检查后按回车发送');
  } else if (event.data?.type === 'GEMINI_SIDEBAR_PONG') {
    console.log('[Sidebar] Gemini iframe is connected');
  }
});

// 核心：发送内容到 Gemini
async function sendTextToGemini(text) {
  // 方式1: 直接通过 postMessage 发送给 iframe (MAIN world 脚本监听)
  geminiFrame.contentWindow.postMessage({
    type: 'GEMINI_SIDEBAR_INJECT',
    text: text
  }, '*');

  // 方式2: 同时通过 background 广播
  chrome.runtime.sendMessage({
    action: 'sendToGeminiFrame',
    text: text
  });

  // 方式3: 复制到剪贴板作为兜底
  try {
    await navigator.clipboard.writeText(text);
  } catch (e) {}

  showToast('⏳ 正在发送到 Gemini...如未自动填入，请按 Cmd+V 粘贴');
}

function requestExtract() {
  noContext.classList.remove('hidden');
  contextInfo.classList.add('hidden');
  contextActions.classList.add('hidden');
  chrome.runtime.sendMessage({ action: 'extractFromTab', extractAction: 'extractContent' }, (response) => {
    if (response) {
      currentContent = response;
      showContextBar(currentContent);
    } else {
      noContext.querySelector('span').textContent = '❌ 无法提取此页面内容';
    }
  });
}

function showContextBar(content) {
  noContext.classList.add('hidden');
  contextInfo.classList.remove('hidden');
  contextActions.classList.remove('hidden');
  toast.classList.add('hidden');

  if (content.type === 'youtube') {
    contextIcon.textContent = '🎬';
    contextTitle.textContent = content.title || 'YouTube 视频';
  } else if (content.type === 'pdf') {
    contextIcon.textContent = '📑';
    contextTitle.textContent = content.title || 'PDF 文档';
  } else {
    contextIcon.textContent = '📄';
    contextTitle.textContent = content.title || '网页';
  }
}

function showToast(msg) {
  toast.textContent = msg;
  toast.style.background = '#137333';
  toast.classList.remove('hidden');
  setTimeout(() => toast.classList.add('hidden'), 5000);
}

function formatContent(content) {
  if (!content) return '';
  if (content.type === 'youtube') {
    let text = `[YouTube 视频]\n标题: ${content.title}\n`;
    if (content.channel) text += `频道: ${content.channel}\n`;
    if (content.duration) text += `时长: ${content.duration}\n`;
    text += `链接: ${content.url}\n`;
    if (content.description) text += `\n描述:\n${content.description}\n`;
    if (content.captions) text += `\n字幕内容:\n${content.captions}\n`;
    if (content.comments && content.comments.length > 0) {
      text += `\n热门评论:\n`;
      content.comments.forEach((c, i) => { text += `${i + 1}. ${c}\n`; });
    }
    return text;
  }
  return `[网页内容]\n标题: ${content.title}\n链接: ${content.url}\n\n${content.text}`;
}

function formatForPrompt(content, prompt) {
  return `${prompt}\n\n---\n${formatContent(content)}`;
}

// 启动时检查待处理内容
chrome.runtime.sendMessage({ action: 'getContent' }, (content) => {
  if (content) {
    handlePendingContent(content);
  }
});

// 监听后续右键菜单触发（侧边栏已打开的情况）
chrome.storage.session.onChanged.addListener((changes) => {
  if (changes.extractedContent?.newValue) {
    handlePendingContent(changes.extractedContent.newValue);
  }
});

function handlePendingContent(content) {
  currentContent = content;
  showContextBar(content);

  if (content.type === 'selection') {
    // 右键菜单：直接发送选中文本
    sendTextToGemini(content.text);
  } else if (content.type === 'summarize') {
    sendTextToGemini(formatForPrompt(content, '请总结以下内容的要点：'));
  } else {
    sendTextToGemini(formatForPrompt(content, '请详细分析以下网页内容：'));
  }

  chrome.runtime.sendMessage({ action: 'clearContent' });
}
