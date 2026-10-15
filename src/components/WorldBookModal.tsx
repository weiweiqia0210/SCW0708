import React, { useState, useEffect } from 'react';
import { X, Plus, Trash2, Download, Upload, Check, Layers, Sliders } from 'lucide-react';
import { WorldBook, WorldBookEntry, WorldBookCategory, WorldBookInsertionPosition } from '../types';
import { downloadJsonFile } from '../utils/storage';

interface WorldBookModalProps {
  isOpen: boolean;
  worldBook: WorldBook | null;
  onClose: () => void;
  onSave: (wb: WorldBook) => void;
}

const ENTRY_CATEGORIES: { id: WorldBookCategory; label: string }[] = [
  { id: 'worldview', label: '世界观' },
  { id: 'faction', label: '势力/组织' },
  { id: 'location', label: '地点/场景' },
  { id: 'rule', label: '法则/禁忌' },
  { id: 'lore', label: '秘闻/传说' },
  { id: 'custom', label: '自定义' },
];

const INSERTION_POSITIONS: { id: WorldBookInsertionPosition; label: string; desc: string }[] = [
  { id: 'before_character', label: '角色设定前 (推荐)', desc: '在人物档案之前注入环境与世界观' },
  { id: 'system', label: '系统规则层', desc: '在最顶层作为系统底层最高法则注入' },
  { id: 'after_character', label: '角色设定后', desc: '在人物档案之后作为补充背景或势力规则' },
  { id: 'history_end', label: '上下文末尾', desc: '在最近剧情上下文末尾注入，即时强判定' },
];

