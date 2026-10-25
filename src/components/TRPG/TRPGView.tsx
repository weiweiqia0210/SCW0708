import React, { useState, useRef, useEffect } from 'react';
import {
  ArrowLeft,
  Dices,
  Swords,
  Shield,
  Heart,
  Send,
  Square,
  Sparkles,
  User,
  Settings2,
  RefreshCw,
  AlertTriangle,
  RotateCcw,
  CheckCircle2,
  HelpCircle,
  ScrollText,
  Users,
  BookMarked,
  Compass,
  MapPin,
  FolderArchive,
  Save,
  Copy,
  Edit3,
  Trash2,
  Check,
  Laptop,
  X,
} from 'lucide-react';
import {
  TRPGSession,
  TRPGRollResult,
  TRPGCheckResult,
  CombatActionLog,
  TRPGLocationNode,
  TRPGSaveSlot,
  TRPGStoryLogEntry,
} from '../../types/trpg';
import { WorldBook, SystemPreset, AppSettings, CharacterCard } from '../../types';
import { streamChat } from '../../utils/aiService';
import { saveSingleTRPGSession, createTRPGSaveSlot } from '../../utils/trpgStorage';
import { buildTRPGSystemInstruction } from '../../utils/trpgPromptEngine';
import { calculatePlayerAC } from '../../utils/trpgCombatEngine';
import { calculateAttributeModifier } from '../../utils/diceEngine';
import { parseAndValidateAIActions } from '../../utils/trpgActionValidator';
import { TRPGDiceModal } from './TRPGDiceModal';
import { TRPGCombatPanel } from './TRPGCombatPanel';
import { TRPGCharacterModal } from './TRPGCharacterModal';
import { TRPGRulesetModal } from './TRPGRulesetModal';
import { TRPGQuestModal } from './TRPGQuestModal';
import { TRPGPartyModal } from './TRPGPartyModal';
import { TRPGStoryLogModal } from './TRPGStoryLogModal';
import { TRPGMapModal } from './TRPGMapModal';
import { TRPGSaveLoadModal } from './TRPGSaveLoadModal';

interface TRPGViewProps {
  session: TRPGSession;
  worldbooks: WorldBook[];
  presets: SystemPreset[];
  settings: AppSettings;
  characterCards?: CharacterCard[];
  onExit: () => void;
  onUpdateSession: (updated: TRPGSession) => void;
}

