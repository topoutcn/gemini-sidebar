# 开发日志

## 2026-01-31 v1.0.0 — 初始版本

### 已实现功能

- **侧边栏框架**
  - Chrome Side Panel API 嵌入 Gemini 网页
  - 通过 `declarativeNetRequest` 移除 `X-Frame-Options` 和 `CSP` 头，使 gemini.google.com 可在 iframe 中加载
  - 底部工具栏两排按钮：
    - 第一排：分析此页、总结、翻译
    - 第二排：清空输入框、清屏（重载 Gemini）、刷新插件（免去去扩展管理页面）
  - 设置页面：Gemini URL、YouTube 增强开关、提取范围

- **页面内容提取**
  - 自动提取当前页面标题、URL、正文
  - 智能清理：移除导航、广告、脚本等干扰元素
  - PDF 页面检测（GitHub、Google Drive 等）
  - 选中文本优先提取
  - 正文最大 15000 字符，超出截断

- **Gemini 输入框注入**
  - MAIN world 脚本 patch `attachShadow` 为 open 模式，穿透 Gemini 的 closed shadow DOM
  - 三路注入：postMessage → runtime broadcast → 剪贴板兜底
  - 注入后不自动发送，由用户手动回车

- **YouTube 增强**
  - 提取视频标题、频道名、描述（2000 字）、时长、前 10 条评论
  - 视频类内容（YouTube、X/Twitter）分析时自动请求 Gemini 附带时间帧码
  - 非视频网页分析不带时间帧码

- **标签页跟踪**
  - 切换标签页时自动提取并推送页面上下文
  - 切换到 chrome:// 等内部页面时清除缓存，避免显示旧内容
  - 每次点击按钮实时重新提取，不使用缓存

- **右键菜单**
  - 发送选中文本到 Gemini（直接发送原文，不附加额外内容）
  - 用 Gemini 总结此页面
  - 侧边栏已打开时也能响应右键菜单操作

- **快捷键**
  - `Alt+G` 打开/关闭侧边栏

### 已知问题

- **YouTube 字幕自动提取未能实现** — YouTube 的 `timedtext` API 对扩展的 fetch 请求始终返回空内容（status 200 但 body 为空），无论通过 content script、MAIN world script 还是 background service worker 请求均如此。`get_transcript` innertube API 返回 400 错误。当前依赖 Gemini 自身分析 YouTube 视频内容生成时间戳。如果用户手动打开 YouTube 转录面板，插件可以读取面板中的字幕数据。
- **Gemini 注入偶尔失败** — Gemini 页面加载较慢时，输入框可能尚未渲染，注入会失败。当前有 5 次重试机制，通常可以解决。失败时会提示用户使用 Cmd+V 粘贴。

### 技术决策记录

1. **Shadow DOM 穿透方案** — Gemini 使用 closed shadow DOM，无法从外部访问。通过在 `document_start` 阶段的 MAIN world 脚本 monkey-patch `Element.prototype.attachShadow`，强制所有 shadow root 为 open 模式。
2. **标签页查询策略** — 使用 `chrome.tabs.query({ active: true })` 查询所有窗口，按 `lastAccessed` 排序，过滤掉 chrome:// 和 Gemini 页面，确保找到用户当前浏览的网页。
3. **内容注入不自动发送** — 用户反馈需要先配置 Gemini 选项再发送，因此注入文本后不自动点击发送按钮。
4. **工具栏放在底部** — 用户反馈底部更方便点击操作。
5. **视频/非视频 prompt 区分** — YouTube 和 X/Twitter 页面请求附带时间帧码，其他网页只做详细分析。
