// ThreadPrinter - Popup Script

let currentThreadData = null;
let selectedFormat = 'markdown';

// Initialize popup
document.addEventListener('DOMContentLoaded', async () => {
  console.log('[ThreadPrinter] Popup opened');
  
  // Check if we're on a thread page
  await checkCurrentPage();
  
  // Setup event listeners
  setupEventListeners();
});

async function checkCurrentPage() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  
  if (!tab.url || (!tab.url.includes('twitter.com') && !tab.url.includes('x.com'))) {
    showNotThread();
    return;
  }
  
  // Check if this is a thread page
  const isThread = /\/(status|statuses)\/\d+/.test(tab.url);
  
  if (!isThread) {
    showNotThread();
    return;
  }
  
  // Extract thread data
  await extractThread(tab.id);
}

async function extractThread(tabId) {
  showLoading(true);
  
  try {
    // 首先尝试检查 content script 是否已加载
    const isLoaded = await checkContentScriptLoaded(tabId);
    
    if (!isLoaded) {
      // 如果未加载，尝试动态注入
      console.log('[ThreadPrinter] Content script not loaded, injecting...');
      await injectContentScript(tabId);
      // 等待一小段时间让脚本初始化
      await sleep(500);
    }
    
    // 发送提取消息
    const response = await sendMessageWithRetry(tabId, { action: 'extractThread' }, 3);
    
    if (response.success) {
      currentThreadData = response.data;
      showThreadInfo(response.data);
    } else {
      showError(response.error || 'Failed to extract thread');
    }
  } catch (error) {
    console.error('[ThreadPrinter] Extraction error:', error);
    showError('Could not extract thread. Please refresh the page and try again.');
  } finally {
    showLoading(false);
  }
}

// 检查 content script 是否已加载
async function checkContentScriptLoaded(tabId) {
  try {
    const response = await chrome.tabs.sendMessage(tabId, { action: 'ping' });
    return response && response.pong === true;
  } catch (error) {
    return false;
  }
}

// 动态注入 content script
async function injectContentScript(tabId) {
  try {
    await chrome.scripting.executeScript({
      target: { tabId: tabId },
      files: ['lib/Readability.js', 'content.js']
    });
    console.log('[ThreadPrinter] Content script injected successfully');
  } catch (error) {
    console.error('[ThreadPrinter] Failed to inject content script:', error);
    throw error;
  }
}

// 带重试的消息发送
async function sendMessageWithRetry(tabId, message, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const response = await chrome.tabs.sendMessage(tabId, message);
      return response;
    } catch (error) {
      if (i === maxRetries - 1) {
        throw error;
      }
      console.log(`[ThreadPrinter] Retry ${i + 1}/${maxRetries}...`);
      await sleep(300);
    }
  }
}

// 辅助函数：延迟
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function showThreadInfo(data) {
  document.getElementById('notThread').classList.add('hidden');
  document.getElementById('threadInfo').classList.remove('hidden');
  
  // Update info - 修正数据访问方式
  const authorName = data.metadata?.author?.name || data.metadata?.author?.handle || data.author || 'Unknown';
  document.getElementById('authorName').textContent = authorName;
  document.getElementById('tweetCount').textContent = data.stats?.tweetCount || data.tweetCount || 0;
  document.getElementById('imageCount').textContent = data.stats?.imageCount || 0;
  
  // Store data for export
  currentThreadData = data;
}

function showNotThread() {
  document.getElementById('notThread').classList.remove('hidden');
  document.getElementById('threadInfo').classList.add('hidden');
  document.getElementById('error').classList.add('hidden');
}

function showError(message) {
  document.getElementById('error').classList.remove('hidden');
  document.getElementById('errorMessage').textContent = message;
}

function showLoading(show) {
  document.getElementById('loading').classList.toggle('hidden', !show);
}

function setupEventListeners() {
  // Format buttons
  document.querySelectorAll('.format-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.format-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      selectedFormat = btn.dataset.format;
    });
  });
  
  // Preview button
  document.getElementById('previewBtn').addEventListener('click', () => {
    if (currentThreadData) {
      openPreviewPage();
    }
  });
  
  // Quick export button
  document.getElementById('quickExportBtn').addEventListener('click', () => {
    if (currentThreadData) {
      quickExport();
    }
  });
  
  // Settings link
  document.getElementById('settingsLink').addEventListener('click', (e) => {
    e.preventDefault();
    chrome.runtime.openOptionsPage?.() || alert('Settings page coming soon!');
  });
  
  // Help link
  document.getElementById('helpLink').addEventListener('click', (e) => {
    e.preventDefault();
    chrome.tabs.create({ url: 'https://github.com/yourusername/threadprinter#readme' });
  });
}

