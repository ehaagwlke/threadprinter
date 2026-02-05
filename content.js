/**
 * ThreadPrinter - Content Script
 * 在 X/Twitter 页面中执行，提取线程内容
 */

/**
 * 内容提取器类
 * 专门处理 X/Twitter 线程内容的提取
 */
class ContentExtractor {
  /**
   * 主提取入口
   */
  static extract() {
    const url = window.location.href;
    
    if (this.isTwitter(url)) {
      return this.extractTwitterThread();
    }
    
    return this.extractGenericContent();
  }
  
  /**
   * 检查是否为 X/Twitter 网站
   */
  static isTwitter(url) {
    return /twitter\.com|x\.com/.test(url);
  }

  static getCurrentStatusId() {
    const match = window.location.pathname.match(/\/status(?:es)?\/(\d+)/);
    return match ? match[1] : '';
  }

  static getTweetStatusId(tweetEl) {
    if (!tweetEl) return '';
    const links = tweetEl.querySelectorAll('a[href*="/status/"]');
    for (const a of links) {
      const href = a.getAttribute('href') || '';
      const match = href.match(/\/status\/(\d+)/);
      if (match) return match[1];
    }
    return '';
  }

  static getTweetElements() {
    let tweetElements = document.querySelectorAll('article[data-testid="tweet"]');
    if (tweetElements.length === 0) {
      tweetElements = document.querySelectorAll('article[tabindex="0"]');
    }
    return tweetElements;
  }

  static findMainTweetElement() {
    const statusId = this.getCurrentStatusId();
    const tweetElements = this.getTweetElements();
    if (!statusId || tweetElements.length === 0) return tweetElements[0] || null;

    for (const tweetEl of tweetElements) {
      const tweetStatusId = this.getTweetStatusId(tweetEl);
      if (tweetStatusId && tweetStatusId === statusId) return tweetEl;
    }

    return tweetElements[0] || null;
  }

  static waitForTweetsReady({ timeoutMs = 4000, intervalMs = 120 } = {}) {
    const start = Date.now();
    return new Promise(resolve => {
      const tick = () => {
        const mainTweet = this.findMainTweetElement();
        if (mainTweet) {
          const text = this.extractTweetText(mainTweet);
          if (text) return resolve(true);
        }

        if (Date.now() - start >= timeoutMs) return resolve(false);
        setTimeout(tick, intervalMs);
      };

      tick();
    });
  }
  
  /**
   * 提取 X/Twitter 线程内容
   */
  static extractTwitterThread() {
    const tweets = this.extractTweets();
    const threadInfo = this.extractThreadInfo();
    
    return {
      type: 'twitter_thread',
      url: window.location.href,
      title: threadInfo.title || document.title,
      author: threadInfo.author,
      authorHandle: threadInfo.authorHandle,
      authorAvatar: threadInfo.authorAvatar,
      publishedTime: threadInfo.publishedTime,
      tweetCount: tweets.length,
      tweets: tweets,
      extractedAt: new Date().toISOString(),
      siteName: 'X (Twitter)'
    };
  }
  
  /**
   * 提取所有推文
   */
  static extractTweets() {
    const tweets = [];
    const tweetElements = this.getTweetElements();
    const currentStatusId = this.getCurrentStatusId();
    
    console.log(`[ThreadPrinter] Found ${tweetElements.length} tweet elements`);
    
    tweetElements.forEach((tweetEl, index) => {
      const tweet = this.parseTweetElement(tweetEl, index, currentStatusId);
      if (tweet && (tweet.text || (tweet.media?.images?.length || 0) > 0 || (tweet.media?.videos?.length || 0) > 0)) {
        tweets.push(tweet);
      }
    });

    if (currentStatusId && !tweets.some(t => t.statusId === currentStatusId)) {
      const metaText = this.extractMainTweetTextFromMeta();
      if (metaText) {
        const threadInfo = this.extractThreadInfo();
        tweets.unshift({
          index: 0,
          id: `tweet-${currentStatusId}`,
          statusId: currentStatusId,
          text: metaText,
          textPlain: metaText,
          html: '',
          author: threadInfo.author,
          authorHandle: threadInfo.authorHandle,
          timestamp: threadInfo.publishedTime,
          displayTime: '',
          media: { images: [], videos: [] },
          engagement: { replies: 0, retweets: 0, likes: 0, views: 0 },
          links: [],
          selected: true
        });
      }
    }
    
    return tweets;
  }
  
