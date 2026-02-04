# Readability.js 调研报告

## 项目概述

**Readability.js** 是 Mozilla 开发的一个独立版本的网页内容提取库，最初用于 Firefox 的阅读器视图（Reader View）功能。

- **GitHub 仓库**: https://github.com/mozilla/readability
- **NPM 包**: `@mozilla/readability`
- **许可证**: Apache License 2.0

---

## 核心 API

### 1. 构造函数

```javascript
var article = new Readability(document, options).parse();
```

#### 参数说明

| 参数 | 类型 | 说明 |
|------|------|------|
| `document` | HTMLDocument | 要解析的 DOM 文档对象 |
| `options` | Object | 可选配置对象 |

#### Options 配置选项

| 选项 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `debug` | boolean | false | 是否启用日志输出 |
| `maxElemsToParse` | number | 0 | 最大解析元素数量（0表示无限制） |
| `nbTopCandidates` | number | 5 | 分析时考虑的顶级候选元素数量 |
| `charThreshold` | number | 500 | 文章最少字符数阈值 |
| `classesToPreserve` | array | [] | 要保留的 CSS 类名列表 |
| `keepClasses` | boolean | false | 是否保留所有 CSS 类 |
| `disableJSONLD` | boolean | false | 是否禁用 JSON-LD 元数据解析 |
| `serializer` | function | el => el.innerHTML | 控制如何序列化内容 |
| `allowedVideoRegex` | RegExp | undefined | 允许包含的视频 URL 正则 |
| `linkDensityModifier` | number | 0 | 链接密度阈值调整 |

---

## parse() 方法

解析文档并返回文章对象，包含以下属性：

| 属性 | 类型 | 说明 |
|------|------|------|
| `title` | string | 文章标题 |
| `content` | string | 处理后的文章 HTML 内容 |
| `textContent` | string | 纯文本内容（无 HTML 标签） |
| `length` | number | 文章字符长度 |
| `excerpt` | string | 文章摘要或描述 |
| `byline` | string | 作者信息 |
| `dir` | string | 内容方向 |
| `siteName` | string | 网站名称 |
| `lang` | string | 内容语言 |
| `publishedTime` | string | 发布时间 |

### 使用示例

```javascript
// 基础用法
var article = new Readability(document).parse();
console.log(article.title);
console.log(article.content);

// 使用克隆文档避免修改原始 DOM
var documentClone = document.cloneNode(true);
var article = new Readability(documentClone, {
  debug: true,
  charThreshold: 100,
  keepClasses: true
}).parse();
```

---

## isProbablyReaderable() 方法

快速判断文档是否适合使用 Readability 处理。

```javascript
if (isProbablyReaderable(document, options)) {
  let article = new Readability(document).parse();
}
```

### 参数

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `minContentLength` | number | 140 | 最小内容长度 |
| `minScore` | number | 20 | 最小累积分数 |
| `visibilityChecker` | function | isNodeVisible | 检查节点可见性的函数 |

---

## 内容提取算法

### 1. 预处理阶段

1. **清理无关元素**: 移除脚本、样式表、导航栏、广告等
2. **标准化 DOM**: 转换标签、修复属性
3. **提取元数据**: 从 JSON-LD、meta 标签获取标题、作者、发布时间

### 2. 评分算法

Readability 使用基于启发式的评分系统：

```javascript
// 正则表达式定义
REGEXPS: {
  unlikelyCandidates: /-ad-|banner|breadcrumbs|combx|comment|.../i,
  okMaybeItsACandidate: /and|article|body|column|content|.../i,
  positive: /article|body|content|entry|hentry|main|.../i,
  negative: /-ad-|hidden|banner|combx|comment|.../i
}
```

**评分因素**:
- 标签类型权重（article、section、div 等）
- 类名和 ID 关键词匹配
- 文本密度和链接密度
- 段落数量
- 图片和视频内容

### 3. 内容识别

1. 遍历所有段落和文本块
2. 为每个容器元素计算得分
3. 选择得分最高的作为主要内容容器
4. 清理和格式化选中内容

---

## 元数据提取

### JSON-LD 支持

自动解析 Schema.org 格式的 JSON-LD 数据：

```html
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "NewsArticle",
  "headline": "文章标题",
  "author": {
    "@type": "Person",
    "name": "作者名"
  },
  "datePublished": "2024-01-01T00:00:00Z"
}
</script>
```

### Meta 标签提取

支持的 meta 标签：
- `article:author` - 作者
- `article:published_time` - 发布时间
- `og:title` / `twitter:title` - 标题
- `og:description` - 描述
- `og:site_name` - 网站名称

---

## Chrome Extension 集成

### Manifest V3 配置

```json
{
  "content_scripts": [{
    "matches": ["<all_urls>"],
    "js": ["lib/Readability.js", "content.js"]
  }]
}
```

### 内容脚本使用

```javascript
// content.js
function extractContent() {
  // 克隆文档以避免修改原始页面
  const documentClone = document.cloneNode(true);
  
  // 创建 Readability 实例
  const reader = new Readability(documentClone, {
    debug: false,
    charThreshold: 100
  });
  
  // 解析文章
  const article = reader.parse();
  
  return article;
}

// 发送给 background script
chrome.runtime.sendMessage({
  action: 'extractContent',
  data: extractContent()
});
```

---

## 对 X/Twitter 的特殊处理

### X/Twitter 的挑战

1. **动态加载内容**: 推文通过 JavaScript 动态加载
2. **无限滚动**: 线程内容随滚动加载
3. **复杂 DOM 结构**: 嵌套层次深，类名动态生成
4. **单页应用 (SPA)**: 页面不刷新，内容动态变化

