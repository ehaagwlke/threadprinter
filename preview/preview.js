// ThreadPrinter - Preview Page Script - 修复版
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
    console.log('[ThreadPrinter] Normalized data:', normalizedData);
    
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
  });
  
  // Line height slider
  document.getElementById('lineHeightSlider').addEventListener('input', (e) => {
    const height = e.target.value;
    document.getElementById('lineHeightValue').textContent = height;
    document.documentElement.style.setProperty('--preview-line-height', height);
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
      renderStyledPreview(previewData, previewContent, 'pdf');
      break;
    case 'png':
      renderStyledPreview(previewData, previewContent, 'png');
      break;
    default:
      previewContent.innerHTML = '<div class="empty-state">Unknown format</div>';
  }
}

function renderMarkdownPreview(data, container) {
  if (generators?.generateMarkdown) {
    const markdown = generators.generateMarkdown(data);
    container.innerHTML = `<pre class="markdown-preview"><code>${escapeHtml(markdown)}</code></pre>`;
  } else {
    // 备用：直接渲染简单格式
    container.innerHTML = renderSimpleMarkdown(data);
  }
}

function renderSimpleMarkdown(data) {
  let html = '<div class="thread-content">';
  
  // 头部
  html += '<div class="thread-header">';
  html += `<h1>${escapeHtml(data.title || 'Thread')}</h1>`;
  
  if (data.author) {
    html += '<div class="author-info">';
    if (data.authorAvatar) {
      html += `<img src="${escapeHtml(data.authorAvatar)}" alt="" class="author-avatar">`;
    }
    html += '<div class="author-details">';
    html += `<div class="author-name">${escapeHtml(data.author)}</div>`;
    if (data.authorHandle) {
      html += `<div class="author-handle">${escapeHtml(data.authorHandle)}</div>`;
    }
    html += '</div>';
    html += '</div>';
  }
  
  html += `<div class="thread-meta">Source: <a href="${data.url}" target="_blank">${escapeHtml(data.url)}</a></div>`;
  html += '</div>';
  
  // 推文列表
  html += '<div class="tweets-list">';
  data.tweets.forEach((tweet, index) => {
    html += renderTweetHTML(tweet, index);
  });
  html += '</div>';
  
  html += '</div>';
  return html;
}

function renderHTMLPreview(data, container) {
  // 直接使用 styled preview 渲染 HTML
  renderStyledPreview(data, container, 'html');
}

function renderStyledPreview(data, container, format) {
  let html = '<div class="thread-content">';
  
  // 头部
  html += '<div class="thread-header">';
  html += `<h1>${escapeHtml(data.title || 'Thread')}</h1>`;
  
  if (data.author) {
    html += '<div class="author-info">';
    if (data.authorAvatar) {
      html += `<img src="${escapeHtml(data.authorAvatar)}" alt="" class="author-avatar" onerror="this.style.display='none'">`;
    }
    html += '<div class="author-details">';
    html += `<div class="author-name">${escapeHtml(data.author)}</div>`;
    if (data.authorHandle) {
      html += `<div class="author-handle">${escapeHtml(data.authorHandle)}</div>`;
    }
    html += '</div>';
    html += '</div>';
  }
  
  html += `<div class="thread-meta">Source: <a href="${data.url}" target="_blank">${escapeHtml(data.url)}</a> · Extracted: ${new Date().toLocaleString()}</div>`;
  html += '</div>';
  
  // 推文列表
  html += '<div class="tweets-list">';
  data.tweets.forEach((tweet, index) => {
    html += renderTweetHTML(tweet, index);
  });
  html += '</div>';
  
  // 页脚
  html += `<div style="text-align: center; padding: 20px; color: #536471; font-size: 13px; border-top: 1px solid #eff3f4; margin-top: 20px;">Generated by ThreadPrinter · ${data.tweets.length} tweets</div>`;
  
  html += '</div>';
  
  // 如果是 PDF/PNG 格式，添加提示
  container.innerHTML = html;
}

function renderTweetHTML(tweet, index) {
  let html = '<div class="tweet">';
  
  // 推文头部
  html += '<div class="tweet-header">';
  if (tweet.author?.avatar) {
    html += `<img src="${escapeHtml(tweet.author.avatar)}" alt="" class="tweet-avatar" onerror="this.style.display='none'">`;
  }
  html += '<div class="tweet-author-info">';
  html += `<span class="tweet-author-name">${escapeHtml(tweet.author?.name || 'Unknown')}</span>`;
  if (tweet.author?.handle) {
    html += `<span class="tweet-author-handle">${escapeHtml(tweet.author.handle)}</span>`;
  }
  html += '</div>';
  if (tweet.displayTime) {
    html += `<span class="tweet-time">${escapeHtml(tweet.displayTime)}</span>`;
  }
  html += '</div>';
  
  // 推文文本
  if (tweet.text) {
    const formattedText = formatTweetText(tweet.text);
    html += `<div class="tweet-text">${formattedText}</div>`;
  }
  
  // 媒体
  if (tweet.media) {
    // 图片
    const images = tweet.media.images || [];
    if (images.length > 0) {
      const gridClass = images.length === 1 ? 'single-image' : 
                        images.length === 2 ? 'two-images' :
                        images.length === 3 ? 'three-images' : 'four-images';
      
      html += `<div class="tweet-media ${gridClass}">`;
      images.forEach(img => {
        const imgUrl = typeof img === 'string' ? img : img.url;
        const imgAlt = typeof img === 'string' ? '' : (img.alt || '');
        if (imgUrl) {
          html += `<img src="${escapeHtml(imgUrl)}" alt="${escapeHtml(imgAlt)}" loading="lazy" onerror="this.style.display='none'">`;
        }
      });
      html += '</div>';
    }
    
    // 视频
    const videos = tweet.media.videos || [];
    videos.forEach(video => {
      const posterUrl = video.poster || '';
      if (posterUrl) {
        html += '<div class="tweet-video">';
        html += `<img src="${escapeHtml(posterUrl)}" alt="Video thumbnail" loading="lazy" onerror="this.style.background='#333'; this.style.display='block';">`;
        html += '<div class="video-play-button"></div>';
        html += '</div>';
      } else {
        // 没有封面图时显示占位符
        html += '<div class="tweet-video" style="background: #1a1a1a; display: flex; align-items: center; justify-content: center; color: #fff;">';
        html += '<span>🎥 Video</span>';
        html += '</div>';
      }
    });
  }
  
  html += '</div>';
  return html;
}

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
      await exportViaBackground('exportPdf', exportData);
      break;
    case 'png':
      await exportViaBackground('exportPng', exportData);
      break;
  }
}

async function exportViaBackground(action, data) {
  try {
    const response = await new Promise(resolve => {
      chrome.runtime.sendMessage({ action, data }, resolve);
    });

    if (!response?.success) {
      alert(response?.error || 'Export failed.');
    }
  } catch (error) {
    alert(error?.message || 'Export failed.');
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
