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
    const tweetElements = document.querySelectorAll('article[data-testid="tweet"]');
    
    tweetElements.forEach((tweetEl, index) => {
      const tweet = this.parseTweetElement(tweetEl, index);
      if (tweet) {
        tweets.push(tweet);
      }
    });
    
    return tweets;
  }
  
  /**
   * 解析单个推文元素
   */
  static parseTweetElement(tweetEl, index) {
    try {
      // 提取文本内容
      const textEl = tweetEl.querySelector('[data-testid="tweetText"]');
      const text = textEl ? textEl.innerText : '';
      
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
        id: `tweet-${index}`,
        text: text,
        html: textEl ? textEl.innerHTML : '',
        author: author,
        authorHandle: authorHandle,
        timestamp: timestamp,
        displayTime: displayTime,
        media: media,
        engagement: engagement,
        links: links,
        selected: true // 默认选中
      };
    } catch (error) {
      console.error('Error parsing tweet:', error);
      return null;
    }
  }
  
  /**
   * 提取作者名
   */
  static extractAuthorName(userEl) {
    if (!userEl) return '';
    
    // 尝试多种选择器
    const nameEl = userEl.querySelector('a[role="link"] span span');
    if (nameEl) return nameEl.innerText;
    
    // 备用方案
    const spans = userEl.querySelectorAll('span');
    for (const span of spans) {
      const text = span.innerText.trim();
      if (text && !text.startsWith('@')) {
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
    
    const handleEl = userEl.querySelector('a[href^="/"] span');
    if (handleEl) {
      const text = handleEl.innerText.trim();
      if (text.startsWith('@')) return text;
    }
    
    // 备用方案
    const spans = userEl.querySelectorAll('span');
    for (const span of spans) {
      const text = span.innerText.trim();
      if (text.startsWith('@')) {
        return text;
      }
    }
    
    return '';
  }
  
  /**
   * 提取媒体内容
   */
  static extractMedia(tweetEl) {
    const media = {
      images: [],
      videos: []
    };
    
    // 提取图片
    const photoContainer = tweetEl.querySelector('[data-testid="tweetPhoto"]');
    if (photoContainer) {
      const images = photoContainer.querySelectorAll('img');
      images.forEach(img => {
        const src = img.getAttribute('src');
        const alt = img.getAttribute('alt') || '';
        if (src) {
          media.images.push({
            url: src,
            alt: alt,
            width: img.naturalWidth || 0,
            height: img.naturalHeight || 0
          });
        }
      });
    }
    
    // 提取视频
    const videoContainer = tweetEl.querySelector('[data-testid="videoPlayer"]');
    if (videoContainer) {
      const videoSrc = this.extractVideoSource(videoContainer);
      const poster = videoContainer.querySelector('img');
      media.videos.push({
        url: videoSrc || '',
        poster: poster ? poster.getAttribute('src') : ''
      });
    }
    
    // 提取卡片（链接预览）
    const card = tweetEl.querySelector('[data-testid="card.wrapper"]');
    if (card) {
      const cardLink = card.querySelector('a');
      const cardImage = card.querySelector('img');
      const cardTitle = card.querySelector('[data-testid="card.layoutSmall.detail"]');
      
      media.card = {
        url: cardLink ? cardLink.getAttribute('href') : '',
        image: cardImage ? cardImage.getAttribute('src') : '',
        title: cardTitle ? cardTitle.innerText : ''
      };
    }
    
    return media;
  }
  
  /**
   * 提取视频源
   */
  static extractVideoSource(videoContainer) {
    // X/Twitter 视频通常是动态加载的，尝试获取视频元素
    const video = videoContainer.querySelector('video');
    if (video) {
      return video.getAttribute('src') || '';
    }
    
    // 尝试从 data 属性获取
    const videoData = videoContainer.querySelector('[data-media-key]');
    if (videoData) {
      return videoData.getAttribute('data-media-key') || '';
    }
    
    return '';
  }
  
  /**
   * 提取互动数据（点赞、转发、回复数）
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
      
      // 查看次数（可能不在所有推文中显示）
      const analyticsEl = tweetEl.querySelector('[aria-label*="view"]');
      if (analyticsEl) {
        const count = analyticsEl.querySelector('span');
        engagement.views = this.parseCount(count ? count.innerText : '0');
      }
    } catch (error) {
      console.error('Error extracting engagement:', error);
    }
    
    return engagement;
  }
  
  /**
   * 解析数字（处理 K、M 等后缀）
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
      
      // 过滤掉 t.co 短链接的显示文本
      if (href && !href.includes('t.co')) {
        links.push({
          url: href,
          text: text
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
      // 获取第一个推文作为线程信息来源
      const firstTweet = document.querySelector('article[data-testid="tweet"]');
      if (firstTweet) {
        const userEl = firstTweet.querySelector('[data-testid="User-Name"]');
        info.author = this.extractAuthorName(userEl);
        info.authorHandle = this.extractAuthorHandle(userEl);
        
        // 获取头像
        const avatarEl = firstTweet.querySelector('img[src*="profile"], img[alt*="profile"]');
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
      console.error('Error extracting thread info:', error);
    }
    
    return info;
  }
  
  /**
   * 使用 Readability.js 提取通用内容
   * 用于非 X/Twitter 网站
   */
  static extractGenericContent() {
    try {
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
      console.error('Readability error:', error);
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
console.log('ThreadPrinter: Content script loaded');

// 监听来自 popup 的消息
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  // 响应 ping 检查
  if (request.action === 'ping') {
    sendResponse({ pong: true });
    return true;
  }
  
  if (request.action === 'extractThread') {
    try {
      const data = ContentExtractor.extract();
      // 包装数据以匹配 popup.js 期望的格式
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
    return true; // 保持消息通道开放
  }
});
