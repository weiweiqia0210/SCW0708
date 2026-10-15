import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Sparkles,
  Download,
  Upload,
  Image as ImageIcon,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Check,
  Loader2,
  Trash2,
  User,
} from 'lucide-react';
import { CharacterCard, AppSettings } from '../types';
import { downloadJsonFile, loadSettings } from '../utils/storage';

interface CharacterModalProps {
  isOpen: boolean;
  character: CharacterCard | null;
  onClose: () => void;
  onSave: (char: CharacterCard) => void;
}

export const CharacterModal: React.FC<CharacterModalProps> = ({
  isOpen,
  character,
  onClose,
  onSave,
}) => {
  const [formData, setFormData] = useState<Partial<CharacterCard>>({
    name: '',
    identity: '',
    avatarImage: '',
    gender: '未知',
    age: '',
    appearance: '',
    personality: '',
    background: '',
    speechStyle: '',
    customNotes: '',
  });

  // AI Polish section
  const [aiDraftInput, setAiDraftInput] = useState('');
  const [isPolishing, setIsPolishing] = useState(false);
  const [polishSuccess, setPolishSuccess] = useState(false);
  const [polishError, setPolishError] = useState<string | null>(null);

  // Avatar Zoom & Pan state
  const [rawImageSrc, setRawImageSrc] = useState<string>('');
  const [scale, setScale] = useState<number>(1);
  const [panX, setPanX] = useState<number>(0);
  const [panY, setPanY] = useState<number>(0);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (character) {
      setFormData(character);
      setRawImageSrc(character.avatarImage || '');
      setScale(1);
      setPanX(0);
      setPanY(0);
    } else {
      setFormData({
        name: '',
        identity: '',
        avatarImage: '',
        gender: '未知',
        age: '',
        appearance: '',
        personality: '',
        background: '',
        speechStyle: '',
        customNotes: '',
      });
      setRawImageSrc('');
      setScale(1);
      setPanX(0);
      setPanY(0);
    }
    setAiDraftInput('');
    setPolishSuccess(false);
    setPolishError(null);
  }, [character, isOpen]);

  // Redraw cropped avatar to 200x200 canvas whenever rawImage, scale, or pan changes
  useEffect(() => {
    if (!rawImageSrc) return;

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const size = 200;
      canvas.width = size;
      canvas.height = size;
      ctx.clearRect(0, 0, size, size);

      ctx.save();
      // Draw centered with scale & pan
      ctx.translate(size / 2 + panX, size / 2 + panY);
      ctx.scale(scale, scale);

      // Maintain aspect ratio cover
      const minDimension = Math.min(img.width, img.height);
      const drawWidth = (img.width / minDimension) * size;
      const drawHeight = (img.height / minDimension) * size;

      ctx.drawImage(img, -drawWidth / 2, -drawHeight / 2, drawWidth, drawHeight);
      ctx.restore();

      const croppedBase64 = canvas.toDataURL('image/png', 0.9);
      setFormData((prev) => ({ ...prev, avatarImage: croppedBase64 }));
    };
    img.src = rawImageSrc;
  }, [rawImageSrc, scale, panX, panY]);

  if (!isOpen) return null;

  // File upload handler
  const handleAvatarFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target?.result as string;
      setRawImageSrc(base64);
      setScale(1);
      setPanX(0);
      setPanY(0);
    };
    reader.readAsDataURL(file);
  };

  // Mouse drag handlers for repositioning avatar
  const handleMouseDown = (e: React.MouseEvent) => {
    if (!rawImageSrc) return;
    setIsDragging(true);
    setDragStart({ x: e.clientX - panX, y: e.clientY - panY });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    setPanX(e.clientX - dragStart.x);
    setPanY(e.clientY - dragStart.y);
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // AI Polish
  const handleAiPolish = async () => {
    if (!aiDraftInput.trim()) return;

    setIsPolishing(true);
    setPolishError(null);
    setPolishSuccess(false);

    try {
      const settings: AppSettings = loadSettings();
      const res = await fetch('/api/polish-character', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: aiDraftInput.trim(),
          provider: settings.provider,
          model: settings.model,
          customApiKey: settings.customApiKey,
          customEndpoint: settings.customEndpoint,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'AI 润色解析失败');
      }

      const pChar = data.character;
      setFormData((prev) => ({
        ...prev,
        name: pChar.name || prev.name,
        identity: pChar.identity || prev.identity,
        gender: pChar.gender || prev.gender,
        age: pChar.age || prev.age,
        appearance: pChar.appearance || prev.appearance,
        personality: pChar.personality || prev.personality,
        background: pChar.background || prev.background,
        speechStyle: pChar.speechStyle || prev.speechStyle,
        customNotes: pChar.customNotes || prev.customNotes,
      }));

      setPolishSuccess(true);
      setTimeout(() => setPolishSuccess(false), 4000);
    } catch (err: any) {
      console.error('AI polish error:', err);
      setPolishError(err.message || '润色解析失败，请检查设置中的 API Key');
    } finally {
      setIsPolishing(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name?.trim()) return;

    const charToSave: CharacterCard = {
      id: character ? character.id : `char-${Date.now()}`,
      name: formData.name.trim(),
      identity: formData.identity?.trim() || '冒险者',
      avatarImage: formData.avatarImage || '',
      gender: formData.gender?.trim() || '未知',
      age: formData.age?.trim() || '未明',
      appearance: formData.appearance?.trim() || '',
      personality: formData.personality?.trim() || '',
      background: formData.background?.trim() || '',
      speechStyle: formData.speechStyle?.trim() || '',
      customNotes: formData.customNotes?.trim() || '',
      updatedAt: Date.now(),
      createdAt: character?.createdAt || Date.now(),
    };

    onSave(charToSave);
    onClose();
  };

  const handleExportSingle = () => {
    if (!formData.name) return;
    downloadJsonFile(`角色卡-${formData.name}.json`, JSON.stringify(formData, null, 2));
  };

  const handleImportSingle = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        if (parsed && typeof parsed === 'object') {
          setFormData((prev) => ({
            ...prev,
            ...parsed,
            id: character ? character.id : prev.id,
          }));
          if (parsed.avatarImage) {
            setRawImageSrc(parsed.avatarImage);
          }
        }
      } catch {
        alert('导入角色卡格式错误');
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/40 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="w-full max-w-lg bg-white rounded-2xl shadow-xl border border-sky-100 flex flex-col max-h-[92vh]">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-slate-800">
              {character ? '编辑角色卡' : '创建新角色卡'}
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            {character && (
              <button
                type="button"
                onClick={handleExportSingle}
                title="导出为JSON"
                className="p-1.5 rounded-lg text-slate-400 hover:text-sky-600 hover:bg-sky-50 transition-colors"
              >
                <Download className="w-4 h-4" />
              </button>
            )}
            <label
              title="导入角色卡JSON"
              className="p-1.5 rounded-lg text-slate-400 hover:text-sky-600 hover:bg-sky-50 transition-colors cursor-pointer"
            >
              <Upload className="w-4 h-4" />
              <input type="file" accept=".json" onChange={handleImportSingle} className="hidden" />
            </label>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleSubmit} className="overflow-y-auto p-5 space-y-4 text-xs">
          {/* AI Polish Section */}
          <div className="p-3.5 rounded-2xl bg-gradient-to-br from-sky-50/80 via-white to-blue-50/40 border border-sky-200/80 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-sky-800 flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-sky-600" />
                AI 智能润色与拆解
              </span>
              <span className="text-[10px] text-slate-400">自动解析并填入各字段</span>
            </div>

            <textarea
              rows={2}
              value={aiDraftInput}
              onChange={(e) => setAiDraftInput(e.target.value)}
              placeholder="在此输入粗略的人物想法或灵感（如：24岁女药师沈白微，白发青衣，性格傲娇但极度心软，随身带着青玉药臼，被逐出宗门实则背负血海深仇...）"
              className="w-full p-2.5 rounded-xl border border-sky-200/80 bg-white text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-sky-400 leading-relaxed"
            />

            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={() =>
                  setAiDraftInput(
                    '顾夜白，25岁，玄夜阁首席暗卫。黑衣墨发，银丝面具，手持无影匕首。平日惜字如金、冷酷无情，却暗中以性命守护主角。体内有噬魂反噬咒印。'
                  )
                }
                className="text-[10px] text-sky-600 hover:underline cursor-pointer"
              >
                试试填入示例灵感
              </button>

              <button
                type="button"
                disabled={isPolishing || !aiDraftInput.trim()}
                onClick={handleAiPolish}
                className="px-3.5 py-1.5 rounded-xl bg-sky-500 hover:bg-sky-600 active:scale-95 disabled:opacity-50 text-white font-medium flex items-center gap-1.5 shadow-xs shadow-sky-200 transition-all cursor-pointer"
              >
                {isPolishing ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    智能润色中...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5" />
                    AI 智能润色填入
                  </>
                )}
              </button>
            </div>

            {polishSuccess && (
              <div className="p-2 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 text-[11px] flex items-center gap-1.5 animate-in fade-in">
                <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                已智能提炼并填入下方各个对话框，您可以继续查验或微调！
              </div>
            )}

            {polishError && (
              <div className="p-2 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-[11px] leading-relaxed">
                ⚠️ {polishError}
              </div>
            )}
          </div>

          {/* Avatar Upload with Zoom and Pan */}
          <div className="p-3.5 rounded-2xl bg-slate-50/70 border border-slate-200/80 space-y-3">
            <div className="flex items-center justify-between">
              <label className="font-semibold text-slate-700 flex items-center gap-1.5">
                <ImageIcon className="w-4 h-4 text-sky-500" />
                角色头像（支持上传图片并放大缩小剪裁）
              </label>
              {rawImageSrc && (
                <button
                  type="button"
                  onClick={() => {
                    setRawImageSrc('');
                    setFormData((prev) => ({ ...prev, avatarImage: '' }));
                  }}
                  className="text-slate-400 hover:text-rose-500 flex items-center gap-1 text-[11px]"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  清除头像
                </button>
              )}
            </div>

            <div className="flex items-start gap-4">
              {/* Avatar Viewport (drag to pan) */}
              <div
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
                className={`w-24 h-24 sm:w-28 sm:h-28 rounded-2xl overflow-hidden border-2 border-dashed border-sky-300 bg-white relative flex items-center justify-center shrink-0 shadow-inner select-none ${
                  rawImageSrc ? 'cursor-grab active:cursor-grabbing border-solid border-sky-400' : ''
                }`}
              >
                {rawImageSrc ? (
                  <img
                    src={rawImageSrc}
                    alt="头像原图"
                    style={{
                      transform: `translate(${panX}px, ${panY}px) scale(${scale})`,
                      transformOrigin: 'center center',
                      maxWidth: 'none',
                      pointerEvents: 'none',
                    }}
                    className="w-full h-full object-cover transition-transform duration-75"
                  />
                ) : (
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="text-center p-2 cursor-pointer flex flex-col items-center text-slate-400 hover:text-sky-600 transition-colors"
                  >
                    <User className="w-7 h-7 mb-1 opacity-50" />
                    <span className="text-[10px]">点击上传头像</span>
                  </div>
                )}
              </div>

              {/* Hidden Canvas used for cropping */}
              <canvas ref={canvasRef} className="hidden" />

              {/* Controls and Sliders */}
              <div className="flex-1 space-y-2">
                <div>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="px-3 py-1.5 rounded-xl border border-sky-200 bg-white hover:bg-sky-50 text-sky-700 text-xs font-medium transition-colors cursor-pointer"
                  >
                    选择本地图片...
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleAvatarFile}
                    className="hidden"
                  />
                </div>

                {rawImageSrc && (
                  <div className="space-y-1.5 pt-1">
                    <div className="flex items-center justify-between text-[11px] text-slate-500">
                      <span className="flex items-center gap-1">
                        <ZoomIn className="w-3.5 h-3.5 text-sky-500" />
                        头像放大缩小:
                      </span>
                      <span className="font-semibold text-sky-600">{scale.toFixed(1)}x</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <input
                        type="range"
                        min={0.5}
                        max={3.0}
                        step={0.1}
                        value={scale}
                        onChange={(e) => setScale(parseFloat(e.target.value))}
                        className="flex-1 accent-sky-500 cursor-pointer"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          setScale(1);
                          setPanX(0);
                          setPanY(0);
                        }}
                        title="复位尺寸与位置"
                        className="p-1 rounded text-slate-400 hover:text-slate-600"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div className="text-[10px] text-slate-400">
                      可在左侧头像框内按住鼠标拖拽调整位置
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Basic Fields */}
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <label className="block font-medium text-slate-700 mb-1">
                角色姓名 <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={formData.name || ''}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="例如：艾尔伦、沈惊澜"
                className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:border-sky-400"
              />
            </div>
            <div>
              <label className="block font-medium text-slate-700 mb-1">头衔 / 身份</label>
              <input
                type="text"
                value={formData.identity || ''}
                onChange={(e) => setFormData({ ...formData, identity: e.target.value })}
                placeholder="例如：苍白裁决官"
                className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:border-sky-400"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-medium text-slate-700 mb-1">性别</label>
              <input
                type="text"
                value={formData.gender || ''}
                onChange={(e) => setFormData({ ...formData, gender: e.target.value })}
                placeholder="男 / 女 / 拟态"
                className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:border-sky-400"
              />
            </div>
            <div>
              <label className="block font-medium text-slate-700 mb-1">年龄 / 状态</label>
              <input
                type="text"
                value={formData.age || ''}
                onChange={(e) => setFormData({ ...formData, age: e.target.value })}
                placeholder="27岁 / 运行3年"
                className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:border-sky-400"
              />
            </div>
          </div>

          <div>
            <label className="block font-medium text-slate-700 mb-1">外貌容姿与装束</label>
            <textarea
              rows={2}
              value={formData.appearance || ''}
              onChange={(e) => setFormData({ ...formData, appearance: e.target.value })}
              placeholder="外貌特征、发色、眸色、标志性服装或特殊配饰..."
              className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:border-sky-400 leading-relaxed"
            />
          </div>

          <div>
            <label className="block font-medium text-slate-700 mb-1">性格与行事心性</label>
            <textarea
              rows={2}
              value={formData.personality || ''}
              onChange={(e) => setFormData({ ...formData, personality: e.target.value })}
              placeholder="核心性格、情绪底色、与人相处习惯、情感弱点..."
              className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:border-sky-400 leading-relaxed"
            />
          </div>

          <div>
            <label className="block font-medium text-slate-700 mb-1">过往身世经历</label>
            <textarea
              rows={2}
              value={formData.background || ''}
              onChange={(e) => setFormData({ ...formData, background: e.target.value })}
              placeholder="经历、背负的秘密、誓约或执念..."
              className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:border-sky-400 leading-relaxed"
            />
          </div>

          <div>
            <label className="block font-medium text-slate-700 mb-1">言语习惯与语气口癖</label>
            <textarea
              rows={2}
              value={formData.speechStyle || ''}
              onChange={(e) => setFormData({ ...formData, speechStyle: e.target.value })}
              placeholder="用词风格（如冰冷克制、懒散调侃、少言寡语）、习惯称谓..."
              className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:border-sky-400 leading-relaxed"
            />
          </div>

          <div>
            <label className="block font-medium text-slate-700 mb-1">自定义暗线与隐藏备注</label>
            <textarea
              rows={2}
              value={formData.customNotes || ''}
              onChange={(e) => setFormData({ ...formData, customNotes: e.target.value })}
              placeholder="特殊弱点、反常触发条件、好感提升关窍等补充..."
              className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:border-sky-400 leading-relaxed"
            />
          </div>

          {/* Actions */}
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
              保存角色
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
