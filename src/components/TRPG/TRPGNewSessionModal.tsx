import React, { useState, useEffect } from 'react';
import {
  X,
  Play,
  Dices,
  BookOpen,
  UserCheck,
  Plus,
  Minus,
  Sparkles,
  Shield,
  ChevronRight,
  ArrowLeft,
  Settings2,
  Users,
  Smile,
  Heart,
  Check,
  Info,
  Flame,
  Trash2,
  RotateCcw,
  Compass,
} from 'lucide-react';
import {
  TRPGSession,
  TRPGCharacter,
  TRPGRuleset,
  TRPGCompanion,
  TRPGNpcRelation,
  TRPGQuest,
  TRPGStoryLogEntry,
  TRPGSkillDef,
  TRPGLocationNode,
} from '../../types/trpg';
import { CharacterCard, WorldBook, SystemPreset, UserMask } from '../../types';
import {
  loadTRPGCharacters,
  loadTRPGRulesets,
  createTRPGCharacterFromCard,
  saveSingleTRPGSession,
  setActiveTRPGSessionId,
  deleteTRPGRuleset,
  restoreDefaultTRPGRulesets,
} from '../../utils/trpgStorage';
import {
  DEFAULT_D20_RULESET,
  STARTER_CLASS_PRESETS,
  DEFAULT_MAP_LOCATIONS,
  DEFAULT_STARTER_ITEMS,
} from '../../utils/defaultTRPGData';
import { calculateAttributeModifier } from '../../utils/diceEngine';
import { TRPGRulesetModal } from './TRPGRulesetModal';

export const STORY_OUTLINE_PRESETS = [
  {
    label: '🌧️ 风雨酒馆委托',
    content:
      '暴风雨在古旧的酒馆木窗外狂啸，壁炉炭火噼啪作响。酒馆角落的阴影里，一个身披深色斗篷的神秘委托人朝我招了招手，推过来一份泛黄的羊皮纸地图，期望我调查荒野深处的古怪异动……',
  },
  {
    label: '⛓️ 幽暗地牢逃生',
    content:
      '我从阴冷潮湿的石质地牢深处苏醒，手腕上残留着磨损的锁链铁锈。牢门外传来巡逻狱卒沉重的脚步声与远处的低吼，我必须在守卫换岗前搜寻趁手工具，设法解开枷锁逃出生天……',
  },
  {
    label: '🏛️ 远古遗迹探索',
    content:
      '受学者行会的高额酬金委托，我只身踏入被迷雾笼罩的远古文明废墟。坍塌石柱与风化神龛间潜藏着未知的机关陷阱与游荡魔物，我的目标是寻得失落的古神符文圣物……',
  },
  {
    label: '👑 王都夜宴密谋',
    content:
      '灯火辉煌的王都贵族夜宴深处暗流涌动。在华丽帷幕的遮掩下，我截获了一份记载着叛乱与刺杀计划的密函，然而城卫军的警哨声已在回廊响起，必须做出决断并突围……',
  },
];

interface TRPGNewSessionModalProps {
  isOpen: boolean;
  onClose: () => void;
  characterCards: CharacterCard[];
  worldbooks: WorldBook[];
  presets: SystemPreset[];
  userMasks?: UserMask[];
  activeUserMaskId?: string | null;
  onSessionCreated: (session: TRPGSession) => void;
}

