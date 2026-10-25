import React, { useState } from 'react';
import { X, Copy, Save, Plus, Trash2, Shield, Check, AlertCircle, BookOpen } from 'lucide-react';
import { TRPGRuleset, TRPGAttributeDef, TRPGSkillDef } from '../../types/trpg';
import { saveCustomTRPGRuleset, duplicateTRPGRuleset } from '../../utils/trpgStorage';

interface TRPGRulesetModalProps {
  isOpen: boolean;
  ruleset: TRPGRuleset;
  onClose: () => void;
  onSave: (saved: TRPGRuleset) => void;
}

export const TRPGRulesetModal: React.FC<TRPGRulesetModalProps> = ({
  isOpen,
  ruleset,
  onClose,
  onSave,
}) => {
  const [formData, setFormData] = useState<TRPGRuleset>(() => JSON.parse(JSON.stringify(ruleset)));
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleAttributeChange = (index: number, field: keyof TRPGAttributeDef, value: any) => {
    const nextAttrs = [...formData.attributes];
    nextAttrs[index] = { ...nextAttrs[index], [field]: value };
    setFormData({ ...formData, attributes: nextAttrs });
  };

  const handleAddSkill = () => {
    const newSkill: TRPGSkillDef = {
      id: `skill-${Date.now()}`,
      name: '自定义技能',
      attributeKey: formData.attributes[0]?.key || 'str',
      description: '技能效果说明',
    };
    setFormData({ ...formData, skills: [...formData.skills, newSkill] });
  };

  const handleRemoveSkill = (id: string) => {
    setFormData({ ...formData, skills: formData.skills.filter((s) => s.id !== id) });
  };

  const handleSkillChange = (index: number, field: keyof TRPGSkillDef, value: any) => {
    const nextSkills = [...formData.skills];
    nextSkills[index] = { ...nextSkills[index], [field]: value };
    setFormData({ ...formData, skills: nextSkills });
  };

  const handleSave = () => {
    // If it's the builtin ruleset, saveCustomTRPGRuleset automatically duplicates to a custom copy!
    const saved = saveCustomTRPGRuleset(formData);
    onSave(saved);
    setSaveSuccessMsg(formData.isBuiltin ? '已为您自动另存为新自定义规则预设！' : '预设已成功更新！');
    setTimeout(() => {
      setSaveSuccessMsg(null);
      onClose();
    }, 800);
  };

  const handleDuplicate = () => {
    const duplicated = duplicateTRPGRuleset(formData, `${formData.name} (副本)`);
    onSave(duplicated);
    setSaveSuccessMsg('已创建并选中副本！');
    setTimeout(() => {
      setSaveSuccessMsg(null);
      onClose();
    }, 800);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl shadow-2xl border border-sky-100 w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-sky-50/70 to-indigo-50/50">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-xs">
              <BookOpen className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-slate-800">规则预设配置</h3>
                {formData.isBuiltin ? (
                  <span className="px-2 py-0.2 rounded-full bg-sky-100 text-sky-800 text-[10px] font-semibold border border-sky-200">
                    内置默认规则（修改将另存为新预设）
                  </span>
                ) : (
                  <span className="px-2 py-0.2 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-semibold border border-emerald-200">
                    自定义规则预设
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-500">
                配置基础六维属性、技能池、难度DC阈值与生命/伤害公式
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-slate-200/60 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
            title="返回便携终端"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 sm:p-6 overflow-y-auto overflow-x-hidden space-y-5 w-full">
          {saveSuccessMsg && (
            <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center gap-2">
              <Check className="w-4 h-4" />
              {saveSuccessMsg}
            </div>
          )}

          {/* Name & Description */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">预设名称</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-400 bg-white"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">默认空手伤害公式</label>
              <input
                type="text"
                value={formData.defaultDamageFormula}
                onChange={(e) => setFormData({ ...formData, defaultDamageFormula: e.target.value })}
                placeholder="1d4+STR"
                className="w-full px-3 py-2 text-xs font-mono border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-400 bg-white"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 mb-1">规则描述与背景说明</label>
              <textarea
                rows={2}
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-400 bg-white resize-none"
              />
            </div>
          </div>

          {/* Core Attributes */}
          <div className="w-full">
            <label className="block text-xs font-bold text-slate-800 mb-2">
              基础核心属性体系 ({formData.attributes.length} 项)
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5 w-full overflow-x-hidden">
              {formData.attributes.map((attr, idx) => (
                <div key={attr.key} className="p-2.5 rounded-xl border border-slate-200 bg-slate-50/50 flex flex-col justify-between gap-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-700">
                      {attr.name} ({attr.abbr})
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono">{attr.key.toUpperCase()}</span>
                  </div>
                  <input
                    type="text"
                    value={attr.name}
                    onChange={(e) => handleAttributeChange(idx, 'name', e.target.value)}
                    placeholder="属性名称"
                    className="w-full px-2 py-1 text-xs border border-slate-200 rounded-lg bg-white"
                  />
                  <input
                    type="text"
                    value={attr.description}
                    onChange={(e) => handleAttributeChange(idx, 'description', e.target.value)}
                    placeholder="简要描述"
                    className="w-full px-2 py-0.5 text-[10px] text-slate-500 border border-slate-200 rounded-lg bg-white"
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Difficulty Classes */}
          <div>
            <label className="block text-xs font-bold text-slate-800 mb-2">标准检定难度 (DC 阈值)</label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <div>
                <span className="text-[10px] text-slate-500">简单 (Easy)</span>
                <input
                  type="number"
                  value={formData.difficultyClasses.easy}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      difficultyClasses: {
                        ...formData.difficultyClasses,
                        easy: parseInt(e.target.value, 10) || 10,
                      },
                    })
                  }
                  className="w-full px-2.5 py-1 text-xs font-mono font-bold border border-slate-200 rounded-lg"
                />
              </div>
              <div>
                <span className="text-[10px] text-slate-500">中等 (Medium)</span>
                <input
                  type="number"
                  value={formData.difficultyClasses.medium}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      difficultyClasses: {
                        ...formData.difficultyClasses,
                        medium: parseInt(e.target.value, 10) || 15,
                      },
                    })
                  }
                  className="w-full px-2.5 py-1 text-xs font-mono font-bold border border-slate-200 rounded-lg"
                />
              </div>
              <div>
                <span className="text-[10px] text-slate-500">困难 (Hard)</span>
                <input
                  type="number"
                  value={formData.difficultyClasses.hard}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      difficultyClasses: {
                        ...formData.difficultyClasses,
                        hard: parseInt(e.target.value, 10) || 20,
                      },
                    })
                  }
                  className="w-full px-2.5 py-1 text-xs font-mono font-bold border border-slate-200 rounded-lg"
                />
              </div>
              <div>
                <span className="text-[10px] text-slate-500">极难 (Very Hard)</span>
                <input
                  type="number"
                  value={formData.difficultyClasses.veryHard}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      difficultyClasses: {
                        ...formData.difficultyClasses,
                        veryHard: parseInt(e.target.value, 10) || 25,
                      },
                    })
                  }
                  className="w-full px-2.5 py-1 text-xs font-mono font-bold border border-slate-200 rounded-lg"
                />
              </div>
            </div>
          </div>

          {/* Skills Pool */}
          <div className="w-full space-y-2 overflow-x-hidden">
            <div className="flex items-center justify-between">
              <div>
                <label className="text-xs font-bold text-slate-800">
                  技能库清单 ({formData.skills.length} 项)
                </label>
                <span className="text-[11px] text-slate-400 ml-2">全预览展示 · 可自由编辑与增删</span>
              </div>
              <button
                type="button"
                onClick={handleAddSkill}
                className="px-2.5 py-1 text-xs font-bold text-sky-700 hover:text-sky-800 bg-sky-50 hover:bg-sky-100 rounded-lg flex items-center gap-1 cursor-pointer transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                新增技能
              </button>
            </div>

            {/* Full preview vertical list with no nested scroll and no horizontal scroll */}
            <div className="w-full flex flex-col gap-2 overflow-x-hidden">
              {formData.skills.map((skill, idx) => (
                <div
                  key={skill.id}
                  className="w-full p-2.5 rounded-2xl border border-slate-200 bg-white hover:border-slate-300 flex flex-col gap-1.5 shadow-xs transition-colors"
                >
                  {/* 第一行：技能名 + 关联属性下拉 + 删除按钮 */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <input
                        type="text"
                        value={skill.name}
                        onChange={(e) => handleSkillChange(idx, 'name', e.target.value)}
                        placeholder="技能名称"
                        className="w-32 px-2.5 py-1 text-xs font-bold text-slate-800 border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-sky-500"
                      />
                      <select
                        value={skill.attributeKey}
                        onChange={(e) => handleSkillChange(idx, 'attributeKey', e.target.value)}
                        className="px-2 py-1 text-xs font-medium border border-slate-200 rounded-lg bg-slate-50 text-slate-700 cursor-pointer focus:outline-none focus:ring-1 focus:ring-sky-500"
                      >
                        {formData.attributes.map((a) => (
                          <option key={a.key} value={a.key}>
                            {a.name} ({a.abbr})
                          </option>
                        ))}
                      </select>
                    </div>

                    <button
                      type="button"
                      title="删除此技能"
                      onClick={() => handleRemoveSkill(skill.id)}
                      className="p-1 rounded-md text-slate-300 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer shrink-0"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  {/* 第二行：描述效果（全预览展开，占整行） */}
                  <input
                    type="text"
                    value={skill.description}
                    onChange={(e) => handleSkillChange(idx, 'description', e.target.value)}
                    placeholder="效果描述（如：野外追踪、识破痕迹、察觉异样...）"
                    className="w-full px-2.5 py-1 text-xs text-slate-600 border border-slate-100 rounded-lg bg-slate-50/50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-sky-500"
                  />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-slate-100 flex items-center justify-between bg-slate-50/70">
          <button
            type="button"
            onClick={handleDuplicate}
            className="px-4 py-2 rounded-xl bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-semibold flex items-center gap-1.5 cursor-pointer shadow-xs"
          >
            <Copy className="w-3.5 h-3.5" />
            复制并另存为新副本
          </button>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-slate-500 hover:bg-slate-200/50 text-xs font-medium cursor-pointer"
            >
              取消
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="px-5 py-2 rounded-xl bg-sky-500 hover:bg-sky-600 text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer shadow-sm shadow-sky-200 active:scale-95"
            >
              <Save className="w-3.5 h-3.5" />
              {formData.isBuiltin ? '另存为新自定义预设' : '保存预设修改'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
