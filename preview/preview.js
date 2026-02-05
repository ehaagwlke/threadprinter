// ThreadPrinter - Preview Page Script
// 使用统一的生成器模块

import { normalizeData } from '../utils/dataNormalizer.js';

let rawThreadData = null;
let normalizedData = null;
let selectedFormat = 'markdown';
let currentTheme = 'default';
let generators = null;

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
  console.log('[ThreadPrinter] Preview page loaded');
  
  // 动态加载生成器
  try {
    generators = await import(chrome.runtime.getURL('utils/generators.js'));
    console.log('[ThreadPrinter] Generators loaded');
  } catch (error) {
    console.error('[ThreadPrinter] Failed to load generators:', error);
  }
  
  // Load thread data from storage
  await loadThreadData();
  
  // Setup UI
  setupEventListeners();
  
  // Initial render
  renderPreview();
  renderTweetList();
});

async function loadThreadData() {
  try {
    const result = await chrome.storage.local.get([
      'threadprinter_preview_data',
      'threadprinter_preview_format'
    ]);
    
    rawThreadData = result.threadprinter_preview_data;
    selectedFormat = result.threadprinter_preview_format || 'markdown';
    
    if (!rawThreadData) {
      showError('No thread data found. Please extract a thread first.');
      return;
    }
    
    // 标准化数据
    normalizedData = normalizeData(rawThreadData);
    
    // Set format selector
    document.getElementById('formatSelect').value = selectedFormat;
    
  } catch (error) {
    console.error('[ThreadPrinter] Failed to load data:', error);
    showError('Failed to load thread data.');
  }
}

function setupEventListeners() {
  // Back button
  document.getElementById('backBtn').addEventListener('click', () => {
    window.close();
  });
  
  // Theme selector
  document.getElementById('themeSelect').addEventListener('change', (e) => {
    changeTheme(e.target.value);
  });
  
  // Font size slider
  document.getElementById('fontSizeSlider').addEventListener('input', (e) => {
    const size = e.target.value;
    document.getElementById('fontSizeValue').textContent = size + 'px';
    document.documentElement.style.setProperty('--preview-font-size', size + 'px');
    updatePreviewStyles();
  });
  
  // Line height slider
  document.getElementById('lineHeightSlider').addEventListener('input', (e) => {
    const height = e.target.value;
    document.getElementById('lineHeightValue').textContent = height;
    document.documentElement.style.setProperty('--preview-line-height', height);
    updatePreviewStyles();
  });
  
  // Format selector
  document.getElementById('formatSelect').addEventListener('change', (e) => {
    selectedFormat = e.target.value;
    renderPreview();
  });
  
  // Export button
  document.getElementById('exportBtn').addEventListener('click', handleExport);
  
  // Select all/none
  document.getElementById('selectAllBtn').addEventListener('click', () => {
    setAllTweetsSelected(true);
  });
  
  document.getElementById('selectNoneBtn').addEventListener('click', () => {
    setAllTweetsSelected(false);
  });
}

function changeTheme(theme) {
  currentTheme = theme;
  const stylesheet = document.getElementById('themeStylesheet');
  stylesheet.href = `../themes/${theme}.css`;
}

function updatePreviewStyles() {
  const previewContent = document.getElementById('previewContent');
  const fontSize = document.getElementById('fontSizeSlider').value;
  const lineHeight = document.getElementById('lineHeightSlider').value;
  
  previewContent.style.fontSize = fontSize + 'px';
  previewContent.style.lineHeight = lineHeight;
}

function getSelectedTweets() {
  if (!normalizedData || !normalizedData.tweets) return [];
  return normalizedData.tweets.filter(t => t.selected !== false);
}

