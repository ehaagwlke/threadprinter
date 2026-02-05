/**
 * ThreadPrinter - 生成器一致性测试
 * 测试 Markdown/HTML/PDF/PNG 四种格式的输出一致性
 */

// 模拟测试数据 - 与 content.js 输出的包装格式一致
const mockThreadData = {
  type: 'twitter_thread',
  metadata: {
    title: 'Test Thread Title',
    author: {
      name: 'Test Author',
      handle: '@testauthor',
      avatar: 'https://example.com/avatar.jpg'
    },
    url: 'https://x.com/test/status/123456',
    publishedTime: '2024-01-15T10:30:00Z'
  },
  stats: {
    tweetCount: 2,
    imageCount: 1
  },
  tweets: [
    {
      index: 0,
      id: 'tweet-0',
      text: 'This is the first tweet with some content. #hashtag',
      textPlain: 'This is the first tweet with some content. #hashtag',
      author: {
        name: 'Test Author',
        handle: '@testauthor',
        avatar: 'https://example.com/avatar.jpg'
      },
      timestamp: '2024-01-15T10:30:00Z',
      displayTime: '10:30 AM',
      media: {
        images: [
          { url: 'https://example.com/image1.jpg', alt: 'Test image', width: 800, height: 600 }
        ],
        videos: [],
        card: null
      },
      engagement: { replies: 5, retweets: 10, likes: 20, views: 100 },
      links: [{ url: 'https://example.com', text: 'Example link' }],
      selected: true
    },
    {
      index: 1,
      id: 'tweet-1',
      text: 'This is the second tweet. @mention Check this out!',
      textPlain: 'This is the second tweet. @mention Check this out!',
      author: {
        name: 'Test Author',
        handle: '@testauthor',
        avatar: 'https://example.com/avatar.jpg'
      },
      timestamp: '2024-01-15T10:35:00Z',
      displayTime: '10:35 AM',
      media: {
        images: [],
        videos: [{ url: 'https://example.com/video.mp4', poster: 'https://example.com/poster.jpg' }],
        card: {
          url: 'https://example.com/article',
          title: 'Article Title',
          image: 'https://example.com/card.jpg'
        }
      },
      engagement: { replies: 3, retweets: 8, likes: 15, views: 80 },
      links: [],
      selected: true
    }
  ],
  siteName: 'X (Twitter)',
  extractedAt: '2024-01-15T12:00:00Z'
};

// 测试工具
const TestUtils = {
  results: [],
  
  addResult(testName, passed, message = '') {
    this.results.push({ testName, passed, message });
    const status = passed ? '✅' : '❌';
    console.log(`${status} ${testName}: ${message || (passed ? '通过' : '失败')}`);
  },
  
  assertContains(text, expected, description) {
    const passed = text.includes(expected);
    this.addResult(
      description || `Contains "${expected.substring(0, 30)}..."`,
      passed,
      passed ? 'Found' : `Expected to find: ${expected}`
    );
    return passed;
  },
  
  assertNotEmpty(text, description) {
    const passed = text && text.length > 0;
    this.addResult(description, passed, passed ? `Length: ${text.length}` : 'Empty');
    return passed;
  },
  
  printSummary() {
    console.log('\n📊 测试结果摘要');
    console.log('='.repeat(50));
    
    const passed = this.results.filter(r => r.passed).length;
    const failed = this.results.filter(r => !r.passed).length;
    const total = this.results.length;
    
    console.log(`总计: ${total} 项测试`);
    console.log(`✅ 通过: ${passed}`);
    console.log(`❌ 失败: ${failed}`);
    console.log(`通过率: ${Math.round((passed / total) * 100)}%`);
    
    if (failed > 0) {
      console.log('\n❌ 失败的测试:');
      this.results.filter(r => !r.passed).forEach(r => {
        console.log(`  - ${r.testName}: ${r.message}`);
      });
    }
    
    console.log('\n' + '='.repeat(50));
    return failed === 0;
  }
};

