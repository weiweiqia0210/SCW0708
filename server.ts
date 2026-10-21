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
// Test connection (with strict 15s timeout)
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

    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('TIMEOUT_15S')), 15000);
    });

    if (provider === 'gemini') {
      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          },
        },
      });

      const executeGemini = async () => {
        const response = await ai.models.generateContent({
          model: model || 'gemini-3.8-flash',
          contents: '请回复简短确认："文游连接测试成功。"',
        });
        return response.text?.trim() || '连接成功';
      };

      const reply = await Promise.race([executeGemini(), timeoutPromise]);

      return res.json({
        success: true,
        message: reply,
        model: model || 'gemini-3.8-flash',
      });
    } else if (provider === 'openai_compatible') {
      const endpoint = (customEndpoint || 'https://api.openai.com/v1').replace(/\/+$/, '');
      const executeOpenAI = async () => {
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
          throw new Error(`API 返回错误 (${response.status}): ${errorText.slice(0, 300)}`);
        }

        const data = await response.json();
        return data.choices?.[0]?.message?.content || '连接成功';
      };

      const reply = await Promise.race([executeOpenAI(), timeoutPromise]);

      return res.json({
        success: true,
        message: reply,
        model: model,
      });
    } else {
      return res.status(400).json({ success: false, error: '不支持的服务商' });
    }
  } catch (error: any) {
    console.error('Test connection error:', error);
    if (error?.message === 'TIMEOUT_15S' || error?.name === 'AbortError') {
      return res.status(408).json({
        success: false,
        error: '测试超时：已等待超过 15 秒未响应。上游接口响应迟缓，请检查网络、接口地址或切换模型重试。',
      });
    }
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

// AI Polish story setup (title, opening premise, writing guidance)
app.post('/api/polish-story-setup', async (req, res) => {
  try {
    const {
      userInput,
      characters = [],
      worldbooks = [],
      roleMap = {},
      provider = 'gemini',
      model = 'gemini-3.8-flash',
      customApiKey,
      customEndpoint,
    } = req.body;

    if (!userInput || !userInput.trim()) {
      return res.status(400).json({ success: false, error: '请提供您的想法或灵感关键词' });
    }

    const apiKey = (customApiKey && customApiKey.trim()) || process.env.GEMINI_API_KEY;
    if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
      return res.status(400).json({ success: false, error: '未配置 API Key，无法使用 AI 智能润色' });
    }

    // Build context
    const charContext = characters.length > 0
      ? `登场角色：\n` + characters.map((c: any) => {
          const roleLabel = roleMap[c.id] === 'protagonist' ? '【主角】' : roleMap[c.id] === 'extra' ? '【群演】' : '【配角】';
          return `- ${c.name} ${roleLabel}（${c.identity || ''}）：${c.personality || ''}。背景：${c.background || ''}`;
        }).join('\n')
      : '暂未指定特定角色。';

    const wbContext = worldbooks.length > 0
      ? `世界观设定：\n` + worldbooks.map((w: any) => `- 《${w.name}》：${w.description || ''}`).join('\n')
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
"${userInput.trim()}"`;

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
          temperature: 0.75,
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
          temperature: 0.75,
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
      data: parsed,
    });
  } catch (error: any) {
    console.error('Polish story setup error:', error);
    return res.status(500).json({
      success: false,
      error: `AI 润色失败: ${error?.message || '解析异常'}`,
    });
  }
});

// AI Smart Evaluate Single Character Stats
app.post('/api/evaluate-character-stats', async (req, res) => {
  try {
    const {
      character,
      allCharacters = [],
      worldbooks = [],
      roleMap = {},
      contextMessages = [],
      openingPremise = '',
      storyTitle = '',
      currentStats = [],
      forceMode = 'auto',
      provider = 'gemini',
      model = 'gemini-3.8-flash',
      customApiKey,
      customEndpoint,
    } = req.body;

    if (!character || !character.name) {
      return res.status(400).json({ success: false, error: '未提供有效角色数据' });
    }

    const apiKey = (customApiKey && customApiKey.trim()) || process.env.GEMINI_API_KEY;
    if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
      return res.status(400).json({ success: false, error: '未配置 API Key，无法使用 AI 智能赋值' });
    }

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
    return res.json({
      success: true,
      characterId: character.id,
      characterName: character.name,
      data: parsed,
    });
  } catch (error: any) {
    console.error('Evaluate character stats error:', error);
    return res.status(500).json({
      success: false,
      error: `AI 智能赋值失败: ${error?.message || '解析异常'}`,
    });
  }
});

// AI Smart Batch Evaluate All Characters Stats
app.post('/api/batch-evaluate-character-stats', async (req, res) => {
  try {
    const {
      characters = [],
      worldbooks = [],
      roleMap = {},
      contextMessages = [],
      openingPremise = '',
      storyTitle = '',
      currentStats = [],
      provider = 'gemini',
      model = 'gemini-3.8-flash',
      customApiKey,
      customEndpoint,
    } = req.body;

    if (!characters || characters.length === 0) {
      return res.status(400).json({ success: false, error: '未提供角色列表' });
    }

    const apiKey = (customApiKey && customApiKey.trim()) || process.env.GEMINI_API_KEY;
    if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
      return res.status(400).json({ success: false, error: '未配置 API Key，无法使用 AI 智能赋值' });
    }

    const recentDialogue = (contextMessages || []).slice(-12).map((m: any) => `${m.role === 'user' ? '【玩家】' : '【剧情】'}: ${m.content}`).join('\n\n');
    
    const charsDetailStr = characters.map((c: any, idx: number) => {
      const charStats = currentStats.filter((s: any) => s.characterId === c.id || (!s.characterId && s.characterName?.includes(c.name)));
      const statListStr = charStats.length > 0
        ? charStats.map((s: any) => `  * ${s.name}（当前值: ${s.currentValue}，范围: ${s.minValue}~${s.maxValue} ${s.unit || '点'}）`).join('\n')
        : '  * 精神值（当前值: 100，范围: 0~100 点）\n  * 好感度（当前值: 0，范围: 0~100 点）';

      return `[角色${idx + 1}] ID: "${c.id}", 姓名: "${c.name}"
身份职业: ${c.identity || '未详'}
性别/年龄: ${c.gender || '未知'} / ${c.age || '未知'}
性格特质: ${c.personality || '未详'}
身世背景: ${c.background || '未详'}
定位: ${roleMap[c.id] || c.roleType || '主角'}
当前属性列表:
${statListStr}`;
    }).join('\n\n');

    const wbSummary = (worldbooks || []).length > 0
      ? (worldbooks || []).map((w: any) => `- 《${w.name}》：${w.description || ''}`).join('\n')
      : '无特定世界书设定。';

    const prompt = `你是一名顶级互动小说与跑团RPG的数值与人设数值架构大师。
玩家正在进行互动故事创作，现需要为本场故事的【全部登场角色】进行深度的【AI智能全员赋值】。
以往系统往往在进场建档时默认给所有角色赋予完全相同的初始数值（如千篇一律的满分100或0），然后机械地在此基础上加减，严重缺乏真实代入感与人设差异。
请你根据以下故事背景、上下文与角色档案，严格评估每个角色的状态与合理数值：

【故事基本背景】：
标题：${storyTitle || '互动故事'}
开局情境设定：${openingPremise || '无特定开局描写'}

【故事正文最新剧情上下文】：
${recentDialogue || '（当前故事尚无正文剧情，仅有开局情境）'}

【世界观与规则设定（世界书）】：
${wbSummary}

【待赋值的角色列表与当前属性】：
${charsDetailStr}

【全员赋值核心原则】：
1. 逐一判断各角色是否已在剧情中正式登场有言行活动（hasAppeared）：
   - 已登场者：结合剧情遭遇（创伤、疲惫、逃亡、搏杀、情绪变化、人际关系互动）计算当前合理数值。
   - 未登场者：依据角色卡身份背景与性格，打破机械默认值，赋予符合人设立场的专属初始出场基准值。
2. 兼顾角色间的人际动态与实力对比（如性格互补、强弱差异、阵营态度差异）。
3. 为每个角色列出其属性重估列表（evaluatedStats）及深度文学剖析理由（rationale）。

必须严格输出合法的纯 JSON 格式（不要附带任何前缀解释、markdown代码块标记或多余文字），包含 evaluations 数组：
{
  "evaluations": [
    {
      "characterId": "角色ID",
      "characterName": "角色姓名",
      "hasAppeared": true,
      "appearanceStatusText": "已在剧情中出场 · 状态简述",
      "rationale": "深度赋值分析理由（80-200字）...",
      "evaluatedStats": [
        {
          "name": "精神值",
          "suggestedValue": 70,
          "minValue": 0,
          "maxValue": 100,
          "unit": "点",
          "color": "sky",
          "reason": "简述原因（20字内）"
        }
      ],
      "suggestedNewStats": []
    }
  ]
}`;

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
    return res.json({
      success: true,
      data: parsed,
    });
  } catch (error: any) {
    console.error('Batch evaluate character stats error:', error);
    return res.status(500).json({
      success: false,
      error: `AI 智能批量赋值失败: ${error?.message || '解析异常'}`,
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
