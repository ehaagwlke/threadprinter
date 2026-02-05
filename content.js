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
    // X/Twitter 的推文选择器 - 尝试多种可能的选择器
    let tweetElements = document.querySelectorAll('article[data-testid="tweet"]');
    
    // 如果找不到，尝试备用选择器
    if (tweetElements.length === 0) {
      tweetElements = document.querySelectorAll('article[tabindex="0"]');
    }
    
    console.log(`[ThreadPrinter] Found ${tweetElements.length} tweet elements`);
    
    tweetElements.forEach((tweetEl, index) => {
      const tweet = this.parseTweetElement(tweetEl, index);
      if (tweet && tweet.text) {
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
      // 提取文本内容 - 支持普通推文和长文
      let text = this.extractTweetText(tweetEl);
      
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
    let text = '';
    
    // 方法1: 标准 tweetText 选择器
    let textEl = tweetEl.querySelector('[data-testid="tweetText"]');
    
    // 方法2: 查找带 lang 属性的 div（包含文本内容）
    if (!textEl) {
      const langDivs = tweetEl.querySelectorAll('div[lang]');
      for (const div of langDivs) {
        // 确保不是媒体或元数据区域
        if (!div.closest('[data-testid="tweetPhoto"]') && 
            !div.closest('[data-testid="videoPlayer"]') &&
            !div.closest('[data-testid="card.wrapper"]')) {
          textEl = div;
          break;
        }
      }
    }
    
    // 方法3: 查找包含直接文本内容的元素
    if (!textEl) {
      const allDivs = tweetEl.querySelectorAll('div[dir="auto"]');
      for (const div of allDivs) {
        const text = div.innerText?.trim();
        if (text && text.length > 5 && !text.includes('·')) {
          textEl = div;
          break;
        }
      }
    }
    
    if (textEl) {
      // 克隆元素以便处理
      const clone = textEl.cloneNode(true);
      
      // 将 <br> 转换为换行符
      clone.querySelectorAll('br').forEach(br => br.replaceWith('\n'));
      
      // 移除隐藏元素
      clone.querySelectorAll('[style*="display: none"]').forEach(el => el.remove());
      
      // 获取纯文本
      text = clone.innerText || '';
      
      // 清理文本
      text = text.trim();
    }
    
    return text;
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
      // 获取第一个推文作为线程信息来源
      const firstTweet = document.querySelector('article[data-testid="tweet"]');
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
    
    try {
      const data = ContentExtractor.extract();
      console.log(`[ThreadPrinter] Extracted ${data.tweetCount} tweets with ${data.tweets.reduce((c, t) => c + (t.media?.images?.length || 0), 0)} images`);
      
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
    return true;
  }
});
