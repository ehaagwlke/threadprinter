# ThreadPrinter

ThreadPrinter 是一个 Chrome 浏览器扩展，用于抽取 X/Twitter 线程内容并生成多种格式（Markdown/HTML/PDF/PNG）。

## 功能特性

- 🔍 **智能提取**: 自动识别 X/Twitter 线程内容，包括推文文本、图片、视频链接
- 📝 **多种格式**: 支持导出 Markdown、HTML、PDF、PNG 四种格式
- 🎨 **主题切换**: 提供默认、极简、纸张、深色四种主题风格
- ✏️ **内容编辑**: 支持选择/取消选择特定推文，删除/恢复推文
- 🔤 **字体调整**: 可调节字体大小和行高
- 🖼️ **媒体支持**: 保留图片、视频、链接卡片等媒体内容

## 安装方法

### 开发者模式安装

1. 下载本项目代码
2. 打开 Chrome 浏览器，进入 `chrome://extensions/`
3. 开启右上角的"开发者模式"
4. 点击"加载已解压的扩展程序"
5. 选择 `ThreadPrinter` 文件夹

### Chrome Web Store (即将上架)

敬请期待...

## 使用说明

### 1. 提取内容

1. 在 Chrome 中打开 X/Twitter 线程页面
2. 点击浏览器工具栏上的 ThreadPrinter 图标
3. 点击"提取内容"按钮
4. 等待提取完成

### 2. 预览和编辑

1. 提取完成后，点击"预览 & 导出"按钮
2. 在预览页面中：
   - 使用复选框选择/取消选择推文
   - 点击垃圾桶图标删除/恢复推文
   - 使用"全选"/"取消全选"按钮批量操作

### 3. 切换主题

在左侧工具栏中选择喜欢的主题：
- **默认**: X/Twitter 风格的蓝色主题
- **极简**: 黑白极简风格
- **纸张**: 暖色调纸张质感
- **深色**: 护眼深色模式

### 4. 调整字体

使用工具栏中的滑块调整：
- 字体大小: 12px - 24px
- 行高: 1.2 - 2.0

### 5. 导出文件

点击对应的导出按钮：
- **Markdown**: 纯文本格式，适合编辑和存档
- **HTML**: 完整样式，可离线查看
- **PDF**: 打印友好的格式，适合分享
- **PNG**: 图片格式，适合社交媒体分享

## 文件结构

```
ThreadPrinter/
├── manifest.json              # Chrome Extension 配置
├── background.js              # 后台服务脚本
├── content.js                 # 内容提取脚本
├── popup/                     # 弹出窗口
│   ├── popup.html
│   ├── popup.css
│   └── popup.js
├── preview/                   # 预览页面
│   ├── preview.html
│   ├── preview.css
│   └── preview.js
├── lib/                       # 第三方库
│   ├── Readability.js         # Mozilla Readability
│   └── Readability-readerable.js
├── utils/                     # 工具函数
│   ├── contentExtractor.js
│   ├── htmlGenerator.js
│   ├── markdownGenerator.js
│   └── pdfGenerator.js
├── themes/                    # 主题样式
│   ├── default.css
│   ├── minimal.css
│   ├── paper.css
│   └── dark.css
├── icons/                     # 扩展图标
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
└── docs/                      # 文档
    └── READABILITY_RESEARCH.md
```

## 技术栈

- **Chrome Extension Manifest V3**
- **Mozilla Readability.js** - 内容提取核心
- **html2canvas** - PNG 导出
- **原生浏览器打印** - PDF 导出

## 浏览器兼容性

- Chrome 88+
- Edge 88+
- 其他基于 Chromium 的浏览器

## 注意事项

1. 本扩展仅在 X/Twitter 网站上有效
2. 由于 X/Twitter 的动态加载特性，请确保所有推文已加载完成后再提取
3. 视频内容将以缩略图形式导出，无法直接保存视频文件
4. 导出 PNG 时，请等待图片完全加载后再导出

## 隐私声明

- 本扩展仅在用户主动点击时才会提取页面内容
- 所有数据处理均在本地完成，不会上传到任何服务器
- 不收集任何用户个人信息

## 贡献

欢迎提交 Issue 和 Pull Request！

## 许可证

MIT License

## 更新日志

### v1.0.0 (2024-02-04)
- 初始版本发布
- 支持 X/Twitter 线程内容提取
- 支持 Markdown/HTML/PDF/PNG 四种导出格式
- 提供四种主题风格
- 支持内容选择和编辑

---

**由 ThreadPrinter 团队开发** ❤️
