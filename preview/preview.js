// ThreadPrinter - Preview Page Script

import { generateMarkdown } from '../utils/markdownGenerator.js';
import { generateHTML } from '../utils/htmlGenerator.js';
import { generateStyledHTML } from '../utils/pdfGenerator.js';

let threadData = null;
let selectedFormat = 'markdown';
let currentTheme = 'default';

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
  console.log('[ThreadPrinter] Preview page loaded');
  
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
    
    threadData = result.threadprinter_preview_data;
    selectedFormat = result.threadprinter_preview_format || 'markdown';
    
    if (!threadData) {
      showError('No thread data found. Please extract a thread first.');
      return;
    }
    
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

function renderPreview() {
  if (!threadData) return;
  
  const previewContent = document.getElementById('previewContent');
  const selectedTweets = threadData.tweets.filter(t => t.selected);
  
  if (selectedTweets.length === 0) {
    previewContent.innerHTML = `
      <div class="empty-state">
        <p>No tweets selected. Select tweets from the sidebar to preview.📭</p>
      </div>
    `;
    return;
  }
  
  const data = { ...threadData, tweets: selectedTweets };
  
  switch (selectedFormat) {
    case 'markdown':
      previewContent.innerHTML = `<pre><code>${escapeHtml(generateMarkdown(data))}</code></pre>`;
      previewContent.style.fontFamily = 'monospace';
      previewContent.style.whiteSpace = 'pre-wrap';
      break;
    case 'html':
      previewContent.innerHTML = generateHTML(data);
      previewContent.style.fontFamily = '';
      previewContent.style.whiteSpace = '';
      break;
    case 'pdf':
    case 'png':
      // For PDF/PNG, show styled HTML preview
      previewContent.innerHTML = generateStyledHTML(data);
      previewContent.style.fontFamily = '';
      previewContent.style.whiteSpace = '';
      break;
  }
}

function renderTweetList() {
  if (!threadData) return;
  
  const tweetList = document.getElementById('tweetList');
  tweetList.innerHTML = '';
  
  threadData.tweets.forEach((tweet, index) => {
    const item = document.createElement('div');
    item.className = `tweet-item ${tweet.selected ? 'selected' : ''}`;
    item.dataset.index = index;
    
    // 修正数据访问：使用 tweet.text 而不是 tweet.textPlain
    const tweetText = tweet.text || '';
    const images = tweet.media?.images || [];
    const videos = tweet.media?.videos || [];
    
    item.innerHTML = `
      <input type="checkbox" ${tweet.selected ? 'checked' : ''}>
      <div class="tweet-item-content">
        <div class="tweet-item-text">${escapeHtml(tweetText.substring(0, 120))}${tweetText.length > 120 ? '...' : ''}</div>
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
  threadData.tweets[index].selected = !threadData.tweets[index].selected;
  element.classList.toggle('selected', threadData.tweets[index].selected);
  updateSelectedCount();
  renderPreview();
}

function setAllTweetsSelected(selected) {
  threadData.tweets.forEach(tweet => tweet.selected = selected);
  renderTweetList();
  renderPreview();
}

function updateSelectedCount() {
  const count = threadData.tweets.filter(t => t.selected).length;
  document.getElementById('selectedCount').textContent = `${count} of ${threadData.tweets.length} selected`;
}

async function handleExport() {
  const selectedTweets = threadData.tweets.filter(t => t.selected);
  
  if (selectedTweets.length === 0) {
    alert('Please select at least one tweet to export.');
    return;
  }
  
  const data = { ...threadData, tweets: selectedTweets };
  
  switch (selectedFormat) {
    case 'markdown':
      await downloadFile(generateMarkdown(data), 'thread.md', 'text/markdown');
      break;
    case 'html':
      await downloadFile(generateHTML(data), 'thread.html', 'text/html');
      break;
    case 'pdf':
      generatePDF(data);
      break;
    case 'png':
      await generatePNG(data);
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
  printWindow.document.write(generateStyledHTML(data, true));
  printWindow.document.close();
  
  setTimeout(() => {
    printWindow.print();
  }, 500);
}

async function generatePNG(data) {
  // Use html2canvas for PNG generation
  // For now, alert the user to use browser screenshot or print to PDF
  alert('PNG export: Please use your browser\'s screenshot tool or print to PDF and convert to PNG.');
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
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function formatTime(isoString) {
  if (!isoString) return '';
  const date = new Date(isoString);
  return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}
