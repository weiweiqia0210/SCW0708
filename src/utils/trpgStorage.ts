import { TRPGRuleset, TRPGCharacter, TRPGSession, TRPGItem, TRPGSaveSlot } from '../types/trpg';
import { CharacterCard, UserMask } from '../types';
import { DEFAULT_D20_RULESET, DEFAULT_STARTER_ITEMS, DEFAULT_MAP_LOCATIONS } from './defaultTRPGData';
import { calculateAttributeModifier } from './diceEngine';

const STORAGE_KEYS = {
  RULESETS: 'ai_trpg_rulesets_v1',
  CHARACTERS: 'ai_trpg_characters_v1',
  SESSIONS: 'ai_trpg_sessions_v1',
  ACTIVE_SESSION_ID: 'ai_trpg_active_session_id_v1',
  SAVES: 'ai_trpg_save_slots_v1',
};

// ==========================================
// 1. Rulesets
// ==========================================
export function loadTRPGRulesets(): TRPGRuleset[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.RULESETS);
    if (!raw) {
      saveTRPGRulesets([DEFAULT_D20_RULESET]);
      return [DEFAULT_D20_RULESET];
    }
    const data = JSON.parse(raw);
    if (!Array.isArray(data)) return [DEFAULT_D20_RULESET];

    // Ensure built-in ruleset is present
    const hasBuiltin = data.some((r) => r.id === DEFAULT_D20_RULESET.id);
    if (!hasBuiltin) {
      const merged = [DEFAULT_D20_RULESET, ...data];
      saveTRPGRulesets(merged);
      return merged;
    }
    return data;
  } catch (e) {
    console.error('Failed to load TRPG rulesets:', e);
    return [DEFAULT_D20_RULESET];
  }
}

export function saveTRPGRulesets(rulesets: TRPGRuleset[]): void {
  try {
    localStorage.setItem(STORAGE_KEYS.RULESETS, JSON.stringify(rulesets));
  } catch (e) {
    console.error('Failed to save TRPG rulesets:', e);
  }
}

export function saveCustomTRPGRuleset(ruleset: TRPGRuleset): TRPGRuleset {
  const current = loadTRPGRulesets();

  // If attempting to overwrite built-in, fork it into a new custom ruleset
  let target = { ...ruleset, updatedAt: Date.now() };
  if (target.isBuiltin || target.id === DEFAULT_D20_RULESET.id) {
    target = {
      ...target,
      id: `ruleset-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      name: `${target.name} (自定义副本)`,
      isBuiltin: false,
      createdAt: Date.now(),
    };
  }

  const index = current.findIndex((r) => r.id === target.id);
  let next: TRPGRuleset[];
  if (index >= 0) {
    next = [...current];
    next[index] = target;
  } else {
    next = [target, ...current];
  }

  saveTRPGRulesets(next);
  return target;
}

export function duplicateTRPGRuleset(source: TRPGRuleset, newName?: string): TRPGRuleset {
  const duplicated: TRPGRuleset = {
    ...JSON.parse(JSON.stringify(source)),
    id: `ruleset-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    name: newName || `${source.name} (副本)`,
    isBuiltin: false,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  const current = loadTRPGRulesets();
  const next = [duplicated, ...current];
  saveTRPGRulesets(next);
  return duplicated;
}

export function deleteTRPGRuleset(id: string): TRPGRuleset[] {
  const current = loadTRPGRulesets();
  // Filter out the requested ruleset
  let next = current.filter((r) => r.id !== id);
  // Ensure default builtin exists
  const hasBuiltin = next.some((r) => r.id === DEFAULT_D20_RULESET.id);
  if (!hasBuiltin || next.length === 0) {
    next = [DEFAULT_D20_RULESET, ...next.filter((r) => r.id !== DEFAULT_D20_RULESET.id)];
  }
  saveTRPGRulesets(next);
  return next;
}

export function restoreDefaultTRPGRulesets(): TRPGRuleset[] {
  const defaults = [DEFAULT_D20_RULESET];
  saveTRPGRulesets(defaults);
  return defaults;
}

// ==========================================
// 2. TRPG Characters
// ==========================================
export function loadTRPGCharacters(): TRPGCharacter[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.CHARACTERS);
    if (!raw) return [];
    const data = JSON.parse(raw);
    return Array.isArray(data) ? data : [];
  } catch (e) {
    console.error('Failed to load TRPG characters:', e);
    return [];
  }
}

export function saveTRPGCharacters(characters: TRPGCharacter[]): void {
  try {
    localStorage.setItem(STORAGE_KEYS.CHARACTERS, JSON.stringify(characters));
  } catch (e) {
    console.error('Failed to save TRPG characters:', e);
  }
}

