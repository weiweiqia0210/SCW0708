import React, { useState, useRef, useEffect } from 'react';
import {
  User,
  HardDrive,
  Download,
  Upload,
  RotateCcw,
  Type,
  Sparkles,
  Plus,
  Edit2,
  Trash2,
  Check,
  Shield,
  MessageSquare,
  CheckCircle2,
} from 'lucide-react';
import { AppSettings, CharacterCard, WorldBook, SystemPreset, StorySave, UserMask } from '../types';
import { exportAllDataJson, importAllDataJson, downloadJsonFile } from '../utils/storage';
import { UserMaskModal } from './UserMaskModal';

interface ProfileViewProps {
  settings: AppSettings;
  characters: CharacterCard[];
  worldbooks: WorldBook[];
  presets: SystemPreset[];
  saves: StorySave[];
  userMasks: UserMask[];
  activeUserMaskId: string | null;
  onSaveUserMask: (mask: UserMask) => void;
  onDeleteUserMask: (id: string) => void;
  onSwitchUserMask: (id: string) => void;
  onUpdateSettings: (settings: AppSettings) => void;
  onResetDefaults: () => void;
}

export const ProfileView: React.FC<ProfileViewProps> = ({
  settings,
  characters,
  worldbooks,
  presets,
  saves,
  userMasks,
  activeUserMaskId,
  onSaveUserMask,
  onDeleteUserMask,
  onSwitchUserMask,
  onUpdateSettings,
  onResetDefaults,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [editingMask, setEditingMask] = useState<UserMask | null>(null);
  const [isMaskModalOpen, setIsMaskModalOpen] = useState(false);
  const [confirmDeleteMaskId, setConfirmDeleteMaskId] = useState<string | null>(null);

  // PWA Install Prompt State
  const [installPrompt, setInstallPrompt] = useState<any>(null);
  const [isInstalled, setIsInstalled] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return (
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true
    );
  });

  useEffect(() => {
    const handler = (e: any) => {
      e.preventDefault();
      setInstallPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handler);
    window.addEventListener('appinstalled', () => {
      setIsInstalled(true);
      setInstallPrompt(null);
    });
    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!installPrompt) return;
    installPrompt.prompt();
    const choice = await installPrompt.userChoice;
    if (choice?.outcome === 'accepted') {
      setIsInstalled(true);
      setInstallPrompt(null);
    }
  };

  const handleExportAll = () => {
    const jsonStr = exportAllDataJson();
    const dateStr = new Date().toISOString().slice(0, 10);
    downloadJsonFile(`文游全量备份-${dateStr}.json`, jsonStr);
  };

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      const result = importAllDataJson(content);
      if (result.success) {
        alert(result.message);
        window.location.reload();
      } else {
        alert(result.message);
      }
    };
    reader.readAsText(file);
  };

  const handleOpenCreateMask = () => {
    setEditingMask(null);
    setIsMaskModalOpen(true);
  };

  const handleOpenEditMask = (mask: UserMask) => {
    setEditingMask(mask);
    setIsMaskModalOpen(true);
  };

  return (
    <div className="max-w-xl mx-auto px-4 pt-4 pb-28 space-y-4 text-xs">
      {/* User Status / Preferences Card */}
      <div className="p-4 bg-white rounded-2xl border border-slate-100 shadow-xs flex items-center gap-3.5">
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-sky-500 to-sky-300 text-white flex items-center justify-center font-bold text-lg shadow-sm shadow-sky-200 shrink-0">
          <User className="w-6 h-6" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="font-semibold text-slate-800 text-sm">本地游玩档案与玩家配置</div>
          <div className="text-[11px] text-slate-400 mt-0.5">
            单机持久化存储 · 支持多套玩家面具人设切换
          </div>
        </div>
      </div>

      {/* PWA Mobile Installation Card */}
      <div className="p-4 bg-gradient-to-br from-white via-sky-50/40 to-sky-100/20 rounded-2xl border border-sky-100 shadow-xs flex flex-col gap-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <img
              src="./icons/icon-192.png"
              alt="塔可"
              className="w-10 h-10 rounded-xl border border-sky-200/80 shadow-xs object-contain bg-white p-0.5"
            />
            <div>
              <div className="font-semibold text-slate-800 text-sm flex items-center gap-1.5">
                <span>塔可 PWA 桌面应用</span>
                {isInstalled && (
                  <span className="inline-flex items-center gap-0.5 text-[10px] px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600 font-medium border border-emerald-200">
                    <CheckCircle2 className="w-3 h-3" />
                    已安装
                  </span>
                )}
              </div>
              <div className="text-[11px] text-slate-400 mt-0.5">
                支持安卓与 iOS 手机桌面免边框独立全屏运行
              </div>
            </div>
          </div>
          {installPrompt && !isInstalled && (
            <button
              onClick={handleInstallClick}
              className="px-3 py-1.5 rounded-xl bg-sky-500 hover:bg-sky-600 text-white font-medium text-xs shadow-sm shadow-sky-200 transition-all cursor-pointer"
            >
              一键安装
            </button>
          )}
        </div>
        {!isInstalled && (
          <div className="text-[11px] text-slate-500 bg-white/80 p-2.5 rounded-xl border border-sky-100/60 leading-relaxed space-y-1">
            <div className="font-medium text-slate-700">📱 手机安装步骤：</div>
            <div>• <b>安卓 (Chrome / Edge / 微信)</b>：{installPrompt ? '点击上方「一键安装」，或' : ''}在浏览器右上角菜单点击「添加至主屏幕 / 安装应用」。</div>
            <div>• <b>苹果 iPhone (Safari)</b>：点击底部「分享」按钮 ➡️ 选择「添加到主屏幕」。</div>
          </div>
        )}
      </div>

      {/* User Masks (Player Identity Profiles) Management */}
      <div className="p-4 bg-white rounded-2xl border border-slate-100 space-y-3.5 shadow-xs">
        <div className="flex items-center justify-between">
          <div className="font-semibold text-slate-800 flex items-center gap-1.5">
            <span className="text-base">🎭</span>
            <span>玩家面具 (User 基本人设)</span>
          </div>
          <button
            type="button"
            onClick={handleOpenCreateMask}
            className="px-2.5 py-1.5 rounded-xl bg-sky-50 hover:bg-sky-100 text-sky-700 font-medium text-[11px] flex items-center gap-1 transition-colors cursor-pointer border border-sky-200/60"
          >
            <Plus className="w-3.5 h-3.5" />
            新建面具
          </button>
        </div>

        <p className="text-[11px] text-slate-500 leading-relaxed">
          您可以为自己创建多套身份人设。在游玩文游时，AI 将根据您当前佩戴的面具调整登场角色对您的称谓、态度与互动方式。
        </p>

        {/* Mask list */}
        <div className="space-y-2.5">
          {userMasks.length === 0 ? (
            <div className="py-8 text-center text-slate-400 text-xs bg-slate-50/60 rounded-2xl border border-dashed border-slate-200 p-4">
              暂未创建任何玩家面具人设卡。您可以点击右上角「新建面具」创建专属人设，或在开局时选择关闭玩家面具作为纯旁白/客观视角游玩。
            </div>
          ) : (
            userMasks.map((mask) => {
              const isActive = activeUserMaskId === mask.id;
              return (
                <div
                  key={mask.id}
                  className={`p-3.5 rounded-2xl border transition-all ${
                    isActive
                      ? 'border-sky-400 bg-gradient-to-b from-sky-50/70 to-white ring-1 ring-sky-300 shadow-xs'
                      : 'border-slate-200/90 bg-white hover:border-slate-300'
                  }`}
                >
                  {/* Header row */}
                  <div className="flex items-center justify-between gap-2 mb-2.5">
                    <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                      <span className="text-base shrink-0">🎭</span>
                      <span className="font-bold text-sm text-slate-800">{mask.name}</span>
                      {mask.codeName && (
                        <span className="px-1.5 py-0.5 rounded-md bg-sky-50 text-sky-700 text-[10px] font-medium border border-sky-100">
                          代号: {mask.codeName}
                        </span>
                      )}
                      {mask.nickname && (
                        <span className="px-1.5 py-0.5 rounded-md bg-purple-50 text-purple-700 text-[10px] font-medium border border-purple-100">
                          昵称: {mask.nickname}
                        </span>
                      )}
                      <span className="px-1.5 py-0.5 rounded-md bg-slate-100 text-slate-600 text-[10px]">
                        {mask.gender || '未明'}
                      </span>
                      {isActive ? (
                        <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-[10px] font-semibold flex items-center gap-1 shadow-2xs">
                          <Check className="w-3 h-3" />
                          当前佩戴
                        </span>
                      ) : (
                        <span className="text-[10px] text-slate-400">待佩戴</span>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1 shrink-0">
                      {!isActive && (
                        <button
                          type="button"
                          onClick={() => onSwitchUserMask(mask.id)}
                          className="px-2.5 py-1 rounded-xl bg-sky-500 hover:bg-sky-600 text-white font-medium text-[10px] transition-colors cursor-pointer shadow-2xs"
                        >
                          佩戴此面具
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => handleOpenEditMask(mask)}
                        title="编辑人设卡"
                        className="p-1.5 rounded-lg text-slate-400 hover:text-sky-600 hover:bg-sky-50 transition-colors cursor-pointer"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      {confirmDeleteMaskId === mask.id ? (
                        <div className="flex items-center gap-1 px-1.5 py-0.5 rounded-lg bg-rose-50 border border-rose-200">
                          <span className="text-[10px] text-rose-700 font-medium">确认删除？</span>
                          <button
                            type="button"
                            onClick={() => {
                              onDeleteUserMask(mask.id);
                              setConfirmDeleteMaskId(null);
                            }}
                            className="px-1.5 py-0.5 bg-rose-500 hover:bg-rose-600 text-white rounded text-[10px] font-medium cursor-pointer"
                          >
                            删除
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteMaskId(null)}
                            className="px-1.5 py-0.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded text-[10px] cursor-pointer"
                          >
                            取消
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteMaskId(mask.id)}
                          title="删除面具人设卡"
                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                {/* Identity */}
                {mask.identity && (
                  <div className="text-[11px] text-slate-600 mb-2 flex items-start gap-1">
                    <span className="text-slate-400 shrink-0 font-medium">身份：</span>
                    <span className="font-semibold text-slate-700">{mask.identity}</span>
                  </div>
                )}

                {/* Grid details: 外貌, 性格, 额外设定 */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] bg-slate-50/70 p-2.5 rounded-xl border border-slate-100">
                  {mask.appearance && (
                    <div className="line-clamp-2">
                      <span className="text-slate-500 font-semibold">外貌：</span>
                      <span className="text-slate-700">{mask.appearance}</span>
                    </div>
                  )}
                  {mask.personality && (
                    <div className="line-clamp-2">
                      <span className="text-slate-500 font-semibold">性格：</span>
                      <span className="text-slate-700">{mask.personality}</span>
                    </div>
                  )}
                  {mask.customNotes && (
                    <div className="line-clamp-2 col-span-1 sm:col-span-2">
                      <span className="text-amber-700 font-semibold">额外设定：</span>
                      <span className="text-slate-700">{mask.customNotes}</span>
                    </div>
                  )}
                  {mask.speechStyle && (
                    <div className="line-clamp-2">
                      <span className="text-slate-400 font-medium">言谈：</span>
                      <span className="text-slate-600">{mask.speechStyle}</span>
                    </div>
                  )}
                  {!mask.appearance && !mask.personality && !mask.customNotes && !mask.speechStyle && (
                    <div className="col-span-2 text-slate-400 italic">暂未填写详细人设细节，可点击右上角笔形图标补充。</div>
                  )}
                </div>
              </div>
            );
          }))}
        </div>
      </div>

      {/* Reading Typography Preferences */}
      <div className="p-4 bg-white rounded-2xl border border-slate-100 space-y-3.5 shadow-xs">
        <div className="font-semibold text-slate-800 flex items-center gap-1.5">
          <Type className="w-4 h-4 text-sky-500" />
          阅读界面偏好
        </div>

        {/* Font Family */}
        <div>
          <label className="block text-slate-600 mb-1.5">正文字体</label>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => onUpdateSettings({ ...settings, fontFamily: 'serif' })}
              className={`p-2.5 rounded-xl border text-center transition-all cursor-pointer ${
                settings.fontFamily === 'serif'
                  ? 'border-sky-400 bg-sky-50 text-sky-700 font-medium'
                  : 'border-slate-200 text-slate-600 hover:border-slate-300'
              }`}
            >
              <span className="font-novel text-sm block">思源宋体 · 文学感</span>
            </button>
            <button
              onClick={() => onUpdateSettings({ ...settings, fontFamily: 'sans' })}
              className={`p-2.5 rounded-xl border text-center transition-all cursor-pointer ${
                settings.fontFamily === 'sans'
                  ? 'border-sky-400 bg-sky-50 text-sky-700 font-medium'
                  : 'border-slate-200 text-slate-600 hover:border-slate-300'
              }`}
            >
              <span className="text-sm block">黑体系统 · 现代清晰</span>
            </button>
          </div>
        </div>

        {/* Font Size */}
        <div>
          <label className="block text-slate-600 mb-1.5">正文字号</label>
          <div className="grid grid-cols-4 gap-1.5">
            {(['sm', 'base', 'lg', 'xl'] as const).map((size) => {
              const labels = { sm: '精巧', base: '适中', lg: '较大', xl: '特大' };
              return (
                <button
                  key={size}
                  onClick={() => onUpdateSettings({ ...settings, fontSize: size })}
                  className={`py-1.5 rounded-lg border text-center transition-all cursor-pointer ${
                    settings.fontSize === size
                      ? 'border-sky-400 bg-sky-50 text-sky-700 font-semibold'
                      : 'border-slate-200 text-slate-500 hover:border-slate-300'
                  }`}
                >
                  {labels[size]}
                </button>
              );
            })}
          </div>
        </div>

        {/* Line Spacing */}
        <div>
          <label className="block text-slate-600 mb-1.5">段落行距</label>
          <div className="grid grid-cols-3 gap-1.5">
            {(['normal', 'relaxed', 'loose'] as const).map((spacing) => {
              const labels = { normal: '紧凑', relaxed: '舒适', loose: '宽松' };
              return (
                <button
                  key={spacing}
                  onClick={() => onUpdateSettings({ ...settings, lineSpacing: spacing })}
                  className={`py-1.5 rounded-lg border text-center transition-all cursor-pointer ${
                    settings.lineSpacing === spacing
                      ? 'border-sky-400 bg-sky-50 text-sky-700 font-semibold'
                      : 'border-slate-200 text-slate-500 hover:border-slate-300'
                  }`}
                >
                  {labels[spacing]}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Storage Stats & Backup Management */}
      <div className="p-4 bg-white rounded-2xl border border-slate-100 space-y-3.5 shadow-xs">
        <div className="font-semibold text-slate-800 flex items-center gap-1.5">
          <HardDrive className="w-4 h-4 text-sky-500" />
          存储统计与全量备份
        </div>

        <div className="grid grid-cols-5 gap-1.5 text-center">
          <div className="p-2 rounded-xl bg-slate-50 border border-slate-100">
            <div className="font-semibold text-sm text-slate-800">{characters.length}</div>
            <div className="text-[10px] text-slate-400 mt-0.5">角色卡</div>
          </div>
          <div className="p-2 rounded-xl bg-slate-50 border border-slate-100">
            <div className="font-semibold text-sm text-slate-800">{userMasks.length}</div>
            <div className="text-[10px] text-slate-400 mt-0.5">面具</div>
          </div>
          <div className="p-2 rounded-xl bg-slate-50 border border-slate-100">
            <div className="font-semibold text-sm text-slate-800">{worldbooks.length}</div>
            <div className="text-[10px] text-slate-400 mt-0.5">世界书</div>
          </div>
          <div className="p-2 rounded-xl bg-slate-50 border border-slate-100">
            <div className="font-semibold text-sm text-slate-800">{presets.length}</div>
            <div className="text-[10px] text-slate-400 mt-0.5">预设</div>
          </div>
          <div className="p-2 rounded-xl bg-slate-50 border border-slate-100">
            <div className="font-semibold text-sm text-slate-800">{saves.length}</div>
            <div className="text-[10px] text-slate-400 mt-0.5">存档</div>
          </div>
        </div>

        <div className="pt-2 flex flex-col gap-2">
          <button
            onClick={handleExportAll}
            className="w-full py-2.5 px-3 rounded-xl border border-sky-200 bg-sky-50/50 hover:bg-sky-100/60 text-sky-700 font-medium flex items-center justify-center gap-2 transition-all cursor-pointer"
          >
            <Download className="w-4 h-4" />
            一键导出全量数据包 (JSON)
          </button>

          <button
            onClick={() => fileInputRef.current?.click()}
            className="w-full py-2.5 px-3 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-medium flex items-center justify-center gap-2 transition-all cursor-pointer"
          >
            <Upload className="w-4 h-4" />
            从备份文件恢复数据 (JSON)
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            onChange={handleImportFile}
            className="hidden"
          />
        </div>
      </div>

      {/* Reset Defaults */}
      <div className="p-4 bg-white rounded-2xl border border-slate-100 space-y-2 shadow-xs">
        <div className="text-slate-600 font-medium">重置与初始模板</div>
        <div className="text-[11px] text-slate-400 leading-relaxed">
          若您希望重新获取官方默认内置的 3 张角色卡、2 部世界书和预设，可点击恢复（不会主动删除您既有的存档与面具）。
        </div>
        <button
          onClick={() => {
            if (confirm('确认恢复默认角色卡、世界书与预设吗？')) {
              onResetDefaults();
            }
          }}
          className="mt-1 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600 text-slate-500 text-[11px] transition-colors cursor-pointer"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          恢复初始预设资料
        </button>
      </div>

      <div className="text-[11px] text-slate-400 px-2 leading-relaxed text-center">
        当前版本基于浏览器本地存储构建，跨设备使用请通过导出/导入功能迁移。
      </div>

      {/* User Mask Edit/Create Modal */}
      <UserMaskModal
        isOpen={isMaskModalOpen}
        mask={editingMask}
        onClose={() => setIsMaskModalOpen(false)}
        onSave={onSaveUserMask}
      />
    </div>
  );
};
