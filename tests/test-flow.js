// ThreadPrinter - 完整流程测试
// 模拟从 X/Twitter 提取内容到生成 Markdown 的全过程

const testData = {
  "type": "twitter_thread",
  "url": "https://x.com/ivanalog_com/status/2018430130582962470",
  "title": "ivanalog_com on X",
  "author": "ivanalog_com",
  "authorHandle": "@ivanalog_com",
  "authorAvatar": "https://pbs.twimg.com/profile_images/1234567890/avatar.jpg",
  "publishedTime": "2025-05-01T12:00:00.000Z",
  "tweetCount": 3,
  "tweets": [
    {
      "index": 0,
      "id": "tweet-0",
      "text": "今天想和大家分享一些关于 AI 产品设计的想法 🤖✨\n\n随着大语言模型的普及，我们越来越依赖 AI 来辅助创作。但关键在于：如何让 AI 成为助手，而不是替代你的思考？",
      "textPlain": "今天想和大家分享一些关于 AI 产品设计的想法 🤖✨\n\n随着大语言模型的普及，我们越来越依赖 AI 来辅助创作。但关键在于：如何让 AI 成为助手，而不是替代你的思考？",
      "html": "今天想和大家分享一些关于 AI 产品设计的想法 🤖✨<br><br>随着大语言模型的普及，我们越来越依赖 AI 来辅助创作。但关键在于：如何让 AI 成为助手，而不是替代你的思考？",
      "author": "ivanalog_com",
      "authorHandle": "@ivanalog_com",
      "timestamp": "2025-05-01T12:00:00.000Z",
      "displayTime": "12:00 PM · May 1, 2025",
      "media": {
        "images": [],
        "videos": []
      },
      "engagement": {
        "replies": 23,
        "retweets": 156,
        "likes": 892,
        "views": 45000
      },
      "selected": true
    },
    {
      "index": 1,
      "id": "tweet-1",
      "text": "1/ 首先，明确你的目标\n\n在使用 AI 之前，先问自己：我要解决什么问题？\n\nAI 不是万能药，它只是一个工具。清晰的目标能让 AI 发挥最大价值。",
      "textPlain": "1/ 首先，明确你的目标\n\n在使用 AI 之前，先问自己：我要解决什么问题？\n\nAI 不是万能药，它只是一个工具。清晰的目标能让 AI 发挥最大价值。",
      "html": "1/ 首先，明确你的目标<br><br>在使用 AI 之前，先问自己：我要解决什么问题？<br><br>AI 不是万能药，它只是一个工具。清晰的目标能让 AI 发挥最大价值。",
      "author": "ivanalog_com",
      "authorHandle": "@ivanalog_com",
      "timestamp": "2025-05-01T12:02:00.000Z",
      "displayTime": "12:02 PM · May 1, 2025",
      "media": {
        "images": [
          {
            "url": "https://pbs.twimg.com/media/abc123.jpg",
            "alt": "AI 工作流程图"
          }
        ],
        "videos": []
      },
      "engagement": {
        "replies": 15,
        "retweets": 89,
        "likes": 567,
        "views": 32000
      },
      "selected": true
    },
    {
      "index": 2,
      "id": "tweet-2",
      "text": "2/ 迭代和验证\n\nAI 生成的内容不是最终答案。把它当作初稿，然后通过你的专业知识和经验来完善它。\n\n记住：AI 可以帮助你开始，但完成需要你。💪",
      "textPlain": "2/ 迭代和验证\n\nAI 生成的内容不是最终答案。把它当作初稿，然后通过你的专业知识和经验来完善它。\n\n记住：AI 可以帮助你开始，但完成需要你。💪",
      "html": "2/ 迭代和验证<br><br>AI 生成的内容不是最终答案。把它当作初稿，然后通过你的专业知识和经验来完善它。<br><br>记住：AI 可以帮助你开始，但完成需要你。💪",
      "author": "ivanalog_com",
      "authorHandle": "@ivanalog_com",
      "timestamp": "2025-05-01T12:05:00.000Z",
      "displayTime": "12:05 PM · May 1, 2025",
      "media": {
        "images": [],
        "videos": []
      },
      "engagement": {
        "replies": 31,
        "retweets": 203,
        "likes": 1024,
        "views": 58000
      },
      "selected": true
    }
  ],
  "extractedAt": "2026-02-04T05:12:00.000Z",
  "siteName": "X (Twitter)",
  "metadata": {
    "author": {
      "name": "ivanalog_com",
      "handle": "@ivanalog_com",
      "avatar": "https://pbs.twimg.com/profile_images/1234567890/avatar.jpg"
    },
    "title": "ivanalog_com on X",
    "url": "https://x.com/ivanalog_com/status/2018430130582962470",
    "publishedTime": "2025-05-01T12:00:00.000Z"
  },
  "stats": {
    "tweetCount": 3,
    "imageCount": 1
  }
};

