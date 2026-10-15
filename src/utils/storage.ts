import { CharacterCard, WorldBook, SystemPreset, StorySave, AppSettings, UserMask } from '../types';
import { DEFAULT_CHARACTERS, DEFAULT_WORLDBOOLS, DEFAULT_PRESETS, DEFAULT_APP_SETTINGS } from './defaultData';

export const DEFAULT_USER_MASKS: UserMask[] = [
  {
    id: 'mask-default-1',
    name: '林远',
    codeName: '异乡客',
    nickname: '阿远',
    gender: '未明',
    identity: '游历诸界的异域行者',
    appearance: '一袭便于行动的深灰色旅行风衣，风尘仆仆，神情内敛微冷，指尖微有长期握笔与握剑的薄茧',
    personality: '沉静观察、理智随和，面对未知保持审慎，底线分明且重情重义',
    speechStyle: '简洁平和，不卑不亢，极少使用夸张情绪词',
    customNotes: '随身佩戴一枚失落纪元的黄铜星盘；对本世界的各种奇特风俗略显陌生但极具自愈与适应力',
    updatedAt: Date.now(),
    createdAt: Date.now(),
  },
  {
    id: 'mask-default-2',
    name: '幽鸦',
    codeName: '暗行者',
    nickname: '小鸦',
    gender: '未明',
    identity: '隐匿于阴影中的潜行雇佣手',
    appearance: '面戴遮掩口鼻的银纹面具，深黑兜帽，身手轻盈矫捷，目光如隼般锐利',
    personality: '行事果决狠绝，重视契约利益，防备心极重，习惯以最坏恶意揣测他人',
    speechStyle: '低沉干脆，惜字如金',
    customNotes: '深谙各种暗杀、潜伏与情报刺探手段；一旦被生人直呼本名会瞬间警觉戒备',
    updatedAt: Date.now(),
    createdAt: Date.now(),
  },
];

const STORAGE_KEYS = {
  CHARACTERS: 'ai_text_adventure_characters_v1',
  WORLDBOOKS: 'ai_text_adventure_worldbooks_v1',
  PRESETS: 'ai_text_adventure_presets_v1',
  SAVES: 'ai_text_adventure_saves_v1',
  SETTINGS: 'ai_text_adventure_settings_v1',
  ACTIVE_SAVE_ID: 'ai_text_adventure_active_save_id_v1',
  USER_MASKS: 'ai_text_adventure_user_masks_v1',
  ACTIVE_USER_MASK_ID: 'ai_text_adventure_active_user_mask_id_v1',
};

// Characters
export function loadCharacters(): CharacterCard[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.CHARACTERS);
    if (raw === null) {
      saveCharacters(DEFAULT_CHARACTERS);
      return DEFAULT_CHARACTERS;
    }
    const data = JSON.parse(raw);
    return Array.isArray(data) ? data : DEFAULT_CHARACTERS;
  } catch (e) {
    console.error('Failed to load characters:', e);
    return DEFAULT_CHARACTERS;
  }
}

export function saveCharacters(chars: CharacterCard[]): void {
  try {
    localStorage.setItem(STORAGE_KEYS.CHARACTERS, JSON.stringify(chars));
  } catch (e) {
    console.error('Failed to save characters:', e);
  }
}

// Worldbooks
export function loadWorldBooks(): WorldBook[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.WORLDBOOKS);
    if (raw === null) {
      saveWorldBooks(DEFAULT_WORLDBOOLS);
      return DEFAULT_WORLDBOOLS;
    }
    const data = JSON.parse(raw);
    return Array.isArray(data) ? data : DEFAULT_WORLDBOOLS;
  } catch (e) {
    console.error('Failed to load worldbooks:', e);
    return DEFAULT_WORLDBOOLS;
  }
}

export function saveWorldBooks(books: WorldBook[]): void {
  try {
    localStorage.setItem(STORAGE_KEYS.WORLDBOOKS, JSON.stringify(books));
  } catch (e) {
    console.error('Failed to save worldbooks:', e);
  }
}

// Presets
export function loadPresets(): SystemPreset[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.PRESETS);
    if (raw === null) {
      savePresets(DEFAULT_PRESETS);
      return DEFAULT_PRESETS;
    }
    const data = JSON.parse(raw);
    return Array.isArray(data) ? data : DEFAULT_PRESETS;
  } catch (e) {
    console.error('Failed to load presets:', e);
    return DEFAULT_PRESETS;
  }
}

export function savePresets(presets: SystemPreset[]): void {
  try {
    localStorage.setItem(STORAGE_KEYS.PRESETS, JSON.stringify(presets));
  } catch (e) {
    console.error('Failed to save presets:', e);
  }
}

