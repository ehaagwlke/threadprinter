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

  static async extractAsync() {
    const url = window.location.href;
    
    if (this.isTwitter(url)) {
      return await this.extractTwitterThreadAsync();
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

  static getConversationRoot() {
    const timelines = Array.from(document.querySelectorAll('div[aria-label^="Timeline:"]'));
    if (timelines.length > 0) {
      const preferred = [
        'Timeline: Conversation',
        'Timeline: Thread',
        'Timeline: Search timeline',
        'Conversation',
        'Thread',
        '对话',
        '会话',
        '帖子'
      ];

      for (const key of preferred) {
        const hit = timelines.find(el => (el.getAttribute('aria-label') || '').includes(key));
        if (hit) return hit;
      }

      return timelines[0];
    }

    return document.querySelector('main') || document.body;
  }

  static getConversationStatusIds() {
    const root = this.getConversationRoot();
    const anchors = root.querySelectorAll('a[href*="/status/"]');
    const ids = [];
    const seen = new Set();

    for (const a of anchors) {
      const href = a.getAttribute('href') || '';
      const match = href.match(/\/status\/(\d+)/);
      if (!match) continue;
      const id = match[1];
      if (seen.has(id)) continue;
      seen.add(id);
      ids.push(id);
    }

    return ids;
  }

  static getTweetElementsFromRoot(root) {
    const set = new Set();

    const addAll = (nodes) => {
      for (const n of nodes || []) {
        if (n && n.nodeType === 1) set.add(n);
      }
    };

    addAll(root.querySelectorAll('article[data-testid="tweet"]'));
    if (set.size === 0) addAll(root.querySelectorAll('article[tabindex="0"]'));
    if (set.size === 0) addAll(root.querySelectorAll('article'));

    const statusLinks = root.querySelectorAll('a[href*="/status/"]');
    for (const a of statusLinks) {
      const article = a.closest('article');
      if (article) set.add(article);
    }

    return Array.from(set);
  }

  static getTweetElements() {
    const root = this.getConversationRoot();
    const scoped = this.getTweetElementsFromRoot(root);
    if (scoped.length > 0) return scoped;

    const global = this.getTweetElementsFromRoot(document);
    return global;
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

  static findScrollableContainer(startEl) {
    const docScroll = document.scrollingElement || document.documentElement || document.body;
    let el = startEl;
    while (el && el !== document.body && el !== document.documentElement) {
      const style = window.getComputedStyle(el);
      const overflowY = style?.overflowY || '';
      const canScroll = (overflowY === 'auto' || overflowY === 'scroll') && el.scrollHeight > el.clientHeight + 1;
      if (canScroll) return el;
      el = el.parentElement;
    }
    return docScroll;
  }

  static clickExpandableButtons(root, { maxClicks = 12 } = {}) {
    const keywords = [
      'Show more',
      'Show',
      'View',
      'Read more',
      '显示更多',
      '展开',
      '显示',
      '查看更多',
      '查看',
      '翻译'
    ];

    const nodes = Array.from(root.querySelectorAll('div[role="button"], button, a[role="button"]'));
    let clicks = 0;
    for (const n of nodes) {
      if (clicks >= maxClicks) break;
      const text = (n.innerText || n.textContent || '').trim();
      if (!text) continue;
      if (!keywords.some(k => text.includes(k))) continue;
      if (n.getAttribute('aria-disabled') === 'true') continue;
      try {
        n.click();
        clicks += 1;
      } catch {}
    }
    return clicks;
  }

  static async waitForConversationStable({ timeoutMs = 6000, intervalMs = 200, stableTicks = 3 } = {}) {
    const start = Date.now();
    let lastStatusCount = -1;
    let lastTweetCount = -1;
    let stable = 0;

    while (Date.now() - start < timeoutMs) {
      const statusCount = this.getConversationStatusIds().length;
      const tweetCount = this.getTweetElements().length;

      if (statusCount === lastStatusCount && tweetCount === lastTweetCount) {
        stable += 1;
        if (stable >= stableTicks && (statusCount > 0 || tweetCount > 0)) return true;
      } else {
        stable = 0;
        lastStatusCount = statusCount;
        lastTweetCount = tweetCount;
      }

      await new Promise(resolve => setTimeout(resolve, intervalMs));
    }

    return false;
  }

  static async tryLoadMoreTweets({ maxScrolls = 6, settleMs = 260 } = {}) {
    let lastCount = this.getTweetElements().length;
    let stable = 0;
    const root = this.getConversationRoot();
    const scroller = this.findScrollableContainer(root);

    for (let i = 0; i < maxScrolls; i++) {
      if (scroller && scroller !== document.body && scroller !== document.documentElement) {
        scroller.scrollTop += Math.max(400, Math.floor(scroller.clientHeight * 0.9));
      } else {
        window.scrollBy(0, Math.max(400, Math.floor(window.innerHeight * 0.9)));
      }
      await new Promise(resolve => setTimeout(resolve, settleMs));

      const nextCount = this.getTweetElements().length;
      if (nextCount > lastCount) {
        lastCount = nextCount;
        stable = 0;
      } else {
        stable += 1;
        if (stable >= 2) break;
      }
    }
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

  static async extractTwitterThreadAsync() {
    await this.waitForConversationStable({ timeoutMs: 6000 });
    const root = this.getConversationRoot();
    this.clickExpandableButtons(root);
    await this.tryLoadMoreTweets();
    let tweets = this.extractTweets();
    tweets = this.mergeTweetsByConversationOrder(tweets);
    await this.enrichTweetsFromSyndication(tweets);
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
    const pageLongform = this.extractLongformTextFromPage();
    
    console.log(`[ThreadPrinter] Found ${tweetElements.length} tweet elements`);
    
    tweetElements.forEach((tweetEl, index) => {
      const tweet = this.parseTweetElement(tweetEl, index, currentStatusId);
      if (tweet && (tweet.text || (tweet.media?.images?.length || 0) > 0 || (tweet.media?.videos?.length || 0) > 0)) {
        tweets.push(tweet);
      }
    });

    if (currentStatusId && pageLongform) {
      const main = tweets.find(t => t.statusId === currentStatusId);
      if (main) {
        const existing = main.text || '';
        if (pageLongform.length > existing.length + 40) {
          main.text = pageLongform;
          main.textPlain = pageLongform;
          // 同时也更新 HTML
          const pageLongformHTML = this.extractLongformHTMLFromPage();
          if (pageLongformHTML) {
            main.html = pageLongformHTML;
          }
        }
      }
    }

    if (currentStatusId && !tweets.some(t => t.statusId === currentStatusId)) {
      const metaText = this.extractMainTweetTextFromMeta();
      const chosen = pageLongform && pageLongform.length >= (metaText || '').length ? pageLongform : metaText;
      if (chosen && !this.isBadTweetText(chosen)) {
        const threadInfo = this.extractThreadInfo();
        // 尝试获取页面级长文 HTML
        const pageLongformHTML = pageLongform && pageLongform.length >= (metaText || '').length ? 
          this.extractLongformHTMLFromPage() : '';

        tweets.unshift({
          index: 0,
          id: `tweet-${currentStatusId}`,
          statusId: currentStatusId,
          text: chosen,
          textPlain: chosen,
          html: pageLongformHTML || '',
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

    const unique = [];
    const seen = new Set();
    for (const t of tweets) {
      const key = t.statusId || `${t.timestamp || ''}::${t.text || ''}`;
      if (seen.has(key)) continue;
      seen.add(key);
      unique.push(t);
    }
    
    return unique;
  }
  
  /**
   * 解析单个推文元素
   */
  static parseTweetElement(tweetEl, index, currentStatusId = '') {
    try {
      // 提取文本内容 - 支持普通推文和长文
      let text = this.extractTweetText(tweetEl);
      let html = this.extractTweetHTML(tweetEl); // 提取 HTML
      const statusId = this.getTweetStatusId(tweetEl);

      if (!text && currentStatusId && statusId && statusId === currentStatusId) {
        text = this.extractMainTweetTextFromMeta() || text;
        // 如果从 Meta 提取了文本，HTML 暂时为空或尝试构造简单的 HTML
        if (text && !html) {
          html = this.escapeHtml(text).replace(/\n/g, '<br>');
        }
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
        html: html || '',
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

    const longform = this.extractLongformTextFromDataContents(tweetEl);
    if (longform) return longform;

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

    if (best) return best;

    try {
      if (typeof Readability === 'undefined') return '';
      const doc = document.implementation.createHTMLDocument(document.title || 'tweet');
      doc.body.innerHTML = tweetEl.innerHTML;
      const article = new Readability(doc, { keepClasses: true }).parse();
      const fallback = this.normalizeTweetText(article?.textContent || '');
      return fallback;
    } catch {
      return '';
    }
  }

  static extractTweetHTML(tweetEl) {
    let html = '';
    const longform = this.extractLongformHTMLFromDataContents(tweetEl);
    if (longform) {
      html = longform;
    } else {
      const textEl = tweetEl.querySelector('[data-testid="tweetText"]');
      if (textEl) {
         html = textEl.innerHTML;
      }
    }
    
    if (html) {
      return this.processTweetHTML(html);
    }
    return '';
  }

  static processTweetHTML(html) {
    if (!html) return '';
    
    // 1. Fix relative links
    html = html.replace(/href="\//g, 'href="https://x.com/');
    
    // 2. Remove "Show more" type buttons if they ended up in the HTML
    // (Simple heuristic for now, X usually separates them)

    return html;
  }

  static extractLongformHTMLFromDataContents(root) {
    if (!root) return '';
    const blocks = Array.from(root.querySelectorAll('div[data-contents="true"]'));
    if (blocks.length === 0) return '';

    // Concatenate all blocks with line breaks
    // div[data-contents="true"] are usually block containers
    return blocks.map(b => b.innerHTML).join('<br><br>');
  }

  static extractLongformTextFromDataContents(root) {
    if (!root) return '';
    const blocks = Array.from(root.querySelectorAll('div[data-contents="true"]'));
    if (blocks.length === 0) return '';

    let best = '';
    for (const b of blocks) {
      const raw = (b.innerText || b.textContent || '').trim();
      const cleaned = this.normalizeTweetText(raw);
      if (cleaned.length > best.length) best = cleaned;
    }
    return best;
  }

  static extractLongformTextFromPage() {
    const root = document.querySelector('main') || document.body;
    return this.extractLongformTextFromDataContents(root);
  }

  static extractLongformHTMLFromPage() {
    const root = document.querySelector('main') || document.body;
    return this.extractLongformHTMLFromDataContents(root);
  }

  static escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
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

  static isLikelyTruncatedText(text) {
    if (!text) return false;
    const t = String(text).trim();
    if (!t) return false;
    if (t.endsWith('…') || t.endsWith('...')) return true;
    if (t.includes('…')) return true;
    if (/\bhttps?:\/\/t\.co\/\w+/i.test(t) && t.length < 140) return true;
    return false;
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

  static isBadTweetText(text) {
    const t = this.normalizeTweetText(text);
    if (!t) return true;
    const patterns = [
      '登录注册出错了',
      '请尝试重新加载',
      'Something went wrong',
      'Try reloading',
      'Log in',
      'Sign up',
      'Join today'
    ];
    return patterns.some(p => t.includes(p));
  }

  static mergeTweetsByConversationOrder(tweets) {
    const orderedIds = this.getConversationStatusIds();
    if (!orderedIds.length) return tweets;

    const byId = new Map();
    for (const t of tweets) {
      if (t?.statusId) byId.set(t.statusId, t);
    }

    const merged = [];
    for (const id of orderedIds) {
      const existing = byId.get(id);
      if (existing) {
        merged.push(existing);
      } else {
        merged.push({
          index: merged.length,
          id: `tweet-${id}`,
          statusId: id,
          text: '',
          textPlain: '',
          html: '',
          author: '',
          authorHandle: '',
          timestamp: '',
          displayTime: '',
          media: { images: [], videos: [] },
          engagement: { replies: 0, retweets: 0, likes: 0, views: 0 },
          links: [],
          selected: true
        });
      }
    }

    const seen = new Set(orderedIds);
    for (const t of tweets) {
      if (t?.statusId && seen.has(t.statusId)) continue;
      merged.push(t);
    }

    merged.forEach((t, i) => { t.index = i; });
    return merged;
  }

  static normalizeMediaUrl(url) {
    if (!url) return '';
    try {
      const u = new URL(url);
      if (u.hostname.endsWith('twimg.com')) {
        const format = u.searchParams.get('format');
        const name = u.searchParams.get('name');
        u.searchParams = new URLSearchParams();
        if (format) u.searchParams.set('format', format);
        if (name) u.searchParams.set('name', name);
        return u.toString();
      }
      return u.toString();
    } catch {
      return String(url);
    }
  }

  static dedupeImages(images) {
    const out = [];
    const seen = new Set();
    for (const img of images || []) {
      const url = typeof img === 'string' ? img : img.url;
      const key = this.normalizeMediaUrl(url);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      out.push(typeof img === 'string' ? { url: img, alt: '', width: 0, height: 0 } : img);
    }
    return out;
  }

  static computeSyndicationToken(tweetId) {
    const n = Number(tweetId);
    if (!Number.isFinite(n) || n <= 0) return '';
    return ((n / 1e15) * Math.PI).toString(36).replace(/(0+|\.)/g, '');
  }

  static async fetchTweetTextViaSyndication(tweetId, lang = 'zh') {
    const token = this.computeSyndicationToken(tweetId);
    const qs = new URLSearchParams({ id: tweetId });
    if (lang) qs.set('lang', lang);
    if (token) qs.set('token', token);
    const url = `https://cdn.syndication.twimg.com/tweet-result?${qs.toString()}`;

    const resp = await fetch(url, { credentials: 'omit', cache: 'no-store' });
    if (!resp.ok) throw new Error(`syndication http ${resp.status}`);
    const data = await resp.json();

    const textCandidates = [
      data?.text,
      data?.full_text,
      data?.tweet?.text,
      data?.tweet?.full_text,
      data?.quoted_tweet?.text
    ].filter(Boolean);

    for (const c of textCandidates) {
      const normalized = this.normalizeTweetText(c);
      if (normalized && !this.isBadTweetText(normalized)) return normalized;
    }

    return '';
  }

  static parseSyndicationMedia(data) {
    const images = [];
    const videos = [];
    const mediaDetails = data?.mediaDetails || data?.media_details || data?.tweet?.mediaDetails || data?.tweet?.media_details || [];
    for (const m of mediaDetails || []) {
      const type = (m?.type || '').toLowerCase();
      if (type === 'photo' || type === 'image') {
        const url = m?.media_url_https || m?.media_url || m?.url;
        if (url) images.push({ url, alt: m?.ext_alt_text || '', width: 0, height: 0 });
      } else if (type === 'video' || type === 'animated_gif' || type === 'gif') {
        const poster = m?.media_url_https || m?.media_url || m?.poster || '';
        const videoInfo = m?.video_info || m?.videoInfo;
        const variants = videoInfo?.variants || [];
        const mp4 = variants
          .filter(v => (v?.content_type || '').includes('mp4') && v?.url)
          .sort((a, b) => (b?.bitrate || 0) - (a?.bitrate || 0))[0];
        videos.push({ url: mp4?.url || m?.url || '', poster });
      }
    }
    return { images: this.dedupeImages(images), videos };
  }

  static async fetchTweetViaSyndication(tweetId, lang = 'zh') {
    const token = this.computeSyndicationToken(tweetId);
    const qs = new URLSearchParams({ id: tweetId });
    if (lang) qs.set('lang', lang);
    if (token) qs.set('token', token);
    const url = `https://cdn.syndication.twimg.com/tweet-result?${qs.toString()}`;

    // Delegate to background script to avoid CORS issues
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage({ 
        action: 'fetchSyndication', 
        data: { url } 
      }, (response) => {
        if (chrome.runtime.lastError) {
          return reject(new Error(chrome.runtime.lastError.message));
        }
        if (!response || !response.success) {
          return reject(new Error(response?.error || 'Unknown syndication error'));
        }
        resolve(response.data);
      });
    });
  }

  static async enrichTweetsFromSyndication(tweets) {
    const ids = [];
    for (const t of tweets) {
      const id = t?.statusId;
      if (id && /^\d+$/.test(id)) ids.push(id);
    }

    const max = 12;
    const slice = ids.slice(0, max);
    for (const id of slice) {
      const t = tweets.find(x => x?.statusId === id);
      if (!t) continue;

      const needsText = !t.text || this.isBadTweetText(t.text) || this.isLikelyTruncatedText(t.text);
      const needsMedia = !t.media || (t.media.images?.length || 0) === 0 && (t.media.videos?.length || 0) === 0;
      if (!needsText && !needsMedia) continue;

      try {
        const data = await this.fetchTweetViaSyndication(id, 'zh');

        if (needsText) {
          const candidates = [
            data?.text,
            data?.full_text,
            data?.tweet?.text,
            data?.tweet?.full_text
          ].filter(Boolean);
          for (const c of candidates) {
            const normalized = this.normalizeTweetText(c);
            if (normalized && !this.isBadTweetText(normalized)) {
              t.text = normalized;
              t.textPlain = normalized;
              break;
            }
          }
        }

        if (needsMedia) {
          const parsed = this.parseSyndicationMedia(data);
          const images = this.dedupeImages([...(t.media?.images || []), ...(parsed.images || [])]);
          const videos = [...(t.media?.videos || []), ...(parsed.videos || [])];
          t.media = { ...(t.media || { images: [], videos: [] }), images, videos };
        }
      } catch (error) {
        console.warn('[ThreadPrinter] Syndication fetch failed:', error);
      }
    }

    for (const t of tweets) {
      if (t?.media?.images) t.media.images = this.dedupeImages(t.media.images);
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
        const data = await ContentExtractor.extractAsync();
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
