import React, { useState, useEffect } from 'react';
import { X, Download, Upload } from 'lucide-react';
import { SystemPreset } from '../types';
import { downloadJsonFile } from '../utils/storage';

interface PresetModalProps {
  isOpen: boolean;
  preset: SystemPreset | null;
  onClose: () => void;
  onSave: (p: SystemPreset) => void;
}

export const PresetModal: React.FC<PresetModalProps> = ({
  isOpen,
  preset,
  onClose,
  onSave,
}) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [contentPrompt, setContentPrompt] = useState('');

  useEffect(() => {
    if (preset) {
      setTitle(preset.title);
      setDescription(preset.description);
      setContentPrompt(preset.contentPrompt || '');
    } else {
      setTitle('');
      setDescription('');
      setContentPrompt('');
    }
  }, [preset, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    const saved: SystemPreset = {
      id: preset ? preset.id : `preset-${Date.now()}`,
      title: title.trim(),
      description: description.trim(),
      contentPrompt: contentPrompt.trim(),
      updatedAt: Date.now(),
    };

    onSave(saved);
    onClose();
  };

  const handleExport = () => {
    if (!title) return;
    const data: SystemPreset = {
      id: preset ? preset.id : `preset-${Date.now()}`,
      title,
      description,
      contentPrompt,
      updatedAt: Date.now(),
    };
    downloadJsonFile(`预设-${title}.json`, JSON.stringify(data, null, 2));
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
          setContentPrompt(parsed.contentPrompt || parsed.stylePrompt || '');
        }
      } catch {
        alert('导入预设文件格式错误');
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/40 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="w-full max-w-lg bg-white rounded-2xl shadow-xl border border-sky-100 flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100">
          <span className="text-sm font-semibold text-slate-800">
            {preset ? '编辑预设' : '创建新预设'}
          </span>

          <div className="flex items-center gap-1.5">
            {preset && (
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
              title="导入预设JSON"
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
          <div>
            <label className="block font-medium text-slate-700 mb-1">
              预设名称 <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="例如：沉浸长篇互动小说"
              className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:border-sky-400"
            />
          </div>

          <div>
            <label className="block font-medium text-slate-700 mb-1">预设简述</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="预设简介..."
              className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:border-sky-400"
            />
          </div>

          <div>
            <label className="block font-medium text-slate-700 mb-1">
              预设提示词内容 <span className="text-rose-500">*</span>
            </label>
            <textarea
              rows={8}
              required
              value={contentPrompt}
              onChange={(e) => setContentPrompt(e.target.value)}
              placeholder="在此输入预设的系统提示词、文风规范与叙事要求..."
              className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:border-sky-400 leading-relaxed font-mono text-xs"
            />
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
              保存预设
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