function openPreviewPage() {
  // Store data temporarily
  chrome.storage.local.set({ 
    'threadprinter_preview_data': currentThreadData,
    'threadprinter_preview_format': selectedFormat
  }, () => {
    // Open preview page
    const previewUrl = chrome.runtime.getURL('preview/preview.html');
    chrome.tabs.create({ url: previewUrl });
  });
}

// 简化的导出功能 - 直接在 popup 中实现核心逻辑
async function quickExport() {
  try {
    let content, filename, mimeType;
    
    switch (selectedFormat) {
      case 'markdown':
        content = generateMarkdownSimple(currentThreadData);
        filename = `thread-${Date.now()}.md`;
        mimeType = 'text/markdown';
        break;
      case 'html':
        content = generateHTMLSimple(currentThreadData);
        filename = `thread-${Date.now()}.html`;
        mimeType = 'text/html';
        break;
      case 'pdf':
      case 'png':
        // For PDF/PNG, open preview page
        openPreviewPage();
        return;
      default:
        content = generateMarkdownSimple(currentThreadData);
        filename = `thread-${Date.now()}.md`;
        mimeType = 'text/markdown';
    }
    
    // Download file
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    
    await chrome.downloads.download({
      url: url,
      filename: filename,
      saveAs: true
    });
    
    console.log('[ThreadPrinter] Export successful');
  } catch (error) {
    console.error('[ThreadPrinter] Export error:', error);
    showError('Export failed. Please try using Preview & Edit instead.');
  }
}

// 简化版 Markdown 生成器（用于 popup）
function generateMarkdownSimple(data) {
  const { metadata, tweets, url } = data;
  
  let md = `# Thread by ${metadata?.author?.name || metadata?.author?.handle || 'Unknown'}\n\n`;
  md += `**Source:** ${url}\n`;
  md += `**Extracted:** ${new Date().toLocaleString()}\n\n`;
  md += `---\n\n`;
  
  tweets.forEach((tweet, index) => {
    const text = tweet.text || tweet.textPlain || '';
    if (text.trim()) {
      md += `## Tweet ${index + 1}\n\n`;
      md += `${text}\n\n`;
      
      // Images
      const images = tweet.media?.images || tweet.images || [];
      if (images.length > 0) {
        images.forEach(img => {
          const imgUrl = typeof img === 'string' ? img : img.url;
          md += `![Image](${imgUrl})\n\n`;
        });
      }
      
      md += `---\n\n`;
    }
  });
  
  md += `\n*Generated by ThreadPrinter*`;
  return md;
}

// 简化版 HTML 生成器（用于 popup）
function generateHTMLSimple(data) {
  const { metadata, tweets, url } = data;
  
  let html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Thread - ${escapeHtml(metadata?.title || 'Thread')}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; max-width: 700px; margin: 0 auto; padding: 40px 20px; line-height: 1.6; color: #0f1419; }
    h1 { font-size: 24px; margin-bottom: 16px; }
    .meta { color: #536471; font-size: 14px; margin-bottom: 24px; }
    .tweet { border-bottom: 1px solid #e1e8ed; padding: 20px 0; }
    .tweet-text { white-space: pre-wrap; margin-bottom: 12px; }
    .tweet-media img { max-width: 100%; border-radius: 12px; margin-top: 8px; }
    a { color: #1d9bf0; text-decoration: none; }
  </style>
</head>
<body>
  <h1>${escapeHtml(metadata?.title || 'Thread')}</h1>
  <div class="meta">
    <div>By: ${escapeHtml(metadata?.author?.name || 'Unknown')}</div>
    <div>Source: <a href="${url}" target="_blank">${url}</a></div>
    <div>Extracted: ${new Date().toLocaleString()}</div>
  </div>
`;
  
  tweets.forEach((tweet, index) => {
    const text = tweet.text || tweet.textPlain || '';
    if (text.trim()) {
      html += `  <div class="tweet">
    <div class="tweet-text">${escapeHtml(text).replace(/\n/g, '<br>')}</div>
`;
      
      const images = tweet.media?.images || tweet.images || [];
      if (images.length > 0) {
        html += '    <div class="tweet-media">\n';
        images.forEach(img => {
          const imgUrl = typeof img === 'string' ? img : img.url;
          html += `      <img src="${imgUrl}" alt="">\n`;
        });
        html += '    </div>\n';
      }
      
      html += '  </div>\n';
    }
  });
  
  html += `  <footer style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #e1e8ed; color: #536471; font-size: 13px; text-align: center;">
    Generated by ThreadPrinter · ${tweets.length} tweets
  </footer>
</body>
</html>`;
  
  return html;
}

// HTML 转义辅助函数
function escapeHtml(text) {
  if (!text) return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
