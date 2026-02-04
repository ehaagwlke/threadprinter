# ThreadPrinter 功能测试指南

## 快速测试

在 Chrome 中加载扩展后：

1. 打开 X/Twitter 线程页面
2. 按 F12 打开 DevTools
3. 切换到 Console 标签
4. 粘贴并运行 `tests/functional-test.js` 中的代码
5. 运行 `ThreadPrinterTests.runAll()`

## 手动测试清单

### 基本功能
- [ ] 扩展图标在 X/Twitter 页面显示
- [ ] 点击图标打开 popup
- [ ] 正确显示作者名、推文数、图片数
- [ ] 可以选择导出格式

### 提取功能
- [ ] 点击提取按钮能成功提取内容
- [ ] 提取失败时显示友好的错误信息
- [ ] 刷新页面后能重新提取

### 预览功能
- [ ] 点击"预览 & 导出"打开预览页面
- [ ] 可以切换四种主题
- [ ] 可以调整字体大小和行高
- [ ] 可以选择/取消选择推文
- [ ] 显示已选择的推文数量

### 导出功能
- [ ] Markdown 导出正常
- [ ] HTML 导出正常
- [ ] PDF 导出正常（通过打印对话框）
- [ ] PNG 导出正常（通过预览页面）

## Push 前检查

```bash
# 1. 代码语法检查
node --check content.js
node --check popup/popup.js
node --check background.js

# 2. 功能测试（在 Chrome 中手动测试）
# - 加载扩展
# - 打开 X/Twitter 线程
# - 测试提取、预览、导出全流程

# 3. Git 提交
git add -A
git commit -m "your message"
git push origin main
```

## 常见问题

### "Receiving end does not exist"
- 原因：Content script 未加载或页面已刷新
- 解决：刷新页面后重试，或检查 manifest.json 配置

### 提取结果为 0 条推文
- 原因：X/Twitter DOM 结构变化
- 解决：更新 content.js 中的选择器

### 导出文件损坏
- 原因：生成器输出格式错误
- 解决：检查对应生成器文件的输出格式
