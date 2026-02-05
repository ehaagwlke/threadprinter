import { generateStyledHTML } from './utils/pdfGenerator.js';

chrome.runtime.onInstalled.addListener((details) => {
  console.log('[ThreadPrinter] Extension installed', details.reason);
  
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

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('[ThreadPrinter] Background received message:', request.action);
  
  switch (request.action) {
    case 'openPreview':
      openPreviewPage(request.data);
      sendResponse({ success: true });
      break;
      
    case 'downloadFile':
      handleDownload(request.data).then(() => sendResponse({ success: true })).catch(err => {
        sendResponse({ success: false, error: err?.message || String(err) });
      });
      return true;

    case 'exportPng':
      exportAsPng(request.data).then(() => sendResponse({ success: true })).catch(err => {
        console.error('[ThreadPrinter] PNG export failed:', err);
        sendResponse({ success: false, error: err?.message || String(err) });
      });
      return true;

    case 'exportPdf':
      exportAsPdf(request.data).then(() => sendResponse({ success: true })).catch(err => {
        console.error('[ThreadPrinter] PDF export failed:', err);
        sendResponse({ success: false, error: err?.message || String(err) });
      });
      return true;
      
    case 'getSettings':
      getSettings().then(settings => {
        sendResponse({ success: true, settings });
      });
      return true;
      
    case 'saveSettings':
      saveSettings(request.data).then(() => {
        sendResponse({ success: true });
      });
      return true;

    case 'fetchSyndication':
      fetchSyndication(request.data).then(data => {
        sendResponse({ success: true, data });
      }).catch(err => {
        sendResponse({ success: false, error: err?.message || String(err) });
      });
      return true;
  }
  
  return true;
});

async function fetchSyndication({ url }) {
  const resp = await fetch(url, { credentials: 'omit', cache: 'no-store' });
  if (!resp.ok) throw new Error(`syndication http ${resp.status}`);
  return await resp.json();
}

function openPreviewPage(data) {
  chrome.storage.local.set({
    'threadprinter_preview_data': data,
    'threadprinter_preview_format': data.format || 'markdown'
  }, () => {
    const previewUrl = chrome.runtime.getURL('preview/preview.html');
    chrome.tabs.create({ url: previewUrl });
  });
}

async function handleDownload(data) {
  const { content, filename, mimeType } = data;
  const safeType = mimeType || 'application/octet-stream';
  const url = `data:${safeType};charset=utf-8,${encodeURIComponent(String(content ?? ''))}`;

  await chrome.downloads.download({
    url,
    filename,
    saveAs: true
  });
}

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

async function saveSettings(settings) {
  await chrome.storage.local.set({ 'threadprinter_settings': settings });
}

async function exportAsPdf(data) {
  const html = generateStyledHTML(data, true);
  const tabId = await createHiddenTabFromHtml(html);
  try {
    await attachDebugger(tabId);
    await waitForDocumentReady(tabId);
    const pdfData = await sendCommand(tabId, 'Page.printToPDF', {
      printBackground: true,
      preferCSSPageSize: true,
      displayHeaderFooter: false,
      marginTop: 0,
      marginBottom: 0,
      marginLeft: 0,
      marginRight: 0
    });
    await downloadBase64(pdfData.data, 'application/pdf', `thread-${Date.now()}.pdf`);
  } finally {
    await safeDetachDebugger(tabId);
    await safeCloseTab(tabId);
  }
}

async function exportAsPng(data) {
  const html = generateStyledHTML(data, false);
  const tabId = await createHiddenTabFromHtml(html);
  try {
    await attachDebugger(tabId);
    await waitForDocumentReady(tabId);
    await sendCommand(tabId, 'Page.enable');
    await sendCommand(tabId, 'Runtime.enable');
    await setViewportToContent(tabId);
    const pngBlob = await captureFullPagePng(tabId);
    await downloadBlob(pngBlob, `thread-${Date.now()}.png`);
  } finally {
    await safeDetachDebugger(tabId);
    await safeCloseTab(tabId);
  }
}

async function createHiddenTabFromHtml(html) {
  const url = `data:text/html;charset=utf-8,${encodeURIComponent(String(html))}`;
  const tab = await chrome.tabs.create({ url, active: false });
  await waitForTabComplete(tab.id);
  return tab.id;
}

function waitForTabComplete(tabId, timeoutMs = 10_000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      chrome.tabs.onUpdated.removeListener(listener);
      reject(new Error('Tab load timeout'));
    }, timeoutMs);

    const listener = (updatedTabId, changeInfo) => {
      if (updatedTabId !== tabId) return;
      if (changeInfo.status !== 'complete') return;
      clearTimeout(timer);
      chrome.tabs.onUpdated.removeListener(listener);
      resolve();
    };

    chrome.tabs.onUpdated.addListener(listener);
  });
}

