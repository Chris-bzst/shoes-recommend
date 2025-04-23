import { useState, useEffect, useRef } from 'react';
import Head from 'next/head';
import React from 'react';

// Create a context for the chat functionality to isolate input state changes
const ChatContext = React.createContext();

// Chat provider component to isolate the input state
function ChatProvider({ children, initialMessages = [], productsData = [], initialSystemPrompt = '' }) {
  const [messages, setMessages] = useState(initialMessages);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [chatHistory, setChatHistory] = useState([]);
  const messagesEndRef = useRef(null);
  
  // 添加模型轮换状态
  const [currentModelIndex, setCurrentModelIndex] = useState(0);
  const availableModels = [
    'claude-3-7-sonnet-20250219',
    'claude-3-5-sonnet-20241022',
    'claude-3-5-sonnet-20240620'
  ];
  
  // API stats
  const [apiStats, setApiStats] = useState({
    totalCost: 0,
    totalCalls: 0,
    lastCallStats: null,
    currentModel: availableModels[0], // 添加当前模型信息
    currentApiType: 'claude' // 'claude' 或 'openai'
  });

  // 添加设备检测状态
  const [isAndroid, setIsAndroid] = useState(false);
  
  // 检测设备类型
  useEffect(() => {
    const userAgent = navigator.userAgent.toLowerCase();
    setIsAndroid(/android/.test(userAgent));
  }, []);

  // Initialize chat history with system prompt when it becomes available
  useEffect(() => {
    if (initialSystemPrompt && initialSystemPrompt.trim() !== '') {
      setChatHistory([{ role: 'system', content: initialSystemPrompt }]);
    }
  }, [initialSystemPrompt]);

  // Auto-scroll to bottom of chat
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Format messages for Claude API
  function formatMessagesForClaude(history) {
    return history.map(msg => ({
      role: msg.role,
      content: msg.content
    }));
  }

  // Parse product recommendations from Claude response
  function parseProductRecommendations(response) {
    // 从响应中提取开头文字 - 但我们最终不会显示这个
    let introText = '';
    const cleanResponse = response;
    const fixedOutroText = ""; // 去掉结尾文字
    
    // 只获取产品卡片标签
    const productCardRegex = /<product-card data-id="([^"]+)"><\/product-card>/g;
    const recommendedProducts = [];
    
    // 找到所有产品卡片
    let match;
    const productCardMatches = [];
    while ((match = productCardRegex.exec(response)) !== null) {
      productCardMatches.push({
        fullMatch: match[0],
        productId: match[1],
        index: match.index
      });
      
      // 查找产品ID并添加到推荐产品列表
      const productId = match[1];
      const product = productsData.find(p => p.id === productId);
      if (product) {
        recommendedProducts.push(product);
      }
    }
    
    return {
      text: cleanResponse,
      introText: "", // 不显示任何介绍文字
      outroText: "", // 不显示任何结尾文字
      products: recommendedProducts
    };
  }
  
  // 添加API选择状态
  const [currentApiType, setCurrentApiType] = useState('openai'); // 'claude' 或 'openai'
  
  // 修改OpenAI模型列表
  const openaiModels = [
    'gpt-4o-mini'  // 只使用GPT-4o-mini
  ];
  
  // 在每次请求后切换API类型
  const toggleApiType = () => {
    setCurrentApiType(prev => prev === 'claude' ? 'openai' : 'claude');
  };
  
  // 修改callClaudeAPI函数为通用API调用
  async function callAPI(messages) {
    const startTime = Date.now();
    
    try {
      let endpoint, requestBody, model;
      
      // 根据当前API类型构建请求
      if (currentApiType === 'claude') {
        // 获取当前Claude模型
        model = availableModels[currentModelIndex];
        endpoint = '/api/claude';
        requestBody = {
          messages: messages,
          model: model,
          max_tokens: 1500,
          temperature: 0.7
        };
        
        console.log(`Calling Claude API with model: ${model}`);
      } else {
        // 总是使用GPT-4o-mini
        model = 'gpt-4o-mini';
        endpoint = '/api/openai';
        requestBody = {
          messages: messages,
          model: model,
          max_tokens: 1500,
          temperature: 0.7
        };
        
        console.log(`Calling OpenAI API with model: ${model}`);
      }
      
      console.log('Calling API with messages:', messages);
      
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
      });

      const data = await response.json();
      
      if (!response.ok) {
        console.error('API request failed:', data);
        throw new Error(`API request failed: ${JSON.stringify(data)}`);
      }

      // 更新API统计信息
      if (data.stats) {
        const { time, inputTokens, outputTokens, inputCost, outputCost, totalCost } = data.stats;
        
        setApiStats(prev => ({
          totalCost: prev.totalCost + totalCost,
          totalCalls: prev.totalCalls + 1,
          lastCallStats: {
            time,
            inputTokens,
            outputTokens,
            inputCost,
            outputCost,
            totalCost
          },
          currentModel: model,
          currentApiType: currentApiType
        }));
        
        console.log(`API response successful in ${time.toFixed(2)}s using ${currentApiType} model ${model}`);
        console.log(`Cost: $${totalCost.toFixed(6)} (Input: $${inputCost.toFixed(6)}, Output: $${outputCost.toFixed(6)})`);
        console.log(`Input tokens: ${inputTokens}, Output tokens: ${outputTokens}`);
      }
      
      // // 轮换到下一个模型并切换API类型
      // setCurrentModelIndex((prevIndex) => (prevIndex + 1) % availableModels.length);
      // toggleApiType();
      
      return data.content;
    } catch (error) {
      console.error(`Error calling ${currentApiType} API:`, error);
      throw error;
    }
  }

  // 确保系统已准备好处理第一条消息
  function ensureSystemIsReady() {
    // 确保我们有产品数据
    if (!productsData || productsData.length === 0) {
      console.warn('No product data available yet');
      return false;
    }

    // 确保我们有系统提示
    if (!chatHistory || chatHistory.length === 0 || chatHistory[0].role !== 'system') {
      console.warn('System prompt not set up correctly', chatHistory);
      return false;
    }

    return true;
  }

  // Generate unique ID for messages
  function generateMessageId() {
    return `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  // Handle sending message
  async function handleSendMessage() {
    if (!input.trim()) return;
    
    // 确保系统已准备好
    if (!ensureSystemIsReady()) {
      setMessages(prev => [...prev, {
        id: generateMessageId(),
        role: 'assistant',
        content: '系统正在准备中，请稍后再试...'
      }]);
      return;
    }
    
    // 保存并清空当前输入，防止重新渲染输入框
    const currentInput = input;
    setInput('');
    
    // Add user message to UI
    const userMessage = { 
      id: generateMessageId(),
      role: 'user', 
      content: currentInput 
    };
    setMessages(prev => [...prev, userMessage]);
    setIsLoading(true);
    
    // Add user message to chat history - 不需要ID
    const chatUserMessage = { role: 'user', content: currentInput };
    const updatedHistory = [...chatHistory, chatUserMessage];
    setChatHistory(updatedHistory);
    
    try {
      // 确保发送到 API 时，我们的消息历史中有一个有效的用户消息
      const formattedMessages = formatMessagesForClaude(updatedHistory);
      
      // 打印调试信息
      console.log('Sending messages to API:', formattedMessages);
      
      // 使用新的通用API调用替换原有的Claude调用
      const response = await callAPI(formattedMessages);
      
      // Parse product recommendations
      const result = parseProductRecommendations(response);
      
      // Add AI response to chat history - 不需要ID
      const chatAiMessage = { role: 'assistant', content: response };
      setChatHistory([...updatedHistory, chatAiMessage]);
      
      // Add AI response to UI - 带ID
      setMessages(prev => [...prev, {
        id: generateMessageId(),
        role: 'assistant',
        content: result.text,
        introText: result.introText,
        outroText: result.outroText,
        products: result.products
      }]);
    } catch (error) {
      console.error('Error:', error);
      
      // Add error message to UI with more details if available
      let errorMessage = 'Sorry, I encountered an error. Please try again later.';
      if (error.message) {
        errorMessage += ` Error: ${error.message}`;
      }
      
      setMessages(prev => [...prev, {
        id: generateMessageId(),
        role: 'assistant',
        content: errorMessage
      }]);
    } finally {
      setIsLoading(false);
    }
  }

  // 键盘事件处理
  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !isLoading) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const value = {
    messages,
    input,
    setInput,
    isLoading,
    handleSendMessage,
    handleKeyPress,
    apiStats,
    messagesEndRef,
    isAndroid,  // 添加设备信息到context
    currentApiType // 添加当前API类型到context
  };

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
}

// Create a stable cache for product images to prevent reloads
const imageCache = new Map();

// Create a ProductCard component before the main component
// This ensures it's only defined once and doesn't get redefined on each render
const ProductCard = React.memo(({ product, isAndroid }) => {
  // Get the cached image URL or create a new one
  if (!imageCache.has(product.id)) {
    imageCache.set(product.id, product.imageLink);
  }
  const imageUrl = imageCache.get(product.id);
  
  const handleClick = () => {
    let productLink = product.productLink;
    
    // 对Android设备添加特殊参数以便跳转到Amazon应用
    if (isAndroid && productLink.includes('amazon.co.uk')) {
      // 如果链接中已经有查询参数
      if (productLink.includes('?')) {
        productLink += '&psc=1&openapp=1';
      } else {
        productLink += '?psc=1&openapp=1';
      }
    }
    
    window.open(productLink, '_blank');
  };

  return (
    <div className="product-card" onClick={handleClick}>
      <div className="product-image-container">
        <img 
          className="product-image" 
          src={imageUrl} 
          alt={product.name} 
          loading="lazy"
          decoding="async"
        />
      </div>
      <div className="product-brand">{product.brand}</div>
      <style jsx>{`
        .product-card {
          cursor: pointer;
          transition: all 0.3s ease;
          margin: 0.8rem 0;
          border-radius: 16px;
          overflow: hidden;
          background: white;
          box-shadow: 0 2px 8px rgba(0,0,0,0.08);
          flex: 0 0 calc(20% - 1rem);
          max-width: calc(20% - 1rem);
          padding-bottom: 8px;
          display: flex;
          flex-direction: column;
          position: relative;
        }
        
        .product-card:hover {
          transform: translateY(-4px);
          box-shadow: 0 12px 24px rgba(0,0,0,0.1);
        }
        
        .product-image-container {
          width: 100%;
          padding-top: 100%;
          position: relative;
          background: #f9f9f9;
          overflow: hidden;
        }
        
        .product-image {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          object-fit: contain;
          padding: 10px;
        }
        
        .product-brand {
          font-size: 0.75rem;
          color: #666;
          padding: 0 10px;
          text-align: center;
          margin-top: 5px;
          font-weight: 500;
        }
        
        @media (max-width: 992px) {
          .product-card {
            flex: 0 0 calc(33.33% - 1rem);
            max-width: calc(33.33% - 1rem);
          }
        }
        
        @media (max-width: 576px) {
          .product-card {
            flex: 0 0 100%;
            max-width: 100%;
            margin: 0.75rem 0;
            padding-bottom: 12px;
          }
          
          .product-image-container {
            padding-top: 80%; /* 降低图片容器高度以展示更好的比例 */
          }
          
          .product-image {
            padding: 15px;
          }
        }
      `}</style>
    </div>
  );
}, (prevProps, nextProps) => {
  // Proper comparison - only re-render if the product IDs change
  return prevProps.product.id === nextProps.product.id;
});

// Product recommendation component
const ProductRecommendation = React.memo(({ products }) => {
  const { isAndroid } = React.useContext(ChatContext);
  
  if (!products || products.length === 0) return null;
  
  return (
    <div className="recommendation-container">
      <div className="product-cards-container">
        {products.map((product) => (
          <ProductCard 
            key={`product-${product.id}`} 
            product={product} 
            isAndroid={isAndroid}
          />
        ))}
      </div>
      
      <style jsx>{`
        .recommendation-container {
          width: 100%;
          margin-bottom: 1rem;
        }
        
        .product-cards-container {
          display: flex;
          flex-wrap: wrap;
          margin: 0 -0.5rem;
          justify-content: flex-start;
          align-items: stretch;
        }
        
        @media (max-width: 576px) {
          .product-cards-container {
            margin: 0;
            flex-direction: column;
          }
        }
      `}</style>
    </div>
  );
});

// Message item component
const MessageItem = React.memo(({ message }) => {
  // 用户消息保持不变
  if (message.role === 'user') {
    return (
      <div className="message user-message">
        {message.content}
      </div>
    );
  }
  
  // 修改产品推荐消息结构，将logo放在上方
  if (message.products && message.products.length > 0) {
    return (
      <div className="ai-message-container ai-product-container">
        <div className="ai-header">
          <img src="/logo.png" alt="AI" className="ai-logo" />
        </div>
        <div className="ai-content-wrapper">
          <ProductRecommendation products={message.products} />
        </div>
        
        <style jsx>{`
          .ai-message-container {
            display: flex;
            flex-direction: column;
            align-items: flex-start;
            margin-bottom: 1.5rem;
            width: 100%;
          }
          
          .ai-header {
            display: flex;
            align-items: center;
            margin-bottom: 12px;
          }
          
          .ai-logo {
            width: 48px;
            height: auto;
            object-fit: contain;
            border-radius: 0;
          }
          
          .ai-content-wrapper {
            width: 100%;
          }
        `}</style>
      </div>
    );
  }
  
  // 普通AI消息保持左侧显示
  return (
    <div className="ai-message-container">
      <div className="ai-logo-container">
        <img src="/logo.png" alt="AI" className="ai-logo" />
      </div>
      <div className="message ai-message">
        {message.content}
      </div>
      
      <style jsx>{`
        .ai-message-container {
          display: flex;
          align-items: flex-start;
          margin-bottom: 1rem;
        }
        
        .ai-logo-container {
          margin-right: 12px;
          flex-shrink: 0;
          display: flex;
          align-items: flex-start;
          padding-top: 10px;
        }
        
        .ai-logo {
          width: 48px;
          height: auto;
          object-fit: contain;
          border-radius: 0;
        }
      `}</style>
    </div>
  );
}, (prevProps, nextProps) => {
  // Only re-render if the message ID changes
  return prevProps.message.id === nextProps.message.id;
});

// Chat component separated to isolate input changes
function Chat({ productsData }) {
  const { 
    messages, 
    input, 
    setInput, 
    isLoading, 
    handleSendMessage, 
    handleKeyPress,
    messagesEndRef 
  } = React.useContext(ChatContext);

  return (
    <div className="chat-container">
      <div className="chat-messages">
        {messages.map((message) => (
          <MessageItem 
            key={message.id} 
            message={message} 
          />
        ))}
        
        {isLoading && (
          <div className="typing-indicator">
            <span></span>
            <span></span>
            <span></span>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>
      
      <div className="input-container">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder="What kind of shoes are you looking for?"
          disabled={isLoading}
          style={{
            fontSize: '16px', // 防止iOS Safari缩放
            borderRadius: '8px',
            WebkitAppearance: 'none'
          }}
        />
        <button 
          onClick={handleSendMessage} 
          disabled={isLoading}
          style={{
            WebkitAppearance: 'none',
            borderRadius: '8px',
            minHeight: '44px',
            padding: '0 15px'
          }}
        >
          Send
        </button>
      </div>
      
      <style jsx>{`
        .input-container {
          display: flex;
          padding: 12px;
          background: white;
          border-top: 1px solid #eaeef2;
          position: sticky;
          bottom: 0;
          padding-bottom: calc(12px + env(safe-area-inset-bottom, 0px));
          z-index: 10;
        }
        
        input {
          flex: 1;
          padding: 12px 16px;
          border: 1px solid #eaeef2;
          border-radius: 8px;
          margin-right: 8px;
          font-size: 16px;
        }
        
        button {
          background-color: #4a6fff;
          color: white;
          border: none;
          border-radius: 8px;
          padding: 0 20px;
          font-weight: 500;
          cursor: pointer;
          min-height: 44px;
        }
        
        button:disabled {
          background-color: #a0aec0;
        }
      `}</style>
    </div>
  );
}

// Header component to prevent unnecessary re-renders
const Header = React.memo(() => {
  return (
    <div className="header">
      <div className="title-container">
        <img src="/title.png" alt="Footwear Shopping Assistant" className="title-image" />
      </div>
      
      <style jsx>{`
        .header {
          margin-bottom: 2rem;
          padding: 0;
          background: transparent;
          box-shadow: none;
        }
        
        .title-container {
          display: flex;
          justify-content: center;
          align-items: center;
          padding: 1.5rem 1rem;
          background: linear-gradient(135deg, #ffffff, #f8f9fa);
          border-radius: 16px;
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.06);
          border: 1px solid rgba(0, 0, 0, 0.04);
          max-width: 100%;
          margin: 0 auto;
          overflow: hidden;
          height: 6rem;
        }
        
        .title-image {
          max-width: 85%;
          height: 100%;
          object-fit: contain;
          transition: transform 0.3s ease;
        }
        
        .title-image:hover {
          transform: scale(1.02);
        }
        
        @media (max-width: 768px) {
          .title-container {
            padding: 1.2rem 0.8rem;
          }
          
          .title-image {
            max-width: 80%;
          }
        }
      `}</style>
    </div>
  );
});

// Wrapper component to connect Context to Header
const AppContainer = ({ productsData }) => {
  const { apiStats } = React.useContext(ChatContext);
  
  return (
    <>
      <Header />
      <Chat productsData={productsData} />
    </>
  );
};

export default function Home() {
  const [productsData, setProductsData] = useState([]);
  const [initialMessages, setInitialMessages] = useState([]);
  const [systemPrompt, setSystemPrompt] = useState('');
  
  // Load products from markdown
  useEffect(() => {
    async function loadProducts() {
      try {
        const response = await fetch('/productData.md');
        if (!response.ok) {
          throw new Error(`Failed to load product data: ${response.status}`);
        }
        
        const mdContent = await response.text();
        const products = parseProductDataFromMarkdown(mdContent);
        
        console.log(`Successfully loaded ${products.length} products`);
        setProductsData(products);
        
        // Set initial system prompt with products data
        const newSystemPrompt = getSystemPrompt(products);
        setSystemPrompt(newSystemPrompt);
        
        // 修改欢迎消息
        setInitialMessages([{
          id: 'welcome-message',
          role: 'assistant',
          content: 'Hello, I am Rufus, an Amazon AI Assistant. What do you need help with today?'
        }]);
      } catch (error) {
        console.error('Failed to load products:', error);
        // 同样修改错误情况下的欢迎消息
        setInitialMessages([{
          id: 'error-message',
          role: 'assistant',
          content: 'Hello, I am Rufus, an Amazon AI Assistant. What do you need help with today? Note: I\'m currently working with a limited product catalog.'
        }]);
      }
    }
    
    loadProducts();
  }, []);

  // Parse product data from markdown content
  function parseProductDataFromMarkdown(mdContent) {
    const products = [];
    
    // Split content by rows, skipping header rows
    const rows = mdContent.split('\n').filter(row => row.trim().length > 0);
    const dataRows = rows.slice(4); // Skip the header rows
    
    // Parse each row
    dataRows.forEach((row, index) => {
      // Split the row by pipe character
      const columns = row.split('|').map(col => col.trim()).filter(col => col.length > 0);
      
      if (columns.length >= 6) {
        const [name, brand, inputAI, productLink, gender, imageLink] = columns;
        
        // Extract price from inputAI text
        const priceMatch = inputAI.match(/Price:\s*(£[0-9.]+\s*-\s*£?[0-9.]+|£[0-9.]+)/);
        const price = priceMatch ? priceMatch[1] : '';
        
        // Extract description from inputAI text
        const aboutMatch = inputAI.match(/About this item(.*?)(?:Product description|Product details|$)/s);
        const description = aboutMatch ? aboutMatch[1].trim() : '';
        
        // Create product object
        const product = {
          id: `product_${index + 1}`,
          name,
          brand,
          description,
          price,
          gender,
          productLink,
          imageLink,
          // Extract keywords from input AI text for better matching
          keywords: extractKeywords(inputAI)
        };
        
        products.push(product);
      }
    });
    
    console.log(`Parsed ${products.length} products from markdown`);
    return products;
  }

  // Extract keywords from input AI text
  function extractKeywords(inputAI) {
    const keywords = [];
    
    // Extract material keywords
    const materialMatch = inputAI.match(/Material composition([^|]+)/);
    if (materialMatch && materialMatch[1]) {
      const materials = materialMatch[1].split(' ').filter(word => 
        word.length > 3 && 
        !['composition', 'with', 'and', 'the'].includes(word.toLowerCase())
      );
      keywords.push(...materials);
    }
    
    // Extract care instructions
    const careMatch = inputAI.match(/Care instructions([^|]+)/);
    if (careMatch && careMatch[1]) {
      keywords.push(careMatch[1].trim());
    }
    
    // Extract sole material
    const soleMatch = inputAI.match(/Sole material([^|]+)/);
    if (soleMatch && soleMatch[1]) {
      keywords.push(soleMatch[1].trim());
    }
    
    // Extract outer material
    const outerMatch = inputAI.match(/Outer material([^|]+)/);
    if (outerMatch && outerMatch[1]) {
      keywords.push(outerMatch[1].trim());
    }
    
    // Extract important words from product name
    const nameWords = inputAI.split(' ').filter(word => 
      word.length > 4 && 
      !['Price', 'Product', 'details', 'About', 'this', 'item'].includes(word)
    );
    
    keywords.push(...nameWords.slice(0, 10)); // Add up to 10 words from name
    
    return [...new Set(keywords)]; // Remove duplicates
  }

  // Get system prompt with product data
  function getSystemPrompt(products) {
    let prompt = "You are a shopping assistant AI specializing in footwear recommendations. Your task is to recommend products based on user queries. You have access to a catalog of shoes and footwear products. Below is the product catalog you can recommend from:\n\n";
    
    products.forEach((product, index) => {
      prompt += `Product ${index + 1} (ID: ${product.id}):\n`;
      prompt += `Name: ${product.name}\n`;
      prompt += `Brand: ${product.brand}\n`;
      prompt += `Description: ${product.description || 'Not provided'}\n`;
      prompt += `Price: ${product.price || 'Not specified'}\n`;
      prompt += `Gender: ${product.gender || 'unisex'}\n`;
      
      if (product.keywords && product.keywords.length > 0) {
        prompt += `Keywords: ${product.keywords.join(', ')}\n`;
      }
      
      prompt += `\n`;
    });
    
    prompt += "Instructions:\n";
    prompt += "1. When the user asks about products, recommend the most relevant ones based on their query.\n";
    prompt += "2. Consider the user's preferences for brand, style, price range, and any specific features they mention.\n";
    prompt += "3. For each recommendation, explain why it matches their needs.\n";
    prompt += "4. Highlight key features and benefits of the recommended products.\n";
    prompt += "5. For each recommended product, include a product card tag in this format: <product-card data-id=\"PRODUCT_ID\"></product-card>\n";
    prompt += "   where PRODUCT_ID is the ID of the product (e.g., product_1, product_2, etc.).\n";
    prompt += "6. Always recommend exactly 5 products in each response. If there are fewer relevant products, include other similar ones to reach 5 total recommendations.\n";
    prompt += "7. If you cannot find a suitable product, suggest what information the user could provide to help you find better matches.\n";
    
    return prompt;
  }

  // Only render the main content when products are loaded
  if (productsData.length === 0) {
    return (
      <div className="container">
        <Head>
          <title>Footwear Shopping Assistant</title>
          <meta name="description" content="AI-powered footwear shopping assistant" />
          <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
          <meta name="apple-mobile-web-app-capable" content="yes" />
          <meta name="apple-mobile-web-app-status-bar-style" content="default" />
          <link rel="stylesheet" href="/styles.css" />
          <style jsx global>{`
            /* iOS Safari 优化 */
            * {
              -webkit-tap-highlight-color: rgba(0,0,0,0);
              -webkit-touch-callout: none;
            }
            
            /* 修复iOS Safari输入框问题 */
            input {
              -webkit-appearance: none;
              border-radius: 8px;
            }
            
            /* 平滑滚动优化 */
            .chat-messages {
              -webkit-overflow-scrolling: touch;
            }
            
            /* iOS底部安全区域适配 */
            .input-container {
              padding-bottom: env(safe-area-inset-bottom, 20px);
              background-color: white;
            }
            
            /* 修复iOS Safari中固定元素的问题 */
            @supports (-webkit-touch-callout: none) {
              .input-container {
                position: sticky;
                bottom: 0;
              }
            }
            
            /* 修复iOS中按钮的默认样式 */
            button {
              -webkit-appearance: none;
              background-clip: padding-box;
            }
            
            /* 提高触摸目标尺寸 */
            .submit-button, 
            input[type="text"],
            .product-card {
              min-height: 44px; /* Apple建议的最小触摸目标尺寸 */
            }
          `}</style>
        </Head>
        <div className="loading">Loading product catalog...</div>
      </div>
    );
  }

  return (
    <div className="container">
      <Head>
        <title>Footwear Shopping Assistant</title>
        <meta name="description" content="AI-powered footwear shopping assistant" />
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <link rel="stylesheet" href="/styles.css" />
        <style jsx global>{`
          /* iOS Safari 优化 */
          * {
            -webkit-tap-highlight-color: rgba(0,0,0,0);
            -webkit-touch-callout: none;
          }
          
          /* 修复iOS Safari输入框问题 */
          input {
            -webkit-appearance: none;
            border-radius: 8px;
          }
          
          /* 平滑滚动优化 */
          .chat-messages {
            -webkit-overflow-scrolling: touch;
          }
          
          /* iOS底部安全区域适配 */
          .input-container {
            padding-bottom: env(safe-area-inset-bottom, 20px);
            background-color: white;
          }
          
          /* 修复iOS Safari中固定元素的问题 */
          @supports (-webkit-touch-callout: none) {
            .input-container {
              position: sticky;
              bottom: 0;
            }
          }
          
          /* 修复iOS中按钮的默认样式 */
          button {
            -webkit-appearance: none;
            background-clip: padding-box;
          }
          
          /* 提高触摸目标尺寸 */
          .submit-button, 
          input[type="text"],
          .product-card {
            min-height: 44px; /* Apple建议的最小触摸目标尺寸 */
          }
          
          .ai-message-container {
            display: flex;
            align-items: flex-start;
            margin-bottom: 1rem;
          }
          
          .ai-logo-container {
            margin-right: 10px;
            flex-shrink: 0;
          }
          
          .ai-logo {
            width: 32px;
            height: 32px;
            border-radius: 50%;
          }
          
          /* 优化消息容器 */
          .chat-messages {
            padding: 1rem;
            background-color: #f8f9fa;
            border-radius: 12px;
            margin-bottom: 1rem;
          }
          
          /* 优化产品卡片 */
          .product-card {
            transition: all 0.3s ease;
            overflow: hidden;
          }
          
          .product-card:active {
            transform: scale(0.98);
          }
          
          /* 优化图片渲染 */
          img {
            image-rendering: -webkit-optimize-contrast;
            backface-visibility: hidden;
          }
          
          /* 为移动设备优化触摸区域 */
          @media (max-width: 768px) {
            .product-card {
              min-height: 180px;
            }
          }
          
          /* 移动端产品卡片优化 */
          @media (max-width: 576px) {
            .ai-content-wrapper {
              width: 100%;
            }
            
            .product-cards-container {
              display: flex;
              flex-direction: column;
              width: 100%;
            }
            
            .product-card {
              min-height: auto;
              flex-basis: 100% !important;
              max-width: 100% !important;
              margin: 0.75rem 0 !important;
            }
            
            .product-image-container {
              height: 0;
              padding-top: 80%;
              position: relative;
            }
            
            .product-image {
              object-fit: contain !important;
              padding: 15px !important;
            }
            
            .ai-message-container.ai-product-container {
              flex-direction: column !important;
            }
            
            .ai-header {
              margin-bottom: 12px;
            }
          }
          
          /* 添加特定产品列表的容器样式 */
          .ai-product-container {
            flex-direction: column !important;
          }
          
          .ai-product-container .ai-header {
            align-self: flex-start;
          }
        `}</style>
      </Head>

      <ChatProvider 
        initialMessages={initialMessages} 
        productsData={productsData}
        initialSystemPrompt={systemPrompt}
      >
        <AppContainer productsData={productsData} />
      </ChatProvider>
    </div>
  );
}