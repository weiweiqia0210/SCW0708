import React, { useState } from 'react';
import { X, Dices, Sparkles, Check, AlertCircle, RefreshCw } from 'lucide-react';
import { TRPGRollResult, TRPGCharacter, TRPGRuleset, TRPGCheckResult } from '../../types/trpg';
import {
  parseDiceExpression,
  rollDice,
  rollDiceManual,
  executeCheck,
} from '../../utils/diceEngine';

interface TRPGDiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  character: TRPGCharacter;
  ruleset: TRPGRuleset;
  diceMode: 'auto' | 'manual';
  onConfirmRoll: (result: TRPGRollResult, checkResult?: TRPGCheckResult) => void;
  defaultExpression?: string;
  defaultReason?: string;
}

const QUICK_DICE = [
  { label: 'D4', expr: '1d4' },
  { label: 'D6', expr: '1d6' },
  { label: 'D8', expr: '1d8' },
  { label: 'D10', expr: '1d10' },
  { label: 'D12', expr: '1d12' },
  { label: 'D20', expr: '1d20' },
  { label: 'D100', expr: '1d100' },
];

export const TRPGDiceModal: React.FC<TRPGDiceModalProps> = ({
  isOpen,
  onClose,
  character,
  ruleset,
  diceMode,
  onConfirmRoll,
  defaultExpression = '1d20',
  defaultReason = '随机骰',
}) => {
  const [activeTab, setActiveTab] = useState<'free' | 'check'>('free');
  const [expression, setExpression] = useState(defaultExpression);
  const [reason, setReason] = useState(defaultReason);
  const [manualRollVal, setManualRollVal] = useState<string>('');

  // Check Tab States
  const [checkType, setCheckType] = useState<'attribute' | 'skill'>('attribute');
  const [selectedAttrKey, setSelectedAttrKey] = useState<string>(
    ruleset.attributes[0]?.key || 'str'
  );
  const [selectedSkillId, setSelectedSkillId] = useState<string>(
    ruleset.skills[0]?.id || 'athletics'
  );
  const [targetDc, setTargetDc] = useState<number>(15);

  // Result animation states
  const [isRolling, setIsRolling] = useState(false);
  const [lastRoll, setLastRoll] = useState<TRPGRollResult | null>(null);
  const [lastCheck, setLastCheck] = useState<TRPGCheckResult | null>(null);

  if (!isOpen) return null;

  const parsed = parseDiceExpression(expression);

  const handleRollFree = () => {
    if (!parsed.isValid) return;

    setIsRolling(true);
    setLastCheck(null);

    setTimeout(() => {
      let res: TRPGRollResult;
      if (diceMode === 'manual' && manualRollVal.trim() !== '') {
        const val = parseInt(manualRollVal.trim(), 10);
        res = rollDiceManual(expression, [isNaN(val) ? 10 : val], reason || '自由投掷');
      } else {
        res = rollDice(expression, reason || '自由投掷');
      }
      setLastRoll(res);
      setIsRolling(false);
    }, 250);
  };

  const handleRollCheck = () => {
    setIsRolling(true);
    setLastRoll(null);

    setTimeout(() => {
      const targetKey = checkType === 'attribute' ? selectedAttrKey : selectedSkillId;
      const manualVal =
        diceMode === 'manual' && manualRollVal.trim() !== ''
          ? parseInt(manualRollVal.trim(), 10)
          : undefined;

      const res = executeCheck({
        character,
        ruleset,
        checkType,
        targetKey,
        dc: targetDc > 0 ? targetDc : undefined,
        manualRoll: manualVal,
        reason: reason || `${character.name} 进行判定`,
      });

      setLastCheck(res);
      setLastRoll(res.roll);
      setIsRolling(false);
    }, 250);
  };

  const handleApplyResult = () => {
    if (lastRoll) {
      onConfirmRoll(lastRoll, lastCheck || undefined);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl shadow-2xl border border-sky-100 w-full max-w-md overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-sky-50/70 to-indigo-50/50">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-sky-500 text-white flex items-center justify-center shadow-xs">
              <Dices className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-800">骰子检定中心</h3>
              <p className="text-[11px] text-slate-500">
                当前模式：
                <span className={`font-semibold ml-1 ${diceMode === 'manual' ? 'text-amber-600' : 'text-sky-600'}`}>
                  {diceMode === 'manual' ? '玩家手动掷骰' : '程序自动掷骰'}
                </span>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-slate-200/60 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
            title="返回便携终端"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab switch */}
        <div className="flex border-b border-slate-100 bg-slate-50/70 p-1 gap-1">
          <button
            onClick={() => setActiveTab('free')}
            className={`flex-1 py-1.5 text-xs font-semibold rounded-xl transition-all cursor-pointer ${
              activeTab === 'free'
                ? 'bg-white text-sky-700 shadow-xs'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            自由骰掷 (D4-D100)
          </button>
          <button
            onClick={() => setActiveTab('check')}
            className={`flex-1 py-1.5 text-xs font-semibold rounded-xl transition-all cursor-pointer ${
              activeTab === 'check'
                ? 'bg-white text-sky-700 shadow-xs'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            人物能力检定 (D20+加值)
          </button>
        </div>

        {/* Body content */}
        <div className="p-5 overflow-y-auto space-y-4">
          {activeTab === 'free' ? (
            <div className="space-y-3.5">
              {/* Quick Dice buttons */}
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1.5">常用快捷骰</label>
                <div className="grid grid-cols-4 sm:grid-cols-7 gap-1.5">
                  {QUICK_DICE.map((d) => (
                    <button
                      key={d.label}
                      type="button"
                      onClick={() => setExpression(d.expr)}
                      className={`px-2 py-1.5 text-xs font-bold rounded-xl border transition-all cursor-pointer ${
                        expression === d.expr
                          ? 'bg-sky-500 text-white border-sky-500 shadow-xs'
                          : 'bg-white text-slate-700 border-slate-200 hover:border-sky-300'
                      }`}
                    >
                      {d.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Expression Input */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-medium text-slate-600">骰子表达式 / 伤害公式</label>
                  {!parsed.isValid && (
                    <span className="text-[11px] text-rose-500 flex items-center gap-0.5">
                      <AlertCircle className="w-3 h-3" />
                      {parsed.error}
                    </span>
                  )}
                </div>
                <input
                  type="text"
                  value={expression}
                  onChange={(e) => setExpression(e.target.value)}
                  placeholder="如: 1d20, 2d6+3, 1d100"
                  className="w-full px-3.5 py-2 text-sm font-mono border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-400 bg-white"
                />
              </div>

              {/* Manual mode numeric input if enabled */}
              {diceMode === 'manual' && (
                <div className="p-3 rounded-2xl bg-amber-50/80 border border-amber-200/80">
                  <label className="block text-xs font-semibold text-amber-900 mb-1">
                    🎲 玩家线下物理骰点数录入 (选填)
                  </label>
                  <p className="text-[11px] text-amber-700 mb-2">
                    若你在桌面上掷出了实体骰子，请在此处直接填写实体骰点数；留空则由系统为你自动投掷。
                  </p>
                  <input
                    type="number"
                    value={manualRollVal}
                    onChange={(e) => setManualRollVal(e.target.value)}
                    placeholder={`输入 1~${parsed.sides || 20} 点`}
                    className="w-full px-3 py-1.5 text-sm font-bold border border-amber-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 bg-white"
                  />
                </div>
              )}

              {/* Reason */}
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">行动描述或检定原因</label>
                <input
                  type="text"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="如: 辨认祭坛符文、观察树林阴影"
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-400"
                />
              </div>

              <button
                type="button"
                onClick={handleRollFree}
                disabled={!parsed.isValid || isRolling}
                className="w-full py-2.5 rounded-2xl bg-sky-500 hover:bg-sky-600 text-white font-semibold text-sm shadow-sm shadow-sky-200 flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-[0.98] disabled:opacity-50"
              >
                {isRolling ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Dices className="w-4 h-4" />}
                {diceMode === 'manual' && manualRollVal ? '确认录入并结算' : '立即投掷骰子'}
              </button>
            </div>
          ) : (
            <div className="space-y-3.5">
              {/* Check Type */}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setCheckType('attribute')}
                  className={`flex-1 py-1.5 text-xs font-medium rounded-xl border transition-all cursor-pointer ${
                    checkType === 'attribute'
                      ? 'bg-sky-50 text-sky-700 border-sky-400 font-semibold'
                      : 'bg-white text-slate-600 border-slate-200'
                  }`}
                >
                  基础属性检定 (六维)
                </button>
                <button
                  type="button"
                  onClick={() => setCheckType('skill')}
                  className={`flex-1 py-1.5 text-xs font-medium rounded-xl border transition-all cursor-pointer ${
                    checkType === 'skill'
                      ? 'bg-sky-50 text-sky-700 border-sky-400 font-semibold'
                      : 'bg-white text-slate-600 border-slate-200'
                  }`}
                >
                  熟练特长技能检定
                </button>
              </div>

              {/* Selection */}
              {checkType === 'attribute' ? (
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">选择属性</label>
                  <select
                    value={selectedAttrKey}
                    onChange={(e) => setSelectedAttrKey(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-sky-400"
                  >
                    {ruleset.attributes.map((a) => {
                      const val = character.attributes[a.key] ?? 10;
                      const mod = Math.floor((val - 10) / 2);
                      const sign = mod >= 0 ? `+${mod}` : `${mod}`;
                      return (
                        <option key={a.key} value={a.key}>
                          {a.name} ({a.abbr}) - 数值 {val} (加值 {sign})
                        </option>
                      );
                    })}
                  </select>
                </div>
              ) : (
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">选择技能</label>
                  <select
                    value={selectedSkillId}
                    onChange={(e) => setSelectedSkillId(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-sky-400"
                  >
                    {ruleset.skills.map((s) => {
                      const isProf = (character.proficientSkills || []).includes(s.id);
                      return (
                        <option key={s.id} value={s.id}>
                          {s.name} ({s.attributeKey.toUpperCase()}) {isProf ? '★ 已掌握熟练' : ''}
                        </option>
                      );
                    })}
                  </select>
                </div>
              )}

              {/* Target DC */}
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  目标难度 DC (设为 0 表示纯参考)
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    value={targetDc}
                    onChange={(e) => setTargetDc(parseInt(e.target.value, 10) || 0)}
                    className="w-24 px-3 py-1.5 text-xs font-bold border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-400 text-center"
                  />
                  <div className="flex gap-1 flex-1">
                    <button
                      type="button"
                      onClick={() => setTargetDc(ruleset.difficultyClasses.easy)}
                      className="px-2 py-1 text-[11px] rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100"
                    >
                      简单({ruleset.difficultyClasses.easy})
                    </button>
                    <button
                      type="button"
                      onClick={() => setTargetDc(ruleset.difficultyClasses.medium)}
                      className="px-2 py-1 text-[11px] rounded-lg bg-sky-50 text-sky-700 border border-sky-200 hover:bg-sky-100"
                    >
                      中等({ruleset.difficultyClasses.medium})
                    </button>
                    <button
                      type="button"
                      onClick={() => setTargetDc(ruleset.difficultyClasses.hard)}
                      className="px-2 py-1 text-[11px] rounded-lg bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100"
                    >
                      困难({ruleset.difficultyClasses.hard})
                    </button>
                  </div>
                </div>
              </div>

              {/* Manual mode numeric input if enabled */}
              {diceMode === 'manual' && (
                <div className="p-3 rounded-2xl bg-amber-50/80 border border-amber-200/80">
                  <label className="block text-xs font-semibold text-amber-900 mb-1">
                    🎲 录入 D20 实体骰点数 (选填)
                  </label>
                  <input
                    type="number"
                    value={manualRollVal}
                    onChange={(e) => setManualRollVal(e.target.value)}
                    placeholder="输入 1~20 点"
                    className="w-full px-3 py-1.5 text-sm font-bold border border-amber-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 bg-white"
                  />
                </div>
              )}

              <button
                type="button"
                onClick={handleRollCheck}
                disabled={isRolling}
                className="w-full py-2.5 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm shadow-sm shadow-indigo-200 flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-[0.98]"
              >
                {isRolling ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                执行 D20 检定结算
              </button>
            </div>
          )}

          {/* Roll Result Presentation */}
          {lastRoll && (
            <div className="mt-4 p-4 rounded-2xl border border-sky-200 bg-gradient-to-br from-white via-sky-50/50 to-indigo-50/40 shadow-xs space-y-2 animate-in zoom-in-95 duration-200">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-700">投掷结算结果</span>
                {lastRoll.isCriticalSuccess && (
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-300 animate-pulse">
                    🌟 自然 20 极佳大成功！
                  </span>
                )}
                {lastRoll.isCriticalFailure && (
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 border border-rose-300">
                    💀 自然 1 绝险大失败！
                  </span>
                )}
              </div>

              {/* Big total display */}
              <div className="flex items-baseline gap-3 py-1">
                <div className="text-3xl font-extrabold text-slate-800 font-mono tracking-tight">
                  {lastRoll.total}
                </div>
                <div className="text-xs text-slate-500 font-mono">
                  [点数: {lastRoll.rolls.join(', ')}]
                  {lastRoll.modifier !== 0 && (
                    <span> {lastRoll.modifier >= 0 ? `+${lastRoll.modifier}` : `${lastRoll.modifier}`}</span>
                  )}
                  {lastRoll.isManual && <span className="ml-1 text-amber-600 font-sans">(手工录入)</span>}
                </div>
              </div>

              {lastCheck && (
                <div
                  className={`text-xs p-2.5 rounded-xl border font-medium ${
                    lastCheck.isSuccess === true
                      ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                      : lastCheck.isSuccess === false
                      ? 'bg-rose-50 text-rose-800 border-rose-200'
                      : 'bg-slate-50 text-slate-700 border-slate-200'
                  }`}
                >
                  {lastCheck.summaryText}
                </div>
              )}

              <button
                type="button"
                onClick={handleApplyResult}
                className="w-full mt-2 py-2 rounded-xl bg-slate-800 hover:bg-slate-900 text-white text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
              >
                <Check className="w-3.5 h-3.5" />
                采纳此结果并记录入会话
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
