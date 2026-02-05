/**
 * ThreadPrinter - 统一数据格式转换器
 * 将 content.js 提取的数据转换为各生成器使用的标准格式
 */

export function normalizeData(data) {
  if (!data) return null;

  // 处理已包装的数据格式（来自 content.js）
  if (data.metadata) {
    return {
      type: data.type || 'twitter_thread',
      title: data.metadata.title || 'X Thread',
      author: data.metadata.author?.name || data.metadata.author || '',
      authorHandle: data.metadata.author?.handle || data.metadata.handle || '',
      authorAvatar: data.metadata.author?.avatar || data.metadata.avatar || '',
      publishedTime: data.metadata.publishedTime || '',
      url: data.metadata.url || data.url || '',
      tweetCount: data.stats?.tweetCount || data.tweets?.length || 0,
      tweets: normalizeTweets(data.tweets || []),
      extractedAt: data.extractedAt || new Date().toISOString(),
      siteName: data.siteName || 'X (Twitter)'
    };
  }

  // 处理未包装的直接格式（兼容旧版本）
  return {
    type: data.type || 'twitter_thread',
    title: data.title || 'X Thread',
    author: data.author || '',
    authorHandle: data.authorHandle || '',
    authorAvatar: data.authorAvatar || '',
    publishedTime: data.publishedTime || '',
    url: data.url || '',
    tweetCount: data.tweetCount || data.tweets?.length || 0,
    tweets: normalizeTweets(data.tweets || []),
    extractedAt: data.extractedAt || new Date().toISOString(),
    siteName: data.siteName || 'X (Twitter)'
  };
}

function normalizeTweets(tweets) {
  if (!Array.isArray(tweets)) return [];
  
  return tweets.map((tweet, index) => ({
    index: tweet.index ?? index,
    id: tweet.id || `tweet-${index}`,
    text: tweet.text || tweet.textPlain || '',
    textPlain: tweet.textPlain || tweet.text || '',
    html: tweet.html || '',
    author: {
      name: tweet.author?.name || tweet.author || '',
      handle: tweet.author?.handle || tweet.authorHandle || '',
      avatar: tweet.author?.avatar || tweet.authorAvatar || ''
    },
    timestamp: tweet.timestamp || '',
    displayTime: tweet.displayTime || '',
    media: normalizeMedia(tweet.media),
    engagement: tweet.engagement || { replies: 0, retweets: 0, likes: 0, views: 0 },
    links: tweet.links || [],
    selected: tweet.selected !== false
  }));
}

function normalizeMedia(media) {
  if (!media) return { images: [], videos: [] };
  
  return {
    images: (media.images || []).map(img => ({
      url: typeof img === 'string' ? img : (img.url || ''),
      alt: typeof img === 'string' ? '' : (img.alt || ''),
      width: typeof img === 'string' ? 0 : (img.width || 0),
      height: typeof img === 'string' ? 0 : (img.height || 0)
    })),
    videos: media.videos || [],
    card: media.card || null
  };
}

export default { normalizeData };