### 处理策略

#### 1. 等待内容加载

```javascript
// 等待推文加载完成
function waitForTweets(callback, maxAttempts = 30) {
  let attempts = 0;
  const interval = setInterval(() => {
    const tweets = document.querySelectorAll('article[data-testid="tweet"]');
    if (tweets.length > 0 || attempts >= maxAttempts) {
      clearInterval(interval);
      callback(tweets);
    }
    attempts++;
  }, 500);
}
```

#### 2. 自定义选择器提取

```javascript
// X/Twitter 特定的选择器
const TWITTER_SELECTORS = {
  tweet: 'article[data-testid="tweet"]',
  tweetText: '[data-testid="tweetText"]',
  userName: '[data-testid="User-Name"]',
  tweetPhoto: '[data-testid="tweetPhoto"]',
  tweetVideo: '[data-testid="videoPlayer"]',
  tweetTime: 'time',
  tweetLink: 'a[href*="/status/"]'
};

function extractTwitterThread() {
  const tweets = [];
  const tweetElements = document.querySelectorAll(TWITTER_SELECTORS.tweet);
  
  tweetElements.forEach((tweet, index) => {
    const textEl = tweet.querySelector(TWITTER_SELECTORS.tweetText);
    const userEl = tweet.querySelector(TWITTER_SELECTORS.userName);
    const timeEl = tweet.querySelector(TWITTER_SELECTORS.tweetTime);
    
    const tweetData = {
      index: index,
      text: textEl ? textEl.innerText : '',
      author: userEl ? userEl.innerText : '',
      time: timeEl ? timeEl.getAttribute('datetime') : '',
      images: Array.from(tweet.querySelectorAll('img')).map(img => img.src),
      selected: true
    };
    
    tweets.push(tweetData);
  });
  
  return tweets;
}
```

#### 3. 结合 Readability.js

对于 X/Twitter，建议采用混合策略：

1. **使用自定义提取器**获取结构化推文数据
2. **使用 Readability.js**处理链接到的外部文章
3. **合并结果**生成最终输出

```javascript
function extractTwitterContent() {
  // 1. 提取线程信息
  const threadInfo = extractTwitterThread();
  
  // 2. 提取页面元数据（Readability）
  const documentClone = document.cloneNode(true);
  const readabilityArticle = new Readability(documentClone).parse();
  
  // 3. 合并结果
  return {
    source: 'twitter',
    title: readabilityArticle?.title || document.title,
    url: window.location.href,
    tweets: threadInfo,
    metadata: {
      siteName: 'X (Twitter)',
      extractedAt: new Date().toISOString()
    }
  };
}
```

---

## 最佳实践

### 1. 文档克隆

始终克隆文档以避免修改原始页面：

```javascript
const documentClone = document.cloneNode(true);
const article = new Readability(documentClone).parse();
```

### 2. 错误处理

```javascript
try {
  const article = new Readability(documentClone).parse();
  if (!article) {
    console.warn('无法提取文章内容');
    return null;
  }
  return article;
} catch (error) {
  console.error('Readability 解析错误:', error);
  return null;
}
```

### 3. 性能优化

```javascript
// 限制解析元素数量
const article = new Readability(documentClone, {
  maxElemsToParse: 5000
}).parse();
```

### 4. 安全考虑

- 使用 DOMPurify 清理输出内容
- 使用 CSP 限制结果内容的能力
- 不信任输入内容时进行 sanitization

---

## 在 ThreadPrinter 中的应用

### 核心使用场景

1. **通用网站内容提取**
   - 使用 Readability.js 提取文章主体
   - 获取标题、作者、发布时间等元数据

2. **X/Twitter 特殊处理**
   - 针对 X/Twitter 的 DOM 结构定制提取逻辑
   - 识别推文结构、作者信息、时间戳
   - 提取媒体内容（图片、视频链接）

3. **混合策略**
   - 检测当前网站类型
   - 对 X/Twitter 使用专用提取器
   - 对其他网站使用 Readability.js

### 代码示例

```javascript
// utils/contentExtractor.js
class ContentExtractor {
  static extract() {
    const url = window.location.href;
    
    // 检测是否为 X/Twitter
    if (this.isTwitter(url)) {
      return this.extractTwitterThread();
    }
    
    // 使用 Readability.js 通用提取
    return this.extractWithReadability();
  }
  
  static isTwitter(url) {
    return /twitter\.com|x\.com/.test(url);
  }
  
  static extractWithReadability() {
    const documentClone = document.cloneNode(true);
    const article = new Readability(documentClone).parse();
    
    return {
      type: 'article',
      title: article.title,
      content: article.content,
      textContent: article.textContent,
      byline: article.byline,
      publishedTime: article.publishedTime,
      excerpt: article.excerpt,
      siteName: article.siteName,
      url: window.location.href
    };
  }
  
  static extractTwitterThread() {
    // X/Twitter 专用提取逻辑
    // ...
  }
}
```

---

## 总结

Readability.js 是一个强大且成熟的内容提取库，特别适合：

- ✅ 新闻网站和博客文章
- ✅ 静态 HTML 内容
- ✅ 需要提取元数据的场景
- ⚠️ 需要特殊处理动态加载内容（如 X/Twitter）
- ⚠️ 复杂的单页应用

对于 ThreadPrinter 项目，建议：
1. 使用 Readability.js 作为通用内容提取基础
2. 为 X/Twitter 开发专用的 DOM 提取逻辑
3. 实现灵活的内容选择机制
4. 提供多种导出格式（Markdown/HTML/PDF/PNG）
