import React, { useState, useEffect } from 'react';
import {
  X,
  Sparkles,
  User,
  Users,
  Compass,
  Sliders,
  Heart,
  Shield,
  Skull,
  Zap,
  Brain,
  Plus,
  Trash2,
  Check,
  BookOpen,
  SlidersHorizontal,
  Loader2,
} from 'lucide-react';
import {
  CharacterCard,
  WorldBook,
  SystemPreset,
  GameStatDefinition,
  StorySave,
  WordCountOption,
  UserMask,
  CharacterRoleType,
  AppSettings,
  StoryMode,
} from '../types';
import { DEFAULT_INITIAL_STATS } from '../utils/defaultData';
import { loadSettings } from '../utils/storage';
import { polishStorySetup, batchEvaluateCharacterStats } from '../utils/aiService';

interface NewStoryModalProps {
  isOpen: boolean;
  characters: CharacterCard[];
  worldbooks: WorldBook[];
  presets: SystemPreset[];
  userMasks?: UserMask[];
  activeUserMaskId?: string | null;
  initialMode?: StoryMode;
  onClose: () => void;
  onCreateStory: (save: StorySave) => void;
}

export const NewStoryModal: React.FC<NewStoryModalProps> = ({
  isOpen,
  characters,
  worldbooks,
  presets,
  userMasks = [],
  activeUserMaskId,
  initialMode,
  onClose,
  onCreateStory,
}) => {
  const [mode, setMode] = useState<StoryMode>(initialMode || 'single');

  useEffect(() => {
    if (isOpen) {
      const target = initialMode || 'single';
      setMode(target);
      if (target === 'novel') {
        setTargetWordCount('long');
        setStatsTrackingEnabled(false);
        const novelPreset = presets.find((p) => p.id === 'preset-immersive-novel');
        if (novelPreset) {
          setSelectedPresetIds([novelPreset.id]);
        }
      } else {
        setStatsTrackingEnabled(true);
      }
    }
  }, [isOpen, initialMode, presets]);

  const handleSelectMode = (newMode: StoryMode) => {
    setMode(newMode);
    if (newMode === 'novel') {
      setTargetWordCount('long');
      setStatsTrackingEnabled(false);
      const novelPreset = presets.find((p) => p.id === 'preset-immersive-novel');
      if (novelPreset) {
        setSelectedPresetIds([novelPreset.id]);
      }
    } else {
      setStatsTrackingEnabled(true);
    }
  };

  const [selectedCharacterId, setSelectedCharacterId] = useState<string>(characters[0]?.id || '');
  const [selectedMultiCharIds, setSelectedMultiCharIds] = useState<string[]>(
    characters.slice(0, 2).map((c) => c.id)
  );

  // Multi-character role tier management (主角 / 配角 / 群演)
  const [roleFilter, setRoleFilter] = useState<'protagonist' | 'supporting' | 'extra' | 'all'>('protagonist');
  const [characterRoleMap, setCharacterRoleMap] = useState<Record<string, CharacterRoleType>>(() => {
    const initialMap: Record<string, CharacterRoleType> = {};
    characters.forEach((c, idx) => {
      initialMap[c.id] = c.roleType || (idx === 0 ? 'protagonist' : idx < 3 ? 'supporting' : 'extra');
    });
    return initialMap;
  });

  const [title, setTitle] = useState('');
  const [openingPremise, setOpeningPremise] = useState('');
  const [writingGuidance, setWritingGuidance] = useState('');

  // Novel project specific state
  const [novelGenre, setNovelGenre] = useState('玄幻修真');
  const [novelOutline, setNovelOutline] = useState('');
  const [novelFirstChapterDirective, setNovelFirstChapterDirective] = useState('');
  const [novelTargetWordCount, setNovelTargetWordCount] = useState(2500);

  // AI Polish Story Setup state
  const [aiDraftInput, setAiDraftInput] = useState('');
  const [isPolishing, setIsPolishing] = useState(false);
  const [polishSuccess, setPolishSuccess] = useState(false);
  const [polishError, setPolishError] = useState<string | null>(null);

  // Worldbooks & Presets multi-select
  const [selectedWorldBookIds, setSelectedWorldBookIds] = useState<string[]>(
    worldbooks[0]?.id ? [worldbooks[0].id] : []
  );
  const [selectedPresetIds, setSelectedPresetIds] = useState<string[]>(
    presets[0]?.id ? [presets[0].id] : []
  );
  const [selectedUserMaskId, setSelectedUserMaskId] = useState<string>(
    activeUserMaskId || userMasks[0]?.id || ''
  );

  // Features
  const [userMaskEnabled, setUserMaskEnabled] = useState(true);
  const [innerVoiceEnabled, setInnerVoiceEnabled] = useState(true);
  const [branchChoicesEnabled, setBranchChoicesEnabled] = useState(true);
  const [statsTrackingEnabled, setStatsTrackingEnabled] = useState(true);
  const [corruptionConstraintEnabled, setCorruptionConstraintEnabled] = useState(true);
  const [targetWordCount, setTargetWordCount] = useState<WordCountOption>('medium');

  // Stats setup
  const [stats, setStats] = useState<GameStatDefinition[]>(() =>
    DEFAULT_INITIAL_STATS.map((s) => ({ ...s, enabled: true }))
  );

  // New custom stat inputs
  const [showAddCustomStat, setShowAddCustomStat] = useState(false);
  const [customStatName, setCustomStatName] = useState('');
  const [customStatInitial, setCustomStatInitial] = useState(50);
  const [customStatMin, setCustomStatMin] = useState(0);
  const [customStatMax, setCustomStatMax] = useState(100);

  // AI Initial Stat Assignment State
  const [isAiEvaluatingInitialStats, setIsAiEvaluatingInitialStats] = useState(false);
  const [aiEvaluatedStatsMap, setAiEvaluatedStatsMap] = useState<Record<string, GameStatDefinition[]>>({});
  const [aiInitialStatFeedback, setAiInitialStatFeedback] = useState<string | null>(null);

  const handleAiInitStats = async () => {
    const activeCharIds =
      mode === 'single'
        ? selectedCharacterId
          ? [selectedCharacterId]
          : []
        : selectedMultiCharIds;
    const selectedChars = characters.filter((c) => activeCharIds.includes(c.id));
    if (selectedChars.length === 0) {
      setAiInitialStatFeedback('请先在上方勾选至少一名登场角色');
      return;
    }

    setIsAiEvaluatingInitialStats(true);
    setAiInitialStatFeedback(null);
    const settings = loadSettings();
    const selectedWbs = worldbooks.filter((w) => selectedWorldBookIds.includes(w.id));

    const res = await batchEvaluateCharacterStats({
      characters: selectedChars,
      worldbooks: selectedWbs,
      roleMap: characterRoleMap,
      contextMessages: [],
      openingPremise: openingPremise.trim(),
      storyTitle: title.trim(),
      currentStats: stats,
      provider: settings.provider,
      model: settings.model,
      customApiKey: settings.customApiKey,
      customEndpoint: settings.customEndpoint,
    });

    setIsAiEvaluatingInitialStats(false);
    if (!res.success || !res.data?.evaluations) {
      setAiInitialStatFeedback(res.error || 'AI 赋初值失败，请检查设置');
      return;
    }

    const newMap: Record<string, GameStatDefinition[]> = {};
    res.data.evaluations.forEach((evalItem) => {
      const charStats: GameStatDefinition[] = [];
      evalItem.evaluatedStats.forEach((st) => {
        const base = stats.find((s) => s.name === st.name);
        charStats.push({
          id: base?.id || `stat-${st.name}-${Date.now()}`,
          name: st.name,
          initialValue: st.suggestedValue,
          currentValue: st.suggestedValue,
          minValue: st.minValue ?? base?.minValue ?? 0,
          maxValue: st.maxValue ?? base?.maxValue ?? 100,
          unit: st.unit || base?.unit || '点',
          color: (st.color as any) || base?.color || 'sky',
          enabled: true,
          target: 'character',
          lastDelta: 0,
        });
      });
      (evalItem.suggestedNewStats || []).forEach((ns) => {
        charStats.push({
          id: `stat-${ns.name}-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
          name: ns.name,
          initialValue: ns.suggestedValue,
          currentValue: ns.suggestedValue,
          minValue: ns.minValue ?? 0,
          maxValue: ns.maxValue ?? 100,
          unit: ns.unit || '点',
          color: (ns.color as any) || 'violet',
          enabled: true,
          target: 'character',
          lastDelta: 0,
        });
      });
      newMap[evalItem.characterId] = charStats;
    });

    setAiEvaluatedStatsMap(newMap);
    setAiInitialStatFeedback(`已成功依据角色卡，为 ${selectedChars.length} 位角色定制专属初始数值！`);
  };

  if (!isOpen) return null;

  const quickInspirations = [
    {
      title: '暴风雪废墟初遇',
      premise:
        '在极北冰封荒原的凛冬暴风雪中，你为了躲避严寒，跌跌撞撞推开了半掩的旧日修道院石门。火堆旁，一道警惕的冷冽目光立刻锁定在你的咽喉上。',
    },
    {
      title: '空间站逃生舱迫降',
      premise:
        '轨道防御警报凄厉尖鸣，你所在的逃生舱因过载迫降在未知星区的废弃对接港。伴随气阀泄压的白雾散去，舱门外站着正在进行机体自检的神秘存在。',
    },
    {
      title: '山道古刹避雨相逢',
      premise:
        '暮色沉沉，暴雨倾盆。你循着残破的山道奔入一处半塌的古刹正殿。神像残躯下早已燃起一簇枯枝野火，青衫少年随性倚着石柱，轻叩剑鞘，漫不经心抬眼打量你。',
    },
  ];

  const handleApplyInspiration = (insp: { title: string; premise: string }) => {
    setTitle(insp.title);
    setOpeningPremise(insp.premise);
  };

  const handleAIPolishSetup = async () => {
    if (!aiDraftInput.trim() || isPolishing) return;
    setIsPolishing(true);
    setPolishError(null);
    setPolishSuccess(false);

    try {
      const settings: AppSettings = loadSettings();

      // Gather active characters
      const charIds =
        mode === 'single'
          ? selectedCharacterId
            ? [selectedCharacterId]
            : []
          : selectedMultiCharIds;
      const activeCharObjs = characters.filter((c) => charIds.includes(c.id));
      const activeWbObjs = worldbooks.filter((wb) => selectedWorldBookIds.includes(wb.id));

      const result = await polishStorySetup({
        userInput: aiDraftInput.trim(),
        characters: activeCharObjs,
        worldbooks: activeWbObjs,
        roleMap: mode === 'multi' ? characterRoleMap : undefined,
        provider: settings.provider,
        model: settings.model,
        customApiKey: settings.customApiKey,
        customEndpoint: settings.customEndpoint,
      });

      if (!result.success || !result.data) {
        throw new Error(result.error || 'AI 润色返回格式异常');
      }

      const { title: newTitle, openingPremise: newPremise, writingGuidance: newGuidance } = result.data;

      if (newTitle) setTitle(newTitle.trim());
      if (newPremise) setOpeningPremise(newPremise.trim());
      if (newGuidance) setWritingGuidance(newGuidance.trim());

      setPolishSuccess(true);
      setTimeout(() => setPolishSuccess(false), 5000);
    } catch (err: any) {
      console.error('AI polish story setup error:', err);
      setPolishError(err.message || '润色解析失败，请检查设置中的 API Key 或网络');
    } finally {
      setIsPolishing(false);
    }
  };

  const handleToggleStat = (statId: string) => {
    setStats(stats.map((s) => (s.id === statId ? { ...s, enabled: !s.enabled } : s)));
  };

  const handleStatValueChange = (statId: string, val: number) => {
    setStats(
      stats.map((s) =>
        s.id === statId
          ? {
              ...s,
              initialValue: Math.max(s.minValue, Math.min(s.maxValue, val)),
              currentValue: Math.max(s.minValue, Math.min(s.maxValue, val)),
            }
          : s
      )
    );
  };

  const handleAddCustomStat = () => {
    if (!customStatName.trim()) return;
    const newStat: GameStatDefinition = {
      id: `stat-custom-${Date.now()}`,
      name: customStatName.trim(),
      initialValue: customStatInitial,
      currentValue: customStatInitial,
      minValue: customStatMin,
      maxValue: customStatMax,
      unit: '点',
      color: 'violet',
      enabled: true,
      target: 'character',
    };
    setStats([...stats, newStat]);
    setCustomStatName('');
    setShowAddCustomStat(false);
  };

  const handleDeleteStat = (statId: string) => {
    setStats(stats.filter((s) => s.id !== statId));
  };

  const getCharRole = (charId: string): CharacterRoleType => {
    return characterRoleMap[charId] || 'supporting';
  };

  const handleCardClick = (charId: string) => {
    if (mode === 'single') {
      setSelectedCharacterId(charId);
      return;
    }

    const isSelected = selectedMultiCharIds.includes(charId);
    const currentRole = characterRoleMap[charId] || 'supporting';

    if (roleFilter === 'all') {
      if (isSelected) {
        setSelectedMultiCharIds((prev) => prev.filter((id) => id !== charId));
      } else {
        setSelectedMultiCharIds((prev) => [...prev, charId]);
        if (!characterRoleMap[charId]) {
          setCharacterRoleMap((prev) => ({ ...prev, [charId]: 'supporting' }));
        }
      }
    } else {
      const targetRole = roleFilter;
      // If currently selected with this exact role, click to unselect
      if (isSelected && currentRole === targetRole) {
        setSelectedMultiCharIds((prev) => prev.filter((id) => id !== charId));
      } else {
        // If not selected, or selected under another role, assign to targetRole and select
        setCharacterRoleMap((prev) => ({ ...prev, [charId]: targetRole }));
        if (!isSelected) {
          setSelectedMultiCharIds((prev) => [...prev, charId]);
        }
      }
    }
  };

  const handleSelectAllInRole = () => {
    if (roleFilter === 'all') {
      const newMap = { ...characterRoleMap };
      characters.forEach((c) => {
        if (!newMap[c.id]) newMap[c.id] = 'supporting';
      });
      setCharacterRoleMap(newMap);
      setSelectedMultiCharIds(characters.map((c) => c.id));
    } else {
      const targetRole = roleFilter;
      const newMap = { ...characterRoleMap };
      characters.forEach((c) => {
        newMap[c.id] = targetRole;
      });
      setCharacterRoleMap(newMap);
      setSelectedMultiCharIds(characters.map((c) => c.id));
    }
  };

  const handleClearInRole = () => {
    if (roleFilter === 'all') {
      setSelectedMultiCharIds([]);
    } else {
      const targetRole = roleFilter;
      setSelectedMultiCharIds((prev) =>
        prev.filter((id) => (characterRoleMap[id] || 'supporting') !== targetRole)
      );
    }
  };

  const handleToggleWorldBook = (wbId: string) => {
    setSelectedWorldBookIds((prev) =>
      prev.includes(wbId) ? prev.filter((id) => id !== wbId) : [...prev, wbId]
    );
  };

  const handleTogglePreset = (presetId: string) => {
    setSelectedPresetIds((prev) =>
      prev.includes(presetId)
        ? prev.filter((id) => id !== presetId)
        : [...prev, presetId]
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const charIds =
      mode === 'single'
        ? selectedCharacterId
          ? [selectedCharacterId]
          : []
        : selectedMultiCharIds;
    if (charIds.length === 0 || !charIds[0]) {
      alert('请先创建并选择至少一个角色');
      return;
    }

    const effectiveTitle =
      title.trim() ||
      (mode === 'novel'
        ? `长篇小说·${new Date().toLocaleDateString('zh-CN')}`
        : `${
            mode === 'single'
              ? characters.find((c) => c.id === charIds[0])?.name || '未知'
              : '群像'
          }之行·${new Date().toLocaleDateString('zh-CN')}`);

    const effectivePremise =
      mode === 'novel'
        ? novelOutline.trim() || openingPremise.trim() || '（大纲构思中）'
        : openingPremise.trim() ||
          '狂风卷起荒原上的冰冷砂砾，命运的齿轮在这一刻悄然咬合。你迈开脚步，向眼前未知而危险的境遇投身而去。';

    const finalStats: GameStatDefinition[] = [];
    charIds.forEach((cId) => {
      const charObj = characters.find((c) => c.id === cId);
      const charName = charObj?.name || '角色';
      const evaluatedForChar = aiEvaluatedStatsMap[cId];
      if (evaluatedForChar && evaluatedForChar.length > 0) {
        evaluatedForChar.forEach((s) => {
          finalStats.push({
            ...s,
            id: `${s.id}-${cId}`,
            characterId: cId,
            characterName: charName,
            enabled: statsTrackingEnabled ? s.enabled : false,
          });
        });
      } else {
        stats.forEach((s) => {
          finalStats.push({
            ...s,
            id: `${s.id}-${cId}`,
            characterId: cId,
            characterName: charName,
            enabled: statsTrackingEnabled ? s.enabled : false,
          });
        });
      }
    });

    const newSave: StorySave = {
      id: `save-${Date.now()}`,
      title: effectiveTitle,
      summary: (mode === 'novel' ? novelOutline || effectivePremise : effectivePremise).slice(0, 160),
      mode,
      characterIds: charIds,
      characterRoleMap: mode !== 'single' ? characterRoleMap : undefined,
      worldBookId: selectedWorldBookIds[0] || undefined,
      worldBookIds: selectedWorldBookIds,
      presetId:
        selectedPresetIds[0] ||
        (mode === 'novel'
          ? presets.find((p) => p.id === 'preset-immersive-novel')?.id || presets[0]?.id
          : presets[0]?.id) ||
        'preset-default',
      presetIds:
        selectedPresetIds.length > 0
          ? selectedPresetIds
          : presets[0]?.id
          ? [presets[0].id]
          : ['preset-default'],
      openingPremise: effectivePremise,
      messages: [],
      stats: finalStats,
      config: {
        innerVoiceEnabled: mode === 'novel' ? false : innerVoiceEnabled,
        branchChoicesEnabled: mode === 'novel' ? false : branchChoicesEnabled,
        statsTrackingEnabled: mode === 'novel' ? false : Boolean(statsTrackingEnabled),
        corruptionConstraintEnabled,
        userMaskEnabled: mode === 'novel' ? false : userMaskEnabled,
        targetWordCount,
        wordCountConstraintEnabled: false,
        wordCountMin: 300,
        wordCountMax: 800,
        narrativePerspective: 'third',
        antiImpersonationEnabled: true,
        playMode: 'dialogue',
        writingGuidance: writingGuidance.trim(),
      },
      userMaskId: userMaskEnabled ? selectedUserMaskId || undefined : undefined,
      disabledCharacterStatIds: !statsTrackingEnabled ? [...charIds] : [],
      recalcPendingCharacterIds: [],
      novelProject:
        mode === 'novel'
          ? {
              id: `novel-${Date.now()}`,
              title: effectiveTitle,
              summary: (novelOutline || effectivePremise).slice(0, 200),
              genre: novelGenre.trim() || '玄幻修真',
              targetWordCountPerChapter: novelTargetWordCount || 2500,
              globalGuidance: writingGuidance.trim() || '',
              characterIds: charIds,
              worldBookIds: selectedWorldBookIds,
              presetId: selectedPresetIds[0] || presets[0]?.id || 'preset-immersive-novel',
              outline: novelOutline.trim(),
              timeline: [],
              chapters: [
                {
                  id: `chap-${Date.now()}-1`,
                  order: 1,
                  title: '第1章',
                  content: '',
                  summary: (novelOutline || effectivePremise).slice(0, 200),
                  directive: novelFirstChapterDirective.trim(),
                  status: 'draft',
                  versions: [],
                  createdAt: Date.now(),
                  updatedAt: Date.now(),
                },
              ],
              activeChapterId: `chap-${Date.now()}-1`,
              createdAt: Date.now(),
              updatedAt: Date.now(),
            }
          : undefined,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    onCreateStory(newSave);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/40 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="w-full max-w-xl bg-white rounded-2xl shadow-xl border border-sky-100 flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-slate-800">
              {mode === 'novel' ? '新建小说模式开档' : mode === 'multi' ? '新建群像文游开档' : '新建文游开档'}
            </span>
            {mode === 'novel' && (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 font-medium">
                新模式 · 沉浸长篇
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="overflow-y-auto p-5 space-y-4 text-xs">
          {/* Mode Selector */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block font-medium text-slate-700">开档模式</label>
              {mode === 'novel' && (
                <span className="text-[10px] text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full font-medium border border-indigo-100">
                  长篇小说连载 · 章节起伏与文学质感
                </span>
              )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => handleSelectMode('single')}
                className={`p-2.5 sm:p-3 rounded-xl border flex items-center gap-2.5 transition-all text-left cursor-pointer ${
                  mode === 'single'
                    ? 'border-sky-400 bg-sky-50/60 text-sky-800 ring-1 ring-sky-300'
                    : 'border-slate-200 hover:border-slate-300 bg-white text-slate-600'
                }`}
              >
                <div className="w-8 h-8 rounded-lg bg-sky-100 text-sky-600 flex items-center justify-center shrink-0">
                  <User className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <div className="font-semibold text-xs text-slate-800">单人专属角色档</div>
                  <div className="text-[10px] text-slate-400 truncate">单角色深度沉浸互动</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => handleSelectMode('multi')}
                className={`p-2.5 sm:p-3 rounded-xl border flex items-center gap-2.5 transition-all text-left cursor-pointer ${
                  mode === 'multi'
                    ? 'border-sky-400 bg-sky-50/60 text-sky-800 ring-1 ring-sky-300'
                    : 'border-slate-200 hover:border-slate-300 bg-white text-slate-600'
                }`}
              >
                <div className="w-8 h-8 rounded-lg bg-sky-100 text-sky-600 flex items-center justify-center shrink-0">
                  <Users className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <div className="font-semibold text-xs text-slate-800">多人世界群像档</div>
                  <div className="text-[10px] text-slate-400 truncate">多角色同台交互剧情</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => handleSelectMode('novel')}
                className={`p-2.5 sm:p-3 rounded-xl border flex items-center gap-2.5 transition-all text-left cursor-pointer ${
                  mode === 'novel'
                    ? 'border-indigo-400 bg-gradient-to-br from-indigo-50/90 to-purple-50/40 text-indigo-900 ring-1 ring-indigo-300'
                    : 'border-slate-200 hover:border-indigo-200 bg-white text-slate-600'
                }`}
              >
                <div className="w-8 h-8 rounded-lg bg-indigo-100 text-indigo-600 flex items-center justify-center shrink-0">
                  <BookOpen className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <div className="font-semibold text-xs text-slate-800 flex items-center gap-1">
                    <span>新建小说模式</span>
                    <span className="text-[9px] px-1 py-0.2 rounded-full bg-indigo-100 text-indigo-700 font-medium shrink-0">
                      新模式
                    </span>
                  </div>
                  <div className="text-[10px] text-indigo-500/80 truncate">沉浸连载·长篇推演</div>
                </div>
              </button>
            </div>
          </div>

          {/* Character selection */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="block font-medium text-slate-700 text-xs">
                {mode === 'single'
                  ? '选择互动角色'
                  : mode === 'novel'
                  ? '选择登场角色（主角 / 配角 / 群演）'
                  : '选择入局角色（可多选）'}
              </label>
              {mode !== 'single' && (
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-semibold text-sky-600 bg-sky-50 px-1.5 py-0.5 rounded-full border border-sky-100">
                    已选 {selectedMultiCharIds.length} 人
                  </span>
                  <button
                    type="button"
                    onClick={handleSelectAllInRole}
                    className="text-[10px] text-sky-600 hover:text-sky-700 hover:underline cursor-pointer font-medium"
                  >
                    一键全选
                  </button>
                  <span className="text-slate-200 text-[10px]">|</span>
                  <button
                    type="button"
                    onClick={handleClearInRole}
                    className="text-[10px] text-slate-400 hover:text-rose-600 hover:underline cursor-pointer font-medium"
                  >
                    一键清除
                  </button>
                </div>
              )}
            </div>

            {/* Role Tabs (按主角/配角/群演按钮往下选角色卡) */}
            {mode !== 'single' && (
              <div className="space-y-1">
                <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl text-[11px]">
                  {[
                    {
                      key: 'protagonist',
                      label: '👑 主角',
                      count: selectedMultiCharIds.filter(
                        (id) => (characterRoleMap[id] || 'supporting') === 'protagonist'
                      ).length,
                    },
                    {
                      key: 'supporting',
                      label: '⭐ 配角',
                      count: selectedMultiCharIds.filter(
                        (id) => (characterRoleMap[id] || 'supporting') === 'supporting'
                      ).length,
                    },
                    {
                      key: 'extra',
                      label: '🎭 群演',
                      count: selectedMultiCharIds.filter(
                        (id) => characterRoleMap[id] === 'extra'
                      ).length,
                    },
                    {
                      key: 'all',
                      label: '全部已选',
                      count: selectedMultiCharIds.length,
                    },
                  ].map((tab) => {
                    const isActive = roleFilter === tab.key;
                    return (
                      <button
                        key={tab.key}
                        type="button"
                        onClick={() => setRoleFilter(tab.key as any)}
                        className={`flex-1 py-1 rounded-lg font-medium transition-all cursor-pointer text-center ${
                          isActive
                            ? 'bg-white text-slate-800 shadow-2xs font-semibold'
                            : 'text-slate-500 hover:text-slate-700'
                        }`}
                      >
                        <span>{tab.label}</span>
                        <span className="ml-1 text-[9px] opacity-70">({tab.count})</span>
                      </button>
                    );
                  })}
                </div>
                <div className="text-[10px] text-slate-400 px-1 flex items-center justify-between">
                  <span>
                    {roleFilter === 'protagonist' &&
                      (mode === 'novel'
                        ? '👉 当前选择【小说主角】：核心叙事视点与高光聚焦，承载主线'
                        : '👉 当前选择【主角】：点击下方角色卡将其选为主角（戏份核心聚焦）')}
                    {roleFilter === 'supporting' &&
                      (mode === 'novel'
                        ? '👉 当前选择【关键配角】：重要剧情推演与因果转折，推动情节发展'
                        : '👉 当前选择【配角】：点击下方角色卡将其选为配角（推动剧情与冲突）')}
                    {roleFilter === 'extra' &&
                      (mode === 'novel'
                        ? '👉 当前选择【场景群演】：时代背景与市井氛围描摹，点到即止'
                        : '👉 当前选择【群演】：点击下方角色卡将其选为群演（场景氛围烘托）')}
                    {roleFilter === 'all' && '👉 全部角色概览：点击角色卡可切换选入/移出'}
                  </span>
                </div>
              </div>
            )}

            {/* Character Cards Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-44 overflow-y-auto p-1">
              {characters.length === 0 ? (
                <div className="col-span-full py-5 text-center text-slate-400 text-xs bg-slate-50/70 rounded-xl border border-dashed border-slate-200 p-3">
                  暂无角色卡，请先前往底栏「创作」模块新建角色卡
                </div>
              ) : (
                characters.map((char) => {
                  const isSelected =
                    mode === 'single'
                      ? selectedCharacterId === char.id
                      : selectedMultiCharIds.includes(char.id);
                  const role = getCharRole(char.id);

                  const cardStyle = isSelected
                    ? role === 'protagonist'
                      ? 'border-amber-400 bg-amber-50/60 text-amber-950 shadow-2xs ring-1 ring-amber-300'
                      : role === 'extra'
                      ? 'border-slate-400 bg-slate-100/80 text-slate-800 shadow-2xs ring-1 ring-slate-300'
                      : 'border-sky-400 bg-sky-50/60 text-sky-950 shadow-2xs ring-1 ring-sky-300'
                    : 'border-slate-200 hover:border-slate-300 bg-white text-slate-600';

                  return (
                    <div
                      key={char.id}
                      onClick={() => handleCardClick(char.id)}
                      className={`p-2 rounded-xl border flex items-center gap-2 cursor-pointer transition-all ${cardStyle}`}
                    >
                      <div className="w-8 h-8 rounded-lg bg-sky-100 text-sky-700 flex items-center justify-center font-bold text-xs shrink-0 overflow-hidden border border-sky-200">
                        {char.avatarImage ? (
                          <img src={char.avatarImage} alt={char.name} className="w-full h-full object-cover" />
                        ) : (
                          <span>{char.name.slice(0, 1)}</span>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="font-semibold truncate text-[11px] flex items-center justify-between">
                          <span className="truncate">{char.name}</span>
                          {mode === 'single' ? (
                            isSelected && (
                              <span className="w-3.5 h-3.5 rounded-full bg-sky-500 text-white flex items-center justify-center shrink-0 ml-1">
                                <Check className="w-2.5 h-2.5" />
                              </span>
                            )
                          ) : (
                            isSelected && (
                              <span
                                className={`text-[9px] px-1 py-0.2 rounded font-medium flex items-center gap-0.5 shrink-0 ml-1 border ${
                                  role === 'protagonist'
                                    ? 'bg-amber-100 text-amber-800 border-amber-200 font-bold'
                                    : role === 'extra'
                                    ? 'bg-slate-200 text-slate-700 border-slate-300 font-bold'
                                    : 'bg-sky-100 text-sky-800 border-sky-200 font-bold'
                                }`}
                              >
                                <Check className="w-2.5 h-2.5" />
                                {role === 'protagonist' ? '主角' : role === 'extra' ? '群演' : '配角'}
                              </span>
                            )
                          )}
                        </div>
                        <div className="text-[10px] text-slate-400 truncate">{char.identity || '角色'}</div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* AI 灵感润色 */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="font-medium text-slate-700">开局灵感（选填）</label>
              <button
                type="button"
                disabled={isPolishing || !aiDraftInput.trim()}
                onClick={handleAIPolishSetup}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium flex items-center gap-1 transition-all cursor-pointer ${
                  isPolishing || !aiDraftInput.trim()
                    ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                    : 'bg-sky-500 hover:bg-sky-600 text-white shadow-2xs active:scale-95'
                }`}
              >
                {isPolishing ? (
                  <>
                    <Loader2 className="w-3 h-3 animate-spin" />
                    <span>润色中...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3 h-3" />
                    <span>AI润色</span>
                  </>
                )}
              </button>
            </div>
            <textarea
              rows={3}
              value={aiDraftInput}
              onChange={(e) => setAiDraftInput(e.target.value)}
              placeholder="在此输入你的开局灵感或剧情想法，点击「AI润色」自动提炼并填入下方..."
              className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:border-sky-400 leading-relaxed"
            />
            {polishSuccess && (
              <div className="text-[10px] text-emerald-600 mt-1 flex items-center gap-1">
                <Check className="w-3 h-3" /> 已自动填入下方标题、情境与写作指导
              </div>
            )}
            {polishError && (
              <div className="text-[10px] text-rose-500 mt-1 flex items-center justify-between">
                <span>⚠️ {polishError}</span>
                <button
                  type="button"
                  onClick={() => setPolishError(null)}
                  className="text-rose-400 hover:text-rose-600 cursor-pointer ml-1"
                >
                  ×
                </button>
              </div>
            )}
          </div>

          {mode === 'novel' ? (
            /* ======================================================== */
            /* NOVEL CREATION FORM TEMPLATE                             */
            /* ======================================================== */
            <div className="space-y-4 pt-1">
              {/* Novel Title */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="font-semibold text-slate-800 text-xs flex items-center gap-1.5">
                    <BookOpen className="w-3.5 h-3.5 text-indigo-600" />
                    <span>小说书名</span>
                  </label>
                  <span className="text-[10px] text-slate-400">留空则自动生成典雅书名</span>
                </div>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="例如：《万界星穹录》、《凛冬行者》（选填）"
                  className="w-full px-3 py-2 rounded-xl border border-indigo-200 focus:outline-none focus:ring-1 focus:ring-indigo-400 bg-white text-xs text-slate-800"
                />
              </div>

              {/* Novel Genre */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="font-semibold text-slate-800 text-xs">题材分类</label>
                  <span className="text-[10px] text-indigo-600 font-semibold bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-100">
                    当前: {novelGenre}
                  </span>
                </div>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {['玄幻修真', '仙侠古典', '科幻未来', '奇幻异界', '悬疑惊悚', '都市异能', '武侠江湖', '末日灾变'].map((g) => (
                    <button
                      key={g}
                      type="button"
                      onClick={() => setNovelGenre(g)}
                      className={`px-2.5 py-1 rounded-lg text-[10px] font-medium border transition-colors cursor-pointer ${
                        novelGenre === g
                          ? 'bg-indigo-600 text-white border-indigo-600 shadow-2xs font-semibold'
                          : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-indigo-50 hover:text-indigo-700'
                      }`}
                    >
                      {g}
                    </button>
                  ))}
                </div>
                <input
                  type="text"
                  value={novelGenre}
                  onChange={(e) => setNovelGenre(e.target.value)}
                  placeholder="自定义题材（如：克苏鲁蒸汽朋克、西幻史诗）"
                  className="w-full px-3 py-1.5 rounded-xl border border-slate-200 focus:outline-none focus:border-indigo-400 text-xs bg-slate-50/50"
                />
              </div>

              {/* Story Outline (大纲简要) */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="font-semibold text-slate-800 text-xs flex items-center gap-1">
                    <span>剧情大纲简要 / 核心立意</span>
                    <span className="text-indigo-600">*</span>
                  </label>
                  <span className="text-[10px] text-slate-400">续写时AI将作为主线参考</span>
                </div>
                <textarea
                  rows={4}
                  value={novelOutline}
                  onChange={(e) => setNovelOutline(e.target.value)}
                  placeholder="在此输入故事的核心大纲简要、主线冲突、全书立意或结局设想...&#10;（例如：主角身为破败宗门的最后传人，自极北寒潭苏醒，身负被封印的上古剑灵，踏上清查灭门凶手与追寻天道真相的复仇之路；沿途历经各大古老世家的博弈与上古禁地的大劫...）"
                  className="w-full px-3 py-2 rounded-xl border border-indigo-200 focus:outline-none focus:ring-1 focus:ring-indigo-400 leading-relaxed text-xs resize-none font-sans"
                />
              </div>

              {/* Chapter 1 Directive (第1章走向指令) */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="font-semibold text-slate-800 text-xs">第 1 章开篇走向指令（选填）</label>
                  <span className="text-[10px] text-slate-400">控制起笔情节与破局遭遇</span>
                </div>
                <input
                  type="text"
                  value={novelFirstChapterDirective}
                  onChange={(e) => setNovelFirstChapterDirective(e.target.value)}
                  placeholder="例如：主角在冰棺苏醒，身负重伤之际，惊闻悬崖外传来的追杀者脚步声..."
                  className="w-full px-3 py-1.5 rounded-xl border border-slate-200 focus:outline-none focus:border-indigo-400 text-xs"
                />
              </div>

              {/* Expected Word Count per Chapter */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="font-semibold text-slate-800 text-xs">单章期望字数</label>
                  <span className="text-[10px] text-indigo-600 font-bold">{novelTargetWordCount} 字 / 章</span>
                </div>
                <div className="grid grid-cols-4 gap-2">
                  {[1500, 2000, 2500, 3000].map((wc) => (
                    <button
                      key={wc}
                      type="button"
                      onClick={() => setNovelTargetWordCount(wc)}
                      className={`py-1.5 rounded-xl border text-center text-xs font-semibold cursor-pointer transition-colors ${
                        novelTargetWordCount === wc
                          ? 'bg-indigo-600 text-white border-indigo-600 shadow-2xs'
                          : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      {wc} 字
                    </button>
                  ))}
                </div>
              </div>

              {/* Global Guidance / Rules & Taboos */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="font-semibold text-slate-800 text-xs">全书写作规则与作者禁忌</label>
                  <span className="text-[10px] text-slate-400">约束行文笔触与角色言行</span>
                </div>
                <textarea
                  rows={2}
                  value={writingGuidance}
                  onChange={(e) => setWritingGuidance(e.target.value)}
                  placeholder="例如：冷峻克制的白描手法；环境与感官细节着墨充分；主角心狠手辣但言出必践，拒绝圣母；严禁AI发表人生感悟说教..."
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:border-indigo-400 leading-relaxed text-xs resize-none"
                />
              </div>

              {/* Worldbooks & Presets for Novel */}
              <div className="space-y-3 pt-1 border-t border-slate-100">
                {/* 关联世界书 */}
                <div className="p-3 rounded-xl border border-indigo-100 bg-indigo-50/30 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <BookOpen className="w-3.5 h-3.5 text-indigo-600" />
                      <span className="font-semibold text-slate-800 text-xs">关联世界书与法则资料库</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-indigo-100 text-indigo-700 font-semibold">
                        已选 {selectedWorldBookIds.length} 本
                      </span>
                    </div>
                    {worldbooks.length > 0 && (
                      <div className="flex items-center gap-1 text-[10px]">
                        <button
                          type="button"
                          onClick={() => setSelectedWorldBookIds(worldbooks.map((w) => w.id))}
                          className="text-indigo-600 hover:underline cursor-pointer"
                        >
                          全选
                        </button>
                        <span className="text-slate-300">|</span>
                        <button
                          type="button"
                          onClick={() => setSelectedWorldBookIds([])}
                          className="text-slate-400 hover:text-rose-500 cursor-pointer"
                        >
                          清空
                        </button>
                      </div>
                    )}
                  </div>
                  {worldbooks.length === 0 ? (
                    <div className="py-2 text-center text-slate-400 text-[11px]">
                      暂无世界书，可随时在「创作」中添加
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-1.5 max-h-28 overflow-y-auto pr-0.5">
                      {worldbooks.map((wb) => {
                        const isSelected = selectedWorldBookIds.includes(wb.id);
                        return (
                          <div
                            key={wb.id}
                            onClick={() => handleToggleWorldBook(wb.id)}
                            className={`p-2 rounded-lg border text-left cursor-pointer transition-all flex items-center justify-between gap-1.5 ${
                              isSelected
                                ? 'border-indigo-400 bg-white text-indigo-900 shadow-2xs ring-1 ring-indigo-300'
                                : 'border-slate-200 bg-white/70 text-slate-600 hover:border-slate-300'
                            }`}
                          >
                            <div className="min-w-0 flex-1">
                              <div className="font-semibold text-[11px] truncate">{wb.title}</div>
                              <div className="text-[9px] text-slate-400 truncate">{wb.category} · {wb.entries.length} 设定</div>
                            </div>
                            <div
                              className={`w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0 ${
                                isSelected
                                  ? 'bg-indigo-600 border-indigo-600 text-white'
                                  : 'border-slate-300 bg-white'
                              }`}
                            >
                              {isSelected && <Check className="w-2.5 h-2.5" />}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* 叙事预设模板 */}
                <div className="p-3 rounded-xl border border-indigo-100 bg-indigo-50/30 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <SlidersHorizontal className="w-3.5 h-3.5 text-indigo-600" />
                      <span className="font-semibold text-slate-800 text-xs">长篇小说叙事风格预设</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-indigo-100 text-indigo-700 font-semibold">
                        已选 {selectedPresetIds.length} 个
                      </span>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-1.5 max-h-28 overflow-y-auto pr-0.5">
                    {presets.map((p) => {
                      const isSelected = selectedPresetIds.includes(p.id);
                      return (
                        <div
                          key={p.id}
                          onClick={() => handleTogglePreset(p.id)}
                          className={`p-2 rounded-lg border text-left cursor-pointer transition-all flex items-center justify-between gap-1.5 ${
                            isSelected
                              ? 'border-indigo-400 bg-white text-indigo-900 shadow-2xs ring-1 ring-indigo-300'
                              : 'border-slate-200 bg-white/70 text-slate-600 hover:border-slate-300'
                          }`}
                        >
                          <div className="min-w-0 flex-1">
                            <div className="font-semibold text-[11px] truncate">{p.title}</div>
                            <div className="text-[9px] text-slate-400 truncate">{p.description}</div>
                          </div>
                          <div
                            className={`w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0 ${
                              isSelected
                                ? 'bg-indigo-600 border-indigo-600 text-white'
                                : 'border-slate-300 bg-white'
                            }`}
                          >
                            {isSelected && <Check className="w-2.5 h-2.5" />}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* ======================================================== */
            /* VISUAL NOVEL / RPG INTERACTIVE GAME FORM TEMPLATE        */
            /* ======================================================== */
            <>
              {/* Title & Opening Scenario */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="font-medium text-slate-700">故事存档标题</label>
                </div>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="例如：极地孤影·誓约重燃（留空自动生成）"
              className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:border-sky-400"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="font-medium text-slate-700">
                开局背景与情境设定 <span className="text-rose-500">*</span>
              </label>
              <span className="text-[10px] text-slate-400">可自由编写或使用下方灵感</span>
            </div>
            <textarea
              rows={3}
              required
              value={openingPremise}
              onChange={(e) => setOpeningPremise(e.target.value)}
              placeholder="描述故事开始的发生地点、时间、周围环境、主角处境以及与角色的初遇场景..."
              className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:border-sky-400 leading-relaxed"
            />

            {/* Quick Inspiration Pills */}
            <div className="flex flex-wrap gap-1.5 mt-1.5">
              {quickInspirations.map((insp) => (
                <button
                  key={insp.title}
                  type="button"
                  onClick={() => handleApplyInspiration(insp)}
                  className="px-2 py-1 rounded-lg bg-slate-100 hover:bg-sky-50 hover:text-sky-600 text-slate-600 text-[10px] transition-colors cursor-pointer"
                >
                  ✨ {insp.title}
                </button>
              ))}
            </div>
          </div>

          {/* 本场写作指导 (同步至进场游玩设置) */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="font-medium text-slate-700">本场写作指导</label>
              <span className="text-[10px] text-slate-400">填入您的想法需求，同步至游玩设置</span>
            </div>
            <textarea
              rows={2}
              value={writingGuidance}
              onChange={(e) => setWritingGuidance(e.target.value)}
              placeholder="填入您对本场文游的具体想法需求（如：强化心理描写与环境压迫感、NPC性格冷峻少言、战斗节奏紧凑等）..."
              className="w-full h-[100px] px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:border-sky-400 leading-relaxed text-xs"
            />
          </div>

          {/* World Book & Preset Selection (支持多选) */}
          <div className="space-y-3 pt-1">
            {/* 1. 关联世界书 (可多选) */}
            <div className="p-3 rounded-xl border border-slate-200 bg-slate-50/50 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <BookOpen className="w-3.5 h-3.5 text-sky-500" />
                  <span className="font-medium text-slate-700 text-xs">关联世界书（可多选）</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-sky-100 text-sky-700 font-semibold">
                    已选 {selectedWorldBookIds.length} 本
                  </span>
                </div>
                {worldbooks.length > 0 && (
                  <div className="flex items-center gap-1 text-[10px]">
                    <button
                      type="button"
                      onClick={() => setSelectedWorldBookIds(worldbooks.map((w) => w.id))}
                      className="px-1.5 py-0.5 rounded text-sky-600 hover:bg-sky-100 transition-colors cursor-pointer"
                    >
                      全选
                    </button>
                    <span className="text-slate-300">|</span>
                    <button
                      type="button"
                      onClick={() => setSelectedWorldBookIds([])}
                      className="px-1.5 py-0.5 rounded text-slate-500 hover:text-rose-500 hover:bg-rose-50 transition-colors cursor-pointer"
                    >
                      清空
                    </button>
                  </div>
                )}
              </div>

              {worldbooks.length === 0 ? (
                <div className="py-2 text-center text-slate-400 text-[11px]">
                  暂无世界书，可前往底栏「创作」创建
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-1.5 max-h-28 overflow-y-auto pr-0.5">
                  {worldbooks.map((wb) => {
                    const isSelected = selectedWorldBookIds.includes(wb.id);
                    return (
                      <div
                        key={wb.id}
                        onClick={() => handleToggleWorldBook(wb.id)}
                        className={`p-2 rounded-lg border text-left cursor-pointer transition-all flex items-center justify-between gap-1.5 ${
                          isSelected
                            ? 'border-sky-400 bg-sky-50 text-sky-800 shadow-2xs ring-1 ring-sky-300'
                            : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                        }`}
                      >
                        <div className="min-w-0 flex-1">
                          <div className="font-medium text-[11px] truncate">{wb.title}</div>
                          <div className="text-[9px] text-slate-400 truncate">{wb.category}</div>
                        </div>
                        <div
                          className={`w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0 ${
                            isSelected
                              ? 'bg-sky-500 border-sky-500 text-white'
                              : 'border-slate-300 bg-white'
                          }`}
                        >
                          {isSelected && <Check className="w-2.5 h-2.5" />}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* 2. 叙事预设模板 (可多选) */}
            <div className="p-3 rounded-xl border border-slate-200 bg-slate-50/50 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <SlidersHorizontal className="w-3.5 h-3.5 text-sky-500" />
                  <span className="font-medium text-slate-700 text-xs">叙事预设模板（可多选）</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-sky-100 text-sky-700 font-semibold">
                    已选 {selectedPresetIds.length} 个
                  </span>
                </div>
                {presets.length > 0 && (
                  <div className="flex items-center gap-1 text-[10px]">
                    <button
                      type="button"
                      onClick={() => setSelectedPresetIds(presets.map((p) => p.id))}
                      className="px-1.5 py-0.5 rounded text-sky-600 hover:bg-sky-100 transition-colors cursor-pointer"
                    >
                      全选
                    </button>
                    <span className="text-slate-300">|</span>
                    <button
                      type="button"
                      onClick={() => setSelectedPresetIds([])}
                      className="px-1.5 py-0.5 rounded text-slate-500 hover:text-rose-500 hover:bg-rose-50 transition-colors cursor-pointer"
                    >
                      清空
                    </button>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-1.5 max-h-28 overflow-y-auto pr-0.5">
                {presets.map((p) => {
                  const isSelected = selectedPresetIds.includes(p.id);
                  return (
                    <div
                      key={p.id}
                      onClick={() => handleTogglePreset(p.id)}
                      className={`p-2 rounded-lg border text-left cursor-pointer transition-all flex items-center justify-between gap-1.5 ${
                        isSelected
                          ? 'border-sky-400 bg-sky-50 text-sky-800 shadow-2xs ring-1 ring-sky-300'
                          : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="font-medium text-[11px] truncate">{p.title}</div>
                        <div className="text-[9px] text-slate-400 truncate">{p.description}</div>
                      </div>
                      <div
                        className={`w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0 ${
                          isSelected
                            ? 'bg-sky-500 border-sky-500 text-white'
                            : 'border-slate-300 bg-white'
                        }`}
                      >
                        {isSelected && <Check className="w-2.5 h-2.5" />}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* User Mask Selection & Toggle */}
          <div className="pt-2.5 border-t border-slate-100 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <span className="text-sm">🎭</span>
                <span className="font-semibold text-slate-800 text-xs">玩家面具 (User 参演身份)</span>
              </div>
              <div className="flex items-center gap-2">
                <span className={`text-[11px] font-medium transition-colors ${userMaskEnabled ? 'text-sky-600' : 'text-slate-400'}`}>
                  {userMaskEnabled ? '开启 (User参演)' : '关闭 (User不参演)'}
                </span>
                <button
                  type="button"
                  onClick={() => setUserMaskEnabled(!userMaskEnabled)}
                  className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                    userMaskEnabled ? 'bg-sky-500' : 'bg-slate-300'
                  }`}
                  role="switch"
                  aria-checked={userMaskEnabled}
                >
                  <span
                    className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                      userMaskEnabled ? 'translate-x-4' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>
            </div>

            {!userMaskEnabled ? (
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-slate-600 text-[11px] leading-relaxed">
                <span className="font-semibold text-slate-700">已关闭玩家面具：</span>
                本次故事 <strong>User 不作为角色参与</strong>。故事将以纯群像视角或第三人称客观旁白演进，登场角色各自围绕自身动机自然互动，AI 不会为玩家预设身份、称谓或防备关系。
              </div>
            ) : userMasks.length === 0 ? (
              <div className="p-3 rounded-xl bg-amber-50/70 border border-amber-200/60 text-amber-800 text-[11px]">
                暂未在「我的」创建面具人设卡，将以默认无名旅人身份进行互动，亦可随时在「我的」标签页新建人设卡。
              </div>
            ) : (
              <div className="space-y-1.5">
                <div className="text-[10px] text-slate-400">请选择本次开局穿戴的玩家面具人设卡：</div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {userMasks.map((mask) => {
                    const isSelected = selectedUserMaskId === mask.id;
                    return (
                      <button
                        key={mask.id}
                        type="button"
                        onClick={() => setSelectedUserMaskId(mask.id)}
                        className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                          isSelected
                            ? 'border-sky-400 bg-sky-50 text-sky-900 shadow-2xs ring-1 ring-sky-300'
                            : 'border-slate-200 bg-white hover:border-slate-300 text-slate-700'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-xs truncate">
                            🎭 {mask.name}
                            {mask.codeName && (
                              <span className="text-[10px] text-sky-600 font-normal ml-1">
                                ({mask.codeName})
                              </span>
                            )}
                          </span>
                          {isSelected && (
                            <span className="text-[10px] text-sky-600 font-bold shrink-0 ml-1">
                              ✓ 生效
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-slate-400 truncate mt-0.5">
                          {mask.identity || (mask.nickname ? `昵称: ${mask.nickname}` : '通用旅人人设')}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Interactive Feature Toggles */}
          <div className="pt-2 border-t border-slate-100">
            <label className="block font-medium text-slate-700 mb-2">开局功能设置</label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <div
                role="button"
                tabIndex={0}
                onClick={() => setInnerVoiceEnabled(!innerVoiceEnabled)}
                className={`p-2.5 rounded-xl border flex flex-col justify-between cursor-pointer transition-all select-none ${
                  innerVoiceEnabled
                    ? 'border-sky-300 bg-sky-50/50 text-sky-800'
                    : 'border-slate-200 text-slate-500 hover:border-slate-300'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-semibold text-xs">角色心声</span>
                  <input
                    type="checkbox"
                    checked={innerVoiceEnabled}
                    onChange={(e) => setInnerVoiceEnabled(e.target.checked)}
                    onClick={(e) => e.stopPropagation()}
                    className="accent-sky-500 w-3.5 h-3.5 cursor-pointer"
                  />
                </div>
                <span className="text-[10px] text-slate-400">呈现隐秘心理</span>
              </div>

              <div
                role="button"
                tabIndex={0}
                onClick={() => setBranchChoicesEnabled(!branchChoicesEnabled)}
                className={`p-2.5 rounded-xl border flex flex-col justify-between cursor-pointer transition-all select-none ${
                  branchChoicesEnabled
                    ? 'border-sky-300 bg-sky-50/50 text-sky-800'
                    : 'border-slate-200 text-slate-500 hover:border-slate-300'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-semibold text-xs">剧情选项</span>
                  <input
                    type="checkbox"
                    checked={branchChoicesEnabled}
                    onChange={(e) => setBranchChoicesEnabled(e.target.checked)}
                    onClick={(e) => e.stopPropagation()}
                    className="accent-sky-500 w-3.5 h-3.5 cursor-pointer"
                  />
                </div>
                <span className="text-[10px] text-slate-400">提供行动选项</span>
              </div>

              <div
                role="button"
                tabIndex={0}
                onClick={() => setStatsTrackingEnabled(!statsTrackingEnabled)}
                className={`p-2.5 rounded-xl border flex flex-col justify-between cursor-pointer transition-all select-none ${
                  statsTrackingEnabled
                    ? 'border-sky-300 bg-sky-50/50 text-sky-800'
                    : 'border-slate-200 text-slate-500 hover:border-slate-300'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-semibold text-xs">数值追踪</span>
                  <input
                    type="checkbox"
                    checked={statsTrackingEnabled}
                    onChange={(e) => setStatsTrackingEnabled(e.target.checked)}
                    onClick={(e) => e.stopPropagation()}
                    className="accent-sky-500 w-3.5 h-3.5 cursor-pointer"
                  />
                </div>
                <span className="text-[10px] text-slate-400">
                  {statsTrackingEnabled ? '好感与状态跟踪' : '已关闭（纯文学沉浸）'}
                </span>
              </div>

              <div
                role="button"
                tabIndex={0}
                onClick={() => setCorruptionConstraintEnabled(!corruptionConstraintEnabled)}
                className={`p-2.5 rounded-xl border flex flex-col justify-between cursor-pointer transition-all select-none ${
                  corruptionConstraintEnabled
                    ? 'border-sky-300 bg-sky-50/50 text-sky-800'
                    : 'border-slate-200 text-slate-500 hover:border-slate-300'
                }`}
                title="开启：纯良正面人设黑化值锁定为0；关闭：所有角色黑化值随剧情正常增减"
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-semibold text-xs">黑化人设约束</span>
                  <input
                    type="checkbox"
                    checked={corruptionConstraintEnabled}
                    onChange={(e) => setCorruptionConstraintEnabled(e.target.checked)}
                    onClick={(e) => e.stopPropagation()}
                    className="accent-sky-500 w-3.5 h-3.5 cursor-pointer"
                  />
                </div>
                <span className="text-[10px] text-slate-400">
                  {corruptionConstraintEnabled ? '纯良人设锁0' : '随剧情正常增减'}
                </span>
              </div>
            </div>
          </div>

          {/* Stats Config Panel (if stats tracking enabled) */}
          {statsTrackingEnabled && (
            <div className="p-3 bg-slate-50/80 rounded-xl border border-slate-200/70 space-y-2.5">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <span className="font-semibold text-slate-700 text-xs sm:text-sm">数值配置与初始值</span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleAiInitStats}
                    disabled={isAiEvaluatingInitialStats}
                    className="text-violet-700 hover:text-violet-800 bg-violet-50 hover:bg-violet-100 border border-violet-200 px-2 py-1 rounded-lg text-[11px] font-semibold flex items-center gap-1 transition-all cursor-pointer active:scale-95 disabled:opacity-50"
                    title="依据所选角色的角色卡背景与世界书，由AI定制各角色专属初始数值"
                  >
                    {isAiEvaluatingInitialStats ? (
                      <Loader2 className="w-3 h-3 animate-spin text-violet-600" />
                    ) : (
                      <Sparkles className="w-3 h-3 text-violet-600" />
                    )}
                    <span>{isAiEvaluatingInitialStats ? 'AI评估中...' : 'AI智能赋初值'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowAddCustomStat(!showAddCustomStat)}
                    className="text-sky-600 hover:text-sky-700 text-[11px] flex items-center gap-0.5 cursor-pointer"
                  >
                    <Plus className="w-3 h-3" />
                    添加属性
                  </button>
                </div>
              </div>

              {aiInitialStatFeedback && (
                <div className="p-2 bg-violet-50 border border-violet-200 text-violet-800 text-[11px] rounded-lg flex items-center gap-1.5">
                  <Sparkles className="w-3 h-3 text-violet-600 shrink-0" />
                  <span>{aiInitialStatFeedback}</span>
                </div>
              )}

              {/* Add custom stat box */}
              {showAddCustomStat && (
                <div className="p-2.5 bg-white rounded-lg border border-sky-200 flex flex-wrap items-center gap-2">
                  <input
                    type="text"
                    value={customStatName}
                    onChange={(e) => setCustomStatName(e.target.value)}
                    placeholder="属性名称（如：灵力、堕落度）"
                    className="flex-1 min-w-[120px] px-2 py-1 rounded border border-slate-200 text-xs"
                  />
                  <div className="flex items-center gap-1">
                    <span className="text-slate-400 text-[10px]">初始:</span>
                    <input
                      type="number"
                      value={customStatInitial}
                      onChange={(e) => setCustomStatInitial(Number(e.target.value))}
                      className="w-14 px-1 py-1 rounded border border-slate-200 text-xs text-center"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleAddCustomStat}
                    className="px-2.5 py-1 bg-sky-500 text-white rounded text-xs"
                  >
                    确认添加
                  </button>
                </div>
              )}

              {/* Stats list */}
              <div className="space-y-2">
                {stats.map((stat) => (
                  <div
                    key={stat.id}
                    className={`p-2 rounded-lg bg-white border flex items-center justify-between gap-2 ${
                      stat.enabled ? 'border-slate-200' : 'border-slate-100 opacity-60'
                    }`}
                  >
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={stat.enabled}
                        onChange={() => handleToggleStat(stat.id)}
                        className="accent-sky-500"
                      />
                      <span className="font-medium text-slate-800">{stat.name}</span>
                    </label>

                    {stat.enabled && (
                      <div className="flex items-center gap-2">
                        <span className="text-slate-400 text-[10px]">
                          [{stat.minValue} ~ {stat.maxValue}]
                        </span>
                        <input
                          type="range"
                          min={stat.minValue}
                          max={stat.maxValue}
                          value={stat.initialValue}
                          onChange={(e) => handleStatValueChange(stat.id, Number(e.target.value))}
                          className="w-20 accent-sky-500 cursor-pointer"
                        />
                        <span className="text-xs font-semibold text-sky-600 w-8 text-right">
                          {stat.initialValue}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleDeleteStat(stat.id)}
                          className="text-slate-300 hover:text-rose-500 p-1 rounded hover:bg-rose-50 transition-colors cursor-pointer"
                          title="删除该属性"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* Footer buttons */}
      <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
        <button
          type="button"
          onClick={onClose}
          className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors"
        >
          取消
        </button>
        <button
          type="submit"
          className={`px-6 py-2 rounded-xl active:scale-95 text-white font-medium shadow-sm transition-all cursor-pointer flex items-center gap-1.5 ${
            mode === 'novel'
              ? 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-200'
              : 'bg-sky-500 hover:bg-sky-600 shadow-sky-200'
          }`}
        >
          <Sparkles className="w-4 h-4" />
          <span>{mode === 'novel' ? '创建小说项目并写作' : '开启文游'}</span>
        </button>
      </div>
        </form>
      </div>
    </div>
  );
};
