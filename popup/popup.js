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

async function quickExport() {
  const generators = await import(chrome.runtime.getURL('utils/generators.js'));
  
  let content, filename, mimeType;
  
  switch (selectedFormat) {
    case 'markdown':
      content = generators.generateMarkdown(currentThreadData);
      filename = `thread-${Date.now()}.md`;
      mimeType = 'text/markdown';
      break;
    case 'html':
      content = generators.generateHTML(currentThreadData);
      filename = `thread-${Date.now()}.html`;
      mimeType = 'text/html';
      break;
    case 'pdf':
      // For PDF, open preview page with print dialog
      openPreviewPage();
      return;
    case 'png':
      // For PNG, open preview page
      openPreviewPage();
      return;
    default:
      content = generators.generateMarkdown(currentThreadData);
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
}
