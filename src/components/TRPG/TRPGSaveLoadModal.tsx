import React, { useState, useEffect } from 'react';
import {
  X,
  Save,
  FolderArchive,
  Clock,
  RotateCcw,
  Trash2,
  Plus,
  CheckCircle2,
  AlertTriangle,
  MapPin,
  Heart,
  Users,
  ScrollText,
  BookMarked,
  Shield,
  FileCheck,
} from 'lucide-react';
import { TRPGSession, TRPGSaveSlot } from '../../types/trpg';
import {
  loadTRPGSaveSlots,
  createTRPGSaveSlot,
  deleteTRPGSaveSlot,
} from '../../utils/trpgStorage';

interface TRPGSaveLoadModalProps {
  isOpen: boolean;
  onClose: () => void;
  session: TRPGSession;
  onRestoreSave: (slot: TRPGSaveSlot) => void;
  onSessionSaved?: () => void;
}

export const TRPGSaveLoadModal: React.FC<TRPGSaveLoadModalProps> = ({
  isOpen,
  onClose,
  session,
  onRestoreSave,
  onSessionSaved,
}) => {
  const [saveSlots, setSaveSlots] = useState<TRPGSaveSlot[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [newSaveName, setNewSaveName] = useState('');
  const [confirmRestoreSlot, setConfirmRestoreSlot] = useState<TRPGSaveSlot | null>(null);
  const [confirmDeleteSlot, setConfirmDeleteSlot] = useState<TRPGSaveSlot | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const refreshSlots = () => {
    const slots = loadTRPGSaveSlots(session.id);
    setSaveSlots(slots);
  };

  useEffect(() => {
    if (isOpen) {
      refreshSlots();
      setIsCreating(false);
      setNewSaveName('');
      setConfirmRestoreSlot(null);
      setConfirmDeleteSlot(null);
    }
  }, [isOpen, session.id]);

  if (!isOpen) return null;

  const autoSaveSlot = saveSlots.find((s) => s.isAutoSave);
  const manualSaveSlots = saveSlots.filter((s) => !s.isAutoSave);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2500);
  };

  const handleCreateManualSave = () => {
    const created = createTRPGSaveSlot(session, newSaveName.trim() || undefined, false);
    refreshSlots();
    setIsCreating(false);
    setNewSaveName('');
    showToast(`存档《${created.name}》已成功固化保存`);
    onSessionSaved?.();
  };

  const handleDeleteSlot = () => {
    if (confirmDeleteSlot) {
      deleteTRPGSaveSlot(confirmDeleteSlot.id);
      refreshSlots();
      showToast(`已删除存档《${confirmDeleteSlot.name}》`);
      setConfirmDeleteSlot(null);
    }
  };

  const handleExecuteRestore = () => {
    if (confirmRestoreSlot) {
      onRestoreSave(confirmRestoreSlot);
      setConfirmRestoreSlot(null);
      onClose();
    }
  };

  const formatTimestamp = (ts: number) => {
    const d = new Date(ts);
    return d.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex flex-col justify-end sm:justify-center p-0 sm:p-4 overflow-y-auto">
      <div className="w-full max-w-2xl bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh] sm:max-h-[85vh]">
        {/* Header */}
        <div className="p-4 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center text-indigo-400">
              <FolderArchive className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-bold text-base text-slate-100">跑团冒险存档与读档</h2>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-indigo-300 font-mono">
                  {manualSaveSlots.length + (autoSaveSlot ? 1 : 0)} 个存档点
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                完整保存角色状态、规则快照、行囊、小队、任务进度与地理方位
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
            title="返回便携终端"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Action Bar: Create Save Button / Input */}
        <div className="p-3 bg-slate-50 border-b border-slate-200 flex flex-col gap-2">
          {toastMessage && (
            <div className="p-2 px-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center gap-1.5 animate-in fade-in duration-150">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              {toastMessage}
            </div>
          )}

          {!isCreating ? (
            <div className="flex items-center justify-between gap-3">
              <div className="text-xs text-slate-500">
                当前战役：<span className="font-semibold text-slate-800">{session.title}</span>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsCreating(true);
                  const currentLoc = session.mapState?.locations?.find(
                    (l) => l.id === session.mapState.currentLocationId
                  )?.name || '未名驻地';
                  setNewSaveName(`${currentLoc} · 冒险见闻`);
                }}
                className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                新建手动存档
              </button>
            </div>
          ) : (
            <div className="flex flex-col sm:flex-row items-center gap-2 p-2 rounded-xl bg-white border border-indigo-200 shadow-xs">
              <input
                type="text"
                value={newSaveName}
                onChange={(e) => setNewSaveName(e.target.value)}
                placeholder="输入存档专属命名（如：探索血月地宫前夕）"
                className="flex-1 w-full px-3 py-1.5 rounded-lg text-xs bg-slate-50 border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 text-slate-800 font-medium"
                autoFocus
              />
              <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                <button
                  type="button"
                  onClick={() => setIsCreating(false)}
                  className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-medium cursor-pointer"
                >
                  取消
                </button>
                <button
                  type="button"
                  onClick={handleCreateManualSave}
                  className="px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-xs cursor-pointer flex items-center gap-1"
                >
                  <Save className="w-3.5 h-3.5" />
                  确认保存
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Save Slots List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* AutoSave Slot Banner */}
          {autoSaveSlot && (
            <div className="p-3.5 rounded-2xl bg-gradient-to-r from-amber-50/70 via-orange-50/40 to-white border border-amber-200/90 shadow-xs space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded-full bg-amber-500 text-slate-950 font-bold text-[10px] tracking-wider uppercase">
                    AutoSave 自动备份
                  </span>
                  <span className="text-[11px] text-slate-500 flex items-center gap-1">
                    <Clock className="w-3 h-3 text-slate-400" />
                    {formatTimestamp(autoSaveSlot.timestamp)}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setConfirmRestoreSlot(autoSaveSlot)}
                  className="px-3 py-1 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs shadow-xs transition-all flex items-center gap-1 cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  读取此自动档
                </button>
              </div>

              {/* Snapshot Summary Chips */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-xs">
                <div className="flex items-center gap-1.5 text-slate-700">
                  <MapPin className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                  <span className="truncate">{autoSaveSlot.summary.locationName}</span>
                </div>
                <div className="flex items-center gap-1.5 text-slate-700">
                  <Heart className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                  <span>
                    HP {autoSaveSlot.summary.currentHp}/{autoSaveSlot.summary.maxHp}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 text-slate-700">
                  <Users className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span>队友 {autoSaveSlot.summary.companionsCount} 人</span>
                </div>
                <div className="flex items-center gap-1.5 text-slate-700">
                  <ScrollText className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                  <span>任务 {autoSaveSlot.summary.activeQuestsCount} 项</span>
                </div>
              </div>
            </div>
          )}

          {/* Manual Save Slots Header */}
          <div className="flex items-center justify-between text-xs font-bold text-slate-500 uppercase tracking-wider pt-1">
            <span>手动保存档案</span>
            <span>共 {manualSaveSlots.length} 个独立槽位</span>
          </div>

          {/* Manual Slots Empty State */}
          {manualSaveSlots.length === 0 && (
            <div className="p-8 text-center rounded-2xl border-2 border-dashed border-slate-200 space-y-2">
              <FolderArchive className="w-8 h-8 text-slate-300 mx-auto" />
              <p className="text-xs text-slate-500 font-medium">暂无手动存档记录</p>
              <p className="text-[11px] text-slate-400">
                点击上方「新建手动存档」可在重大决策或决战前固化进度
              </p>
            </div>
          )}

          {/* Manual Slots Grid */}
          <div className="space-y-2.5">
            {manualSaveSlots.map((slot) => {
              return (
                <div
                  key={slot.id}
                  className="p-3.5 rounded-2xl bg-white border border-slate-200/90 hover:border-indigo-300 transition-all shadow-xs space-y-2.5"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <h4 className="font-bold text-sm text-slate-800 flex items-center gap-2">
                        {slot.name}
                        <span className="text-[10px] px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 font-mono font-normal">
                          v{slot.version}
                        </span>
                      </h4>
                      <p className="text-[11px] text-slate-400 flex items-center gap-1.5 mt-0.5">
                        <Clock className="w-3 h-3 text-slate-400" />
                        {formatTimestamp(slot.timestamp)}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 self-end sm:self-auto">
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteSlot(slot)}
                        className="p-1.5 rounded-xl hover:bg-rose-50 text-slate-400 hover:text-rose-600 transition-colors cursor-pointer"
                        title="删除此存档"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmRestoreSlot(slot)}
                        className="px-3.5 py-1.5 rounded-xl bg-indigo-50 hover:bg-indigo-600 text-indigo-700 hover:text-white font-bold text-xs transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        读取此存档
                      </button>
                    </div>
                  </div>

                  {/* Summary Details */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-slate-100 text-xs">
                    <div className="flex items-center gap-1.5 text-slate-600">
                      <MapPin className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                      <span className="truncate">{slot.summary.locationName}</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-slate-600">
                      <Heart className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                      <span>
                        HP {slot.summary.currentHp}/{slot.summary.maxHp}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 text-slate-600">
                      <Users className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      <span>小队 {slot.summary.companionsCount} 人</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-slate-600">
                      <BookMarked className="w-3.5 h-3.5 text-purple-600 shrink-0" />
                      <span>纪事 {slot.summary.storyLogCount} 条</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Load Confirmation Dialog */}
        {confirmRestoreSlot && (
          <div className="fixed inset-0 z-60 bg-black/75 flex items-center justify-center p-4">
            <div className="w-full max-w-sm bg-white rounded-2xl p-5 shadow-2xl border border-slate-200 space-y-4 animate-in fade-in zoom-in-95 duration-150">
              <div className="flex items-center gap-2.5 text-indigo-600 font-bold text-base">
                <RotateCcw className="w-5 h-5 shrink-0" />
                <span>确认读取跑团存档？</span>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                即将读取并恢复存档《
                <span className="font-bold text-slate-900">{confirmRestoreSlot.name}</span>
                》（保存于 {formatTimestamp(confirmRestoreSlot.timestamp)}）。
              </p>
              <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-800 space-y-1">
                <div className="font-bold flex items-center gap-1">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                  提示
                </div>
                <p className="text-[11px] leading-relaxed">
                  读档将恢复角色全部属性、技能、行囊、小队关系、任务状态与地图驻地。当前战役未保存的即时对话将被此存档覆盖。
                </p>
              </div>
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setConfirmRestoreSlot(null)}
                  className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium cursor-pointer"
                >
                  取消
                </button>
                <button
                  type="button"
                  onClick={handleExecuteRestore}
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-md cursor-pointer flex items-center gap-1"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  确认恢复
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Delete Confirmation Dialog */}
        {confirmDeleteSlot && (
          <div className="fixed inset-0 z-60 bg-black/75 flex items-center justify-center p-4">
            <div className="w-full max-w-sm bg-white rounded-2xl p-5 shadow-2xl border border-slate-200 space-y-4 animate-in fade-in zoom-in-95 duration-150">
              <div className="flex items-center gap-2.5 text-rose-600 font-bold text-base">
                <Trash2 className="w-5 h-5 shrink-0" />
                <span>确认删除此存档？</span>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                确定要彻底删除存档《
                <span className="font-bold text-slate-900">{confirmDeleteSlot.name}</span>
                》吗？此操作无法撤销。
              </p>
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setConfirmDeleteSlot(null)}
                  className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium cursor-pointer"
                >
                  保留
                </button>
                <button
                  type="button"
                  onClick={handleDeleteSlot}
                  className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-md cursor-pointer"
                >
                  确认删除
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
