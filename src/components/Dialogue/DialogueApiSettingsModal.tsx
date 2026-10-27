import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Cpu,
  Key,
  Server,
  Sparkles,
  Check,
  AlertCircle,
  Loader2,
  Trash2,
  BookmarkPlus,
  RefreshCw,
  Eye,
  EyeOff,
  Sliders,
  Globe,
  Radio,
  ExternalLink,
} from 'lucide-react';
import { AppSettings, AIProvider, DialogueApiConfig, DialogueApiPreset } from '../../types';
import {
  loadDialogueApiPresets,
  saveDialogueApiPresets,
  addDialogueApiPreset,
  deleteDialogueApiPreset,
  DEFAULT_API_PRESETS,
} from '../../utils/dialogueStorage';
import { testConnection } from '../../utils/aiService';

interface DialogueApiSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  globalSettings: AppSettings;
  config: DialogueApiConfig;
  onSave: (newConfig: DialogueApiConfig) => void;
}

export const DialogueApiSettingsModal: React.FC<DialogueApiSettingsModalProps> = ({
  isOpen,
  onClose,
  globalSettings,
  config,
  onSave,
}) => {
  const [formData, setFormData] = useState<DialogueApiConfig>(() => ({
    useCustom: config.useCustom,
    provider: config.provider || globalSettings.provider,
    model: config.model || globalSettings.model,
    customApiKey: config.customApiKey ?? globalSettings.customApiKey,
    customEndpoint: config.customEndpoint ?? globalSettings.customEndpoint,
    presetId: config.presetId,
  }));

  const [presets, setPresets] = useState<DialogueApiPreset[]>(() => loadDialogueApiPresets());
  const [showKey, setShowKey] = useState(false);
  const [isSavingPreset, setIsSavingPreset] = useState(false);
  const [newPresetName, setNewPresetName] = useState('');

  // Test connection state
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (isOpen) {
      setFormData({
        useCustom: config.useCustom,
        provider: config.provider || globalSettings.provider,
        model: config.model || globalSettings.model,
        customApiKey: config.customApiKey ?? globalSettings.customApiKey,
        customEndpoint: config.customEndpoint ?? globalSettings.customEndpoint,
        presetId: config.presetId,
      });
      setPresets(loadDialogueApiPresets());
      setTestResult(null);
      setIsSavingPreset(false);
      setNewPresetName('');
    }
  }, [isOpen, config, globalSettings]);

  if (!isOpen) return null;

  // Handle switching preset
  const handleApplyPreset = (preset: DialogueApiPreset) => {
    setFormData((prev) => ({
      ...prev,
      useCustom: true, // Choosing a preset activates custom API for this mode
      provider: preset.provider,
      model: preset.model,
      customEndpoint: preset.customEndpoint || '',
      customApiKey: preset.customApiKey !== undefined ? preset.customApiKey : prev.customApiKey,
      presetId: preset.id,
    }));
    setTestResult(null);
  };

  // Save current configuration as a new preset
  const handleSaveAsNewPreset = () => {
    const trimmed = newPresetName.trim();
    if (!trimmed) return;

    const created = addDialogueApiPreset({
      name: trimmed,
      provider: formData.provider,
      model: formData.model,
      customEndpoint: formData.customEndpoint,
      customApiKey: formData.customApiKey,
    });

    setPresets(loadDialogueApiPresets());
    setFormData((prev) => ({ ...prev, presetId: created.id }));
    setIsSavingPreset(false);
    setNewPresetName('');
  };

  // Delete custom preset
  const handleDeletePreset = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const remain = deleteDialogueApiPreset(id);
    setPresets(remain);
    if (formData.presetId === id) {
      setFormData((prev) => ({ ...prev, presetId: undefined }));
    }
  };

  // Copy current global settings
  const handleSyncFromGlobal = () => {
    setFormData((prev) => ({
      ...prev,
      provider: globalSettings.provider,
      model: globalSettings.model,
      customApiKey: globalSettings.customApiKey,
      customEndpoint: globalSettings.customEndpoint,
      presetId: undefined,
    }));
    setTestResult(null);
  };

  // Test connection
  const handleTest = async () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setIsTesting(true);
    setTestResult(null);

    try {
      const res = await testConnection({
        provider: formData.provider,
        model: formData.model,
        customApiKey: formData.customApiKey,
        customEndpoint: formData.customEndpoint,
        signal: controller.signal,
      });

      if (res.success) {
        setTestResult({
          success: true,
          message: `连接成功！响应: "${res.message}" (模型: ${res.model || formData.model})`,
        });
      } else {
        setTestResult({
          success: false,
          message: res.message || '连接失败，请核对接口与密钥',
        });
      }
    } catch (e: any) {
      if (e?.name !== 'AbortError') {
        setTestResult({
          success: false,
          message: `请求异常: ${e.message}`,
        });
      }
    } finally {
      setIsTesting(false);
      abortControllerRef.current = null;
    }
  };

  const handleSaveAndClose = () => {
    onSave(formData);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="w-full max-w-xl bg-white rounded-3xl shadow-2xl border border-slate-200/90 overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-slate-50 via-white to-sky-50/50 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-sky-500 text-white flex items-center justify-center shadow-xs shadow-sky-200">
              <Cpu className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-slate-800">对话模式 API 独立设置</h3>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-sky-100 text-sky-800 font-bold font-mono">
                  专属配置
                </span>
              </div>
              <p className="text-xs text-slate-400">
                仅对本对话模式生效；若未启用专属 API，则自动跟随全局设置
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
            title="关闭"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-5 overflow-y-auto space-y-4 flex-1">
          {/* Mode Switch Card */}
          <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-2.5">
            <div className="text-xs font-bold text-slate-700">API 生效范围选择</div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {/* Option 1: Follow Global */}
              <button
                type="button"
                onClick={() => setFormData((prev) => ({ ...prev, useCustom: false }))}
                className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                  !formData.useCustom
                    ? 'border-sky-400 bg-sky-50/70 text-sky-900 shadow-xs'
                    : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                }`}
              >
                <div className="flex items-center gap-2 font-bold text-xs">
                  <div
                    className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center ${
                      !formData.useCustom ? 'border-sky-500 bg-sky-500' : 'border-slate-300'
                    }`}
                  >
                    {!formData.useCustom && <span className="w-1.5 h-1.5 rounded-full bg-white" />}
                  </div>
                  <span>跟随全局 API (默认)</span>
                </div>
                <div className="text-[11px] text-slate-400 mt-1 pl-5.5 truncate">
                  当前全局: {globalSettings.provider === 'gemini' ? 'Google Gemini' : 'OpenAI 兼容'} · {globalSettings.model}
                </div>
              </button>

              {/* Option 2: Use Dialogue Specific API */}
              <button
                type="button"
                onClick={() => setFormData((prev) => ({ ...prev, useCustom: true }))}
                className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                  formData.useCustom
                    ? 'border-sky-400 bg-sky-50/70 text-sky-900 shadow-xs'
                    : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                }`}
              >
                <div className="flex items-center gap-2 font-bold text-xs">
                  <div
                    className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center ${
                      formData.useCustom ? 'border-sky-500 bg-sky-500' : 'border-slate-300'
                    }`}
                  >
                    {formData.useCustom && <span className="w-1.5 h-1.5 rounded-full bg-white" />}
                  </div>
                  <span>使用本模式专属 API</span>
                </div>
                <div className="text-[11px] text-slate-400 mt-1 pl-5.5 truncate">
                  为对话模式单独指定模型、密钥与接口
                </div>
              </button>
            </div>
          </div>

          {/* Presets Bar */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                <span>快捷预设库（点击一键切换）</span>
              </label>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleSyncFromGlobal}
                  className="text-[11px] text-slate-500 hover:text-sky-600 flex items-center gap-1 cursor-pointer font-medium"
                  title="将当前表单内容替换为全局正在使用的 API 配置"
                >
                  <RefreshCw className="w-3 h-3" />
                  <span>同步全局当前 API</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsSavingPreset(!isSavingPreset)}
                  className="text-[11px] text-sky-600 hover:text-sky-700 flex items-center gap-1 cursor-pointer font-bold"
                >
                  <BookmarkPlus className="w-3 h-3" />
                  <span>存为新预设</span>
                </button>
              </div>
            </div>

            {/* Inline Save Preset Input */}
            {isSavingPreset && (
              <div className="p-3 bg-sky-50/70 rounded-2xl border border-sky-200 space-y-2 animate-in fade-in duration-150">
                <div className="text-xs font-bold text-sky-900">将当前填写的配置保存为新预设</div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newPresetName}
                    onChange={(e) => setNewPresetName(e.target.value)}
                    placeholder="输入预设名称 (例如: 私有DeepSeek-R1 / 公司中转)"
                    className="flex-1 px-3 py-1.5 text-xs bg-white border border-sky-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-400"
                  />
                  <button
                    type="button"
                    onClick={handleSaveAsNewPreset}
                    disabled={!newPresetName.trim()}
                    className="px-3 py-1.5 bg-sky-500 hover:bg-sky-600 disabled:opacity-40 text-white text-xs font-bold rounded-xl cursor-pointer"
                  >
                    保存
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsSavingPreset(false);
                      setNewPresetName('');
                    }}
                    className="px-2.5 py-1.5 text-slate-500 hover:bg-slate-200/60 rounded-xl text-xs cursor-pointer"
                  >
                    取消
                  </button>
                </div>
              </div>
            )}

            {/* Presets Chips / Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {presets.map((preset) => {
                const isSelected = formData.useCustom && formData.presetId === preset.id;
                return (
                  <div
                    key={preset.id}
                    onClick={() => handleApplyPreset(preset)}
                    className={`group relative p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                      isSelected
                        ? 'border-sky-400 bg-sky-50/60 text-sky-900 shadow-2xs ring-1 ring-sky-300'
                        : 'border-slate-200/90 bg-white hover:border-sky-300 hover:bg-sky-50/30 text-slate-700'
                    }`}
                  >
                    <div className="text-xs font-bold truncate pr-4">{preset.name}</div>
                    <div className="text-[10px] text-slate-400 truncate mt-0.5">
                      {preset.provider === 'gemini' ? 'Gemini' : 'OpenAI'} · {preset.model}
                    </div>

                    {!preset.isBuiltIn && (
                      <button
                        type="button"
                        onClick={(e) => handleDeletePreset(preset.id, e)}
                        className="absolute right-1.5 top-2 p-1 text-slate-400 hover:text-rose-500 rounded opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                        title="删除该自定义预设"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Form Fields for Custom API */}
          <div
            className={`space-y-3.5 transition-opacity ${
              !formData.useCustom ? 'opacity-60 pointer-events-none' : 'opacity-100'
            }`}
          >
            {/* Provider Toggle */}
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1.5">服务商类型</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() =>
                    setFormData((prev) => ({
                      ...prev,
                      provider: 'gemini',
                      model: prev.model.startsWith('gemini') ? prev.model : 'gemini-3.8-flash',
                    }))
                  }
                  className={`p-2.5 rounded-xl border flex items-center justify-center gap-2 text-xs font-bold transition-all cursor-pointer ${
                    formData.provider === 'gemini'
                      ? 'border-sky-500 bg-sky-50 text-sky-800 shadow-2xs'
                      : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <Sparkles className="w-3.5 h-3.5 text-sky-500" />
                  <span>Google Gemini 官方</span>
                </button>

                <button
                  type="button"
                  onClick={() =>
                    setFormData((prev) => ({
                      ...prev,
                      provider: 'openai_compatible',
                      model: !prev.model.startsWith('gemini') ? prev.model : 'deepseek-chat',
                      customEndpoint: prev.customEndpoint || 'https://api.deepseek.com',
                    }))
                  }
                  className={`p-2.5 rounded-xl border flex items-center justify-center gap-2 text-xs font-bold transition-all cursor-pointer ${
                    formData.provider === 'openai_compatible'
                      ? 'border-sky-500 bg-sky-50 text-sky-800 shadow-2xs'
                      : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <Server className="w-3.5 h-3.5 text-indigo-500" />
                  <span>OpenAI 兼容 / DeepSeek</span>
                </button>
              </div>
            </div>

            {/* Model Name */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-bold text-slate-700">模型名称 (Model)</label>
                <div className="flex items-center gap-1.5 text-[10px] text-slate-400">
                  <span>常用:</span>
                  {formData.provider === 'gemini' ? (
                    <>
                      <button
                        type="button"
                        onClick={() => setFormData((prev) => ({ ...prev, model: 'gemini-3.8-flash' }))}
                        className="hover:text-sky-600 underline cursor-pointer"
                      >
                        3.8-flash
                      </button>
                      <span>/</span>
                      <button
                        type="button"
                        onClick={() => setFormData((prev) => ({ ...prev, model: 'gemini-2.5-pro' }))}
                        className="hover:text-sky-600 underline cursor-pointer"
                      >
                        2.5-pro
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => setFormData((prev) => ({ ...prev, model: 'deepseek-chat' }))}
                        className="hover:text-sky-600 underline cursor-pointer"
                      >
                        deepseek-v3
                      </button>
                      <span>/</span>
                      <button
                        type="button"
                        onClick={() => setFormData((prev) => ({ ...prev, model: 'deepseek-reasoner' }))}
                        className="hover:text-sky-600 underline cursor-pointer"
                      >
                        deepseek-r1
                      </button>
                    </>
                  )}
                </div>
              </div>
              <input
                type="text"
                value={formData.model}
                onChange={(e) => setFormData((prev) => ({ ...prev, model: e.target.value.trim() }))}
                placeholder="例如: gemini-3.8-flash 或 deepseek-chat"
                className="w-full px-3 py-2 text-xs font-mono font-bold text-slate-800 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-400"
              />
            </div>

            {/* Endpoint (Base URL) when openai_compatible */}
            {formData.provider === 'openai_compatible' && (
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  API 接口地址 (Base URL)
                </label>
                <input
                  type="text"
                  value={formData.customEndpoint}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, customEndpoint: e.target.value.trim() }))
                  }
                  placeholder="例如: https://api.deepseek.com 或 https://api.openai.com/v1"
                  className="w-full px-3 py-2 text-xs font-mono text-slate-800 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-400"
                />
              </div>
            )}

            {/* API Key */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-bold text-slate-700">API Key 密钥</label>
                <span className="text-[10px] text-slate-400">
                  {formData.provider === 'gemini'
                    ? '留空时将尝试使用后端云端密钥'
                    : '必填'}
                </span>
              </div>
              <div className="relative">
                <input
                  type={showKey ? 'text' : 'password'}
                  value={formData.customApiKey}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, customApiKey: e.target.value.trim() }))
                  }
                  placeholder="在此输入专属 API Key..."
                  className="w-full pl-3 pr-10 py-2 text-xs font-mono text-slate-800 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-400"
                />
                <button
                  type="button"
                  onClick={() => setShowKey(!showKey)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
                >
                  {showKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>

            {/* Test Connection Result */}
            {testResult && (
              <div
                className={`p-3 rounded-xl border text-xs flex items-start gap-2 ${
                  testResult.success
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                    : 'bg-rose-50 border-rose-200 text-rose-800'
                }`}
              >
                {testResult.success ? (
                  <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                )}
                <div className="flex-1 leading-relaxed">{testResult.message}</div>
              </div>
            )}

            {/* Test Button */}
            <div className="pt-1">
              <button
                type="button"
                onClick={handleTest}
                disabled={isTesting}
                className="w-full py-2 px-3 rounded-xl border border-slate-200 hover:border-sky-300 hover:bg-sky-50/50 text-xs font-bold text-slate-700 flex items-center justify-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
              >
                {isTesting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-sky-600" />
                    <span>正在测试连接中...</span>
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 text-slate-500" />
                    <span>测试此 API 连接状态</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3.5 border-t border-slate-100 bg-slate-50/70 flex items-center justify-between shrink-0">
          <button
            type="button"
            onClick={() => {
              setFormData((prev) => ({
                ...prev,
                useCustom: false,
                provider: globalSettings.provider,
                model: globalSettings.model,
                customApiKey: globalSettings.customApiKey,
                customEndpoint: globalSettings.customEndpoint,
                presetId: undefined,
              }));
              setTestResult(null);
            }}
            className="text-xs font-semibold text-slate-500 hover:text-slate-800 cursor-pointer"
          >
            重置为跟随全局
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
              onClick={handleSaveAndClose}
              className="px-4 py-1.5 rounded-xl bg-sky-500 hover:bg-sky-600 active:scale-95 text-white text-xs font-bold shadow-xs shadow-sky-200 transition-all cursor-pointer flex items-center gap-1.5"
            >
              <Check className="w-3.5 h-3.5" />
              <span>保存配置</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
