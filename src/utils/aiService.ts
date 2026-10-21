import { AIProvider, AppSettings } from '../types';

export interface ChatApiMessage {
  role: 'user' | 'model' | 'assistant';
  text?: string;
  content?: string;
}

export interface StreamChatParams {
  provider: AIProvider;
  model: string;
  customApiKey?: string;
  customEndpoint?: string;
  temperature?: number;
  systemInstruction?: string;
  messages: ChatApiMessage[];
  signal?: AbortSignal;
  onChunk: (text: string) => void;
  onDone?: () => void;
}

// Cache whether the backend /api is accessible
let backendAvailable: boolean | null = null;

export async function checkBackendStatus(): Promise<{
  hasBackend: boolean;
  hasEnvKey: boolean;
  defaultModel: string;
}> {
  try {
    const res = await fetch('/api/env-status', {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
    });
    if (res.ok) {
      const data = await res.json();
      backendAvailable = true;
      return {
        hasBackend: true,
        hasEnvKey: Boolean(data.hasEnvGeminiKey),
        defaultModel: data.defaultModel || 'gemini-3.8-flash',
      };
    }
  } catch {
    // Backend unreachable (e.g. GitHub Pages static deployment)
  }
  backendAvailable = false;
  return {
    hasBackend: false,
    hasEnvKey: false,
    defaultModel: 'gemini-3.8-flash',
  };
}

/**
 * Core Streaming Chat Service:
 * 1. Attempts to use backend /api/chat/stream proxy if available.
 * 2. If backend returns 404 or fails to connect (e.g. on GitHub Pages static deployment),
 *    it automatically falls back to direct client-side API streaming using the user's API Key!
 */
export async function streamChat(params: StreamChatParams): Promise<void> {
  const {
    provider,
    model,
    customApiKey,
    customEndpoint,
    temperature = 0.85,
    systemInstruction,
    messages,
    signal,
    onChunk,
    onDone,
  } = params;

  // If backend was already confirmed unavailable or not yet checked, test backend first
  if (backendAvailable !== false) {
    try {
      const res = await fetch('/api/chat/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal,
        body: JSON.stringify({
          provider,
          model,
          customApiKey,
          customEndpoint,
          temperature,
          systemInstruction,
          messages,
        }),
      });

      // If backend exists and responds
      if (res.status !== 404) {
        backendAvailable = true;
        if (!res.ok) {
          const errJson = await res.json().catch(() => null);
          throw new Error(errJson?.error || `服务请求失败 (${res.status})`);
        }
        if (!res.body) {
          throw new Error('未接收到响应数据流');
        }

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
              const dataStr = trimmed.slice(6);
              if (dataStr === '[DONE]') {
                onDone?.();
                return;
              }
              try {
                const parsed = JSON.parse(dataStr);
                if (parsed.error) {
                  throw new Error(parsed.error);
                }
                if (parsed.text) {
                  onChunk(parsed.text);
                }
              } catch (parseErr: any) {
                if (parseErr.message && !parseErr.message.includes('JSON')) {
                  throw parseErr;
                }
              }
            }
          }
        }
        onDone?.();
        return;
      } else {
        // Backend returned 404 -> we are in a static hosting environment like GitHub Pages!
        backendAvailable = false;
      }
    } catch (e: any) {
      if (e.name === 'AbortError') throw e;
      // If it wasn't a 404 and backend failed with real API error, only fallback if backend fetch completely failed
      if (backendAvailable === true) {
        throw e;
      }
      backendAvailable = false;
    }
  }

  // --- CLIENT-SIDE DIRECT FALLBACK (GitHub Pages / Static Mode) ---
  const apiKey = customApiKey?.trim();
  if (!apiKey) {
    throw new Error('当前运行在 GitHub Pages 纯前端静态模式。请在“设置”页面中输入您的 API Key 即可直接游玩！');
  }

  if (provider === 'gemini') {
    await streamGeminiClientSide({
      apiKey,
      model,
      temperature,
      systemInstruction,
      messages,
      signal,
      onChunk,
      onDone,
    });
  } else if (provider === 'openai_compatible') {
    await streamOpenAIClientSide({
      apiKey,
      endpoint: customEndpoint || 'https://api.openai.com/v1',
      model,
      temperature,
      systemInstruction,
      messages,
      signal,
      onChunk,
      onDone,
    });
  } else {
    throw new Error(`不支持的服务商: ${provider}`);
  }
}

