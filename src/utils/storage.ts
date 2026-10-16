import { CharacterCard, WorldBook, SystemPreset, StorySave, AppSettings, UserMask } from '../types';
import { DEFAULT_CHARACTERS, DEFAULT_WORLDBOOLS, DEFAULT_PRESETS, DEFAULT_APP_SETTINGS } from './defaultData';

export const DEFAULT_USER_MASKS: UserMask[] = [];

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
    if (!Array.isArray(data)) return DEFAULT_CHARACTERS;

    // Purge previous built-in default characters
    const builtInIds = new Set(['char-ailun', 'char-eva', 'char-wenyucheng']);
    if (data.some((c) => builtInIds.has(c.id))) {
      const cleaned = data.filter((c) => !builtInIds.has(c.id));
      saveCharacters(cleaned);
      return cleaned;
    }
    return data;
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
    if (!Array.isArray(data)) return DEFAULT_USER_MASKS;

    // Purge previous built-in default user masks
    const builtInMaskIds = new Set(['mask-default-1', 'mask-default-2']);
    if (data.some((m) => builtInMaskIds.has(m.id))) {
      const cleaned = data.filter((m) => !builtInMaskIds.has(m.id));
      saveUserMasks(cleaned);
      return cleaned;
    }
    return data;
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
    const masks = loadUserMasks();
    const stored = localStorage.getItem(STORAGE_KEYS.ACTIVE_USER_MASK_ID);
    if (stored && masks.some((m) => m.id === stored)) {
      return stored;
    }
    const fallback = masks[0]?.id || null;
    if (!fallback && stored) {
      localStorage.removeItem(STORAGE_KEYS.ACTIVE_USER_MASK_ID);
    }
    return fallback;
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