  /**
   * 解析单个推文元素
   */
  static parseTweetElement(tweetEl, index, currentStatusId = '') {
    try {
      // 提取文本内容 - 支持普通推文和长文
      let text = this.extractTweetText(tweetEl);
      const statusId = this.getTweetStatusId(tweetEl);

      if (!text && currentStatusId && statusId && statusId === currentStatusId) {
        text = this.extractMainTweetTextFromMeta() || text;
      }
      
      // 提取作者信息
      const userEl = tweetEl.querySelector('[data-testid="User-Name"]');
      const author = this.extractAuthorName(userEl);
      const authorHandle = this.extractAuthorHandle(userEl);
      
      // 提取时间
      const timeEl = tweetEl.querySelector('time');
      const timestamp = timeEl ? timeEl.getAttribute('datetime') : '';
      const displayTime = timeEl ? timeEl.innerText : '';
      
      // 提取媒体内容
      const media = this.extractMedia(tweetEl);
      
      // 提取互动数据
      const engagement = this.extractEngagement(tweetEl);
      
      // 提取链接
      const links = this.extractLinks(tweetEl);
      
      return {
        index: index,
        id: statusId ? `tweet-${statusId}` : `tweet-${index}`,
        statusId: statusId || '',
        text: text,
        textPlain: text,
        html: '',
        author: author,
        authorHandle: authorHandle,
        timestamp: timestamp,
        displayTime: displayTime,
        media: media,
        engagement: engagement,
        links: links,
        selected: true
      };
    } catch (error) {
      console.error('[ThreadPrinter] Error parsing tweet:', error);
      return null;
    }
  }
  
  /**
   * 提取推文文本 - 改进版本
   */
  static extractTweetText(tweetEl) {
    const candidates = [];

    tweetEl.querySelectorAll('[data-testid="tweetText"]').forEach(el => candidates.push(el));

    tweetEl.querySelectorAll('div[lang]').forEach(el => {
      if (el.closest('[data-testid="tweetPhoto"]')) return;
      if (el.closest('[data-testid="videoPlayer"]')) return;
      if (el.closest('[data-testid="card.wrapper"]')) return;
      candidates.push(el);
    });

    tweetEl.querySelectorAll('div[dir="auto"]').forEach(el => candidates.push(el));

    let best = '';
    for (const el of candidates) {
      const raw = (el.innerText || el.textContent || '').trim();
      const cleaned = this.normalizeTweetText(raw);
      if (cleaned.length > best.length) best = cleaned;
    }

    return best;
  }

  static normalizeTweetText(text) {
    if (!text) return '';
    let t = String(text);
    t = t.replace(/\r/g, '').replace(/\u00a0/g, ' ');
    t = t.replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n');
    t = t.replace(/\u200b/g, '').trim();

    const junk = [
      'Show more',
      'Show less',
      'Read more',
      'Translate Tweet',
      '查看翻译',
      '翻译推文',
      '显示更多',
      '显示更少',
      '阅读更多'
    ];

    for (const s of junk) {
      if (!t) break;
      t = t.split(s).join('');
    }

    return t.trim();
  }

  static extractMainTweetTextFromMeta() {
    const selectors = [
      'meta[property="og:description"]',
      'meta[name="twitter:description"]',
      'meta[property="twitter:description"]',
      'meta[name="description"]'
    ];

    for (const sel of selectors) {
      const el = document.querySelector(sel);
      const content = (el && el.getAttribute('content')) ? el.getAttribute('content').trim() : '';
      if (!content) continue;

      const normalized = this.normalizeTweetText(content);
      if (!normalized) continue;

      const match = normalized.match(/^(.*?)(?:\s*—\s*[^—]{1,80}\s*\(@[^)]+\)\s*)$/);
      return match ? match[1].trim() : normalized;
    }