function renderPreview() {
  if (!normalizedData) return;
  
  const previewContent = document.getElementById('previewContent');
  const selectedTweets = getSelectedTweets();
  
  if (selectedTweets.length === 0) {
    previewContent.innerHTML = `
      <div class="empty-state">
        <p>No tweets selected. Select tweets from the sidebar to preview.📭</p>
      </div>
    `;
    return;
  }
  
  // 创建用于预览的数据副本（只包含选中的推文）
  const previewData = {
    ...normalizedData,
    tweets: selectedTweets
  };
  
  switch (selectedFormat) {
    case 'markdown':
      renderMarkdownPreview(previewData, previewContent);
      break;
    case 'html':
      renderHTMLPreview(previewData, previewContent);
      break;
    case 'pdf':
      renderPDFPreview(previewData, previewContent);
      break;
    case 'png':
      renderPNGPreview(previewData, previewContent);
      break;
    default:
      previewContent.innerHTML = '<div class="empty-state">Unknown format</div>';
  }
}

function renderMarkdownPreview(data, container) {
  if (generators?.generateMarkdown) {
    const markdown = generators.generateMarkdown(data);
    container.innerHTML = `<pre class="markdown-preview"><code>${escapeHtml(markdown)}</code></pre>`;
    container.style.fontFamily = 'monospace';
    container.style.whiteSpace = 'pre-wrap';
  } else {
    container.innerHTML = '<div class="empty-state">Generator not loaded. Please refresh.🔄</div>';
  }
}

function renderHTMLPreview(data, container) {
  if (generators?.generateHTML) {
    const html = generators.generateHTML(data);
    // 只显示 body 内容用于预览
    const bodyMatch = html.match(/<body[^>]*>([\s\S]*)<\/body>/i);
    const bodyContent = bodyMatch ? bodyMatch[1] : html;
    container.innerHTML = bodyContent;
    container.style.fontFamily = '';
    container.style.whiteSpace = '';
  } else {
    container.innerHTML = '<div class="empty-state">Generator not loaded. Please refresh.🔄</div>';
  }
}

function renderPDFPreview(data, container) {
  if (generators?.generateStyledHTML) {
    // 使用 PDF 生成器的 styled HTML 进行预览
    const html = generators.generateStyledHTML(data);
    const bodyMatch = html.match(/<body[^>]*>([\s\S]*)<\/body>/i);
    const bodyContent = bodyMatch ? bodyMatch[1] : html;
    
    // 添加 PDF 预览样式
    container.innerHTML = `
      <div class="pdf-preview-container">
        <style>
          .pdf-preview-container {
            background: white;
            padding: 20mm;
            max-width: 210mm;
            margin: 0 auto;
            box-shadow: 0 0 10px rgba(0,0,0,0.1);
          }
          .pdf-preview-container img {
            max-width: 100%;
            height: auto;
          }
        </style>
        ${bodyContent}
      </div>
    `;
    container.style.fontFamily = '';
    container.style.whiteSpace = '';
  } else {
    container.innerHTML = '<div class="empty-state">PDF generator not loaded. Please refresh.🔄</div>';
  }
}

function renderPNGPreview(data, container) {
  // PNG 预览与 PDF 类似，但提示用户使用截图工具
  if (generators?.generateStyledHTML) {
    const html = generators.generateStyledHTML(data);
    const bodyMatch = html.match(/<body[^>]*>([\s\S]*)<\/body>/i);
    const bodyContent = bodyMatch ? bodyMatch[1] : html;
    
    container.innerHTML = `
      <div class="png-preview-notice" style="background: #e8f5fd; padding: 12px; margin-bottom: 16px; border-radius: 8px; border-left: 4px solid #1d9bf0;">
        <strong>📷 PNG Export Preview</strong><br>
        <small>Use your browser screenshot tool or print to PDF and convert to PNG for best results.</small>
      </div>
      <div class="png-preview-container" style="background: white; padding: 20px; border-radius: 8px;">
        ${bodyContent}
      </div>
    `;
  } else {
    container.innerHTML = '<div class="empty-state">PNG generator not loaded. Please refresh.🔄</div>';
  }
}

