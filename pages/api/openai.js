// Next.js API route for OpenAI API proxy
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const startTime = Date.now();
  
  try {
    // 使用环境变量中的API密钥
    const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
    const { messages, model, max_tokens, temperature } = req.body;

    if (!OPENAI_API_KEY) {
      return res.status(500).json({ error: 'OpenAI API key is not configured on the server' });
    }

    // 确保至少有一条消息
    if (!messages || messages.length === 0) {
      return res.status(400).json({ 
        error: 'At least one message is required', 
        details: { messages }
      });
    }

    // 使用GPT-4o-mini模型
    const useModel = "gpt-4o-mini";
    
    // 准备发送到OpenAI API的请求体
    const requestBody = {
      model: useModel,
      max_tokens: max_tokens || 1500,
      messages: messages,
      temperature: temperature || 0.7
    };

    console.log('Sending request to OpenAI API:', JSON.stringify({
      ...requestBody,
      model: requestBody.model
    }, null, 2));

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`
      },
      body: JSON.stringify(requestBody)
    });

    const data = await response.json();
    
    if (!response.ok) {
      console.error('OpenAI API error:', data);
      return res.status(response.status).json({ 
        error: 'Error from OpenAI API', 
        details: data 
      });
    }

    // 计算统计信息
    const time = (Date.now() - startTime) / 1000;
    const inputTokens = data.usage?.prompt_tokens || 0;
    const outputTokens = data.usage?.completion_tokens || 0;
    
    // GPT-4o-mini的价格 (根据图片中的价格)
    // 输入: $0.15/1M tokens = $0.00000015/token
    // 输出: $0.60/1M tokens = $0.00000060/token
    const inputCost = inputTokens * 0.00000015;
    const outputCost = outputTokens * 0.00000060;
    const totalCost = inputCost + outputCost;

    return res.status(200).json({
      content: data.choices[0].message.content,
      stats: {
        time,
        inputTokens,
        outputTokens,
        inputCost,
        outputCost,
        totalCost,
        model: useModel
      }
    });
  } catch (error) {
    console.error('Error in OpenAI API handler:', error);
    return res.status(500).json({ 
      error: 'Internal server error', 
      message: error.message 
    });
  }
} 