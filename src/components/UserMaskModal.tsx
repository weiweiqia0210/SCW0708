import React, { useState, useEffect } from 'react';
import { X, User, Check, Sparkles, Tag, Shield, Compass, BookOpen } from 'lucide-react';
import { UserMask } from '../types';

interface UserMaskModalProps {
  isOpen: boolean;
  mask: UserMask | null; // null means create new
  onClose: () => void;
  onSave: (mask: UserMask) => void;
}

export const UserMaskModal: React.FC<UserMaskModalProps> = ({
  isOpen,
  mask,
  onClose,
  onSave,
}) => {
  const [name, setName] = useState('');
  const [codeName, setCodeName] = useState('');
  const [nickname, setNickname] = useState('');
  const [gender, setGender] = useState('未明');
  const [identity, setIdentity] = useState('');
  const [appearance, setAppearance] = useState('');
  const [personality, setPersonality] = useState('');
  const [customNotes, setCustomNotes] = useState('');
  const [speechStyle, setSpeechStyle] = useState('');

  useEffect(() => {
    if (mask) {
      setName(mask.name || '');
      setCodeName(mask.codeName || '');
      setNickname(mask.nickname || '');
      setGender(mask.gender || '未明');
      setIdentity(mask.identity || '');
      setAppearance(mask.appearance || '');
      setPersonality(mask.personality || '');
      setCustomNotes(mask.customNotes || '');
      setSpeechStyle(mask.speechStyle || '');
    } else {
      setName('');
      setCodeName('');
      setNickname('');
      setGender('未明');
      setIdentity('');
      setAppearance('');
      setPersonality('');
      setCustomNotes('');
      setSpeechStyle('');
    }
  }, [mask, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      alert('请填写玩家姓名');
      return;
    }

    const savedMask: UserMask = {
      id: mask ? mask.id : `mask-${Date.now()}`,
      name: name.trim(),
      codeName: codeName.trim() || undefined,
      nickname: nickname.trim() || undefined,
      gender: gender.trim() || '未明',
      identity: identity.trim() || undefined,
      appearance: appearance.trim() || undefined,
      personality: personality.trim() || undefined,
      customNotes: customNotes.trim() || undefined,
      speechStyle: speechStyle.trim() || undefined,
      updatedAt: Date.now(),
      createdAt: mask ? mask.createdAt : Date.now(),
    };

    onSave(savedMask);
    onClose();
  };

  const quickTemplates = [
    {
      label: '异域行者',
      name: '林远',
      codeName: '异乡客',
      nickname: '阿远',
      gender: '男',
      identity: '穿行于多重位面的异邦游历学者',
      appearance: '身披避尘防风的深灰呢绒斗篷，内穿便于拔刀的利落贴身革甲，神情沉静，眼底带着见惯未知的淡泊',
      personality: '深思熟虑、敏于洞察，面对陌生危机极度沉着，重守契约与承诺，外冷内热',
      customNotes: '贴身携带一枚无法用常规物理法则解析的古旧星盘；无论身陷何种绝境，总能保持平稳心率',
      speechStyle: '谦和内敛，言简意赅，习惯以『在下』或平实质朴口吻交谈',
    },
    {
      label: '冷锋游侠',
      name: '叶寒声',
      codeName: '孤雁',
      nickname: '老叶',
      gender: '男',
      identity: '流连于乱世与黑市酒馆的无宗派赏金游侠',
      appearance: '墨黑束袖劲装，腰佩带穗长刀与三枚鹿皮小药囊，面带一道浅淡刀痕，眸光锐如冷电',
      personality: '独来独往、戒备心强、言出必行；表面看似玩世不恭，实则心细如发、杀伐决断',
      customNotes: '对饮品和食物中的异样气味极端敏感；反感他人直呼原名，更习惯听人称其代号',
      speechStyle: '惜字如金，嗓音低哑清冽，情绪少起伏',
    },
    {
      label: '秘法调查官',
      name: '薇薇安·克罗伊茨',
      codeName: '银鸦',
      nickname: '安妮',
      gender: '女',
      identity: '隐秘裁决所特派高级调查特使',
      appearance: '剪裁得体的深蓝排扣风衣，戴着纤尘不染的白手套与银丝单片眼镜，金发微卷，神情从容自若',
      personality: '思维极其缜密，精通心理博弈与谎言拆解，行事滴水不漏，有着令人捉摸不透的幽默感',
      customNotes: '随身提箱内装满禁忌文献拓片与精密炼金测谎仪器；一旦进入解谜或审讯状态，目光具极强压迫感',
      speechStyle: '辞藻优雅含蓄，语调不疾不徐，总能在轻描淡写间切中要害',
    },
  ];

  const applyTemplate = (tpl: typeof quickTemplates[0]) => {
    setName(tpl.name);
    setCodeName(tpl.codeName);
    setNickname(tpl.nickname);
    setGender(tpl.gender);
    setIdentity(tpl.identity);
    setAppearance(tpl.appearance);
    setPersonality(tpl.personality);
    setCustomNotes(tpl.customNotes);
    setSpeechStyle(tpl.speechStyle);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/40 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="w-full max-w-xl bg-white rounded-2xl shadow-2xl border border-sky-100 flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center font-bold text-base border border-sky-100">
              🎭
            </div>
            <div>
              <span className="text-sm font-bold text-slate-800">
                {mask ? '编辑玩家面具人设卡' : '创建玩家面具人设卡 (User)'}
              </span>
              <p className="text-[11px] text-slate-400">
                定义姓名、代号、昵称、性别、身份、外貌、性格与额外设定
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="overflow-y-auto p-5 space-y-4 text-xs">
          {/* Quick templates */}
          {!mask && (
            <div className="p-3 rounded-xl bg-sky-50/70 border border-sky-100">
              <div className="text-[11px] font-medium text-sky-800 flex items-center gap-1 mb-1.5">
                <Sparkles className="w-3.5 h-3.5 text-sky-500" />
                快速套用完整人设范式
              </div>
              <div className="flex flex-wrap gap-1.5">
                {quickTemplates.map((tpl) => (
                  <button
                    key={tpl.label}
                    type="button"
                    onClick={() => applyTemplate(tpl)}
                    className="px-2.5 py-1 rounded-lg bg-white border border-sky-200/80 hover:border-sky-400 hover:bg-sky-50 text-sky-700 text-[11px] font-medium transition-colors cursor-pointer shadow-2xs"
                  >
                    + {tpl.label} ({tpl.name} / {tpl.codeName})
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Section 1: 称呼体系 (姓名、代号、昵称) */}
          <div className="p-3.5 rounded-xl bg-slate-50/70 border border-slate-200/80 space-y-3">
            <div className="text-[11px] font-semibold text-slate-700 flex items-center gap-1.5">
              <Tag className="w-3.5 h-3.5 text-sky-500" />
              <span>称呼与基本标识</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              {/* 姓名 */}
              <div>
                <label className="block font-medium text-slate-700 mb-1">
                  姓名 <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="如：林远、亚瑟"
                  required
                  className="w-full px-3 py-1.5 rounded-lg border border-slate-200 focus:outline-none focus:border-sky-400 bg-white"
                />
              </div>

              {/* 代号 */}
              <div>
                <label className="block font-medium text-slate-700 mb-1">代号</label>
                <input
                  type="text"
                  value={codeName}
                  onChange={(e) => setCodeName(e.target.value)}
                  placeholder="如：异乡客、零号、孤雁"
                  className="w-full px-3 py-1.5 rounded-lg border border-slate-200 focus:outline-none focus:border-sky-400 bg-white"
                />
              </div>

              {/* 昵称 */}
              <div>
                <label className="block font-medium text-slate-700 mb-1">昵称</label>
                <input
                  type="text"
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                  placeholder="如：阿远、小羽、阁下"
                  className="w-full px-3 py-1.5 rounded-lg border border-slate-200 focus:outline-none focus:border-sky-400 bg-white"
                />
              </div>
            </div>

            {/* 性别与身份 */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
              {/* 性别 */}
              <div>
                <label className="block font-medium text-slate-700 mb-1">性别</label>
                <input
                  type="text"
                  value={gender}
                  onChange={(e) => setGender(e.target.value)}
                  placeholder="如：男、女、未明、中性"
                  className="w-full px-3 py-1.5 rounded-lg border border-slate-200 focus:outline-none focus:border-sky-400 bg-white"
                />
              </div>

              {/* 身份 */}
              <div className="sm:col-span-2">
                <label className="block font-medium text-slate-700 mb-1">身份</label>
                <input
                  type="text"
                  value={identity}
                  onChange={(e) => setIdentity(e.target.value)}
                  placeholder="如：游历诸界的异域行者 / 皇家特派调查官 / 流浪雇佣剑士"
                  className="w-full px-3 py-1.5 rounded-lg border border-slate-200 focus:outline-none focus:border-sky-400 bg-white"
                />
              </div>
            </div>
          </div>

          {/* Section 2: 外貌与性格 */}
          <div className="space-y-3">
            {/* 外貌 */}
            <div>
              <label className="block font-medium text-slate-700 mb-1">
                外貌 <span className="text-slate-400 font-normal">(容貌特征、身姿体态、衣着打扮、常佩随身饰物)</span>
              </label>
              <textarea
                rows={2}
                value={appearance}
                onChange={(e) => setAppearance(e.target.value)}
                placeholder="例如：一袭便于行动的深灰旅行风衣，风尘仆仆，神情内敛微冷，指尖微有长期握笔与握剑的薄茧，眼底带着见惯生死的淡泊……"
                className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:border-sky-400 bg-white resize-none"
              />
            </div>

            {/* 性格 */}
            <div>
              <label className="block font-medium text-slate-700 mb-1">
                性格 <span className="text-slate-400 font-normal">(心性作风、处事准则、道德底线、对待他人的防备感)</span>
              </label>
              <textarea
                rows={2}
                value={personality}
                onChange={(e) => setPersonality(e.target.value)}
                placeholder="例如：沉静自持、敏于洞察，面对未知保持审慎；极重契约信诺，外冷内热，底线清晰决不退让……"
                className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:border-sky-400 bg-white resize-none"
              />
            </div>
          </div>

          {/* Section 3: 额外设定 (Extra lore / notes) */}
          <div className="space-y-3 pt-1">
            {/* 额外设定 */}
            <div>
              <label className="block font-medium text-slate-700 mb-1">
                额外设定 <span className="text-slate-400 font-normal">(特殊秘密、禁忌、随身重要之物、特殊生理/心理暗线)</span>
              </label>
              <textarea
                rows={2}
                value={customNotes}
                onChange={(e) => setCustomNotes(e.target.value)}
                placeholder="例如：随身佩戴一枚失落纪元的古旧黄铜星盘；对某种特定药草气味高度警觉；心率在危机中依然稳定如常……"
                className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:border-sky-400 bg-white resize-none"
              />
            </div>

            {/* 言谈口吻 (选填) */}
            <div>
              <label className="block font-medium text-slate-700 mb-1">
                言谈口吻 <span className="text-slate-400 font-normal">(选填：日常语调习惯、特定口头禅)</span>
              </label>
              <input
                type="text"
                value={speechStyle}
                onChange={(e) => setSpeechStyle(e.target.value)}
                placeholder="例如：惜字如金、低沉平和，习惯在深思时停顿"
                className="w-full px-3 py-1.5 rounded-lg border border-slate-200 focus:outline-none focus:border-sky-400 bg-white"
              />
            </div>
          </div>

          {/* Buttons */}
          <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600 font-medium transition-colors cursor-pointer"
            >
              取消
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-xl bg-sky-500 hover:bg-sky-600 text-white font-medium shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <Check className="w-3.5 h-3.5" />
              {mask ? '保存修改' : '立即创建面具'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
