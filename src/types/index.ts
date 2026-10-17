export interface CharacterCard {
  id: string;
  name: string;
  identity: string;
  avatarImage?: string; // base64 or URL
  gender: string;
  age: string;
  appearance: string;
  personality: string;
  background: string;
  speechStyle: string;
  customNotes: string;
  updatedAt: number;
  createdAt: number;
}

export type WorldBookCategory = 'worldview' | 'faction' | 'location' | 'rule' | 'lore' | 'custom';
export type WorldBookInsertionPosition = 'system' | 'before_character' | 'after_character' | 'history_end';

export interface WorldBookEntry {
  id: string;
  name: string;
  category: WorldBookCategory;
  keywords: string[];
  content: string;
  priority: number; // 优先级：数字越大优先级越高（如 1 - 100，默认 50）
  insertionPosition: WorldBookInsertionPosition; // 注入位置
  enabled: boolean;
}

export interface WorldBook {
  id: string;
  title: string;
  description: string;
  category: string;
  entries: WorldBookEntry[];
  updatedAt: number;
}

export type WordCountOption = 'short' | 'medium' | 'long';

export interface SystemPreset {
  id: string;
  title: string;
  description: string;
  contentPrompt: string; // 预设的核心提示词/叙事指令与规则
  updatedAt: number;
}

export interface GameStatDefinition {
  id: string;
  name: string;
  initialValue: number;
  currentValue: number;
  minValue: number;
  maxValue: number;
  unit: string;
  color: 'sky' | 'rose' | 'amber' | 'emerald' | 'indigo' | 'violet';
  enabled: boolean;
  target: 'character' | 'player';
  characterId?: string;
  characterName?: string;
  lastDelta?: number;
}

export interface ChatMessageBranch {
  id: string;
  text: string;
  thoughts?: Record<string, string>;
  statsDelta?: Record<string, number>;
  statsDeltaByCharacter?: Record<string, Record<string, number>>;
  suggestedBranches?: string[];
  timestamp: number;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  branches?: ChatMessageBranch[];
  currentBranchIndex?: number;
  thoughts?: Record<string, string>;
  statsDelta?: Record<string, number>;
  statsDeltaByCharacter?: Record<string, Record<string, number>>;
  suggestedBranches?: string[];
  timestamp: number;
}

export interface UserMask {
  id: string;
  name: string; // 姓名
  codeName?: string; // 代号
  nickname?: string; // 昵称
  gender?: string; // 性别
  identity?: string; // 身份
  appearance?: string; // 外貌
  personality?: string; // 性格
  speechStyle?: string; // 言谈习惯 (选填)
  customNotes?: string; // 额外设定
  updatedAt: number;
  createdAt: number;
}

export interface StorySaveConfig {
  innerVoiceEnabled: boolean;
  branchChoicesEnabled: boolean;
  statsTrackingEnabled: boolean;
  corruptionConstraintEnabled?: boolean; // 黑化值人设约束：开启(纯良正面角色黑化值锁0) / 关闭(与其他一致正常增减)
  userMaskEnabled?: boolean; // 玩家面具/玩家参演开关：开启(User作为角色参演) / 关闭(User不参与本次故事，纯群像/客观观察视角)
  targetWordCount: WordCountOption;

  // 游玩设置新增项：
  wordCountConstraintEnabled?: boolean; // 每次输出字数开关：关=ai自由发挥，开=遵循填入字数区间
  wordCountMin?: number; // 最小字数 (例如 300)
  wordCountMax?: number; // 最大字数 (例如 800)
  narrativePerspective?: 'first' | 'second' | 'third'; // 人称代词：第一人称(我) / 第二人称(你) / 第三人称(姓名/他/她)
  antiImpersonationEnabled?: boolean; // 防抢话开关：开启则严禁代替玩家发言做决策
  playMode?: 'dialogue' | 'director'; // 对话模式(直接承接发言) / 导演模式(作为场景指导推演)
  writingGuidance?: string; // 本场写作指导
}

export interface StorySave {
  id: string;
  title: string;
  summary: string;
  mode: 'single' | 'multi';
  characterIds: string[];
  worldBookId?: string;
  presetId: string;
  userMaskId?: string; // 使用的User面具ID
  openingPremise: string;
  messages: ChatMessage[];
  stats: GameStatDefinition[];
  config: StorySaveConfig;
  disabledCharacterStatIds?: string[]; // 角色状况追踪被关闭的 characterId 列表
  recalcPendingCharacterIds?: string[]; // 刚重新开启、等待根据上下文重算的 characterId 列表
  createdAt: number;
  updatedAt: number;
}

export type AIProvider = 'gemini' | 'openai_compatible';

export interface AppSettings {
  provider: AIProvider;
  model: string;
  customApiKey: string;
  customEndpoint: string;
  temperature: number;
  fontSize: 'sm' | 'base' | 'lg' | 'xl';
  lineSpacing: 'normal' | 'relaxed' | 'loose';
  fontFamily: 'sans' | 'serif';
  autoScroll: boolean;
}

export type ActiveNavTab = 'home' | 'create' | 'shelf' | 'settings' | 'profile';