async function streamGeminiClientSide(opts: {
  apiKey: string;
  model: string;
  temperature: number;
  systemInstruction?: string;
  messages: ChatApiMessage[];
  signal?: AbortSignal;
  onChunk: (text: string) => void;
  onDone?: () => void;
}) {
  const contents = opts.messages.map((m) => ({
    role: m.role === 'assistant' || m.role === 'model' ? 'model' : 'user',
    parts: [{ text: m.text || m.content || '' }],
  }));

  if (contents.length === 0) {
    contents.push({ role: 'user', parts: [{ text: '剧情开局' }] });
  }

  const payload: any = {
    contents,
    generationConfig: {
      temperature: Math.max(0.1, Math.min(1.5, opts.temperature)),
    },
  };

  if (opts.systemInstruction) {
    payload.systemInstruction = {
      parts: [{ text: opts.systemInstruction }],
    };
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
    opts.model || 'gemini-3.8-flash'
  )}:streamGenerateContent?alt=sse&key=${encodeURIComponent(opts.apiKey)}`;

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    signal: opts.signal,
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`Gemini 接口请求失败 (${res.status}): ${errText.slice(0, 200)}`);
  }

  if (!res.body) {
    throw new Error('未接收到 Gemini 响应流');
  }

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
        const jsonStr = trimmed.slice(6);
        try {
          const parsed = JSON.parse(jsonStr);
          const chunkText = parsed.candidates?.[0]?.content?.parts?.[0]?.text;
          if (chunkText) {
            opts.onChunk(chunkText);
          }
        } catch {
          // ignore partial json
        }
      }
    }
  }

  opts.onDone?.();
}

async function streamOpenAIClientSide(opts: {
  apiKey: string;
  endpoint: string;
  model: string;
  temperature: number;
  systemInstruction?: string;
  messages: ChatApiMessage[];
  signal?: AbortSignal;
  onChunk: (text: string) => void;
  onDone?: () => void;
}) {
  const cleanEndpoint = opts.endpoint.replace(/\/+$/, '');
  const url = cleanEndpoint.endsWith('/chat/completions')
    ? cleanEndpoint
    : `${cleanEndpoint}/chat/completions`;

  const apiMessages = [];
  if (opts.systemInstruction) {
    apiMessages.push({ role: 'system', content: opts.systemInstruction });
  }
  for (const m of opts.messages) {
    apiMessages.push({
      role: m.role === 'model' ? 'assistant' : m.role,
      content: m.text || m.content || '',
    });
  }

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${opts.apiKey}`,
    },
    body: JSON.stringify({
      model: opts.model,
      messages: apiMessages,
      temperature: opts.temperature,
      stream: true,
    }),
    signal: opts.signal,
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`API 接口请求失败 (${res.status}): ${errText.slice(0, 200)}`);
  }

  if (!res.body) {
    throw new Error('未接收到响应流');
  }

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
        const dataStr = trimmed.slice(6);
        if (dataStr === '[DONE]') {
          opts.onDone?.();
          return;
        }
        try {
          const parsed = JSON.parse(dataStr);
          const chunkContent = parsed.choices?.[0]?.delta?.content;
          if (chunkContent) {
            opts.onChunk(chunkContent);
          }
        } catch {
          // ignore
        }
      }
    }
  }

  opts.onDone?.();
}

/**
 * Test Connection (Dual Mode: Server proxy + Client direct fallback)
 */