export const TRPGView: React.FC<TRPGViewProps> = ({
  session,
  worldbooks,
  presets,
  settings,
  characterCards = [],
  onExit,
  onUpdateSession,
}) => {
  // Input & message states
  const [inputText, setInputText] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Modals & Panels
  const [isDiceModalOpen, setIsDiceModalOpen] = useState(false);
  const [isCharModalOpen, setIsCharModalOpen] = useState(false);
  const [isRulesetModalOpen, setIsRulesetModalOpen] = useState(false);
  const [isQuestModalOpen, setIsQuestModalOpen] = useState(false);
  const [isPartyModalOpen, setIsPartyModalOpen] = useState(false);
  const [isStoryLogModalOpen, setIsStoryLogModalOpen] = useState(false);
  const [isMapModalOpen, setIsMapModalOpen] = useState(false);
  const [isSaveLoadModalOpen, setIsSaveLoadModalOpen] = useState(false);
  const [isCombatPanelOpen, setIsCombatPanelOpen] = useState(
    session.combatState.inCombat
  );
  // Unified Adventure Device Modal
  const [isDeviceModalOpen, setIsDeviceModalOpen] = useState(false);

  // Message Action States (Copy, Edit, Delete, Re-roll)
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editingContent, setEditingContent] = useState('');
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  // Centralized session persistence with automatic save-slot syncing
  const persistAndAutoSave = (updated: TRPGSession) => {
    onUpdateSession(updated);
    saveSingleTRPGSession(updated);
    createTRPGSaveSlot(updated, undefined, true);
  };

  // Auto scroll to bottom on new message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [session.messages, streamingContent, isCombatPanelOpen]);

  // Keep combat panel open automatically if in combat
  useEffect(() => {
    if (session.combatState.inCombat) {
      setIsCombatPanelOpen(true);
    }
  }, [session.combatState.inCombat]);

  // Auto trigger opening narration if brand new session with no messages yet
  useEffect(() => {
    if (session.messages.length === 0 && !isGenerating) {
      triggerAINarration(session);
    }
  }, [session.id]);

  const activeWorldbooks = worldbooks.filter((wb) =>
    (session.worldBookIds || []).includes(wb.id)
  );
  const activePreset = presets.find((p) => p.id === session.presetId);

  // Toggle dice mode between auto and manual
  const handleToggleDiceMode = () => {
    const nextMode = session.diceMode === 'auto' ? 'manual' : 'auto';
    const nextSession: TRPGSession = {
      ...session,
      diceMode: nextMode,
      updatedAt: Date.now(),
    };
    persistAndAutoSave(nextSession);
  };

  // Copy message text
  const handleCopyMessage = async (msgId: string, content: string) => {
    try {
      await navigator.clipboard.writeText(content);
      setCopiedMessageId(msgId);
      setTimeout(() => setCopiedMessageId(null), 1500);
    } catch {
      // fallback
    }
  };

  // Start inline editing
  const handleStartEditMessage = (msgId: string, currentContent: string) => {
    setEditingMessageId(msgId);
    setEditingContent(currentContent);
  };

  // Save inline edit
  const handleSaveEditMessage = (msgId: string) => {
    const nextMessages = session.messages.map((m) =>
      m.id === msgId ? { ...m, content: editingContent } : m
    );
    const nextSession = { ...session, messages: nextMessages, updatedAt: Date.now() };
    persistAndAutoSave(nextSession);
    setEditingMessageId(null);
  };

  // Delete message
  const handleDeleteMessage = (msgId: string) => {
    const nextMessages = session.messages.filter((m) => m.id !== msgId);
    const nextSession = {
      ...session,
      messages: nextMessages,
      updatedAt: Date.now(),
    };
    persistAndAutoSave(nextSession);
  };

  // Re-roll message
  const handleRerollMessage = (msgId: string) => {
    const msgIndex = session.messages.findIndex((m) => m.id === msgId);
    if (msgIndex === -1) return;
    const targetMsg = session.messages[msgIndex];

    if (targetMsg.role === 'assistant') {
      const truncatedMessages = session.messages.slice(0, msgIndex);
      const nextSession = {
        ...session,
        messages: truncatedMessages,
        updatedAt: Date.now(),
      };
      persistAndAutoSave(nextSession);
      triggerAINarration(nextSession);
    } else {
      const truncatedMessages = session.messages.slice(0, msgIndex + 1);
      const nextSession = {
        ...session,
        messages: truncatedMessages,
        updatedAt: Date.now(),
      };
      persistAndAutoSave(nextSession);
      triggerAINarration(nextSession);
    }
  };

  /**
   * Request AI DM narration
   */
  const triggerAINarration = async (
    currentSession: TRPGSession,
    userPromptText?: string
  ) => {
    if (isGenerating) return;

    setIsGenerating(true);
    setStreamingContent('');
    setErrorMessage(null);

    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    const systemInstruction = buildTRPGSystemInstruction({
      session: currentSession,
      worldbooks: activeWorldbooks,
      preset: activePreset,
    });

    // Prepare message history
    let apiMessages = currentSession.messages.slice(-16).map((m) => {
      let text = m.content;
      if (m.checkResult) {
        text = `【系统检定数据（既定事实）】：${m.checkResult.summaryText}\n${text}`;
      }
      if (m.combatEvent) {
        text = `【系统交锋战报（既定事实）】：${m.combatEvent.detail}\n${text}`;
      }
      return {
        role: m.role === 'assistant' ? ('model' as const) : ('user' as const),
        content: text,
      };
    });

    // If brand-new opening turn with no messages, prompt DM to compose authentic opening scene
    if (apiMessages.length === 0) {
      apiMessages = [
        {
          role: 'user',
          content:
            userPromptText ||
            `【战役启动指示】：跑团冒险由此开启！请作为地下城主（DM），结合设定的开局大纲、主角身份【${currentSession.character.name}（${currentSession.character.characterClass || '探险者'}）】与世界观，亲自进行富有文学张力与画面感的开篇第一幕场景创作，生动刻画环境、感官细节与突发状况，并在最后向玩家抛出第一步行动询问。`,
        },
      ];
    }

    let accumulatedText = '';

    try {
      await streamChat({
        provider: settings.provider,
        model: settings.model,
        customApiKey: settings.customApiKey,
        customEndpoint: settings.customEndpoint,
        temperature: 0.8,
        systemInstruction,
        messages: apiMessages,
        signal: abortController.signal,
        onChunk: (chunk) => {
          accumulatedText += chunk;
          setStreamingContent(accumulatedText);
        },
        onDone: () => {
          const trimmed = accumulatedText.trim();
          if (trimmed) {
            // Validate, clamp, and parse structured relationship/quest/party/log events
            const { cleanText, updatedSession: afterEvents } = parseAndValidateAIActions(
              trimmed,
              currentSession
            );

            const newAssistantMsg = {
              id: `msg-${Date.now()}`,
              role: 'assistant' as const,
              content: cleanText,
              timestamp: Date.now(),
            };
            const updated = {
              ...afterEvents,
              messages: [...afterEvents.messages, newAssistantMsg],
              updatedAt: Date.now(),
            };
            persistAndAutoSave(updated);
          }
          setIsGenerating(false);
          setStreamingContent('');
          abortControllerRef.current = null;
        },
      });
    } catch (err: any) {
      if (err?.name === 'AbortError') {
        // User aborted manually
        if (accumulatedText.trim()) {
          const { cleanText, updatedSession: afterEvents } = parseAndValidateAIActions(
            accumulatedText.trim(),
            currentSession
          );
          const newAssistantMsg = {
            id: `msg-${Date.now()}`,
            role: 'assistant' as const,
            content: cleanText,
            timestamp: Date.now(),
          };
          const updated = {
            ...afterEvents,
            messages: [...afterEvents.messages, newAssistantMsg],
            updatedAt: Date.now(),
          };
          persistAndAutoSave(updated);
        }
      } else {
        setErrorMessage(err?.message || 'DM 叙事请求失败，请检查网络或设置');
      }
      setIsGenerating(false);
      setStreamingContent('');
      abortControllerRef.current = null;
    }
  };

  const handleStopGenerating = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  };

  /**
   * User submits an action or dialogue
   */
  const handleSendMessage = () => {
    const text = inputText.trim();
    if (!text || isGenerating) return;

    const userMsg = {
      id: `msg-${Date.now()}`,
      role: 'user' as const,
      content: text,
      timestamp: Date.now(),
    };

    const nextSession: TRPGSession = {
      ...session,
      messages: [...session.messages, userMsg],
      updatedAt: Date.now(),
    };

    persistAndAutoSave(nextSession);
    setInputText('');

    // Trigger AI DM response
    triggerAINarration(nextSession);
  };

  /**
   * Confirms a roll or check result from the TRPGDiceModal
   */
  const handleConfirmDiceRoll = (
    rollResult: TRPGRollResult,
    checkResult?: TRPGCheckResult
  ) => {
    const content = checkResult
      ? checkResult.summaryText
      : `【骰子投掷】${rollResult.expression} ➔ 结果: ${rollResult.total} [${rollResult.rolls.join(', ')}]${
          rollResult.isCriticalSuccess ? ' (🌟 大成功!)' : rollResult.isCriticalFailure ? ' (💀 大失败!)' : ''
        }`;

    const systemMsg = {
      id: `msg-${Date.now()}`,
      role: 'system' as const,
      content,
      rollResult,
      checkResult,
      timestamp: Date.now(),
    };

    const nextSession: TRPGSession = {
      ...session,
      messages: [...session.messages, systemMsg],
      updatedAt: Date.now(),
    };

    persistAndAutoSave(nextSession);

    // Prompt DM to interpret the check consequence!
    triggerAINarration(nextSession);
  };

  /**
   * Updates from Combat Panel (attack, heal, flee, etc.)
   */
  const handleCombatUpdate = (updated: TRPGSession, actionLog?: CombatActionLog) => {
    let nextMessages = updated.messages;

    if (actionLog) {
      const combatMsg = {
        id: `msg-${Date.now()}`,
        role: 'system' as const,
        content: `【交锋战报 R${actionLog.round}】${actionLog.detail}`,
        combatEvent: actionLog,
        timestamp: Date.now(),
      };
      nextMessages = [...nextMessages, combatMsg];
    }

    const nextSession: TRPGSession = {
      ...updated,
      messages: nextMessages,
      updatedAt: Date.now(),
    };

    persistAndAutoSave(nextSession);

    // Let DM narrate the combat round
    triggerAINarration(nextSession);
  };

  /**
   * Move the party to a new connected location on the map
   */
  const handleMoveLocation = (targetNode: TRPGLocationNode) => {
    const currentLoc =
      session.mapState?.locations?.find((l) => l.id === session.mapState.currentLocationId) ||
      session.mapState?.locations?.[0];

    const prevName = currentLoc?.name || '驻地';

    const nextLocations = (session.mapState?.locations || []).map((l) => {
      if (l.id === currentLoc?.id) {
        return { ...l, status: 'explored' as const };
      }
      if (l.id === targetNode.id) {
        return {
          ...l,
          status: 'current' as const,
          lastVisitedAt: Date.now(),
        };
      }
      return l;
    });

    const nextMapState = {
      currentLocationId: targetNode.id,
      locations: nextLocations,
    };

    const travelLog: TRPGStoryLogEntry = {
      id: `log-travel-${Date.now()}`,
      category: 'story',
      title: `行进抵达：${targetNode.name}`,
      detail: `队伍整理行装，从【${prevName}】启程，跋山涉水顺利抵达【${targetNode.name}】。`,
      timestamp: Date.now(),
    };

    const systemArrivalMsg = {
      id: `msg-${Date.now()}`,
      role: 'system' as const,
      content: `📍 队伍已启程行进并抵达【${targetNode.name}】（${targetNode.category} · 危险评级: ${
        targetNode.dangerLevel === 'safe' ? '安全区域' : targetNode.dangerLevel
      }）。`,
      timestamp: Date.now(),
    };

    const nextSession: TRPGSession = {
      ...session,
      mapState: nextMapState,
      storyLogs: [...(session.storyLogs || []), travelLog],
      messages: [...session.messages, systemArrivalMsg],
      updatedAt: Date.now(),
    };

    persistAndAutoSave(nextSession);
    setIsMapModalOpen(false);

    // Automatically ask DM to narrate the arrival at the new setting
    triggerAINarration(
      nextSession,
      `[地点转移] 我们全队已抵达【${targetNode.name}】。请为我们详细描摹当下眼前的风土景象、周围动静与环境细节，为接下来的冒险揭开序幕。`
    );
  };

  /**
   * Full state restoration from a save slot
   */
  const handleRestoreSave = (slot: TRPGSaveSlot) => {
    const restored = slot.sessionSnapshot;
    onUpdateSession(restored);
    saveSingleTRPGSession(restored);
    setIsCombatPanelOpen(restored.combatState.inCombat);
  };

  const char = session.character;
  const playerAC = calculatePlayerAC(char, session.rulesetSnapshot.modifierRule);
  const activeQuestsCount = (session.quests || []).filter((q) => q.status === 'active').length;
  const activeCompanionsCount = (session.companions || []).filter((c) => c.status === 'active').length;
  const logsCount = (session.storyLogs || []).length;

  const currentLocation =
    session.mapState?.locations?.find((l) => l.id === session.mapState?.currentLocationId) ||
    session.mapState?.locations?.[0];
  const currentLocationName = currentLocation?.name || '未知驻地';

  return (
    <div className="flex flex-col h-screen max-w-3xl mx-auto bg-slate-50/70 border-x border-slate-200/80">
      {/* Top Header Bar */}
      <header className="px-3 sm:px-4 py-2.5 bg-white/95 backdrop-blur-md border-b border-slate-200/80 flex items-center justify-between sticky top-0 z-30 shadow-xs gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <button
            type="button"
            onClick={onExit}
            className="p-1.5 rounded-xl hover:bg-slate-100 text-slate-500 hover:text-slate-800 transition-colors cursor-pointer shrink-0"
            title="退出跑团"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <h1 className="text-xs font-bold text-slate-800 truncate">{session.title}</h1>
              <button
                type="button"
                onClick={handleToggleDiceMode}
                className={`text-[9px] sm:text-[10px] px-1.5 sm:px-2 py-0.5 rounded-full font-bold transition-all cursor-pointer shrink-0 ${
                  session.diceMode === 'manual'
                    ? 'bg-amber-100 text-amber-800 border border-amber-300'
                    : 'bg-sky-100 text-sky-800 border border-sky-300'
                }`}
                title="点击快速切换「AI 自动骰」或「玩家手动掷骰」"
              >
                {session.diceMode === 'manual' ? '手动掷骰' : '自动骰'}
              </button>
            </div>
            <div className="flex items-center gap-1.5 text-[10px] text-slate-400 mt-0.5 truncate">
              <span>{char.name}</span>
              <span>·</span>
              <span className="font-mono text-rose-600 font-bold">HP {char.currentHp}/{char.maxHp}</span>
              <span>·</span>
              <span className="font-mono text-sky-600 font-semibold">AC {playerAC}</span>
            </div>
          </div>
        </div>

        {/* Action: Unified into a single sleek Device */}
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={() => setIsDeviceModalOpen(true)}
            className="px-2.5 py-1.5 rounded-xl bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 hover:from-slate-800 hover:to-indigo-900 text-white text-xs font-bold flex items-center gap-1.5 shadow-xs transition-all cursor-pointer active:scale-95 border border-slate-700/60"
            title="便携终端设备：整合地图、任务、小队、纪事、存档、检定与战斗等"
          >
            <Laptop className="w-3.5 h-3.5 text-sky-400" />
            <span>便携终端</span>
            {(activeQuestsCount > 0 || logsCount > 0 || session.combatState.inCombat) && (
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            )}
          </button>
        </div>
      </header>

      {/* Main Narrative Area */}
      <main className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {/* Semi-visual Combat Panel (Collapsible/Pinned) */}
        {isCombatPanelOpen && (
          <div className="mb-3 animate-in slide-in-from-top-2 duration-200">
            <TRPGCombatPanel
              session={session}
              onUpdateSession={handleCombatUpdate}
              onCloseCombat={() => setIsCombatPanelOpen(false)}
            />
          </div>
        )}

        {/* Messages Feed */}
        {session.messages.map((msg) => {
          if (msg.role === 'system') {
            return (
              <div
                key={msg.id}
                className="my-2 p-3 rounded-2xl bg-gradient-to-r from-sky-50/80 via-white to-indigo-50/80 border border-sky-200/90 shadow-xs space-y-1 text-xs"
              >
                <div className="flex items-center gap-1.5 font-bold text-sky-800">
                  <CheckCircle2 className="w-3.5 h-3.5 text-sky-600 shrink-0" />
                  <span>系统程序判定 (不可推翻之客观事实)</span>
                </div>
                <div className="font-mono text-slate-700 font-medium pl-5 leading-relaxed">
                  {msg.content}
                </div>
              </div>
            );
          }

          if (msg.role === 'user') {
            return (
              <div key={msg.id} className="flex flex-col items-end group">
                {editingMessageId === msg.id ? (
                  <div className="w-full max-w-[85%] sm:max-w-[75%] p-3 rounded-2xl bg-white border border-sky-300 shadow-xs space-y-2">
                    <textarea
                      rows={3}
                      value={editingContent}
                      onChange={(e) => setEditingContent(e.target.value)}
                      className="w-full p-2 text-xs text-slate-800 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-400 font-sans leading-relaxed resize-y"
                    />
                    <div className="flex justify-end gap-1.5">
                      <button
                        type="button"
                        onClick={() => setEditingMessageId(null)}
                        className="px-2.5 py-1 text-xs text-slate-500 hover:bg-slate-100 rounded-lg cursor-pointer"
                      >
                        取消
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSaveEditMessage(msg.id)}
                        className="px-3 py-1 text-xs font-bold text-white bg-sky-500 hover:bg-sky-600 rounded-lg shadow-2xs cursor-pointer"
                      >
                        保存
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="max-w-[85%] sm:max-w-[75%] rounded-2xl px-4 py-2.5 bg-sky-500 text-white shadow-xs space-y-1">
                    <div className="text-[10px] text-sky-100 font-semibold flex items-center justify-between">
                      <span>{char.name}</span>
                    </div>
                    <div className="text-xs sm:text-sm whitespace-pre-wrap leading-relaxed">
                      {msg.content}
                    </div>
                  </div>
                )}

                {/* Concise Action Icon Bar below user bubble */}
                <div className="flex items-center gap-1 mt-1 text-slate-400">
                  <button
                    type="button"
                    onClick={() => handleCopyMessage(msg.id, msg.content)}
                    className="p-1 rounded-md hover:text-slate-700 hover:bg-slate-200/50 transition-colors cursor-pointer flex items-center gap-1"
                    title="复制内容"
                  >
                    {copiedMessageId === msg.id ? (
                      <>
                        <Check className="w-3 h-3 text-emerald-600" />
                        <span className="text-[9px] text-emerald-600 font-bold">已复制</span>
                      </>
                    ) : (
                      <Copy className="w-3 h-3" />
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleStartEditMessage(msg.id, msg.content)}
                    className="p-1 rounded-md hover:text-sky-600 hover:bg-sky-50 transition-colors cursor-pointer"
                    title="编辑文本"
                  >
                    <Edit3 className="w-3 h-3" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleRerollMessage(msg.id)}
                    className="p-1 rounded-md hover:text-amber-600 hover:bg-amber-50 transition-colors cursor-pointer"
                    title="从该行动重新推演"
                  >
                    <RefreshCw className="w-3 h-3" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteMessage(msg.id)}
                    className="p-1 rounded-md hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                    title="删除此条消息"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              </div>
            );
          }

          // Assistant (DM Narration) - CSS selector 1
          return (
            <div key={msg.id} className="flex gap-3 group">
              <div className="w-7 h-7 rounded-xl bg-slate-800 text-amber-300 flex items-center justify-center font-serif text-xs font-bold shrink-0 shadow-xs mt-0.5">
                DM
              </div>
              <div className="flex-1 bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs space-y-2">
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between">
                  <span>地下城主 / KP 叙事</span>
                </div>

                {editingMessageId === msg.id ? (
                  <div className="space-y-2">
                    <textarea
                      rows={5}
                      value={editingContent}
                      onChange={(e) => setEditingContent(e.target.value)}
                      className="w-full p-2.5 text-xs text-slate-800 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-400 font-sans leading-relaxed resize-y"
                    />
                    <div className="flex justify-end gap-1.5">
                      <button
                        type="button"
                        onClick={() => setEditingMessageId(null)}
                        className="px-2.5 py-1 text-xs text-slate-500 hover:bg-slate-100 rounded-lg cursor-pointer"
                      >
                        取消
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSaveEditMessage(msg.id)}
                        className="px-3 py-1 text-xs font-bold text-white bg-sky-500 hover:bg-sky-600 rounded-lg shadow-2xs cursor-pointer"
                      >
                        保存
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="text-xs sm:text-sm text-slate-800 leading-relaxed font-sans whitespace-pre-wrap">
                    {msg.content}
                  </div>
                )}

                {/* Concise action icons below DM bubble */}
                <div className="flex items-center gap-1 pt-1.5 border-t border-slate-100 text-slate-400">
                  <button
                    type="button"
                    onClick={() => handleCopyMessage(msg.id, msg.content)}
                    className="p-1 rounded-md hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer flex items-center gap-1"
                    title="复制此段叙事"
                  >
                    {copiedMessageId === msg.id ? (
                      <>
                        <Check className="w-3 h-3 text-emerald-600" />
                        <span className="text-[9px] text-emerald-600 font-bold">已复制</span>
                      </>
                    ) : (
                      <Copy className="w-3 h-3" />
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleStartEditMessage(msg.id, msg.content)}
                    className="p-1 rounded-md hover:text-sky-600 hover:bg-sky-50 transition-colors cursor-pointer"
                    title="编辑叙事文本"
                  >
                    <Edit3 className="w-3 h-3" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleRerollMessage(msg.id)}
                    className="p-1 rounded-md hover:text-amber-600 hover:bg-amber-50 transition-colors cursor-pointer"
                    title="重新生成此段叙事"
                  >
                    <RefreshCw className="w-3 h-3" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteMessage(msg.id)}
                    className="p-1 rounded-md hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                    title="删除此段消息"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}

        {/* Empty Session Placeholder */}
        {session.messages.length === 0 && !isGenerating && (
          <div className="p-8 text-center space-y-3 my-8 bg-white/60 rounded-3xl border border-slate-200/80 shadow-2xs">
            <div className="w-12 h-12 rounded-2xl bg-slate-900 text-amber-300 flex items-center justify-center mx-auto shadow-sm font-serif font-bold text-lg">
              DM
            </div>
            <div className="text-xs font-bold text-slate-800">正在为你构筑开局第一幕场景...</div>
            <p className="text-[11px] text-slate-400 max-w-sm mx-auto">
              AI 地下城主正在根据你书写的故事大纲与世界设定进行文学化开篇推演
            </p>
            <button
              type="button"
              onClick={() => triggerAINarration(session)}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-sky-500 to-indigo-600 hover:opacity-95 text-white text-xs font-bold shadow-xs cursor-pointer inline-flex items-center gap-1.5"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>立即开篇</span>
            </button>
          </div>
        )}

        {/* Live Streaming Content */}
        {isGenerating && streamingContent && (
          <div className="flex gap-3 animate-in fade-in duration-150">
            <div className="w-7 h-7 rounded-xl bg-slate-800 text-amber-300 flex items-center justify-center font-serif text-xs font-bold shrink-0 shadow-xs mt-0.5">
              DM
            </div>
            <div className="flex-1 bg-white rounded-2xl p-4 border border-sky-200 shadow-sm space-y-2">
              <div className="text-[10px] font-bold text-sky-600 flex items-center gap-1.5">
                <Sparkles className="w-3 h-3 animate-spin" />
                正在实时主持推演中...
              </div>
              <div className="text-xs sm:text-sm text-slate-800 leading-relaxed font-sans whitespace-pre-wrap">
                {streamingContent.replace(/\[EVENT_(RELATION|QUEST|PARTY|LOG):\s*\{[\s\S]*?\}\s*\]\n?/g, '').trim()}
                <span className="inline-block w-1.5 h-4 ml-1 bg-sky-500 animate-pulse align-middle" />
              </div>
            </div>
          </div>
        )}

        {/* Error notice */}
        {errorMessage && (
          <div className="p-3 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4 text-rose-600" />
              {errorMessage}
            </span>
            <button
              type="button"
              onClick={() => triggerAINarration(session)}
              className="px-2 py-1 rounded-lg bg-rose-200 hover:bg-rose-300 font-bold"
            >
              重试
            </button>
          </div>
        )}

        <div ref={messagesEndRef} />
      </main>

      {/* Quick Action Pills & Input Bar */}
      <footer className="p-3 bg-white/95 backdrop-blur-md border-t border-slate-200/80 space-y-2">
        {/* Action Shortcuts */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs no-scrollbar">
          <button
            type="button"
            onClick={() => setIsQuestModalOpen(true)}
            className="px-2.5 py-1.5 rounded-full bg-slate-100 hover:bg-amber-50 hover:text-amber-800 text-slate-700 font-medium shrink-0 flex items-center gap-1 transition-colors cursor-pointer"
          >
            <ScrollText className="w-3.5 h-3.5 text-amber-600" />
            <span>任务 ({activeQuestsCount})</span>
          </button>

          <button
            type="button"
            onClick={() => setIsPartyModalOpen(true)}
            className="px-2.5 py-1.5 rounded-full bg-slate-100 hover:bg-emerald-50 hover:text-emerald-800 text-slate-700 font-medium shrink-0 flex items-center gap-1 transition-colors cursor-pointer"
          >
            <Users className="w-3.5 h-3.5 text-emerald-600" />
            <span>小队 ({activeCompanionsCount})</span>
          </button>

          <button
            type="button"
            onClick={() => setIsStoryLogModalOpen(true)}
            className="px-2.5 py-1.5 rounded-full bg-slate-100 hover:bg-purple-50 hover:text-purple-800 text-slate-700 font-medium shrink-0 flex items-center gap-1 transition-colors cursor-pointer"
          >
            <BookMarked className="w-3.5 h-3.5 text-purple-600" />
            <span>纪事 ({logsCount})</span>
          </button>

          <button
            type="button"
            onClick={() => setIsDiceModalOpen(true)}
            className="px-2.5 py-1.5 rounded-full bg-slate-100 hover:bg-sky-50 hover:text-sky-700 text-slate-700 font-medium shrink-0 flex items-center gap-1 transition-colors cursor-pointer"
          >
            <Dices className="w-3.5 h-3.5 text-sky-600" />
            检定 / 掷骰
          </button>

          <button
            type="button"
            onClick={() => setIsCombatPanelOpen(!isCombatPanelOpen)}
            className="px-2.5 py-1.5 rounded-full bg-slate-100 hover:bg-rose-50 hover:text-rose-700 text-slate-700 font-medium shrink-0 flex items-center gap-1 transition-colors cursor-pointer"
          >
            <Swords className="w-3.5 h-3.5 text-rose-600" />
            {session.combatState.inCombat ? '战斗面板' : '交锋'}
          </button>

          <button
            type="button"
            onClick={() => setIsCharModalOpen(true)}
            className="px-2.5 py-1.5 rounded-full bg-slate-100 hover:bg-indigo-50 hover:text-indigo-700 text-slate-700 font-medium shrink-0 flex items-center gap-1 transition-colors cursor-pointer"
          >
            <Shield className="w-3.5 h-3.5 text-indigo-600" />
            行囊与数值
          </button>

          <button
            type="button"
            onClick={() => setIsMapModalOpen(true)}
            className="px-2.5 py-1.5 rounded-full bg-slate-100 hover:bg-amber-50 hover:text-amber-800 text-slate-700 font-medium shrink-0 flex items-center gap-1 transition-colors cursor-pointer"
          >
            <Compass className="w-3.5 h-3.5 text-amber-600" />
            <span>地图 ({currentLocationName})</span>
          </button>

          <button
            type="button"
            onClick={() => setIsSaveLoadModalOpen(true)}
            className="px-2.5 py-1.5 rounded-full bg-slate-100 hover:bg-indigo-50 hover:text-indigo-800 text-slate-700 font-medium shrink-0 flex items-center gap-1 transition-colors cursor-pointer"
          >
            <FolderArchive className="w-3.5 h-3.5 text-indigo-600" />
            <span>存档 / 读档</span>
          </button>
        </div>

        {/* Main Text Input */}
        <div className="flex items-end gap-2">
          <textarea
            rows={1}
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSendMessage();
              }
            }}
            placeholder="描述你的行动决策或台词（如：我握紧剑柄，警惕地靠近洞窟深处...）"
            disabled={isGenerating}
            className="flex-1 max-h-28 px-3.5 py-2.5 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-sky-400 resize-none font-medium text-slate-800 disabled:opacity-60"
          />

          {isGenerating ? (
            <button
              type="button"
              onClick={handleStopGenerating}
              className="p-2.5 rounded-2xl bg-rose-500 hover:bg-rose-600 text-white shadow-xs cursor-pointer active:scale-95 transition-all"
              title="中断推演"
            >
              <Square className="w-4 h-4 fill-current" />
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSendMessage}
              disabled={!inputText.trim()}
              className="p-2.5 rounded-2xl bg-sky-500 hover:bg-sky-600 text-white shadow-sm shadow-sky-200 cursor-pointer active:scale-95 transition-all disabled:opacity-40"
              title="发送行动"
            >
              <Send className="w-4 h-4" />
            </button>
          )}
        </div>
      </footer>

      {/* 便携冒险终端设备 (统一整合导航栏各项繁琐功能) */}
      {isDeviceModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-150">
            {/* Terminal Header */}
            <div className="px-5 py-4 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-2xl bg-sky-500/20 border border-sky-400/40 flex items-center justify-center text-sky-400">
                  <Laptop className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-slate-100 flex items-center gap-1.5">
                    便携冒险终端
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-sky-500/30 text-sky-300 font-mono">
                      TERMINAL
                    </span>
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    整合全域工具，随身调阅探险数据与操作面板
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsDeviceModalOpen(false)}
                className="p-1.5 rounded-xl hover:bg-white/10 text-slate-400 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Quick Status Bar */}
            <div className="px-5 py-2.5 bg-slate-50 border-b border-slate-100 flex items-center justify-between text-xs text-slate-600">
              <div className="flex items-center gap-3">
                <span className="flex items-center gap-1 text-slate-700 font-medium">
                  <User className="w-3.5 h-3.5 text-slate-400" />
                  {char.name}
                </span>
                <span className="flex items-center gap-1 text-rose-600 font-medium">
                  <Heart className="w-3.5 h-3.5 fill-rose-500 text-rose-500" />
                  {char.currentHp}/{char.maxHp}
                </span>
                <span className="flex items-center gap-1 text-sky-600 font-medium">
                  <Shield className="w-3.5 h-3.5" />
                  AC {playerAC}
                </span>
              </div>
              <div className="text-[11px] text-slate-400 font-medium flex items-center gap-1">
                <MapPin className="w-3 h-3 text-indigo-500" />
                <span>{currentLocationName}</span>
              </div>
            </div>

            {/* Modules Grid */}
            <div className="p-5 overflow-y-auto space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {/* 1. 地图 */}
                <button
                  type="button"
                  onClick={() => {
                    setIsDeviceModalOpen(false);
                    setIsMapModalOpen(true);
                  }}
                  className="flex flex-col items-center justify-center p-3.5 rounded-2xl bg-slate-50 hover:bg-indigo-50/70 border border-slate-200/80 hover:border-indigo-300 text-slate-700 hover:text-indigo-700 transition-all cursor-pointer group active:scale-95 text-center"
                >
                  <div className="w-10 h-10 rounded-xl bg-indigo-100 text-indigo-600 flex items-center justify-center mb-2 group-hover:scale-105 transition-transform">
                    <Compass className="w-5 h-5" />
                  </div>
                  <span className="text-xs font-bold text-slate-800 group-hover:text-indigo-900">
                    全域地图
                  </span>
                  <span className="text-[10px] text-slate-400 group-hover:text-indigo-500 mt-0.5">
                    查看节点与路径
                  </span>
                </button>

                {/* 2. 任务 */}
                <button
                  type="button"
                  onClick={() => {
                    setIsDeviceModalOpen(false);
                    setIsQuestModalOpen(true);
                  }}
                  className="relative flex flex-col items-center justify-center p-3.5 rounded-2xl bg-slate-50 hover:bg-amber-50/70 border border-slate-200/80 hover:border-amber-300 text-slate-700 hover:text-amber-800 transition-all cursor-pointer group active:scale-95 text-center"
                >
                  {activeQuestsCount > 0 && (
                    <span className="absolute top-2 right-2 px-1.5 py-0.2 rounded-full bg-amber-500 text-white text-[9px] font-bold">
                      {activeQuestsCount}
                    </span>
                  )}
                  <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center mb-2 group-hover:scale-105 transition-transform">
                    <ScrollText className="w-5 h-5" />
                  </div>
                  <span className="text-xs font-bold text-slate-800 group-hover:text-amber-900">
                    任务追踪
                  </span>
                  <span className="text-[10px] text-slate-400 group-hover:text-amber-600 mt-0.5">
                    {activeQuestsCount > 0 ? `${activeQuestsCount} 个进行中` : '暂无任务'}
                  </span>
                </button>

                {/* 3. 参演伙伴 */}
                <button
                  type="button"
                  onClick={() => {
                    setIsDeviceModalOpen(false);
                    setIsPartyModalOpen(true);
                  }}
                  className="flex flex-col items-center justify-center p-3.5 rounded-2xl bg-slate-50 hover:bg-sky-50/70 border border-slate-200/80 hover:border-sky-300 text-slate-700 hover:text-sky-800 transition-all cursor-pointer group active:scale-95 text-center"
                >
                  <div className="w-10 h-10 rounded-xl bg-sky-100 text-sky-700 flex items-center justify-center mb-2 group-hover:scale-105 transition-transform">
                    <Users className="w-5 h-5" />
                  </div>
                  <span className="text-xs font-bold text-slate-800 group-hover:text-sky-900">
                    参演伙伴
                  </span>
                  <span className="text-[10px] text-slate-400 group-hover:text-sky-600 mt-0.5">
                    {activeCompanionsCount > 0 ? `${activeCompanionsCount} 名随行/偶遇` : '旅途中招募'}
                  </span>
                </button>

                {/* 4. 纪事 */}
                <button
                  type="button"
                  onClick={() => {
                    setIsDeviceModalOpen(false);
                    setIsStoryLogModalOpen(true);
                  }}
                  className="flex flex-col items-center justify-center p-3.5 rounded-2xl bg-slate-50 hover:bg-emerald-50/70 border border-slate-200/80 hover:border-emerald-300 text-slate-700 hover:text-emerald-800 transition-all cursor-pointer group active:scale-95 text-center"
                >
                  <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center mb-2 group-hover:scale-105 transition-transform">
                    <BookMarked className="w-5 h-5" />
                  </div>
                  <span className="text-xs font-bold text-slate-800 group-hover:text-emerald-900">
                    编年史纪事
                  </span>
                  <span className="text-[10px] text-slate-400 group-hover:text-emerald-600 mt-0.5">
                    线索与剧情记录
                  </span>
                </button>

                {/* 5. 战斗面板 */}
                <button
                  type="button"
                  onClick={() => {
                    setIsDeviceModalOpen(false);
                    setIsCombatPanelOpen(!isCombatPanelOpen);
                  }}
                  className={`flex flex-col items-center justify-center p-3.5 rounded-2xl border transition-all cursor-pointer group active:scale-95 text-center ${
                    session.combatState.inCombat
                      ? 'bg-rose-50/80 border-rose-300 text-rose-700 hover:bg-rose-100'
                      : 'bg-slate-50 hover:bg-rose-50/70 border-slate-200/80 hover:border-rose-300 text-slate-700 hover:text-rose-800'
                  }`}
                >
                  <div
                    className={`w-10 h-10 rounded-xl flex items-center justify-center mb-2 group-hover:scale-105 transition-transform ${
                      session.combatState.inCombat
                        ? 'bg-rose-500 text-white animate-pulse'
                        : 'bg-rose-100 text-rose-700'
                    }`}
                  >
                    <Swords className="w-5 h-5" />
                  </div>
                  <span className="text-xs font-bold text-slate-800 group-hover:text-rose-900">
                    战斗面板
                  </span>
                  <span className="text-[10px] text-slate-400 group-hover:text-rose-600 mt-0.5">
                    {session.combatState.inCombat ? '战斗进行中' : '展开/收起对决'}
                  </span>
                </button>

                {/* 6. 核心掷骰 */}
                <button
                  type="button"
                  onClick={() => {
                    setIsDeviceModalOpen(false);
                    setIsDiceModalOpen(true);
                  }}
                  className="flex flex-col items-center justify-center p-3.5 rounded-2xl bg-slate-50 hover:bg-violet-50/70 border border-slate-200/80 hover:border-violet-300 text-slate-700 hover:text-violet-800 transition-all cursor-pointer group active:scale-95 text-center"
                >
                  <div className="w-10 h-10 rounded-xl bg-violet-100 text-violet-700 flex items-center justify-center mb-2 group-hover:scale-105 transition-transform">
                    <Dices className="w-5 h-5" />
                  </div>
                  <span className="text-xs font-bold text-slate-800 group-hover:text-violet-900">
                    手动掷骰
                  </span>
                  <span className="text-[10px] text-slate-400 group-hover:text-violet-600 mt-0.5">
                    自主检定与暗投
                  </span>
                </button>

                {/* 7. 角色行囊 */}
                <button
                  type="button"
                  onClick={() => {
                    setIsDeviceModalOpen(false);
                    setIsCharModalOpen(true);
                  }}
                  className="flex flex-col items-center justify-center p-3.5 rounded-2xl bg-slate-50 hover:bg-blue-50/70 border border-slate-200/80 hover:border-blue-300 text-slate-700 hover:text-blue-800 transition-all cursor-pointer group active:scale-95 text-center"
                >
                  <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center mb-2 group-hover:scale-105 transition-transform">
                    <User className="w-5 h-5" />
                  </div>
                  <span className="text-xs font-bold text-slate-800 group-hover:text-blue-900">
                    角色行囊
                  </span>
                  <span className="text-[10px] text-slate-400 group-hover:text-blue-600 mt-0.5">
                    属性、状态与装备
                  </span>
                </button>

                {/* 8. 战役规则 */}
                <button
                  type="button"
                  onClick={() => {
                    setIsDeviceModalOpen(false);
                    setIsRulesetModalOpen(true);
                  }}
                  className="flex flex-col items-center justify-center p-3.5 rounded-2xl bg-slate-50 hover:bg-slate-100 border border-slate-200/80 hover:border-slate-300 text-slate-700 hover:text-slate-900 transition-all cursor-pointer group active:scale-95 text-center"
                >
                  <div className="w-10 h-10 rounded-xl bg-slate-200/80 text-slate-700 flex items-center justify-center mb-2 group-hover:scale-105 transition-transform">
                    <Settings2 className="w-5 h-5" />
                  </div>
                  <span className="text-xs font-bold text-slate-800 group-hover:text-slate-900">
                    规则设置
                  </span>
                  <span className="text-[10px] text-slate-400 group-hover:text-slate-600 mt-0.5">
                    判定标准与机制
                  </span>
                </button>

                {/* 9. 时空存档 */}
                <button
                  type="button"
                  onClick={() => {
                    setIsDeviceModalOpen(false);
                    setIsSaveLoadModalOpen(true);
                  }}
                  className="flex flex-col items-center justify-center p-3.5 rounded-2xl bg-slate-50 hover:bg-indigo-50/70 border border-slate-200/80 hover:border-indigo-300 text-slate-700 hover:text-indigo-800 transition-all cursor-pointer group active:scale-95 text-center"
                >
                  <div className="w-10 h-10 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center mb-2 group-hover:scale-105 transition-transform">
                    <FolderArchive className="w-5 h-5" />
                  </div>
                  <span className="text-xs font-bold text-slate-800 group-hover:text-indigo-900">
                    时空存档
                  </span>
                  <span className="text-[10px] text-slate-400 group-hover:text-indigo-600 mt-0.5">
                    保存与读取进度
                  </span>
                </button>
              </div>
            </div>

            {/* Footer Close */}
            <div className="px-5 py-3 bg-slate-50 border-t border-slate-100 flex justify-end">
              <button
                type="button"
                onClick={() => setIsDeviceModalOpen(false)}
                className="px-4 py-1.5 rounded-xl text-xs font-bold text-slate-600 hover:text-slate-800 hover:bg-slate-200/70 transition-colors cursor-pointer"
              >
                收起终端
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Sub Modals (关闭时均返回便携终端主页，保持层级连贯) */}
      <TRPGDiceModal
        isOpen={isDiceModalOpen}
        onClose={() => {
          setIsDiceModalOpen(false);
          setIsDeviceModalOpen(true);
        }}
        character={session.character}
        ruleset={session.rulesetSnapshot}
        diceMode={session.diceMode}
        onConfirmRoll={handleConfirmDiceRoll}
      />

      <TRPGCharacterModal
        isOpen={isCharModalOpen}
        character={session.character}
        ruleset={session.rulesetSnapshot}
        onClose={() => {
          setIsCharModalOpen(false);
          setIsDeviceModalOpen(true);
        }}
        onSave={(updatedChar) => {
          const nextSession = { ...session, character: updatedChar };
          onUpdateSession(nextSession);
          saveSingleTRPGSession(nextSession);
          setIsCharModalOpen(false);
          setIsDeviceModalOpen(true);
        }}
      />

      <TRPGRulesetModal
        isOpen={isRulesetModalOpen}
        ruleset={session.rulesetSnapshot}
        onClose={() => {
          setIsRulesetModalOpen(false);
          setIsDeviceModalOpen(true);
        }}
        onSave={(updatedRuleset) => {
          const nextSession = { ...session, rulesetSnapshot: updatedRuleset };
          onUpdateSession(nextSession);
          saveSingleTRPGSession(nextSession);
          setIsRulesetModalOpen(false);
          setIsDeviceModalOpen(true);
        }}
      />

      <TRPGQuestModal
        isOpen={isQuestModalOpen}
        onClose={() => {
          setIsQuestModalOpen(false);
          setIsDeviceModalOpen(true);
        }}
        session={session}
        onUpdateSession={(updated) => {
          onUpdateSession(updated);
          saveSingleTRPGSession(updated);
        }}
      />

      <TRPGPartyModal
        isOpen={isPartyModalOpen}
        onClose={() => {
          setIsPartyModalOpen(false);
          setIsDeviceModalOpen(true);
        }}
        session={session}
        characterCards={characterCards}
        onUpdateSession={(updated) => {
          onUpdateSession(updated);
          saveSingleTRPGSession(updated);
        }}
      />

      <TRPGStoryLogModal
        isOpen={isStoryLogModalOpen}
        onClose={() => {
          setIsStoryLogModalOpen(false);
          setIsDeviceModalOpen(true);
        }}
        session={session}
      />

      <TRPGMapModal
        isOpen={isMapModalOpen}
        onClose={() => {
          setIsMapModalOpen(false);
          setIsDeviceModalOpen(true);
        }}
        mapState={session.mapState}
        onMoveToLocation={handleMoveLocation}
      />

      <TRPGSaveLoadModal
        isOpen={isSaveLoadModalOpen}
        onClose={() => {
          setIsSaveLoadModalOpen(false);
          setIsDeviceModalOpen(true);
        }}
        session={session}
        onRestoreSave={handleRestoreSave}
      />
    </div>
  );
};
