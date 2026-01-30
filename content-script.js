// 通用页面内容提取
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'extractContent') {
    // YouTube 页面交给 youtube-content-script.js 处理
    if (window.location.hostname === 'www.youtube.com' && window.location.pathname === '/watch') {
      return false; // 不处理，让 youtube-content-script 接管
    }
    const content = extractPageContent();
    sendResponse(content);
  }
  return true;
});

function extractPageContent() {
  const url = window.location.href;

  // 优先提取选中文本
  const selection = window.getSelection().toString().trim();
  if (selection) {
    return {
      type: 'selection',
      title: document.title,
      url: url,
      text: selection
    };
  }

  // 检测 PDF 页面（GitHub PDF、直接 PDF 链接等）
  if (isPdfPage(url)) {
    return {
      type: 'pdf',
      title: document.title,
      url: getPdfUrl(url),
      text: `这是一个 PDF 文档。\n\n请通过以下链接访问并分析此 PDF：\n${getPdfUrl(url)}\n\n页面标题: ${document.title}`
    };
  }

  // 提取正文内容
  const body = document.body.cloneNode(true);

  // 移除无关元素
  const removeSelectors = ['script', 'style', 'nav', 'header', 'footer', 'iframe', 'noscript', '.ad', '[role="banner"]', '[role="navigation"]'];
  removeSelectors.forEach(sel => {
    body.querySelectorAll(sel).forEach(el => el.remove());
  });

  // 尝试获取文章主体
  const article = body.querySelector('article, [role="main"], main, .post-content, .article-content, .entry-content');
  const textSource = article || body;

  let text = textSource.innerText || textSource.textContent || '';
  // 清理多余空行
  text = text.replace(/\n{3,}/g, '\n\n').trim();

  // 如果提取到的文本太少，可能是 canvas/动态渲染页面
  if (text.length < 100) {
    return {
      type: 'page',
      title: document.title,
      url: url,
      text: `此页面内容无法直接提取（可能是动态渲染或 PDF）。\n\n页面链接: ${url}\n页面标题: ${document.title}\n\n提取到的少量文本:\n${text}`
    };
  }

  // 限制长度
  const maxLength = 15000;
  if (text.length > maxLength) {
    text = text.substring(0, maxLength) + '\n\n[内容已截断...]';
  }

  return {
    type: 'page',
    title: document.title,
    url: url,
    text: text
  };
}

function isPdfPage(url) {
  // 直接 PDF 链接
  if (url.match(/\.pdf(\?|#|$)/i)) return true;
  // GitHub PDF 查看器
  if (url.includes('github.com') && url.includes('.pdf')) return true;
  // Google Drive PDF
  if (url.includes('drive.google.com') && document.querySelector('embed[type="application/pdf"]')) return true;
  // 页面内嵌 PDF
  if (document.querySelector('embed[type="application/pdf"], object[type="application/pdf"]')) return true;
  return false;
}

function getPdfUrl(url) {
  // GitHub: 转换为 raw 下载链接
  if (url.includes('github.com') && url.includes('/blob/')) {
    return url.replace('github.com', 'raw.githubusercontent.com').replace('/blob/', '/');
  }
  return url;
}