    return '';
  }
  
  /**
   * 提取作者名
   */
  static extractAuthorName(userEl) {
    if (!userEl) return '';
    
    // 尝试多种选择器
    const nameEl = userEl.querySelector('a[role="link"] span span');
    if (nameEl) return nameEl.innerText;
    
    // 备用方案: 查找第一个非 @ 开头的 span
    const spans = userEl.querySelectorAll('span');
    for (const span of spans) {
      const text = span.innerText?.trim();
      if (text && !text.startsWith('@') && text.length > 0 && text.length < 50) {
        return text;
      }
    }
    
    return '';
  }
  
  /**
   * 提取作者 handle
   */
  static extractAuthorHandle(userEl) {
    if (!userEl) return '';
    
    // 尝试找到 @ 开头的文本
    const spans = userEl.querySelectorAll('span');
    for (const span of spans) {
      const text = span.innerText?.trim();
      if (text && text.startsWith('@')) {
        return text;
      }
    }
    
    return '';
  }
  
  /**
   * 提取媒体内容 - 改进版本
   */
  static extractMedia(tweetEl) {
    const media = {
      images: [],
      videos: []
    };
    
    // ===== 提取图片 - 改进版本 =====
    // 方法1: 查找所有 tweetPhoto 容器（X 使用多个独立的 photo 容器）
    const photoContainers = tweetEl.querySelectorAll('[data-testid="tweetPhoto"]');
    console.log(`[ThreadPrinter] Found ${photoContainers.length} photo containers`);
    
    photoContainers.forEach(container => {
      // 获取高质量图片（优先选择 src 包含 larger 或 name=large 的图片）
      const images = container.querySelectorAll('img');
      images.forEach(img => {
        // 尝试获取最高质量的图片 URL
        let src = img.getAttribute('src') || '';
        
        // 如果是缩略图，尝试转换为原图 URL
        // X/Twitter 图片 URL 格式: .../name=small 或 name=medium 或 name=large
        if (src.includes('name=')) {
          src = src.replace(/name=\w+/, 'name=large');
        }
        
        if (src && !src.includes('profile_images') && !src.includes('emoji')) {
          media.images.push({
            url: src,
            alt: img.getAttribute('alt') || '',
            width: img.naturalWidth || 0,
            height: img.naturalHeight || 0
          });
          console.log(`[ThreadPrinter] Added image: ${src.substring(0, 100)}...`);
        }
      });
    });
    
    // 方法2: 如果上面没找到，尝试更通用的图片选择
    if (media.images.length === 0) {
      const allImages = tweetEl.querySelectorAll('img');
      allImages.forEach(img => {
        const src = img.getAttribute('src') || '';
        // 过滤掉头像、表情等
        if (src && 
            (src.includes('pbs.twimg.com/media') || src.includes('twimg.com')) &&
            !src.includes('profile_images') &&
            !src.includes('emoji')) {
          media.images.push({
            url: src,
            alt: img.getAttribute('alt') || '',
            width: img.naturalWidth || 0,
            height: img.naturalHeight || 0
          });
        }
      });
    }
    
    // ===== 提取视频 - 改进版本 =====
    const videoContainers = tweetEl.querySelectorAll('[data-testid="videoPlayer"]');
    console.log(`[ThreadPrinter] Found ${videoContainers.length} video containers`);
    
    videoContainers.forEach(container => {
      // 查找视频封面图 - 优先获取 poster 属性
      let posterUrl = '';
      const videoEl = container.querySelector('video');
      if (videoEl) {
        posterUrl = videoEl.getAttribute('poster') || '';
      }
      
      // 如果没找到 poster，尝试查找容器内的图片
      if (!posterUrl) {
        const imgEl = container.querySelector('img');
        if (imgEl) {
          posterUrl = imgEl.getAttribute('src') || '';
        }
      }
      
      // 查找视频缩略图（X 通常使用特定类）
      if (!posterUrl) {
        const thumbDiv = container.querySelector('[style*="background-image"]');
        if (thumbDiv) {
          const style = thumbDiv.getAttribute('style') || '';
          const match = style.match(/url\(["']?([^"')]+)["']?\)/);
          if (match) {
            posterUrl = match[1];
          }
        }
      }
      
      media.videos.push({
        url: '',
        poster: posterUrl
      });
      
      console.log(`[ThreadPrinter] Added video poster: ${posterUrl.substring(0, 100)}...`);
    });
    
    // ===== 提取卡片（链接预览）=====
    const card = tweetEl.querySelector('[data-testid="card.wrapper"], [data-testid="card.layoutSmall"], [data-testid="card.layoutLarge"]');
    if (card) {
      const cardLink = card.querySelector('a');
      const cardImage = card.querySelector('img');
      const cardTitleEl = card.querySelector('[data-testid="card.layoutSmall.detail"] span, [data-testid="card.layoutLarge.detail"] span');
      
      media.card = {
        url: cardLink ? cardLink.getAttribute('href') : '',
        image: cardImage ? cardImage.getAttribute('src') : '',
        title: cardTitleEl ? cardTitleEl.innerText : ''
      };
    }
    
    return media;
  }
  
  /**
   * 提取互动数据
   */
  static extractEngagement(tweetEl) {
    const engagement = {
      replies: 0,
      retweets: 0,
      likes: 0,
      views: 0
    };
    
    try {
      // 回复
      const replyEl = tweetEl.querySelector('[data-testid="reply"]');
      if (replyEl) {
        const count = replyEl.querySelector('span');
        engagement.replies = this.parseCount(count ? count.innerText : '0');
      }
      
      // 转发
      const retweetEl = tweetEl.querySelector('[data-testid="retweet"]');
      if (retweetEl) {
        const count = retweetEl.querySelector('span');
        engagement.retweets = this.parseCount(count ? count.innerText : '0');
      }
      
      // 点赞
      const likeEl = tweetEl.querySelector('[data-testid="like"]');
      if (likeEl) {
        const count = likeEl.querySelector('span');
        engagement.likes = this.parseCount(count ? count.innerText : '0');
      }
    } catch (error) {
      console.error('[ThreadPrinter] Error extracting engagement:', error);
    }
    
    return engagement;
  }
  
  /**
   * 解析数字
   */
  static parseCount(text) {
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
   * 提取推文中的链接
   */
  static extractLinks(tweetEl) {
    const links = [];
    const linkElements = tweetEl.querySelectorAll('a[href^="http"]');
    
    linkElements.forEach(link => {
      const href = link.getAttribute('href');
      const text = link.innerText;
      
      // 过滤掉 t.co 短链接的显示文本，但保留 URL
      if (href) {
        links.push({
          url: href,
          text: text || href
        });
      }
    });
    
    return links;
  }
  
  /**
   * 提取线程整体信息
   */
  static extractThreadInfo() {
    const info = {
      title: document.title,
      author: '',
      authorHandle: '',
      authorAvatar: '',
      publishedTime: ''
    };
    
    try {
      const firstTweet = this.findMainTweetElement() || document.querySelector('article[data-testid="tweet"]');
      if (firstTweet) {
        const userEl = firstTweet.querySelector('[data-testid="User-Name"]');
        info.author = this.extractAuthorName(userEl);
        info.authorHandle = this.extractAuthorHandle(userEl);
        
        // 获取头像 - 使用更精确的选择器
        const avatarEl = firstTweet.querySelector('img[src*="profile_images"]');
        if (avatarEl) {
          info.authorAvatar = avatarEl.getAttribute('src') || '';
        }
        
        // 获取发布时间
        const timeEl = firstTweet.querySelector('time');
        if (timeEl) {
          info.publishedTime = timeEl.getAttribute('datetime') || '';
        }
      }
    } catch (error) {
      console.error('[ThreadPrinter] Error extracting thread info:', error);
    }
    
    return info;
  }
  
  /**
   * 使用 Readability.js 提取通用内容
   */
  static extractGenericContent() {
    try {
      // 检查 Readability 是否可用
      if (typeof Readability === 'undefined') {
        console.error('[ThreadPrinter] Readability.js not loaded');
        return {
          type: 'generic',
          url: window.location.href,
          title: document.title,
          content: '',
          error: 'Readability.js not available'
        };
      }
      
      const documentClone = document.cloneNode(true);
      const article = new Readability(documentClone).parse();
      
      if (!article) {
        return {
          type: 'generic',
          url: window.location.href,
          title: document.title,
          content: '',
          error: 'Failed to parse content'
        };
      }
      
      return {
        type: 'generic',
        url: window.location.href,
        title: article.title,
        content: article.content,
        textContent: article.textContent,
        excerpt: article.excerpt,
        byline: article.byline,
        publishedTime: article.publishedTime,
        siteName: article.siteName,
        lang: article.lang,
        length: article.length,
        extractedAt: new Date().toISOString()
      };
    } catch (error) {
      console.error('[ThreadPrinter] Readability error:', error);
      return {
        type: 'generic',
        url: window.location.href,
        title: document.title,
        content: '',
        error: error.message
      };
    }
  }
}