export function saveSingleTRPGCharacter(character: TRPGCharacter): void {
  const all = loadTRPGCharacters();
  const index = all.findIndex((c) => c.id === character.id);
  let next: TRPGCharacter[];
  if (index >= 0) {
    next = [...all];
    next[index] = { ...character, updatedAt: Date.now() };
  } else {
    next = [{ ...character, updatedAt: Date.now() }, ...all];
  }
  saveTRPGCharacters(next);
}

export function deleteTRPGCharacter(id: string): void {
  const all = loadTRPGCharacters();
  const next = all.filter((c) => c.id !== id);
  saveTRPGCharacters(next);
}

/**
 * Non-destructive cloning: Create a TRPG Character from an existing CharacterCard or UserMask
 * Original card is NOT modified at all.
 */
export function createTRPGCharacterFromCard(
  card: CharacterCard | UserMask,
  ruleset: TRPGRuleset = DEFAULT_D20_RULESET,
  extraOptions?: {
    characterClass?: string;
    attributes?: Record<string, number>;
    proficientSkills?: string[];
    startingItems?: TRPGItem[];
  }
): TRPGCharacter {
  // Derive default attributes (10 base or customized)
  const defaultAttrs: Record<string, number> = {};
  ruleset.attributes.forEach((attr) => {
    defaultAttrs[attr.key] = attr.defaultValue || 10;
  });

  const finalAttrs = {
    ...defaultAttrs,
    ...(extraOptions?.attributes || {}),
  };

  const conMod = calculateAttributeModifier(finalAttrs.con ?? 10, ruleset.modifierRule);
  const calculatedMaxHp = Math.max(8, ruleset.hpRule.baseHp + conMod * ruleset.hpRule.conMultiplier);

  const newChar: TRPGCharacter = {
    id: `trpg-char-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    originCharacterId: card.id,
    name: card.name,
    identity: card.identity || '探险者',
    characterClass: extraOptions?.characterClass || card.identity || '自由冒险者',
    avatarImage: (card as any).avatarImage,
    gender: card.gender,
    age: (card as any).age,
    appearance: card.appearance,
    personality: card.personality,
    background: (card as any).background || card.personality || '冒险者背景',
    speechStyle: card.speechStyle,
    customNotes: card.customNotes,
    level: 1,
    attributes: finalAttrs,
    proficientSkills: extraOptions?.proficientSkills || ['perception', 'athletics'],
    currentHp: calculatedMaxHp,
    maxHp: calculatedMaxHp,
    tempHp: 0,
    inventory: extraOptions?.startingItems
      ? JSON.parse(JSON.stringify(extraOptions.startingItems))
      : JSON.parse(JSON.stringify(DEFAULT_STARTER_ITEMS)),
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  saveSingleTRPGCharacter(newChar);
  return newChar;
}

// ==========================================
// 3. TRPG Sessions
// ==========================================
export function ensureSessionIntegrity(s: any): TRPGSession {
  const mapState = s.mapState && Array.isArray(s.mapState.locations) && s.mapState.locations.length > 0
    ? s.mapState
    : {
        currentLocationId: 'loc-tavern',
        locations: JSON.parse(JSON.stringify(DEFAULT_MAP_LOCATIONS)),
      };

  return {
    ...s,
    companions: s.companions || [],
    npcRelations: s.npcRelations || [],
    quests: s.quests || [],
    storyLogs: s.storyLogs || [],
    mapState,
  };
}

export function loadTRPGSessions(): TRPGSession[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.SESSIONS);
    if (!raw) return [];
    const data = JSON.parse(raw);
    if (!Array.isArray(data)) return [];
    return data.map((s) => ensureSessionIntegrity(s));
  } catch (e) {
    console.error('Failed to load TRPG sessions:', e);
    return [];
  }
}

export function saveTRPGSessions(sessions: TRPGSession[]): void {
  try {
    localStorage.setItem(STORAGE_KEYS.SESSIONS, JSON.stringify(sessions));
  } catch (e) {
    console.error('Failed to save TRPG sessions:', e);
  }
}

export function saveSingleTRPGSession(session: TRPGSession): void {
  const all = loadTRPGSessions();
  const index = all.findIndex((s) => s.id === session.id);
  let next: TRPGSession[];
  if (index >= 0) {
    next = [...all];
    next[index] = { ...session, updatedAt: Date.now() };
  } else {
    next = [{ ...session, updatedAt: Date.now() }, ...all];
  }
  saveTRPGSessions(next);
}

export function deleteTRPGSession(id: string): void {
  const all = loadTRPGSessions();
  const next = all.filter((s) => s.id !== id);
  saveTRPGSessions(next);
  if (getActiveTRPGSessionId() === id) {
    setActiveTRPGSessionId(null);
  }
  // Also clean up associated save slots for this session
  try {
    const allSlots = loadTRPGSaveSlots();
    const remainingSlots = allSlots.filter((slot) => slot.sessionId !== id);
    saveTRPGSaveSlots(remainingSlots);
  } catch (e) {
    console.warn('Failed to cleanup save slots for deleted session:', e);
  }
}

export function getActiveTRPGSessionId(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEYS.ACTIVE_SESSION_ID);
  } catch {
    return null;
  }
}

export function setActiveTRPGSessionId(id: string | null): void {
  try {
    if (id) {
      localStorage.setItem(STORAGE_KEYS.ACTIVE_SESSION_ID, id);
    } else {
      localStorage.removeItem(STORAGE_KEYS.ACTIVE_SESSION_ID);
    }
  } catch (e) {
    console.error('Failed to set active TRPG session id:', e);
  }
}

// ==========================================
// 4. TRPG Save & Load Slots (存档与读档管理)
// ==========================================
export function loadTRPGSaveSlots(sessionId?: string): TRPGSaveSlot[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.SAVES);
    if (!raw) return [];
    const data = JSON.parse(raw);
    if (!Array.isArray(data)) return [];

    const migrated = data.map((slot: any) => {
      return {
        ...slot,
        version: slot.version || 1,
        sessionSnapshot: ensureSessionIntegrity(slot.sessionSnapshot),
      } as TRPGSaveSlot;
    });

    if (sessionId) {
      return migrated.filter((s) => s.sessionId === sessionId);
    }
    return migrated;
  } catch (e) {
    console.error('Failed to load TRPG save slots:', e);
    return [];
  }
}

export function saveTRPGSaveSlots(slots: TRPGSaveSlot[]): void {
  try {
    localStorage.setItem(STORAGE_KEYS.SAVES, JSON.stringify(slots));
  } catch (e) {
    console.error('Failed to save TRPG save slots:', e);
  }
}

/**
 * Creates or updates a save slot (auto or manual)
 */
export function createTRPGSaveSlot(
  session: TRPGSession,
  name?: string,
  isAutoSave = false
): TRPGSaveSlot {
  const allSlots = loadTRPGSaveSlots();
  const currentLoc = session.mapState?.locations?.find(
    (l) => l.id === session.mapState.currentLocationId
  );
  const locationName = currentLoc?.name || '未知区域';

  const summary = {
    locationName,
    characterName: session.character.name,
    characterClass: session.character.characterClass || '冒险者',
    currentHp: session.character.currentHp,
    maxHp: session.character.maxHp,
    companionsCount: (session.companions || []).filter((c) => c.status === 'active').length,
    activeQuestsCount: (session.quests || []).filter((q) => q.status === 'active').length,
    messageCount: session.messages.length,
    storyLogCount: (session.storyLogs || []).length,
  };

  const snapshot: TRPGSession = JSON.parse(JSON.stringify(session));

  if (isAutoSave) {
    // Upsert auto-save slot for this session
    const existingAutoIdx = allSlots.findIndex(
      (s) => s.sessionId === session.id && s.isAutoSave
    );

    const autoSlot: TRPGSaveSlot = {
      id: existingAutoIdx >= 0 ? allSlots[existingAutoIdx].id : `slot-auto-${session.id}`,
      sessionId: session.id,
      name: '自动保存 [AutoSave]',
      timestamp: Date.now(),
      isAutoSave: true,
      version: 2,
      sessionSnapshot: snapshot,
      summary,
    };

    let nextSlots: TRPGSaveSlot[];
    if (existingAutoIdx >= 0) {
      nextSlots = [...allSlots];
      nextSlots[existingAutoIdx] = autoSlot;
    } else {
      nextSlots = [autoSlot, ...allSlots];
    }
    saveTRPGSaveSlots(nextSlots);
    return autoSlot;
  }

  // Manual save slot
  const formattedTime = new Date().toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  const defaultTitle = `${locationName} · ${formattedTime}`;

  const manualSlot: TRPGSaveSlot = {
    id: `slot-manual-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    sessionId: session.id,
    name: (name && name.trim()) || defaultTitle,
    timestamp: Date.now(),
    isAutoSave: false,
    version: 2,
    sessionSnapshot: snapshot,
    summary,
  };

  const nextSlots = [manualSlot, ...allSlots];
  saveTRPGSaveSlots(nextSlots);
  return manualSlot;
}

export function deleteTRPGSaveSlot(slotId: string): void {
  const allSlots = loadTRPGSaveSlots();
  const nextSlots = allSlots.filter((s) => s.id !== slotId);
  saveTRPGSaveSlots(nextSlots);
}

export function restoreTRPGSaveSlot(slotId: string): TRPGSession | null {
  const allSlots = loadTRPGSaveSlots();
  const target = allSlots.find((s) => s.id === slotId);
  if (!target || !target.sessionSnapshot) {
    console.error('Save slot not found or invalid:', slotId);
    return null;
  }

  const restoredSession = ensureSessionIntegrity(
    JSON.parse(JSON.stringify(target.sessionSnapshot))
  );

  // Sync to sessions storage
  saveSingleTRPGSession(restoredSession);
  setActiveTRPGSessionId(restoredSession.id);
  return restoredSession;
}
