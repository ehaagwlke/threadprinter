# ThreadPrinter

> Extract and export X/Twitter threads to Markdown, HTML, PDF, or PNG

ThreadPrinter 是一个 Chrome 浏览器扩展，帮助你将 X/Twitter 线程（threads）抽取并导出为多种格式，方便保存、分享和离线阅读。

![Version](https://img.shields.io/badge/version-2.0.0-blue)
![License](https://img.shields.io/badge/license-MIT-green)

## ✨ 功能特点

- 📄 **多种导出格式**: Markdown, HTML, PDF, PNG
- 🎨 **主题定制**: 4 种预设主题 (Default, Minimal, Paper, Dark)
- ✏️ **内容编辑**: 在预览页面选择/取消选择特定推文
- 🔤 **字体调整**: 实时调整字体大小和行高
- 🖼️ **媒体支持**: 保留推文中的图片和视频链接
- 📊 **元数据**: 保留作者信息、时间戳和互动数据

## 📦 安装

### 开发者模式安装

1. 下载或克隆本仓库
2. 打开 Chrome 浏览器，进入 `chrome://extensions/`
3. 开启右上角的 "开发者模式"
4. 点击 "加载已解压的扩展程序"
5. 选择 `ThreadPrinter` 文件夹

### Chrome Web Store (即将上架)

---

## 🚀 使用指南

### 基本使用

1. 打开任意 X/Twitter 线程页面 (包含多条推文的对话)
2. 点击浏览器工具栏的 ThreadPrinter 图标
3. 选择导出格式
4. 点击 "Preview & Edit" 进入预览页面，或直接 "Quick Export"

### 预览页面功能

- **左侧边栏**: 选择/取消选择要导出的推文
- **工具栏**: 切换主题、调整字体大小和行高、选择导出格式
- **预览区**: 实时查看导出效果

### 导出格式说明

| 格式 | 适用场景 | 特点 |
|------|----------|------|
| **Markdown** | 笔记软件、GitHub | 纯文本，保留图片链接 |
| **HTML** | 网页存档、邮件 | 完整样式，可离线查看 |
| **PDF** | 打印、正式文档 | 使用浏览器打印功能 |
| **PNG** | 图片分享 | 使用浏览器截图功能 |

## 📁 项目结构

```
ThreadPrinter/
├── manifest.json          # Chrome Extension 配置
├── background.js          # Service Worker 后台脚本
├── content.js             # 内容抽取脚本
├── lib/
│   └── Readability.js     # Mozilla Readability 库
├── popup/                 # 弹出窗口
│   ├── popup.html
│   ├── popup.css
│   └── popup.js
├── preview/               # 预览页面
│   ├── preview.html
│   ├── preview.css
│   └── preview.js
├── utils/                 # 工具函数
│   ├── contentExtractor.js
│   └── generators.js      # 格式生成器
├── themes/                # 主题样式
│   ├── default.css
│   ├── minimal.css
│   ├── paper.css
│   └── dark.css
├── icons/                 # 扩展图标
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
└── docs/
    └── READABILITY_RESEARCH.md  # 技术调研文档
```

## 🔧 技术实现

### 内容抽取

项目使用混合策略抽取 X/Twitter 线程内容：

1. **自定义 DOM 选择器**: 针对 X/Twitter 的推文结构进行精确抽取
2. **Mozilla Readability**: 辅助提取页面元数据（标题、作者等）
3. **内容优化**: 利用 Readability 的启发式算法清理内容

详见 [技术调研文档](docs/READABILITY_RESEARCH.md)

### 核心技术

- **Chrome Extension Manifest V3**
- **Mozilla Readability.js** - 文章抽取
- **原生 JavaScript** - 无外部依赖

## 🛡️ 隐私说明

- 所有数据处理均在本地完成
- 不会上传任何用户数据到服务器
- 仅访问 twitter.com 和 x.com 域名

## 📝 更新日志

### v2.0.0 (2026-02-04)

- ✨ 全新架构，支持多种导出格式
- 🎨 添加 4 种预览主题
- ✏️ 支持选择/取消选择推文
- 🔤 实时调整字体和行高
- 📊 改进元数据提取

### v1.0.0

- 🎉 初始版本发布
- 📄 基础 PDF 导出功能

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

## 📄 许可证

MIT License © 2026 ThreadPrinter

---

<sub>Powered by [Mozilla Readability.js](https://github.com/mozilla/readability)</sub>