export async function testConnection(params: {
  provider: AIProvider;
  model: string;
  customApiKey?: string;
  customEndpoint?: string;
  signal?: AbortSignal;
}): Promise<{ success: boolean; message: string; model?: string }> {
  const { provider, model, customApiKey, customEndpoint, signal } = params;

  // Internal 15s timeout controller
  const timeoutCtrl = new AbortController();
  let timedOut = false;
  const timeoutTimer = setTimeout(() => {
    timedOut = true;
    timeoutCtrl.abort('timeout');
  }, 15000);

  if (signal) {
    signal.addEventListener('abort', () => timeoutCtrl.abort('user_abort'));
  }

  const effectiveSignal = timeoutCtrl.signal;

  try {
    // Try backend proxy if available
    if (backendAvailable !== false) {
      try {
        const res = await fetch('/api/test-connection', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(params),
          signal: effectiveSignal,
        });

        clearTimeout(timeoutTimer);

        if (res.status === 408) {
          return {
            success: false,
            message: '测试超时：已等待超过 15 秒未响应。上游接口响应迟缓，请检查网络或切换模型重试。',
          };
        }

        if (res.status !== 404) {
          backendAvailable = true;
          const data = await res.json();
          return {
            success: Boolean(data.success),
            message: data.message || data.error || (data.success ? '连接成功' : '测试失败'),
            model: data.model || model,
          };
        }
        backendAvailable = false;
      } catch (err: any) {
        if (err?.name === 'AbortError' || timedOut) {
          clearTimeout(timeoutTimer);
          if (timedOut) {
            return {
              success: false,
              message: '测试超时：已等待超过 15 秒未收到上游 API 响应。请检查网络、接口地址或切换模型。',
            };
          }
          return { success: false, message: '已取消本次连接测试。' };
        }
        backendAvailable = false;
      }
    }

    // Client-side fallback
    const apiKey = customApiKey?.trim();
    if (!apiKey) {
      clearTimeout(timeoutTimer);
      return {
        success: false,
        message: '静态模式下必须输入 API Key 才能进行连接测试',
      };
    }

    if (provider === 'gemini') {
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
          model || 'gemini-3.8-flash'
        )}:generateContent?key=${encodeURIComponent(apiKey)}`;
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ role: 'user', parts: [{ text: '请回复简短确认："文游连接测试成功。"' }] }],
          }),
          signal: effectiveSignal,
        });
        clearTimeout(timeoutTimer);
        if (!res.ok) {
          const errText = await res.text();
          return { success: false, message: `Gemini 响应失败 (${res.status}): ${errText.slice(0, 200)}` };
        }
        const data = await res.json();
        const reply = data.candidates?.[0]?.content?.parts?.[0]?.text || '连接成功';
        return { success: true, message: reply.trim(), model };
      } catch (e: any) {
        clearTimeout(timeoutTimer);
        if (e?.name === 'AbortError' || timedOut) {
          if (timedOut) {
            return {
              success: false,
              message: '测试超时：已等待超过 15 秒未收到上游 API 响应。请检查网络或切换模型。',
            };
          }
          return { success: false, message: '已取消本次连接测试。' };
        }
        return { success: false, message: `连接异常: ${e.message}` };
      }
    } else if (provider === 'openai_compatible') {
      try {
        const endpoint = (customEndpoint || 'https://api.openai.com/v1').replace(/\/+$/, '');
        const url = endpoint.endsWith('/chat/completions') ? endpoint : `${endpoint}/chat/completions`;
        const res = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model,
            messages: [{ role: 'user', content: 'Say hello in one short sentence.' }],
            max_tokens: 20,
          }),
          signal: effectiveSignal,
        });
        clearTimeout(timeoutTimer);
        if (!res.ok) {
          const errText = await res.text();
          return { success: false, message: `API 响应失败 (${res.status}): ${errText.slice(0, 200)}` };
        }
        const data = await res.json();
        return {
          success: true,
          message: data.choices?.[0]?.message?.content || '连接成功',
          model,
        };
      } catch (e: any) {
        clearTimeout(timeoutTimer);
        if (e?.name === 'AbortError' || timedOut) {
          if (timedOut) {
            return {
              success: false,
              message: '测试超时：已等待超过 15 秒未收到上游 API 响应。请检查网络、接口地址或切换模型。',
            };
          }
          return { success: false, message: '已取消本次连接测试。' };
        }
        return { success: false, message: `连接异常: ${e.message}` };
      }
    }

    clearTimeout(timeoutTimer);
    return { success: false, message: '未知服务商' };
  } finally {
    clearTimeout(timeoutTimer);
  }
}

/**
 * Fetch Models (Dual Mode: Server proxy + Client direct fallback)
 */
export async function fetchModels(params: {
  provider: AIProvider;
  customApiKey?: string;
  customEndpoint?: string;
}): Promise<{ success: boolean; models: string[]; error?: string }> {
  if (params.provider === 'gemini') {
    return {
      success: true,
      models: [
        'gemini-3.8-flash',
        'gemini-4-argon',
        'gemini-3.1-flash-lite',
      ],
    };
  }

  // Try backend proxy if available
  if (backendAvailable !== false) {
    try {
      const res = await fetch('/api/fetch-models', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      });

      if (res.status !== 404) {
        backendAvailable = true;
        const data = await res.json();
        return data;
      }
      backendAvailable = false;
    } catch {
      backendAvailable = false;
    }
  }

  // Client-side direct query
  const apiKey = params.customApiKey?.trim();
  if (!apiKey) {
    return { success: false, models: [], error: '未填写 API Key' };
  }

  try {
    let endpoint = (params.customEndpoint || 'https://api.openai.com/v1').replace(/\/+$/, '');
    let modelsUrl = endpoint.endsWith('/models') ? endpoint : `${endpoint}/models`;

    let res = await fetch(modelsUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
    });

    if (res.status === 404 && !endpoint.includes('/v1')) {
      const fallbackUrl = `${endpoint}/v1/models`;
      const fallbackRes = await fetch(fallbackUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
      });
      if (fallbackRes.ok) {
        res = fallbackRes;
      }
    }

    if (!res.ok) {
      const errorText = await res.text();
      return { success: false, models: [], error: `拉取失败 (${res.status}): ${errorText.slice(0, 200)}` };
    }

    const data = await res.json();
    let modelList: string[] = [];
    if (Array.isArray(data.data)) {
      modelList = data.data.map((m: any) => m.id || m.name || String(m)).filter(Boolean);
    } else if (Array.isArray(data.models)) {
      modelList = data.models.map((m: any) => m.name || m.id || String(m)).filter(Boolean);
    } else if (Array.isArray(data)) {
      modelList = data.map((m: any) => m.id || String(m)).filter(Boolean);
    }

    modelList.sort();
    return { success: true, models: modelList };
  } catch (e: any) {
    return { success: false, models: [], error: `网络异常: ${e.message}` };
  }
}

/**
 * Polish Character (Dual Mode: Server proxy + Client direct fallback)
 */
export async function polishCharacter(params: {
  text: string;
  provider: AIProvider;
  model: string;
  customApiKey?: string;
  customEndpoint?: string;
}): Promise<{ success: boolean; character?: any; error?: string }> {
  // Try backend proxy if available
  if (backendAvailable !== false) {
    try {
      const res = await fetch('/api/polish-character', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      });

      if (res.status !== 404) {
        backendAvailable = true;
        const data = await res.json();
        return data;
      }
      backendAvailable = false;
    } catch {
      backendAvailable = false;
    }
  }

  // Client-side fallback
  const apiKey = params.customApiKey?.trim();
  if (!apiKey) {
    return { success: false, error: '静态部署模式下，请先在“设置”中填写 API Key' };
  }

  const prompt = `你是一名资深互动小说与角色设定大师。请根据用户提供的原始零散描述，进行专业文学润色和结构化拆解，提炼出完整的角色档案。
