import { AppSettings, ChatMessage } from '../types';

export async function streamFromDirectClient(
  settings: AppSettings,
  systemInstruction: string,
  conversationHistory: ChatMessage[],
  signal: AbortSignal,
  onChunk: (accumulatedRawText: string) => void
): Promise<string> {
  const apiKey = (settings.customApiKey && settings.customApiKey.trim()) || '';
  if (!apiKey) {
    throw new Error('未检测到后端服务且未填写 API Key。若在纯静态环境（如 GitHub Pages）中运行，请前往“设置”填入您的 API 密钥');
  }

  let accumulated = '';

  if (settings.provider === 'openai_compatible') {
    const endpoint = (settings.customEndpoint || 'https://api.openai.com/v1').replace(/\/+$/, '');
    const res = await fetch(`${endpoint}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      signal,
      body: JSON.stringify({
        model: settings.model || 'gpt-4o-mini',
        stream: true,
        temperature: settings.temperature ?? 0.8,
        messages: [
          { role: 'system', content: systemInstruction },
          ...conversationHistory.map((m) => ({
            role: m.role === 'assistant' ? 'assistant' : 'user',
            content: m.content,
          })),
        ],
      }),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      throw new Error(`API 请求失败 (${res.status}): ${errText.slice(0, 300)}`);
    }

    if (!res.body) throw new Error('未接收到流数据');

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith('data: ')) {
          const dataStr = trimmed.slice(6).trim();
          if (dataStr === '[DONE]') break;
          try {
            const parsed = JSON.parse(dataStr);
            const delta = parsed.choices?.[0]?.delta?.content;
            if (delta) {
              accumulated += delta;
              onChunk(accumulated);
            }
          } catch {
            // ignore non-json ping
          }
        }
      }
    }
  } else {
    // Gemini direct call from browser
    const model = settings.model || 'gemini-2.5-flash';
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse&key=${apiKey}`;

    const contents = conversationHistory.map((m) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }));

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal,
      body: JSON.stringify({
        contents,
        systemInstruction: {
          parts: [{ text: systemInstruction }],
        },
        generationConfig: {
          temperature: settings.temperature ?? 0.8,
        },
      }),
    });

    if (!res.ok) {
      const errJson = await res.json().catch(() => null);
      throw new Error(errJson?.error?.message || `Gemini API 响应异常 (${res.status})`);
    }

    if (!res.body) throw new Error('未接收到流数据');

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith('data: ')) {
          const dataStr = trimmed.slice(6).trim();
          if (dataStr === '[DONE]') break;
          try {
            const parsed = JSON.parse(dataStr);
            const chunkText = parsed.candidates?.[0]?.content?.parts?.[0]?.text;
            if (chunkText) {
              accumulated += chunkText;
              onChunk(accumulated);
            }
          } catch {
            // ignore
          }
        }
      }
    }
  }

  return accumulated;
}

export async function testConnectionDirectClient(settings: AppSettings): Promise<string> {
  const apiKey = (settings.customApiKey && settings.customApiKey.trim()) || '';
  if (!apiKey) {
    throw new Error('未填写 API Key');
  }

  if (settings.provider === 'openai_compatible') {
    const endpoint = (settings.customEndpoint || 'https://api.openai.com/v1').replace(/\/+$/, '');
    const res = await fetch(`${endpoint}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: settings.model || 'gpt-4o-mini',
        messages: [{ role: 'user', content: 'Ping: Reply with "Connection Successful"' }],
        max_tokens: 20,
      }),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      throw new Error(`API 响应错误 (${res.status}): ${errText.slice(0, 300)}`);
    }

    const data = await res.json();
    return data.choices?.[0]?.message?.content || '连接成功';
  } else {
    const model = settings.model || 'gemini-2.5-flash';
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: '请回复简短确认："文游连接测试成功。"' }] }],
      }),
    });

    if (!res.ok) {
      const errJson = await res.json().catch(() => null);
      throw new Error(errJson?.error?.message || `Gemini 测试失败 (${res.status})`);
    }

    const data = await res.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text || '连接成功';
  }
}
