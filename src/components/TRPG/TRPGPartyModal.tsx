import React, { useState } from 'react';
import {
  X,
  Users,
  Heart,
  ShieldCheck,
  UserPlus,
  UserMinus,
  Sparkles,
  ArrowRightLeft,
  UserCheck,
  MessageSquare,
  Target,
  EyeOff,
  UserX,
  BookOpen,
} from 'lucide-react';
import {
  TRPGSession,
  TRPGCompanion,
  TRPGNpcRelation,
  TRPGStoryLogEntry,
} from '../../types/trpg';
import { CharacterCard } from '../../types';
import { createTRPGCharacterFromCard } from '../../utils/trpgStorage';
import { TRPGItemTransferModal } from './TRPGItemTransferModal';

interface TRPGPartyModalProps {
  isOpen: boolean;
  onClose: () => void;
  session: TRPGSession;
  characterCards: CharacterCard[]; // Available base cards in system to recruit
  onUpdateSession: (updated: TRPGSession) => void;
}

export const TRPGPartyModal: React.FC<TRPGPartyModalProps> = ({
  isOpen,
  onClose,
  session,
  characterCards,
  onUpdateSession,
}) => {
  const [subTab, setSubTab] = useState<'companions' | 'npcs'>('companions');
  const [isRecruitingOpen, setIsRecruitingOpen] = useState(false);
  const [transferringCompanion, setTransferringCompanion] = useState<TRPGCompanion | null>(null);

  // New NPC modal
  const [isAddingNpc, setIsAddingNpc] = useState(false);
  const [npcName, setNpcName] = useState('');
  const [npcIdentity, setNpcIdentity] = useState('');
  const [npcAttitude, setNpcAttitude] = useState<'friendly' | 'neutral' | 'hostile' | 'allied' | 'suspicious'>('neutral');
  const [npcNotes, setNpcNotes] = useState('');

  if (!isOpen) return null;

  const companions = session.companions || [];
  const npcRelations = session.npcRelations || [];

  const activeCompanions = companions.filter((c) => c.status === 'active');
  const formerCompanions = companions.filter((c) => c.status !== 'active');

  // Dismiss a companion
  const handleDismissCompanion = (companionId: string) => {
    const reason = prompt('请输入解雇或暂别该同伴的理由（将载入剧情纪事）：', '协商一致暂时在据点修整待命') || '在路口告别';

    const nextCompanions = companions.map((c) => {
      if (c.id !== companionId) return c;
      return {
        ...c,
        status: 'dismissed' as const,
        leftReason: reason,
      };
    });

    const targetComp = companions.find((c) => c.id === companionId);
    const logEntry: TRPGStoryLogEntry = {
      id: `log-pty-${Date.now()}`,
      category: 'party',
      title: `队友离队：${targetComp?.name || '同伴'}`,
      detail: reason,
      timestamp: Date.now(),
    };

    onUpdateSession({
      ...session,
      companions: nextCompanions,
      storyLogs: [...(session.storyLogs || []), logEntry],
      updatedAt: Date.now(),
    });
  };

  // Re-recruit a former companion
  const handleReRecruitCompanion = (companionId: string) => {
    const nextCompanions = companions.map((c) => {
      if (c.id !== companionId) return c;
      return {
        ...c,
        status: 'active' as const,
        leftReason: undefined,
      };
    });

    const targetComp = companions.find((c) => c.id === companionId);
    const logEntry: TRPGStoryLogEntry = {
      id: `log-pty-${Date.now()}`,
      category: 'party',
      title: `队友重新入队：${targetComp?.name || '同伴'}`,
      detail: '重整旗鼓，再度结伴踏上征程。',
      timestamp: Date.now(),
    };

    onUpdateSession({
      ...session,
      companions: nextCompanions,
      storyLogs: [...(session.storyLogs || []), logEntry],
      updatedAt: Date.now(),
    });
  };

  // Recruit an existing CharacterCard as companion
  const handleRecruitFromCard = (card: CharacterCard) => {
    // Generate new TRPG character for companion
    const newChar = createTRPGCharacterFromCard(card, session.rulesetSnapshot);

    const newCompanion: TRPGCompanion = {
      id: `comp-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      name: card.name,
      originCharacterId: card.id,
      character: newChar,
      status: 'active',
      favorability: 20, // Initial friendly starting favor
      trust: 35,
      relationshipTitle: '结识的同行者',
      personalGoal: card.customNotes || '探索未知世界，实现个人理想',
      hiddenNotes: card.background || undefined,
      joinedAt: Date.now(),
    };

    const logEntry: TRPGStoryLogEntry = {
      id: `log-pty-${Date.now()}`,
      category: 'party',
      title: `新队友加入：${newCompanion.name}`,
      detail: `${newCompanion.name}（${card.identity || '自由冒险者'}）正式加入你的探索小队。`,
      timestamp: Date.now(),
    };

    onUpdateSession({
      ...session,
      companions: [...companions, newCompanion],
      storyLogs: [...(session.storyLogs || []), logEntry],
      updatedAt: Date.now(),
    });

    setIsRecruitingOpen(false);
  };

  // Add NPC
  const handleAddNpc = (e: React.FormEvent) => {
    e.preventDefault();
    if (!npcName.trim()) return;

    const newNpc: TRPGNpcRelation = {
      id: `npc-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      name: npcName.trim(),
      identity: npcIdentity.trim() || '过客',
      attitude: npcAttitude,
      favorability: npcAttitude === 'friendly' ? 20 : npcAttitude === 'hostile' ? -20 : 0,
      trust: 30,
      notes: npcNotes.trim() || '初次打交道',
      firstMetAt: Date.now(),
      updatedAt: Date.now(),
    };

    const logEntry: TRPGStoryLogEntry = {
      id: `log-rel-${Date.now()}`,
      category: 'relation',
      title: `结识新人物：${newNpc.name}`,
      detail: `身份：${newNpc.identity}，初印象：${newNpc.notes}`,
      timestamp: Date.now(),
    };

    onUpdateSession({
      ...session,
      npcRelations: [newNpc, ...npcRelations],
      storyLogs: [...(session.storyLogs || []), logEntry],
      updatedAt: Date.now(),
    });

    setIsAddingNpc(false);
    setNpcName('');
    setNpcIdentity('');
    setNpcNotes('');
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
      <div className="bg-white w-full max-w-3xl rounded-3xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Top Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-emerald-50/70 via-white to-sky-50/70 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shadow-xs shadow-emerald-200">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-slate-800">同行队友与人际网络</h3>
                <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-semibold">
                  {activeCompanions.length} 位在队队友
                </span>
              </div>
              <p className="text-xs text-slate-400">
                好感度与信任度真实左右剧情交涉、协助战斗与个人夙愿
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
            title="返回便携终端"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="px-6 py-2.5 border-b border-slate-100 bg-slate-50/60 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setSubTab('companions')}
              className={`px-3.5 py-1 rounded-full text-xs font-bold transition-all cursor-pointer ${
                subTab === 'companions'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
              }`}
            >
              同行小队 ({activeCompanions.length})
            </button>
            <button
              onClick={() => setSubTab('npcs')}
              className={`px-3.5 py-1 rounded-full text-xs font-bold transition-all cursor-pointer ${
                subTab === 'npcs'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
              }`}
            >
              NPC 关系网 ({npcRelations.length})
            </button>
          </div>

          {subTab === 'companions' ? (
            <button
              onClick={() => setIsRecruitingOpen(true)}
              className="px-2.5 py-1 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold flex items-center gap-1 shadow-xs transition-colors cursor-pointer"
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>招募队友</span>
            </button>
          ) : (
            <button
              onClick={() => setIsAddingNpc(true)}
              className="px-2.5 py-1 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-semibold flex items-center gap-1 shadow-xs transition-colors cursor-pointer"
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>记录新NPC</span>
            </button>
          )}
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-4 flex-1">
          {subTab === 'companions' ? (
            <>
              {/* Active Companions */}
              {activeCompanions.length === 0 ? (
                <div className="py-12 text-center text-slate-400 space-y-2">
                  <Users className="w-10 h-10 mx-auto text-slate-300 stroke-[1.5]" />
                  <p className="text-xs">当前暂无同行队友，你正在独行历练</p>
                  <p className="text-[11px] text-slate-400">
                    你可以点击右上角「招募队友」从角色卡库中邀请同行伙伴，或在剧情中自然结识。
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {activeCompanions.map((comp) => {
                    const cChar = comp.character;
                    return (
                      <div
                        key={comp.id}
                        className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs hover:border-emerald-300 transition-all space-y-3"
                      >
                        {/* Top Info */}
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center gap-3">
                            {cChar.avatarImage ? (
                              <img
                                src={cChar.avatarImage}
                                alt={comp.name}
                                className="w-11 h-11 rounded-2xl object-cover border border-emerald-200"
                              />
                            ) : (
                              <div className="w-11 h-11 rounded-2xl bg-emerald-100 text-emerald-800 font-bold flex items-center justify-center text-sm border border-emerald-200">
                                {comp.name.slice(0, 1)}
                              </div>
                            )}

                            <div>
                              <div className="flex items-center gap-2">
                                <h4 className="text-sm font-bold text-slate-800">
                                  {comp.name}
                                </h4>
                                <span className="text-[10px] px-2 py-0.2 rounded-full bg-emerald-100 text-emerald-800 font-semibold border border-emerald-200">
                                  {cChar.characterClass || '同伴'} (Lv.{cChar.level || 1})
                                </span>
                                {comp.relationshipTitle && (
                                  <span className="text-[10px] px-2 py-0.2 rounded-full bg-indigo-50 text-indigo-700 font-medium border border-indigo-100">
                                    {comp.relationshipTitle}
                                  </span>
                                )}
                              </div>
                              <div className="text-[11px] text-slate-400 mt-0.5">
                                生命 HP: {cChar.currentHp}/{cChar.maxHp} · 装备行囊:{' '}
                                {cChar.inventory?.length || 0} 件
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            <button
                              type="button"
                              onClick={() => setTransferringCompanion(comp)}
                              className="px-2.5 py-1 rounded-xl bg-sky-50 text-sky-700 hover:bg-sky-600 hover:text-white border border-sky-200 text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                              title="分配/调配装备物资"
                            >
                              <ArrowRightLeft className="w-3.5 h-3.5" />
                              <span>调配装备</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => handleDismissCompanion(comp.id)}
                              className="px-2 py-1 rounded-xl bg-slate-50 text-slate-500 hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200 border border-slate-200 text-xs font-medium transition-colors cursor-pointer"
                              title="协商解雇或暂时离队"
                            >
                              <UserMinus className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        {/* Relationship Meters (Favor & Trust) */}
                        <div className="grid grid-cols-2 gap-3 p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                          {/* Favorability (-100 to 100) */}
                          <div className="space-y-1">
                            <div className="flex items-center justify-between text-[11px]">
                              <span className="text-slate-600 font-medium flex items-center gap-1">
                                <Heart className="w-3 h-3 text-rose-500 fill-current" />
                                好感度
                              </span>
                              <span
                                className={`font-mono font-bold ${
                                  comp.favorability >= 30
                                    ? 'text-emerald-600'
                                    : comp.favorability <= -30
                                    ? 'text-rose-600'
                                    : 'text-slate-600'
                                }`}
                              >
                                {comp.favorability > 0 ? `+${comp.favorability}` : comp.favorability}
                              </span>
                            </div>
                            <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden">
                              <div
                                className={`h-full transition-all duration-300 ${
                                  comp.favorability >= 30
                                    ? 'bg-emerald-500'
                                    : comp.favorability <= -30
                                    ? 'bg-rose-500'
                                    : 'bg-amber-400'
                                }`}
                                style={{
                                  width: `${Math.min(100, Math.max(5, ((comp.favorability + 100) / 200) * 100))}%`,
                                }}
                              />
                            </div>
                          </div>

                          {/* Trust (0 to 100) */}
                          <div className="space-y-1">
                            <div className="flex items-center justify-between text-[11px]">
                              <span className="text-slate-600 font-medium flex items-center gap-1">
                                <ShieldCheck className="w-3 h-3 text-sky-500" />
                                信任度
                              </span>
                              <span className="font-mono font-bold text-sky-600">
                                {comp.trust}%
                              </span>
                            </div>
                            <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-sky-500 transition-all duration-300"
                                style={{ width: `${Math.min(100, Math.max(5, comp.trust))}%` }}
                              />
                            </div>
                          </div>
                        </div>

                        {/* Personality & Goals Callout */}
                        <div className="text-xs text-slate-600 space-y-1">
                          {comp.personalGoal && (
                            <div className="flex items-start gap-1.5">
                              <Target className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
                              <span className="font-medium text-slate-700">个人夙愿：</span>
                              <span>{comp.personalGoal}</span>
                            </div>
                          )}
                          {comp.character.personality && (
                            <div className="flex items-start gap-1.5">
                              <MessageSquare className="w-3.5 h-3.5 text-indigo-500 shrink-0 mt-0.5" />
                              <span className="font-medium text-slate-700">行事作风：</span>
                              <span>{comp.character.personality}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Former / Departed Companions (Preserved state!) */}
              {formerCompanions.length > 0 && (
                <div className="pt-4 border-t border-slate-100">
                  <div className="text-xs font-bold text-slate-400 mb-2">已离队同伴档案</div>
                  <div className="space-y-2">
                    {formerCompanions.map((fc) => (
                      <div
                        key={fc.id}
                        className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between text-xs"
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-slate-700">{fc.name}</span>
                            <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-200 text-slate-600">
                              {fc.status === 'dismissed' ? '已离任' : '剧情离队'}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-400 mt-0.5">
                            离队原因：{fc.leftReason || '暂行离开'}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleReRecruitCompanion(fc.id)}
                          className="px-2.5 py-1 rounded-lg bg-white border border-slate-200 hover:border-emerald-300 text-emerald-700 text-xs font-medium cursor-pointer"
                        >
                          重新迎回
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : (
            /* SubTab 2: NPC Relations */
            <div className="space-y-3">
              {isAddingNpc && (
                <form
                  onSubmit={handleAddNpc}
                  className="p-4 rounded-2xl bg-sky-50/50 border border-sky-200 space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-sky-900">登记相逢 NPC</span>
                    <button
                      type="button"
                      onClick={() => setIsAddingNpc(false)}
                      className="text-slate-400 hover:text-slate-600 text-xs"
                    >
                      取消
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <div>
                      <input
                        type="text"
                        value={npcName}
                        onChange={(e) => setNpcName(e.target.value)}
                        placeholder="NPC 姓名"
                        className="w-full px-3 py-1.5 text-xs bg-white border border-sky-200 rounded-xl focus:outline-hidden"
                        required
                      />
                    </div>
                    <div>
                      <input
                        type="text"
                        value={npcIdentity}
                        onChange={(e) => setNpcIdentity(e.target.value)}
                        placeholder="身份/势力，如：酒馆老板"
                        className="w-full px-3 py-1.5 text-xs bg-white border border-sky-200 rounded-xl focus:outline-hidden"
                      />
                    </div>
                    <div>
                      <select
                        value={npcAttitude}
                        onChange={(e) => setNpcAttitude(e.target.value as any)}
                        className="w-full px-3 py-1.5 text-xs bg-white border border-sky-200 rounded-xl focus:outline-hidden"
                      >
                        <option value="friendly">友善</option>
                        <option value="neutral">中立</option>
                        <option value="suspicious">警惕</option>
                        <option value="hostile">敌对</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <input
                      type="text"
                      value={npcNotes}
                      onChange={(e) => setNpcNotes(e.target.value)}
                      placeholder="初始交互备注或恩怨"
                      className="w-full px-3 py-1.5 text-xs bg-white border border-sky-200 rounded-xl focus:outline-hidden"
                    />
                  </div>

                  <div className="flex justify-end">
                    <button
                      type="submit"
                      className="px-4 py-1.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-semibold cursor-pointer"
                    >
                      保存记录
                    </button>
                  </div>
                </form>
              )}

              {npcRelations.length === 0 ? (
                <div className="py-12 text-center text-slate-400 space-y-2">
                  <UserCheck className="w-10 h-10 mx-auto text-slate-300 stroke-[1.5]" />
                  <p className="text-xs">暂无 NPC 人际记录</p>
                  <p className="text-[11px] text-slate-400">
                    在剧情交涉或探访城镇时，DM 会根据你的选择与态度实时增进或恶化与各方角色的关系。
                  </p>
                </div>
              ) : (
                npcRelations.map((npc) => (
                  <div
                    key={npc.id}
                    className="p-3.5 rounded-2xl bg-white border border-slate-200 shadow-xs flex items-start justify-between gap-3"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-slate-800">{npc.name}</span>
                        <span className="text-[10px] px-2 py-0.2 rounded-full bg-slate-100 text-slate-700 font-medium">
                          {npc.identity || '重要人物'}
                        </span>
                        <span
                          className={`text-[10px] px-2 py-0.2 rounded-full font-bold ${
                            npc.attitude === 'friendly'
                              ? 'bg-emerald-100 text-emerald-800'
                              : npc.attitude === 'hostile'
                              ? 'bg-rose-100 text-rose-800'
                              : npc.attitude === 'suspicious'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {npc.attitude === 'friendly'
                            ? '友善'
                            : npc.attitude === 'hostile'
                            ? '敌视'
                            : npc.attitude === 'suspicious'
                            ? '疑忌'
                            : '中立'}
                        </span>
                      </div>

                      <div className="flex items-center gap-3 text-xs text-slate-500">
                        <span>好感: {npc.favorability > 0 ? `+${npc.favorability}` : npc.favorability}</span>
                        <span>·</span>
                        <span>信任: {npc.trust}%</span>
                      </div>

                      {npc.notes && (
                        <p className="text-xs text-slate-600 leading-relaxed pt-1">
                          {npc.notes}
                        </p>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>

      {/* Recruitment Modal from Existing Character Cards */}
      {isRecruitingOpen && (
        <div className="fixed inset-0 z-60 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-lg rounded-3xl p-6 shadow-2xl space-y-4 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h4 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                <UserPlus className="w-4 h-4 text-emerald-600" />
                选择角色卡邀请入队
              </h4>
              <button
                onClick={() => setIsRecruitingOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-500">
              从现有的角色卡库中挑选一名角色加入队伍。其职业、技能与属性直接读取卡面，绝不改动母卡。
            </p>

            <div className="space-y-2 max-h-[50vh] overflow-y-auto">
              {characterCards.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-400">
                  角色卡库暂无卡片，可前往创作中心创建角色卡
                </div>
              ) : (
                characterCards.map((card) => {
                  const alreadyInParty = activeCompanions.some(
                    (c) => c.originCharacterId === card.id || c.name === card.name
                  );
                  return (
                    <div
                      key={card.id}
                      className="p-3 rounded-2xl border border-slate-200 flex items-center justify-between hover:border-emerald-300 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        {card.avatarImage ? (
                          <img
                            src={card.avatarImage}
                            alt={card.name}
                            className="w-10 h-10 rounded-xl object-cover"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-600 font-bold flex items-center justify-center text-xs">
                            {card.name.slice(0, 1)}
                          </div>
                        )}
                        <div>
                          <div className="text-xs font-bold text-slate-800">{card.name}</div>
                          <div className="text-[11px] text-slate-400 truncate max-w-[200px]">
                            {card.identity || '冒险伙伴'}
                          </div>
                        </div>
                      </div>

                      <button
                        type="button"
                        disabled={alreadyInParty}
                        onClick={() => handleRecruitFromCard(card)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                          alreadyInParty
                            ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                            : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs'
                        }`}
                      >
                        {alreadyInParty ? '已在队中' : '邀请入队'}
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* Item Transfer Modal */}
      {transferringCompanion && (
        <TRPGItemTransferModal
          isOpen={true}
          onClose={() => setTransferringCompanion(null)}
          session={session}
          companion={transferringCompanion}
          onUpdateSession={onUpdateSession}
        />
      )}
    </div>
  );
};