// Saves (Story saves)
export function loadSaves(): StorySave[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.SAVES);
    if (!raw) return [];
    const data = JSON.parse(raw);
    return Array.isArray(data) ? data : [];
  } catch (e) {
    console.error('Failed to load saves:', e);
    return [];
  }
}

export function saveSaves(saves: StorySave[]): void {
  try {
    localStorage.setItem(STORAGE_KEYS.SAVES, JSON.stringify(saves));
  } catch (e) {
    console.error('Failed to save saves:', e);
  }
}

export function saveSingleStory(updatedSave: StorySave): void {
  const current = loadSaves();
  const index = current.findIndex(s => s.id === updatedSave.id);
  if (index >= 0) {
    current[index] = { ...updatedSave, updatedAt: Date.now() };
  } else {
    current.unshift({ ...updatedSave, updatedAt: Date.now() });
  }
  saveSaves(current);
}

export function deleteSaveById(id: string): StorySave[] {
  const current = loadSaves();
  const next = current.filter(s => s.id !== id);
  saveSaves(next);
  if (getActiveSaveId() === id) {
    setActiveSaveId(null);
  }
  return next;
}

export function getActiveSaveId(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEYS.ACTIVE_SAVE_ID);
  } catch {
    return null;
  }
}

export function setActiveSaveId(id: string | null): void {
  try {
    if (id) {
      localStorage.setItem(STORAGE_KEYS.ACTIVE_SAVE_ID, id);
    } else {
      localStorage.removeItem(STORAGE_KEYS.ACTIVE_SAVE_ID);
    }
  } catch (e) {
    console.error('Failed to set active save id:', e);
  }
}

// Settings
export function loadSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.SETTINGS);
    if (!raw) return DEFAULT_APP_SETTINGS;
    return { ...DEFAULT_APP_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_APP_SETTINGS;
  }
}

export function saveSettings(settings: AppSettings): void {
  try {
    localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
  } catch (e) {
    console.error('Failed to save settings:', e);
  }
}

// User Masks (Player Identity Profiles)
export function loadUserMasks(): UserMask[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.USER_MASKS);
    if (raw === null) {
      saveUserMasks(DEFAULT_USER_MASKS);
      return DEFAULT_USER_MASKS;
    }
    const data = JSON.parse(raw);
    return Array.isArray(data) ? data : DEFAULT_USER_MASKS;
  } catch (e) {
    console.error('Failed to load user masks:', e);
    return DEFAULT_USER_MASKS;
  }
}

export function saveUserMasks(masks: UserMask[]): void {
  try {
    localStorage.setItem(STORAGE_KEYS.USER_MASKS, JSON.stringify(masks));
  } catch (e) {
    console.error('Failed to save user masks:', e);
  }
}

export function getActiveUserMaskId(): string | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEYS.ACTIVE_USER_MASK_ID);
    if (stored) return stored;
    const masks = loadUserMasks();
    return masks[0]?.id || null;
  } catch {
    return null;
  }
}

export function setActiveUserMaskId(id: string | null): void {
  try {
    if (id) {
      localStorage.setItem(STORAGE_KEYS.ACTIVE_USER_MASK_ID, id);
    } else {
      localStorage.removeItem(STORAGE_KEYS.ACTIVE_USER_MASK_ID);
    }
  } catch (e) {
    console.error('Failed to set active user mask id:', e);
  }
}

// Backup & Export / Import helper
export function exportAllDataJson(): string {
  const data = {
    version: '1.1',
    exportDate: new Date().toISOString(),
    characters: loadCharacters(),
    worldbooks: loadWorldBooks(),
    presets: loadPresets(),
    saves: loadSaves(),
    userMasks: loadUserMasks(),
    settings: loadSettings(),
  };
  return JSON.stringify(data, null, 2);
}

export function importAllDataJson(jsonString: string): { success: boolean; message: string } {
  try {
    const parsed = JSON.parse(jsonString);
    if (!parsed || typeof parsed !== 'object') {
      return { success: false, message: '无效的 JSON 格式' };
    }
    if (Array.isArray(parsed.characters)) saveCharacters(parsed.characters);
    if (Array.isArray(parsed.worldbooks)) saveWorldBooks(parsed.worldbooks);
    if (Array.isArray(parsed.presets)) savePresets(parsed.presets);
    if (Array.isArray(parsed.saves)) saveSaves(parsed.saves);
    if (Array.isArray(parsed.userMasks)) saveUserMasks(parsed.userMasks);
    if (parsed.settings && typeof parsed.settings === 'object') saveSettings(parsed.settings);

    return { success: true, message: '数据导入成功！页面将自动刷新生效。' };
  } catch (e: any) {
    return { success: false, message: `导入解析失败: ${e.message}` };
  }
}

// Helper to trigger download of a JSON file
export function downloadJsonFile(filename: string, content: string): void {
  const blob = new Blob([content], { type: 'application/json;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
