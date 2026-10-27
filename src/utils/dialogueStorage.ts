import {
  DialogueSession,
  DialogueAISettings,
  DialogueMessage,
  DialogueApiConfig,
  DialogueApiPreset,
  DialogueFolder,
} from '../types';

const STORAGE_KEY_SESSIONS = 'tako_dialogue_sessions';
const STORAGE_KEY_ACTIVE_ID = 'tako_active_dialogue_session_id';

export const DEFAULT_AI_SETTINGS: DialogueAISettings = {
  name: 'Tako DeepChat',
  avatarType: 'sparkles',
  themeColor: 'sky',
  systemPrompt: `你是一个兼具深邃思辨力与文学质感的顶尖智能助手（界面汲取 GPT、Gemini 与 DeepSeek 之大成）。
你的表达风格：
1. 简洁大气、结构清晰、逻辑严谨，杜绝空话套话。
2. 面对提问直击要害；分析复杂问题时分层剖析、见解独到。
3. 遵循用户设定的专属人设与指示，提供高度契合的情感共鸣或专业答复。`,
  temperature: 0.7,
  enableThinking: true,
  customPersonaTitle: '智能构想智囊',
  fontSize: 'base',
};

export const PROMPT_PRESETS: Array<{
  id: string;
  name: string;
  title: string;
  avatarType: DialogueAISettings['avatarType'];
  themeColor: DialogueAISettings['themeColor'];
  systemPrompt: string;
}> = [
  {
    id: 'deepseek-thinker',
    name: '深度思考导师',
    title: 'DeepSeek 风格理性思辨',
    avatarType: 'brain',
    themeColor: 'sky',
    systemPrompt: `你拥有强大的逻辑思辨与推理能力。
在回答每一个问题前，先在心中进行严密的解构、溯源与正反辩证，给出最清醒、客观、有深度且极富洞察力的阐述。`,
  },
  {
    id: 'creative-writer',
    name: '缪斯小说智囊',
    title: '叙事美学与灵感工坊',
    avatarType: 'sparkles',
    themeColor: 'indigo',
    systemPrompt: `你是一位殿堂级的文学创作顾问与世界观编剧。
擅长场景描摹、人物性格弧光打磨、悬念铺陈与诗意笔触。用生动细腻的文字，为用户的写作与构思注入无限灵感。`,
  },
  {
    id: 'gpt-general',
    name: '极简全能助手',
    title: '高效干练、直奔主题',
    avatarType: 'bot',
    themeColor: 'emerald',
    systemPrompt: `你是一位高度专业、高效敏捷的全能助手。
回答直接、精炼、重点突出，善于使用清晰的要点排版，不冗余、不拖沓，提供最实用的解决方案。`,
  },
  {
    id: 'trpg-copilot',
    name: '跑团脑暴构想家',
    title: 'TRPG / 规则与副本构筑师',
    avatarType: 'terminal',
    themeColor: 'violet',
    systemPrompt: `你是资深 TRPG 地下城主（KP/DM）兼跑团架构师。
精通 DND、COC 及各类自定义规则体系，善于设计令人惊叹的剧情反转、险象环生的地城谜题以及生动的 NPC 互动。`,
  },
  {
    id: 'empathy-companion',
    name: '知己温情倾听者',
    title: '温润如玉、灵魂对话',
    avatarType: 'cat',
    themeColor: 'rose',
    systemPrompt: `你是一位温暖、真挚且具有深度同理心的挚友。
倾听用户的心声、情绪与日常随想，给予温柔、坚定且充满包容的陪伴与宽慰，如同冬夜中的一杯温热可可。`,
  },
];

export function loadDialogueSessions(): DialogueSession[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_SESSIONS);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    console.error('Failed to load dialogue sessions:', e);
    return [];
  }
}

export function saveDialogueSessions(sessions: DialogueSession[]): void {
  try {
    localStorage.setItem(STORAGE_KEY_SESSIONS, JSON.stringify(sessions));
  } catch (e) {
    console.error('Failed to save dialogue sessions:', e);
  }
}

