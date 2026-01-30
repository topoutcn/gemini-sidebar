# Gemini Sidebar

Chrome 浏览器扩展，在侧边栏中嵌入 Google Gemini，支持提取当前页面内容并发送给 Gemini 进行分析。使用你自己的 Google 账号登录，无需 API Key。

## 功能

- **侧边栏嵌入 Gemini** — 通过 Chrome Side Panel API 在浏览器右侧打开 Gemini 对话界面
- **页面内容提取** — 自动提取当前网页的标题、URL 和正文内容
- **一键分析** — 提取内容后自动注入 Gemini 输入框，无需手动复制粘贴
- **YouTube 增强** — 提取视频标题、频道、描述、时长、评论；视频分析自动附带时间帧码
- **PDF 识别** — 检测 PDF 页面并提供文档链接（支持 GitHub、Google Drive）
- **右键菜单** — 发送选中文本到 Gemini / 用 Gemini 总结当前页面
- **快捷键** — `Alt+G` 快速打开/关闭侧边栏

## 截图

| 网页分析 | YouTube 视频分析 | PDF 分析 |
|---------|----------------|---------|
| ![网页分析](samples/2026-01-31%2001.53.35.png) | ![视频分析](samples/2026-01-31%2002.25.07.png) | ![PDF分析](samples/2026-01-31%2003.57.03.png) |

## 安装

1. 下载或克隆本仓库
2. 打开 Chrome，访问 `chrome://extensions/`
3. 开启右上角「开发者模式」
4. 点击「加载已解压的扩展」，选择本项目文件夹
5. 点击扩展图标或按 `Alt+G` 打开侧边栏
6. 在侧边栏中登录你的 Google 账号

## 使用

### 底部工具栏

**第一排 — 内容操作：**

| 按钮 | 功能 | 说明 |
|------|------|------|
| 📋 分析此页 | 详细分析 | 发送完整页面内容，YouTube/X 视频自动附带时间帧码 |
| 📝 总结 | 内容摘要 | 发送前 5000 字，请求要点总结 |
| 🌐 翻译 | 中文翻译 | 发送完整内容并请求翻译 |

**第二排 — 工具按钮：**

| 按钮 | 功能 |
|------|------|
| 🗑️ 清空输入框 | 清除 Gemini 输入框中的文本 |
| 🧹 清屏 | 重新加载 Gemini，回到新对话 |
| 🔄 刷新插件 | 刷新扩展，免去手动去 `chrome://extensions` 操作 |

### 右键菜单

- 选中文本后右键 → 「发送选中文本到 Gemini」— 直接将选中文字发送到输入框
- 页面空白处右键 → 「用 Gemini 总结此页面」

### 设置

点击侧边栏右上角 ⚙️ 按钮，可配置：

- **Gemini URL** — 默认 `https://gemini.google.com/app`，可替换为其他兼容服务
- **YouTube 增强模式** — 开关 YouTube 视频信息提取
- **提取范围** — 全文 / 摘要（前 3000 字）/ 仅选中文本

## 技术架构

```
sidepanel.js          用户操作 → 请求提取内容 → 注入 Gemini 输入框
     ↓
background.js         消息路由、标签页管理、动态脚本注入
     ↓
content-script.js     通用网页内容提取（标题、正文、PDF 检测）
youtube-*.js          YouTube 视频信息提取（标题、频道、描述、评论）
     ↓
gemini-*.js           Gemini iframe 内文本注入（Shadow DOM 穿透）
```

**关键技术点：**

- **Manifest V3** Chrome 扩展
- **declarativeNetRequest** 移除 `X-Frame-Options` 和 `CSP` 头，使 Gemini 可在 iframe 中加载
- **Shadow DOM 穿透** — 通过 MAIN world 脚本 patch `attachShadow` 为 open 模式
- **三路文本注入** — postMessage → runtime broadcast → 剪贴板兜底

## 项目结构

```
├── manifest.json              # MV3 扩展配置
├── rules.json                 # 网络请求头修改规则
├── background.js              # Service Worker（消息路由）
├── content-script.js          # 通用页面内容提取
├── youtube-content-script.js  # YouTube 视频信息提取
├── youtube-page-script.js     # YouTube MAIN world 脚本
├── gemini-early-inject.js     # Gemini MAIN world 注入
├── gemini-inject.js           # Gemini 内容脚本
├── sidepanel.html / js / css  # 侧边栏界面
├── settings.html / js         # 设置页面
└── icons/                     # 扩展图标
```

## 权限说明

| 权限 | 用途 |
|------|------|
| `sidePanel` | 创建浏览器侧边栏 |
| `activeTab` | 访问当前标签页 |
| `scripting` | 动态注入内容脚本 |
| `tabs` | 监听标签页切换和更新 |
| `storage` | 保存设置和临时数据 |
| `declarativeNetRequest` | 修改响应头以允许 iframe 嵌入 |
| `contextMenus` | 右键菜单 |
| `commands` | 快捷键 |

## License

MIT
