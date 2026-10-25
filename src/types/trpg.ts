export interface TRPGAttributeDef {
  key: string; // e.g. 'str', 'dex', 'con', 'int', 'wis', 'cha'
  name: string; // e.g. '力量', '敏捷', '体质', '智力', '感知', '魅力'
  abbr: string; // e.g. 'STR', 'DEX'
  description: string;
  defaultValue: number;
  min: number;
  max: number;
}

export interface TRPGSkillDef {
  id: string;
  name: string;
  attributeKey: string;
  description: string;
}

export interface TRPGRuleset {
  id: string;
  name: string;
  description: string;
  isBuiltin: boolean; // 内置规则不可直接覆盖，支持复制和另存为
  attributes: TRPGAttributeDef[];
  skills: TRPGSkillDef[];
  modifierRule: 'd20_standard' | 'flat'; // d20_standard: (val - 10) / 2 向下取整
  difficultyClasses: {
    easy: number; // 默认 10
    medium: number; // 默认 15
    hard: number; // 默认 20
    veryHard: number; // 默认 25
  };
  hpRule: {
    baseHp: number; // 初始基准生命值
    conMultiplier: number; // 体质调整值倍数
  };
  defaultDamageFormula: string; // 默认空手/基础伤害，如 1d4 + STR
  updatedAt: number;
  createdAt: number;
}

export type TRPGItemType = 'weapon' | 'armor' | 'consumable' | 'misc';

export interface TRPGItem {
  id: string;
  name: string;
  type: TRPGItemType;
  quantity: number;
  equipped: boolean;
  damageDice?: string; // 武器伤害骰，如 "1d8+STR"
  acBonus?: number; // 护甲防御加值，如 +2
  healValue?: string; // 治疗骰或固定值，如 "2d4+2"
  description: string;
}

export interface TRPGCharacter {
  id: string;
  originCharacterId?: string; // 从普通角色卡导入时的来源母卡 ID
  name: string;
  identity: string; // 身份/定位
  characterClass: string; // 跑团职业（如：圣骑士、游侠、潜行者、调查员、学者等）
  avatarImage?: string;
  gender?: string;
  age?: string;
  appearance?: string;
  personality?: string;
  background?: string;
  speechStyle?: string;
  customNotes?: string;
  level: number;
  attributes: Record<string, number>; // { str: 14, dex: 12, con: 14, int: 10, wis: 13, cha: 15 }
  proficientSkills: string[]; // 拥有熟练加值的技能 id 列表
  currentHp: number;
  maxHp: number;
  tempHp: number;
  inventory: TRPGItem[];
  createdAt: number;
  updatedAt: number;
}

export interface TRPGRollResult {
  id: string;
  expression: string; // 如 "1d20+3"
  diceCount: number;
  diceSides: number;
  rolls: number[]; // 各个独立骰子点数
  modifier: number;
  total: number;
  isCriticalSuccess?: boolean; // 如 D20 大成功 (Natural 20)
  isCriticalFailure?: boolean; // 如 D20 大失败 (Natural 1)
  reason?: string;
  timestamp: number;
  isManual?: boolean; // 是否为玩家手动输入的点数
}

export interface TRPGCheckResult {
  id: string;
  characterId: string;
  characterName: string;
  type: 'attribute' | 'skill' | 'attack' | 'saving_throw';
  targetKey: string; // 属性键或技能 id
  targetName: string; // 显示名称（如 "力量" 或 "察觉"）
  roll: TRPGRollResult;
  attributeBonus: number;
  proficiencyBonus: number;
  totalBonus: number;
  dc?: number; // 目标难度
  isSuccess?: boolean;
  summaryText: string;
  timestamp: number;
}

export interface TRPGEnemy {
  id: string;
  name: string;
  currentHp: number;
  maxHp: number;
  ac: number; // 护甲防御值 (Armor Class)
  attackBonus: number; // 命中检定加值
  damageFormula: string; // 伤害表达式，如 "1d6+2"
  statusEffects: string[];
  description?: string;
}

export interface CombatActionLog {
  id: string;
  round: number;
  actor: string;
  actorType: 'player' | 'enemy' | 'system';
  actionType: 'attack' | 'heal' | 'skill' | 'flee' | 'status';
  target?: string;
  detail: string;
  isHit?: boolean;
  damageOrHeal?: number;
  timestamp: number;
}

export interface TRPGCombatState {
  inCombat: boolean;
  round: number;
  enemies: TRPGEnemy[];
  turn: 'player' | 'enemy';
  actionLogs: CombatActionLog[];
}

export interface TRPGMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  checkResult?: TRPGCheckResult;
  rollResult?: TRPGRollResult;
  combatEvent?: CombatActionLog;
  timestamp: number;
}

// ==========================================
// 队友系统 (Companions / Party Members)
// ==========================================
export interface TRPGCompanion {
  id: string;
  name: string;
  originCharacterId?: string; // 来源于普通角色卡母卡 ID
  character: TRPGCharacter; // 独立的职业、技能、属性、背包与生命值
  status: 'active' | 'dismissed' | 'left'; // active: 在队中; dismissed: 玩家解雇; left: 因剧情/个人目标/关系决裂自主离队
  favorability: number; // 好感度: -100 ~ +100 (0为中立，>30友善，>70深厚挚友，<-30厌恶，<-70敌视)
  trust: number; // 信任度: 0 ~ 100 (初始30，越高越愿意吐露秘密、听从危险指挥、托付后背)
  personalGoal?: string; // 个人夙愿/短期目标
  hiddenNotes?: string; // 隐藏身世/不能说的秘密
  relationshipTitle?: string; // 如 "同生共死的好友"、"雇佣战力"、"心存嫌隙"
  joinedAt: number;
  leftReason?: string; // 离队或解雇原因，保留历史
}

