/**
 * ThreadPrinter - PDF Generator
 * PDF 格式生成器 - 使用标准化数据格式
 */

import { normalizeData } from './dataNormalizer.js';

const PdfGenerator = {
  /**
   * 生成 PDF
   * @param {Object} rawData - 提取的原始数据
   * @param {string} method - 生成方法 ('print' 或 'html2pdf')
   * @returns {Promise}
   */
  async generate(rawData, method = 'print') {
    if (!rawData) throw new Error('No data provided');
    
    const data = normalizeData(rawData);

    if (method === 'print') {
      return this.generateViaPrint(data);
    }

    throw new Error('Unsupported PDF generation method');
  },

  /**
   * 通过浏览器打印生成 PDF
   * @param {Object} data - 标准化后的数据
   * @returns {Promise}
   */
  async generateViaPrint(data) {
    // 创建打印窗口
    const printWindow = window.open('', '_blank');
    
    if (!printWindow) {
      throw new Error('请允许弹出窗口以生成 PDF');
    }

    // 生成打印优化的 HTML
    const html = this.generatePrintHtml(data);
    
    printWindow.document.write(html);
    printWindow.document.close();

    // 等待内容加载完成
    await new Promise(resolve => {
      printWindow.onload = resolve;
      setTimeout(resolve, 500);
    });

    // 触发打印对话框
    printWindow.print();

    // 可选：打印完成后关闭窗口
    // printWindow.close();
  },

  /**
   * 生成打印优化的 HTML
   * @param {Object} data - 标准化后的数据
   * @returns {string}
   */
  generatePrintHtml(data) {
    const content = data.type === 'twitter_thread'
      ? this.generateTwitterThreadHtml(data)
      : this.generateGenericContentHtml(data);

    return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${this.escapeHtml(data.title || 'ThreadPrinter PDF')}</title>
  <style>
    ${this.getPrintStyles()}
  </style>
</head>
<body>
  <div class="print-container">
    ${content}
  </div>
  <footer class="print-footer">
    由 ThreadPrinter 生成 · ${new Date().toLocaleString('zh-CN')}
  </footer>
  <script>
    // 自动触发打印（可选）
    // window.onload = () => { setTimeout(() => window.print(), 500); };
  </script>
</body>
</html>`;
  },

  /**
   * 生成 X/Twitter 线程打印 HTML
   * @param {Object} data - 标准化后的线程数据
   * @returns {string}
   */
  generateTwitterThreadHtml(data) {
    let html = '';

    // 头部
    html += `<div class="print-header">`;
    
    if (data.authorAvatar) {
      html += `<img src="${this.escapeHtml(data.authorAvatar)}" alt="" class="print-avatar">`;
    }
    
    html += `<div class="print-header-info">`;
    html += `<h1>${this.escapeHtml(data.title || 'X Thread')}</h1>`;
    
    if (data.author) {
      html += `<p class="print-author">作者: ${this.escapeHtml(data.author)}`;
      if (data.authorHandle) {
        html += ` (${this.escapeHtml(data.authorHandle)})`;
      }
      html += `</p>`;
    }
    
    if (data.publishedTime) {
      html += `<p class="print-date">时间: ${this.formatDate(data.publishedTime)}</p>`;
    }
    
    html += `<p class="print-url">来源: ${this.escapeHtml(data.url)}</p>`;
    html += `</div>`;
    html += `</div>`;

    // 推文列表 - 只包含选中的推文
    const selectedTweets = data.tweets.filter(t => t.selected !== false);
    if (selectedTweets.length > 0) {
      html += `<div class="print-tweets">`;
      
      selectedTweets.forEach((tweet, index) => {
        html += this.generateTweetPrintHtml(tweet, index);
      });
      
      html += `</div>`;
    }

    // 统计
    html += `<div class="print-stats">`;
    html += `<p>共 ${selectedTweets.length} 条推文 · 提取于 ${this.formatDate(data.extractedAt)}</p>`;
    html += `</div>`;

    return html;
  },

  /**
   * 生成单条推文打印 HTML
   * @param {Object} tweet - 标准化后的推文数据
   * @param {number} index - 索引
   * @returns {string}
   */
  generateTweetPrintHtml(tweet, index) {
    let html = `<div class="print-tweet">`;

    // 编号和时间
    html += `<div class="print-tweet-header">`;
    html += `<span class="print-tweet-number">#${index + 1}</span>`;
    if (tweet.displayTime) {
      html += `<span class="print-tweet-time">${this.escapeHtml(tweet.displayTime)}</span>`;
    }
    html += `</div>`;

    // 内容
    html += `<div class="print-tweet-content">`;
    html += this.formatTweetText(tweet.text);
    html += `</div>`;

    // 媒体
    if (tweet.media) {
      // 图片
      if (tweet.media.images && tweet.media.images.length > 0) {
        html += `<div class="print-tweet-media">`;
        tweet.media.images.forEach(img => {
          html += `<img src="${this.escapeHtml(img.url)}" alt="${this.escapeHtml(img.alt || '')}">`;
        });
        html += `</div>`;
      }

      // 视频标记
      if (tweet.media.videos && tweet.media.videos.length > 0) {
        html += `<p class="print-video-note">[视频内容]</p>`;
      }

      // 卡片
      if (tweet.media.card) {
        const card = tweet.media.card;
        html += `<div class="print-card">`;
        if (card.image) {
          html += `<img src="${this.escapeHtml(card.image)}" alt="">`;
        }
        html += `<p><strong>${this.escapeHtml(card.title || '')}</strong></p>`;
        html += `<p class="print-card-url">${this.escapeHtml(card.url)}</p>`;
        html += `</div>`;
      }
    }

    // 链接
    if (tweet.links && tweet.links.length > 0) {
      html += `<div class="print-tweet-links">`;
      html += `<p><strong>链接:</strong></p>`;
      html += `<ul>`;
      tweet.links.forEach(link => {
        html += `<li>${this.escapeHtml(link.text || link.url)}: ${this.escapeHtml(link.url)}</li>`;
      });
      html += `</ul>`;
      html += `</div>`;
    }

    html += `</div>`;
    return html;
  },

  /**
   * 生成通用内容打印 HTML
   * @param {Object} data - 标准化后的内容数据
   * @returns {string}
   */
  generateGenericContentHtml(data) {
    let html = '';

    html += `<div class="print-header">`;
    html += `<h1>${this.escapeHtml(data.title || '无标题')}</h1>`;
    
    if (data.byline) {
      html += `<p>作者: ${this.escapeHtml(data.byline)}</p>`;
    }
    if (data.siteName) {
      html += `<p>来源: ${this.escapeHtml(data.siteName)}</p>`;
    }
    if (data.publishedTime) {
      html += `<p>时间: ${this.formatDate(data.publishedTime)}</p>`;
    }
    if (data.url) {
      html += `<p>链接: ${this.escapeHtml(data.url)}</p>`;
    }
    html += `</div>`;

    if (data.excerpt) {
      html += `<div class="print-excerpt">`;
      html += `<p><em>${this.escapeHtml(data.excerpt)}</em></p>`;
      html += `</div>`;
    }

    if (data.content) {
      html += `<div class="print-content-body">${data.content}</div>`;
    } else if (data.textContent) {
      html += `<div class="print-content-body">`;
      data.textContent.split('\n\n').forEach(p => {
        if (p.trim()) {
          html += `<p>${this.escapeHtml(p)}</p>`;
        }
      });
      html += `</div>`;
    }

    return html;
  },

  /**
   * 获取打印样式
   * @returns {string}
   */
  getPrintStyles() {
    return `
      @page {
        size: A4;
        margin: 2cm;
      }

      * {
        margin: 0;
        padding: 0;
        box-sizing: border-box;
      }

      body {
        font-family: 'Segoe UI', 'Microsoft YaHei', -apple-system, BlinkMacSystemFont, sans-serif;
        font-size: 11pt;
        line-height: 1.6;
        color: #000;
        background: #fff;
      }

      .print-container {
        max-width: 100%;
      }

      .print-header {
        margin-bottom: 24pt;
        padding-bottom: 16pt;
        border-bottom: 2pt solid #000;
        display: flex;
        align-items: flex-start;
        gap: 16pt;
      }

      .print-avatar {
        width: 48pt;
        height: 48pt;
        border-radius: 50%;
        object-fit: cover;
      }

      .print-header-info {
        flex: 1;
      }

      .print-header h1 {
        font-size: 18pt;
        font-weight: bold;
        margin-bottom: 8pt;
      }

      .print-author,
      .print-date,
      .print-url {
        font-size: 10pt;
        color: #333;
        margin-bottom: 4pt;
      }

      .print-tweets {
        margin-top: 16pt;
      }

      .print-tweet {
        margin-bottom: 16pt;
        padding-bottom: 16pt;
        border-bottom: 1pt solid #ddd;
        page-break-inside: avoid;
      }

      .print-tweet:last-child {
        border-bottom: none;
      }

      .print-tweet-header {
        margin-bottom: 8pt;
        font-size: 10pt;
        color: #666;
      }

      .print-tweet-number {
        font-weight: bold;
        margin-right: 8pt;
      }

      .print-tweet-content {
        font-size: 11pt;
        line-height: 1.6;
        margin-bottom: 8pt;
      }

      .print-tweet-content a {
        color: #000;
        text-decoration: underline;
      }

      .print-tweet-media {
        margin: 8pt 0;
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(150pt, 1fr));
        gap: 8pt;
      }

      .print-tweet-media img {
        width: 100%;
        max-height: 200pt;
        object-fit: cover;
        border-radius: 4pt;
      }

      .print-video-note {
        font-style: italic;
        color: #666;
        margin: 8pt 0;
      }

      .print-card {
        margin: 8pt 0;
        padding: 8pt;
        border: 1pt solid #ddd;
        border-radius: 4pt;
      }

      .print-card img {
        width: 100%;
        max-height: 120pt;
        object-fit: cover;
        border-radius: 4pt;
        margin-bottom: 8pt;
      }

      .print-card-url {
        font-size: 9pt;
        color: #666;
      }

      .print-tweet-links {
        margin-top: 8pt;
        font-size: 9pt;
      }

      .print-tweet-links ul {
        margin-left: 16pt;
        margin-top: 4pt;
      }

      .print-tweet-links li {
        margin-bottom: 2pt;
      }

      .print-stats {
        margin-top: 24pt;
        padding-top: 16pt;
        border-top: 1pt solid #000;
        font-size: 10pt;
        color: #666;
        text-align: center;
      }

      .print-excerpt {
        margin: 16pt 0;
        padding: 12pt;
        background: #f5f5f5;
        border-left: 3pt solid #666;
        font-style: italic;
      }

      .print-content-body {
        margin-top: 16pt;
      }

      .print-content-body p {
        margin-bottom: 12pt;
        text-align: justify;
      }

      .print-footer {
        margin-top: 32pt;
        padding-top: 16pt;
        border-top: 1pt solid #ccc;
        font-size: 9pt;
        color: #666;
        text-align: center;
      }

      @media print {
        .no-print {
          display: none !important;
        }
      }
    `;
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
    
    // 保留换行
    text = text.replace(/\n/g, '<br>');
    
    return text;
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
  module.exports = PdfGenerator;
}

export function generatePDF(data) {
  // PDF 生成通过预览页面的打印对话框实现
  return PdfGenerator.generate(data);
}

export function generateStyledHTML(data, forPrint = false) {
  return PdfGenerator.generatePrintHtml(data);
}

export default PdfGenerator;