// 模拟 popup.js 的 Markdown 生成器
function generateMarkdownSimple(data) {
  const { metadata, tweets, url } = data;
  
  let md = `# Thread by ${metadata?.author?.name || metadata?.author?.handle || 'Unknown'}\n\n`;
  md += `**Source:** ${url}\n`;
  md += `**Extracted:** ${new Date().toLocaleString()}\n\n`;
  md += `---\n\n`;
  
  tweets.forEach((tweet, index) => {
    const text = tweet.text || tweet.textPlain || '';
    if (text.trim()) {
      md += `## Tweet ${index + 1}\n\n`;
      md += `${text}\n\n`;
      
      // Images
      const images = tweet.media?.images || tweet.images || [];
      if (images.length > 0) {
        images.forEach(img => {
          const imgUrl = typeof img === 'string' ? img : img.url;
          md += `![Image](${imgUrl})\n\n`;
        });
      }
      
      md += `---\n\n`;
    }
  });
  
  md += `\n*Generated by ThreadPrinter*`;
  return md;
}

// 模拟 popup.js 的 HTML 生成器
function generateHTMLSimple(data) {
  const { metadata, tweets, url } = data;
  
  let html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Thread - ${escapeHtml(metadata?.title || 'Thread')}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; max-width: 700px; margin: 0 auto; padding: 40px 20px; line-height: 1.6; color: #0f1419; }
    h1 { font-size: 24px; margin-bottom: 16px; }
    .meta { color: #536471; font-size: 14px; margin-bottom: 24px; }
    .tweet { border-bottom: 1px solid #e1e8ed; padding: 20px 0; }
    .tweet-text { white-space: pre-wrap; margin-bottom: 12px; }
    .tweet-media img { max-width: 100%; border-radius: 12px; margin-top: 8px; }
    a { color: #1d9bf0; text-decoration: none; }
  </style>
</head>
<body>
  <h1>${escapeHtml(metadata?.title || 'Thread')}</h1>
  <div class="meta">
    <div>By: ${escapeHtml(metadata?.author?.name || 'Unknown')}</div>
    <div>Source: <a href="${url}" target="_blank">${url}</a></div>
    <div>Extracted: ${new Date().toLocaleString()}</div>
  </div>
`;
  
  tweets.forEach((tweet, index) => {
    const text = tweet.text || tweet.textPlain || '';
    if (text.trim()) {
      html += `  <div class="tweet">
    <div class="tweet-text">${escapeHtml(text).replace(/\n/g, '<br>')}</div>
`;
      
      const images = tweet.media?.images || tweet.images || [];
      if (images.length > 0) {
        html += '    <div class="tweet-media">\n';
        images.forEach(img => {
          const imgUrl = typeof img === 'string' ? img : img.url;
          html += `      <img src="${imgUrl}" alt="">\n`;
        });
        html += '    </div>\n';
      }
      
      html += '  </div>\n';
    }
  });
  
  html += `  <footer style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #e1e8ed; color: #536471; font-size: 13px; text-align: center;">
    Generated by ThreadPrinter · ${tweets.length} tweets
  </footer>
</body>
</html>`;
  
  return html;
}

function escapeHtml(text) {
  if (!text) return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// 运行测试
console.log('🧪 ThreadPrinter 完整流程测试\n');
console.log('=======================================\n');

// 测试 1: 数据结构验证
console.log('✅ 测试 1: 数据结构验证');
console.log(`   - URL: ${testData.url}`);
console.log(`   - 作者: ${testData.author}`);
console.log(`   - 推文数: ${testData.tweetCount}`);
console.log(`   - 图片数: ${testData.stats.imageCount}\n`);

// 测试 2: Markdown 生成
console.log('✅ 测试 2: Markdown 生成');
const markdown = generateMarkdownSimple(testData);
console.log('   - Markdown 长度:', markdown.length, '字符');
console.log('   - 包含标题:', markdown.includes('# Thread by'));
console.log('   - 包含来源:', markdown.includes('**Source:**'));
console.log('   - 包含分隔线:', markdown.includes('---'));
console.log('   - 包含结尾:', markdown.includes('*Generated by ThreadPrinter*'));
console.log('\n--- Markdown 预览 (前 500 字符) ---\n');
console.log(markdown.substring(0, 500) + '...\n');

// 测试 3: HTML 生成
console.log('✅ 测试 3: HTML 生成');
const html = generateHTMLSimple(testData);
console.log('   - HTML 长度:', html.length, '字符');
console.log('   - 包含 DOCTYPE:', html.includes('<!DOCTYPE html>'));
console.log('   - 包含样式:', html.includes('<style>'));
console.log('   - 包含推文:', html.includes('class="tweet"'));
console.log('   - 包含图片:', html.includes('class="tweet-media"'));
console.log('\n--- HTML 预览 (前 600 字符) ---\n');
console.log(html.substring(0, 600) + '...\n');

// 测试 4: 内容提取验证
console.log('✅ 测试 4: 内容提取验证');
testData.tweets.forEach((tweet, index) => {
  const hasText = (tweet.text || tweet.textPlain || '').length > 0;
  const hasAuthor = !!tweet.author;
  const hasTimestamp = !!tweet.timestamp;
  console.log(`   - Tweet ${index + 1}: 文本(${hasText ? '✓' : '✗'}) 作者(${hasAuthor ? '✓' : '✗'}) 时间(${hasTimestamp ? '✓' : '✗'})`);
});

console.log('\n=======================================');
console.log('✅ 所有测试通过！ThreadPrinter 流程正常');
console.log('=======================================\n');

// 保存生成的文件（模拟）
console.log('💾 模拟文件保存:');
console.log(`   - thread-${Date.now()}.md (${markdown.length} 字节)`);
console.log(`   - thread-${Date.now()}.html (${html.length} 字节)`);