export const TRPGNewSessionModal: React.FC<TRPGNewSessionModalProps> = ({
  isOpen,
  onClose,
  characterCards,
  worldbooks,
  presets,
  userMasks = [],
  activeUserMaskId,
  onSessionCreated,
}) => {
  // Step navigation: 'setup' -> 'attributes' -> Launch
  const [currentStep, setCurrentStep] = useState<'setup' | 'attributes'>('setup');

  const [rulesets, setRulesets] = useState<TRPGRuleset[]>(() => loadTRPGRulesets());
  const [selectedRuleset, setSelectedRuleset] = useState<TRPGRuleset>(
    () => rulesets[0] || DEFAULT_D20_RULESET
  );

  // Form base states
  const [title, setTitle] = useState('迷雾地城探险记');
  const [diceMode, setDiceMode] = useState<'auto' | 'manual'>('auto');

  // Protagonist selection: 'card' (character card) | 'mask' (user mask)
  const [protagonistType, setProtagonistType] = useState<'card' | 'mask'>(() => {
    if (activeUserMaskId && userMasks.some((m) => m.id === activeUserMaskId)) {
      return 'mask';
    }
    return characterCards.length > 0 ? 'card' : 'mask';
  });

  const [selectedCardId, setSelectedCardId] = useState<string>(
    characterCards[0]?.id || ''
  );
  const [selectedMaskId, setSelectedMaskId] = useState<string>(
    activeUserMaskId || userMasks[0]?.id || ''
  );

  // Companions selection (from characterCards excluding protagonist)
  const [selectedCompanionCardIds, setSelectedCompanionCardIds] = useState<string[]>([]);

  // Worldbooks & DM Preset
  const [selectedWorldBookIds, setSelectedWorldBookIds] = useState<string[]>([]);
  const [selectedPresetId, setSelectedPresetId] = useState<string>('');
  const [openingPremise, setOpeningPremise] = useState(
    '暴风雨在古旧的酒馆木窗外狂啸，壁炉炭火噼啪作响。酒馆角落的阴影里，一个身披深色斗篷的神秘委托人朝你招了招手，推过来一份羊皮纸地图……'
  );

  // Numerical Attribute Allocation (Step 2)
  const [characterClass, setCharacterClass] = useState('流浪探险者');
  const [allocatedAttributes, setAllocatedAttributes] = useState<Record<string, number>>({});
  const [proficientSkills, setProficientSkills] = useState<string[]>(['perception', 'athletics']);
  const [customSkills, setCustomSkills] = useState<TRPGSkillDef[]>(() => selectedRuleset.skills || []);
  const [isAddingSkill, setIsAddingSkill] = useState(false);
  const [newSkillName, setNewSkillName] = useState('');
  const [newSkillAttrKey, setNewSkillAttrKey] = useState('');
  const [newSkillDesc, setNewSkillDesc] = useState('');

  // Editing ruleset sub-modal
  const [editingRuleset, setEditingRuleset] = useState<TRPGRuleset | null>(null);

  // Initialize attribute values and skills whenever ruleset changes
  useEffect(() => {
    const initAttrs: Record<string, number> = {};
    (selectedRuleset.attributes || []).forEach((a) => {
      initAttrs[a.key] = a.defaultValue || 10;
    });
    setAllocatedAttributes(initAttrs);
    setCustomSkills(selectedRuleset.skills || []);
  }, [selectedRuleset]);

  if (!isOpen) return null;

  // Selected Protagonist Info
  const selectedProtagonistCard = characterCards.find((c) => c.id === selectedCardId);
  const selectedProtagonistMask = userMasks.find((m) => m.id === selectedMaskId);

  const protagonistName =
    protagonistType === 'mask'
      ? selectedProtagonistMask?.name || '冒险者 (面具)'
      : selectedProtagonistCard?.name || '冒险者';

  const protagonistIdentity =
    protagonistType === 'mask'
      ? selectedProtagonistMask?.identity || '旅人'
      : selectedProtagonistCard?.identity || '自由探险者';

  const protagonistBackground =
    protagonistType === 'mask'
      ? selectedProtagonistMask?.customNotes || selectedProtagonistMask?.personality || '暂无详细背景记录'
      : selectedProtagonistCard?.background || selectedProtagonistCard?.personality || '暂无详细背景记录';

  // Selected companions list
  const selectedCompanions = selectedCompanionCardIds
    .map((cId) => characterCards.find((c) => c.id === cId))
    .filter((c): c is CharacterCard => !!c);

  const toggleCompanionCard = (cardId: string) => {
    setSelectedCompanionCardIds((prev) =>
      prev.includes(cardId) ? prev.filter((id) => id !== cardId) : [...prev, cardId]
    );
  };

  const toggleWorldBook = (id: string) => {
    setSelectedWorldBookIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const handleDeleteRuleset = (id: string) => {
    if (confirm('确认删除该规则预设吗？')) {
      const updated = deleteTRPGRuleset(id);
      setRulesets(updated);
      if (selectedRuleset.id === id) {
        setSelectedRuleset(updated[0] || DEFAULT_D20_RULESET);
      }
    }
  };

  const handleRestoreRulesets = () => {
    if (confirm('确认恢复为内置默认规则预设吗？')) {
      const restored = restoreDefaultTRPGRulesets();
      setRulesets(restored);
      setSelectedRuleset(restored[0]);
    }
  };

  // Preset class template applicator
  const applyClassPreset = (preset: (typeof STARTER_CLASS_PRESETS)[0]) => {
    setCharacterClass(preset.name);
    setAllocatedAttributes({ ...preset.suggestedAttributes });
    setProficientSkills([...preset.proficiencies]);
  };

  // Adjust numerical attribute
  const adjustAttribute = (key: string, delta: number) => {
    const attrDef = selectedRuleset.attributes.find((a) => a.key === key);
    const minVal = attrDef?.min ?? 3;
    const maxVal = attrDef?.max ?? 20;

    setAllocatedAttributes((prev) => {
      const current = prev[key] ?? 10;
      const next = Math.max(minVal, Math.min(maxVal, current + delta));
      return { ...prev, [key]: next };
    });
  };

  // Toggle proficient skills
  const toggleSkill = (skillId: string) => {
    setProficientSkills((prev) =>
      prev.includes(skillId) ? prev.filter((s) => s !== skillId) : [...prev, skillId]
    );
  };

  // Delete a skill manually
  const handleDeleteSkill = (skillId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setCustomSkills((prev) => prev.filter((s) => s.id !== skillId));
    setProficientSkills((prev) => prev.filter((s) => s !== skillId));
  };

  // Add a skill manually
  const handleAddCustomSkill = () => {
    const trimmed = newSkillName.trim();
    if (!trimmed) return;
    const attrKey = newSkillAttrKey || selectedRuleset.attributes[0]?.key || 'str';
    const newSkill: TRPGSkillDef = {
      id: `custom-skill-${Date.now()}`,
      name: trimmed,
      attributeKey: attrKey,
      description: newSkillDesc.trim() || '自定义技能',
    };
    setCustomSkills((prev) => [...prev, newSkill]);
    setProficientSkills((prev) => [...prev, newSkill.id]);
    setNewSkillName('');
    setNewSkillDesc('');
    setIsAddingSkill(false);
  };

  // HP Preview
  const conMod = calculateAttributeModifier(
    allocatedAttributes.con ?? 10,
    selectedRuleset.modifierRule
  );
  const previewMaxHp = Math.max(
    8,
    selectedRuleset.hpRule.baseHp + conMod * selectedRuleset.hpRule.conMultiplier
  );

  // Final Campaign Launch handler
  const handleLaunchCampaign = () => {
    // Consolidated ruleset with player's customized skills
    const finalRuleset: TRPGRuleset = {
      ...selectedRuleset,
      skills: customSkills,
    };

    // 1. Build protagonist character
    let baseChar: TRPGCharacter;

    if (protagonistType === 'mask' && selectedProtagonistMask) {
      baseChar = {
        id: `trpg-char-${Date.now()}`,
        originCharacterId: selectedProtagonistMask.id,
        name: selectedProtagonistMask.name,
        identity: selectedProtagonistMask.identity || '探险者',
        characterClass: characterClass || selectedProtagonistMask.identity || '探险者',
        avatarImage: undefined,
        gender: selectedProtagonistMask.gender,
        appearance: selectedProtagonistMask.appearance,
        personality: selectedProtagonistMask.personality,
        background: selectedProtagonistMask.customNotes || selectedProtagonistMask.personality || '以面具身份踏上旅途的探险者。',
        speechStyle: selectedProtagonistMask.speechStyle,
        customNotes: selectedProtagonistMask.customNotes,
        level: 1,
        attributes: allocatedAttributes,
        proficientSkills,
        currentHp: previewMaxHp,
        maxHp: previewMaxHp,
        tempHp: 0,
        inventory: JSON.parse(JSON.stringify(DEFAULT_STARTER_ITEMS)),
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
    } else if (selectedProtagonistCard) {
      baseChar = createTRPGCharacterFromCard(selectedProtagonistCard, finalRuleset, {
        characterClass,
        attributes: allocatedAttributes,
        proficientSkills,
      });
      baseChar.currentHp = previewMaxHp;
      baseChar.maxHp = previewMaxHp;
    } else {
      const fallbackCard: CharacterCard = {
        id: `dummy-${Date.now()}`,
        name: protagonistName,
        identity: characterClass,
        gender: '未知',
        age: '24',
        appearance: '常年游走于荒野边界的探险者。',
        personality: '沉着机敏。',
        background: '追寻古老传说的旅人。',
        speechStyle: '干脆简洁',
        customNotes: '追寻古老传说的旅人。',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      baseChar = createTRPGCharacterFromCard(fallbackCard, finalRuleset, {
        characterClass,
        attributes: allocatedAttributes,
        proficientSkills,
      });
      baseChar.currentHp = previewMaxHp;
      baseChar.maxHp = previewMaxHp;
    }

    // 2. Build cast / candidate companions (Initially roaming in the world, not in active squad!)
    const initialCompanions: TRPGCompanion[] = selectedCompanions.map((card) => {
      const compChar = createTRPGCharacterFromCard(card, finalRuleset);
      return {
        id: `comp-${Date.now()}-${card.id}`,
        name: card.name,
        originCharacterId: card.id,
        character: compChar,
        status: 'left' as const, // 初始不入队！待冒险途中偶遇结识后招募
        favorability: 20,
        trust: 30,
        personalGoal: card.customNotes || '正在各处游历，寻找冒险契机',
        hiddenNotes: card.background,
        relationshipTitle: '待偶遇结识的参演伙伴',
        joinedAt: Date.now(),
        leftReason: '尚未正式入队（游历在外的参演伙伴，待冒险途中偶遇招募）',
      };
    });

    // 3. Quests start completely empty; generated by AI DM as story progresses!
    const initialQuests: TRPGQuest[] = [];

    // 4. Initial NPC Relations: only real companions or empty, no hardcoded tavern client
    const initialNpcs: TRPGNpcRelation[] = [];

    // 5. Initial Story Log: completely empty, recorded when real events happen
    const initialStoryLogs: TRPGStoryLogEntry[] = [];

    // 6. Starting map node
    const initialLocations: TRPGLocationNode[] = [
      {
        id: 'loc-start',
        name: '冒险出发点',
        category: 'landmark',
        description: openingPremise.trim() || '冒险序章拉开帷幕的最初立足点。',
        status: 'current',
        coordinates: { x: 35, y: 50 },
        connectedNodeIds: [],
        dangerLevel: 'safe',
        discoveredAt: Date.now(),
        lastVisitedAt: Date.now(),
        environmentTags: ['开篇立足点', '探索起点'],
      },
    ];

    const newSession: TRPGSession = {
      id: `session-trpg-${Date.now()}`,
      title: title.trim() || '未命名跑团冒险',
      character: baseChar,
      rulesetSnapshot: JSON.parse(JSON.stringify(finalRuleset)),
      worldBookIds: selectedWorldBookIds,
      presetId: selectedPresetId || undefined,
      diceMode,
      messages: [], // Empty! Generated dynamically by AI based on outline upon session start
      combatState: {
        inCombat: false,
        round: 1,
        enemies: [],
        turn: 'player',
        actionLogs: [],
      },
      companions: initialCompanions,
      npcRelations: initialNpcs,
      quests: initialQuests,
      storyLogs: initialStoryLogs,
      mapState: {
        currentLocationId: 'loc-start',
        locations: initialLocations,
      },
      openingPremise: openingPremise.trim(),
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    saveSingleTRPGSession(newSession);
    setActiveTRPGSessionId(newSession.id);
    onSessionCreated(newSession);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex flex-col justify-end sm:justify-center p-0 sm:p-4 overflow-y-auto">
      <div className="bg-white w-full max-w-4xl h-full sm:h-auto sm:max-h-[92vh] sm:rounded-3xl shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-bottom-4 duration-200">
        {/* Header Bar */}
        <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-sky-50 via-white to-indigo-50 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-sky-500 to-indigo-600 text-white flex items-center justify-center shadow-xs">
              <Dices className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-slate-800">
                  {currentStep === 'setup' ? '新建跑团' : '分配初始属性数值'}
                </h2>
                <span className="px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 text-[10px] font-bold">
                  {currentStep === 'setup' ? '步骤 1/2' : '步骤 2/2'}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                {currentStep === 'setup'
                  ? '选定主角、同伴、背景世界书与规则'
                  : `根据【${selectedRuleset.name}】规则调整能力点数`}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* ========================================================
            STEP 1: 选人 (面具/角色卡) -> 确认背景与世界书 -> 选择规则
            ======================================================== */}
        {currentStep === 'setup' ? (
          <div className="p-5 sm:p-6 overflow-y-auto space-y-5 flex-1 text-slate-800">
            {/* 1. Title & Dice Mode */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-2 space-y-1">
                <label className="text-xs font-bold text-slate-700">战役标题</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="本次冒险标题"
                  className="w-full px-3 py-2 text-xs sm:text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-400 font-medium"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">掷骰模式</label>
                <div className="flex rounded-xl bg-slate-100 p-1 border border-slate-200">
                  <button
                    type="button"
                    onClick={() => setDiceMode('auto')}
                    className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                      diceMode === 'auto'
                        ? 'bg-white text-sky-700 shadow-xs'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    AI 自动骰
                  </button>
                  <button
                    type="button"
                    onClick={() => setDiceMode('manual')}
                    className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                      diceMode === 'manual'
                        ? 'bg-white text-amber-700 shadow-xs'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    玩家手动掷骰
                  </button>
                </div>
              </div>
            </div>

            {/* 2. Choose Protagonist (User Mask or Character Card) */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <UserCheck className="w-4 h-4 text-sky-600" />
                  选定主角身份
                </label>
                <div className="flex gap-1.5 bg-slate-100 p-0.5 rounded-lg text-xs">
                  <button
                    type="button"
                    onClick={() => setProtagonistType('mask')}
                    className={`px-2.5 py-1 rounded-md font-semibold transition-all cursor-pointer ${
                      protagonistType === 'mask'
                        ? 'bg-white text-sky-700 shadow-xs'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    User 面具 ({userMasks.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setProtagonistType('card')}
                    className={`px-2.5 py-1 rounded-md font-semibold transition-all cursor-pointer ${
                      protagonistType === 'card'
                        ? 'bg-white text-indigo-700 shadow-xs'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    角色库 ({characterCards.length})
                  </button>
                </div>
              </div>

              {/* Mask / Card grid */}
              {protagonistType === 'mask' ? (
                userMasks.length === 0 ? (
                  <div className="p-4 rounded-xl border border-dashed border-slate-200 text-center bg-slate-50 text-xs text-slate-500">
                    暂无用户面具，请切换到「角色库」选择或在用户设置中添加面具
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 max-h-36 overflow-y-auto p-1">
                    {userMasks.map((mask) => {
                      const isSelected = selectedMaskId === mask.id;
                      return (
                        <div
                          key={mask.id}
                          onClick={() => setSelectedMaskId(mask.id)}
                          className={`p-2.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between ${
                            isSelected
                              ? 'bg-sky-50 border-sky-400 shadow-xs'
                              : 'bg-white border-slate-200 hover:border-sky-200'
                          }`}
                        >
                          <div className="min-w-0 pr-2">
                            <div className="text-xs font-bold text-slate-800 flex items-center gap-1 truncate">
                              <Smile className="w-3.5 h-3.5 text-sky-600 shrink-0" />
                              {mask.name}
                            </div>
                            <div className="text-[10px] text-slate-400 truncate">
                              {mask.identity || '旅人'}
                            </div>
                          </div>
                          {isSelected && <Check className="w-4 h-4 text-sky-600 shrink-0" />}
                        </div>
                      );
                    })}
                  </div>
                )
              ) : characterCards.length === 0 ? (
                <div className="p-4 rounded-xl border border-dashed border-slate-200 text-center bg-slate-50 text-xs text-slate-500">
                  角色库暂无角色卡
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 max-h-36 overflow-y-auto p-1">
                  {characterCards.map((card) => {
                    const isSelected = selectedCardId === card.id;
                    return (
                      <div
                        key={card.id}
                        onClick={() => setSelectedCardId(card.id)}
                        className={`p-2.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between ${
                          isSelected
                            ? 'bg-indigo-50 border-indigo-400 shadow-xs'
                            : 'bg-white border-slate-200 hover:border-indigo-200'
                        }`}
                      >
                        <div className="min-w-0 pr-2">
                          <div className="text-xs font-bold text-slate-800 truncate">{card.name}</div>
                          <div className="text-[10px] text-slate-400 truncate">
                            {card.identity || '探险者'}
                          </div>
                        </div>
                        {isSelected && <Check className="w-4 h-4 text-indigo-600 shrink-0" />}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* 3. Companions Selection (Optional) */}
            {characterCards.length > 0 && (
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-800 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Users className="w-4 h-4 text-emerald-600" />
                    参演伙伴（选填，已选 {selectedCompanionCardIds.length} 人）
                  </span>
                  <span className="text-[10px] font-normal text-slate-400">
                    最开始不入队，冒险途中可能偶遇并可自行招募
                  </span>
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 max-h-32 overflow-y-auto p-1">
                  {characterCards.map((card) => {
                    const isProtagonist =
                      protagonistType === 'card' && selectedCardId === card.id;
                    const isChecked = selectedCompanionCardIds.includes(card.id);

                    return (
                      <div
                        key={card.id}
                        onClick={() => !isProtagonist && toggleCompanionCard(card.id)}
                        className={`p-2 rounded-xl border text-xs flex items-center justify-between transition-all ${
                          isProtagonist
                            ? 'opacity-40 bg-slate-50 border-slate-200 cursor-not-allowed'
                            : isChecked
                            ? 'bg-emerald-50 border-emerald-400 shadow-xs cursor-pointer'
                            : 'bg-white border-slate-200 hover:border-emerald-200 cursor-pointer'
                        }`}
                      >
                        <div className="min-w-0 pr-1">
                          <div className="font-bold text-slate-800 truncate">{card.name}</div>
                          <div className="text-[10px] text-slate-400 truncate">
                            {isProtagonist ? '已为主角' : '潜在参演'}
                          </div>
                        </div>
                        <input
                          type="checkbox"
                          disabled={isProtagonist}
                          checked={isChecked}
                          onChange={() => {}}
                          className="rounded text-emerald-600 shrink-0 pointer-events-none"
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* 4. Background & Worldbook Confirmation Card */}
            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                  <BookOpen className="w-4 h-4 text-sky-600" />
                  确认人物背景与世界书
                </span>
                <span className="text-[11px] text-slate-500">
                  主角：<strong className="text-slate-800">{protagonistName}</strong>
                </span>
              </div>

              {/* Background preview */}
              <div className="p-2.5 rounded-xl bg-white border border-slate-200/80 text-xs text-slate-600 leading-relaxed font-sans">
                <span className="font-semibold text-slate-700">【背景设定】: </span>
                {protagonistBackground}
                {selectedCompanions.length > 0 && (
                  <div className="mt-1.5 pt-1.5 border-t border-slate-100 text-[11px] text-slate-500">
                    参演伙伴设定（旅途中可能遇上并可招募）：
                    {selectedCompanions.map((c) => `${c.name}(${c.identity || '参演伙伴'})`).join('、')}
                  </div>
                )}
              </div>

              {/* Worldbook Checkboxes */}
              <div>
                <label className="text-[11px] font-bold text-slate-500 block mb-1">
                  勾选战役世界书 ({selectedWorldBookIds.length}/{worldbooks.length})
                </label>
                {worldbooks.length === 0 ? (
                  <p className="text-[11px] text-slate-400">暂无世界书，将使用默认背景</p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-28 overflow-y-auto">
                    {worldbooks.map((wb) => {
                      const isChecked = selectedWorldBookIds.includes(wb.id);
                      return (
                        <div
                          key={wb.id}
                          onClick={() => toggleWorldBook(wb.id)}
                          className={`p-2 rounded-lg border text-xs flex items-center justify-between cursor-pointer transition-colors ${
                            isChecked
                              ? 'bg-sky-50 border-sky-300 text-sky-800 font-semibold'
                              : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                          }`}
                        >
                          <span className="truncate">{wb.title}</span>
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => {}}
                            className="rounded text-sky-500 shrink-0 pointer-events-none"
                          />
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* 5. Opening Story Outline & Desired Direction */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <Compass className="w-4 h-4 text-amber-600" />
                  开局故事大纲与剧情走向
                </label>
                <span className="text-[11px] text-slate-400">
                  自由手写或一键套用模板，引导 DM 带团走向
                </span>
              </div>

              {/* Quick Template Chips */}
              <div className="flex flex-wrap gap-1.5">
                {STORY_OUTLINE_PRESETS.map((preset) => (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() => setOpeningPremise(preset.content)}
                    className="px-2.5 py-1 text-xs rounded-lg bg-slate-100 hover:bg-amber-50 hover:text-amber-800 hover:border-amber-200 border border-transparent text-slate-600 transition-colors font-medium cursor-pointer"
                  >
                    {preset.label}
                  </button>
                ))}
              </div>

              {/* Custom Story Outline Textarea */}
              <div className="relative">
                <textarea
                  rows={3}
                  value={openingPremise}
                  onChange={(e) => setOpeningPremise(e.target.value)}
                  placeholder="写下你想要的开局故事大纲、环境遭遇、冲突危机以及你期望的剧情走向（例如：地牢逃生、废墟调查、王都密谋、寻找失落神器等）..."
                  className="w-full p-3 text-xs border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-amber-400 bg-white leading-relaxed resize-none font-sans text-slate-800 shadow-2xs"
                />
                <div className="flex items-center justify-between mt-1 px-1 text-[10px] text-slate-400">
                  <span>💡 提示：DM 会紧扣你写下的大纲走向构建初登场剧情与主线动机</span>
                  <span>{openingPremise.length} 字</span>
                </div>
              </div>
            </div>

            {/* 6. Select Ruleset */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <Shield className="w-4 h-4 text-indigo-600" />
                  战役规则与数值系统
                </label>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleRestoreRulesets}
                    className="text-xs text-slate-500 hover:text-indigo-600 font-medium flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
                    title="恢复内置默认规则"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    恢复默认
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingRuleset(selectedRuleset)}
                    className="text-xs text-indigo-600 hover:text-indigo-800 font-medium flex items-center gap-1 px-2 py-1 rounded-lg bg-indigo-50 hover:bg-indigo-100 transition-colors cursor-pointer"
                  >
                    <Settings2 className="w-3.5 h-3.5" />
                    规则配置
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {rulesets.map((r) => {
                  const isSelected = selectedRuleset.id === r.id;
                  const attrNames = r.attributes.map((a) => a.name).join(' · ');

                  return (
                    <div
                      key={r.id}
                      onClick={() => setSelectedRuleset(r)}
                      className={`p-3 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between ${
                        isSelected
                          ? 'bg-indigo-50/80 border-indigo-400 shadow-xs'
                          : 'bg-white border-slate-200 hover:border-indigo-200'
                      }`}
                    >
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-bold text-slate-800">{r.name}</span>
                          <div className="flex items-center gap-1.5">
                            {isSelected && <Check className="w-4 h-4 text-indigo-600 shrink-0" />}
                            {!r.isBuiltin && rulesets.length > 1 && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteRuleset(r.id);
                                }}
                                className="p-1 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                                title="删除此规则预设"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </div>
                        <p className="text-[11px] text-slate-500 line-clamp-1">{r.description}</p>
                      </div>
                      <div className="mt-2 text-[10px] text-indigo-700 font-medium bg-white/70 px-2 py-1 rounded-md border border-indigo-100">
                        包含数值：{attrNames}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        ) : (
          /* ========================================================
             STEP 2: 属性数值调配新界面 (力量、敏捷、体质、智力、感知、魅力等)
             ======================================================== */
          <div className="p-5 sm:p-6 overflow-y-auto overflow-x-hidden space-y-5 flex-1 text-slate-800">
            {/* Top Quick Class Preset Selector */}
            <div className="p-3.5 rounded-2xl bg-gradient-to-r from-sky-50 via-indigo-50 to-white border border-sky-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <Flame className="w-4 h-4 text-amber-500" />
                  快速套用职业模版
                </span>
                <span className="text-[11px] text-slate-500">
                  一键分配推荐属性，也可在下方自由增减
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {STARTER_CLASS_PRESETS.map((preset) => (
                  <button
                    key={preset.name}
                    type="button"
                    onClick={() => applyClassPreset(preset)}
                    className="px-2.5 py-1 rounded-lg bg-white border border-slate-200 hover:border-sky-400 text-xs font-medium text-slate-700 transition-colors shadow-xs cursor-pointer"
                  >
                    {preset.name.split('/')[0].trim()}
                  </button>
                ))}
              </div>
            </div>

            {/* Protagonist Class Name & HP Preview */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-2 space-y-1">
                <label className="text-xs font-bold text-slate-700">职业定位</label>
                <input
                  type="text"
                  value={characterClass}
                  onChange={(e) => setCharacterClass(e.target.value)}
                  placeholder="如：游侠、重甲骑士、调查员"
                  className="w-full px-3 py-1.5 text-xs sm:text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-400 font-medium"
                />
              </div>

              <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 flex items-center justify-between">
                <div>
                  <div className="text-[10px] font-bold text-rose-700 uppercase">初始生命上限</div>
                  <div className="text-base font-bold text-rose-800 flex items-center gap-1">
                    <Heart className="w-4 h-4 fill-rose-500 text-rose-500" />
                    {previewMaxHp} HP
                  </div>
                </div>
                <span className="text-[10px] text-rose-600">
                  体质修正: {conMod >= 0 ? `+${conMod}` : conMod}
                </span>
              </div>
            </div>

            {/* Numerical Attributes Grid */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-800">
                  核心数值调配（{selectedRuleset.name}）
                </label>
                <span className="text-[11px] text-slate-500">点击 +/- 按钮调整</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {selectedRuleset.attributes.map((attr) => {
                  const val = allocatedAttributes[attr.key] ?? attr.defaultValue ?? 10;
                  const mod = calculateAttributeModifier(val, selectedRuleset.modifierRule);
                  const modSign = mod >= 0 ? `+${mod}` : `${mod}`;

                  return (
                    <div
                      key={attr.key}
                      className="p-3.5 rounded-2xl bg-white border border-slate-200 shadow-xs flex flex-col justify-between space-y-2.5"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="text-xs font-bold text-slate-800">{attr.name}</span>
                          <span className="text-[10px] text-slate-400 font-mono ml-1">
                            ({attr.abbr})
                          </span>
                        </div>
                        <span
                          className={`text-xs px-2 py-0.5 rounded-full font-bold font-mono ${
                            mod > 0
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : mod < 0
                              ? 'bg-rose-50 text-rose-700 border border-rose-200'
                              : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          调整值 {modSign}
                        </span>
                      </div>

                      {/* Number controller */}
                      <div className="flex items-center justify-between bg-slate-50 p-1 rounded-xl border border-slate-200">
                        <button
                          type="button"
                          onClick={() => adjustAttribute(attr.key, -1)}
                          className="w-8 h-8 rounded-lg bg-white hover:bg-slate-200 text-slate-700 flex items-center justify-center font-bold text-sm shadow-xs transition-colors cursor-pointer"
                        >
                          <Minus className="w-3.5 h-3.5" />
                        </button>
                        <span className="font-mono text-base font-bold text-slate-900">{val}</span>
                        <button
                          type="button"
                          onClick={() => adjustAttribute(attr.key, 1)}
                          className="w-8 h-8 rounded-lg bg-white hover:bg-slate-200 text-slate-700 flex items-center justify-center font-bold text-sm shadow-xs transition-colors cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <div className="text-[10px] text-slate-400 line-clamp-1">{attr.description}</div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Skill Proficiencies */}
            <div className="space-y-2.5 pt-1">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <label className="text-xs font-bold text-slate-800">
                    技能库清单
                  </label>
                  <span className="text-[11px] text-slate-500">
                    点击勾选熟练（已选 <span className="font-bold text-sky-600">{proficientSkills.length}</span> 项）
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setIsAddingSkill((prev) => !prev)}
                  className="px-2.5 py-1 rounded-lg bg-sky-50 hover:bg-sky-100 text-sky-700 text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>{isAddingSkill ? '收起表单' : '添加技能'}</span>
                </button>
              </div>

              {/* Skills Container: CSS selector 2 */}
              <div className="w-full overflow-x-hidden">
                {/* Inline Add Skill Box */}
                {isAddingSkill && (
                  <div className="p-3 bg-sky-50/70 border border-sky-200 rounded-2xl mb-3 space-y-2 animate-in fade-in duration-150">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-sky-900 flex items-center gap-1">
                        <Sparkles className="w-3.5 h-3.5 text-sky-500" />
                        添加新技能
                      </span>
                      <button
                        type="button"
                        onClick={() => setIsAddingSkill(false)}
                        className="text-slate-400 hover:text-slate-600 text-xs p-1 rounded-md cursor-pointer"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-600 mb-1">
                          技能名称
                        </label>
                        <input
                          type="text"
                          value={newSkillName}
                          onChange={(e) => setNewSkillName(e.target.value)}
                          placeholder="如：潜行、欺瞒"
                          className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-sky-500 font-medium"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-600 mb-1">
                          关联属性
                        </label>
                        <select
                          value={newSkillAttrKey || selectedRuleset.attributes[0]?.key || 'str'}
                          onChange={(e) => setNewSkillAttrKey(e.target.value)}
                          className="w-full px-2 py-1.5 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-sky-500 font-medium text-slate-700 cursor-pointer"
                        >
                          {selectedRuleset.attributes.map((a) => (
                            <option key={a.key} value={a.key}>
                              {a.name} ({a.abbr})
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-600 mb-1">
                          描述效果（全预览展示）
                        </label>
                        <input
                          type="text"
                          value={newSkillDesc}
                          onChange={(e) => setNewSkillDesc(e.target.value)}
                          placeholder="如：野外追踪、识破痕迹"
                          className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-sky-500 font-medium"
                        />
                      </div>
                    </div>

                    <div className="flex justify-end gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => setIsAddingSkill(false)}
                        className="px-3 py-1 text-xs text-slate-500 hover:bg-slate-200/50 rounded-lg cursor-pointer transition-colors"
                      >
                        取消
                      </button>
                      <button
                        type="button"
                        onClick={handleAddCustomSkill}
                        className="px-3.5 py-1 text-xs font-bold bg-sky-500 hover:bg-sky-600 text-white rounded-lg shadow-xs cursor-pointer transition-colors"
                      >
                        确认添加
                      </button>
                    </div>
                  </div>
                )}

                {/* CSS selector 1: All skills in full preview sequential vertical list */}
                {customSkills.length === 0 ? (
                  <div className="p-4 rounded-xl border border-dashed border-slate-200 text-center text-xs text-slate-400">
                    暂无技能，点击右上角「添加技能」即可录入
                  </div>
                ) : (
                  <div className="w-full flex flex-col gap-2 overflow-x-hidden">
                    {customSkills.map((s) => {
                      const isChecked = proficientSkills.includes(s.id);
                      const attrDef = selectedRuleset.attributes.find((a) => a.key === s.attributeKey);
                      const attrName = attrDef?.name || s.attributeKey;
                      const cleanDesc = s.description
                        ? s.description.startsWith('（') || s.description.startsWith('(')
                          ? s.description
                          : `（${s.description}）`
                        : '（通用检定）';

                      return (
                        <div
                          key={s.id}
                          onClick={() => toggleSkill(s.id)}
                          className={`w-full p-3 rounded-2xl border transition-all cursor-pointer flex flex-col gap-1.5 select-none ${
                            isChecked
                              ? 'border-sky-500 bg-sky-50/80 shadow-xs ring-1 ring-sky-400'
                              : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/80'
                          }`}
                        >
                          {/* 第一行：技能名  关联属性 */}
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span
                                className={`text-xs sm:text-sm font-bold ${
                                  isChecked ? 'text-sky-950 font-black' : 'text-slate-800'
                                }`}
                              >
                                {s.name}
                              </span>
                              <span
                                className={`text-[11px] px-2 py-0.5 rounded-md font-semibold shrink-0 ${
                                  isChecked
                                    ? 'bg-sky-200/90 text-sky-800 font-bold'
                                    : 'bg-slate-100 text-slate-600'
                                }`}
                              >
                                {attrName}
                              </span>
                            </div>

                            <div className="flex items-center gap-2 shrink-0">
                              {isChecked && (
                                <span className="text-[11px] font-bold text-sky-700 bg-sky-100/90 border border-sky-200 px-2 py-0.5 rounded-full flex items-center gap-1">
                                  <Check className="w-3.5 h-3.5 text-sky-600 stroke-[2.5]" />
                                  <span>熟练</span>
                                </span>
                              )}
                              <button
                                type="button"
                                title="删除此技能"
                                onClick={(e) => handleDeleteSkill(s.id, e)}
                                className="p-1 rounded-md text-slate-300 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>

                          {/* 第二行：描述全预览展示，绝不截断 */}
                          <div
                            className={`text-xs leading-relaxed ${
                              isChecked ? 'text-sky-800 font-medium' : 'text-slate-500'
                            }`}
                          >
                            {cleanDesc}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Bottom Actions Bar */}
        <div className="px-5 py-3.5 border-t border-slate-100 bg-slate-50 flex items-center justify-between shrink-0">
          {currentStep === 'setup' ? (
            <>
              <div className="text-xs text-slate-500">
                主角：<span className="font-bold text-slate-800">{protagonistName}</span>
                {selectedCompanionCardIds.length > 0 && (
                  <span className="ml-2 text-emerald-700 font-medium">
                    (含 {selectedCompanionCardIds.length} 位同伴)
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-3.5 py-2 text-xs font-medium text-slate-500 hover:bg-slate-200/60 rounded-xl transition-colors cursor-pointer"
                >
                  取消
                </button>
                <button
                  type="button"
                  onClick={() => setCurrentStep('attributes')}
                  className="px-5 py-2 rounded-xl bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-600 hover:to-indigo-700 text-white text-xs font-bold shadow-md shadow-sky-200 flex items-center gap-1.5 cursor-pointer active:scale-95 transition-all"
                >
                  <span>下一步：调整数值</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => setCurrentStep('setup')}
                className="px-3.5 py-2 text-xs font-medium text-slate-600 hover:bg-slate-200 rounded-xl transition-colors flex items-center gap-1 cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>返回上一步</span>
              </button>

              <button
                type="button"
                onClick={handleLaunchCampaign}
                className="px-6 py-2 rounded-xl bg-gradient-to-r from-amber-500 via-orange-500 to-indigo-600 hover:opacity-95 text-white text-xs font-bold shadow-md shadow-amber-200 flex items-center gap-1.5 cursor-pointer active:scale-95 transition-all"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>确认数值，开启跑团</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Ruleset Configuration Modal */}
      {editingRuleset && (
        <TRPGRulesetModal
          isOpen={true}
          ruleset={editingRuleset}
          onClose={() => setEditingRuleset(null)}
          onSave={(saved) => {
            setRulesets(loadTRPGRulesets());
            setSelectedRuleset(saved);
          }}
        />
      )}
    </div>
  );
};
