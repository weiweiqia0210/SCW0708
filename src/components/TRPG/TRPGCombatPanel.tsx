import React, { useState } from 'react';
import {
  Swords,
  Shield,
  Heart,
  Plus,
  Play,
  RotateCcw,
  Sparkles,
  Zap,
  ChevronDown,
  ChevronUp,
  X,
  AlertTriangle,
  Flame,
} from 'lucide-react';
import { TRPGSession, TRPGItem, TRPGEnemy, CombatActionLog } from '../../types/trpg';
import {
  executePlayerAttack,
  executePlayerHeal,
  executeEnemyTurn,
  executeFleeCombat,
  executeCompanionAttack,
  calculatePlayerAC,
} from '../../utils/trpgCombatEngine';

interface TRPGCombatPanelProps {
  session: TRPGSession;
  onUpdateSession: (updated: TRPGSession, actionLog?: CombatActionLog) => void;
  onCloseCombat?: () => void;
}

export const TRPGCombatPanel: React.FC<TRPGCombatPanelProps> = ({
  session,
  onUpdateSession,
  onCloseCombat,
}) => {
  const [selectedEnemyId, setSelectedEnemyId] = useState<string>(
    session.combatState.enemies[0]?.id || ''
  );
  const [isAddingEnemy, setIsAddingEnemy] = useState(false);
  const [newEnemyName, setNewEnemyName] = useState('凶暴灰狼');
  const [newEnemyHp, setNewEnemyHp] = useState(16);
  const [newEnemyAc, setNewEnemyAc] = useState(12);
  const [newEnemyBonus, setNewEnemyBonus] = useState(3);
  const [newEnemyDamage, setNewEnemyDamage] = useState('1d6+2');

  const [expandedLog, setExpandedLog] = useState(false);
  const [manualD20Input, setManualD20Input] = useState<string>('');

  const char = session.character;
  const playerAC = calculatePlayerAC(char, session.rulesetSnapshot.modifierRule);
  const equippedWeapons = (char.inventory || []).filter(
    (i) => i.equipped && i.type === 'weapon'
  );

  // If no weapon equipped, provide standard unarmed strike
  const availableWeapons: TRPGItem[] = equippedWeapons.length > 0
    ? equippedWeapons
    : [
        {
          id: 'unarmed',
          name: '拳脚肉搏 / 基础徒手打击',
          type: 'weapon',
          quantity: 1,
          equipped: true,
          damageDice: '1d4+STR',
          description: '赤手空拳攻击',
        },
      ];

  const targetEnemy =
    session.combatState.enemies.find((e) => e.id === selectedEnemyId) ||
    session.combatState.enemies.find((e) => e.currentHp > 0) ||
    session.combatState.enemies[0];

  const handleAttack = (weapon: TRPGItem) => {
    if (!targetEnemy) return;

    const manualVal =
      session.diceMode === 'manual' && manualD20Input.trim() !== ''
        ? parseInt(manualD20Input.trim(), 10)
        : undefined;

    // 1. Player Attack
    const { updatedSession: afterPlayerAttack, actionLog: playerLog } = executePlayerAttack({
      session,
      weapon,
      targetEnemyId: targetEnemy.id,
      manualAttackD20: manualVal,
    });

    setManualD20Input('');

    // 2. If combat continues and target wasn't the last enemy or enemies still alive, trigger enemy turn
    if (afterPlayerAttack.combatState.inCombat) {
      const { updatedSession: afterEnemyTurn, actionLogs: enemyLogs } = executeEnemyTurn(
        afterPlayerAttack
      );
      onUpdateSession(afterEnemyTurn, playerLog);
    } else {
      onUpdateSession(afterPlayerAttack, playerLog);
    }
  };

  const handleUseHealItem = (item: TRPGItem) => {
    const { updatedSession, actionLog } = executePlayerHeal({
      session,
      itemId: item.id,
    });
    onUpdateSession(updatedSession, actionLog);
  };

  const handleFlee = () => {
    const manualVal =
      session.diceMode === 'manual' && manualD20Input.trim() !== ''
        ? parseInt(manualD20Input.trim(), 10)
        : undefined;

    const { updatedSession, actionLog, success } = executeFleeCombat({
      session,
      manualD20: manualVal,
    });

    setManualD20Input('');

    if (!success && updatedSession.combatState.inCombat) {
      // Enemy counter-attacks upon failed escape
      const { updatedSession: afterEnemy } = executeEnemyTurn(updatedSession);
      onUpdateSession(afterEnemy, actionLog);
    } else {
      onUpdateSession(updatedSession, actionLog);
    }
  };

  const handleCompanionAttack = (companionId: string) => {
    if (!targetEnemy) return;
    const { updatedSession: afterAttack, actionLog } = executeCompanionAttack({
      session,
      companionId,
      targetEnemyId: targetEnemy.id,
    });

    if (afterAttack.combatState.inCombat) {
      const { updatedSession: afterEnemy } = executeEnemyTurn(afterAttack);
      onUpdateSession(afterEnemy, actionLog);
    } else {
      onUpdateSession(afterAttack, actionLog);
    }
  };

  const handleSpawnEnemy = () => {
    const newEnemy: TRPGEnemy = {
      id: `enemy-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
      name: newEnemyName || '凶暴野兽',
      currentHp: newEnemyHp,
      maxHp: newEnemyHp,
      ac: newEnemyAc,
      attackBonus: newEnemyBonus,
      damageFormula: newEnemyDamage || '1d6+2',
      statusEffects: [],
    };

    const nextEnemies = [...session.combatState.enemies, newEnemy];
    const spawnLog: CombatActionLog = {
      id: `act-${Date.now()}`,
      round: session.combatState.round,
      actor: '战场遭遇',
      actorType: 'system',
      actionType: 'status',
      detail: `遭遇强敌！【${newEnemy.name}】(HP: ${newEnemy.currentHp}, AC: ${newEnemy.ac}) 杀入战场！`,
      timestamp: Date.now(),
    };

    const nextSession: TRPGSession = {
      ...session,
      combatState: {
        ...session.combatState,
        inCombat: true,
        enemies: nextEnemies,
        actionLogs: [spawnLog, ...session.combatState.actionLogs].slice(0, 50),
      },
      updatedAt: Date.now(),
    };

    setSelectedEnemyId(newEnemy.id);
    setIsAddingEnemy(false);
    onUpdateSession(nextSession, spawnLog);
  };

  const handleEndCombat = () => {
    const endLog: CombatActionLog = {
      id: `act-${Date.now()}`,
      round: session.combatState.round,
      actor: '战斗指挥',
      actorType: 'system',
      actionType: 'status',
      detail: '战斗态势解除，重新回归自由探索与文字叙事。',
      timestamp: Date.now(),
    };

    onUpdateSession(
      {
        ...session,
        combatState: {
          ...session.combatState,
          inCombat: false,
          actionLogs: [endLog, ...session.combatState.actionLogs],
        },
        updatedAt: Date.now(),
      },
      endLog
    );

    if (onCloseCombat) onCloseCombat();
  };

  const consumables = (char.inventory || []).filter(
    (i) => i.type === 'consumable' && i.quantity > 0
  );

  return (
    <div className="rounded-2xl border border-rose-200 bg-gradient-to-b from-rose-50/70 via-white to-slate-50/80 p-3.5 shadow-sm space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-rose-100 pb-2">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-rose-500 text-white flex items-center justify-center shadow-xs">
            <Swords className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-800">半可视化战斗指挥面板</span>
              <span className="px-2 py-0.2 rounded-full bg-rose-100 text-rose-700 text-[10px] font-semibold">
                第 {session.combatState.round} 回合
              </span>
            </div>
            <p className="text-[10px] text-slate-400">
              数据由程序权威计算，击打与生命值变更即时固化
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setIsAddingEnemy(!isAddingEnemy)}
            className="px-2 py-1 text-[11px] rounded-lg bg-white border border-rose-200 text-rose-700 hover:bg-rose-50 flex items-center gap-1 cursor-pointer"
          >
            <Plus className="w-3 h-3" />
            增援敌人
          </button>
          <button
            type="button"
            onClick={handleEndCombat}
            className="px-2 py-1 text-[11px] rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors cursor-pointer"
          >
            结束交战
          </button>
        </div>
      </div>

      {/* Spawn Enemy Panel */}
      {isAddingEnemy && (
        <div className="p-3 rounded-xl bg-white border border-rose-200 shadow-xs space-y-2 text-xs">
          <div className="font-semibold text-slate-700">添加遭遇敌方单位</div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] text-slate-500">敌人名称</label>
              <input
                type="text"
                value={newEnemyName}
                onChange={(e) => setNewEnemyName(e.target.value)}
                className="w-full px-2 py-1 border border-slate-200 rounded-lg text-xs"
              />
            </div>
            <div>
              <label className="text-[10px] text-slate-500">生命值 (HP)</label>
              <input
                type="number"
                value={newEnemyHp}
                onChange={(e) => setNewEnemyHp(parseInt(e.target.value, 10) || 10)}
                className="w-full px-2 py-1 border border-slate-200 rounded-lg text-xs font-mono"
              />
            </div>
            <div>
              <label className="text-[10px] text-slate-500">防御值 (AC)</label>
              <input
                type="number"
                value={newEnemyAc}
                onChange={(e) => setNewEnemyAc(parseInt(e.target.value, 10) || 10)}
                className="w-full px-2 py-1 border border-slate-200 rounded-lg text-xs font-mono"
              />
            </div>
            <div>
              <label className="text-[10px] text-slate-500">伤害公式</label>
              <input
                type="text"
                value={newEnemyDamage}
                onChange={(e) => setNewEnemyDamage(e.target.value)}
                placeholder="1d6+2"
                className="w-full px-2 py-1 border border-slate-200 rounded-lg text-xs font-mono"
              />
            </div>
          </div>
          <div className="flex justify-end gap-1.5 pt-1">
            <button
              type="button"
              onClick={() => setIsAddingEnemy(false)}
              className="px-2 py-1 rounded-lg text-slate-500 hover:bg-slate-100"
            >
              取消
            </button>
            <button
              type="button"
              onClick={handleSpawnEnemy}
              className="px-3 py-1 rounded-lg bg-rose-500 text-white font-medium hover:bg-rose-600"
            >
              加入战斗
            </button>
          </div>
        </div>
      )}

      {/* Combatants Dashboard (Player & Enemies) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        {/* Player Status Card */}
        <div className="p-3 rounded-xl bg-white border border-sky-100 shadow-xs space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-800">{char.name}</span>
            <div className="flex items-center gap-1.5 text-[11px]">
              <span className="px-1.5 py-0.2 rounded bg-sky-100 text-sky-800 font-semibold flex items-center gap-0.5">
                <Shield className="w-3 h-3" />
                AC {playerAC}
              </span>
            </div>
          </div>

          {/* HP Bar */}
          <div>
            <div className="flex justify-between text-[11px] font-semibold text-slate-600 mb-0.5">
              <span className="flex items-center gap-1">
                <Heart className="w-3 h-3 text-rose-500 fill-rose-500" />
                生命值
              </span>
              <span className="font-mono">
                {char.currentHp} / {char.maxHp}
              </span>
            </div>
            <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden">
              <div
                className={`h-full transition-all duration-300 ${
                  char.currentHp / char.maxHp > 0.5
                    ? 'bg-emerald-500'
                    : char.currentHp / char.maxHp > 0.2
                    ? 'bg-amber-500'
                    : 'bg-rose-500 animate-pulse'
                }`}
                style={{ width: `${Math.max(0, Math.min(100, (char.currentHp / char.maxHp) * 100))}%` }}
              />
            </div>
          </div>
        </div>

        {/* Enemies List */}
        <div className="space-y-1.5">
          {session.combatState.enemies.length === 0 ? (
            <div className="p-3 rounded-xl bg-white/70 border border-dashed border-slate-200 text-center text-xs text-slate-400">
              当前暂无交战敌方目标，点击“增援敌人”引入战斗对手
            </div>
          ) : (
            session.combatState.enemies.map((enemy) => {
              const isSelected = targetEnemy?.id === enemy.id;
              const isDead = enemy.currentHp <= 0;
              const hpPercent = Math.max(0, Math.min(100, (enemy.currentHp / enemy.maxHp) * 100));

              return (
                <div
                  key={enemy.id}
                  onClick={() => !isDead && setSelectedEnemyId(enemy.id)}
                  className={`p-2.5 rounded-xl border transition-all cursor-pointer ${
                    isDead
                      ? 'bg-slate-50/70 border-slate-200 opacity-60'
                      : isSelected
                      ? 'bg-rose-50/80 border-rose-400 shadow-xs'
                      : 'bg-white border-slate-200 hover:border-rose-200'
                  }`}
                >
                  <div className="flex items-center justify-between text-xs font-bold text-slate-800">
                    <span className="flex items-center gap-1.5">
                      {isDead ? '💀' : '🎯'}
                      {enemy.name}
                      {isSelected && !isDead && (
                        <span className="text-[10px] text-rose-600 font-normal">(当前锁定)</span>
                      )}
                    </span>
                    <span className="text-[11px] font-mono text-slate-500">
                      AC {enemy.ac} | {enemy.currentHp}/{enemy.maxHp} HP
                    </span>
                  </div>

                  <div className="w-full h-1.5 rounded-full bg-slate-100 overflow-hidden mt-1">
                    <div
                      className={`h-full transition-all duration-300 ${
                        isDead ? 'bg-slate-300' : hpPercent > 40 ? 'bg-rose-500' : 'bg-red-700'
                      }`}
                      style={{ width: `${hpPercent}%` }}
                    />
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Manual mode dice input hint */}
      {session.diceMode === 'manual' && (
        <div className="flex items-center gap-2 p-2 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-800">
          <span className="font-bold shrink-0">🎲 线下物理骰命中点数:</span>
          <input
            type="number"
            value={manualD20Input}
            onChange={(e) => setManualD20Input(e.target.value)}
            placeholder="留空自动投掷，或填 1~20"
            className="w-full px-2 py-0.5 text-xs font-mono bg-white border border-amber-300 rounded-lg focus:outline-none"
          />
        </div>
      )}

      {/* Action Controls */}
      <div className="space-y-2 pt-1 border-t border-rose-100/70">
        <div className="text-[11px] font-semibold text-slate-500 flex items-center justify-between">
          <span>选择当前回合行动：</span>
          {targetEnemy && targetEnemy.currentHp > 0 && (
            <span className="text-rose-600">目标：{targetEnemy.name}</span>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          {/* Weapons Attack */}
          {availableWeapons.map((weapon) => (
            <button
              key={weapon.id}
              type="button"
              disabled={!targetEnemy || targetEnemy.currentHp <= 0}
              onClick={() => handleAttack(weapon)}
              className="px-3 py-1.5 rounded-xl bg-rose-500 hover:bg-rose-600 active:scale-95 text-white text-xs font-semibold shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-40"
            >
              <Swords className="w-3.5 h-3.5" />
              {weapon.name} ({weapon.damageDice || '1d4+STR'})
            </button>
          ))}

          {/* Consumable Heal */}
          {consumables.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => handleUseHealItem(item)}
              className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white text-xs font-semibold shadow-xs flex items-center gap-1.5 cursor-pointer"
            >
              <Heart className="w-3.5 h-3.5 fill-current" />
              使用 {item.name} (余 {item.quantity})
            </button>
          ))}

          {/* Active Companions Support Attacks */}
          {(session.companions || [])
            .filter((c) => c.status === 'active')
            .map((comp) => (
              <button
                key={comp.id}
                type="button"
                disabled={!targetEnemy || targetEnemy.currentHp <= 0}
                onClick={() => handleCompanionAttack(comp.id)}
                className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white text-xs font-semibold shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-40"
                title={`${comp.name} 协助进攻`}
              >
                <Sparkles className="w-3.5 h-3.5" />
                {comp.name} 协同援护
              </button>
            ))}

          {/* Flee */}
          <button
            type="button"
            onClick={handleFlee}
            className="px-3 py-1.5 rounded-xl bg-slate-700 hover:bg-slate-800 active:scale-95 text-white text-xs font-semibold shadow-xs flex items-center gap-1.5 cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            尝试脱离战斗 (DC 13)
          </button>
        </div>
      </div>

      {/* Combat Action Log */}
      {session.combatState.actionLogs.length > 0 && (
        <div className="pt-1">
          <button
            type="button"
            onClick={() => setExpandedLog(!expandedLog)}
            className="flex items-center justify-between w-full text-[11px] font-semibold text-slate-500 hover:text-slate-700 py-1"
          >
            <span>最新交锋战报 ({session.combatState.actionLogs.length} 条)</span>
            {expandedLog ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>

          <div
            className={`space-y-1 overflow-y-auto font-mono text-[11px] text-slate-600 bg-white/80 p-2 rounded-xl border border-slate-100 ${
              expandedLog ? 'max-h-48' : 'max-h-16'
            }`}
          >
            {session.combatState.actionLogs.slice(0, expandedLog ? 20 : 2).map((log) => (
              <div
                key={log.id}
                className={`py-0.5 border-b border-slate-50 last:border-0 ${
                  log.actorType === 'player'
                    ? 'text-sky-900'
                    : log.actorType === 'enemy'
                    ? 'text-rose-900'
                    : 'text-amber-900'
                }`}
              >
                <span className="font-bold mr-1">R{log.round}</span>
                {log.detail}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