// 在页面加载完成后，向 background script 报告
console.log('[ThreadPrinter] Content script loaded');

// 监听来自 popup 的消息
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  // 响应 ping 检查
  if (request.action === 'ping') {
    sendResponse({ pong: true });
    return true;
  }
  
  if (request.action === 'extractThread') {
    console.log('[ThreadPrinter] Extracting thread...');

    (async () => {
      try {
        await ContentExtractor.waitForTweetsReady();
        const data = ContentExtractor.extract();
        console.log(`[ThreadPrinter] Extracted ${data.tweetCount} tweets with ${data.tweets.reduce((c, t) => c + (t.media?.images?.length || 0), 0)} images`);
        
        const wrappedData = {
          metadata: {
            author: {
              name: data.author,
              handle: data.authorHandle,
              avatar: data.authorAvatar
            },
            title: data.title,
            url: data.url,
            publishedTime: data.publishedTime
          },
          stats: {
            tweetCount: data.tweetCount,
            imageCount: data.tweets.reduce((count, tweet) => count + (tweet.media?.images?.length || 0), 0)
          },
          tweets: data.tweets,
          type: data.type,
          siteName: data.siteName,
          extractedAt: data.extractedAt
        };
        
        sendResponse({ success: true, data: wrappedData });
      } catch (error) {
        console.error('[ThreadPrinter] Extraction error:', error);
        sendResponse({ success: false, error: error.message });
      }
    })();

    return true;
  }
});