export function saveSingleDialogueSession(session: DialogueSession): void {
  const sessions = loadDialogueSessions();
  const index = sessions.findIndex((s) => s.id === session.id);
  let next: DialogueSession[];
  if (index >= 0) {
    next = [...sessions];
    next[index] = session;
  } else {
    next = [session, ...sessions];
  }
  saveDialogueSessions(next);
}

export function createNewDialogueSession(
  initialTitle?: string,
  initialSettings?: Partial<DialogueAISettings>,
  folderId?: string
): DialogueSession {
  const newSession: DialogueSession = {
    id: `dialogue-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    title: initialTitle || '新对话',
    messages: [],
    aiSettings: {
      ...DEFAULT_AI_SETTINGS,
      ...initialSettings,
    },
    folderId,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  saveSingleDialogueSession(newSession);
  return newSession;
}

export function deleteDialogueSession(id: string): void {
  const sessions = loadDialogueSessions().filter((s) => s.id !== id);
  saveDialogueSessions(sessions);
  if (getActiveDialogueSessionId() === id) {
    setActiveDialogueSessionId(sessions[0]?.id || null);
  }
}

// ==========================================
// 文件夹管理 (Folder Management)
// ==========================================
const STORAGE_KEY_FOLDERS = 'tako_dialogue_folders';

export function loadDialogueFolders(): DialogueFolder[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_FOLDERS);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    console.error('Failed to load dialogue folders:', e);
    return [];
  }
}

export function saveDialogueFolders(folders: DialogueFolder[]): void {
  try {
    localStorage.setItem(STORAGE_KEY_FOLDERS, JSON.stringify(folders));
  } catch (e) {
    console.error('Failed to save dialogue folders:', e);
  }
}

export function createDialogueFolder(name: string): DialogueFolder {
  const folders = loadDialogueFolders();
  const newFolder: DialogueFolder = {
    id: `folder-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    name: name.trim() || '新建文件夹',
    isExpanded: true,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  saveDialogueFolders([...folders, newFolder]);
  return newFolder;
}

export function deleteDialogueFolder(id: string): void {
  const folders = loadDialogueFolders().filter((f) => f.id !== id);
  saveDialogueFolders(folders);
  // Un-assign sessions from deleted folder to root
  const sessions = loadDialogueSessions();
  const updated = sessions.map((s) => (s.folderId === id ? { ...s, folderId: undefined } : s));
  saveDialogueSessions(updated);
}

export function renameDialogueFolder(id: string, newName: string): void {
  const folders = loadDialogueFolders();
  const updated = folders.map((f) =>
    f.id === id ? { ...f, name: newName.trim() || f.name, updatedAt: Date.now() } : f
  );
  saveDialogueFolders(updated);
}

export function toggleDialogueFolderExpand(id: string): void {
  const folders = loadDialogueFolders();
  const updated = folders.map((f) =>
    f.id === id ? { ...f, isExpanded: f.isExpanded === false ? true : false } : f
  );
  saveDialogueFolders(updated);
}

export function moveDialogueSessionToFolder(sessionId: string, folderId?: string | null): void {
  const sessions = loadDialogueSessions();
  const updated = sessions.map((s) =>
    s.id === sessionId ? { ...s, folderId: folderId || undefined, updatedAt: Date.now() } : s
  );
  saveDialogueSessions(updated);
}

export function getActiveDialogueSessionId(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY_ACTIVE_ID);
  } catch {
    return null;
  }
}

export function setActiveDialogueSessionId(id: string | null): void {
  try {
    if (id) {
      localStorage.setItem(STORAGE_KEY_ACTIVE_ID, id);
    } else {
      localStorage.removeItem(STORAGE_KEY_ACTIVE_ID);
    }
  } catch {
    // Ignore storage errors
  }
}

// ==========================================
// 对话模式专属 API 与预设管理
// ==========================================
const STORAGE_KEY_API_CONFIG = 'tako_dialogue_api_config';
const STORAGE_KEY_API_PRESETS = 'tako_dialogue_api_presets';