// ==========================================
// NPC 关系网络 (NPC Relationships)
// ==========================================
export interface TRPGNpcRelation {
  id: string;
  name: string;
  identity?: string; // 身份/阵营/头衔
  attitude: 'friendly' | 'neutral' | 'hostile' | 'allied' | 'suspicious';
  favorability: number; // 好感度: -100 ~ +100
  trust: number; // 信任度: 0 ~ 100
  notes?: string; // 关键交往记录或恩怨
  firstMetAt: number;
  updatedAt: number;
}

// ==========================================
// 任务与目标系统 (Quests & Objectives)
// ==========================================
export interface TRPGQuestObjective {
  id: string;
  text: string;
  done: boolean;
}

export type TRPGQuestCategory = 'main' | 'side' | 'hidden';
export type TRPGQuestStatus = 'undiscovered' | 'active' | 'completed' | 'failed';

export interface TRPGQuest {
  id: string;
  title: string;
  category: TRPGQuestCategory;
  status: TRPGQuestStatus;
  description: string;
  currentObjective: string;
  objectives: TRPGQuestObjective[];
  triggerCondition?: string; // 针对隐藏任务：触发条件说明（仅在内部和DM提示词中使用）
  rewards?: string; // 战役奖励预告（如：经验、金币、稀有宝物）
  isHidden: boolean; // 是否属于隐藏任务（若为未发现状态，界面绝对不予以展示）
  discoveredAt?: number;
  completedAt?: number;
}

// ==========================================
// 剧情纪事日志 (Narrative Story Log)
// ==========================================
export type StoryLogCategory =
  | 'story' // 关键剧情推进
  | 'choice' // 玩家重大抉择与转折
  | 'relation' // 关系增减与NPC态度变化
  | 'quest' // 任务接取、突破与完成
  | 'item' // 关键道具、神兵利器获取或转移
  | 'party'; // 队友加入、离队或自主行动

export interface TRPGStoryLogEntry {
  id: string;
  round?: number;
  category: StoryLogCategory;
  title: string;
  detail: string;
  timestamp: number;
}

// ==========================================
// 地图与探索系统 (Map & Exploration)
// ==========================================
export type LocationStatus = 'current' | 'explored' | 'known' | 'unexplored';
export type LocationDanger = 'safe' | 'low' | 'moderate' | 'high' | 'deadly';
export type LocationCategory = 'town' | 'ruins' | 'wilderness' | 'dungeon' | 'landmark' | 'tavern';

export interface TRPGLocationNode {
  id: string;
  name: string;
  category: LocationCategory;
  description: string;
  status: LocationStatus; // current (当前位置), explored (已探索), known (已知待探), unexplored (未探索迷雾)
  coordinates: { x: number; y: number }; // 0~100 响应式坐标百分比
  connectedNodeIds: string[]; // 相连通路地点 ID
  dangerLevel: LocationDanger;
  unlockRequirement?: string; // 进入/解锁限制条件
  discoveredAt?: number;
  lastVisitedAt?: number;
  environmentTags?: string[]; // 环境地貌氛围标签
}

export interface TRPGMapState {
  currentLocationId: string;
  locations: TRPGLocationNode[];
}

// ==========================================
// 存档与读档系统 (Save & Load Slots)
// ==========================================
export interface TRPGSaveSlot {
  id: string;
  sessionId: string;
  name: string;
  timestamp: number;
  isAutoSave: boolean;
  version: number; // 存档架构版本
  sessionSnapshot: TRPGSession; // 完整独立状态快照
  summary: {
    locationName: string;
    characterName: string;
    characterClass: string;
    currentHp: number;
    maxHp: number;
    companionsCount: number;
    activeQuestsCount: number;
    messageCount: number;
    storyLogCount: number;
  };
}

export interface TRPGSession {
  id: string;
  title: string;
  character: TRPGCharacter; // 独立跑团角色数据（会话内副本，绝不影响原卡）
  rulesetSnapshot: TRPGRuleset; // 明确的规则配置快照，修改外部规则预设时不影响已有存档
  worldBookIds: string[];
  presetId?: string;
  diceMode: 'auto' | 'manual'; // 'auto': AI/程序自动掷骰; 'manual': 等待玩家手动点击或输入物理骰
  messages: TRPGMessage[];
  combatState: TRPGCombatState;
  companions: TRPGCompanion[]; // 队伍成员
  npcRelations: TRPGNpcRelation[]; // NPC 人际关系网
  quests: TRPGQuest[]; // 主线、支线与隐藏任务
  storyLogs: TRPGStoryLogEntry[]; // 自动记录的关键剧情与选择纪事
  mapState: TRPGMapState; // 地理地图节点与探索态
  openingPremise: string;
  createdAt: number;
  updatedAt: number;
}

