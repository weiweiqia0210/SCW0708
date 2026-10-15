import express from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI } from '@google/genai';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

app.use(express.json({ limit: '10mb' }));

// Check environment status
app.get('/api/env-status', (_req, res) => {
  const hasEnvKey = Boolean(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.trim() !== '' && process.env.GEMINI_API_KEY !== 'MY_GEMINI_API_KEY');
  res.json({
    hasEnvGeminiKey: hasEnvKey,
    defaultModel: 'gemini-3.8-flash',
  });
});

// Test connection
app.post('/api/test-connection', async (req, res) => {
  try {
    const { provider = 'gemini', customApiKey, customEndpoint, model = 'gemini-3.8-flash' } = req.body;
    const apiKey = (customApiKey && customApiKey.trim()) || process.env.GEMINI_API_KEY;

    if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
      return res.status(400).json({
        success: false,
        error: '未配置有效 API Key。请在下方输入 API Key 或在环境变量中设置 GEMINI_API_KEY。',
      });
    }

    if (provider === 'gemini') {
      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          },
        },
      });

      const response = await ai.models.generateContent({
        model: model || 'gemini-3.8-flash',
        contents: '请回复简短确认："文游连接测试成功。"',
      });

      return res.json({
        success: true,
        message: response.text?.trim() || '连接成功',
        model: model || 'gemini-3.8-flash',
      });
    } else if (provider === 'openai_compatible') {
      const endpoint = (customEndpoint || 'https://api.openai.com/v1').replace(/\/+$/, '');
      const response = await fetch(`${endpoint}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: model || 'gpt-4o-mini',
          messages: [{ role: 'user', content: 'Ping: Reply with "Connection Successful"' }],
          max_tokens: 30,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        return res.status(response.status).json({
          success: false,
          error: `API 返回错误 (${response.status}): ${errorText.slice(0, 300)}`,
        });
      }

      const data = await response.json();
      return res.json({
        success: true,
        message: data.choices?.[0]?.message?.content || '连接成功',
        model: model,
      });
    } else {
      return res.status(400).json({ success: false, error: '不支持的服务商' });
    }
  } catch (error: any) {
    console.error('Test connection error:', error);
    return res.status(500).json({
      success: false,
      error: error?.message || '测试连接失败，请检查网络或配置',
    });
  }
});

// Fetch models list from OpenAI-compatible endpoint or Gemini
app.post('/api/fetch-models', async (req, res) => {
  try {
    const { provider = 'openai_compatible', customApiKey, customEndpoint } = req.body;
    const apiKey = (customApiKey && customApiKey.trim()) || process.env.GEMINI_API_KEY;

    if (provider === 'gemini') {
      return res.json({
        success: true,
        models: [
          'gemini-3.8-flash',
          'gemini-4-argon',
          'gemini-3.1-flash-lite',
        ],
      });
    }

    if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
      return res.status(400).json({
        success: false,
        error: '拉取模型失败：未填写 API Key',
      });
    }

    let endpoint = (customEndpoint || 'https://api.openai.com/v1').replace(/\/+$/, '');
    
    // Attempt to query ${endpoint}/models
    let modelsUrl = endpoint.endsWith('/models') ? endpoint : `${endpoint}/models`;
    
    let response = await fetch(modelsUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
    });

    // If 404, maybe endpoint didn't have /v1
    if (response.status === 404 && !endpoint.includes('/v1')) {
      const fallbackUrl = `${endpoint}/v1/models`;
      const fallbackRes = await fetch(fallbackUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
      });
      if (fallbackRes.ok) {
        response = fallbackRes;
      }
    }

    if (!response.ok) {
      const errorText = await response.text();
      return res.status(response.status).json({
        success: false,
        error: `拉取失败 (${response.status}): ${errorText.slice(0, 300)}`,
      });
    }

    const data = await response.json();
    let modelList: string[] = [];
    if (Array.isArray(data.data)) {
      modelList = data.data.map((m: any) => m.id || m.name || String(m)).filter(Boolean);
    } else if (Array.isArray(data.models)) {
      modelList = data.models.map((m: any) => m.name || m.id || String(m)).filter(Boolean);
    } else if (Array.isArray(data)) {
      modelList = data.map((m: any) => m.id || String(m)).filter(Boolean);
    }

    // Sort models
    modelList.sort();

    return res.json({
      success: true,
      models: modelList,
    });
  } catch (error: any) {
    console.error('Fetch models error:', error);
    return res.status(500).json({
      success: false,
      error: `拉取模型网络异常: ${error?.message || '未知错误'}`,
    });
  }
});

// AI Polish character and auto-extract fields
app.post('/api/polish-character', async (req, res) => {
  try {
    const { text, provider = 'gemini', model = 'gemini-3.8-flash', customApiKey, customEndpoint } = req.body;
    if (!text || !text.trim()) {
      return res.status(400).json({ success: false, error: '请提供需要润色的角色描述' });
    }

    const apiKey = (customApiKey && customApiKey.trim()) || process.env.GEMINI_API_KEY;
    if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
      return res.status(400).json({ success: false, error: '未配置 API Key，无法使用 AI 智能润色' });
    }

    const prompt = `你是一名资深互动小说与角色设定大师。请根据用户提供的原始零散描述，进行专业文学润色和结构化拆解，提炼出完整的角色档案。
必须严格输出合法的纯 JSON 格式（不要附带任何前缀解释、markdown代码块标记或多余文字），JSON 对象包含以下确切键：
{
  "name": "角色姓名（2-6字）",
  "identity": "头衔/身份/阶级（如：苍白裁决官、落魄药圣弟子）",
  "gender": "性别（男/女/未知/机体拟态）",
  "age": "年龄或状态描述",
  "appearance": "外貌容姿、服饰、眼神与气质（80-150字，画面感强）",
  "personality": "性格本质、行事作风、情绪弱点（80-150字）",
  "background": "身世经历、羁绊过往、背负的秘密（80-150字）",
  "speechStyle": "说话风格、习惯称谓、口癖语气（50-100字）",
  "customNotes": "隐藏暗线、特殊弱点或特殊好感关窍（30-80字）"
}

用户输入的原始内容：
${text}`;

    let replyText = '';

    if (provider === 'gemini') {
      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          },
        },
      });

      const response = await ai.models.generateContent({
        model: model || 'gemini-3.8-flash',
        contents: prompt,
        config: {
          temperature: 0.7,
        },
      });
      replyText = response.text || '';
    } else {
      const endpoint = (customEndpoint || 'https://api.openai.com/v1').replace(/\/+$/, '');
      const response = await fetch(`${endpoint}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: model || 'gpt-4o-mini',
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.7,
        }),
      });

      if (!response.ok) {
        const err = await response.text();
        throw new Error(`API 报错 (${response.status}): ${err.slice(0, 200)}`);
      }
      const data = await response.json();
      replyText = data.choices?.[0]?.message?.content || '';
    }

    // Clean JSON markdown
    let cleanJson = replyText.trim();
    if (cleanJson.startsWith('```json')) {
      cleanJson = cleanJson.slice(7);
    } else if (cleanJson.startsWith('```')) {
      cleanJson = cleanJson.slice(3);
    }
    if (cleanJson.endsWith('```')) {
      cleanJson = cleanJson.slice(0, -3);
    }
    cleanJson = cleanJson.trim();

    const parsed = JSON.parse(cleanJson);
    return res.json({
      success: true,
      character: parsed,
    });
  } catch (error: any) {
    console.error('Polish character error:', error);
    return res.status(500).json({
      success: false,
      error: `AI 润色失败: ${error?.message || '解析异常'}`,
    });
  }
});

