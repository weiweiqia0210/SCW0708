import React, { useState } from 'react';
import {
  X,
  BookMarked,
  Sparkles,
  Heart,
  ScrollText,
  Package,
  Users,
  Compass,
  Clock,
  Filter,
} from 'lucide-react';
import { TRPGSession, TRPGStoryLogEntry, StoryLogCategory } from '../../types/trpg';

interface TRPGStoryLogModalProps {
  isOpen: boolean;
  onClose: () => void;
  session: TRPGSession;
}

export const TRPGStoryLogModal: React.FC<TRPGStoryLogModalProps> = ({
  isOpen,
  onClose,
  session,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  if (!isOpen) return null;

  const logs = [...(session.storyLogs || [])].sort((a, b) => b.timestamp - a.timestamp);

  const filteredLogs = logs.filter((log) => {
    if (selectedCategory === 'all') return true;
    return log.category === selectedCategory;
  });

  const getCategoryMeta = (cat: StoryLogCategory) => {
    switch (cat) {
      case 'story':
        return {
          label: '关键剧情',
          color: 'bg-purple-100 text-purple-700 border-purple-200',
          icon: Sparkles,
        };
      case 'choice':
        return {
          label: '重大抉择',
          color: 'bg-indigo-100 text-indigo-700 border-indigo-200',
          icon: Compass,
        };
      case 'relation':
        return {
          label: '关系变动',
          color: 'bg-rose-100 text-rose-700 border-rose-200',
          icon: Heart,
        };
      case 'quest':
        return {
          label: '任务里程',
          color: 'bg-amber-100 text-amber-800 border-amber-200',
          icon: ScrollText,
        };
      case 'item':
        return {
          label: '物资调配',
          color: 'bg-sky-100 text-sky-700 border-sky-200',
          icon: Package,
        };
      case 'party':
        return {
          label: '小队变迁',
          color: 'bg-emerald-100 text-emerald-700 border-emerald-200',
          icon: Users,
        };
      default:
        return {
          label: '冒险记述',
          color: 'bg-slate-100 text-slate-700 border-slate-200',
          icon: BookMarked,
        };
    }
  };

  const formatTimestamp = (ts: number) => {
    const d = new Date(ts);
    return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
      <div className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl flex flex-col max-h-[88vh] overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-purple-50/70 via-white to-indigo-50/70 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-purple-600 text-white flex items-center justify-center shadow-xs shadow-purple-200">
              <BookMarked className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-slate-800">战役编年史与剧情纪事</h3>
                <span className="text-xs px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 font-semibold">
                  {logs.length} 条纪事
                </span>
              </div>
              <p className="text-xs text-slate-400">
                自动归档关键剧情、玩家抉择、人际转变与装备流转
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

        {/* Filter Pills */}
        <div className="px-6 py-2.5 border-b border-slate-100 bg-slate-50/60 flex items-center gap-1.5 overflow-x-auto shrink-0">
          {[
            { id: 'all', label: '全部纪事' },
            { id: 'story', label: '关键剧情' },
            { id: 'choice', label: '重大抉择' },
            { id: 'relation', label: '关系变动' },
            { id: 'quest', label: '任务历程' },
            { id: 'item', label: '装备物资' },
            { id: 'party', label: '小队变迁' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setSelectedCategory(tab.id)}
              className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-all cursor-pointer ${
                selectedCategory === tab.id
                  ? 'bg-purple-600 text-white shadow-xs'
                  : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Timeline Log List */}
        <div className="p-6 overflow-y-auto space-y-4 flex-1">
          {filteredLogs.length === 0 ? (
            <div className="py-12 text-center text-slate-400 space-y-2">
              <Clock className="w-10 h-10 mx-auto text-slate-300 stroke-[1.5]" />
              <p className="text-xs">暂无此分类的剧情纪事</p>
              <p className="text-[11px] text-slate-400">
                随着战役的深入推进，重大的决定、人际关系的升降与任务成败都会在此留下永恒印记。
              </p>
            </div>
          ) : (
            <div className="relative border-l-2 border-purple-100 ml-4 pl-4 space-y-4">
              {filteredLogs.map((log) => {
                const meta = getCategoryMeta(log.category);
                const IconComponent = meta.icon;

                return (
                  <div key={log.id} className="relative group">
                    {/* Timeline bullet */}
                    <div className="absolute -left-[25px] top-1.5 w-4 h-4 rounded-full bg-white border-2 border-purple-500 flex items-center justify-center">
                      <div className="w-1.5 h-1.5 rounded-full bg-purple-500"></div>
                    </div>

                    <div className="p-3.5 rounded-2xl bg-white border border-slate-200/90 shadow-xs hover:border-purple-200 transition-colors">
                      <div className="flex items-center justify-between gap-2 mb-1.5">
                        <div className="flex items-center gap-2">
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full border flex items-center gap-1 ${meta.color}`}
                          >
                            <IconComponent className="w-3 h-3" />
                            {meta.label}
                          </span>
                          <h4 className="text-xs font-bold text-slate-800">{log.title}</h4>
                        </div>
                        <span className="text-[10px] text-slate-400 font-mono">
                          {formatTimestamp(log.timestamp)}
                        </span>
                      </div>

                      <p className="text-xs text-slate-600 leading-relaxed">{log.detail}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