export const WorldBookModal: React.FC<WorldBookModalProps> = ({
  isOpen,
  worldBook,
  onClose,
  onSave,
}) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('奇幻西幻');
  const [entries, setEntries] = useState<WorldBookEntry[]>([]);
  const [editingEntry, setEditingEntry] = useState<WorldBookEntry | null>(null);

  useEffect(() => {
    if (worldBook) {
      setTitle(worldBook.title);
      setDescription(worldBook.description);
      setCategory(worldBook.category);
      setEntries(
        (worldBook.entries || []).map((e) => ({
          ...e,
          priority: e.priority ?? 50,
          insertionPosition: e.insertionPosition || 'before_character',
        }))
      );
    } else {
      setTitle('');
      setDescription('');
      setCategory('奇幻西幻');
      setEntries([]);
    }
    setEditingEntry(null);
  }, [worldBook, isOpen]);

  if (!isOpen) return null;

  const handleAddEntry = () => {
    const newEntry: WorldBookEntry = {
      id: `wbe-${Date.now()}`,
      name: '新设定条目',
      category: 'worldview',
      keywords: ['关键词'],
      content: '',
      priority: 50,
      insertionPosition: 'before_character',
      enabled: true,
    };
    setEntries([...entries, newEntry]);
    setEditingEntry(newEntry);
  };

  const handleUpdateEntry = (updated: WorldBookEntry) => {
    setEntries(entries.map((e) => (e.id === updated.id ? updated : e)));
    setEditingEntry(null);
  };

  const handleDeleteEntry = (id: string) => {
    setEntries(entries.filter((e) => e.id !== id));
    if (editingEntry?.id === id) setEditingEntry(null);
  };

  const handleToggleEntry = (id: string) => {
    setEntries(entries.map((e) => (e.id === id ? { ...e, enabled: !e.enabled } : e)));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    const saved: WorldBook = {
      id: worldBook ? worldBook.id : `wb-${Date.now()}`,
      title: title.trim(),
      description: description.trim(),
      category: category.trim() || '通用',
      entries,
      updatedAt: Date.now(),
    };

    onSave(saved);
    onClose();
  };

  const handleExport = () => {
    if (!title) return;
    const data: WorldBook = {
      id: worldBook ? worldBook.id : `wb-${Date.now()}`,
      title,
      description,
      category,
      entries,
      updatedAt: Date.now(),
    };
    downloadJsonFile(`世界书-${title}.json`, JSON.stringify(data, null, 2));
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        if (parsed && parsed.title) {
          setTitle(parsed.title);
          setDescription(parsed.description || '');
          setCategory(parsed.category || '通用');
          if (Array.isArray(parsed.entries)) {
            setEntries(
              parsed.entries.map((e: any) => ({
                ...e,
                priority: e.priority ?? 50,
                insertionPosition: e.insertionPosition || 'before_character',
              }))
            );
          }
        }
      } catch {
        alert('导入世界书文件格式错误');
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/40 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="w-full max-w-xl bg-white rounded-2xl shadow-xl border border-sky-100 flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100">
          <span className="text-sm font-semibold text-slate-800">
            {worldBook ? '编辑世界书' : '创建新世界书'}
          </span>

          <div className="flex items-center gap-1.5">
            {worldBook && (
              <button
                type="button"
                onClick={handleExport}
                title="导出为JSON"
                className="p-1.5 rounded-lg text-slate-400 hover:text-sky-600 hover:bg-sky-50 transition-colors"
              >
                <Download className="w-4 h-4" />
              </button>
            )}
            <label
              title="导入世界书JSON"
              className="p-1.5 rounded-lg text-slate-400 hover:text-sky-600 hover:bg-sky-50 transition-colors cursor-pointer"
            >
              <Upload className="w-4 h-4" />
              <input type="file" accept=".json" onChange={handleImport} className="hidden" />
            </label>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="overflow-y-auto p-5 space-y-4 text-xs">
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <label className="block font-medium text-slate-700 mb-1">
                世界书名称 <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="例如：旧日回音与冰封大教堂"
                className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:border-sky-400"
              />
            </div>
            <div>
              <label className="block font-medium text-slate-700 mb-1">题材分类</label>
              <input
                type="text"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                placeholder="奇幻 / 科幻 / 悬疑"
                className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:border-sky-400"
              />
            </div>
          </div>

          <div>
            <label className="block font-medium text-slate-700 mb-1">世界观总体描述</label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="世界的大背景、气候、文明形态、核心矛盾与故事基调..."
              className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:border-sky-400"
            />
          </div>

          {/* Entries Section */}
          <div className="pt-2 border-t border-slate-100">
            <div className="flex items-center justify-between mb-2">
              <span className="font-medium text-slate-700">设定条目列表 ({entries.length})</span>
              <button
                type="button"
                onClick={handleAddEntry}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-sky-50 text-sky-600 hover:bg-sky-100 text-xs font-medium transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                添加条目
              </button>
            </div>

            {/* Entry Edit Sub-form */}
            {editingEntry && (
              <div className="p-3 mb-3 rounded-2xl border border-sky-300 bg-sky-50/50 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-800">编辑条目: {editingEntry.name}</span>
                  <button
                    type="button"
                    onClick={() => setEditingEntry(null)}
                    className="text-slate-400 hover:text-slate-600"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11px] text-slate-600 mb-0.5">条目名称</label>
                    <input
                      type="text"
                      value={editingEntry.name}
                      onChange={(e) => setEditingEntry({ ...editingEntry, name: e.target.value })}
                      className="w-full px-2 py-1.5 rounded-lg border border-slate-200 bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-600 mb-0.5">类别</label>
                    <select
                      value={editingEntry.category}
                      onChange={(e) =>
                        setEditingEntry({ ...editingEntry, category: e.target.value as WorldBookCategory })
                      }
                      className="w-full px-2 py-1.5 rounded-lg border border-slate-200 bg-white"
                    >
                      {ENTRY_CATEGORIES.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Priority & Insertion Position Feature */}
                <div className="grid grid-cols-2 gap-2 p-2 bg-white rounded-xl border border-sky-200/80">
                  <div>
                    <div className="flex items-center justify-between mb-0.5">
                      <label className="text-[11px] font-medium text-slate-700 flex items-center gap-1">
                        <Sliders className="w-3 h-3 text-sky-500" />
                        优先级 (Priority)
                      </label>
                      <span className="font-bold text-sky-600 text-[11px]">
                        {editingEntry.priority ?? 50}
                      </span>
                    </div>
                    <input
                      type="number"
                      min={1}
                      max={100}
                      value={editingEntry.priority ?? 50}
                      onChange={(e) =>
                        setEditingEntry({
                          ...editingEntry,
                          priority: parseInt(e.target.value, 10) || 50,
                        })
                      }
                      className="w-full px-2 py-1 rounded border border-slate-200 text-xs"
                      placeholder="1-100 (数值越大越优先)"
                    />
                    <span className="text-[9px] text-slate-400">1~100，数值越大排序越前</span>
                  </div>

                  <div>
                    <label className="block text-[11px] font-medium text-slate-700 mb-0.5 flex items-center gap-1">
                      <Layers className="w-3 h-3 text-sky-500" />
                      注入位置 (Position)
                    </label>
                    <select
                      value={editingEntry.insertionPosition || 'before_character'}
                      onChange={(e) =>
                        setEditingEntry({
                          ...editingEntry,
                          insertionPosition: e.target.value as WorldBookInsertionPosition,
                        })
                      }
                      className="w-full px-2 py-1 rounded border border-slate-200 text-xs bg-white"
                    >
                      {INSERTION_POSITIONS.map((pos) => (
                        <option key={pos.id} value={pos.id}>
                          {pos.label}
                        </option>
                      ))}
                    </select>
                    <span className="text-[9px] text-slate-400">
                      {
                        INSERTION_POSITIONS.find(
                          (p) => p.id === (editingEntry.insertionPosition || 'before_character')
                        )?.desc
                      }
                    </span>
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] text-slate-600 mb-0.5">
                    触发关键词（逗号分隔）
                  </label>
                  <input
                    type="text"
                    value={editingEntry.keywords.join(', ')}
                    onChange={(e) =>
                      setEditingEntry({
                        ...editingEntry,
                        keywords: e.target.value
                          .split(/[,，]/)
                          .map((s) => s.trim())
                          .filter(Boolean),
                      })
                    }
                    placeholder="例如：圣堂, 审判, 灰斑"
                    className="w-full px-2 py-1.5 rounded-lg border border-slate-200 bg-white"
                  />
                </div>

                <div>
                  <label className="block text-[11px] text-slate-600 mb-0.5">设定详细内容</label>
                  <textarea
                    rows={3}
                    value={editingEntry.content}
                    onChange={(e) => setEditingEntry({ ...editingEntry, content: e.target.value })}
                    placeholder="在此编写势力结构、地点特征、魔法规则或历史背景..."
                    className="w-full px-2 py-1.5 rounded-lg border border-slate-200 bg-white leading-relaxed"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => handleUpdateEntry(editingEntry)}
                    className="px-3 py-1 rounded-lg bg-sky-500 text-white font-medium hover:bg-sky-600"
                  >
                    完成条目编辑
                  </button>
                </div>
              </div>
            )}

            {/* Entries List */}
            <div className="space-y-1.5 max-h-52 overflow-y-auto">
              {entries.length === 0 ? (
                <div className="p-4 text-center text-slate-400 border border-dashed border-slate-200 rounded-xl">
                  暂未添加设定条目，点击上方“添加条目”进行扩充
                </div>
              ) : (
                entries.map((entry) => {
                  const posObj = INSERTION_POSITIONS.find(
                    (p) => p.id === (entry.insertionPosition || 'before_character')
                  );

                  return (
                    <div
                      key={entry.id}
                      className={`p-2.5 rounded-xl border flex items-center justify-between gap-2 transition-colors ${
                        entry.enabled
                          ? 'border-slate-200 bg-white'
                          : 'border-slate-100 bg-slate-50 opacity-60'
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-semibold text-slate-800 truncate">{entry.name}</span>
                          <span className="text-[10px] px-1.5 py-0.2 rounded bg-sky-50 text-sky-600 shrink-0">
                            {ENTRY_CATEGORIES.find((c) => c.id === entry.category)?.label || '设定'}
                          </span>
                          <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-100 text-slate-600 shrink-0">
                            优先级: {entry.priority ?? 50}
                          </span>
                          <span className="text-[10px] px-1.5 py-0.2 rounded bg-indigo-50 text-indigo-600 shrink-0">
                            {posObj?.label.split(' ')[0] || '默认位置'}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-400 truncate mt-0.5">
                          关键词: {entry.keywords.join(', ') || '无'}
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleToggleEntry(entry.id)}
                          className={`text-[10px] px-2 py-1 rounded-md border font-medium ${
                            entry.enabled
                              ? 'bg-sky-50 border-sky-200 text-sky-600'
                              : 'bg-slate-100 border-slate-200 text-slate-400'
                          }`}
                        >
                          {entry.enabled ? '启用中' : '已停用'}
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingEntry(entry)}
                          className="px-2 py-1 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-600 text-[11px]"
                        >
                          编辑
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteEntry(entry.id)}
                          className="p-1 rounded-md text-slate-400 hover:text-rose-500 hover:bg-rose-50"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

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
              className="px-5 py-2 rounded-xl bg-sky-500 hover:bg-sky-600 active:scale-95 text-white font-medium shadow-xs shadow-sky-200 transition-all cursor-pointer"
            >
              保存世界书
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