function attachDebugger(tabId) {
  return new Promise((resolve, reject) => {
    chrome.debugger.attach({ tabId }, '1.3', () => {
      const err = chrome.runtime.lastError;
      if (err) return reject(new Error(err.message));
      resolve();
    });
  });
}

async function safeDetachDebugger(tabId) {
  try {
    await new Promise((resolve) => {
      chrome.debugger.detach({ tabId }, () => resolve());
    });
  } catch {}
}

async function safeCloseTab(tabId) {
  try {
    await chrome.tabs.remove(tabId);
  } catch {}
}

function sendCommand(tabId, method, params = {}) {
  return new Promise((resolve, reject) => {
    chrome.debugger.sendCommand({ tabId }, method, params, (result) => {
      const err = chrome.runtime.lastError;
      if (err) return reject(new Error(err.message));
      resolve(result);
    });
  });
}

async function waitForDocumentReady(tabId, timeoutMs = 12_000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const { result } = await sendCommand(tabId, 'Runtime.evaluate', {
      expression: `(() => {
        const ready = document.readyState === 'complete';
        const imagesOk = Array.from(document.images || []).every(img => img.complete);
        return ready && imagesOk;
      })()`,
      returnByValue: true
    });

    if (result?.value === true) return;
    await delay(150);
  }
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function setViewportToContent(tabId) {
  const metrics = await sendCommand(tabId, 'Page.getLayoutMetrics');
  const contentWidth = Math.ceil(metrics.contentSize.width || metrics.cssContentSize?.width || 1200);
  const contentHeight = Math.ceil(metrics.contentSize.height || metrics.cssContentSize?.height || 800);

  const maxDim = 16000;
  let deviceScaleFactor = 2;
  if (contentWidth * deviceScaleFactor > maxDim) deviceScaleFactor = Math.max(1, Math.floor(maxDim / contentWidth));
  if (contentHeight * deviceScaleFactor > maxDim) deviceScaleFactor = Math.max(1, Math.floor(maxDim / contentHeight));

  await sendCommand(tabId, 'Emulation.setDeviceMetricsOverride', {
    mobile: false,
    width: Math.min(contentWidth, maxDim),
    height: Math.min(900, maxDim),
    deviceScaleFactor,
    screenOrientation: { angle: 0, type: 'portraitPrimary' }
  });
}

async function captureFullPagePng(tabId) {
  const metrics = await sendCommand(tabId, 'Page.getLayoutMetrics');
  const contentWidth = Math.ceil(metrics.contentSize.width || metrics.cssContentSize?.width || 1200);
  const contentHeight = Math.ceil(metrics.contentSize.height || metrics.cssContentSize?.height || 800);

  const maxClipHeight = 7000;
  const tiles = [];

  for (let y = 0; y < contentHeight; y += maxClipHeight) {
    const height = Math.min(maxClipHeight, contentHeight - y);
    const shot = await sendCommand(tabId, 'Page.captureScreenshot', {
      format: 'png',
      clip: { x: 0, y, width: contentWidth, height, scale: 1 },
      fromSurface: true
    });
    tiles.push({ y, data: shot.data, clipHeight: height });
  }

  if (tiles.length === 1) {
    return base64ToBlob(tiles[0].data, 'image/png');
  }

  const firstBitmap = await base64PngToImageBitmap(tiles[0].data);
  const scale = firstBitmap.width / contentWidth;
  const outputWidth = Math.round(contentWidth * scale);
  const outputHeight = Math.round(contentHeight * scale);

  const canvas = new OffscreenCanvas(outputWidth, outputHeight);
  const ctx = canvas.getContext('2d');
  ctx.drawImage(firstBitmap, 0, 0);
  firstBitmap.close();

  for (let i = 1; i < tiles.length; i++) {
    const bmp = await base64PngToImageBitmap(tiles[i].data);
    const dy = Math.round(tiles[i].y * scale);
    ctx.drawImage(bmp, 0, dy);
    bmp.close();
  }

  const blob = await canvas.convertToBlob({ type: 'image/png' });
  return blob;
}

function base64ToBlob(base64, mimeType) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mimeType });
}

async function base64PngToImageBitmap(base64) {
  const blob = base64ToBlob(base64, 'image/png');
  return createImageBitmap(blob);
}

async function downloadBlob(blob, filename) {
  const mimeType = blob?.type || 'application/octet-stream';
  const base64 = arrayBufferToBase64(await blob.arrayBuffer());
  await downloadBase64(base64, mimeType, filename);
}

async function downloadBase64(base64, mimeType, filename) {
  const url = `data:${mimeType || 'application/octet-stream'};base64,${base64}`;
  await chrome.downloads.download({
    url,
    filename,
    saveAs: true
  });
}

function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  let binary = '';
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
}

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url) {
    if ((tab.url.includes('twitter.com') || tab.url.includes('x.com')) &&
        /\/(status|statuses)\/\d+/.test(tab.url)) {
      console.log('[ThreadPrinter] Thread page detected:', tab.url);
    }
  }
});