export const DEFAULT_API_PRESETS: DialogueApiPreset[] = [
  {
    id: 'preset-gemini-3.8-flash',
    name: 'Gemini 3.8 Flash (推荐·高速)',
    provider: 'gemini',
    model: 'gemini-3.8-flash',
    isBuiltIn: true,
  },
  {
    id: 'preset-gemini-2.5-pro',
    name: 'Gemini 2.5 Pro (深度分析)',
    provider: 'gemini',
    model: 'gemini-2.5-pro',
    isBuiltIn: true,
  },
  {
    id: 'preset-gemini-3.1-flash-lite',
    name: 'Gemini 3.1 Flash Lite',
    provider: 'gemini',
    model: 'gemini-3.1-flash-lite',
    isBuiltIn: true,
  },
  {
    id: 'preset-deepseek-v3',
    name: 'DeepSeek-V3 (官方 API)',
    provider: 'openai_compatible',
    model: 'deepseek-chat',
    customEndpoint: 'https://api.deepseek.com',
    isBuiltIn: true,
  },
  {
    id: 'preset-deepseek-r1',
    name: 'DeepSeek-R1 (官方深度推理)',
    provider: 'openai_compatible',
    model: 'deepseek-reasoner',
    customEndpoint: 'https://api.deepseek.com',
    isBuiltIn: true,
  },
  {
    id: 'preset-gpt-4o-mini',
    name: 'OpenAI GPT-4o Mini',
    provider: 'openai_compatible',
    model: 'gpt-4o-mini',
    customEndpoint: 'https://api.openai.com/v1',
    isBuiltIn: true,
  },
  {
    id: 'preset-ollama-local',
    name: '本地 Ollama (Local)',
    provider: 'openai_compatible',
    model: 'llama3',
    customEndpoint: 'http://localhost:11434/v1',
    isBuiltIn: true,
  },
];

export function loadDialogueApiConfig(globalSettings?: any): import('../types').DialogueApiConfig {
  const fallbackProvider = globalSettings?.provider || 'gemini';
  const fallbackModel = globalSettings?.model || 'gemini-3.8-flash';
  const fallbackKey = globalSettings?.customApiKey || '';
  const fallbackEndpoint = globalSettings?.customEndpoint || '';

  try {
    const raw = localStorage.getItem(STORAGE_KEY_API_CONFIG);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (typeof parsed === 'object' && parsed !== null) {
        return {
          useCustom: Boolean(parsed.useCustom),
          provider: parsed.provider || fallbackProvider,
          model: parsed.model || fallbackModel,
          customApiKey: parsed.customApiKey ?? fallbackKey,
          customEndpoint: parsed.customEndpoint ?? fallbackEndpoint,
          presetId: parsed.presetId,
        };
      }
    }
  } catch (e) {
    console.error('Failed to load dialogue API config:', e);
  }

  // 默认跟随全局设置，且初始填入当前全局使用的配置
  return {
    useCustom: false,
    provider: fallbackProvider,
    model: fallbackModel,
    customApiKey: fallbackKey,
    customEndpoint: fallbackEndpoint,
  };
}

export function saveDialogueApiConfig(config: import('../types').DialogueApiConfig): void {
  try {
    localStorage.setItem(STORAGE_KEY_API_CONFIG, JSON.stringify(config));
  } catch (e) {
    console.error('Failed to save dialogue API config:', e);
  }
}

export function loadDialogueApiPresets(): DialogueApiPreset[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_API_PRESETS);
    if (!raw) return DEFAULT_API_PRESETS;
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed;
    }
  } catch (e) {
    console.error('Failed to load dialogue API presets:', e);
  }
  return DEFAULT_API_PRESETS;
}

export function saveDialogueApiPresets(presets: DialogueApiPreset[]): void {
  try {
    localStorage.setItem(STORAGE_KEY_API_PRESETS, JSON.stringify(presets));
  } catch (e) {
    console.error('Failed to save dialogue API presets:', e);
  }
}

export function addDialogueApiPreset(preset: Omit<DialogueApiPreset, 'id'>): DialogueApiPreset {
  const list = loadDialogueApiPresets();
  const newPreset: DialogueApiPreset = {
    ...preset,
    id: `custom-api-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    isBuiltIn: false,
  };
  const updated = [newPreset, ...list];
  saveDialogueApiPresets(updated);
  return newPreset;
}

export function deleteDialogueApiPreset(id: string): DialogueApiPreset[] {
  const list = loadDialogueApiPresets();
  const updated = list.filter((p) => p.id !== id);
  saveDialogueApiPresets(updated);
  return updated;
}