// 数据标准化测试
async function testDataNormalizer() {
  console.log('\n📋 测试数据标准化器\n');
  
  try {
    const { normalizeData } = await import('../utils/dataNormalizer.js');
    
    // 测试包装格式
    const normalized = normalizeData(mockThreadData);
    
    TestUtils.assertNotEmpty(normalized, '标准化数据不为空');
    TestUtils.addResult('标准化: type字段', normalized?.type === 'twitter_thread');
    TestUtils.addResult('标准化: title字段', normalized.title === 'Test Thread Title');
    TestUtils.addResult('标准化: author字段', normalized.author === 'Test Author');
    TestUtils.addResult('标准化: authorHandle字段', normalized.authorHandle === '@testauthor');
    TestUtils.addResult('标准化: tweets数组', Array.isArray(normalized.tweets) && normalized.tweets.length === 2);
    TestUtils.addResult('标准化: 第一条推文文本', normalized.tweets[0]?.text === 'This is the first tweet with some content. #hashtag');
    TestUtils.addResult('标准化: 推文选中状态', normalized.tweets[0]?.selected === true);
    
    // 测试推文中的媒体标准化
    TestUtils.addResult('标准化: 图片媒体', normalized.tweets[0]?.media?.images?.length === 1);
    TestUtils.addResult('标准化: 视频媒体', normalized.tweets[1]?.media?.videos?.length === 1);
    
  } catch (error) {
    TestUtils.addResult('数据标准化测试', false, error.message);
  }
}

// Markdown 生成器测试
async function testMarkdownGenerator() {
  console.log('\n📝 测试 Markdown 生成器\n');
  
  try {
    const { generateMarkdown } = await import('../utils/markdownGenerator.js');
    const markdown = generateMarkdown(mockThreadData);
    
    TestUtils.assertNotEmpty(markdown, 'Markdown 内容不为空');
    TestUtils.assertContains(markdown, '# Test Thread Title', '包含标题');
    TestUtils.assertContains(markdown, 'Test Author', '包含作者名');
    TestUtils.assertContains(markdown, '@testauthor', '包含作者账号');
    TestUtils.assertContains(markdown, 'This is the first tweet', '包含第一条推文');
    TestUtils.assertContains(markdown, 'This is the second tweet', '包含第二条推文');
    TestUtils.assertContains(markdown, '![Test image]', '包含图片引用');
    TestUtils.assertContains(markdown, 'https://example.com/image1.jpg', '包含图片URL');
    TestUtils.assertContains(markdown, '推文 1', '包含推文编号');
    TestUtils.assertContains(markdown, '推文 2', '包含推文编号');
    TestUtils.assertContains(markdown, 'ThreadPrinter', '包含页脚');
    
  } catch (error) {
    TestUtils.addResult('Markdown 生成器测试', false, error.message);
  }
}

// HTML 生成器测试
async function testHTMLGenerator() {
  console.log('\n🌐 测试 HTML 生成器\n');
  
  try {
    const { generateHTML } = await import('../utils/htmlGenerator.js');
    const html = generateHTML(mockThreadData);
    
    TestUtils.assertNotEmpty(html, 'HTML 内容不为空');
    TestUtils.assertContains(html, '<!DOCTYPE html>', '包含 DOCTYPE');
    TestUtils.assertContains(html, 'Test Thread Title', '包含标题');
    TestUtils.assertContains(html, 'Test Author', '包含作者名');
    TestUtils.assertContains(html, 'This is the first tweet', '包含第一条推文');
    TestUtils.assertContains(html, 'This is the second tweet', '包含第二条推文');
    TestUtils.assertContains(html, 'tweet-media', '包含媒体容器类');
    TestUtils.assertContains(html, 'https://example.com/image1.jpg', '包含图片URL');
    TestUtils.assertContains(html, 'thread-header', '包含头部样式类');
    TestUtils.assertContains(html, 'tweet-content', '包含内容样式类');
    
  } catch (error) {
    TestUtils.addResult('HTML 生成器测试', false, error.message);
  }
}

// PDF 生成器测试
async function testPDFGenerator() {
  console.log('\n📄 测试 PDF 生成器\n');
  
  try {
    const { generateStyledHTML } = await import('../utils/pdfGenerator.js');
    const html = generateStyledHTML(mockThreadData);
    
    TestUtils.assertNotEmpty(html, 'PDF HTML 内容不为空');
    TestUtils.assertContains(html, '@page', '包含打印页样式');
    TestUtils.assertContains(html, 'Test Thread Title', '包含标题');
    TestUtils.assertContains(html, 'Test Author', '包含作者名');
    TestUtils.assertContains(html, 'This is the first tweet', '包含第一条推文');
    TestUtils.assertContains(html, 'print-tweet', '包含打印推文样式类');
    TestUtils.assertContains(html, 'print-header', '包含打印头部样式类');
    
  } catch (error) {
    TestUtils.addResult('PDF 生成器测试', false, error.message);
  }
}

