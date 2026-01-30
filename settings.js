const geminiUrlInput = document.getElementById('gemini-url');
const youtubeEnhanced = document.getElementById('youtube-enhanced');
const extractMode = document.getElementById('extract-mode');
const btnSave = document.getElementById('btn-save');
const savedMsg = document.getElementById('saved-msg');

// 加载设置
chrome.storage.sync.get({
  geminiUrl: 'https://gemini.google.com/app',
  youtubeEnhanced: true,
  extractMode: 'full'
}, (settings) => {
  geminiUrlInput.value = settings.geminiUrl;
  youtubeEnhanced.checked = settings.youtubeEnhanced;
  extractMode.value = settings.extractMode;
});

// 保存
btnSave.addEventListener('click', () => {
  chrome.storage.sync.set({
    geminiUrl: geminiUrlInput.value.trim() || 'https://gemini.google.com/app',
    youtubeEnhanced: youtubeEnhanced.checked,
    extractMode: extractMode.value
  }, () => {
    savedMsg.style.display = 'inline';
    setTimeout(() => { savedMsg.style.display = 'none'; }, 2000);
  });
});
