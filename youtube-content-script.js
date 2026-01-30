// YouTube 专用内容提取
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'extractContent' || message.action === 'extractYouTube') {
    extractYouTubeContent().then(sendResponse);
    return true;
  }
});

async function extractYouTubeContent() {
  const videoId = new URLSearchParams(window.location.search).get('v');
  if (!videoId) {
    return { type: 'page', title: document.title, url: window.location.href, text: document.body.innerText.substring(0, 5000) };
  }

  const info = {
    type: 'youtube',
    videoId,
    url: window.location.href,
    title: '',
    channel: '',
    description: '',
    duration: '',
    captions: '',
    comments: []
  };

  const titleEl = document.querySelector('h1.ytd-watch-metadata yt-formatted-string, h1.title');
  info.title = titleEl?.textContent?.trim() || document.title;

  const channelEl = document.querySelector('#channel-name yt-formatted-string a, ytd-channel-name yt-formatted-string a');
  info.channel = channelEl?.textContent?.trim() || '';

  const descEl = document.querySelector('#description-inner, ytd-text-inline-expander .content');
  info.description = descEl?.textContent?.trim()?.substring(0, 2000) || '';

  const durationEl = document.querySelector('.ytp-time-duration');
  info.duration = durationEl?.textContent || '';

  // 尝试读取 YouTube 转录面板中已有的字幕
  try {
    info.captions = readTranscriptPanel();
  } catch (e) {}

  const commentEls = document.querySelectorAll('ytd-comment-thread-renderer #content-text');
  info.comments = Array.from(commentEls).slice(0, 10).map(el => el.textContent.trim());

  return info;
}

// 如果用户已经打开了转录面板，直接读取
function readTranscriptPanel() {
  const segments = document.querySelectorAll('ytd-transcript-segment-renderer');
  if (segments.length === 0) return '';

  const lines = [];
  segments.forEach(seg => {
    const timeEl = seg.querySelector('.segment-timestamp, [class*="timestamp"]');
    const textEl = seg.querySelector('.segment-text, [class*="text"]');
    const time = timeEl?.textContent?.trim() || '';
    const text = textEl?.textContent?.trim() || '';
    if (text) {
      lines.push(time ? `${text}（${time}）` : text);
    }
  });

  return lines.length > 0 ? lines.join('\n') : '';
}
