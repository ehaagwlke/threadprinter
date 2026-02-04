// ThreadPrinter - Background Service Worker
// Handles background tasks and messaging

chrome.runtime.onInstalled.addListener((details) => {
  console.log('[ThreadPrinter] Extension installed', details.reason);
  
  // Set default settings
  chrome.storage.local.set({
    'threadprinter_settings': {
      defaultFormat: 'markdown',
      defaultTheme: 'default',
      includeImages: true,
      includeVideos: true,
      includeStats: true
    }
  });
});

// Handle messages from content scripts and popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('[ThreadPrinter] Background received message:', request.action);
  
  switch (request.action) {
    case 'openPreview':
      openPreviewPage(request.data);
      sendResponse({ success: true });
      break;
      
    case 'downloadFile':
      handleDownload(request.data);
      sendResponse({ success: true });
      break;
      
    case 'getSettings':
      getSettings().then(settings => {
        sendResponse({ success: true, settings });
      });
      return true; // Keep channel open
      
    case 'saveSettings':
      saveSettings(request.data).then(() => {
        sendResponse({ success: true });
      });
      return true;
  }
  
  return true;
});

// Open preview page with thread data
function openPreviewPage(data) {
  // Store data temporarily
  chrome.storage.local.set({
    'threadprinter_preview_data': data,
    'threadprinter_preview_format': data.format || 'markdown'
  }, () => {
    const previewUrl = chrome.runtime.getURL('preview/preview.html');
    chrome.tabs.create({ url: previewUrl });
  });
}

// Handle file download
async function handleDownload(data) {
  const { content, filename, mimeType } = data;
  
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  
  try {
    await chrome.downloads.download({
      url: url,
      filename: filename,
      saveAs: true
    });
  } catch (error) {
    console.error('[ThreadPrinter] Download failed:', error);
  }
}

// Get settings
async function getSettings() {
  const result = await chrome.storage.local.get('threadprinter_settings');
  return result.threadprinter_settings || {
    defaultFormat: 'markdown',
    defaultTheme: 'default',
    includeImages: true,
    includeVideos: true,
    includeStats: true
  };
}

// Save settings
async function saveSettings(settings) {
  await chrome.storage.local.set({ 'threadprinter_settings': settings });
}

// Handle tab updates - inject content script if needed
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url) {
    // Check if this is a Twitter/X thread
    if ((tab.url.includes('twitter.com') || tab.url.includes('x.com')) &&
        /\/(status|statuses)\/\d+/.test(tab.url)) {
      console.log('[ThreadPrinter] Thread page detected:', tab.url);
    }
  }
});
