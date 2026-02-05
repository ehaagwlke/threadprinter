/**
 * ThreadPrinter - HTML Generator
 * HTML 格式生成器 - 使用标准化数据格式
 */

import { normalizeData } from './dataNormalizer.js';

const HtmlGenerator = {
  /**
   * 生成 HTML 内容
   * @param {Object} rawData - 提取的原始数据
   * @returns {string}
   */
  generate(rawData) {
    if (!rawData) return '';
    
    const data = normalizeData(rawData);

    const content = data.type === 'twitter_thread' 
      ? this.generateTwitterThread(data)
      : this.generateGenericContent(data);

    return this.wrapHtml(content, data);
  },

  /**
   * 包装完整 HTML 文档
   * @param {string} content - 主体内容
   * @param {Object} data - 标准化后的数据
   * @returns {string}
   */
  wrapHtml(content, data) {
    return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${this.escapeHtml(data.title || 'ThreadPrinter Export')}</title>
  <style>
    ${this.getStyles()}
  </style>
</head>
<body>
  <div class="container">
    ${content}
  </div>
  <footer class="footer">
    <p>由 ThreadPrinter 生成 · ${new Date().toLocaleString('zh-CN')}</p>
  </footer>
</body>
</html>`;
  },

  /**
   * 生成 X/Twitter 线程 HTML
   * @param {Object} data - 标准化后的线程数据
   * @returns {string}
   */
  generateTwitterThread(data) {
    let html = '';

    // 头部
    html += `<header class="thread-header">`;
    if (data.authorAvatar) {
      html += `<img src="${this.escapeHtml(data.authorAvatar)}" alt="${this.escapeHtml(data.author)}" class="author-avatar">`;
    }
    html += `<div class="author-info">`;
    html += `<h1 class="author-name">${this.escapeHtml(data.author || 'Unknown')}</h1>`;
    if (data.authorHandle) {
      html += `<p class="author-handle">${this.escapeHtml(data.authorHandle)}</p>`;
    }
    html += `</div>`;
    html += `</header>`;

    // 元数据
    html += `<div class="thread-meta">`;
    if (data.publishedTime) {
      html += `<time datetime="${data.publishedTime}">${this.formatDate(data.publishedTime)}</time>`;
    }
    html += `<span class="tweet-count">${data.tweetCount} 条推文</span>`;
    html += `</div>`;

    // 推文列表 - 只包含选中的推文
    const selectedTweets = data.tweets.filter(t => t.selected !== false);
    if (selectedTweets.length > 0) {
      html += `<div class="tweets-list">`;
      
      selectedTweets.forEach((tweet, index) => {
        html += this.generateTweetHtml(tweet, index);
      });

      html += `</div>`;
    }

    return html;
  },

  /**
   * 生成单条推文 HTML
   * @param {Object} tweet - 标准化后的推文数据
   * @param {number} index - 索引
   * @returns {string}
   */
  generateTweetHtml(tweet, index) {
    let html = `<article class="tweet" id="tweet-${tweet.id}">`;

    // 头部
    html += `<div class="tweet-header">`;
    html += `<span class="tweet-number">#${index + 1}</span>`;
    if (tweet.displayTime) {
      html += `<time datetime="${tweet.timestamp}">${this.escapeHtml(tweet.displayTime)}</time>`;
    }
    html += `</div>`;

    // 内容
    html += `<div class="tweet-content">`;
    html += this.formatTweetText(tweet.text);
    html += `</div>`;

    // 媒体
    if (tweet.media) {
      html += this.generateMediaHtml(tweet.media);
    }

    // 链接
    if (tweet.links && tweet.links.length > 0) {
      html += `<div class="tweet-links">`;
      tweet.links.forEach(link => {
        html += `<a href="${this.escapeHtml(link.url)}" target="_blank" rel="noopener">${this.escapeHtml(link.text || link.url)}</a>`;
      });
      html += `</div>`;
    }

    html += `</article>`;
    return html;
  },

  /**
   * 生成媒体 HTML
   * @param {Object} media - 标准化后的媒体数据
   * @returns {string}
   */
  generateMediaHtml(media) {
    let html = '';

    // 图片
    if (media.images && media.images.length > 0) {
      html += `<div class="tweet-media">`;
      media.images.forEach(img => {
        html += `<figure>`;
        html += `<img src="${this.escapeHtml(img.url)}" alt="${this.escapeHtml(img.alt || '')}" loading="lazy">`;
        if (img.alt) {
          html += `<figcaption>${this.escapeHtml(img.alt)}</figcaption>`;
        }
        html += `</figure>`;
      });
      html += `</div>`;
    }

    // 视频
    if (media.videos && media.videos.length > 0) {
      media.videos.forEach(video => {
        html += `<div class="tweet-video">`;
        if (video.poster) {
          html += `<img src="${this.escapeHtml(video.poster)}" alt="Video thumbnail">`;
        }
        html += `<div class="video-overlay"><span>🎥 视频</span></div>`;
        html += `</div>`;
      });
    }

    // 卡片
    if (media.card) {
      const card = media.card;
      html += `<a href="${this.escapeHtml(card.url)}" target="_blank" rel="noopener" class="tweet-card">`;
      if (card.image) {
        html += `<img src="${this.escapeHtml(card.image)}" alt="">`;
      }
      html += `<div class="card-content">`;
      if (card.title) {
        html += `<div class="card-title">${this.escapeHtml(card.title)}</div>`;
      }
      html += `<div class="card-url">${this.escapeHtml(this.getHostname(card.url))}</div>`;
      html += `</div>`;
      html += `</a>`;
    }

    return html;
  },

  /**
   * 获取主机名
   * @param {string} url - URL
   * @returns {string}
   */
  getHostname(url) {
    try {
      return new URL(url).hostname;
    } catch {
      return url;
    }
  },

  /**
   * 生成通用内容 HTML
   * @param {Object} data - 标准化后的内容数据
   * @returns {string}
   */
  generateGenericContent(data) {
    let html = '';

    html += `<header>`;
    html += `<h1>${this.escapeHtml(data.title || '无标题')}</h1>`;
    
    if (data.byline || data.siteName) {
      html += `<p class="meta">`;
      if (data.byline) html += `作者: ${this.escapeHtml(data.byline)} · `;
      if (data.siteName) html += `来源: ${this.escapeHtml(data.siteName)}`;
      html += `</p>`;
    }
    
    if (data.publishedTime) {
      html += `<time datetime="${data.publishedTime}">${this.formatDate(data.publishedTime)}</time>`;
    }
    
    html += `</header>`;

    if (data.excerpt) {
      html += `<blockquote class="excerpt">${this.escapeHtml(data.excerpt)}</blockquote>`;
    }

    if (data.content) {
      html += `<div class="content-body">${data.content}</div>`;
    } else if (data.textContent) {
      html += `<div class="content-body">`;
      html += data.textContent.split('\n\n').map(p => `<p>${this.escapeHtml(p)}</p>`).join('');
      html += `</div>`;
    }

    return html;
  },

  /**
   * 格式化推文文本
   * @param {string} text - 推文文本
   * @returns {string}
   */
  formatTweetText(text) {
    if (!text) return '';
    
    // 转义 HTML
    text = this.escapeHtml(text);
    
    // 将 URL 转换为链接
    text = text.replace(
      /(https?:\/\/[^\s]+)/g, 
      '<a href="$1" target="_blank" rel="noopener">$1</a>'
    );
    
    // 将 @用户名 转换为链接
    text = text.replace(
      /@(\w+)/g, 
      '<a href="https://x.com/$1" target="_blank" rel="noopener">@$1</a>'
    );
    
    // 将 #话题 转换为链接
    text = text.replace(
      /#(\w+)/g, 
      '<a href="https://x.com/hashtag/$1" target="_blank" rel="noopener">#$1</a>'
    );
    
    // 保留换行
    text = text.replace(/\n/g, '<br>');
    
    return text;
  },

  /**
   * 获取 CSS 样式
   * @returns {string}
   */
  getStyles() {
    return `
      * {
        margin: 0;
        padding: 0;
        box-sizing: border-box;
      }

      body {
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
        font-size: 16px;
        line-height: 1.6;
        color: #0f1419;
        background: #f7f9f9;
        padding: 40px 20px;
      }

      .container {
        max-width: 680px;
        margin: 0 auto;
        background: #fff;
        border-radius: 16px;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
        overflow: hidden;
      }

      .thread-header {
        padding: 32px;
        background: linear-gradient(135deg, #f7f9f9 0%, #fff 100%);
        display: flex;
        align-items: center;
        gap: 20px;
      }

      .author-avatar {
        width: 80px;
        height: 80px;
        border-radius: 50%;
        object-fit: cover;
        border: 3px solid #fff;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
      }

      .author-name {
        font-size: 24px;
        font-weight: 800;
      }

      .author-handle {
        color: #536471;
        font-size: 15px;
      }

      .thread-meta {
        padding: 16px 32px;
        background: #f7f9f9;
        font-size: 13px;
        color: #536471;
        display: flex;
        justify-content: space-between;
      }

      .tweets-list {
        padding: 0 32px;
      }

      .tweet {
        padding: 24px 0;
        border-bottom: 1px solid #eff3f4;
      }

      .tweet:last-child {
        border-bottom: none;
      }

      .tweet-header {
        display: flex;
        align-items: center;
        gap: 12px;
        margin-bottom: 12px;
        font-size: 13px;
        color: #536471;
      }

      .tweet-number {
        font-weight: 600;
        color: #1d9bf0;
      }

      .tweet-content {
        font-size: 17px;
        line-height: 1.5;
        word-wrap: break-word;
      }

      .tweet-content a {
        color: #1d9bf0;
        text-decoration: none;
      }

      .tweet-content a:hover {
        text-decoration: underline;
      }

      .tweet-media {
        margin-top: 12px;
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
        gap: 8px;
      }

      .tweet-media img {
        width: 100%;
        border-radius: 12px;
      }

      .tweet-media figcaption {
        font-size: 12px;
        color: #536471;
        margin-top: 4px;
      }

      .tweet-video {
        position: relative;
        margin-top: 12px;
        border-radius: 12px;
        overflow: hidden;
        aspect-ratio: 16 / 9;
      }

      .tweet-video img {
        width: 100%;
        height: 100%;
        object-fit: cover;
      }

      .video-overlay {
        position: absolute;
        inset: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        background: rgba(0, 0, 0, 0.4);
      }

      .video-overlay span {
        padding: 12px 24px;
        background: rgba(0, 0, 0, 0.6);
        color: #fff;
        border-radius: 24px;
      }

      .tweet-card {
        display: block;
        margin-top: 12px;
        border: 1px solid #e1e8ed;
        border-radius: 12px;
        overflow: hidden;
        text-decoration: none;
        color: inherit;
      }

      .tweet-card img {
        width: 100%;
        height: 160px;
        object-fit: cover;
      }

      .card-content {
        padding: 12px 16px;
      }

      .card-title {
        font-weight: 600;
        margin-bottom: 4px;
      }

      .card-url {
        font-size: 13px;
        color: #536471;
      }

      .tweet-links {
        margin-top: 12px;
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
      }

      .tweet-links a {
        font-size: 13px;
        color: #1d9bf0;
        text-decoration: none;
        background: #e8f5fd;
        padding: 4px 10px;
        border-radius: 12px;
      }

      .footer {
        text-align: center;
        padding: 24px;
        font-size: 13px;
        color: #536471;
      }

      /* 通用内容样式 */
      header {
        padding: 32px;
        border-bottom: 1px solid #eff3f4;
      }

      header h1 {
        font-size: 28px;
        font-weight: 800;
        margin-bottom: 16px;
      }

      header .meta {
        color: #536471;
        font-size: 15px;
        margin-bottom: 8px;
      }

      header time {
        font-size: 13px;
        color: #536471;
      }

      .excerpt {
        margin: 24px 32px;
        padding: 16px 20px;
        background: #f7f9f9;
        border-left: 4px solid #1d9bf0;
        font-style: italic;
        color: #536471;
      }

      .content-body {
        padding: 24px 32px;
      }

      .content-body p {
        margin-bottom: 16px;
      }

      .content-body img {
        max-width: 100%;
        height: auto;
        border-radius: 12px;
      }

      @media print {
        body {
          background: #fff;
          padding: 0;
        }
        .container {
          box-shadow: none;
          border-radius: 0;
        }
        .footer {
          display: none;
        }
      }
    `;
  },

  /**
   * HTML 转义
   * @param {string} text - 原始文本
   * @returns {string}
   */
  escapeHtml(text) {
    if (!text) return '';
    // Node.js 环境兼容
    if (typeof document === 'undefined') {
      return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
    }
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  },

  /**
   * 格式化日期
   * @param {string} dateString - ISO 日期字符串
   * @returns {string}
   */
  formatDate(dateString) {
    if (!dateString) return '';
    
    try {
      const date = new Date(dateString);
      return date.toLocaleString('zh-CN', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return dateString;
    }
  }
};

// 导出
if (typeof module !== 'undefined' && module.exports) {
  module.exports = HtmlGenerator;
}

export function generateHTML(data) {
  return HtmlGenerator.generate(data);
}

export default HtmlGenerator;
