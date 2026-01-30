// 注入到 Gemini iframe，操作其输入框

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'injectToGemini') {
    console.log('[Gemini Sidebar] Received inject request, text length:', message.text.length);
    injectText(message.text);
    sendResponse({ success: true });
  }
  return true;
});

function injectText(text, retryCount = 0) {
  const inputEl = findInputElement();
  if (!inputEl) {
    console.log('[Gemini Sidebar] Input not found, retry:', retryCount);
    if (retryCount < 5) {
      setTimeout(() => injectText(text, retryCount + 1), 1000);
    }
    return;
  }

  console.log('[Gemini Sidebar] Found input element:', inputEl.tagName, inputEl.className);
  fillInput(inputEl, text);
}

function findInputElement() {
  // 1. 先在普通 DOM 中找
  const normalSelectors = [
    '.ql-editor',
    'div[contenteditable="true"]',
    'rich-textarea div[contenteditable="true"]',
    'textarea[placeholder]',
    'textarea',
  ];

  for (const sel of normalSelectors) {
    const el = document.querySelector(sel);
    if (el && isVisible(el)) return el;
  }

  // 2. 穿透 shadow DOM 搜索
  const shadowResult = deepQuerySelector(document.body, [
    'div[contenteditable="true"]',
    'textarea',
    '.ql-editor',
  ]);
  if (shadowResult) return shadowResult;

  return null;
}

// 递归穿透 shadow DOM 查找元素
function deepQuerySelector(root, selectors) {
  // 先在当前层级找
  for (const sel of selectors) {
    const el = root.querySelector(sel);
    if (el && isVisible(el)) return el;
  }

  // 遍历所有元素，检查 shadow root
  const allElements = root.querySelectorAll('*');
  for (const el of allElements) {
    if (el.shadowRoot) {
      const found = deepQuerySelector(el.shadowRoot, selectors);
      if (found) return found;
    }
  }

  return null;
}

function isVisible(el) {
  const rect = el.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0;
}

function fillInput(el, text) {
  el.focus();

  if (el.tagName === 'TEXTAREA' || el.tagName === 'INPUT') {
    // 用原生 setter 绕过框架
    const proto = el.tagName === 'TEXTAREA'
      ? HTMLTextAreaElement.prototype
      : HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
    if (setter) {
      setter.call(el, text);
    } else {
      el.value = text;
    }
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  } else {
    // contenteditable - 用 execCommand 更可靠
    el.focus();
    el.innerHTML = '';

    // 方法1: execCommand (更能触发框架的事件监听)
    try {
      document.execCommand('selectAll', false, null);
      document.execCommand('insertText', false, text);
    } catch (e) {
      // 方法2: 手动设置内容
      const lines = text.split('\n');
      lines.forEach(line => {
        const p = document.createElement('p');
        p.textContent = line || '\u200B';
        el.appendChild(p);
      });
    }

    // 触发各种事件确保框架感知
    el.dispatchEvent(new InputEvent('input', {
      bubbles: true, cancelable: true, inputType: 'insertText', data: text
    }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    // Angular 用的事件
    el.dispatchEvent(new Event('blur', { bubbles: true }));
    el.dispatchEvent(new Event('focus', { bubbles: true }));
  }

  console.log('[Gemini Sidebar] Text injected successfully');
}

function clickSend() {
  // 在普通 DOM 和 shadow DOM 中找发送按钮
  const btn = findSendButton(document.body);
  if (btn && !btn.disabled) {
    console.log('[Gemini Sidebar] Clicking send button');
    btn.click();
  } else {
    console.log('[Gemini Sidebar] Send button not found or disabled');
  }
}

function findSendButton(root) {
  // 搜索策略：aria-label 包含 send/发送
  const buttons = root.querySelectorAll('button');
  for (const btn of buttons) {
    const aria = (btn.getAttribute('aria-label') || '').toLowerCase();
    const matTooltip = (btn.getAttribute('mattooltip') || '').toLowerCase();
    if (aria.includes('send') || aria.includes('发送') || aria.includes('submit') ||
        matTooltip.includes('send') || matTooltip.includes('发送')) {
      if (isVisible(btn)) return btn;
    }
  }

  // 搜索 shadow DOM
  const allElements = root.querySelectorAll('*');
  for (const el of allElements) {
    if (el.shadowRoot) {
      const found = findSendButton(el.shadowRoot);
      if (found) return found;
    }
  }

  return null;
}