必须严格输出合法的纯 JSON 格式（不要附带任何前缀解释、markdown代码块标记或多余文字），JSON 对象包含以下确切键：
{
  "name": "角色姓名（精炼有韵味）",
  "identity": "身份职业（如：天谕司神官、星际赏金猎人）",
  "gender": "性别（男 / 女 / 其他）",
  "age": "年龄（如：24岁、外表19岁或成长期）",
  "appearance": "外貌神态（详细描写容貌、体态、服饰、独特标志等，150-300字）",
  "personality": "性格特质（立体多面，包含表层性格、潜在性格、底线反差等，150-300字）",
  "background": "身世背景（核心过往经历、身世之谜、与世界主线的关联等，200-400字）",
  "speechStyle": "台词语气习惯（口吻、语气助词、说话频率、经典语调，80-150字）",
  "customNotes": "特殊能力/弱点/羁绊/专属信物等补充（100-200字）"
}

用户提供的原始零散描述如下：
"${params.text}"`;

  try {
    let replyText = '';
    if (params.provider === 'gemini') {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
        params.model || 'gemini-3.8-flash'
      )}:generateContent?key=${encodeURIComponent(apiKey)}`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.7 },
        }),
      });
      if (!res.ok) {
        const errText = await res.text();
        return { success: false, error: `Gemini 润色请求失败 (${res.status}): ${errText.slice(0, 200)}` };
      }
      const data = await res.json();
      replyText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    } else {
      const endpoint = (params.customEndpoint || 'https://api.openai.com/v1').replace(/\/+$/, '');
      const url = endpoint.endsWith('/chat/completions') ? endpoint : `${endpoint}/chat/completions`;
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: params.model,
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.7,
        }),
      });
      if (!res.ok) {
        const errText = await res.text();
        return { success: false, error: `API 润色请求失败 (${res.status}): ${errText.slice(0, 200)}` };
      }
      const data = await res.json();
      replyText = data.choices?.[0]?.message?.content || '';
    }

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
    return { success: true, character: parsed };
  } catch (e: any) {
    return { success: false, error: `解析异常: ${e.message}` };
  }
}

