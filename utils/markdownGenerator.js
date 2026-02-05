/**
 * ThreadPrinter - Markdown Generator
 * Markdown 格式生成器 - 使用标准化数据格式
 */

import { normalizeData } from './dataNormalizer.js';

const MarkdownGenerator = {
  /**
   * 生成 Markdown 内容
   * @param {Object} rawData - 提取的原始数据
   * @returns {string}
   */
  generate(rawData) {
    if (!rawData) return '';
    
    const data = normalizeData(rawData);

    if (data.type === 'twitter_thread') {
      return this.generateTwitterThread(data);
    }

    return this.generateGenericContent(data);
  },

  /**
   * 生成 X/Twitter 线程 Markdown
   * @param {Object} data - 标准化后的线程数据
   * @returns {string}
   */
  generateTwitterThread(data) {
    const lines = [];

    // 标题
    lines.push(`# ${data.title || 'X Thread'}`);
    lines.push('');

    // 作者信息
    if (data.author) {
      lines.push(`**作者:** ${data.author}`);
    }
    if (data.authorHandle) {
      lines.push(`**账号:** ${data.authorHandle}`);
    }
    if (data.publishedTime) {
      lines.push(`**时间:** ${this.formatDate(data.publishedTime)}`);
    }
    lines.push(`**来源:** ${data.url}`);
    lines.push('');
    lines.push('---');
    lines.push('');

    // 推文内容
    if (data.tweets && data.tweets.length > 0) {
      data.tweets.forEach((tweet, index) => {
        // 只处理选中的推文
        if (tweet.selected === false) return;
        
        lines.push(`## 推文 ${index + 1}`);
        lines.push('');

        // 内容
        if (tweet.text) {
          lines.push(this.escapeMarkdown(tweet.text));
          lines.push('');
        }

        // 媒体
        if (tweet.media) {
          // 图片
          if (tweet.media.images && tweet.media.images.length > 0) {
            tweet.media.images.forEach(img => {
              lines.push(`![${img.alt || 'Image'}](${img.url})`);
            });
            lines.push('');
          }

          // 视频
          if (tweet.media.videos && tweet.media.videos.length > 0) {
            tweet.media.videos.forEach(video => {
              if (video.url) {
                lines.push(`[🎥 视频](${video.url})`);
              } else if (video.poster) {
                lines.push(`![视频缩略图](${video.poster})`);
                lines.push('*(视频内容)*');
              }
            });
            lines.push('');
          }

          // 卡片
          if (tweet.media.card) {
            const card = tweet.media.card;
            lines.push(`[${card.title || '链接'}](${card.url})`);
            if (card.image) {
              lines.push(`![${card.title || ''}](${card.image})`);
            }
            lines.push('');
          }
        }

        // 链接
        if (tweet.links && tweet.links.length > 0) {
          lines.push('**链接:**');
          tweet.links.forEach(link => {
            lines.push(`- [${link.text || link.url}](${link.url})`);
          });
          lines.push('');
        }

        lines.push('---');
        lines.push('');
      });
    }

    // 页脚
    lines.push('');
    lines.push(`*共 ${data.tweetCount} 条推文 · 提取于 ${this.formatDate(data.extractedAt)}*`);
    lines.push('');
    lines.push('*由 ThreadPrinter 生成*');

    return lines.join('\n');
  },

  /**
   * 生成通用内容 Markdown
   * @param {Object} data - 标准化后的内容数据
   * @returns {string}
   */
  generateGenericContent(data) {
    const lines = [];

    // 标题
    lines.push(`# ${data.title || '无标题'}`);
    lines.push('');

    // 元数据
    if (data.byline) {
      lines.push(`**作者:** ${data.byline}`);
    }
    if (data.siteName) {
      lines.push(`**来源:** ${data.siteName}`);
    }
    if (data.publishedTime) {
      lines.push(`**时间:** ${this.formatDate(data.publishedTime)}`);
    }
    if (data.url) {
      lines.push(`**链接:** ${data.url}`);
    }
    lines.push('');
    lines.push('---');
    lines.push('');

    // 摘要
    if (data.excerpt) {
      lines.push('> ' + data.excerpt);
      lines.push('');
    }

    // 内容
    if (data.textContent) {
      lines.push(data.textContent);
    } else if (data.content) {
      // 简单去除 HTML 标签
      const text = data.content.replace(/<[^>]*>/g, '');
      lines.push(text);
    }

    lines.push('');
    lines.push('---');
    lines.push('');
    lines.push(`*提取于 ${this.formatDate(data.extractedAt)}*`);
    lines.push('');
    lines.push('*由 ThreadPrinter 生成*');

    return lines.join('\n');
  },

  /**
   * 转义 Markdown 特殊字符
   * @param {string} text - 原始文本
   * @returns {string}
   */
  escapeMarkdown(text) {
    if (!text) return '';
    
    // 转义特殊字符
    return text
      .replace(/\\/g, '\\\\')
      .replace(/\*/g, '\\*')
      .replace(/_/g, '\\_')
      .replace(/\[/g, '\\[')
      .replace(/\]/g, '\\]')
      .replace(/\(/g, '\\(')
      .replace(/\)/g, '\\)')
      .replace(/`/g, '\\`');
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
  module.exports = MarkdownGenerator;
}

export function generateMarkdown(data) {
  return MarkdownGenerator.generate(data);
}

export default MarkdownGenerator;