function renderTweetList() {
  if (!normalizedData || !normalizedData.tweets) return;
  
  const tweetList = document.getElementById('tweetList');
  tweetList.innerHTML = '';
  
  normalizedData.tweets.forEach((tweet, index) => {
    const item = document.createElement('div');
    item.className = `tweet-item ${tweet.selected !== false ? 'selected' : ''}`;
    item.dataset.index = index;
    
    const displayText = tweet.text || '';
    const images = tweet.media?.images || [];
    const videos = tweet.media?.videos || [];
    
    item.innerHTML = `
      <input type="checkbox" ${tweet.selected !== false ? 'checked' : ''}>
      <div class="tweet-item-content">
        <div class="tweet-item-text">${escapeHtml(displayText.substring(0, 120))}${displayText.length > 120 ? '...' : ''}</div>
        <div class="tweet-item-meta">
          ${images.length > 0 ? `📷 ${images.length} ` : ''}
          ${videos.length > 0 ? `🎥 ${videos.length} ` : ''}
          ${formatTime(tweet.timestamp)}
        </div>
      </div>
    `;
    
    item.addEventListener('click', (e) => {
      if (e.target.type !== 'checkbox') {
        const checkbox = item.querySelector('input[type="checkbox"]');
        checkbox.checked = !checkbox.checked;
      }
      toggleTweetSelection(index, item);
    });
    
    item.querySelector('input[type="checkbox"]').addEventListener('change', () => {
      toggleTweetSelection(index, item);
    });
    
    tweetList.appendChild(item);
  });
  
  updateSelectedCount();
}

function toggleTweetSelection(index, element) {
  if (!normalizedData.tweets[index]) return;
  normalizedData.tweets[index].selected = !(normalizedData.tweets[index].selected !== false);
  element.classList.toggle('selected', normalizedData.tweets[index].selected !== false);
  updateSelectedCount();
  renderPreview();
}

function setAllTweetsSelected(selected) {
  normalizedData.tweets.forEach(tweet => tweet.selected = selected);
  renderTweetList();
  renderPreview();
}

function updateSelectedCount() {
  const count = getSelectedTweets().length;
  const total = normalizedData.tweets.length;
  document.getElementById('selectedCount').textContent = `${count} of ${total} selected`;
}

async function handleExport() {
  const selectedTweets = getSelectedTweets();
  
  if (selectedTweets.length === 0) {
    alert('Please select at least one tweet to export.');
    return;
  }
  
  // 创建用于导出的数据副本
  const exportData = {
    ...normalizedData,
    tweets: selectedTweets
  };
  
  switch (selectedFormat) {
    case 'markdown':
      if (generators?.generateMarkdown) {
        const content = generators.generateMarkdown(exportData);
        await downloadFile(content, 'thread.md', 'text/markdown');
      }
      break;
    case 'html':
      if (generators?.generateHTML) {
        const content = generators.generateHTML(exportData);
        await downloadFile(content, 'thread.html', 'text/html');
      }
      break;
    case 'pdf':
      generatePDF(exportData);
      break;
    case 'png':
      alert('PNG export: Please use your browser\'s screenshot tool or print to PDF and convert to PNG.');
      break;
  }
}

async function downloadFile(content, filename, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  
  await chrome.downloads.download({
    url: url,
    filename: filename,
    saveAs: true
  });
}

function generatePDF(data) {
  // Open print dialog for PDF generation
  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    alert('Please allow popups to generate PDF.');
    return;
  }
  
  if (generators?.generateStyledHTML) {
    const html = generators.generateStyledHTML(data);
    printWindow.document.write(html);
    printWindow.document.close();
    
    setTimeout(() => {
      printWindow.print();
    }, 500);
  }
}

function showError(message) {
  document.getElementById('previewContent').innerHTML = `
    <div class="empty-state" style="color: #f4212e;">
      <p>❌ ${escapeHtml(message)}</p>
    </div>
  `;
}

// Utility functions
function escapeHtml(text) {
  if (!text) return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function formatTime(isoString) {
  if (!isoString) return '';
  try {
    const date = new Date(isoString);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
}
