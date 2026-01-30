// YouTube 专用内容提取
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'extractContent' || message.action === 'extractYouTube') {
    extractYouTubeContent().then(sendResponse);
    return true;
  }
  if (message.action === 'extractTranscript') {
    openAndReadTranscript().then(sendResponse);
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

// 自动展开转录面板并读取字幕
async function openAndReadTranscript() {
  const titleEl = document.querySelector('h1.ytd-watch-metadata yt-formatted-string, h1.title');
  const title = titleEl?.textContent?.trim() || document.title;

  // 1. 如果转录面板已经有数据，直接返回
  const existing = readTranscriptPanel();
  if (existing) {
    return { transcript: existing, title, url: window.location.href };
  }

  try {
    // 2. 展开描述区的「...更多」
    const moreBtn = document.querySelector('tp-yt-paper-button#expand, #expand[role="button"], ytd-text-inline-expander #expand');
    if (moreBtn) {
      moreBtn.click();
      await new Promise(r => setTimeout(r, 500));
    }

    // 3. 找到并点击「内容转文字」/「Show transcript」按钮
    const transcriptBtnSelectors = [
      'ytd-video-description-transcript-section-renderer button',
      'ytd-video-description-transcript-section-renderer #button',
    ];
    let clicked = false;
    for (const sel of transcriptBtnSelectors) {
      const btn = document.querySelector(sel);
      if (btn) {
        btn.click();
        clicked = true;
        break;
      }
    }

    // 备选：遍历描述区按钮找包含「转文字」或「transcript」的
    if (!clicked) {
      const allButtons = document.querySelectorAll('ytd-watch-metadata button, ytd-watch-metadata #button, #description button');
      for (const btn of allButtons) {
        const text = btn.textContent?.trim()?.toLowerCase() || '';
        if (text.includes('转文字') || text.includes('transcript') || text.includes('显示转录')) {
          btn.click();
          clicked = true;
          break;
        }
      }
    }

    if (!clicked) {
      return { error: '找不到「内容转文字」按钮，该视频可能不支持转录' };
    }

    // 4. 轮询等待转录内容出现
    for (let i = 0; i < 20; i++) {
      await new Promise(r => setTimeout(r, 500));
      const transcript = readTranscriptPanel();
      if (transcript) {
        return { transcript, title, url: window.location.href };
      }
    }

    return { error: '转录面板已打开但未能读取到字幕内容' };
  } catch (e) {
    return { error: `提取字幕时出错: ${e.message}` };
  }
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
