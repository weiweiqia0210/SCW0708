import React, { useState } from 'react';
import {
  X,
  ScrollText,
  CheckCircle2,
  Circle,
  Clock,
  Sparkles,
  AlertCircle,
  Plus,
  Compass,
  Trophy,
} from 'lucide-react';
import { TRPGQuest, TRPGQuestCategory, TRPGSession, TRPGStoryLogEntry } from '../../types/trpg';

interface TRPGQuestModalProps {
  isOpen: boolean;
  onClose: () => void;
  session: TRPGSession;
  onUpdateSession: (updated: TRPGSession) => void;
}

export const TRPGQuestModal: React.FC<TRPGQuestModalProps> = ({
  isOpen,
  onClose,
  session,
  onUpdateSession,
}) => {
  const [activeTab, setActiveTab] = useState<'all' | TRPGQuestCategory>('all');
  const [isAddingQuest, setIsAddingQuest] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newCategory, setNewCategory] = useState<TRPGQuestCategory>('side');
  const [newDesc, setNewDesc] = useState('');
  const [newObjective, setNewObjective] = useState('');
  const [newRewards, setNewRewards] = useState('');

  if (!isOpen) return null;

  const quests = session.quests || [];

  // Filter quests:
  // Rule 7: Hidden quests must NEVER be shown before discovery (status !== 'undiscovered')!
  const visibleQuests = quests.filter((q) => {
    if (q.isHidden && q.status === 'undiscovered') {
      return false; // Strictly secret until discovered!
    }
    if (activeTab === 'all') return true;
    return q.category === activeTab;
  });

  const handleToggleObjective = (questId: string, objectiveId: string) => {
    const nextQuests = quests.map((q) => {
      if (q.id !== questId) return q;
      const nextObjs = q.objectives.map((o) =>
        o.id === objectiveId ? { ...o, done: !o.done } : o
      );
      return {
        ...q,
        objectives: nextObjs,
      };
    });

    const nextSession: TRPGSession = {
      ...session,
      quests: nextQuests,
      updatedAt: Date.now(),
    };
    onUpdateSession(nextSession);
  };

  const handleCompleteQuest = (questId: string) => {
    let questTitle = '';
    const nextQuests = quests.map((q) => {
      if (q.id !== questId) return q;
      questTitle = q.title;
      return {
        ...q,
        status: 'completed' as const,
        completedAt: Date.now(),
        objectives: q.objectives.map((o) => ({ ...o, done: true })),
      };
    });

    const logEntry: TRPGStoryLogEntry = {
      id: `log-quest-${Date.now()}`,
      category: 'quest',
      title: `任务已达成：${questTitle}`,
      detail: '经由不懈探索与决断，此任务已顺利宣告完成。',
      timestamp: Date.now(),
    };

    const nextSession: TRPGSession = {
      ...session,
      quests: nextQuests,
      storyLogs: [...(session.storyLogs || []), logEntry],
      updatedAt: Date.now(),
    };
    onUpdateSession(nextSession);
  };

  const handleCreateCustomQuest = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    const newQuest: TRPGQuest = {
      id: `quest-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      title: newTitle.trim(),
      category: newCategory,
      status: 'active',
      description: newDesc.trim() || '冒险者自发立下的任务与誓约。',
      currentObjective: newObjective.trim() || '探寻第一手线索',
      objectives: [
        {
          id: `obj-${Date.now()}-1`,
          text: newObjective.trim() || '探寻第一手线索',
          done: false,
        },
      ],
      rewards: newRewards.trim() || undefined,
      isHidden: newCategory === 'hidden',
      discoveredAt: Date.now(),
    };

    const logEntry: TRPGStoryLogEntry = {
      id: `log-quest-${Date.now()}`,
      category: 'quest',
      title: `新任务建立：${newQuest.title}`,
      detail: `目标：${newQuest.currentObjective}`,
      timestamp: Date.now(),
    };

    const nextSession: TRPGSession = {
      ...session,
      quests: [newQuest, ...quests],
      storyLogs: [...(session.storyLogs || []), logEntry],
      updatedAt: Date.now(),
    };

    onUpdateSession(nextSession);
    setIsAddingQuest(false);
    setNewTitle('');
    setNewDesc('');
    setNewObjective('');
    setNewRewards('');
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
      <div className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl flex flex-col max-h-[88vh] overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-amber-50/60 via-white to-sky-50/40 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500 text-white flex items-center justify-center shadow-xs shadow-amber-200">
              <ScrollText className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-slate-800">任务委托与冒险目标</h3>
                <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 font-semibold">
                  {visibleQuests.filter((q) => q.status === 'active').length} 进行中
                </span>
              </div>
              <p className="text-xs text-slate-400">
                主线指引、支线委托与已洞察的隐藏篇章
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

        {/* Category Tabs & Add Button */}
        <div className="px-6 py-2.5 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-1.5 overflow-x-auto py-0.5">
            {[
              { id: 'all', label: '全部' },
              { id: 'main', label: '主线' },
              { id: 'side', label: '支线' },
              { id: 'hidden', label: '隐藏篇章' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-all cursor-pointer ${
                  activeTab === tab.id
                    ? 'bg-slate-800 text-white shadow-xs'
                    : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <button
            onClick={() => setIsAddingQuest(!isAddingQuest)}
            className="px-2.5 py-1 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-semibold flex items-center gap-1 shadow-xs transition-colors cursor-pointer shrink-0"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>自立誓约</span>
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-4 flex-1">
          {/* Custom Quest Creator Form */}
          {isAddingQuest && (
            <form
              onSubmit={handleCreateCustomQuest}
              className="p-4 rounded-2xl bg-amber-50/50 border border-amber-200/80 space-y-3 animate-in slide-in-from-top-2"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-amber-900 flex items-center gap-1.5">
                  <Compass className="w-4 h-4 text-amber-600" />
                  自立新的目标 / 誓约
                </span>
                <button
                  type="button"
                  onClick={() => setIsAddingQuest(false)}
                  className="text-slate-400 hover:text-slate-600 text-xs"
                >
                  取消
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <div className="sm:col-span-2">
                  <input
                    type="text"
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    placeholder="任务标题，如：调查废弃钟楼的异响"
                    className="w-full px-3 py-1.5 text-xs bg-white border border-amber-200 rounded-xl focus:outline-hidden focus:border-amber-400"
                    required
                  />
                </div>
                <div>
                  <select
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value as TRPGQuestCategory)}
                    className="w-full px-3 py-1.5 text-xs bg-white border border-amber-200 rounded-xl focus:outline-hidden focus:border-amber-400"
                  >
                    <option value="main">主线任务</option>
                    <option value="side">支线委托</option>
                    <option value="hidden">隐藏篇章</option>
                  </select>
                </div>
              </div>

              <div>
                <input
                  type="text"
                  value={newObjective}
                  onChange={(e) => setNewObjective(e.target.value)}
                  placeholder="当前第一步目标，如：在子夜前潜入钟楼底层"
                  className="w-full px-3 py-1.5 text-xs bg-white border border-amber-200 rounded-xl focus:outline-hidden focus:border-amber-400"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <input
                  type="text"
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  placeholder="背景简述（选填）"
                  className="w-full px-3 py-1.5 text-xs bg-white border border-amber-200 rounded-xl focus:outline-hidden focus:border-amber-400"
                />
                <input
                  type="text"
                  value={newRewards}
                  onChange={(e) => setNewRewards(e.target.value)}
                  placeholder="悬赏/报酬说明（选填）"
                  className="w-full px-3 py-1.5 text-xs bg-white border border-amber-200 rounded-xl focus:outline-hidden focus:border-amber-400"
                />
              </div>

              <div className="flex justify-end pt-1">
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold shadow-xs cursor-pointer"
                >
                  确认加入任务列表
                </button>
              </div>
            </form>
          )}

          {/* Quests List */}
          {visibleQuests.length === 0 ? (
            <div className="py-12 text-center text-slate-400 space-y-2">
              <ScrollText className="w-10 h-10 mx-auto text-slate-300 stroke-[1.5]" />
              <p className="text-xs">暂无符合条件的任务目标</p>
              <p className="text-[11px] text-slate-400">
                在与酒馆老板交谈、探索古迹或遇到突发危机时，DM 会随剧情自动为你揭晓新任务。
              </p>
            </div>
          ) : (
            visibleQuests.map((quest) => {
              const isCompleted = quest.status === 'completed';
              const isFailed = quest.status === 'failed';

              return (
                <div
                  key={quest.id}
                  className={`p-4 rounded-2xl border transition-all ${
                    isCompleted
                      ? 'bg-slate-50/80 border-slate-200 opacity-80'
                      : isFailed
                      ? 'bg-rose-50/40 border-rose-200'
                      : quest.category === 'hidden'
                      ? 'bg-purple-50/30 border-purple-200 shadow-xs'
                      : 'bg-white border-slate-200 shadow-xs hover:border-amber-300'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                          quest.category === 'main'
                            ? 'bg-amber-100 text-amber-800 border-amber-300'
                            : quest.category === 'hidden'
                            ? 'bg-purple-100 text-purple-800 border-purple-300'
                            : 'bg-sky-100 text-sky-800 border-sky-300'
                        }`}
                      >
                        {quest.category === 'main'
                          ? '主线'
                          : quest.category === 'hidden'
                          ? '✨ 隐藏篇章'
                          : '支线'}
                      </span>
                      <h4
                        className={`text-sm font-bold ${
                          isCompleted
                            ? 'line-through text-slate-500'
                            : 'text-slate-800'
                        }`}
                      >
                        {quest.title}
                      </h4>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${
                          isCompleted
                            ? 'bg-emerald-100 text-emerald-700'
                            : isFailed
                            ? 'bg-rose-100 text-rose-700'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {isCompleted
                          ? '已达成'
                          : isFailed
                          ? '已失败'
                          : '进行中'}
                      </span>

                      {!isCompleted && !isFailed && (
                        <button
                          onClick={() => handleCompleteQuest(quest.id)}
                          className="px-2 py-0.5 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-600 hover:text-white border border-emerald-200 text-[10px] font-semibold transition-colors cursor-pointer"
                          title="手动标记任务完成"
                        >
                          标记达成
                        </button>
                      )}
                    </div>
                  </div>

                  <p className="text-xs text-slate-600 mb-3 leading-relaxed">
                    {quest.description}
                  </p>

                  {/* Current Objective Callout */}
                  <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100 text-xs flex items-start gap-2 mb-3">
                    <Clock className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-semibold text-slate-700">当前行动导向：</span>
                      <span className="text-slate-800 font-medium">
                        {quest.currentObjective || '继续探索推进'}
                      </span>
                    </div>
                  </div>

                  {/* Objectives Checklist */}
                  {quest.objectives && quest.objectives.length > 0 && (
                    <div className="space-y-1.5 pt-1 border-t border-slate-100">
                      <div className="text-[11px] font-semibold text-slate-400">推进阶段：</div>
                      {quest.objectives.map((obj) => (
                        <button
                          key={obj.id}
                          type="button"
                          onClick={() => handleToggleObjective(quest.id, obj.id)}
                          className="flex items-center gap-2 text-xs text-left w-full hover:bg-slate-50 p-1 rounded-lg cursor-pointer transition-colors"
                        >
                          {obj.done ? (
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                          ) : (
                            <Circle className="w-3.5 h-3.5 text-slate-300 shrink-0" />
                          )}
                          <span
                            className={
                              obj.done ? 'line-through text-slate-400' : 'text-slate-700'
                            }
                          >
                            {obj.text}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Rewards */}
                  {quest.rewards && (
                    <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center gap-1.5 text-[11px] text-amber-700 font-medium">
                      <Trophy className="w-3.5 h-3.5 text-amber-500" />
                      <span>战役报酬：{quest.rewards}</span>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
