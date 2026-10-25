export type CharacterRoleType = 'protagonist' | 'supporting' | 'extra';

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
  roleType?: CharacterRoleType; // 默认身份定位：主角 / 配角 / 群演
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

export type StoryMode = 'single' | 'multi' | 'novel';

export interface NovelChapterVersion {
  id: string;
  name: string; // 例如："初稿", "AI续写版", "润色版"
  content: string;
  wordCount: number;
  timestamp: number;
}

export interface NovelChapter {
  id: string;
  order: number; // 章节序号 1, 2, 3...
  title: string; // 章节标题 如 "第1章 凛冬苏醒"
  content: string; // 正文
  summary?: string; // 本章事件摘要（用于后续章节连贯推演）
  directive?: string; // 下章大纲走向 / 本章创作指令
  status: 'draft' | 'completed'; // 草稿 / 已完结
  versions: NovelChapterVersion[]; // 章节版本记录
  createdAt: number;
  updatedAt: number;
}

export interface TimelineEvent {
  id: string;
  time: string; // 时间节点/纪元 (如 "大历三年初春", "开篇后第三天")
  title: string; // 事件标题
  description: string; // 事件梗概
}

export interface NovelProject {
  id: string;
  title: string;
  summary: string; // 一句话立意/故事梗概
  genre?: string; // 题材 (玄幻、科幻、悬疑、都市等)
  targetWordCountPerChapter?: number; // 预期单章字数
  globalGuidance?: string; // 全局写作规则 / 核心主线 / 禁忌

  // 共享资源关联
  characterIds: string[]; // 关联的人物设定
  worldBookIds: string[]; // 关联的世界观世界书
  presetId?: string; // 关联的全局写作预设

  // 剧情规划
  outline: string; // 总体剧情大纲 / 分卷规划
  timeline: TimelineEvent[]; // 时间线事件

  // 统一连贯小说正文
  fullContent?: string;

  // 章节内容（兼容）
  chapters: NovelChapter[];
  activeChapterId?: string;

  createdAt: number;
  updatedAt: number;
}

export interface StorySave {
  id: string;
  title: string;
  summary: string;
  mode: StoryMode;
  characterIds: string[];
  characterRoleMap?: Record<string, CharacterRoleType>; // 多人模式角色分层：主角 / 配角 / 群演
  worldBookId?: string; // 单个关联（兼容旧存档）
  worldBookIds?: string[]; // 支持关联多个世界书
  presetId: string; // 单个关联（兼容旧存档）
  presetIds?: string[]; // 支持关联多个预设模板
  userMaskId?: string; // 使用的User面具ID
  openingPremise: string;
  messages: ChatMessage[];
  stats: GameStatDefinition[];
  config: StorySaveConfig;
  disabledCharacterStatIds?: string[]; // 角色状况追踪被关闭的 characterId 列表
  recalcPendingCharacterIds?: string[]; // 刚重新开启、等待根据上下文重算的 characterId 列表
  novelProject?: NovelProject; // 专供长篇小说创作模式的完整项目数据
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

// ==========================================
// 极简对话模式 (Dialogue Mode - GPT/Gemini/DeepSeek 风格)
// ==========================================
export interface DialogueMessageVersion {
  id: string;
  content: string;
  thinking?: string;
  timestamp: number;
}

export interface DialogueMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  thinking?: string; // 深度思考内容 (类似 DeepSeek-R1 / Gemini 思考过程)
  isThinkingExpanded?: boolean;
  versions?: DialogueMessageVersion[]; // 版本历史（保留新旧版本）
  currentVersionIndex?: number; // 当前查看的版本序号 (0, 1, 2...)
}

export interface DialogueAISettings {
  name: string; // AI 助手名称，如 "DeepSeek 思考版" / "Gemini 智囊" / "创意构想师"
  avatarType: 'sparkles' | 'bot' | 'brain' | 'terminal' | 'cat' | 'custom';
  avatarUrl?: string; // 自定义头像 URL 或 base64
  themeColor: 'sky' | 'indigo' | 'emerald' | 'violet' | 'rose' | 'amber' | 'slate';
  systemPrompt: string; // 自定义系统提示词 / 人设指令
  temperature: number;
  enableThinking: boolean; // 是否展示深度思考链
  customPersonaTitle?: string; // 助手身份头衔
}

export interface DialogueSession {
  id: string;
  title: string;
  messages: DialogueMessage[];
  aiSettings: DialogueAISettings;
  createdAt: number;
  updatedAt: number;
}

export * from './trpg';

