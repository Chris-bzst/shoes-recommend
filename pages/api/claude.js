// Next.js API route for Claude API proxy
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const startTime = Date.now();
  
  try {
    // 使用环境变量中的API密钥，不再从客户端获取
    const CLAUDE_API_KEY = process.env.CLAUDE_API_KEY;
    const { messages, model, max_tokens, temperature } = req.body;

    if (!CLAUDE_API_KEY) {
      return res.status(500).json({ error: 'API key is not configured on the server' });
    }

    // 提取 system 消息并将其余消息格式化为 Claude API 所需的格式
    let systemPrompt = '';
    const formattedMessages = [];

    for (const message of messages) {
      if (message.role === 'system') {
        systemPrompt = message.content;
      } else {
        formattedMessages.push(message);
      }
    }

    // 确保至少有一条消息
    if (formattedMessages.length === 0) {
      return res.status(400).json({ 
        error: 'At least one non-system message is required', 
        details: { messages }
      });
    }

    // 准备发送到 Claude API 的请求体
    const requestBody = {
      model: model || 'claude-3-sonnet-20240229',
      max_tokens: max_tokens || 1500,
      messages: formattedMessages,
      temperature: temperature || 0.7
    };

    // 只有当系统提示非空时才添加它
    if (systemPrompt.trim()) {
      requestBody.system = systemPrompt;
    }

    console.log('Sending request to Claude API:', JSON.stringify({
      ...requestBody,
      system: systemPrompt ? '[SYSTEM PROMPT PRESENT]' : undefined
    }, null, 2));

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': CLAUDE_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify(requestBody)
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('Claude API error:', data);
      return res.status(response.status).json({
        error: `Claude API error: ${response.status}`,
        details: data
      });
    }

    // 计算花费的时间
    const endTime = Date.now();
    const timeElapsed = (endTime - startTime) / 1000; // 秒

    // 计算输入和输出的token数量
    const inputTokenEstimate = JSON.stringify(requestBody).length / 4; // 粗略估计
    const outputText = data.content[0].text;
    const outputTokenEstimate = outputText.length / 4;

    // 估算价格 (基于Claude 3 Sonnet定价)
    const inputCost = (inputTokenEstimate / 1000000) * 3; // $3/百万token
    const outputCost = (outputTokenEstimate / 1000000) * 15; // $15/百万token
    const totalCostEstimate = inputCost + outputCost;

    console.log(`Claude API response received in ${timeElapsed.toFixed(2)}s`);
    console.log(`Input tokens (est): ${Math.round(inputTokenEstimate)}, Output tokens (est): ${Math.round(outputTokenEstimate)}`);
    console.log(`Cost estimate: $${totalCostEstimate.toFixed(6)} (Input: $${inputCost.toFixed(6)}, Output: $${outputCost.toFixed(6)})`);
    
    // Return just the content text to simplify the client-side handling
    return res.status(200).json({ 
      content: data.content[0].text,
      stats: {
        time: timeElapsed,
        inputTokens: Math.round(inputTokenEstimate),
        outputTokens: Math.round(outputTokenEstimate),
        inputCost: inputCost,
        outputCost: outputCost,
        totalCost: totalCostEstimate
      }
    });
  } catch (error) {
    console.error('Error calling Claude API:', error);
    return res.status(500).json({ error: 'Internal server error', message: error.message, stack: error.stack });
  }
} 