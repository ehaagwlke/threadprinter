/**
 * ThreadPrinter - Content Extractor Utility
 * 内容提取工具函数
 */

/**
 * 检查是否为 X/Twitter 网站
 * @param {string} url - 页面 URL
 * @returns {boolean}
 */
function isTwitterUrl(url) {
  return /twitter\.com|x\.com/.test(url);
}

/**
 * 解析数字（处理 K、M 等后缀）
 * @param {string} text - 包含数字的文本
 * @returns {number}
 */
function parseCount(text) {
  if (!text) return 0;
  
  const clean = text.trim().toLowerCase().replace(/,/g, '');
  
  if (clean.includes('k')) {
    return parseFloat(clean) * 1000;
  }
  if (clean.includes('m')) {
    return parseFloat(clean) * 1000000;
  }
  
  return parseInt(clean) || 0;
}

/**
 * 格式化日期
 * @param {string} dateString - ISO 日期字符串
 * @returns {string}
 */
function formatDate(dateString) {
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

/**
 * HTML 转义
 * @param {string} text - 原始文本
 * @returns {string}
 */
function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * 格式化推文文本（添加链接）
 * @param {string} text - 推文文本
 * @returns {string}
 */
function formatTweetText(text) {
  if (!text) return '';
  
  // 转义 HTML
  text = escapeHtml(text);
  
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
}

/**
 * 创建文件名
 * @param {string} prefix - 前缀
 * @param {string} extension - 扩展名
 * @returns {string}
 */
function createFilename(prefix, extension) {
  const timestamp = Date.now();
  return `${prefix}-${timestamp}.${extension}`;
}

/**
 * 下载文件
 * @param {string} filename - 文件名
 * @param {string} content - 文件内容
 * @param {string} mimeType - MIME 类型
 */
function downloadFile(filename, content, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);

  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// 导出
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    isTwitterUrl,
    parseCount,
    formatDate,
    escapeHtml,
    formatTweetText,
    createFilename,
    downloadFile
  };
}