// 一致性测试 - 比较各格式的关键内容
async function testConsistency() {
  console.log('\n🔍 测试各格式输出一致性\n');
  
  try {
    const { generateMarkdown } = await import('../utils/markdownGenerator.js');
    const { generateHTML } = await import('../utils/htmlGenerator.js');
    const { generateStyledHTML } = await import('../utils/pdfGenerator.js');
    
    const markdown = generateMarkdown(mockThreadData);
    const html = generateHTML(mockThreadData);
    const pdfHtml = generateStyledHTML(mockThreadData);
    
    // 所有格式都应包含的关键内容
    const keyContents = [
      'Test Thread Title',
      'Test Author',
      'This is the first tweet',
      'This is the second tweet',
      'https://example.com/image1.jpg'
    ];
    
    keyContents.forEach(content => {
      const mdHas = markdown.includes(content);
      const htmlHas = html.includes(content);
      const pdfHas = pdfHtml.includes(content);
      
      TestUtils.addResult(
        `一致性: "${content.substring(0, 30)}..."`,
        mdHas && htmlHas && pdfHas,
        `Markdown: ${mdHas}, HTML: ${htmlHas}, PDF: ${pdfHas}`
      );
    });
    
    // 测试推文数量一致性
    const mdTweetCount = (markdown.match(/## 推文/g) || []).length;
    const htmlTweetCount = (html.match(/tweet-number/g) || []).length;
    const pdfTweetCount = (pdfHtml.match(/print-tweet-number/g) || []).length;
    
    TestUtils.addResult(
      '一致性: 推文数量',
      mdTweetCount === 2 && htmlTweetCount === 2 && pdfTweetCount === 2,
      `Markdown: ${mdTweetCount}, HTML: ${htmlTweetCount}, PDF: ${pdfTweetCount}`
    );
    
  } catch (error) {
    TestUtils.addResult('一致性测试', false, error.message);
  }
}

// 测试未选中的推文被正确过滤
async function testSelectionFiltering() {
  console.log('\n✅ 测试推文选中过滤\n');
  
  try {
    const { normalizeData } = await import('../utils/dataNormalizer.js');
    const { generateMarkdown } = await import('../utils/markdownGenerator.js');
    
    // 复制测试数据，取消选择第二条推文
    const dataWithSelection = JSON.parse(JSON.stringify(mockThreadData));
    dataWithSelection.tweets[1].selected = false;
    
    const normalized = normalizeData(dataWithSelection);
    const markdown = generateMarkdown(normalized);
    
    TestUtils.addResult(
      '选中过滤: Markdown 只包含选中推文',
      markdown.includes('推文 1') && !markdown.includes('推文 2'),
      '应只有推文 1'
    );
    
  } catch (error) {
    TestUtils.addResult('选中过滤测试', false, error.message);
  }
}

// 运行所有测试
async function runAllTests() {
  console.log('🧪 ThreadPrinter 生成器一致性测试\n');
  console.log('='.repeat(50));
  
  await testDataNormalizer();
  await testMarkdownGenerator();
  await testHTMLGenerator();
  await testPDFGenerator();
  await testConsistency();
  await testSelectionFiltering();
  
  const allPassed = TestUtils.printSummary();
  
  // 返回测试结果供自动化使用
  if (typeof window !== 'undefined') {
    window.testResults = TestUtils.results;
  }
  
  return allPassed;
}

// 导出
export { runAllTests, mockThreadData, TestUtils };

// 浏览器环境支持
if (typeof window !== 'undefined') {
  window.ThreadPrinterGeneratorTests = { runAllTests, mockThreadData, TestUtils };
  console.log('ThreadPrinterGeneratorTests 已加载，运行 ThreadPrinterGeneratorTests.runAllTests() 开始测试');
}

// 如果这是主模块，自动运行测试
if (import.meta.url === `file://${process.argv[1]}`) {
  runAllTests().then(passed => {
    process.exit(passed ? 0 : 1);
  });
}
