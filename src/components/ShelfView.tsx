import React, { useState } from 'react';
import { BookOpen, Search, Play, Trash2, Download, Upload, Edit3, Clock, Users, User, ArrowRight, Copy, Check } from 'lucide-react';
import { StorySave, CharacterCard } from '../types';
import { downloadJsonFile } from '../utils/storage';

interface ShelfViewProps {
  saves: StorySave[];
  characters: CharacterCard[];
  onContinueSave: (saveId: string) => void;
  onDeleteSave: (saveId: string) => void;
  onRenameSave: (saveId: string, newTitle: string) => void;
  onImportSave: (save: StorySave) => void;
  onDuplicateSave?: (save: StorySave) => void;
  onOpenNewStory: () => void;
}

export const ShelfView: React.FC<ShelfViewProps> = ({
  saves,
  characters,
  onContinueSave,
  onDeleteSave,
  onRenameSave,
  onImportSave,
  onDuplicateSave,
  onOpenNewStory,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [modeFilter, setModeFilter] = useState<'all' | 'single' | 'multi' | 'novel'>('all');
  const [editingSaveId, setEditingSaveId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState('');
  const [saveToDelete, setSaveToDelete] = useState<StorySave | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const filteredSaves = saves
    .filter((s) => {
      if (modeFilter === 'all') return true;
      return s.mode === modeFilter;
    })
    .filter((s) => {
      const matchTitle = s.title.toLowerCase().includes(searchQuery.toLowerCase());
      const matchPremise = s.openingPremise.toLowerCase().includes(searchQuery.toLowerCase());
      return matchTitle || matchPremise;
    })
    .sort((a, b) => b.updatedAt - a.updatedAt);

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
    return (
      charIds
        .map((id) => characters.find((c) => c.id === id)?.name)
        .filter(Boolean)
        .join('、') || '未知角色'
    );
  };

  const handleExportSave = (save: StorySave) => {
    downloadJsonFile(`文游存档-${save.title}.json`, JSON.stringify(save, null, 2));
  };

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        if (parsed && parsed.title && Array.isArray(parsed.messages)) {
          const importedSave: StorySave = {
            ...parsed,
            id: `save-${Date.now()}`,
            updatedAt: Date.now(),
          };
          onImportSave(importedSave);
        } else {
          alert('导入失败：存档文件格式不符合文游规范');
        }
      } catch {
        alert('导入解析失败，请检查文件格式');
      }
    };
    reader.readAsText(file);
  };

  const [copiedSaveId, setCopiedSaveId] = useState<string | null>(null);

  const handleStartRename = (save: StorySave) => {
    setEditingSaveId(save.id);
    setEditingTitle(save.title);
  };

  const handleConfirmRename = (saveId: string) => {
    if (editingTitle.trim()) {
      onRenameSave(saveId, editingTitle.trim());
    }
    setEditingSaveId(null);
  };

  const handleDuplicate = (save: StorySave, e: React.MouseEvent) => {
    e.stopPropagation();
    if (onDuplicateSave) {
      onDuplicateSave(save);
    } else {
      const duplicated: StorySave = {
        ...save,
        id: `save-${Date.now()}`,
        title: `${save.title} (副本)`,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        stats: save.stats ? JSON.parse(JSON.stringify(save.stats)) : [],
        messages: save.messages ? JSON.parse(JSON.stringify(save.messages)) : [],
        config: { ...save.config },
      };
      onImportSave(duplicated);
    }
    setCopiedSaveId(save.id);
    setTimeout(() => setCopiedSaveId(null), 1500);
  };

  return (
    <div className="max-w-xl mx-auto px-4 pt-4 pb-24 space-y-4">
      {/* Search and Filters */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="搜索文游存档标题或剧情..."
            className="w-full pl-8 pr-3 py-1.5 rounded-xl border border-slate-200 bg-white text-xs placeholder:text-slate-400 focus:outline-none focus:border-sky-400"
          />
        </div>

        <label
          title="导入存档JSON"
          className="p-1.5 rounded-xl border border-slate-200 bg-white hover:bg-sky-50 hover:text-sky-600 text-slate-500 cursor-pointer transition-colors shrink-0"
        >
          <Upload className="w-4 h-4" />
          <input type="file" accept=".json" onChange={handleImportFile} className="hidden" />
        </label>
      </div>

      {/* Mode Filter Tabs */}
      <div className="flex items-center gap-1.5 text-xs">
        <button
          onClick={() => setModeFilter('all')}
          className={`px-3 py-1 rounded-lg border transition-all ${
            modeFilter === 'all'
              ? 'border-sky-400 bg-sky-50 text-sky-700 font-medium'
              : 'border-slate-200 text-slate-500 hover:border-slate-300'
          }`}
        >
          全部存档 ({saves.length})
        </button>
        <button
          onClick={() => setModeFilter('single')}
          className={`px-3 py-1 rounded-lg border transition-all ${
            modeFilter === 'single'
              ? 'border-sky-400 bg-sky-50 text-sky-700 font-medium'
              : 'border-slate-200 text-slate-500 hover:border-slate-300'
          }`}
        >
          单人档
        </button>
        <button
          onClick={() => setModeFilter('multi')}
          className={`px-3 py-1 rounded-lg border transition-all ${
            modeFilter === 'multi'
              ? 'border-sky-400 bg-sky-50 text-sky-700 font-medium'
              : 'border-slate-200 text-slate-500 hover:border-slate-300'
          }`}
        >
          群像档
        </button>
        <button
          onClick={() => setModeFilter('novel')}
          className={`px-3 py-1 rounded-lg border transition-all ${
            modeFilter === 'novel'
              ? 'border-indigo-400 bg-indigo-50 text-indigo-700 font-medium'
              : 'border-slate-200 text-slate-500 hover:border-slate-300'
          }`}
        >
          小说档
        </button>
      </div>

      {/* Saves List */}
      <div className="space-y-3">
        {filteredSaves.length === 0 ? (
          <div className="py-16 text-center bg-white rounded-2xl border border-dashed border-slate-200">
            <BookOpen className="w-10 h-10 mx-auto text-slate-300 mb-2" />
            <div className="text-xs font-medium text-slate-600">书架空空如也</div>
            <div className="text-[11px] text-slate-400 mt-1">创建属于你的第一场冒险</div>
            <button
              onClick={onOpenNewStory}
              className="mt-4 px-4 py-1.5 bg-sky-500 hover:bg-sky-600 text-white rounded-xl text-xs font-medium transition-all shadow-xs"
            >
              新建文游
            </button>
          </div>
        ) : (
          filteredSaves.map((save) => {
            const isEditing = editingSaveId === save.id;
            const lastMsg = save.messages[save.messages.length - 1];

            return (
              <div
                key={save.id}
                className="p-4 rounded-2xl bg-white border border-slate-100 hover:border-sky-200 hover:shadow-xs transition-all space-y-3"
              >
                {/* Header row */}
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    {isEditing ? (
                      <div className="flex items-center gap-1.5">
                        <input
                          type="text"
                          value={editingTitle}
                          onChange={(e) => setEditingTitle(e.target.value)}
                          className="px-2 py-1 rounded border border-sky-400 text-xs flex-1"
                          autoFocus
                        />
                        <button
                          onClick={() => handleConfirmRename(save.id)}
                          className="px-2 py-1 bg-sky-500 text-white text-xs rounded"
                        >
                          保存
                        </button>
                        <button
                          onClick={() => setEditingSaveId(null)}
                          className="px-2 py-1 bg-slate-100 text-slate-600 text-xs rounded"
                        >
                          取消
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-slate-800 text-sm truncate">
                          {save.title}
                        </h3>
                        <span
                          className={`shrink-0 text-[10px] px-1.5 py-0.2 rounded font-medium ${
                            save.mode === 'novel'
                              ? 'bg-indigo-50 text-indigo-700 border border-indigo-100'
                              : save.mode === 'single'
                              ? 'bg-slate-100 text-slate-600'
                              : 'bg-amber-50 text-amber-700'
                          }`}
                        >
                          {save.mode === 'novel' ? '小说' : save.mode === 'single' ? '单人' : '群像'}
                        </span>
                      </div>
                    )}

                    <div className="flex items-center gap-2 text-[11px] text-slate-400 mt-1">
                      <span>角色: {getCharacterNames(save.characterIds)}</span>
                      <span>·</span>
                      <span>{save.messages.length} 轮互动</span>
                      <span>·</span>
                      <span>{formatRelativeTime(save.updatedAt)}</span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 shrink-0">
                    {confirmDeleteId === save.id ? (
                      <div className="flex items-center gap-1.5 px-2 py-1 rounded-xl bg-rose-50 border border-rose-200 animate-in fade-in">
                        <span className="text-[11px] font-medium text-rose-700">确认删除？</span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onDeleteSave(save.id);
                            setConfirmDeleteId(null);
                          }}
                          className="px-2 py-0.5 bg-rose-500 hover:bg-rose-600 active:scale-95 text-white rounded text-[10px] font-medium transition-colors cursor-pointer shadow-2xs"
                        >
                          确认
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setConfirmDeleteId(null);
                          }}
                          className="px-2 py-0.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded text-[10px] transition-colors cursor-pointer"
                        >
                          取消
                        </button>
                      </div>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={(e) => handleDuplicate(save, e)}
                          title="复制存档档案"
                          className="p-1.5 rounded-lg text-slate-400 hover:text-sky-600 hover:bg-sky-50 transition-colors cursor-pointer"
                        >
                          {copiedSaveId === save.id ? (
                            <Check className="w-3.5 h-3.5 text-emerald-500" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>
                        <button
                          onClick={() => handleStartRename(save)}
                          title="重命名存档"
                          className="p-1.5 rounded-lg text-slate-400 hover:text-sky-600 hover:bg-sky-50 transition-colors"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleExportSave(save)}
                          title="导出存档为JSON"
                          className="p-1.5 rounded-lg text-slate-400 hover:text-sky-600 hover:bg-sky-50 transition-colors"
                        >
                          <Download className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setConfirmDeleteId(save.id);
                          }}
                          title="删除存档"
                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-50 transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {/* Preview text */}
                <div className="p-2.5 rounded-xl bg-slate-50/70 text-xs text-slate-600 line-clamp-2 leading-relaxed">
                  {save.mode === 'novel' ? (
                    <span>
                      {save.novelProject && save.novelProject.chapters?.length > 0 ? (
                        <>
                          【共 {save.novelProject.chapters.length} 章】
                          {save.novelProject.chapters[0].content
                            ? save.novelProject.chapters[0].content.slice(0, 100) + '...'
                            : save.summary || save.openingPremise || '崭新的长篇小说项目，点击进入写作'}
                        </>
                      ) : (
                        save.summary || save.openingPremise || '长篇小说项目'
                      )}
                    </span>
                  ) : lastMsg ? (
                    lastMsg.content
                  ) : (
                    save.openingPremise
                  )}
                </div>

                {/* Bottom button */}
                <div className="flex items-center justify-between pt-1">
                  <div className="text-[10px] text-slate-400 flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    创建于 {new Date(save.createdAt).toLocaleDateString('zh-CN')}
                  </div>

                  <button
                    onClick={() => onContinueSave(save.id)}
                    className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-white text-xs font-medium shadow-xs transition-all cursor-pointer active:scale-95 ${
                      save.mode === 'novel'
                        ? 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-200'
                        : 'bg-sky-500 hover:bg-sky-600 shadow-sky-200'
                    }`}
                  >
                    {save.mode === 'novel' ? (
                      <>
                        <BookOpen className="w-3 h-3" />
                        <span>进入写作</span>
                      </>
                    ) : (
                      <>
                        <Play className="w-3 h-3 fill-current" />
                        <span>进入游玩</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Custom In-App Deletion Confirmation Modal */}
      {saveToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-sm rounded-2xl bg-white p-5 border border-slate-200 shadow-xl space-y-3.5">
            <div className="flex items-center gap-2 text-rose-600 font-semibold text-sm">
              <Trash2 className="w-4 h-4" />
              确认删除存档
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              确认永久删除存档《<span className="font-semibold text-slate-800">{saveToDelete.title}</span>》吗？删除后此存档及其历史剧情记录将无法恢复。
            </p>
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setSaveToDelete(null)}
                className="px-3.5 py-1.5 rounded-xl border border-slate-200 text-xs text-slate-600 hover:bg-slate-50 transition-colors cursor-pointer"
              >
                取消
              </button>
              <button
                type="button"
                onClick={() => {
                  onDeleteSave(saveToDelete.id);
                  setSaveToDelete(null);
                }}
                className="px-4 py-1.5 rounded-xl bg-rose-500 hover:bg-rose-600 text-xs font-medium text-white shadow-xs transition-colors cursor-pointer"
              >
                确认删除
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
