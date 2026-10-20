import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  X,
  RefreshCw,
  Check,
  AlertCircle,
  HelpCircle,
  Sliders,
  Plus,
  ArrowRight,
  TrendingDown,
  TrendingUp,
  Minus,
  User,
  Users,
} from 'lucide-react';
import {
  CharacterCard,
  GameStatDefinition,
  StorySave,
  WorldBook,
  AppSettings,
} from '../types';
import {
  evaluateCharacterStats,
  batchEvaluateCharacterStats,
  CharacterStatEvaluationResult,
  EvaluatedStatItem,
} from '../utils/aiService';

interface AiStatEvaluationModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetCharacter?: CharacterCard | null;
  allCharacters: CharacterCard[];
  currentSave: StorySave;
  worldbooks: WorldBook[];
  settings: AppSettings;
  onApplySingle: (
    characterId: string,
    updatedExistingStats: { id: string; newValue: number }[],
    newStatsToAppend: GameStatDefinition[]
  ) => void;
  onApplyBatch: (
    batchUpdates: {
      characterId: string;
      updatedExistingStats: { id: string; newValue: number }[];
      newStatsToAppend: GameStatDefinition[];
    }[]
  ) => void;
}

export const AiStatEvaluationModal: React.FC<AiStatEvaluationModalProps> = ({
  isOpen,
  onClose,
  targetCharacter,
  allCharacters,
  currentSave,
  worldbooks,
  settings,
  onApplySingle,
  onApplyBatch,
}) => {
  // If targetCharacter was provided, default to single mode; otherwise batch
  const [activeTab, setActiveTab] = useState<string>(() => targetCharacter ? targetCharacter.id : (allCharacters[0]?.id || 'batch'));
  const [forceMode, setForceMode] = useState<'auto' | 'context' | 'card_only'>('auto');

  // Loading & evaluation states
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [evaluationsMap, setEvaluationsMap] = useState<Record<string, CharacterStatEvaluationResult>>({});

  // Local user tweaks (statName -> adjustedValue)
  const [tweakedValues, setTweakedValues] = useState<Record<string, Record<string, number>>>({});
  // Checked new stats (characterId -> Set of new stat names)
  const [selectedNewStats, setSelectedNewStats] = useState<Record<string, Record<string, boolean>>>({});

  // Track active character
  const activeChar = allCharacters.find((c) => c.id === activeTab) || allCharacters[0] || null;

  // When modal opens, initialize activeTab
  useEffect(() => {
    if (isOpen) {
      if (targetCharacter) {
        setActiveTab(targetCharacter.id);
      } else if (allCharacters.length > 0) {
        setActiveTab(allCharacters[0].id);
      }
      setErrorMessage(null);
      // Run evaluation automatically if not yet evaluated
      const charToEval = targetCharacter || allCharacters[0];
      if (charToEval && !evaluationsMap[charToEval.id]) {
        handleRunSingleEvaluation(charToEval, forceMode);
      }
    }
  }, [isOpen, targetCharacter?.id]);

  if (!isOpen) return null;

  // Run single evaluation
  const handleRunSingleEvaluation = async (char: CharacterCard, modeOverride?: 'auto' | 'context' | 'card_only') => {
    setIsLoading(true);
    setErrorMessage(null);

    const mode = modeOverride || forceMode;
    // Extract char's current stats
    const charCurrentStats = currentSave.stats.filter(
      (s) => s.characterId === char.id || (!s.characterId && s.characterName?.includes(char.name))
    );

    const res = await evaluateCharacterStats({
      character: char,
      allCharacters,
      worldbooks,
      roleMap: currentSave.characterRoleMap || {},
      contextMessages: (currentSave.messages || []).map((m) => ({ role: m.role, content: m.content })),
      openingPremise: currentSave.openingPremise,
      storyTitle: currentSave.title,
      currentStats: charCurrentStats,
      forceMode: mode,
      provider: settings.provider,
      model: settings.model,
      customApiKey: settings.customApiKey,
      customEndpoint: settings.customEndpoint,
    });

    setIsLoading(false);
    if (!res.success || !res.data) {
      setErrorMessage(res.error || 'AI 评估未能生成，请重试');
      return;
    }

    setEvaluationsMap((prev) => ({
      ...prev,
      [char.id]: res.data!,
    }));

    // Initialize default tweak values and selected new stats
    const charTweaks: Record<string, number> = {};
    res.data.evaluatedStats.forEach((s) => {
      charTweaks[s.name] = s.suggestedValue;
    });
    setTweakedValues((prev) => ({
      ...prev,
      [char.id]: charTweaks,
    }));

    const charNewStatsSelected: Record<string, boolean> = {};
    (res.data.suggestedNewStats || []).forEach((ns) => {
      charNewStatsSelected[ns.name] = true; // default checked
    });
    setSelectedNewStats((prev) => ({
      ...prev,
      [char.id]: charNewStatsSelected,
    }));
  };

  // Run batch evaluation for all characters
  const handleRunBatchEvaluation = async () => {
    setIsLoading(true);
    setErrorMessage(null);

    const res = await batchEvaluateCharacterStats({
      characters: allCharacters,
      worldbooks,
      roleMap: currentSave.characterRoleMap || {},
      contextMessages: (currentSave.messages || []).map((m) => ({ role: m.role, content: m.content })),
      openingPremise: currentSave.openingPremise,
      storyTitle: currentSave.title,
      currentStats: currentSave.stats,
      provider: settings.provider,
      model: settings.model,
      customApiKey: settings.customApiKey,
      customEndpoint: settings.customEndpoint,
    });

    setIsLoading(false);
    if (!res.success || !res.data?.evaluations) {
      setErrorMessage(res.error || '批量 AI 赋值失败');
      return;
    }

    const newMap: Record<string, CharacterStatEvaluationResult> = {};
    const newTweaks: Record<string, Record<string, number>> = {};
    const newSelectedNew: Record<string, Record<string, boolean>> = {};

    res.data.evaluations.forEach((item) => {
      newMap[item.characterId] = item;
      const t: Record<string, number> = {};
      item.evaluatedStats.forEach((s) => {
        t[s.name] = s.suggestedValue;
      });
      newTweaks[item.characterId] = t;

      const selNew: Record<string, boolean> = {};
      (item.suggestedNewStats || []).forEach((ns) => {
        selNew[ns.name] = true;
      });
      newSelectedNew[item.characterId] = selNew;
    });

    setEvaluationsMap(newMap);
    setTweakedValues(newTweaks);
    setSelectedNewStats(newSelectedNew);
  };

  // Handle single apply
  const handleApplyCurrentChar = () => {
    if (!activeChar) return;
    const evalData = evaluationsMap[activeChar.id];
    if (!evalData) return;

    const charStats = currentSave.stats.filter(
      (s) => s.characterId === activeChar.id || (!s.characterId && s.characterName?.includes(activeChar.name))
    );

    const tweaks = tweakedValues[activeChar.id] || {};
    const updatedExisting: { id: string; newValue: number }[] = [];

    evalData.evaluatedStats.forEach((evaluated) => {
      const match = charStats.find((s) => s.name === evaluated.name);
      if (match) {
        const val = tweaks[evaluated.name] ?? evaluated.suggestedValue;
        updatedExisting.push({
          id: match.id,
          newValue: Math.max(match.minValue, Math.min(match.maxValue, val)),
        });
      }
    });

    // Handle new stats
    const newStatsToAppend: GameStatDefinition[] = [];
    const selectedNews = selectedNewStats[activeChar.id] || {};
    (evalData.suggestedNewStats || []).forEach((ns) => {
      if (selectedNews[ns.name]) {
        // Only append if not already exists
        const exists = charStats.some((s) => s.name === ns.name);
        if (!exists) {
          const val = tweaks[ns.name] ?? ns.suggestedValue;
          newStatsToAppend.push({
            id: `stat-${activeChar.id}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            name: ns.name,
            initialValue: val,
            currentValue: val,
            minValue: ns.minValue ?? 0,
            maxValue: ns.maxValue ?? 100,
            unit: ns.unit || '点',
            color: ns.color || 'violet',
            enabled: true,
            target: 'character',
            characterId: activeChar.id,
            characterName: activeChar.name,
            lastDelta: 0,
          });
        }
      }
    });

    onApplySingle(activeChar.id, updatedExisting, newStatsToAppend);
    onClose();
  };

  // Handle batch apply all
  const handleApplyAllBatch = () => {
    const batchList: {
      characterId: string;
      updatedExistingStats: { id: string; newValue: number }[];
      newStatsToAppend: GameStatDefinition[];
    }[] = [];

    allCharacters.forEach((char) => {
      const evalData = evaluationsMap[char.id];
      if (!evalData) return;

      const charStats = currentSave.stats.filter(
        (s) => s.characterId === char.id || (!s.characterId && s.characterName?.includes(char.name))
      );
      const tweaks = tweakedValues[char.id] || {};
      const updatedExisting: { id: string; newValue: number }[] = [];

      evalData.evaluatedStats.forEach((evaluated) => {
        const match = charStats.find((s) => s.name === evaluated.name);
        if (match) {
          const val = tweaks[evaluated.name] ?? evaluated.suggestedValue;
          updatedExisting.push({
            id: match.id,
            newValue: Math.max(match.minValue, Math.min(match.maxValue, val)),
          });
        }
      });

      const newStatsToAppend: GameStatDefinition[] = [];
      const selectedNews = selectedNewStats[char.id] || {};
      (evalData.suggestedNewStats || []).forEach((ns) => {
        if (selectedNews[ns.name]) {
          const exists = charStats.some((s) => s.name === ns.name);
          if (!exists) {
            const val = tweaks[ns.name] ?? ns.suggestedValue;
            newStatsToAppend.push({
              id: `stat-${char.id}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
              name: ns.name,
              initialValue: val,
              currentValue: val,
              minValue: ns.minValue ?? 0,
              maxValue: ns.maxValue ?? 100,
              unit: ns.unit || '点',
              color: ns.color || 'violet',
              enabled: true,
              target: 'character',
              characterId: char.id,
              characterName: char.name,
              lastDelta: 0,
            });
          }
        }
      });

      batchList.push({
        characterId: char.id,
        updatedExistingStats: updatedExisting,
        newStatsToAppend,
      });
    });

    if (batchList.length > 0) {
      onApplyBatch(batchList);
      onClose();
    }
  };

  const currentEval = activeChar ? evaluationsMap[activeChar.id] : null;
  const currentTweaks = activeChar ? tweakedValues[activeChar.id] || {} : {};
  const currentNewSelected = activeChar ? selectedNewStats[activeChar.id] || {} : {};

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200/90 w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden my-auto">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-violet-50/80 via-white to-sky-50/80 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-violet-600 to-indigo-500 text-white flex items-center justify-center shadow-md shadow-violet-200 shrink-0">
              <Sparkles className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-slate-800 text-base sm:text-lg">
                  AI 智能属性赋值
                </h3>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-violet-100 text-violet-700 border border-violet-200">
                  告别机械默认值
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                结合剧情上下文、角色卡与世界书深度评估，出场角色按剧情推演，未出场角色按人设赋予专属初值
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Character Tabs & Mode Selection Bar */}
        <div className="px-4 py-2.5 bg-slate-50/90 border-b border-slate-100 flex flex-wrap items-center justify-between gap-2 shrink-0">
          {/* Character Switcher */}
          <div className="flex items-center gap-1.5 overflow-x-auto py-0.5 max-w-full">
            {allCharacters.map((c) => {
              const isSelected = activeTab === c.id;
              const hasEvaluated = Boolean(evaluationsMap[c.id]);
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => {
                    setActiveTab(c.id);
                    if (!evaluationsMap[c.id]) {
                      handleRunSingleEvaluation(c);
                    }
                  }}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap ${
                    isSelected
                      ? 'bg-violet-600 text-white shadow-xs'
                      : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  <User className="w-3.5 h-3.5" />
                  <span>{c.name}</span>
                  {hasEvaluated && (
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${
                        isSelected ? 'bg-emerald-300' : 'bg-emerald-500'
                      }`}
                    />
                  )}
                </button>
              );
            })}

            {allCharacters.length > 1 && (
              <button
                type="button"
                onClick={handleRunBatchEvaluation}
                disabled={isLoading}
                className="px-2.5 py-1.5 rounded-xl text-xs font-semibold bg-gradient-to-r from-amber-50 to-orange-50 text-amber-800 border border-amber-200 hover:bg-amber-100 flex items-center gap-1 transition-all cursor-pointer ml-1"
                title="一键对所有登场角色进行AI评估与智能赋值"
              >
                <Users className="w-3.5 h-3.5 text-amber-600" />
                <span>一键评估全员</span>
              </button>
            )}
          </div>

          {/* Mode Switcher */}
          <div className="flex items-center gap-1 text-[11px] text-slate-500">
            <span>规则：</span>
            <select
              value={forceMode}
              onChange={(e) => {
                const nextMode = e.target.value as any;
                setForceMode(nextMode);
                if (activeChar) {
                  handleRunSingleEvaluation(activeChar, nextMode);
                }
              }}
              className="px-2 py-1 bg-white border border-slate-200 rounded-lg text-slate-700 text-xs font-medium focus:ring-1 focus:ring-violet-400 outline-none"
            >
              <option value="auto">🤖 自动智能判断出场状态</option>
              <option value="context">📖 强制按剧情上下文推演</option>
              <option value="card_only">📜 强制按角色卡赋予初值</option>
            </select>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4 flex-1">
          {errorMessage && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
              <span>{errorMessage}</span>
            </div>
          )}

          {isLoading ? (
            <div className="py-16 text-center space-y-3">
              <div className="w-12 h-12 rounded-full border-3 border-violet-600 border-t-transparent animate-spin mx-auto" />
              <div className="space-y-1">
                <p className="text-sm font-bold text-slate-800">
                  AI 正在综合评估【{activeChar?.name || '角色'}】的属性数值...
                </p>
                <p className="text-xs text-slate-400">
                  正在细致阅读角色卡、世界书与最新剧情上下文，推演真实身心状况与数值
                </p>
              </div>
            </div>
          ) : !currentEval ? (
            <div className="py-12 text-center space-y-3 bg-slate-50/50 rounded-2xl border border-dashed border-slate-200">
              <Sparkles className="w-8 h-8 text-violet-400 mx-auto" />
              <div className="space-y-1">
                <p className="text-sm font-semibold text-slate-700">尚未为此角色生成智能评估</p>
                <p className="text-xs text-slate-400">
                  点击下方按钮，由 AI 结合角色卡与当前剧情生成合理数值
                </p>
              </div>
              {activeChar && (
                <button
                  type="button"
                  onClick={() => handleRunSingleEvaluation(activeChar)}
                  className="px-4 py-2 bg-violet-600 text-white rounded-xl text-xs font-bold hover:bg-violet-700 shadow-sm cursor-pointer transition-all inline-flex items-center gap-1.5"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>立即评估【{activeChar.name}】</span>
                </button>
              )}
            </div>
          ) : (
            <>
              {/* Appearance Status Banner */}
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-lg bg-sky-100 text-sky-700 flex items-center justify-center font-bold text-sm shrink-0 overflow-hidden border border-sky-200">
                    {activeChar?.avatarImage ? (
                      <img
                        src={activeChar.avatarImage}
                        alt={activeChar.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span>{activeChar?.name.slice(0, 1)}</span>
                    )}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-800 text-sm">{activeChar?.name}</span>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          currentEval.hasAppeared
                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                            : 'bg-indigo-100 text-indigo-800 border border-indigo-200'
                        }`}
                      >
                        {currentEval.hasAppeared ? '🟢 正式登场状态' : '⚪ 尚未在剧情中出场'}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      {currentEval.appearanceStatusText ||
                        (currentEval.hasAppeared
                          ? '已结合故事正文推演其实时身体与心理状态'
                          : '已结合角色卡人设与世界书规则赋予专属初始基准值')}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => activeChar && handleRunSingleEvaluation(activeChar)}
                  className="text-xs text-violet-600 hover:text-violet-700 font-semibold flex items-center gap-1 px-2.5 py-1 rounded-lg hover:bg-violet-50 transition-colors cursor-pointer shrink-0 self-end sm:self-center"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>重新评估</span>
                </button>
              </div>

              {/* Rationale Callout */}
              <div className="p-3.5 rounded-xl bg-gradient-to-r from-violet-50/70 via-indigo-50/50 to-purple-50/70 border border-violet-200/80 space-y-1.5">
                <div className="flex items-center gap-1.5 text-xs font-bold text-violet-900">
                  <Sparkles className="w-3.5 h-3.5 text-violet-600" />
                  <span>AI 赋值文学依据与状态剖析：</span>
                </div>
                <p className="text-xs text-violet-950 leading-relaxed font-normal whitespace-pre-wrap">
                  {currentEval.rationale}
                </p>
              </div>

              {/* Stat Evaluation List */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs text-slate-600 font-semibold px-1">
                  <span>拟重估属性（可按需手动微调数值）：</span>
                  <span className="text-[10px] text-slate-400 font-normal">
                    原值 ➔ AI建议新值
                  </span>
                </div>

                <div className="space-y-2">
                  {currentEval.evaluatedStats.map((stat) => {
                    const charStats = currentSave.stats.filter(
                      (s) =>
                        s.characterId === activeChar?.id ||
                        (!s.characterId && s.characterName?.includes(activeChar?.name || ''))
                    );
                    const originalStat = charStats.find((s) => s.name === stat.name);
                    const originalVal = originalStat ? originalStat.currentValue : stat.originalValue ?? 100;
                    const currentValue = currentTweaks[stat.name] ?? stat.suggestedValue;
                    const diff = currentValue - originalVal;

                    return (
                      <div
                        key={stat.name}
                        className="p-3 bg-white rounded-xl border border-slate-200 shadow-2xs space-y-2"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-slate-800 text-xs">
                              {stat.name}
                            </span>
                            <span className="text-[10px] text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">
                              范围 {stat.minValue}~{stat.maxValue} {stat.unit}
                            </span>
                          </div>

                          <div className="flex items-center gap-2">
                            <span className="text-xs text-slate-400">
                              原: {originalVal}
                            </span>
                            <ArrowRight className="w-3 h-3 text-slate-300" />
                            <span className="text-xs font-bold text-violet-700 bg-violet-50 px-2 py-0.5 rounded-md border border-violet-100">
                              新: {currentValue} {stat.unit}
                            </span>
                            {diff !== 0 && (
                              <span
                                className={`text-[10px] font-bold px-1.5 py-0.2 rounded-full ${
                                  diff > 0
                                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                    : 'bg-rose-50 text-rose-700 border border-rose-200'
                                }`}
                              >
                                {diff > 0 ? `+${diff}` : diff}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Reason badge */}
                        {stat.reason && (
                          <div className="text-[11px] text-slate-500 bg-slate-50 p-1.5 rounded-lg border border-slate-100 flex items-start gap-1">
                            <span className="text-violet-500 font-bold shrink-0">💡 依据：</span>
                            <span>{stat.reason}</span>
                          </div>
                        )}

                        {/* Interactive Slider & Manual Input */}
                        <div className="flex items-center gap-3 pt-1">
                          <input
                            type="range"
                            min={stat.minValue}
                            max={stat.maxValue}
                            value={currentValue}
                            onChange={(e) => {
                              const val = Number(e.target.value);
                              if (activeChar) {
                                setTweakedValues((prev) => ({
                                  ...prev,
                                  [activeChar.id]: {
                                    ...(prev[activeChar.id] || {}),
                                    [stat.name]: val,
                                  },
                                }));
                              }
                            }}
                            className="flex-1 h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-violet-600"
                          />
                          <input
                            type="number"
                            min={stat.minValue}
                            max={stat.maxValue}
                            value={currentValue}
                            onChange={(e) => {
                              const val = Number(e.target.value);
                              if (activeChar) {
                                setTweakedValues((prev) => ({
                                  ...prev,
                                  [activeChar.id]: {
                                    ...(prev[activeChar.id] || {}),
                                    [stat.name]: val,
                                  },
                                }));
                              }
                            }}
                            className="w-16 px-1.5 py-0.5 text-xs text-center border border-slate-200 rounded-lg font-bold text-slate-700"
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Suggested New Stats Section (if any) */}
              {(currentEval.suggestedNewStats || []).length > 0 && (
                <div className="p-3 rounded-xl bg-amber-50/60 border border-amber-200/80 space-y-2">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-amber-900">
                    <Plus className="w-3.5 h-3.5 text-amber-600" />
                    <span>AI 推荐专属特色属性（勾选后将自动添加到该角色）：</span>
                  </div>

                  <div className="space-y-1.5">
                    {currentEval.suggestedNewStats!.map((ns) => {
                      const isChecked = currentNewSelected[ns.name] ?? true;
                      const currentValue = currentTweaks[ns.name] ?? ns.suggestedValue;
                      return (
                        <div
                          key={ns.name}
                          className="p-2 bg-white rounded-lg border border-amber-200/60 flex items-center justify-between gap-2 text-xs"
                        >
                          <label className="flex items-center gap-2 cursor-pointer select-none min-w-0">
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={(e) => {
                                if (activeChar) {
                                  setSelectedNewStats((prev) => ({
                                    ...prev,
                                    [activeChar.id]: {
                                      ...(prev[activeChar.id] || {}),
                                      [ns.name]: e.target.checked,
                                    },
                                  }));
                                }
                              }}
                              className="rounded border-slate-300 text-violet-600 focus:ring-violet-500 w-3.5 h-3.5 cursor-pointer"
                            />
                            <span className="font-semibold text-slate-800">{ns.name}</span>
                            <span className="text-[10px] text-amber-700 bg-amber-100 px-1.5 py-0.2 rounded">
                              初始值: {currentValue} {ns.unit}
                            </span>
                            {ns.reason && (
                              <span className="text-[10px] text-slate-400 truncate max-w-[200px]">
                                · {ns.reason}
                              </span>
                            )}
                          </label>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-3.5 sm:p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between gap-2 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-200/60 rounded-xl transition-colors cursor-pointer"
          >
            取消
          </button>

          <div className="flex items-center gap-2">
            {allCharacters.length > 1 && (
              <button
                type="button"
                onClick={handleApplyAllBatch}
                disabled={isLoading || Object.keys(evaluationsMap).length === 0}
                className="px-3.5 py-2 text-xs font-bold text-amber-800 bg-amber-100 hover:bg-amber-200 rounded-xl transition-all cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
                title="应用所有已评估角色的数值"
              >
                <Users className="w-3.5 h-3.5" />
                <span>一键应用全员赋值</span>
              </button>
            )}

            <button
              type="button"
              onClick={handleApplyCurrentChar}
              disabled={isLoading || !currentEval}
              className="px-4 py-2 text-xs font-bold text-white bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 rounded-xl shadow-sm transition-all cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
            >
              <Check className="w-3.5 h-3.5" />
              <span>应用此角色赋值</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
