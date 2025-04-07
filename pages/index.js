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
  
  // API stats
  const [apiStats, setApiStats] = useState({
    totalCost: 0,
    totalCalls: 0,
    lastCallStats: null
  });

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
    // 从响应中提取开头文字
    let introText = '';
    const cleanResponse = response;
    const fixedOutroText = "Would you like more specific recommendations? Feel free to ask for other styles or features.";
    
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
    
    // 如果有产品卡片，提取开头文字
    if (productCardMatches.length > 0) {
      // 提取开头文字 (从开始到第一个产品卡片)
      const firstCardIndex = productCardMatches[0].index;
      if (firstCardIndex > 0) {
        introText = response.substring(0, firstCardIndex).trim();
        
        // 简化开头文字，保留第一句话
        const firstSentenceMatch = introText.match(/^([^.!?]+[.!?])/);
        if (firstSentenceMatch) {
          introText = firstSentenceMatch[1].trim();
        } else if (introText.length > 120) {
          introText = introText.substring(0, 120) + '...';
        }
      }
    }
    
    return {
      text: cleanResponse,
      introText,
      outroText: recommendedProducts.length > 0 ? fixedOutroText : '',
      products: recommendedProducts
    };
  }
  
  // Call Claude API via the Next.js API route
  async function callClaudeAPI(messages) {
    const startTime = Date.now();
    
    try {
      console.log('Calling Claude API with messages:', messages);
      
      const response = await fetch('/api/claude', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          messages: messages,
          model: 'claude-3-7-sonnet-20250219',
          max_tokens: 1500,
          temperature: 0.7
        })
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
          }
        }));
        
        console.log(`Claude API response successful in ${time.toFixed(2)}s`);
        console.log(`Cost: $${totalCost.toFixed(6)} (Input: $${inputCost.toFixed(6)}, Output: $${outputCost.toFixed(6)})`);
      }
      
      return data.content;
    } catch (error) {
      console.error('Error calling Claude API:', error);
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
      
      // Call Claude API
      const response = await callClaudeAPI(formattedMessages);
      
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
    messagesEndRef
  };

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
}

// Create a stable cache for product images to prevent reloads
const imageCache = new Map();

// Create a ProductCard component before the main component
// This ensures it's only defined once and doesn't get redefined on each render
const ProductCard = React.memo(({ product }) => {
  // Get the cached image URL or create a new one
  if (!imageCache.has(product.id)) {
    imageCache.set(product.id, product.imageLink);
  }
  const imageUrl = imageCache.get(product.id);
  
  const handleClick = () => {
    window.open(product.productLink, '_blank');
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
      <div className="product-info">
        <div className="product-brand">{product.brand}</div>
        <div className="product-title">{product.name}</div>
        <div className="product-price">{product.price || ''}</div>
        <div className="product-description">
          {product.description ? `${product.description.substring(0, 100)}...` : ''}
        </div>
      </div>
    </div>
  );
}, (prevProps, nextProps) => {
  // Proper comparison - only re-render if the product IDs change
  return prevProps.product.id === nextProps.product.id;
});

// Product recommendation component
const ProductRecommendation = React.memo(({ introText, products, outroText }) => {
  if (!products || products.length === 0) return null;
  
  return (
    <div className="recommendation-container">
      {introText && <div className="recommendation-intro">{introText}</div>}
      
      <div className="product-cards-container">
        {products.map((product) => (
          <ProductCard key={`product-${product.id}`} product={product} />
        ))}
      </div>
      
      {outroText && <div className="recommendation-outro">{outroText}</div>}
    </div>
  );
}, (prevProps, nextProps) => {
  // Compare products by ID rather than length
  if (prevProps.products?.length !== nextProps.products?.length) return false;
  
  // Compare each product ID
  for (let i = 0; i < prevProps.products?.length; i++) {
    if (prevProps.products[i].id !== nextProps.products[i].id) return false;
  }
  
  return true;
});

// Message item component
const MessageItem = React.memo(({ message }) => {
  // User messages or assistant messages without products
  if (message.role === 'user' || (!message.products || message.products.length === 0)) {
    return (
      <div className={`message ${message.role === 'user' ? 'user-message' : 'ai-message'}`}>
        {message.content}
      </div>
    );
  }
  
  // Assistant messages with product recommendations
  return (
    <ProductRecommendation 
      introText={message.introText} 
      products={message.products} 
      outroText={message.outroText}
    />
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
        />
        <button onClick={handleSendMessage} disabled={isLoading}>
          Send
        </button>
      </div>
    </div>
  );
}

// Header component to prevent unnecessary re-renders
const Header = React.memo(() => {
  return (
    <div className="header">
      <h1>Footwear Shopping Assistant</h1>
      <p>Tell me what shoes you're looking for and I'll recommend the best options for you!</p>
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
        
        // 添加欢迎消息到UI
        setInitialMessages([{
          id: 'welcome-message',
          role: 'assistant',
          content: 'Hello! I\'m your footwear shopping assistant. Tell me what kind of shoes you\'re looking for, and I\'ll recommend the best options for you!'
        }]);
      } catch (error) {
        console.error('Failed to load products:', error);
        setInitialMessages([{
          id: 'error-message',
          role: 'assistant',
          content: 'Hello! I\'m your footwear shopping assistant. Note: I\'m currently working with a limited product catalog. Some products may not be available.'
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
    prompt += "6. Recommend at most 2-3 products per response to avoid overwhelming the user.\n";
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
          <link rel="stylesheet" href="/styles.css" />
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
        <link rel="stylesheet" href="/styles.css" />
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