export interface StorySetupPolishResult {
  title?: string;
  openingPremise?: string;
  writingGuidance?: string;
}

/**
 * AI Polish Story Setup (Title, Opening Premise, Writing Guidance)
 */
export async function polishStorySetup(params: {
  userInput: string;
  characters?: any[];
  worldbooks?: any[];
  roleMap?: Record<string, string>;
  provider: AIProvider;
  model: string;
  customApiKey?: string;
  customEndpoint?: string;
}): Promise<{ success: boolean; data?: StorySetupPolishResult; error?: string }> {
  // Try backend proxy if available
  if (backendAvailable !== false) {
    try {
      const res = await fetch('/api/polish-story-setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      });

      if (res.status !== 404) {
        backendAvailable = true;
        const result = await res.json();
        return result;
      }
      backendAvailable = false;
    } catch {
      backendAvailable = false;
    }
  }

  // Client-side fallback
  const apiKey = params.customApiKey?.trim();
  if (!apiKey) {
    return { success: false, error: '静态部署模式下，请先在“设置”中填写 API Key' };
  }

  const charContext = (params.characters || []).length > 0
    ? `登场角色：\n` + (params.characters || []).map((c: any) => {
        const roleLabel = params.roleMap?.[c.id] === 'protagonist' ? '【主角】' : params.roleMap?.[c.id] === 'extra' ? '【群演】' : '【配角】';
        return `- ${c.name} ${roleLabel}（${c.identity || ''}）：${c.personality || ''}。背景：${c.background || ''}`;
      }).join('\n')
    : '暂未指定特定角色。';

  const wbContext = (params.worldbooks || []).length > 0
    ? `世界观设定：\n` + (params.worldbooks || []).map((w: any) => `- 《${w.name}》：${w.description || ''}`).join('\n')
    : '';

  const prompt = `你是一名顶级互动小说世界架构师与叙事总监。
请根据玩家提供的原始想法/灵感需求，结合已选定的登场角色与世界观设定，进行深度文学润色、开局情境构建与写作规范提炼。
必须严格输出合法的纯 JSON 格式（不要附带任何前缀解释、markdown代码块标记或多余文字），包含以下确切键：
{
  "title": "富有文学张力与画面感的故事存档标题（6-16字，如：极地孤影·誓约重燃、星渊长夜·破晓突围）",
  "openingPremise": "开局背景与情境设定（生动、沉浸、富有代入感的开局环境描写与初遇戏剧性情境，交代时间、地点、氛围、主角与相关人物的初遇戏剧张力，约150-300字）",
  "writingGuidance": "本场写作指导（提炼叙事基调、行文风格、冲突张力节奏、角色互动注意点等，约80-180字）"
}

【当前设定的角色与世界观背景】：
${charContext}
${wbContext}

【玩家提供的原始想法/灵感描述】：
"${params.userInput.trim()}"`;

  try {
    let replyText = '';
    if (params.provider === 'gemini') {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
        params.model || 'gemini-3.8-flash'
      )}:generateContent?key=${encodeURIComponent(apiKey)}`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.75 },
        }),
      });
      if (!res.ok) {
        const errText = await res.text();
        return { success: false, error: `Gemini 润色请求失败 (${res.status}): ${errText.slice(0, 200)}` };
      }
      const data = await res.json();
      replyText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    } else {
      const endpoint = (params.customEndpoint || 'https://api.openai.com/v1').replace(/\/+$/, '');
      const url = endpoint.endsWith('/chat/completions') ? endpoint : `${endpoint}/chat/completions`;
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: params.model,
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.75,
        }),
      });
      if (!res.ok) {
        const errText = await res.text();
        return { success: false, error: `API 润色请求失败 (${res.status}): ${errText.slice(0, 200)}` };
      }
      const data = await res.json();
      replyText = data.choices?.[0]?.message?.content || '';
    }

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
    return { success: true, data: parsed };
  } catch (e: any) {
    return { success: false, error: `解析异常: ${e.message}` };
  }
}

export interface EvaluatedStatItem {
  id?: string;
  name: string;
  originalValue?: number;
  suggestedValue: number;
  minValue: number;
  maxValue: number;
  unit: string;
  color?: 'sky' | 'rose' | 'amber' | 'emerald' | 'indigo' | 'violet';
  reason: string;
}

export interface CharacterStatEvaluationResult {
  characterId: string;
  characterName: string;
  hasAppeared: boolean;
  appearanceStatusText: string;
  rationale: string;
  evaluatedStats: EvaluatedStatItem[];
  suggestedNewStats?: EvaluatedStatItem[];
}

export async function evaluateCharacterStats(params: {
  character: any;
  allCharacters?: any[];
  worldbooks?: any[];
  roleMap?: Record<string, string>;
  contextMessages?: Array<{ role: string; content: string }>;
  openingPremise?: string;
  storyTitle?: string;
  currentStats?: any[];
  forceMode?: 'auto' | 'context' | 'card_only';
  provider: AIProvider;
  model: string;
  customApiKey?: string;
  customEndpoint?: string;
}): Promise<{ success: boolean; data?: CharacterStatEvaluationResult; error?: string }> {
  // Try backend proxy first
  if (backendAvailable !== false) {
    try {
      const res = await fetch('/api/evaluate-character-stats', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      });

      if (res.status !== 404) {
        backendAvailable = true;
        const result = await res.json();
        if (result.success && result.data) {
          return {
            success: true,
            data: {
              characterId: params.character.id,
              characterName: params.character.name,
              ...result.data,
            },
          };
        }
        return result;
      }
      backendAvailable = false;
    } catch {
      backendAvailable = false;
    }
  }

  // Client-side fallback
  const apiKey = params.customApiKey?.trim();
  if (!apiKey) {
    return { success: false, error: '静态部署模式下，请先在“设置”中填写 API Key' };
  }

  const { character, allCharacters = [], worldbooks = [], roleMap = {}, contextMessages = [], openingPremise = '', storyTitle = '', currentStats = [], forceMode = 'auto' } = params;
  const recentDialogue = (contextMessages || []).slice(-12).map((m: any) => `${m.role === 'user' ? '【玩家】' : '【剧情】'}: ${m.content}`).join('\n\n');
  const charSummary = `角色姓名：${character.name}\n身份职业：${character.identity || '未详'}\n性别/年龄：${character.gender || '未知'} / ${character.age || '未知'}\n性格特质：${character.personality || '未详'}\n身世背景：${character.background || '未详'}\n外貌神态：${character.appearance || '未详'}\n台词风格：${character.speechStyle || '未详'}\n特殊能力/专属信物/备注：${character.customNotes || '无'}\n定位：${roleMap[character.id] || character.roleType || '主角'}`;

  const otherCharsSummary = (allCharacters || [])
    .filter((c: any) => c.id !== character.id)
    .map((c: any) => `- ${c.name}（${c.identity || ''}）：${c.personality || ''}`)
    .join('\n');

  const wbSummary = (worldbooks || []).length > 0
    ? (worldbooks || []).map((w: any) => `- 《${w.name}》：${w.description || ''}\n` + (w.entries || []).slice(0, 5).map((e: any) => `  * [${e.name}]: ${e.content}`).join('\n')).join('\n')
    : '无特定世界书设定。';

  const statListStr = (currentStats || []).length > 0
    ? (currentStats || []).map((s: any) => `- ${s.name}（当前值: ${s.currentValue}，范围: ${s.minValue}~${s.maxValue} ${s.unit || '点'}）`).join('\n')
    : '- 精神值（当前值: 100，范围: 0~100 点）\n- 好感度（当前值: 0，范围: 0~100 点）\n- 体能（当前值: 100，范围: 0~100 点）';

  const prompt = `你是一名顶级互动小说与跑团RPG的数值与人设数值架构大师。
玩家正在进行互动故事创作，现需要为角色【${character.name}】进行深度的【AI智能赋值】。
以往系统往往在进场建档时默认给所有角色赋予完全相同的初始数值（如千篇一律的满分100或0），然后机械地在此基础上加减，严重缺乏真实代入感与人设差异。
请你根据以下信息，严格进行科学、细腻、具有文学说服力的智能赋值：

【故事基本背景】：
标题：${storyTitle || '互动故事'}
开局情境设定：${openingPremise || '无特定开局描写'}

【故事正文最新剧情上下文】：
${recentDialogue || '（当前故事尚无正文剧情，仅有开局情境）'}

【目标角色档案（${character.name}）】：
${charSummary}

【其他登场角色】：
${otherCharsSummary || '无其他角色'}

【世界观与规则设定（世界书）】：
${wbSummary}

【该角色当前属性列表】：
${statListStr}

【强制模式说明】：${forceMode === 'context' ? '强制视为已登场角色进行剧情推演赋值' : forceMode === 'card_only' ? '强制视为未登场角色，依据角色卡与世界书赋予初始基准值' : '自动综合判定'}

【赋值核心逻辑与任务要求】：
1. 出场状态判断（hasAppeared）：
   - 检查该角色是否已在【开局情境】或【正文剧情】中正式登场有言行活动。
   - 若已在剧情中出场（或 forceMode='context'）：hasAppeared 设为 true。请深入分析该角色在剧情中经历的遭遇（是否有创伤、疲惫、逃亡、搏杀，还是处于安逸；与主角或他人的互动是否建立了信任、怀疑或感激）。据此为每一项属性计算【当前真实状态数值】。
   - 若尚未在剧情中出场（或 forceMode='card_only'）：hasAppeared 设为 false。请完全基于其【角色卡】身世背景、性格气质与世界书，打破千篇一律的通用模板，为其量身定制【专属出场基准初始值】（例如饱经沧桑或身心疲惫的人物初始精神值可为65-75；戒备冷漠的角色初始好感可为负或5；擅长武技的角色体能高昂等）。
2. 对当前各属性进行合理重估（evaluatedStats）：
   - 为现有属性列表中每一项给出 suggestedValue（必须在 minValue 与 maxValue 之间）。
   - 给出简短有力的 reason（文学理由，30字以内，点明剧情依据或人设依据）。
3. 推荐专属新属性（suggestedNewStats，可选1-2项）：
   - 如果该角色的特殊身份或世界观规则适合追加特异性属性（如魔力值、黑化度、理智值、戒备心、忠诚度等），可推荐1-2项；若无需追加可为空数组 []。
4. 深度评估综述（rationale）：
   - 写一段生动、严谨、有文学深度的赋值剖析说明（100-250字），解释当前数值的设定逻辑。

必须严格输出合法的纯 JSON 格式（不要附带任何前缀解释、markdown代码块标记或多余文字），包含以下键：
{
  "hasAppeared": true,
  "appearanceStatusText": "已在剧情中出场 · 正经历废墟避难阶段",
  "rationale": "详细说明为什么这样赋值，分析角色的剧情遭遇或人设特质...",
  "evaluatedStats": [
    {
      "name": "精神值",
      "suggestedValue": 68,
      "minValue": 0,
      "maxValue": 100,
      "unit": "点",
      "color": "sky",
      "reason": "刚刚逃离坍塌区，心神紧绷，处于应激警戒期"
    }
  ],
  "suggestedNewStats": [
    {
      "name": "戒心值",
      "suggestedValue": 80,
      "minValue": 0,
      "maxValue": 100,
      "unit": "点",
      "color": "amber",
      "reason": "出于间谍身份本能，对外界环境保持高度戒备"
    }
  ]
}`;

  try {
    let replyText = '';
    if (params.provider === 'gemini') {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
        params.model || 'gemini-3.8-flash'
      )}:generateContent?key=${encodeURIComponent(apiKey)}`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.7 },
        }),
      });
      if (!res.ok) {
        const errText = await res.text();
        return { success: false, error: `Gemini 智能赋值失败 (${res.status}): ${errText.slice(0, 200)}` };
      }
      const data = await res.json();
      replyText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    } else {
      const endpoint = (params.customEndpoint || 'https://api.openai.com/v1').replace(/\/+$/, '');
      const url = endpoint.endsWith('/chat/completions') ? endpoint : `${endpoint}/chat/completions`;
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: params.model,
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.7,
        }),
      });
      if (!res.ok) {
        const errText = await res.text();
        return { success: false, error: `API 智能赋值失败 (${res.status}): ${errText.slice(0, 200)}` };
      }
      const data = await res.json();
      replyText = data.choices?.[0]?.message?.content || '';
    }

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
    const match = cleanJson.match(/\{[\s\S]*\}/);
    if (match) cleanJson = match[0];

    const parsed = JSON.parse(cleanJson);
    return {
      success: true,
      data: {
        characterId: character.id,
        characterName: character.name,
        ...parsed,
      },
    };
  } catch (e: any) {
    return { success: false, error: `解析异常: ${e.message}` };
  }
}

