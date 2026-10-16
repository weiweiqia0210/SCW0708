import React, { useState } from 'react';
import { Plus, Edit2, Trash2, Download, Search, Sparkles, Book, Sliders, UserCircle } from 'lucide-react';
import { CharacterCard, WorldBook, SystemPreset } from '../types';
import { downloadJsonFile } from '../utils/storage';

interface CreateHubViewProps {
  characters: CharacterCard[];
  worldbooks: WorldBook[];
  presets: SystemPreset[];
  onOpenCharacterModal: (char: CharacterCard | null) => void;
  onDeleteCharacter: (id: string) => void;
  onOpenWorldBookModal: (wb: WorldBook | null) => void;
  onDeleteWorldBook: (id: string) => void;
  onOpenPresetModal: (preset: SystemPreset | null) => void;
  onDeletePreset: (id: string) => void;
}

export const CreateHubView: React.FC<CreateHubViewProps> = ({
  characters,
  worldbooks,
  presets,
  onOpenCharacterModal,
  onDeleteCharacter,
  onOpenWorldBookModal,
  onDeleteWorldBook,
  onOpenPresetModal,
  onDeletePreset,
}) => {
  const [activeTab, setActiveTab] = useState<'characters' | 'worldbooks' | 'presets'>('characters');
  const [searchQuery, setSearchQuery] = useState('');
  const [confirmDeleteCharId, setConfirmDeleteCharId] = useState<string | null>(null);
  const [confirmDeleteWorldBookId, setConfirmDeleteWorldBookId] = useState<string | null>(null);
  const [confirmDeletePresetId, setConfirmDeletePresetId] = useState<string | null>(null);

  const filteredCharacters = characters.filter(
    (c) =>
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.identity.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.personality.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredWorldBooks = worldbooks.filter(
    (wb) =>
      wb.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      wb.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
      wb.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredPresets = presets.filter(
    (p) =>
      p.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="max-w-xl mx-auto px-4 pt-4 pb-24 space-y-4">
      {/* Sub Header Segmented Switcher */}
      <div className="flex p-1 bg-slate-100/80 rounded-xl border border-slate-200/60">
        <button
          onClick={() => setActiveTab('characters')}
          className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-medium transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
            activeTab === 'characters'
              ? 'bg-white text-sky-600 shadow-xs'
              : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          <UserCircle className="w-3.5 h-3.5" />
          角色卡 ({characters.length})
        </button>
        <button
          onClick={() => setActiveTab('worldbooks')}
          className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-medium transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
            activeTab === 'worldbooks'
              ? 'bg-white text-sky-600 shadow-xs'
              : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          <Book className="w-3.5 h-3.5" />
          世界书 ({worldbooks.length})
        </button>
        <button
          onClick={() => setActiveTab('presets')}
          className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-medium transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
            activeTab === 'presets'
              ? 'bg-white text-sky-600 shadow-xs'
              : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          <Sliders className="w-3.5 h-3.5" />
          预设模板 ({presets.length})
        </button>
      </div>

      {/* Search & New Button */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={
              activeTab === 'characters'
                ? '搜索角色姓名、身份、性格...'
                : activeTab === 'worldbooks'
                ? '搜索世界书名称或词条...'
                : '搜索预设模板...'
            }
            className="w-full pl-8 pr-3 py-1.5 rounded-xl border border-slate-200 bg-white text-xs placeholder:text-slate-400 focus:outline-none focus:border-sky-400"
          />
        </div>

        <button
          onClick={() => {
            if (activeTab === 'characters') onOpenCharacterModal(null);
            else if (activeTab === 'worldbooks') onOpenWorldBookModal(null);
            else onOpenPresetModal(null);
          }}
          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-sky-500 hover:bg-sky-600 active:scale-95 text-white text-xs font-medium shadow-xs shadow-sky-200 transition-all shrink-0 cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" />
          新建
        </button>
      </div>

      {/* Tab 1: Characters */}
      {activeTab === 'characters' && (
        <div className="space-y-2.5">
          {filteredCharacters.length === 0 ? (
            <div className="py-12 px-4 text-center text-xs text-slate-400 bg-white rounded-2xl border border-dashed border-slate-200 space-y-1.5">
              <div className="text-base">📇</div>
              <div className="font-medium text-slate-600">
                {searchQuery ? '未找到匹配的角色卡' : '暂无角色卡'}
              </div>
              <div className="text-[11px] text-slate-400">
                {searchQuery ? '请尝试更换搜索关键词' : '点击右上角「新建」创建属于您的第一张角色卡'}
              </div>
            </div>
          ) : (
            filteredCharacters.map((char) => (
              <div
                key={char.id}
                className="p-3.5 rounded-2xl bg-white border border-slate-100 hover:border-sky-200 hover:shadow-xs transition-all"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-sky-100 text-sky-700 flex items-center justify-center font-bold text-sm shrink-0 shadow-xs overflow-hidden border border-sky-200/80">
                      {char.avatarImage ? (
                        <img src={char.avatarImage} alt={char.name} className="w-full h-full object-cover" />
                      ) : (
                        <span>{char.name.slice(0, 1)}</span>
                      )}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-slate-800">{char.name}</span>
                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-100 text-slate-600">
                          {char.identity}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-400 mt-0.5">
                        {char.gender} · {char.age}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() =>
                        downloadJsonFile(`角色卡-${char.name}.json`, JSON.stringify(char, null, 2))
                      }
                      title="导出JSON"
                      className="p-1.5 rounded-lg text-slate-400 hover:text-sky-600 hover:bg-sky-50 transition-colors cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => onOpenCharacterModal(char)}
                      title="编辑角色卡"
                      className="p-1.5 rounded-lg text-slate-400 hover:text-sky-600 hover:bg-sky-50 transition-colors cursor-pointer"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    {confirmDeleteCharId === char.id ? (
                      <div className="flex items-center gap-1 px-1.5 py-0.5 rounded-lg bg-rose-50 border border-rose-200">
                        <span className="text-[10px] text-rose-700 font-medium">确认删除？</span>
                        <button
                          onClick={() => {
                            onDeleteCharacter(char.id);
                            setConfirmDeleteCharId(null);
                          }}
                          className="px-1.5 py-0.5 bg-rose-500 hover:bg-rose-600 text-white rounded text-[10px] font-medium cursor-pointer"
                        >
                          删除
                        </button>
                        <button
                          onClick={() => setConfirmDeleteCharId(null)}
                          className="px-1.5 py-0.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded text-[10px] cursor-pointer"
                        >
                          取消
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setConfirmDeleteCharId(char.id)}
                        title="删除角色卡"
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-50 transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                <div className="mt-2.5 pt-2.5 border-t border-slate-50 text-xs text-slate-500 line-clamp-2 leading-relaxed">
                  <span className="text-slate-400">性格：</span>
                  {char.personality || '暂无详细性格设定'}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Tab 2: World Books */}
      {activeTab === 'worldbooks' && (
        <div className="space-y-2.5">
          {filteredWorldBooks.length === 0 ? (
            <div className="py-12 text-center text-xs text-slate-400 bg-white rounded-2xl border border-dashed border-slate-200">
              未找到匹配的世界书
            </div>
          ) : (
            filteredWorldBooks.map((wb) => (
              <div
                key={wb.id}
                className="p-3.5 rounded-2xl bg-white border border-slate-100 hover:border-sky-200 hover:shadow-xs transition-all"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-slate-800">{wb.title}</span>
                      <span className="text-[10px] px-1.5 py-0.2 rounded bg-indigo-50 text-indigo-600">
                        {wb.category}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-400 mt-1 line-clamp-2">
                      {wb.description || '暂无总述'}
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() =>
                        downloadJsonFile(`世界书-${wb.title}.json`, JSON.stringify(wb, null, 2))
                      }
                      title="导出JSON"
                      className="p-1.5 rounded-lg text-slate-400 hover:text-sky-600 hover:bg-sky-50 transition-colors cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => onOpenWorldBookModal(wb)}
                      title="编辑世界书"
                      className="p-1.5 rounded-lg text-slate-400 hover:text-sky-600 hover:bg-sky-50 transition-colors cursor-pointer"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    {confirmDeleteWorldBookId === wb.id ? (
                      <div className="flex items-center gap-1 px-1.5 py-0.5 rounded-lg bg-rose-50 border border-rose-200">
                        <span className="text-[10px] text-rose-700 font-medium">确认删除？</span>
                        <button
                          onClick={() => {
                            onDeleteWorldBook(wb.id);
                            setConfirmDeleteWorldBookId(null);
                          }}
                          className="px-1.5 py-0.5 bg-rose-500 hover:bg-rose-600 text-white rounded text-[10px] font-medium cursor-pointer"
                        >
                          删除
                        </button>
                        <button
                          onClick={() => setConfirmDeleteWorldBookId(null)}
                          className="px-1.5 py-0.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded text-[10px] cursor-pointer"
                        >
                          取消
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setConfirmDeleteWorldBookId(wb.id)}
                        title="删除世界书"
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-50 transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                <div className="mt-2.5 pt-2 border-t border-slate-50 flex items-center justify-between text-[11px] text-slate-400">
                  <span>包含 {wb.entries?.length || 0} 个设定条目</span>
                  <span className="text-sky-600 cursor-pointer" onClick={() => onOpenWorldBookModal(wb)}>
                    查看详情条目 →
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Tab 3: Presets */}
      {activeTab === 'presets' && (
        <div className="space-y-2.5">
          {filteredPresets.length === 0 ? (
            <div className="py-12 text-center text-xs text-slate-400 bg-white rounded-2xl border border-dashed border-slate-200">
              未找到匹配的预设模板
            </div>
          ) : (
            filteredPresets.map((preset) => (
              <div
                key={preset.id}
                className="p-3.5 rounded-2xl bg-white border border-slate-100 hover:border-sky-200 hover:shadow-xs transition-all"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-slate-800">{preset.title}</span>
                      <span className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-50 text-emerald-600">
                        提示词预设
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-400 mt-1 line-clamp-2">
                      {preset.description || '暂无描述'}
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() =>
                        downloadJsonFile(`预设-${preset.title}.json`, JSON.stringify(preset, null, 2))
                      }
                      title="导出JSON"
                      className="p-1.5 rounded-lg text-slate-400 hover:text-sky-600 hover:bg-sky-50 transition-colors cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => onOpenPresetModal(preset)}
                      title="编辑预设"
                      className="p-1.5 rounded-lg text-slate-400 hover:text-sky-600 hover:bg-sky-50 transition-colors cursor-pointer"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    {confirmDeletePresetId === preset.id ? (
                      <div className="flex items-center gap-1 px-1.5 py-0.5 rounded-lg bg-rose-50 border border-rose-200">
                        <span className="text-[10px] text-rose-700 font-medium">确认删除？</span>
                        <button
                          onClick={() => {
                            onDeletePreset(preset.id);
                            setConfirmDeletePresetId(null);
                          }}
                          className="px-1.5 py-0.5 bg-rose-500 hover:bg-rose-600 text-white rounded text-[10px] font-medium cursor-pointer"
                        >
                          删除
                        </button>
                        <button
                          onClick={() => setConfirmDeletePresetId(null)}
                          className="px-1.5 py-0.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded text-[10px] cursor-pointer"
                        >
                          取消
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setConfirmDeletePresetId(preset.id)}
                        title="删除预设"
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-50 transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                <div className="mt-2.5 pt-2 border-t border-slate-50 text-[11px] text-slate-500 line-clamp-2 font-mono">
                  {preset.contentPrompt || '暂无自定义提示词'}
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};
