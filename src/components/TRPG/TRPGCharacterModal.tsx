import React, { useState } from 'react';
import {
  X,
  Save,
  Shield,
  Heart,
  Plus,
  Trash2,
  Sword,
  Sparkles,
  Package,
  Check,
} from 'lucide-react';
import { TRPGCharacter, TRPGRuleset, TRPGItem } from '../../types/trpg';
import { calculateAttributeModifier } from '../../utils/diceEngine';

interface TRPGCharacterModalProps {
  isOpen: boolean;
  character: TRPGCharacter;
  ruleset: TRPGRuleset;
  onClose: () => void;
  onSave: (saved: TRPGCharacter) => void;
}

export const TRPGCharacterModal: React.FC<TRPGCharacterModalProps> = ({
  isOpen,
  character,
  ruleset,
  onClose,
  onSave,
}) => {
  const [formData, setFormData] = useState<TRPGCharacter>(() =>
    JSON.parse(JSON.stringify(character))
  );

  const [activeTab, setActiveTab] = useState<'attributes' | 'skills' | 'inventory'>('attributes');

  if (!isOpen) return null;

  const handleAttrChange = (key: string, val: number) => {
    setFormData({
      ...formData,
      attributes: {
        ...formData.attributes,
        [key]: Math.max(1, Math.min(30, val)),
      },
    });
  };

  const handleToggleProficiency = (skillId: string) => {
    const list = formData.proficientSkills || [];
    const next = list.includes(skillId)
      ? list.filter((id) => id !== skillId)
      : [...list, skillId];
    setFormData({ ...formData, proficientSkills: next });
  };

  const handleAddItem = () => {
    const newItem: TRPGItem = {
      id: `item-${Date.now()}`,
      name: '新探险道具',
      type: 'misc',
      quantity: 1,
      equipped: false,
      description: '物品描述',
    };
    setFormData({ ...formData, inventory: [...(formData.inventory || []), newItem] });
  };

  const handleItemChange = (index: number, field: keyof TRPGItem, val: any) => {
    const nextInv = [...(formData.inventory || [])];
    nextInv[index] = { ...nextInv[index], [field]: val };
    setFormData({ ...formData, inventory: nextInv });
  };

  const handleRemoveItem = (id: string) => {
    setFormData({
      ...formData,
      inventory: (formData.inventory || []).filter((i) => i.id !== id),
    });
  };

  const handleSave = () => {
    onSave({ ...formData, updatedAt: Date.now() });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl shadow-2xl border border-sky-100 w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-sky-50/70 to-indigo-50/50">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-sky-500 text-white flex items-center justify-center font-bold text-sm shadow-xs">
              {formData.name.slice(0, 1)}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-slate-800">{formData.name}</h3>
                <span className="px-2 py-0.2 rounded-full bg-sky-100 text-sky-800 text-[10px] font-semibold">
                  {formData.characterClass || '冒险者'} · Lv.{formData.level}
                </span>
              </div>
              <p className="text-[11px] text-slate-500">跑团专属拓展卡 · 属性与行囊数据配置</p>
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

        {/* Tab switch */}
        <div className="flex border-b border-slate-100 bg-slate-50/70 p-1 gap-1">
          <button
            onClick={() => setActiveTab('attributes')}
            className={`flex-1 py-1.5 text-xs font-semibold rounded-xl transition-all cursor-pointer ${
              activeTab === 'attributes'
                ? 'bg-white text-sky-700 shadow-xs'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            六维基础属性 & 生命槽
          </button>
          <button
            onClick={() => setActiveTab('skills')}
            className={`flex-1 py-1.5 text-xs font-semibold rounded-xl transition-all cursor-pointer ${
              activeTab === 'skills'
                ? 'bg-white text-sky-700 shadow-xs'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            技能熟练专精 ({formData.proficientSkills.length})
          </button>
          <button
            onClick={() => setActiveTab('inventory')}
            className={`flex-1 py-1.5 text-xs font-semibold rounded-xl transition-all cursor-pointer ${
              activeTab === 'inventory'
                ? 'bg-white text-sky-700 shadow-xs'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            随身装备与背包 ({(formData.inventory || []).length})
          </button>
        </div>

        {/* Body Content */}
        <div className="p-6 overflow-y-auto space-y-4">
          {activeTab === 'attributes' && (
            <div className="space-y-4">
              {/* Basic Meta */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <div>
                  <label className="text-[11px] text-slate-500 font-medium">角色姓名</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-2.5 py-1.5 text-xs font-bold border border-slate-200 rounded-xl"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-slate-500 font-medium">跑团职业 / 身份</label>
                  <input
                    type="text"
                    value={formData.characterClass}
                    onChange={(e) => setFormData({ ...formData, characterClass: e.target.value })}
                    className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-xl"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-slate-500 font-medium">当前生命值 (HP)</label>
                  <input
                    type="number"
                    value={formData.currentHp}
                    onChange={(e) =>
                      setFormData({ ...formData, currentHp: parseInt(e.target.value, 10) || 1 })
                    }
                    className="w-full px-2.5 py-1.5 text-xs font-mono font-bold text-rose-600 border border-slate-200 rounded-xl"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-slate-500 font-medium">最大生命上限</label>
                  <input
                    type="number"
                    value={formData.maxHp}
                    onChange={(e) =>
                      setFormData({ ...formData, maxHp: parseInt(e.target.value, 10) || 1 })
                    }
                    className="w-full px-2.5 py-1.5 text-xs font-mono font-bold border border-slate-200 rounded-xl"
                  />
                </div>
              </div>

              {/* 6 Attributes */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-2">
                  核心六维能力点数
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                  {ruleset.attributes.map((attr) => {
                    const val = formData.attributes[attr.key] ?? 10;
                    const mod = calculateAttributeModifier(val, ruleset.modifierRule);
                    const sign = mod >= 0 ? `+${mod}` : `${mod}`;

                    return (
                      <div
                        key={attr.key}
                        className="p-3 rounded-2xl border border-slate-100 bg-slate-50/60 flex flex-col justify-between"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-slate-700">
                            {attr.name} ({attr.abbr})
                          </span>
                          <span className="text-xs font-mono font-bold px-1.5 py-0.2 rounded bg-sky-100 text-sky-800">
                            {sign}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 mt-2">
                          <input
                            type="number"
                            min={1}
                            max={30}
                            value={val}
                            onChange={(e) =>
                              handleAttrChange(attr.key, parseInt(e.target.value, 10) || 10)
                            }
                            className="w-full px-2.5 py-1 text-sm font-mono font-bold border border-slate-200 rounded-xl bg-white text-center"
                          />
                        </div>
                        <span className="text-[10px] text-slate-400 mt-1 line-clamp-1">
                          {attr.description}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'skills' && (
            <div className="space-y-3">
              <p className="text-xs text-slate-500">
                点击勾选角色已掌握的专精技能，检定时将额外获得职业熟练加值（当前 Lv.{formData.level} 为 +2）。
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-72 overflow-y-auto p-1">
                {ruleset.skills.map((skill) => {
                  const isProf = (formData.proficientSkills || []).includes(skill.id);
                  const attrDef = ruleset.attributes.find((a) => a.key === skill.attributeKey);

                  return (
                    <div
                      key={skill.id}
                      onClick={() => handleToggleProficiency(skill.id)}
                      className={`p-2.5 rounded-xl border flex items-center justify-between cursor-pointer transition-all ${
                        isProf
                          ? 'bg-sky-50/80 border-sky-300 shadow-xs'
                          : 'bg-white border-slate-100 hover:border-slate-200'
                      }`}
                    >
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-bold text-slate-800">{skill.name}</span>
                          <span className="text-[10px] text-slate-400">({attrDef?.abbr || skill.attributeKey.toUpperCase()})</span>
                        </div>
                        <p className="text-[10px] text-slate-500 line-clamp-1 mt-0.5">
                          {skill.description}
                        </p>
                      </div>

                      <div
                        className={`w-5 h-5 rounded-lg flex items-center justify-center border transition-colors ${
                          isProf
                            ? 'bg-sky-500 border-sky-500 text-white'
                            : 'border-slate-200 bg-white'
                        }`}
                      >
                        {isProf && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {activeTab === 'inventory' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-700">道具、武器与护甲清单</span>
                <button
                  type="button"
                  onClick={handleAddItem}
                  className="px-2.5 py-1 text-xs font-semibold text-sky-600 bg-sky-50 hover:bg-sky-100 rounded-lg flex items-center gap-1 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  新增随身物品
                </button>
              </div>

              <div className="space-y-2 max-h-72 overflow-y-auto p-1">
                {(formData.inventory || []).map((item, idx) => (
                  <div
                    key={item.id}
                    className="p-3 rounded-2xl border border-slate-100 bg-white shadow-xs space-y-2 text-xs"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <input
                        type="text"
                        value={item.name}
                        onChange={(e) => handleItemChange(idx, 'name', e.target.value)}
                        className="font-bold text-slate-800 px-2 py-1 border border-slate-200 rounded-lg flex-1"
                      />
                      <select
                        value={item.type}
                        onChange={(e) => handleItemChange(idx, 'type', e.target.value)}
                        className="px-2 py-1 border border-slate-200 rounded-lg bg-slate-50 text-slate-700"
                      >
                        <option value="weapon">武器</option>
                        <option value="armor">护甲/盾牌</option>
                        <option value="consumable">消耗品/药水</option>
                        <option value="misc">杂物</option>
                      </select>
                      <button
                        type="button"
                        onClick={() => handleRemoveItem(item.id)}
                        className="p-1 text-slate-300 hover:text-rose-500"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div className="grid grid-cols-3 gap-2">
                      {item.type === 'weapon' && (
                        <div>
                          <span className="text-[10px] text-slate-400">伤害骰 (如 1d8+STR)</span>
                          <input
                            type="text"
                            value={item.damageDice || '1d8+STR'}
                            onChange={(e) => handleItemChange(idx, 'damageDice', e.target.value)}
                            className="w-full px-2 py-0.5 text-xs font-mono border border-slate-200 rounded-md"
                          />
                        </div>
                      )}
                      {item.type === 'armor' && (
                        <div>
                          <span className="text-[10px] text-slate-400">防御加值 (如 2)</span>
                          <input
                            type="number"
                            value={item.acBonus || 0}
                            onChange={(e) =>
                              handleItemChange(idx, 'acBonus', parseInt(e.target.value, 10) || 0)
                            }
                            className="w-full px-2 py-0.5 text-xs font-mono border border-slate-200 rounded-md"
                          />
                        </div>
                      )}
                      {item.type === 'consumable' && (
                        <div>
                          <span className="text-[10px] text-slate-400">治疗公式 (如 2d4+2)</span>
                          <input
                            type="text"
                            value={item.healValue || '2d4+2'}
                            onChange={(e) => handleItemChange(idx, 'healValue', e.target.value)}
                            className="w-full px-2 py-0.5 text-xs font-mono border border-slate-200 rounded-md"
                          />
                        </div>
                      )}
                      <div>
                        <span className="text-[10px] text-slate-400">数量</span>
                        <input
                          type="number"
                          value={item.quantity}
                          onChange={(e) =>
                            handleItemChange(idx, 'quantity', parseInt(e.target.value, 10) || 1)
                          }
                          className="w-full px-2 py-0.5 text-xs font-mono border border-slate-200 rounded-md"
                        />
                      </div>
                      <div className="flex items-center gap-1.5 pt-3">
                        <input
                          type="checkbox"
                          id={`equip-${item.id}`}
                          checked={item.equipped}
                          onChange={(e) => handleItemChange(idx, 'equipped', e.target.checked)}
                          className="rounded text-sky-500"
                        />
                        <label htmlFor={`equip-${item.id}`} className="text-xs text-slate-600 font-medium">
                          当前已佩戴
                        </label>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-slate-100 flex items-center justify-end gap-2 bg-slate-50/70">
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
            保存跑团角色设定
          </button>
        </div>
      </div>
    </div>
  );
};
