import React, { useState } from 'react';
import {
  X,
  Sparkles,
  Bot,
  Brain,
  Terminal,
  Cat,
  Image as ImageIcon,
  Check,
  RotateCcw,
  Sliders,
  Flame,
  FileText,
  Lightbulb,
} from 'lucide-react';
import { DialogueAISettings } from '../../types';
import { DEFAULT_AI_SETTINGS, PROMPT_PRESETS } from '../../utils/dialogueStorage';

interface DialogueAISettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: DialogueAISettings;
  onSave: (updated: DialogueAISettings) => void;
}

export const DialogueAISettingsModal: React.FC<DialogueAISettingsModalProps> = ({
  isOpen,
  onClose,
  settings,
  onSave,
}) => {
  const [formData, setFormData] = useState<DialogueAISettings>(settings);
  const [activeTab, setActiveTab] = useState<'prompt' | 'persona'>('prompt');
  const [customAvatarInput, setCustomAvatarInput] = useState(settings.avatarUrl || '');

  if (!isOpen) return null;

  const handleApplyPreset = (preset: (typeof PROMPT_PRESETS)[0]) => {
    setFormData((prev) => ({
      ...prev,
      name: preset.name,
      customPersonaTitle: preset.title,
      avatarType: preset.avatarType,
      themeColor: preset.themeColor,
      systemPrompt: preset.systemPrompt,
    }));
  };

  const handleSave = () => {
    onSave({
      ...formData,
      avatarUrl: customAvatarInput.trim() || undefined,
    });
    onClose();
  };

  const handleReset = () => {
    setFormData(DEFAULT_AI_SETTINGS);
    setCustomAvatarInput('');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="w-full max-w-xl bg-white rounded-3xl shadow-2xl border border-slate-200/90 overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-slate-50 via-white to-sky-50/50 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-sky-500 text-white flex items-center justify-center shadow-xs shadow-sky-200">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-slate-800">AI 助手设定与提示词</h3>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-sky-100 text-sky-800 font-bold font-mono">
                  GPT/Gemini/DeepSeek
                </span>
              </div>
              <p className="text-xs text-slate-400">
                点击头像自定义模型人设、系统提示词与深度思考模式
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
            title="关闭设置"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab switch */}
        <div className="flex border-b border-slate-100 bg-slate-50/70 p-1.5 gap-1 shrink-0 px-5">
          <button
            type="button"
            onClick={() => setActiveTab('prompt')}
            className={`flex-1 py-1.5 text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
              activeTab === 'prompt'
                ? 'bg-white text-sky-700 shadow-xs'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>核心提示词与指令</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('persona')}
            className={`flex-1 py-1.5 text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
              activeTab === 'persona'
                ? 'bg-white text-sky-700 shadow-xs'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>形象与思考参数</span>
          </button>
        </div>

        {/* Body */}
        <div className="p-5 overflow-y-auto space-y-4 flex-1">
          {activeTab === 'prompt' && (
            <div className="space-y-4">
              {/* Presets Bar */}
              <div>
                <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5 mb-2">
                  <Lightbulb className="w-3.5 h-3.5 text-amber-500" />
                  <span>快捷预置模板（点击一键注入）</span>
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {PROMPT_PRESETS.map((preset) => (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => handleApplyPreset(preset)}
                      className="p-2.5 rounded-xl border border-slate-200/80 hover:border-sky-300 hover:bg-sky-50/40 text-left transition-all cursor-pointer group active:scale-95"
                    >
                      <div className="text-xs font-bold text-slate-800 group-hover:text-sky-700 flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-sky-500" />
                        {preset.name}
                      </div>
                      <div className="text-[10px] text-slate-400 truncate mt-0.5">
                        {preset.title}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Prompt Textarea */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-700">
                    系统提示词 (System Prompt / 指令规范)
                  </label>
                  <span className="text-[10px] text-slate-400 font-mono">
                    {formData.systemPrompt.length} 字
                  </span>
                </div>
                <textarea
                  rows={8}
                  value={formData.systemPrompt}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, systemPrompt: e.target.value }))
                  }
                  placeholder="在此输入你希望 AI 扮演的专属角色、遵循的格式规则、推理逻辑或叙事语气..."
                  className="w-full p-3.5 text-xs text-slate-800 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-sky-400 font-sans leading-relaxed resize-y bg-slate-50/50"
                />
                <p className="text-[11px] text-slate-400 leading-normal">
                  💡 提示：系统提示词在每次对话前会自动生效，指导 AI 的语言风格、思考逻辑与角色扮演定位。
                </p>
              </div>
            </div>
          )}

          {activeTab === 'persona' && (
            <div className="space-y-4">
              {/* Name & Title */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    AI 助手名称
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
                    placeholder="如：Tako DeepChat / DeepSeek-R1"
                    className="w-full px-3 py-2 text-xs font-semibold border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-400"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    身份标签 / 头衔
                  </label>
                  <input
                    type="text"
                    value={formData.customPersonaTitle || ''}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, customPersonaTitle: e.target.value }))
                    }
                    placeholder="如：深度思辨学者 / 创作副驾驶"
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-400"
                  />
                </div>
              </div>

              {/* Avatar Type */}
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-2">
                  选择助手图标
                </label>
                <div className="flex flex-wrap gap-2">
                  {[
                    { id: 'sparkles', label: '星辉 (Gemini)', icon: Sparkles },
                    { id: 'brain', label: '脑力 (DeepSeek)', icon: Brain },
                    { id: 'bot', label: '智能 (GPT)', icon: Bot },
                    { id: 'terminal', label: '终端 (Claude)', icon: Terminal },
                    { id: 'cat', label: '萌伴 (Companion)', icon: Cat },
                  ].map((item) => {
                    const IconComp = item.icon;
                    const isSelected = formData.avatarType === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() =>
                          setFormData((prev) => ({
                            ...prev,
                            avatarType: item.id as DialogueAISettings['avatarType'],
                          }))
                        }
                        className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-sky-500 text-white border-sky-500 shadow-xs'
                            : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        <IconComp className="w-3.5 h-3.5" />
                        <span>{item.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Optional Custom Image URL */}
              <div>
                <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5 mb-1">
                  <ImageIcon className="w-3.5 h-3.5 text-slate-400" />
                  <span>自定义头像图片 URL（选填，优先使用）</span>
                </label>
                <input
                  type="text"
                  value={customAvatarInput}
                  onChange={(e) => setCustomAvatarInput(e.target.value)}
                  placeholder="https://... 或 base64 图片地址"
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-400 font-mono"
                />
              </div>

              {/* Deep Thinking Toggle */}
              <div className="p-3.5 rounded-2xl bg-gradient-to-r from-sky-50/60 to-indigo-50/40 border border-sky-100 flex items-center justify-between">
                <div>
                  <div className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <Brain className="w-4 h-4 text-sky-600" />
                    <span>深度思考推理链 (Deep Thinking)</span>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    模拟 DeepSeek-R1 / Gemini Thinking，要求 AI 呈现显式思考过程并支持折叠查阅
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    setFormData((prev) => ({ ...prev, enableThinking: !prev.enableThinking }))
                  }
                  className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer ${
                    formData.enableThinking ? 'bg-sky-500' : 'bg-slate-300'
                  }`}
                >
                  <span
                    className={`block w-4 h-4 rounded-full bg-white shadow-xs transition-transform transform ${
                      formData.enableThinking ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>

              {/* Temperature Slider */}
              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-700 flex items-center gap-1.5">
                    <Flame className="w-3.5 h-3.5 text-amber-500" />
                    <span>发散创造力 (Temperature)</span>
                  </span>
                  <span className="font-mono font-bold text-sky-600 bg-sky-50 px-2 py-0.5 rounded-md border border-sky-100">
                    {formData.temperature.toFixed(2)}
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="1.5"
                  step="0.05"
                  value={formData.temperature}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, temperature: parseFloat(e.target.value) }))
                  }
                  className="w-full accent-sky-500 cursor-pointer"
                />
                <div className="flex justify-between text-[10px] text-slate-400">
                  <span>严谨专注 (0.2)</span>
                  <span>平衡适中 (0.7)</span>
                  <span>天马行空 (1.2)</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-5 py-3.5 border-t border-slate-100 bg-slate-50/70 flex items-center justify-between shrink-0">
          <button
            type="button"
            onClick={handleReset}
            className="px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-500 hover:text-slate-800 hover:bg-slate-200/70 transition-colors cursor-pointer flex items-center gap-1"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>重置默认</span>
          </button>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
            >
              取消
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="px-4 py-1.5 rounded-xl bg-sky-500 hover:bg-sky-600 active:scale-95 text-white text-xs font-bold shadow-xs shadow-sky-200 transition-all cursor-pointer flex items-center gap-1.5"
            >
              <Check className="w-3.5 h-3.5" />
              <span>保存设定</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
