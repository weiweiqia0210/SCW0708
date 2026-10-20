import React from 'react';
import { Play, Plus, BookOpen, Clock, Users, ArrowRight, UserCircle, Book, Sliders } from 'lucide-react';
import { StorySave, CharacterCard, StoryMode } from '../types';

interface HomeViewProps {
  saves: StorySave[];
  characters: CharacterCard[];
  worldbookCount: number;
  presetCount: number;
  onContinueSave: (saveId: string) => void;
  onOpenNewStoryModal: (initialMode?: StoryMode) => void;
  onNavigateToTab: (tab: 'create' | 'shelf' | 'settings' | 'profile') => void;
}

export const HomeView: React.FC<HomeViewProps> = ({
  saves,
  characters,
  worldbookCount,
  presetCount,
  onContinueSave,
  onOpenNewStoryModal,
  onNavigateToTab,
}) => {
  // Sort saves by updatedAt descending
  const sortedSaves = [...saves].sort((a, b) => b.updatedAt - a.updatedAt);
  const latestSave = sortedSaves[0];
  const recentSaves = sortedSaves.slice(1, 4);

  const formatRelativeTime = (timestamp: number) => {
    const diff = Date.now() - timestamp;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return '刚刚';
    if (minutes < 60) return `${minutes}分钟前`;
    if (hours < 24) return `${hours}小时前`;
    return `${days}天前`;
  };

  const getCharacterNames = (charIds: string[]) => {
    return charIds
      .map(id => characters.find(c => c.id === id)?.name)
      .filter(Boolean)
      .join('、') || '自定义角色';
  };

  return (
    <div className="max-w-xl mx-auto px-4 pt-4 pb-24 space-y-4">
      {/* Brand Header */}
      <div className="flex items-center justify-between px-1 pt-0.5 pb-1">
        <div className="flex items-center gap-2.5">
          <img
            src="./icons/icon-192.png"
            alt="塔可"
            className="w-9 h-9 rounded-xl shadow-xs border border-sky-100 object-contain bg-white p-0.5"
          />
          <div>
            <h1 className="text-base font-bold text-slate-800 tracking-tight leading-none">塔可</h1>
            <p className="text-[10px] text-slate-400 mt-1">清透水色 · 沉浸式 AI 互动文游</p>
          </div>
        </div>
      </div>

      {/* Top Action Row: Continue Last Played or Start New */}
      {latestSave ? (
        <div className="relative overflow-hidden rounded-2xl border border-sky-200/80 bg-gradient-to-br from-white via-sky-50/40 to-sky-100/30 p-4 shadow-sm shadow-sky-100">
          <div className="flex items-center justify-between text-xs font-medium text-sky-600 mb-1.5">
            <span className="flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" />
              上次游玩 · {formatRelativeTime(latestSave.updatedAt)}
            </span>
            <span className="px-2 py-0.5 rounded-full bg-sky-100 text-sky-700 text-[11px]">
              {latestSave.messages.length} 轮互动
            </span>
          </div>

          <h2 className="text-base font-semibold text-slate-800 line-clamp-1 mb-1">
            {latestSave.title}
          </h2>

          <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed mb-3">
            {latestSave.messages.length > 0
              ? latestSave.messages[latestSave.messages.length - 1].content.slice(0, 100)
              : latestSave.openingPremise}
          </p>

          <div className="flex items-center justify-between pt-2 border-t border-sky-100/80">
            <span className="text-[11px] text-slate-400 truncate max-w-[180px]">
              {getCharacterNames(latestSave.characterIds)}
            </span>
            <button
              onClick={() => onContinueSave(latestSave.id)}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-sky-500 hover:bg-sky-600 active:scale-95 text-white text-xs font-medium shadow-sm shadow-sky-300 transition-all cursor-pointer"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              继续游玩
            </button>
          </div>
        </div>
      ) : null}

      {/* Primary CTAs: New Story & Novel Mode */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        <button
          onClick={() => onOpenNewStoryModal('single')}
          className="flex items-center justify-between p-3.5 rounded-2xl bg-white border border-sky-200 shadow-xs hover:border-sky-300 hover:shadow-sm transition-all group active:scale-[0.99] text-left cursor-pointer"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center border border-sky-100 group-hover:bg-sky-500 group-hover:text-white transition-colors shrink-0">
              <Plus className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="text-sm font-semibold text-slate-800 truncate">新建文游开档</div>
              <div className="text-xs text-slate-400 truncate">单人专属 / 多人群像互动档</div>
            </div>
          </div>
          <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-sky-500 group-hover:translate-x-0.5 transition-all shrink-0" />
        </button>

        <button
          onClick={() => onOpenNewStoryModal('novel')}
          className="flex items-center justify-between p-3.5 rounded-2xl bg-gradient-to-r from-white via-indigo-50/20 to-purple-50/30 border border-indigo-200/90 shadow-xs hover:border-indigo-300 hover:shadow-sm transition-all group active:scale-[0.99] text-left cursor-pointer"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center border border-indigo-100 group-hover:bg-indigo-600 group-hover:text-white transition-colors shrink-0">
              <BookOpen className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="text-sm font-semibold text-slate-800 flex items-center gap-1.5 truncate">
                <span>新建小说模式</span>
                <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-indigo-100 text-indigo-700 font-medium">新模式</span>
              </div>
              <div className="text-xs text-indigo-500/80 truncate">沉浸连载长篇 · 章节推演</div>
            </div>
          </div>
          <ArrowRight className="w-4 h-4 text-indigo-300 group-hover:text-indigo-500 group-hover:translate-x-0.5 transition-all shrink-0" />
        </button>
      </div>

      {/* Quick Access to Creative Materials */}
      <div>
        <div className="text-xs font-medium text-slate-400 px-1 mb-2.5">创作资源库</div>
        <div className="grid grid-cols-3 gap-2.5">
          <button
            onClick={() => onNavigateToTab('create')}
            className="flex flex-col items-center p-3 rounded-xl bg-white border border-slate-100 hover:border-sky-200 hover:bg-sky-50/30 transition-all text-center cursor-pointer shadow-xs"
          >
            <div className="w-8 h-8 rounded-lg bg-sky-50 text-sky-600 flex items-center justify-center mb-1.5">
              <UserCircle className="w-4 h-4" />
            </div>
            <span className="text-xs font-medium text-slate-700">角色卡</span>
            <span className="text-[10px] text-slate-400 mt-0.5">{characters.length} 个角色</span>
          </button>

          <button
            onClick={() => onNavigateToTab('create')}
            className="flex flex-col items-center p-3 rounded-xl bg-white border border-slate-100 hover:border-sky-200 hover:bg-sky-50/30 transition-all text-center cursor-pointer shadow-xs"
          >
            <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center mb-1.5">
              <Book className="w-4 h-4" />
            </div>
            <span className="text-xs font-medium text-slate-700">世界书</span>
            <span className="text-[10px] text-slate-400 mt-0.5">{worldbookCount} 部设定</span>
          </button>

          <button
            onClick={() => onNavigateToTab('create')}
            className="flex flex-col items-center p-3 rounded-xl bg-white border border-slate-100 hover:border-sky-200 hover:bg-sky-50/30 transition-all text-center cursor-pointer shadow-xs"
          >
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center mb-1.5">
              <Sliders className="w-4 h-4" />
            </div>
            <span className="text-xs font-medium text-slate-700">预设模板</span>
            <span className="text-[10px] text-slate-400 mt-0.5">{presetCount} 套规范</span>
          </button>
        </div>
      </div>

      {/* Recent Saves List */}
      <div>
        <div className="flex items-center justify-between text-xs font-medium text-slate-400 px-1 mb-2.5">
          <span>最近存档</span>
          {saves.length > 0 && (
            <button
              onClick={() => onNavigateToTab('shelf')}
              className="text-sky-600 hover:text-sky-700 text-xs font-normal flex items-center gap-0.5 cursor-pointer"
            >
              全部书架 ({saves.length})
              <ArrowRight className="w-3 h-3" />
            </button>
          )}
        </div>

        {sortedSaves.length === 0 ? (
          <div className="py-8 px-4 rounded-2xl border border-dashed border-slate-200 text-center bg-white/60">
            <BookOpen className="w-8 h-8 mx-auto text-slate-300 mb-2" />
            <div className="text-xs font-medium text-slate-600">暂无游玩存档</div>
            <div className="text-[11px] text-slate-400 mt-1">
              点击上方“新建文游开档”，开启你的第一场互动冒险
            </div>
          </div>
        ) : (
          <div className="space-y-2.5">
            {recentSaves.map((save) => (
              <div
                key={save.id}
                onClick={() => onContinueSave(save.id)}
                className="p-3.5 rounded-xl bg-white border border-slate-100 hover:border-sky-200 hover:shadow-xs transition-all cursor-pointer flex items-center justify-between gap-3"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-semibold text-slate-800 truncate">
                      {save.title}
                    </span>
                    <span className={`shrink-0 text-[10px] px-1.5 py-0.2 rounded font-medium ${
                      save.mode === 'novel'
                        ? 'bg-indigo-50 text-indigo-700'
                        : save.mode === 'single'
                        ? 'bg-slate-100 text-slate-500'
                        : 'bg-amber-50 text-amber-700'
                    }`}>
                      {save.mode === 'novel' ? '小说' : save.mode === 'single' ? '单人' : '群像'}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-400 truncate">
                    {getCharacterNames(save.characterIds)}
                  </div>
                </div>

                <div className="flex flex-col items-end shrink-0 gap-1">
                  <span className="text-[10px] text-slate-400">
                    {formatRelativeTime(save.updatedAt)}
                  </span>
                  <span className="text-[11px] font-medium text-sky-600 flex items-center gap-0.5">
                    进入 <ArrowRight className="w-3 h-3" />
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