export async function batchEvaluateCharacterStats(params: {
  characters: any[];
  worldbooks?: any[];
  roleMap?: Record<string, string>;
  contextMessages?: Array<{ role: string; content: string }>;
  openingPremise?: string;
  storyTitle?: string;
  currentStats?: any[];
  provider: AIProvider;
  model: string;
  customApiKey?: string;
  customEndpoint?: string;
}): Promise<{ success: boolean; data?: { evaluations: CharacterStatEvaluationResult[] }; error?: string }> {
  // Try backend proxy first
  if (backendAvailable !== false) {
    try {
      const res = await fetch('/api/batch-evaluate-character-stats', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      });

      if (res.status !== 404) {
        backendAvailable = true;
        const result = await res.json();
        return result;
      }
      backendAvailable = false;
    } catch {
      backendAvailable = false;
    }
  }

  // Fallback: evaluate sequentially or in parallel using evaluateCharacterStats
  try {
    const results = await Promise.all(
      params.characters.map((char) =>
        evaluateCharacterStats({
          character: char,
          allCharacters: params.characters,
          worldbooks: params.worldbooks,
          roleMap: params.roleMap,
          contextMessages: params.contextMessages,
          openingPremise: params.openingPremise,
          storyTitle: params.storyTitle,
          currentStats: params.currentStats,
          provider: params.provider,
          model: params.model,
          customApiKey: params.customApiKey,
          customEndpoint: params.customEndpoint,
        })
      )
    );

    const successfulEvaluations = results
      .filter((r) => r.success && r.data)
      .map((r) => r.data as CharacterStatEvaluationResult);

    if (successfulEvaluations.length === 0) {
      return { success: false, error: results[0]?.error || '批量赋值失败' };
    }

    return {
      success: true,
      data: { evaluations: successfulEvaluations },
    };
  } catch (e: any) {
    return { success: false, error: `批量赋值异常: ${e.message}` };
  }
}


