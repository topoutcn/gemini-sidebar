// MAIN world 脚本 - 在 Gemini 页面 JS 执行前注入
// 1. 强制 shadow DOM 为 open
// 2. 监听 postMessage 接收注入请求

const script = document.createElement('script');
script.textContent = `
(function() {
  // 强制 shadow DOM open
  const origAttachShadow = Element.prototype.attachShadow;
  Element.prototype.attachShadow = function(init) {
    return origAttachShadow.call(this, { ...init, mode: 'open' });
  };

  // 监听来自侧边栏的 postMessage
  window.addEventListener('message', function(event) {
    if (event.data && event.data.type === 'GEMINI_SIDEBAR_INJECT') {
      console.log('[Gemini Sidebar MAIN] Received inject request');
      setTimeout(function() { injectAndSend(event.data.text); }, 500);
    }
    if (event.data && event.data.type === 'GEMINI_SIDEBAR_PING') {
      window.parent.postMessage({ type: 'GEMINI_SIDEBAR_PONG' }, '*');
    }
  });

  function injectAndSend(text) {
    var input = findInput(document.body);
    if (!input) {
      console.log('[Gemini Sidebar MAIN] Input not found, dumping DOM info...');
      // 打印所有 contenteditable 和 textarea
      document.querySelectorAll('[contenteditable], textarea, input[type="text"]').forEach(function(el) {
        console.log('[Gemini Sidebar MAIN] Found editable:', el.tagName, el.className, el.getAttribute('contenteditable'), 'visible:', el.offsetWidth > 0);
      });
      // 也检查 shadow roots
      scanShadowRoots(document.body, 0);
      return;
    }

    console.log('[Gemini Sidebar MAIN] Found input:', input.tagName, input.className);
    input.focus();

    // 清空现有内容
    if (input.tagName === 'TEXTAREA' || input.tagName === 'INPUT') {
      input.value = '';
    } else {
      input.textContent = '';
    }

    // 使用 execCommand 插入文本（最兼容 Angular/React）
    document.execCommand('insertText', false, text);

    // 如果 execCommand 没生效，手动设置
    var currentText = input.tagName === 'TEXTAREA' ? input.value : input.textContent;
    if (!currentText || currentText.length < 10) {
      if (input.tagName === 'TEXTAREA' || input.tagName === 'INPUT') {
        input.value = text;
        input.dispatchEvent(new Event('input', { bubbles: true }));
      } else {
        input.textContent = text;
        input.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: text }));
      }
    }

    console.log('[Gemini Sidebar MAIN] Text injected, waiting for user to send');
    window.parent.postMessage({ type: 'GEMINI_SIDEBAR_INJECTED' }, '*');
  }

  function findInput(root) {
    // 直接搜索
    var selectors = [
      'div.ql-editor[contenteditable="true"]',
      'rich-textarea div[contenteditable="true"]',
      'div[contenteditable="true"][role="textbox"]',
      'div[contenteditable="true"][aria-label]',
      'div[contenteditable="true"]',
      'textarea[aria-label]',
      'textarea',
    ];
    for (var i = 0; i < selectors.length; i++) {
      var el = root.querySelector(selectors[i]);
      if (el && el.offsetWidth > 0 && el.offsetHeight > 0) return el;
    }
    // 搜索 shadow roots
    var all = root.querySelectorAll('*');
    for (var j = 0; j < all.length; j++) {
      if (all[j].shadowRoot) {
        var found = findInput(all[j].shadowRoot);
        if (found) return found;
      }
    }
    return null;
  }

  function findSendBtn(root) {
    var buttons = root.querySelectorAll('button');
    for (var i = 0; i < buttons.length; i++) {
      var btn = buttons[i];
      var aria = (btn.getAttribute('aria-label') || '').toLowerCase();
      var tooltip = (btn.getAttribute('mattooltip') || '').toLowerCase();
      var dataId = (btn.getAttribute('data-test-id') || '').toLowerCase();
      if (aria.includes('send') || aria.includes('发送') || aria.includes('submit') ||
          tooltip.includes('send') || tooltip.includes('发送') ||
          dataId.includes('send')) {
        if (btn.offsetWidth > 0 && !btn.disabled) return btn;
      }
    }
    var all = root.querySelectorAll('*');
    for (var j = 0; j < all.length; j++) {
      if (all[j].shadowRoot) {
        var found = findSendBtn(all[j].shadowRoot);
        if (found) return found;
      }
    }
    return null;
  }

  function scanShadowRoots(root, depth) {
    if (depth > 5) return;
    var all = root.querySelectorAll('*');
    for (var i = 0; i < all.length; i++) {
      if (all[i].shadowRoot) {
        console.log('[Gemini Sidebar MAIN] Shadow root at depth ' + depth + ':', all[i].tagName, all[i].className);
        // 检查 shadow root 内的可编辑元素
        var editables = all[i].shadowRoot.querySelectorAll('[contenteditable], textarea, input');
        editables.forEach(function(el) {
          console.log('[Gemini Sidebar MAIN]   -> editable:', el.tagName, el.className, 'visible:', el.offsetWidth > 0);
        });
        scanShadowRoots(all[i].shadowRoot, depth + 1);
      }
    }
  }
})();
`;
(document.head || document.documentElement).appendChild(script);
script.remove();
