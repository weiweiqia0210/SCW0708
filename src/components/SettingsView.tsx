import React, { useState, useEffect, useRef } from 'react';
import {
  Sliders,
  Key,
  Server,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Eye,
  EyeOff,
  ShieldCheck,
  Zap,
  RefreshCw,
  List,
  XCircle,
} from 'lucide-react';
import { AppSettings, AIProvider } from '../types';
import { checkBackendStatus, testConnection, fetchModels } from '../utils/aiService';

interface SettingsViewProps {
  settings: AppSettings;
  onUpdateSettings: (settings: AppSettings) => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({ settings, onUpdateSettings }) => {
  const [formData, setFormData] = useState<AppSettings>(settings);
  const [showKey, setShowKey] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testSeconds, setTestSeconds] = useState(0);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [envStatus, setEnvStatus] = useState<{ hasEnvGeminiKey: boolean; defaultModel: string } | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);
  const timerIntervalRef = useRef<any>(null);

  // Model fetching states
  const [isFetchingModels, setIsFetchingModels] = useState(false);
  const [fetchedModels, setFetchedModels] = useState<string[]>([]);
  const [fetchModelError, setFetchModelError] = useState<string | null>(null);
  const [fetchModelSuccess, setFetchModelSuccess] = useState(false);

  useEffect(() => {
    setFormData(settings);
  }, [settings]);

  // Clean up timers on unmount
  useEffect(() => {
    return () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      if (abortControllerRef.current) abortControllerRef.current.abort();
    };
  }, []);

  // Check server or client mode status
  useEffect(() => {
    checkBackendStatus()
      .then((status) => {
        setEnvStatus({
          hasEnvGeminiKey: status.hasEnvKey,
          defaultModel: status.defaultModel,
        });
      })
      .catch((err) => console.warn('Env status check error:', err));
  }, []);

  const handleCancelTest = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort('user_cancel');
      abortControllerRef.current = null;
    }
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
    setIsTesting(false);
    setTestSeconds(0);
    setTestResult({
      success: false,
      message: '已手动中断测试，您可以切换模型或重新测试。',
    });
  };

  const handleChange = <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
    // If user changes model or service settings while testing, abort ongoing test immediately
    if (isTesting && ['provider', 'model', 'customApiKey', 'customEndpoint'].includes(key as string)) {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort('user_switch');
        abortControllerRef.current = null;
      }
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
      }
      setIsTesting(false);
      setTestSeconds(0);
      setTestResult(null);
    }

    const updated = { ...formData, [key]: value };
    setFormData(updated);
    onUpdateSettings(updated);
  };

  const handleFetchModels = async () => {
    setIsFetchingModels(true);
    setFetchModelError(null);
    setFetchModelSuccess(false);

    try {
      const data = await fetchModels({
        provider: formData.provider,
        customApiKey: formData.customApiKey,
        customEndpoint: formData.customEndpoint,
      });

      if (data.success && Array.isArray(data.models)) {
        setFetchedModels(data.models);
        setFetchModelSuccess(true);
        if (data.models.length > 0 && !data.models.includes(formData.model)) {
          handleChange('model', data.models[0]);
        }
      } else {
        setFetchModelError(data.error || '拉取模型失败，请检查 API 地址和密钥');
      }
    } catch (e: any) {
      setFetchModelError(`网络请求异常: ${e.message}`);
    } finally {
      setIsFetchingModels(false);
    }
  };

  const handleTestConnection = async () => {
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
    }
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    const controller = new AbortController();
    abortControllerRef.current = controller;

    setIsTesting(true);
    setTestResult(null);
    setTestSeconds(0);

    let seconds = 0;
    timerIntervalRef.current = setInterval(() => {
      seconds += 1;
      setTestSeconds(seconds);
      if (seconds >= 15) {
        if (timerIntervalRef.current) {
          clearInterval(timerIntervalRef.current);
          timerIntervalRef.current = null;
        }
        controller.abort('timeout');
      }
    }, 1000);

    try {
      const data = await testConnection({
        provider: formData.provider,
        customApiKey: formData.customApiKey,
        customEndpoint: formData.customEndpoint,
        model: formData.model,
        signal: controller.signal,
      });

      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
      }

      if (data.success) {
        setTestResult({
          success: true,
          message: `连接成功！响应: "${data.message}" (模型: ${data.model || formData.model})`,
        });
      } else {
        setTestResult({
          success: false,
          message: data.message || '测试失败，请核对密钥或网络环境',
        });
      }
    } catch (e: any) {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
      }

      if (e?.name === 'AbortError' || seconds >= 15) {
        setTestResult({
          success: false,
          message: '连接超时：已等待超过 15 秒未响应。上游 API 响应迟缓或网络受阻，请检查网络、接口地址，或切换其他轻量模型后重试。',
        });
      } else {
        setTestResult({
          success: false,
          message: `网络异常: ${e.message}`,
        });
      }
    } finally {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
      }
      setIsTesting(false);
      abortControllerRef.current = null;
    }
  };

  return (
    <div className="max-w-xl mx-auto px-4 pt-4 pb-24 space-y-4 text-xs">
      {/* Server Env Notice */}
      <div className="p-3.5 rounded-2xl bg-gradient-to-r from-sky-50 to-blue-50/40 border border-sky-100 flex items-start gap-3">
        <ShieldCheck className="w-4 h-4 text-sky-600 mt-0.5 shrink-0" />
        <div>
          <div className="font-semibold text-slate-800">
            {envStatus?.hasEnvGeminiKey ? '云端环境变量已就绪' : 'AI 服务配置'}
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
            {envStatus?.hasEnvGeminiKey
              ? '已检测到系统环境变量中的 GEMINI_API_KEY，您可直接免密体验文游；亦可在下方填入您自己的专属密钥或自定义接口。'
              : '为了开启真实的 AI 智能互动，请在下方输入您的 Gemini API 密钥，或配置 OpenAI 兼容第三方服务商。'}
          </div>
        </div>
      </div>

      {/* Provider Selector */}
      <div className="p-4 bg-white rounded-2xl border border-slate-100 space-y-3 shadow-xs">
        <label className="block font-semibold text-slate-800">AI 服务商</label>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => {
              handleChange('provider', 'gemini');
              if (!formData.model.startsWith('gemini')) {
                handleChange('model', 'gemini-3.8-flash');
              }
            }}
            className={`p-3 rounded-xl border flex flex-col items-start gap-1 transition-all ${
              formData.provider === 'gemini'
                ? 'border-sky-400 bg-sky-50/60 text-sky-800 shadow-xs'
                : 'border-slate-200 text-slate-600 hover:border-slate-300'
            }`}
          >
            <div className="flex items-center gap-1.5 font-semibold text-xs">
              <Zap className="w-3.5 h-3.5 text-sky-500" />
              Google Gemini
            </div>
            <span className="text-[10px] text-slate-400">官方原生 SDK · 高速流畅</span>
          </button>

          <button
            type="button"
            onClick={() => {
              handleChange('provider', 'openai_compatible');
              if (formData.model.startsWith('gemini')) {
                handleChange('model', 'gpt-4o-mini');
              }
            }}
            className={`p-3 rounded-xl border flex flex-col items-start gap-1 transition-all ${
              formData.provider === 'openai_compatible'
                ? 'border-sky-400 bg-sky-50/60 text-sky-800 shadow-xs'
                : 'border-slate-200 text-slate-600 hover:border-slate-300'
            }`}
          >
            <div className="flex items-center gap-1.5 font-semibold text-xs">
              <Server className="w-3.5 h-3.5 text-indigo-500" />
              OpenAI 兼容接口
            </div>
            <span className="text-[10px] text-slate-400">DeepSeek / 第三方 / 代理</span>
          </button>
        </div>
      </div>

      {/* Model & Endpoint Config */}
      <div className="p-4 bg-white rounded-2xl border border-slate-100 space-y-3.5 shadow-xs">
        {formData.provider === 'openai_compatible' && (
          <div>
            <label className="block font-medium text-slate-700 mb-1">
              API 地址 (Base URL) <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              value={formData.customEndpoint}
              onChange={(e) => handleChange('customEndpoint', e.target.value)}
              placeholder="例如：https://api.openai.com/v1 或 https://api.deepseek.com"
              className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:border-sky-400"
            />
          </div>
        )}

        {/* API Key */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="font-medium text-slate-700">API Key 密钥</label>
            <span className="text-[10px] text-slate-400">
              {envStatus?.hasEnvGeminiKey && formData.provider === 'gemini'
                ? '已存在默认云端密钥，自定义可覆盖'
                : '必填'}
            </span>
          </div>
          <div className="relative">
            <input
              type={showKey ? 'text' : 'password'}
              value={formData.customApiKey}
              onChange={(e) => handleChange('customApiKey', e.target.value)}
              placeholder={
                envStatus?.hasEnvGeminiKey && formData.provider === 'gemini'
                  ? '留空将使用云端 GEMINI_API_KEY'
                  : '请输入您的 API Key'
              }
              className="w-full pl-3 pr-10 py-2 rounded-xl border border-slate-200 focus:outline-none focus:border-sky-400"
            />
            <button
              type="button"
              onClick={() => setShowKey(!showKey)}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
            >
              {showKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>

        {/* Model selection & Pull Models button */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="font-medium text-slate-700">模型名称 (Model)</label>
            {formData.provider === 'openai_compatible' && (
              <button
                type="button"
                disabled={isFetchingModels}
                onClick={handleFetchModels}
                className="text-sky-600 hover:text-sky-700 font-medium flex items-center gap-1 text-[11px] cursor-pointer disabled:opacity-50"
              >
                {isFetchingModels ? (
                  <>
                    <Loader2 className="w-3 h-3 animate-spin" />
                    正在拉取模型...
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-3 h-3" />
                    拉取模型列表
                  </>
                )}
              </button>
            )}
          </div>

          {formData.provider === 'gemini' ? (
            <select
              value={formData.model}
              onChange={(e) => handleChange('model', e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:border-sky-400 bg-white"
            >
              <option value="gemini-3.8-flash">gemini-3.8-flash (推荐：速度极快、叙事自然)</option>
              <option value="gemini-4-argon">gemini-4-argon (旗舰高智商推理模型)</option>
              <option value="gemini-3.1-flash-lite">gemini-3.1-flash-lite (轻量低延迟)</option>
            </select>
          ) : (
            <div className="space-y-2">
              <input
                type="text"
                value={formData.model}
                onChange={(e) => handleChange('model', e.target.value)}
                placeholder="例如：gpt-4o-mini、deepseek-chat"
                className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:border-sky-400"
              />

              {/* Fetched models dropdown if available */}
              {fetchedModels.length > 0 && (
                <div className="p-2 bg-sky-50/70 border border-sky-200/80 rounded-xl space-y-1.5 animate-in fade-in">
                  <div className="text-[10px] text-sky-800 font-medium flex items-center gap-1">
                    <List className="w-3 h-3" />
                    已拉取到 {fetchedModels.length} 个可用模型，点击快速选择：
                  </div>
                  <div className="max-h-36 overflow-y-auto space-y-1">
                    {fetchedModels.map((m) => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => handleChange('model', m)}
                        className={`w-full text-left px-2 py-1 rounded text-[11px] truncate transition-colors ${
                          formData.model === m
                            ? 'bg-sky-500 text-white font-medium'
                            : 'hover:bg-white text-slate-700'
                        }`}
                      >
                        {m}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {fetchModelError && (
                <div className="p-2 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-[11px] leading-relaxed">
                  ⚠️ {fetchModelError}
                </div>
              )}

              {fetchModelSuccess && fetchedModels.length === 0 && (
                <div className="p-2 rounded-lg bg-amber-50 border border-amber-200 text-amber-700 text-[11px]">
                  上游接口未返回任何可用模型列表，请手动输入模型名称。
                </div>
              )}
            </div>
          )}
        </div>

        {/* Temperature slider */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="font-medium text-slate-700">发散度 / 温度 (Temperature)</label>
            <span className="font-semibold text-sky-600">{formData.temperature}</span>
          </div>
          <input
            type="range"
            min={0.2}
            max={1.4}
            step={0.05}
            value={formData.temperature}
            onChange={(e) => handleChange('temperature', parseFloat(e.target.value))}
            className="w-full accent-sky-500 cursor-pointer"
          />
          <div className="flex justify-between text-[10px] text-slate-400 mt-0.5">
            <span>严谨收敛 (0.2)</span>
            <span>文风平衡 (0.85)</span>
            <span>奔放奇思 (1.4)</span>
          </div>
        </div>

        {/* Test Connection Button & Result */}
        <div className="pt-2">
          <button
            type="button"
            onClick={isTesting ? handleCancelTest : handleTestConnection}
            className={`w-full py-2.5 rounded-xl font-medium flex items-center justify-center gap-2 transition-all cursor-pointer shadow-xs active:scale-[0.99] ${
              isTesting
                ? 'bg-rose-50 hover:bg-rose-100/90 text-rose-700 border border-rose-300 ring-2 ring-rose-200/60'
                : 'bg-slate-900 hover:bg-slate-800 text-white'
            }`}
            title={isTesting ? '点击可立即中止本次测试并切换模型' : '测试当前服务商与模型连接（15秒超时保护）'}
          >
            {isTesting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-rose-600 shrink-0" />
                <span className="font-semibold">正在测试连接 ({testSeconds}s / 15s) · 点击取消重测</span>
              </>
            ) : (
              <>
                <Zap className="w-4 h-4 text-sky-400" />
                <span>测试服务连接</span>
                <span className="text-[10px] text-slate-400 font-normal">（15秒超时保护）</span>
              </>
            )}
          </button>

          {testResult && (
            <div
              className={`mt-3 p-3 rounded-xl border flex items-start gap-2.5 animate-in fade-in duration-200 ${
                testResult.success
                  ? 'bg-emerald-50/80 border-emerald-200 text-emerald-800'
                  : 'bg-rose-50/80 border-rose-200 text-rose-800'
              }`}
            >
              {testResult.success ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              )}
              <div className="text-[11px] leading-relaxed break-all">
                {testResult.message}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Security note */}
      <div className="text-[11px] text-slate-400 px-2 leading-relaxed">
        安全说明：文游调用均通过服务端代理发出，不向公开静态前端泄露任何敏感秘钥。自定义 API 仅缓存在您的本地浏览器中。
      </div>
    </div>
  );
};