// Chat stream generation
app.post('/api/chat/stream', async (req, res) => {
  try {
    const {
      provider = 'gemini',
      model = 'gemini-3.8-flash',
      customApiKey,
      customEndpoint,
      systemInstruction,
      messages = [],
      temperature = 0.85,
    } = req.body;

    const apiKey = (customApiKey && customApiKey.trim()) || process.env.GEMINI_API_KEY;

    if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
      return res.status(400).json({
        error: '未配置 API Key。请在“设置”页面中填入您的 API 密钥，或配置环境变量 GEMINI_API_KEY。',
      });
    }

    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();

    if (provider === 'gemini') {
      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          },
        },
      });

      // Format messages into Google GenAI contents
      const formattedContents = messages.map((m: any) => ({
        role: m.role === 'assistant' || m.role === 'model' ? 'model' : 'user',
        parts: [{ text: m.content || m.text || '' }],
      }));

      // Ensure alternating or valid sequence
      if (formattedContents.length === 0) {
        formattedContents.push({
          role: 'user',
          parts: [{ text: '剧情开局' }],
        });
      }

      const responseStream = await ai.models.generateContentStream({
        model: model || 'gemini-3.8-flash',
        contents: formattedContents,
        config: {
          systemInstruction: systemInstruction || undefined,
          temperature: Math.max(0.1, Math.min(1.5, Number(temperature) || 0.85)),
        },
      });

      for await (const chunk of responseStream) {
        if (chunk.text) {
          res.write(`data: ${JSON.stringify({ text: chunk.text })}\n\n`);
        }
      }

      res.write(`data: [DONE]\n\n`);
      res.end();
    } else if (provider === 'openai_compatible') {
      const endpoint = (customEndpoint || 'https://api.openai.com/v1').replace(/\/+$/, '');
      const apiMessages = [];
      if (systemInstruction) {
        apiMessages.push({ role: 'system', content: systemInstruction });
      }
      for (const m of messages) {
        apiMessages.push({
          role: m.role === 'model' ? 'assistant' : m.role,
          content: m.content || m.text || '',
        });
      }

      const externalResponse = await fetch(`${endpoint}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: model || 'gpt-4o-mini',
          messages: apiMessages,
          temperature: Number(temperature) || 0.85,
          stream: true,
        }),
      });

      if (!externalResponse.ok) {
        const errText = await externalResponse.text();
        res.write(`data: ${JSON.stringify({ error: `API 错误 (${externalResponse.status}): ${errText.slice(0, 300)}` })}\n\n`);
        res.write(`data: [DONE]\n\n`);
        return res.end();
      }

      if (!externalResponse.body) {
        res.write(`data: ${JSON.stringify({ error: '上游 API 未返回响应体' })}\n\n`);
        res.write(`data: [DONE]\n\n`);
        return res.end();
      }

      const reader = externalResponse.body.getReader();
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
            const dataStr = trimmed.slice(6);
            if (dataStr === '[DONE]') {
              res.write(`data: [DONE]\n\n`);
              return res.end();
            }
            try {
              const parsed = JSON.parse(dataStr);
              const content = parsed.choices?.[0]?.delta?.content;
              if (content) {
                res.write(`data: ${JSON.stringify({ text: content })}\n\n`);
              }
            } catch {
              // ignore parse errors on partial chunks
            }
          }
        }
      }

      res.write(`data: [DONE]\n\n`);
      res.end();
    } else {
      res.write(`data: ${JSON.stringify({ error: '未知 AI 服务商' })}\n\n`);
      res.write(`data: [DONE]\n\n`);
      res.end();
    }
  } catch (error: any) {
    console.error('Chat stream error:', error);
    try {
      res.write(`data: ${JSON.stringify({ error: error?.message || '生成失败，请重试' })}\n\n`);
      res.write(`data: [DONE]\n\n`);
      res.end();
    } catch {
      // response might already be closed
    }
  }
});

// Setup dev server with Vite middlewares or static files in production
async function startServer() {
  const isProd = process.env.NODE_ENV === 'production';

  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(port, '0.0.0.0', () => {
    console.log(`AI Text Adventure Server running on http://0.0.0.0:${port}`);
  });
}

startServer();
