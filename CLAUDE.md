# CLAUDE.md

## 项目概述
Chrome MV3 扩展，在浏览器侧边栏嵌入 Google Gemini（iframe），用户用自己的 Google 账号，无需 API Key。支持提取当前页面内容自动注入 Gemini 输入框。

## 关键架构
- `background.js` — 消息路由中心，标签页监听，动态脚本注入，代理 fetch 请求
- `sidepanel.js` — 侧边栏 UI 逻辑，两排按钮（分析此页/翻译/译视频 + 清空输入框/清屏/Gems），每次点击实时提取内容
- `content-script.js` — 通用网页内容提取，YouTube watch 页面让给 youtube-content-script 处理
- `youtube-content-script.js` — YouTube 视频元数据提取（标题、频道、描述、评论）+ 自动展开转录面板提取字幕
- `youtube-page-script.js` — MAIN world 脚本，访问 YouTube 播放器内部 API
- `gemini-early-inject.js` — MAIN world，patch attachShadow 为 open 模式，监听 postMessage 注入文本
- `gemini-inject.js` — ISOLATED world，Shadow DOM 遍历查找输入框，备用注入路径
- `rules.json` — declarativeNetRequest 规则，移除 gemini.google.com 的 X-Frame-Options 和 CSP

## 重要设计决策
- **不自动发送** — 注入 Gemini 输入框后不点击发送按钮，让用户自己配置 Gemini 选项后手动回车
- **工具栏在底部** — 用户要求放在屏幕下方方便点击
- **视频/非视频 prompt 区分** — YouTube 和 X/Twitter 页面 prompt 带"并附上时间帧码"，其他网页不带
- **标签页查询** — 用 `chrome.tabs.query({ active: true })` 查所有窗口，按 lastAccessed 排序，过滤 chrome:// 和 Gemini 页面
- **切换标签清缓存** — 切换到内部页面时清除 currentPageContext，避免侧边栏显示旧内容
- **每次按钮点击实时提取** — `freshExtractAndDo()` 不用缓存，避免读到旧页面内容
- **右键菜单选中文本** — 只发送原文到输入框，不附加来源/链接等额外内容
- **刷新插件按钮** — 调用 `chrome.runtime.reload()`，开发阶段免去手动去扩展管理页面刷新
- **清空输入框** — 通过 postMessage 发送 `GEMINI_SIDEBAR_CLEAR` 给 MAIN world 脚本清除 Gemini 输入框

## 已知问题
- **YouTube 字幕 API 不可用** — timedtext API 对扩展请求返回空内容，get_transcript innertube API 返回 400。当前通过「译视频」按钮自动点击页面上的「内容转文字」按钮展开转录面板读取字幕，不依赖 API。无字幕的视频会提示失败。
- **Gemini Shadow DOM** — Gemini 用 closed shadow DOM，必须在 document_start 阶段通过 MAIN world 脚本 monkey-patch attachShadow 强制 open 模式。

## 开发注意事项
- 修改 manifest.json 中的 content_scripts 后，需要在 chrome://extensions 刷新扩展
- MAIN world 脚本修改后，需要 Cmd+Shift+R 强制刷新目标页面才能加载新代码
- background.js 有 `fetchUrl` 消息处理器，可代理 fetch 请求（带 YouTube Referer/Origin 头）
- YouTube 页面是 SPA，script 标签中的 ytInitialPlayerResponse 不随导航更新
