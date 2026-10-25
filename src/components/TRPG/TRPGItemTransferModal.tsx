import React from 'react';
import {
  X,
  ArrowRightLeft,
  Shield,
  Swords,
  Package,
  Check,
  ArrowRight,
  ArrowLeft,
} from 'lucide-react';
import { TRPGSession, TRPGCompanion, TRPGItem } from '../../types/trpg';
import { transferItemBetweenPlayerAndCompanion } from '../../utils/trpgActionValidator';

interface TRPGItemTransferModalProps {
  isOpen: boolean;
  onClose: () => void;
  session: TRPGSession;
  companion: TRPGCompanion;
  onUpdateSession: (updated: TRPGSession) => void;
}

export const TRPGItemTransferModal: React.FC<TRPGItemTransferModalProps> = ({
  isOpen,
  onClose,
  session,
  companion,
  onUpdateSession,
}) => {
  if (!isOpen) return null;

  const player = session.character;
  const currentCompanion = (session.companions || []).find((c) => c.id === companion.id) || companion;

  const handleTransferToCompanion = (item: TRPGItem) => {
    const updated = transferItemBetweenPlayerAndCompanion({
      session,
      itemId: item.id,
      from: 'player',
      to: { companionId: companion.id },
    });
    onUpdateSession(updated);
  };

  const handleTransferToPlayer = (item: TRPGItem) => {
    const updated = transferItemBetweenPlayerAndCompanion({
      session,
      itemId: item.id,
      from: { companionId: companion.id },
      to: 'player',
    });
    onUpdateSession(updated);
  };

  const handleToggleCompanionEquip = (itemId: string) => {
    const nextCompanions = (session.companions || []).map((c) => {
      if (c.id !== companion.id) return c;
      const nextInv = c.character.inventory.map((i) =>
        i.id === itemId ? { ...i, equipped: !i.equipped } : i
      );
      return {
        ...c,
        character: {
          ...c.character,
          inventory: nextInv,
        },
      };
    });

    onUpdateSession({
      ...session,
      companions: nextCompanions,
      updatedAt: Date.now(),
    });
  };

  return (
    <div className="fixed inset-0 z-60 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
      <div className="bg-white w-full max-w-3xl rounded-3xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-sky-50/70 via-white to-indigo-50/70 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-xs">
              <ArrowRightLeft className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-800">小队装备与道具调配</h3>
              <p className="text-xs text-slate-400">
                在【{player.name}】与队友【{currentCompanion.name}】之间分配武器、护甲与物资
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Inventory Comparison Columns */}
        <div className="p-6 overflow-y-auto grid grid-cols-1 md:grid-cols-2 gap-4 flex-1">
          {/* Column 1: Player's Inventory */}
          <div className="p-4 rounded-2xl bg-sky-50/40 border border-sky-100 flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-sky-100 mb-3">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-sky-500"></span>
                <span className="text-xs font-bold text-slate-800">{player.name} 的背包</span>
              </div>
              <span className="text-[11px] text-slate-400">
                {player.inventory.length} 件物品
              </span>
            </div>

            <div className="space-y-2 overflow-y-auto flex-1 max-h-[50vh]">
              {player.inventory.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-400">背包空空如也</div>
              ) : (
                player.inventory.map((item) => (
                  <div
                    key={item.id}
                    className="p-2.5 rounded-xl bg-white border border-slate-200/80 shadow-xs flex items-center justify-between gap-2"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold text-slate-800 truncate">
                          {item.name}
                        </span>
                        {item.equipped && (
                          <span className="text-[10px] px-1.5 py-0.2 rounded-md bg-sky-100 text-sky-700 font-bold shrink-0">
                            已穿戴
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] text-slate-400 truncate">
                        {item.damageDice
                          ? `伤害骰: ${item.damageDice}`
                          : item.acBonus
                          ? `防御加值: +${item.acBonus}`
                          : item.description || '常规道具'}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleTransferToCompanion(item)}
                      className="px-2.5 py-1 rounded-lg bg-sky-50 hover:bg-sky-500 text-sky-700 hover:text-white border border-sky-200 text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer shrink-0"
                      title={`移交给 ${currentCompanion.name}`}
                    >
                      <span>分配</span>
                      <ArrowRight className="w-3 h-3" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Column 2: Companion's Inventory */}
          <div className="p-4 rounded-2xl bg-indigo-50/40 border border-indigo-100 flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-indigo-100 mb-3">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-indigo-500"></span>
                <span className="text-xs font-bold text-slate-800">
                  {currentCompanion.name} 的装备与行囊
                </span>
              </div>
              <span className="text-[11px] text-slate-400">
                {currentCompanion.character.inventory.length} 件物品
              </span>
            </div>

            <div className="space-y-2 overflow-y-auto flex-1 max-h-[50vh]">
              {currentCompanion.character.inventory.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-400">尚未分配任何装备</div>
              ) : (
                currentCompanion.character.inventory.map((item) => (
                  <div
                    key={item.id}
                    className="p-2.5 rounded-xl bg-white border border-slate-200/80 shadow-xs flex items-center justify-between gap-2"
                  >
                    <button
                      type="button"
                      onClick={() => handleTransferToPlayer(item)}
                      className="px-2 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer shrink-0"
                      title={`收回至 ${player.name} 背包`}
                    >
                      <ArrowLeft className="w-3 h-3" />
                      <span>收回</span>
                    </button>

                    <div className="min-w-0 flex-1 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {item.equipped && (
                          <span className="text-[10px] px-1.5 py-0.2 rounded-md bg-indigo-100 text-indigo-700 font-bold shrink-0">
                            已着装
                          </span>
                        )}
                        <span className="text-xs font-bold text-slate-800 truncate">
                          {item.name}
                        </span>
                      </div>
                      <div className="text-[10px] text-slate-400 truncate">
                        {item.damageDice
                          ? `伤害骰: ${item.damageDice}`
                          : item.acBonus
                          ? `防御加值: +${item.acBonus}`
                          : item.description || '常规道具'}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleToggleCompanionEquip(item.id)}
                      className={`px-2 py-1 rounded-lg text-xs font-semibold border transition-colors cursor-pointer shrink-0 ${
                        item.equipped
                          ? 'bg-indigo-600 text-white border-indigo-600'
                          : 'bg-white text-slate-600 border-slate-200 hover:border-indigo-300'
                      }`}
                      title="切换队友穿戴状态"
                    >
                      {item.equipped ? '卸下' : '穿戴'}
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-100 bg-slate-50 flex items-center justify-between text-xs text-slate-400">
          <span>提示：装备在队友身上的护甲与武器将在其协助检定与战斗时直接发挥效力</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-900 text-white font-semibold cursor-pointer"
          >
            完成调配
          </button>
        </div>
      </div>
    </div>
  );
};
