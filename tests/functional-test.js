/**
 * ThreadPrinter - 功能测试脚本
 * 用于在 push 前验证扩展功能
 * 
 * 使用方法：在 Chrome DevTools Console 中运行
 */

const ThreadPrinterTests = {
  // 测试结果
  results: [],
  
  // 添加测试结果
  addResult(testName, passed, message = '') {
    this.results.push({ testName, passed, message });
    const status = passed ? '✅' : '❌';
    console.log(`${status} ${testName}: ${message || (passed ? '通过' : '失败')}`);
  },
  
  // 运行所有测试
  async runAll() {
    console.log('🧪 ThreadPrinter 功能测试开始...\n');
    
    await this.testContentScriptLoaded();
    await this.testContentExtractor();
    await this.testMessage Passing();
    await this.testDataFormat();
    
    this.printSummary();
  },
  
  // 测试1: Content Script 是否已加载
  async testContentScriptLoaded() {
    try {
      const response = await chrome.runtime.sendMessage({ action: 'ping' });
      this.addResult('Content Script 加载检查', response?.pong === true, 'Content script 响应正常');
    } catch (error) {
      this.addResult('Content Script 加载检查', false, error.message);
    }
  },
  
  // 测试2: 内容提取器
  async testContentExtractor() {
    if (typeof ContentExtractor === 'undefined') {
      this.addResult('ContentExtractor 类', false, 'ContentExtractor 未定义');
      return;
    }
    
    try {
      const isTwitter = ContentExtractor.isTwitter(window.location.href);
      this.addResult('isTwitter 检测', true, `当前页面 ${isTwitter ? '是' : '不是'} X/Twitter`);
      
      // 检查必要的方法
      const hasExtract = typeof ContentExtractor.extract === 'function';
      const hasExtractTweets = typeof ContentExtractor.extractTweets === 'function';
      
      this.addResult('ContentExtractor.extract 方法', hasExtract, hasExtract ? '存在' : '不存在');
      this.addResult('ContentExtractor.extractTweets 方法', hasExtractTweets, hasExtractTweets ? '存在' : '不存在');
    } catch (error) {
      this.addResult('ContentExtractor 检查', false, error.message);
    }
  },
  
  // 测试3: 消息传递
  async testMessagePassing() {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      // 测试 ping
      const pingResponse = await chrome.tabs.sendMessage(tab.id, { action: 'ping' });
      this.addResult('Ping 消息', pingResponse?.pong === true, '消息传递正常');
      
      // 测试提取（可选，可能较慢）
      if (pingResponse?.pong) {
        console.log('⏳ 测试提取功能（可能需要几秒）...');
        const extractResponse = await chrome.tabs.sendMessage(tab.id, { action: 'extractThread' });
        this.addResult('提取消息', extractResponse?.success === true, 
          extractResponse?.success ? `提取了 ${extractResponse.data?.tweets?.length || 0} 条推文` : extractResponse?.error);
      }
    } catch (error) {
      this.addResult('消息传递', false, error.message);
    }
  },
  
  // 测试4: 数据格式
  async testDataFormat() {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      const response = await chrome.tabs.sendMessage(tab.id, { action: 'extractThread' });
      
      if (!response?.success) {
        this.addResult('数据格式', false, '提取失败，无法检查格式');
        return;
      }
      
      const data = response.data;
      
      // 检查必要字段
      const checks = [
        { name: 'metadata 字段', test: data && typeof data.metadata === 'object' },
        { name: 'metadata.author 字段', test: data?.metadata && typeof data.metadata.author === 'object' },
        { name: 'stats 字段', test: data && typeof data.stats === 'object' },
        { name: 'stats.tweetCount 字段', test: typeof data?.stats?.tweetCount === 'number' },
        { name: 'tweets 数组', test: Array.isArray(data?.tweets) },
        { name: 'url 字段', test: typeof data?.url === 'string' },
      ];
      
      checks.forEach(check => {
        this.addResult(`数据格式: ${check.name}`, check.test, check.test ? '格式正确' : '格式错误');
      });
      
    } catch (error) {
      this.addResult('数据格式检查', false, error.message);
    }
  },
  
  // 打印测试摘要
  printSummary() {
    console.log('\n📊 测试摘要');
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
    console.log(failed === 0 ? '✨ 所有测试通过！可以安全地 push。' : '⚠️ 有测试失败，请先修复问题。');
  }
};

// 自动运行测试
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ThreadPrinterTests;
} else {
  // 在浏览器环境中自动运行
  console.log('ThreadPrinterTests 已加载，运行 ThreadPrinterTests.runAll() 开始测试');
}
