import React, { useState, useRef, useEffect } from 'react';
import {
  ArrowLeft,
  Sliders,
  Send,
  Square,
  RefreshCw,
  Copy,
  Edit2,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Sparkles,
  Heart,
  Shield,
  Zap,
  Brain,
  X,
  Volume2,
  MoreVertical,
  Check,
  Compass,
  MessageSquare,
  FileText,
  User,
  Plus,
  Trash2,
} from 'lucide-react';
import {
  StorySave,
  CharacterCard,
  WorldBook,
  SystemPreset,
  ChatMessage,
  ChatMessageBranch,
  AppSettings,
  WordCountOption,
  GameStatDefinition,
  UserMask,
} from '../types';
import { buildSystemInstruction, parseAIResponseTags } from '../utils/promptEngine';
import { saveSingleStory } from '../utils/storage';
import { streamChat } from '../utils/aiService';

// Helper to ensure each character in save has their own independent set of stats
function normalizeSaveStats(save: StorySave, characters: CharacterCard[]): GameStatDefinition[] {
  const activeChars = characters.filter((c) => save.characterIds.includes(c.id));
  if (activeChars.length === 0) return save.stats || [];

  const existingStats = save.stats || [];
  // If stats already partitioned by characterId, return
  const hasCharIds = existingStats.some((s) => !!s.characterId);
  if (hasCharIds) return existingStats;

  // Otherwise, clone stats per character
  const normalized: GameStatDefinition[] = [];
  activeChars.forEach((char) => {
    existingStats.forEach((s) => {
      normalized.push({
        ...s,
        id: `${s.id}-${char.id}`,
        characterId: char.id,
        characterName: char.name,
      });
    });
  });
  return normalized;
}

// Helper to update stats according to background tracking, adoration unlock, darkness constraints, and per-character isolation
function applyStatsUpdate(
  currentStats: GameStatDefinition[] = [],
  statsDelta: Record<string, number> = {},
  statsDeltaByCharacter: Record<string, Record<string, number>> = {},
  recalcStats: Record<string, Record<string, number>> | undefined,
  activeCharacters: CharacterCard[] = [],
  disabledCharacterStatIds: string[] = []
): GameStatDefinition[] {
  if (!currentStats || currentStats.length === 0) return currentStats;

  // Check if character is considered "very positive / upright / pure"
  const isCharacterVeryPositive = (charName?: string, charId?: string): boolean => {
    const targetChar = activeCharacters.find(
      (c) => (charId && c.id === charId) || (charName && c.name.includes(charName)) || activeCharacters.length === 1
    );
    if (!targetChar) return false;
    const text = `${targetChar.personality} ${targetChar.identity} ${targetChar.background} ${targetChar.customNotes}`;
    const positiveKeywords = ['正义', '高洁', '光明', '圣洁', '守护', '纯善', '正直', '纯洁', '清廉', '守誓'];
    const darkKeywords = ['反派', '堕落', '阴鸷', '腹黑', '残忍', '邪恶', '扭曲', '心魔', '血腥', '杀伐', '自私', '深渊'];
    const hasDark = darkKeywords.some((k) => text.includes(k));
    const hasPos = positiveKeywords.some((k) => text.includes(k));
    return hasPos && !hasDark;
  };

  const nextStats: GameStatDefinition[] = currentStats.map((s) => ({ ...s }));

  activeCharacters.forEach((char) => {
    // If character status tracking is disabled, do NOT record/update their stats!
    if (disabledCharacterStatIds.includes(char.id)) {
      return;
    }

    // Check if there is recalculation for this character from story context
    const recalcForChar =
      recalcStats?.[char.name] ||
      (recalcStats ? Object.entries(recalcStats).find(([k]) => char.name.includes(k))?.[1] : undefined);
    if (recalcForChar) {
      for (const [statName, val] of Object.entries(recalcForChar)) {
        const statObj = nextStats.find(
          (s) => (s.characterId === char.id || s.characterName === char.name) && s.name === statName
        );
        if (statObj) {
          statObj.currentValue = Math.max(statObj.minValue, Math.min(statObj.maxValue, val));
          statObj.lastDelta = 0;
        }
      }
    }

    // Get delta for this character
    const charDeltaMap =
      statsDeltaByCharacter[char.name] ||
      (activeCharacters.length === 1
        ? statsDelta
        : Object.entries(statsDeltaByCharacter).find(([k]) => char.name.includes(k))?.[1]) ||
      {};

    const effectiveDeltas =
      Object.keys(charDeltaMap).length > 0 ? charDeltaMap : activeCharacters.length === 1 ? statsDelta : {};

    // 1. Update this character's regular stats
    for (const stat of nextStats) {
      if (stat.characterId && stat.characterId !== char.id) continue;
      if (!stat.characterId && stat.characterName && !stat.characterName.includes(char.name)) continue;

      if (stat.name === '黑化值') {
        if (isCharacterVeryPositive(stat.characterName, stat.characterId)) {
          stat.currentValue = 0;
          stat.lastDelta = 0;
          continue;
        }
      }

      if (effectiveDeltas[stat.name] !== undefined) {
        const delta = effectiveDeltas[stat.name];
        const newVal = stat.currentValue + delta;

        if (stat.name === '好感度') {
          if (newVal >= 100) {
            stat.currentValue = 100;
            stat.lastDelta = delta;
          } else {
            stat.currentValue = Math.max(stat.minValue, newVal);
            stat.lastDelta = delta;
          }
        } else {
          stat.currentValue = Math.max(stat.minValue, Math.min(stat.maxValue, newVal));
          stat.lastDelta = delta;
        }
      }
    }

    // 2. Check 好感度 and 爱慕值 logic for this character
    const affectionStat = nextStats.find(
      (s) => (s.characterId === char.id || s.characterName === char.name) && s.name === '好感度'
    );
    const existingAdorationIndex = nextStats.findIndex(
      (s) => (s.characterId === char.id || s.characterName === char.name) && s.name === '爱慕值'
    );

    if (affectionStat) {
      if (affectionStat.currentValue >= 100) {
        affectionStat.currentValue = 100;
        const adorationDelta = effectiveDeltas['爱慕值'] || 0;

        if (existingAdorationIndex >= 0) {
          const adStat = nextStats[existingAdorationIndex];
          adStat.currentValue = Math.max(0, Math.min(100, adStat.currentValue + adorationDelta));
          adStat.lastDelta = adorationDelta;
        } else {
          const affIndex = nextStats.findIndex((s) => s.id === affectionStat.id);
          const newAdorationStat: GameStatDefinition = {
            id: `stat-adoration-${char.id}-${Date.now()}`,
            name: '爱慕值',
            initialValue: Math.max(0, adorationDelta),
            currentValue: Math.max(0, adorationDelta),
            minValue: 0,
            maxValue: 100,
            unit: '点',
            color: 'rose',
            enabled: true,
            target: 'character',
            characterId: char.id,
            characterName: char.name,
            lastDelta: adorationDelta,
          };
          nextStats.splice(affIndex + 1, 0, newAdorationStat);
        }
      } else {
        if (existingAdorationIndex >= 0) {
          nextStats.splice(existingAdorationIndex, 1);
        }
      }
    }
  });

  return nextStats;
}

interface ChatViewProps {
  save: StorySave;
  characters: CharacterCard[];
  worldbooks: WorldBook[];
  presets: SystemPreset[];
  userMasks?: UserMask[];
  activeUserMaskId?: string | null;
  settings: AppSettings;
  onBack: () => void;
  onUpdateSave: (updated: StorySave) => void;
}

export const ChatView: React.FC<ChatViewProps> = ({
  save,
  characters,
  worldbooks,
  presets,
  userMasks = [],
  activeUserMaskId,
  settings,
  onBack,
  onUpdateSave,
}) => {
  const [currentSave, setCurrentSave] = useState<StorySave>(() => ({
    ...save,
    stats: normalizeSaveStats(save, characters),
  }));
  const [inputText, setInputText] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Drawer / Side Panel
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [activeDrawerTab, setActiveDrawerTab] = useState<'stats' | 'characters' | 'worldbook' | 'settings'>('stats');

  // Edit user message
  const [editingMsgIndex, setEditingMsgIndex] = useState<number | null>(null);
  const [editingMsgText, setEditingMsgText] = useState('');

  // Delete message confirmation
  const [confirmDeleteMsgIndex, setConfirmDeleteMsgIndex] = useState<number | null>(null);

  // Character card expand states in stats drawer (default expanded)
  const [expandedCharacterCards, setExpandedCharacterCards] = useState<Record<string, boolean>>({});
  // Per-message stats delta breakdown expand state (default collapsed)
  const [expandedMessageStats, setExpandedMessageStats] = useState<Record<string, boolean>>({});
  // Inline character thoughts expand state
  const [expandedInlineThoughts, setExpandedInlineThoughts] = useState<Record<string, boolean>>({});

  const toggleCharCard = (charId: string) => {
    setExpandedCharacterCards((prev) => {
      const currentExpanded = prev[charId] ?? (activeChars.length === 1);
      return {
        ...prev,
        [charId]: !currentExpanded,
      };
    });
  };

  const toggleMsgStats = (msgId: string) => {
    setExpandedMessageStats((prev) => ({
      ...prev,
      [msgId]: !prev[msgId],
    }));
  };

  const toggleInlineThought = (thoughtKey: string) => {
    setExpandedInlineThoughts((prev) => ({
      ...prev,
      [thoughtKey]: !prev[thoughtKey],
    }));
  };

  const handleToggleCharacterStatus = (charId: string) => {
    const currentDisabled = currentSave.disabledCharacterStatIds || [];
    const isCurrentlyDisabled = currentDisabled.includes(charId);

    let nextDisabled: string[];
    let nextRecalcPending = currentSave.recalcPendingCharacterIds || [];

    if (isCurrentlyDisabled) {
      // Re-enabling character status tracking:
      nextDisabled = currentDisabled.filter((id) => id !== charId);
      if (!nextRecalcPending.includes(charId)) {
        nextRecalcPending = [...nextRecalcPending, charId];
      }
    } else {
      // Disabling character status tracking:
      nextDisabled = [...currentDisabled, charId];
      nextRecalcPending = nextRecalcPending.filter((id) => id !== charId);
    }

    const updatedSave: StorySave = {
      ...currentSave,
      disabledCharacterStatIds: nextDisabled,
      recalcPendingCharacterIds: nextRecalcPending,
      updatedAt: Date.now(),
    };

    commitSave(updatedSave);
  };

  // Append option text to input box for secondary editing
  const handleAppendOptionToInput = (choice: string) => {
    setInputText((prev) => {
      const trimmed = prev.trim();
      if (!trimmed) {
        return choice;
      }
      // If ends with punctuation, append directly with a space, otherwise add a comma
      if (/[，。！？；,!?;、]$/.test(trimmed)) {
        return `${trimmed} ${choice}`;
      }
      return `${trimmed}，${choice}`;
    });

    // Focus input textarea so the player can immediately type or tweak
    setTimeout(() => {
      if (inputRef.current) {
        inputRef.current.focus();
        inputRef.current.scrollTop = inputRef.current.scrollHeight;
      }
    }, 40);
  };

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Sync state if props change
  useEffect(() => {
    setCurrentSave({ ...save, stats: normalizeSaveStats(save, characters) });
  }, [save, characters]);

  // Auto scroll to bottom
  const scrollToBottom = (behavior: ScrollBehavior = 'smooth') => {
    messagesEndRef.current?.scrollIntoView({ behavior });
  };

  useEffect(() => {
    if (settings.autoScroll) {
      scrollToBottom('smooth');
    }
  }, [currentSave.messages, streamingContent, isStreaming]);

  // Active characters, worldbook, preset, user mask
  const activeChars = characters.filter((c) => currentSave.characterIds.includes(c.id));
  const activeWorldBook = worldbooks.find((wb) => wb.id === currentSave.worldBookId);
  const activePreset = presets.find((p) => p.id === currentSave.presetId) || presets[0];
  const isMaskEnabled =
    currentSave.config?.userMaskEnabled !== false &&
    Boolean(currentSave.userMaskId) &&
    (userMasks?.length ?? 0) > 0;
  const activeUserMask = isMaskEnabled
    ? userMasks.find((m) => m.id === currentSave.userMaskId) || userMasks[0]
    : undefined;

  // If new save with 0 messages, trigger prologue opening generation automatically if needed
  useEffect(() => {
    if (currentSave.messages.length === 0 && !isStreaming) {
      handleGenerateOpening();
    }
  }, []);

  // Update save helper
  const commitSave = (newSave: StorySave) => {
    setCurrentSave(newSave);
    onUpdateSave(newSave);
    saveSingleStory(newSave);
  };

  // Helper to copy text
  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Send message
  const handleSendMessage = async (textToSend?: string) => {
    const rawContent = (textToSend ?? inputText).trim();
    if (!rawContent || isStreaming) return;

    setInputText('');
    setErrorMessage(null);

    const userMessage: ChatMessage = {
      id: `msg-${Date.now()}-user`,
      role: 'user',
      content: rawContent,
      timestamp: Date.now(),
    };

    const updatedMessages = [...currentSave.messages, userMessage];
    const updatedSave: StorySave = {
      ...currentSave,
      messages: updatedMessages,
      updatedAt: Date.now(),
    };

    commitSave(updatedSave);

    // Call AI stream
    await executeAIStream(updatedSave, updatedMessages);
  };

  // Generate prologue / opening
  const handleGenerateOpening = async () => {
    if (isStreaming) return;
    setErrorMessage(null);

    const openingPrompt = `【文游开局指令】：
请根据以下背景情境开启故事的第一幕。描摹周边环境氛围、角色登场时的神情动态，并在结尾向玩家抛出情境悬念，将第一轮行动选择权交还给玩家。
背景情境：${currentSave.openingPremise}`;

    const syntheticUserMsg: ChatMessage = {
      id: `msg-${Date.now()}-init`,
      role: 'user',
      content: `【故事开篇】${currentSave.openingPremise}`,
      timestamp: Date.now(),
    };

    const updatedSave: StorySave = {
      ...currentSave,
      messages: [syntheticUserMsg],
      updatedAt: Date.now(),
    };

    commitSave(updatedSave);
    await executeAIStream(updatedSave, [syntheticUserMsg]);
  };

  // Regenerate last AI message (with branch preservation!)
  const handleRegenerate = async (msgIndex: number) => {
    if (isStreaming || msgIndex < 0) return;
    setErrorMessage(null);

    // History up to the message before this AI response
    const historyMessages = currentSave.messages.slice(0, msgIndex);
    await executeAIStream(currentSave, historyMessages, msgIndex);
  };

  // Continue generation
  const handleContinueGeneration = async () => {
    if (isStreaming || currentSave.messages.length === 0) return;
    const lastMsg = currentSave.messages[currentSave.messages.length - 1];
    if (lastMsg.role !== 'assistant') return;

    setErrorMessage(null);
    const continuePrompt = '请顺着刚才的剧情描写继续生成后续发展，保持一致的风格与节奏。';
    const continueMsg: ChatMessage = {
      id: `msg-${Date.now()}-user`,
      role: 'user',
      content: continuePrompt,
      timestamp: Date.now(),
    };

    const updatedMessages = [...currentSave.messages, continueMsg];
    const updatedSave: StorySave = {
      ...currentSave,
      messages: updatedMessages,
      updatedAt: Date.now(),
    };
    commitSave(updatedSave);

    await executeAIStream(updatedSave, updatedMessages);
  };

  // Switch between message branches
  const handleSwitchBranch = (msgIndex: number, newBranchIndex: number) => {
    const targetMsg = currentSave.messages[msgIndex];
    if (!targetMsg || !targetMsg.branches || !targetMsg.branches[newBranchIndex]) return;

    const chosenBranch = targetMsg.branches[newBranchIndex];
    const updatedTargetMsg: ChatMessage = {
      ...targetMsg,
      content: chosenBranch.text,
      thoughts: chosenBranch.thoughts,
      statsDelta: chosenBranch.statsDelta,
      suggestedBranches: chosenBranch.suggestedBranches,
      currentBranchIndex: newBranchIndex,
    };

    const updatedMessages = [...currentSave.messages];
    updatedMessages[msgIndex] = updatedTargetMsg;

    const updatedSave = {
      ...currentSave,
      messages: updatedMessages,
      updatedAt: Date.now(),
    };
    commitSave(updatedSave);
  };

  // Save user message modification without re-rolling
  const handleSaveUserMsgOnly = (msgIndex: number) => {
    if (!editingMsgText.trim()) return;

    const updatedUserMsg: ChatMessage = {
      ...currentSave.messages[msgIndex],
      content: editingMsgText.trim(),
    };

    const updatedMessages = [...currentSave.messages];
    updatedMessages[msgIndex] = updatedUserMsg;

    const updatedSave = {
      ...currentSave,
      messages: updatedMessages,
      updatedAt: Date.now(),
    };
    commitSave(updatedSave);
    setEditingMsgIndex(null);
    setEditingMsgText('');
  };

  // Delete message at index
  const handleDeleteMessage = (msgIndex: number) => {
    if (msgIndex < 0 || msgIndex >= currentSave.messages.length) return;
    const nextMessages = currentSave.messages.filter((_, idx) => idx !== msgIndex);
    const updatedSave: StorySave = {
      ...currentSave,
      messages: nextMessages,
      updatedAt: Date.now(),
    };
    commitSave(updatedSave);
    setConfirmDeleteMsgIndex(null);
  };

  // Re-roll story from user message (can be called with or without text edits)
  const handleRerollFromUserMsg = async (msgIndex: number) => {
    if (isStreaming) return;

    let targetContent = currentSave.messages[msgIndex].content;
    if (editingMsgIndex === msgIndex && editingMsgText.trim()) {
      targetContent = editingMsgText.trim();
    }

    const updatedUserMsg: ChatMessage = {
      ...currentSave.messages[msgIndex],
      content: targetContent,
    };

    // Slice history up to this user message and regenerate subsequent plot
    const newMessages = [...currentSave.messages.slice(0, msgIndex), updatedUserMsg];
    setEditingMsgIndex(null);
    setEditingMsgText('');

    const updatedSave = {
      ...currentSave,
      messages: newMessages,
      updatedAt: Date.now(),
    };
    commitSave(updatedSave);

    await executeAIStream(updatedSave, newMessages);
  };

  // Core stream caller
  const executeAIStream = async (
    activeSaveState: StorySave,
    conversationHistory: ChatMessage[],
    regenerateAtMsgIndex?: number
  ) => {
    setIsStreaming(true);
    setStreamingContent('');

    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    try {
      const systemInstruction = buildSystemInstruction(
        activeSaveState,
        characters,
        activeWorldBook,
        activePreset,
        activeUserMask
      );

      // Prepare payload messages
      const apiMessages = conversationHistory.map((m) => ({
        role: (m.role === 'assistant' ? 'model' : 'user') as 'model' | 'user',
        text: m.content,
      }));

      let accumulatedRaw = '';

      await streamChat({
        provider: settings.provider,
        model: settings.model,
        customApiKey: settings.customApiKey,
        customEndpoint: settings.customEndpoint,
        temperature: settings.temperature,
        systemInstruction,
        messages: apiMessages,
        signal: abortController.signal,
        onChunk: (textChunk) => {
          accumulatedRaw += textChunk;
          const currentParsed = parseAIResponseTags(accumulatedRaw);
          setStreamingContent(currentParsed.cleanText);
        },
      });

      // Final post-processing
      const {
        cleanText,
        statsDelta,
        statsDeltaByCharacter,
        recalcStats,
        thoughts,
        suggestedBranches,
      } = parseAIResponseTags(accumulatedRaw);

      // Create new branch object
      const newBranch: ChatMessageBranch = {
        id: `branch-${Date.now()}`,
        text: cleanText,
        thoughts,
        statsDelta,
        statsDeltaByCharacter,
        suggestedBranches,
        timestamp: Date.now(),
      };

      // Always update stats in the background per character (honoring disabled status, recalc, and affection rules)
      const updatedStats = applyStatsUpdate(
        activeSaveState.stats,
        statsDelta,
        statsDeltaByCharacter,
        recalcStats,
        activeChars,
        activeSaveState.disabledCharacterStatIds || []
      );

      // If recalcStats arrived, remove recalculated characters from recalcPendingCharacterIds
      let nextRecalcPending = activeSaveState.recalcPendingCharacterIds || [];
      if (recalcStats && Object.keys(recalcStats).length > 0) {
        nextRecalcPending = nextRecalcPending.filter((charId) => {
          const charObj = characters.find((c) => c.id === charId);
          return charObj ? !recalcStats![charObj.name] : true;
        });
      }

      let finalMessages: ChatMessage[];

      if (regenerateAtMsgIndex !== undefined && activeSaveState.messages[regenerateAtMsgIndex]) {
        // Regenerating existing AI message: append branch!
        const existingMsg = activeSaveState.messages[regenerateAtMsgIndex];
        const existingBranches = existingMsg.branches || [
          {
            id: `branch-orig`,
            text: existingMsg.content,
            thoughts: existingMsg.thoughts,
            statsDelta: existingMsg.statsDelta,
            statsDeltaByCharacter: existingMsg.statsDeltaByCharacter,
            suggestedBranches: existingMsg.suggestedBranches,
            timestamp: existingMsg.timestamp,
          },
        ];

        const updatedBranches = [...existingBranches, newBranch];
        const newBranchIndex = updatedBranches.length - 1;

        const updatedMsg: ChatMessage = {
          ...existingMsg,
          content: cleanText,
          thoughts,
          statsDelta,
          statsDeltaByCharacter,
          suggestedBranches,
          branches: updatedBranches,
          currentBranchIndex: newBranchIndex,
        };

        finalMessages = [...activeSaveState.messages];
        finalMessages[regenerateAtMsgIndex] = updatedMsg;
      } else {
        // New assistant message
        const newAssistantMsg: ChatMessage = {
          id: `msg-${Date.now()}-ai`,
          role: 'assistant',
          content: cleanText,
          thoughts,
          statsDelta,
          statsDeltaByCharacter,
          suggestedBranches,
          branches: [newBranch],
          currentBranchIndex: 0,
          timestamp: Date.now(),
        };

        finalMessages = [...conversationHistory, newAssistantMsg];
      }

      const nextSaveState: StorySave = {
        ...activeSaveState,
        messages: finalMessages,
        stats: updatedStats,
        recalcPendingCharacterIds: nextRecalcPending,
        updatedAt: Date.now(),
      };

      commitSave(nextSaveState);
    } catch (e: any) {
      if (e.name === 'AbortError') {
        console.log('Stream generation aborted by user');
      } else {
        console.error('AI Stream Error:', e);
        setErrorMessage(e.message || '生成异常，请检查网络或在“设置”中配置有效 API Key');
      }
    } finally {
      setIsStreaming(false);
      setStreamingContent('');
      abortControllerRef.current = null;
    }
  };

  const handleStopGeneration = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  };

  // Typography styles
  const fontClass = settings.fontFamily === 'serif' ? 'font-novel' : 'font-sans';
  const fontSizeClass = {
    sm: 'text-xs',
    base: 'text-sm',
    lg: 'text-base',
    xl: 'text-lg',
  }[settings.fontSize];

  const lineSpacingClass = {
    normal: 'leading-normal',
    relaxed: 'leading-relaxed',
    loose: 'leading-loose',
  }[settings.lineSpacing];

  // Helper to render narrative text with inline collapsible character thoughts and highlighted quotes
  const renderFormattedProse = (content: string, msgId: string = 'msg') => {
    // Split into paragraphs
    const paragraphs = content.split('\n').filter((p) => p.trim().length > 0);
    let thoughtCounter = 0;

    return paragraphs.map((paragraph, pIdx) => {
      // Check if this paragraph contains one or more inline thoughts: [[INLINE_THOUGHT:角色名:心声]]
      const parts = paragraph.split(/(\[\[INLINE_THOUGHT:[^:：]+?[:：][\s\S]*?\]\])/g);

      return (
        <div key={pIdx} className="my-2.5">
          {parts.map((part, partIdx) => {
            const inlineMatch = part.match(/^\[\[INLINE_THOUGHT:([^:：]+?)[:：]([\s\S]*?)\]\]$/);
            if (inlineMatch) {
              const charName = inlineMatch[1].trim();
              const thoughtContent = inlineMatch[2].trim();
              thoughtCounter++;
              const thoughtKey = `${msgId}-thought-${pIdx}-${thoughtCounter}`;
              const isExpanded = !!expandedInlineThoughts[thoughtKey];

              return (
                <div
                  key={partIdx}
                  className="my-3 rounded-xl border border-sky-200/90 bg-gradient-to-r from-sky-50/90 via-blue-50/40 to-sky-50/80 overflow-hidden text-xs shadow-2xs transition-all"
                >
                  <button
                    type="button"
                    onClick={() => toggleInlineThought(thoughtKey)}
                    className="w-full px-3 py-2 flex items-center justify-between text-sky-800 hover:bg-sky-100/60 cursor-pointer font-medium select-none transition-colors"
                  >
                    <span className="flex items-center gap-1.5">
                      <span className="text-sky-500 text-xs">💭</span>
                      <span className="font-semibold text-sky-900">【{charName}】的心声</span>
                    </span>
                    <span className="flex items-center gap-1 text-[11px] text-sky-600 font-medium">
                      <span>{isExpanded ? '收起心声' : '点击展开心声'}</span>
                      <ChevronDown
                        className={`w-3.5 h-3.5 transition-transform duration-200 ${
                          isExpanded ? 'rotate-180' : ''
                        }`}
                      />
                    </span>
                  </button>
                  {isExpanded && (
                    <div className="px-3.5 py-2.5 border-t border-sky-100/90 bg-white/95 text-sky-950 italic leading-relaxed animate-in fade-in duration-150">
                      “{thoughtContent}”
                    </div>
                  )}
                </div>
              );
            }

            const trimmedPart = part.trim();
            if (!trimmedPart) return null;

            const isQuote =
              trimmedPart.includes('「') ||
              trimmedPart.includes('」') ||
              trimmedPart.startsWith('“') ||
              trimmedPart.startsWith('"');

            return (
              <p
                key={partIdx}
                className={`my-1 text-slate-800 ${
                  isQuote ? 'font-medium text-slate-900 border-l-2 border-sky-400 pl-3 py-0.5' : ''
                }`}
              >
                {trimmedPart}
              </p>
            );
          })}
        </div>
      );
    });
  };

  return (
    <div className="relative flex flex-col h-screen h-[100dvh] max-w-2xl mx-auto bg-slate-50 overflow-hidden">
      {/* Top Header */}
      <header className="sticky top-0 z-30 px-3.5 py-2.5 bg-white/90 backdrop-blur-md border-b border-sky-100 flex items-center justify-between shadow-xs">
        <div className="flex items-center gap-2.5 min-w-0">
          <button
            onClick={onBack}
            className="p-1.5 -ml-1 rounded-xl text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors cursor-pointer"
            title="返回书架"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>

          <div className="min-w-0">
            <h1 className="text-xs sm:text-sm font-semibold text-slate-800 truncate">
              {currentSave.title}
            </h1>
            <div className="flex items-center gap-1.5 text-[10px] text-slate-400">
              <span className="truncate">
                {activeChars.map((c) => c.name).join('、') || '角色'}
              </span>
              <span>·</span>
              <span>
                {currentSave.config.targetWordCount === 'short'
                  ? '短篇'
                  : currentSave.config.targetWordCount === 'long'
                  ? '长篇'
                  : '中篇'}
              </span>
            </div>
          </div>
        </div>

        {/* Right Action: Drawer toggle */}
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            onClick={() => setDrawerOpen(true)}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-sky-50 hover:bg-sky-100/80 text-sky-700 text-xs font-medium border border-sky-200/80 transition-colors cursor-pointer"
          >
            <Sliders className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">数值与设定</span>
          </button>
        </div>
      </header>

      {/* Main Messages Container */}
      <main className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {/* Story Opening Card */}
        <div className="p-3.5 rounded-2xl bg-gradient-to-br from-white via-sky-50/30 to-blue-50/20 border border-sky-100/80 shadow-xs">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-sky-700 mb-1">
            <Sparkles className="w-3.5 h-3.5" />
            故事开局背景
          </div>
          <p className="text-xs text-slate-600 leading-relaxed font-novel">
            {currentSave.openingPremise}
          </p>
        </div>

        {/* Message List */}
        {currentSave.messages.map((msg, index) => {
          const isUser = msg.role === 'user';
          const isLastUserMsg = isUser && index === currentSave.messages.length - 1;
          const isLastAssistantMsg = !isUser && index === currentSave.messages.length - 1;
          const branches = msg.branches || [];
          const currentBranchIndex = msg.currentBranchIndex ?? 0;

          return (
            <div
              key={msg.id}
              className={`flex flex-col ${isUser ? 'items-end' : 'items-start'} space-y-1.5`}
            >
              {/* User Message */}
              {isUser ? (
                <div className="max-w-[88%] group relative">
                  {editingMsgIndex === index ? (
                    <div className="p-3 rounded-2xl bg-white border border-sky-400 shadow-md space-y-2">
                      <textarea
                        rows={3}
                        value={editingMsgText}
                        onChange={(e) => setEditingMsgText(e.target.value)}
                        className="w-full text-xs p-1 focus:outline-none border-b border-slate-100"
                        autoFocus
                      />
                      <div className="flex flex-wrap items-center justify-end gap-1.5 text-xs pt-1">
                        <button
                          type="button"
                          onClick={() => setEditingMsgIndex(null)}
                          className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors cursor-pointer"
                        >
                          取消
                        </button>
                        <button
                          type="button"
                          onClick={() => handleSaveUserMsgOnly(index)}
                          className="px-3 py-1 rounded-lg border border-sky-300 bg-sky-50 hover:bg-sky-100 text-sky-700 font-medium transition-colors cursor-pointer"
                          title="仅更新当前发言文本，不触发AI重新生成"
                        >
                          仅保存修改
                        </button>
                        <button
                          type="button"
                          disabled={isStreaming}
                          onClick={() => handleRerollFromUserMsg(index)}
                          className="px-3 py-1 rounded-lg bg-sky-500 hover:bg-sky-600 active:scale-95 text-white font-medium shadow-xs shadow-sky-200 transition-all flex items-center gap-1 cursor-pointer disabled:opacity-50"
                          title="保存修改并重新生成该轮后续剧情"
                        >
                          <RefreshCw className="w-3 h-3" />
                          保存并重roll
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="relative">
                      <div className="px-4 py-2.5 rounded-2xl rounded-tr-xs bg-sky-600 text-white text-xs shadow-xs leading-relaxed">
                        {msg.content}
                      </div>

                      {/* User action icons: separate edit and reroll */}
                      <div className="flex items-center justify-end gap-2 mt-1 text-[11px] text-slate-400 opacity-90">
                        <button
                          onClick={() => handleCopy(msg.id, msg.content)}
                          className="hover:text-sky-600 transition-colors p-0.5 flex items-center gap-0.5 cursor-pointer"
                          title="复制发言"
                        >
                          {copiedId === msg.id ? (
                            <Check className="w-3 h-3 text-emerald-500" />
                          ) : (
                            <Copy className="w-3 h-3" />
                          )}
                          <span>复制</span>
                        </button>
                        <button
                          onClick={() => {
                            setEditingMsgIndex(index);
                            setEditingMsgText(msg.content);
                          }}
                          className="hover:text-sky-600 transition-colors p-0.5 flex items-center gap-0.5 cursor-pointer"
                          title="仅编辑修改当前发言"
                        >
                          <Edit2 className="w-3 h-3" />
                          <span>编辑</span>
                        </button>
                        <button
                          disabled={isStreaming}
                          onClick={() => handleRerollFromUserMsg(index)}
                          className="hover:text-sky-600 transition-colors p-0.5 flex items-center gap-0.5 cursor-pointer disabled:opacity-50"
                          title="以该条发言重新生成后续剧情"
                        >
                          <RefreshCw className="w-3 h-3" />
                          <span>以此重roll</span>
                        </button>
                        {confirmDeleteMsgIndex === index ? (
                          <span className="flex items-center gap-1 bg-rose-50 text-rose-600 px-1.5 py-0.5 rounded border border-rose-200">
                            <span>删除此段?</span>
                            <button
                              onClick={() => handleDeleteMessage(index)}
                              className="font-bold text-rose-700 hover:underline px-0.5 cursor-pointer"
                            >
                              确定
                            </button>
                            <button
                              onClick={() => setConfirmDeleteMsgIndex(null)}
                              className="text-slate-500 hover:underline px-0.5 cursor-pointer"
                            >
                              取消
                            </button>
                          </span>
                        ) : (
                          <button
                            onClick={() => setConfirmDeleteMsgIndex(index)}
                            className="hover:text-rose-600 transition-colors p-0.5 flex items-center gap-0.5 cursor-pointer text-slate-400"
                            title="删除这段话"
                          >
                            <Trash2 className="w-3 h-3" />
                            <span>删除</span>
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                /* Assistant Narrative Block */
                <div className="w-full space-y-2">
                  <div className="w-full p-4 rounded-2xl bg-white border border-sky-100/80 shadow-xs space-y-3">
                    {/* Main Story Narrative Prose (with inline collapsible thoughts where they occur) */}
                    <div
                      className={`text-slate-800 ${fontClass} ${fontSizeClass} ${lineSpacingClass}`}
                    >
                      {renderFormattedProse(msg.content, msg.id)}
                    </div>

                    {/* Numerical Stats Delta Badge - Separated by character & Folded by default */}
                    {(() => {
                      let charDeltas: Record<string, Record<string, number>> = msg.statsDeltaByCharacter || {};

                      if (
                        Object.keys(charDeltas).length === 0 &&
                        msg.statsDelta &&
                        Object.keys(msg.statsDelta).length > 0
                      ) {
                        const defaultCharName = activeChars[0]?.name || '角色';
                        charDeltas = { [defaultCharName]: msg.statsDelta };
                      }

                      const charNames = Object.keys(charDeltas).filter(
                        (cName) => Object.keys(charDeltas[cName]).length > 0
                      );
                      if (charNames.length === 0) return null;

                      const isExpanded = !!expandedMessageStats[msg.id];

                      return (
                        <div className="pt-2 border-t border-slate-100">
                          <button
                            type="button"
                            onClick={() => toggleMsgStats(msg.id)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-sky-50/80 hover:bg-sky-100/80 border border-sky-200/80 text-sky-800 text-xs font-medium transition-all cursor-pointer select-none shadow-2xs active:scale-95"
                          >
                            <span>📊</span>
                            <span>本轮数值变动（{charNames.join('、')}）</span>
                            <span className="text-[11px] text-sky-600 font-semibold flex items-center gap-0.5 ml-1">
                              {isExpanded ? '收起' : '点击展开查看'}
                              <ChevronDown
                                className={`w-3.5 h-3.5 transition-transform duration-200 ${
                                  isExpanded ? 'rotate-180' : ''
                                }`}
                              />
                            </span>
                          </button>

                          {isExpanded && (
                            <div className="mt-2 p-2.5 rounded-xl bg-slate-50/90 border border-slate-200/80 space-y-2.5 animate-in fade-in duration-150">
                              {charNames.map((charName) => {
                                const deltas = charDeltas[charName];
                                return (
                                  <div key={charName} className="space-y-1">
                                    <div className="text-[11px] font-semibold text-slate-700 flex items-center gap-1.5">
                                      <span className="w-1.5 h-1.5 rounded-full bg-sky-500" />
                                      <span>{charName}</span>
                                    </div>
                                    <div className="flex flex-wrap items-center gap-1.5 pl-3">
                                      {Object.entries(deltas).map(([statName, delta]) => {
                                        const isLove = statName === '好感度' || statName === '爱慕值';
                                        return (
                                          <span
                                            key={statName}
                                            className={`px-2 py-0.5 rounded-md text-[10px] font-semibold border flex items-center gap-1 ${
                                              isLove
                                                ? delta > 0
                                                  ? 'bg-rose-50 text-rose-700 border-rose-200'
                                                  : 'bg-slate-50 text-slate-600 border-slate-200'
                                                : delta > 0
                                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                                : 'bg-rose-50 text-rose-700 border-rose-200'
                                            }`}
                                          >
                                            {statName === '好感度' && '❤️ '}
                                            {statName === '爱慕值' && '💖 '}
                                            {statName} {delta > 0 ? `+${delta}` : delta}
                                          </span>
                                        );
                                      })}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })()}

                    {/* Bottom AI Toolbar: Branch Navigation & Regeneration */}
                    <div className="pt-2 border-t border-slate-50 flex items-center justify-between text-xs text-slate-400">
                      {/* Branch Navigator */}
                      {branches.length > 1 ? (
                        <div className="flex items-center gap-1.5 bg-slate-50 px-2 py-0.5 rounded-lg border border-slate-200">
                          <button
                            disabled={currentBranchIndex <= 0}
                            onClick={() => handleSwitchBranch(index, currentBranchIndex - 1)}
                            className="disabled:opacity-30 hover:text-sky-600"
                            title="上一分支"
                          >
                            <ChevronLeft className="w-3.5 h-3.5" />
                          </button>
                          <span className="text-[11px] font-medium text-slate-600">
                            分支 {currentBranchIndex + 1}/{branches.length}
                          </span>
                          <button
                            disabled={currentBranchIndex >= branches.length - 1}
                            onClick={() => handleSwitchBranch(index, currentBranchIndex + 1)}
                            className="disabled:opacity-30 hover:text-sky-600"
                            title="下一分支"
                          >
                            <ChevronRight className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <div />
                      )}

                      {/* Actions */}
                      <div className="flex items-center gap-2 text-[11px]">
                        <button
                          onClick={() => handleCopy(msg.id, msg.content)}
                          className="hover:text-sky-600 flex items-center gap-0.5 transition-colors cursor-pointer"
                        >
                          {copiedId === msg.id ? (
                            <Check className="w-3.5 h-3.5 text-emerald-500" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                          复制
                        </button>
                        <button
                          disabled={isStreaming}
                          onClick={() => handleRegenerate(index)}
                          className="hover:text-sky-600 flex items-center gap-0.5 transition-colors cursor-pointer disabled:opacity-50"
                          title="保留原有剧情，生成新的备选剧情分支"
                        >
                          <RefreshCw className="w-3.5 h-3.5" />
                          重选分支
                        </button>
                        {isLastAssistantMsg && (
                          <button
                            disabled={isStreaming}
                            onClick={handleContinueGeneration}
                            className="hover:text-sky-600 flex items-center gap-0.5 transition-colors cursor-pointer disabled:opacity-50"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            继续生成
                          </button>
                        )}
                        {confirmDeleteMsgIndex === index ? (
                          <span className="flex items-center gap-1 bg-rose-50 text-rose-600 px-1.5 py-0.5 rounded border border-rose-200 text-[10px]">
                            <span>删除此段?</span>
                            <button
                              onClick={() => handleDeleteMessage(index)}
                              className="font-bold text-rose-700 hover:underline px-0.5 cursor-pointer"
                            >
                              确定
                            </button>
                            <button
                              onClick={() => setConfirmDeleteMsgIndex(null)}
                              className="text-slate-500 hover:underline px-0.5 cursor-pointer"
                            >
                              取消
                            </button>
                          </span>
                        ) : (
                          <button
                            onClick={() => setConfirmDeleteMsgIndex(index)}
                            className="hover:text-rose-600 flex items-center gap-0.5 transition-colors cursor-pointer text-slate-400"
                            title="删除这段话"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            删除
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Suggested Branch Action Pills (点击追加填入对话框，支持多选拼接) */}
                  {isLastAssistantMsg &&
                    currentSave.config.branchChoicesEnabled &&
                    msg.suggestedBranches &&
                    msg.suggestedBranches.length > 0 &&
                    !isStreaming && (
                      <div className="space-y-1.5 pt-1">
                        <div className="text-[11px] font-medium text-slate-400 px-1 flex items-center gap-1">
                          <Compass className="w-3.5 h-3.5 text-sky-500" />
                          剧情行动选项（点击填入输入框，可多次点击追加后二次修改）：
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {msg.suggestedBranches.map((choice, cIdx) => (
                            <button
                              key={cIdx}
                              type="button"
                              onClick={() => handleAppendOptionToInput(choice)}
                              className="px-3 py-1.5 rounded-xl bg-white border border-sky-200 hover:border-sky-400 hover:bg-sky-50 text-slate-700 hover:text-sky-700 text-xs font-medium shadow-xs transition-all text-left active:scale-95 cursor-pointer flex items-center gap-1.5 group"
                              title="点击将此选项追加填入下方输入框，方便您修改补充"
                            >
                              <span className="text-sky-500 font-bold text-xs group-hover:scale-110 transition-transform">+</span>
                              <span>{choice}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                </div>
              )}
            </div>
          );
        })}

        {/* Live Streaming Response Card */}
        {isStreaming && (
          <div className="w-full p-4 rounded-2xl bg-white border border-sky-200 shadow-sm space-y-3 animate-in fade-in duration-150">
            <div className="flex items-center gap-2 text-xs font-semibold text-sky-600">
              <span className="w-2 h-2 rounded-full bg-sky-500 animate-ping" />
              正在谱写剧情中...
            </div>
            <div
              className={`text-slate-800 ${fontClass} ${fontSizeClass} ${lineSpacingClass} opacity-95`}
            >
              {renderFormattedProse(streamingContent || '正在构思剧情发展...')}
            </div>
          </div>
        )}

        {/* Error notice */}
        {errorMessage && (
          <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs space-y-1">
            <div className="font-semibold flex items-center gap-1.5">
              <span>⚠️ 生成遇到问题</span>
            </div>
            <div className="text-[11px] leading-relaxed">{errorMessage}</div>
          </div>
        )}

        <div ref={messagesEndRef} className="h-2" />
      </main>

      {/* Fixed Bottom Input Bar */}
      <footer className="sticky bottom-0 z-30 p-2.5 sm:p-3 bg-white/95 backdrop-blur-md border-t border-sky-100 shadow-[0_-2px_10px_rgba(186,230,253,0.15)] safe-area-pb">
        <div className="flex flex-col gap-1.5">
          {/* Controls pill row */}
          <div className="flex items-center justify-between text-[11px] text-slate-400 px-1">
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => {
                  const nextMode = currentSave.config.playMode === 'director' ? 'dialogue' : 'director';
                  commitSave({
                    ...currentSave,
                    config: { ...currentSave.config, playMode: nextMode },
                  });
                }}
                className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border flex items-center gap-1 transition-colors cursor-pointer ${
                  currentSave.config.playMode === 'director'
                    ? 'bg-amber-50 text-amber-700 border-amber-300 hover:bg-amber-100'
                    : 'bg-sky-50 text-sky-700 border-sky-300 hover:bg-sky-100'
                }`}
                title="点击快捷切换对话模式/导演模式"
              >
                <span>{currentSave.config.playMode === 'director' ? '🎬 导演模式' : '💬 对话模式'}</span>
              </button>
              <span className="text-[10px] text-slate-400 hidden xs:inline">
                {currentSave.config.playMode === 'director' ? '场景指导推演' : '直接承接对话'}
              </span>
            </div>

            {/* Target length or word count indicator */}
            <div className="flex items-center gap-1">
              {currentSave.config.wordCountConstraintEnabled ? (
                <button
                  type="button"
                  onClick={() => {
                    setActiveDrawerTab('settings');
                    setDrawerOpen(true);
                  }}
                  className="px-2 py-0.5 rounded-full bg-sky-50 text-sky-700 border border-sky-200 text-[10px] font-medium cursor-pointer hover:bg-sky-100 transition-colors"
                  title="点击在游玩设置中修改字数区间"
                >
                  字数: {currentSave.config.wordCountMin ?? 300}-{currentSave.config.wordCountMax ?? 800}字
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setActiveDrawerTab('settings');
                    setDrawerOpen(true);
                  }}
                  className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 border border-slate-200 text-[10px] cursor-pointer hover:bg-slate-200 transition-colors"
                  title="字数未限制，AI自主发挥。点击可设置字数"
                >
                  AI自由发挥字数
                </button>
              )}
            </div>
          </div>

          {/* Input Box Row */}
          <div className="flex items-end gap-2">
            <div className="relative flex-1 bg-slate-50 border border-slate-200 rounded-2xl focus-within:border-sky-400 focus-within:bg-white focus-within:ring-1 focus-within:ring-sky-400 transition-all">
              <textarea
                ref={inputRef}
                rows={2}
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage();
                  }
                }}
                placeholder={
                  currentSave.config.playMode === 'director'
                    ? '【导演模式】输入场景走向、剧情指示或环境事件指导...'
                    : '输入你的行动、台词或抉择（如：警惕地拔出腰间短刃，缓步靠近石棺...）'
                }
                className="w-full p-2.5 text-xs text-slate-800 placeholder:text-slate-400 bg-transparent resize-none focus:outline-none leading-relaxed"
              />
            </div>

            {/* Send or Stop button */}
            {isStreaming ? (
              <button
                type="button"
                onClick={handleStopGeneration}
                className="w-10 h-10 rounded-2xl bg-rose-500 hover:bg-rose-600 active:scale-95 text-white flex items-center justify-center shadow-sm shadow-rose-200 transition-all cursor-pointer shrink-0"
                title="停止生成"
              >
                <Square className="w-4 h-4 fill-current" />
              </button>
            ) : (
              <button
                type="button"
                disabled={!inputText.trim()}
                onClick={() => handleSendMessage()}
                className="w-10 h-10 rounded-2xl bg-sky-500 hover:bg-sky-600 active:scale-95 disabled:opacity-40 text-white flex items-center justify-center shadow-sm shadow-sky-200 transition-all cursor-pointer shrink-0"
                title="发送行动"
              >
                <Send className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </footer>

      {/* Slide-out Drawer: Stats, Characters, Worldbook, Settings */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/30 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="w-full max-w-sm bg-white h-full shadow-2xl flex flex-col border-l border-sky-100">
            {/* Drawer Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
              <span className="font-semibold text-xs text-slate-800">文游面板与实时数值</span>
              <button
                onClick={() => setDrawerOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Drawer Tabs */}
            <div className="flex border-b border-slate-100 text-xs">
              <button
                onClick={() => setActiveDrawerTab('stats')}
                className={`flex-1 py-2 text-center font-medium border-b-2 transition-all ${
                  activeDrawerTab === 'stats'
                    ? 'border-sky-500 text-sky-600'
                    : 'border-transparent text-slate-500 hover:text-slate-700'
                }`}
              >
                数值状态
              </button>
              <button
                onClick={() => setActiveDrawerTab('characters')}
                className={`flex-1 py-2 text-center font-medium border-b-2 transition-all ${
                  activeDrawerTab === 'characters'
                    ? 'border-sky-500 text-sky-600'
                    : 'border-transparent text-slate-500 hover:text-slate-700'
                }`}
              >
                登场角色
              </button>
              <button
                onClick={() => setActiveDrawerTab('worldbook')}
                className={`flex-1 py-2 text-center font-medium border-b-2 transition-all ${
                  activeDrawerTab === 'worldbook'
                    ? 'border-sky-500 text-sky-600'
                    : 'border-transparent text-slate-500 hover:text-slate-700'
                }`}
              >
                世界观
              </button>
              <button
                onClick={() => setActiveDrawerTab('settings')}
                className={`flex-1 py-2 text-center font-medium border-b-2 transition-all ${
                  activeDrawerTab === 'settings'
                    ? 'border-sky-500 text-sky-600'
                    : 'border-transparent text-slate-500 hover:text-slate-700'
                }`}
              >
                游玩设置
              </button>
            </div>

            {/* Drawer Content */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs">
              {/* Tab 1: Stats (Per-character status toggle & collapsible attributes) */}
              {activeDrawerTab === 'stats' && (
                <div className="space-y-3">
                  {!currentSave.config.statsTrackingEnabled && (
                    <div className="p-2.5 rounded-xl bg-sky-50 border border-sky-200/80 text-sky-800 text-[11px] flex items-center justify-between">
                      <span>后台持续实时记录中</span>
                      <button
                        onClick={() => {
                          const next = {
                            ...currentSave,
                            config: { ...currentSave.config, statsTrackingEnabled: true },
                          };
                          commitSave(next);
                        }}
                        className="px-2 py-0.5 bg-sky-500 hover:bg-sky-600 text-white rounded text-[10px] font-medium transition-colors cursor-pointer"
                      >
                        开启前台展示
                      </button>
                    </div>
                  )}

                  {/* Active User Mask indicator or Observer Mode */}
                  {!isMaskEnabled ? (
                    <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/80 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-base shrink-0 opacity-60">🎭</span>
                        <div className="min-w-0">
                          <div className="font-semibold text-slate-700 text-[11px] truncate">
                            玩家面具：已关闭 (观察者/客观视角)
                          </div>
                          <div className="text-[10px] text-slate-400 truncate">
                            User 不作为角色直接介入，纯群像推进
                          </div>
                        </div>
                      </div>
                      {userMasks && userMasks.length > 0 && (
                        <button
                          type="button"
                          onClick={() => {
                            const firstMask = userMasks[0];
                            const next = {
                              ...currentSave,
                              userMaskId: firstMask.id,
                              config: { ...currentSave.config, userMaskEnabled: true },
                            };
                            commitSave(next);
                          }}
                          className="px-2 py-1 rounded-lg bg-sky-50 hover:bg-sky-100 text-sky-700 font-medium text-[10px] border border-sky-200/70 shrink-0 cursor-pointer transition-colors"
                        >
                          佩戴面具参演
                        </button>
                      )}
                    </div>
                  ) : activeUserMask ? (
                    <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/80 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-base shrink-0">🎭</span>
                        <div className="min-w-0">
                          <div className="font-semibold text-slate-800 text-[11px] truncate flex items-center gap-1">
                            <span>玩家面具：{activeUserMask.name}</span>
                            {activeUserMask.codeName && (
                              <span className="text-[10px] text-sky-600 font-normal">
                                ({activeUserMask.codeName})
                              </span>
                            )}
                          </div>
                          <div className="text-[10px] text-slate-400 truncate">
                            {activeUserMask.identity || activeUserMask.nickname ? `身份: ${activeUserMask.identity || '自由旅人'}` : (activeUserMask.gender || '通用旅人人设')}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {userMasks && userMasks.length > 1 && (
                          <select
                            value={activeUserMask.id}
                            onChange={(e) => {
                              const nextMaskId = e.target.value;
                              const next = { ...currentSave, userMaskId: nextMaskId };
                              commitSave(next);
                            }}
                            title="切换当前剧情生效的面具人设"
                            className="text-[10px] bg-white border border-slate-200 rounded-lg px-2 py-1 text-slate-600 focus:outline-none focus:border-sky-400 cursor-pointer"
                          >
                            {userMasks.map((m) => (
                              <option key={m.id} value={m.id}>
                                {m.name}{m.codeName ? ` (${m.codeName})` : ''}
                              </option>
                            ))}
                          </select>
                        )}
                        <button
                          type="button"
                          onClick={() => {
                            const next = {
                              ...currentSave,
                              userMaskId: undefined,
                              config: { ...currentSave.config, userMaskEnabled: false },
                            };
                            commitSave(next);
                          }}
                          title="卸下面具（转为观察者旁白视角）"
                          className="px-1.5 py-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200 text-[10px] cursor-pointer transition-colors"
                        >
                          卸下
                        </button>
                      </div>
                    </div>
                  ) : null}

                  <div className="text-[11px] text-slate-400">
                    各登场角色的实时状况与独立属性数值：
                  </div>

                  {activeChars.length === 0 ? (
                    <div className="py-8 text-center text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                      本存档未配置任何登场角色
                    </div>
                  ) : (
                    activeChars.map((char) => {
                      const isCharDisabled = currentSave.disabledCharacterStatIds?.includes(char.id);
                      const isRecalcPending = currentSave.recalcPendingCharacterIds?.includes(char.id);
                      const isExpanded = expandedCharacterCards[char.id] ?? (activeChars.length === 1);

                      const charStats = currentSave.stats.filter(
                        (s) =>
                          (s.characterId === char.id ||
                            (!s.characterId && s.characterName?.includes(char.name))) &&
                          s.enabled
                      );

                      const mentalStat = charStats.find((s) => s.name.includes('精神'));
                      const isMentalBroken = mentalStat !== undefined && mentalStat.currentValue <= 0;

                      return (
                        <div
                          key={char.id}
                          className={`rounded-2xl border shadow-2xs overflow-hidden transition-all ${
                            isMentalBroken
                              ? 'border-rose-500 ring-2 ring-rose-400 bg-rose-50/20'
                              : 'border-slate-200/90 bg-white'
                          }`}
                        >
                          {/* Character Card Header: Click to expand attributes */}
                          <div
                            onClick={() => toggleCharCard(char.id)}
                            className="p-3 bg-slate-50/70 hover:bg-slate-100/60 flex items-center justify-between gap-2.5 cursor-pointer select-none transition-colors"
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <div className="w-8 h-8 rounded-lg bg-sky-100 text-sky-700 flex items-center justify-center font-bold text-xs shrink-0 overflow-hidden border border-sky-200">
                                {char.avatarImage ? (
                                  <img
                                    src={char.avatarImage}
                                    alt={char.name}
                                    className="w-full h-full object-cover"
                                  />
                                ) : (
                                  <span>{char.name.slice(0, 1)}</span>
                                )}
                              </div>
                              <div className="min-w-0">
                                <div className="font-semibold text-slate-800 text-xs truncate">
                                  {char.name}
                                </div>
                                <div className="text-[10px] text-slate-400 truncate">
                                  {char.identity}
                                </div>
                              </div>
                            </div>

                            {/* Status toggle & Expand chevron */}
                            <div className="flex items-center gap-2 shrink-0">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleToggleCharacterStatus(char.id);
                                }}
                                className={`px-2.5 py-1 rounded-full text-[10px] font-semibold border transition-all cursor-pointer flex items-center gap-1 active:scale-95 ${
                                  !isCharDisabled
                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-300 hover:bg-emerald-100'
                                    : 'bg-slate-100 text-slate-500 border-slate-300 hover:bg-slate-200'
                                }`}
                                title={!isCharDisabled ? '点击关闭该角色状况追踪（关闭后后台不记录数值）' : '点击开启该角色状况追踪（将根据剧情重算数值）'}
                              >
                                <span
                                  className={`w-1.5 h-1.5 rounded-full ${
                                    !isCharDisabled ? 'bg-emerald-500' : 'bg-slate-400'
                                  }`}
                                />
                                <span>{!isCharDisabled ? '状况：开启' : '状况：已关闭'}</span>
                              </button>

                              <span className="text-[10px] text-sky-600 font-medium hidden sm:inline">
                                {isExpanded ? '收起属性' : '展开属性'}
                              </span>

                              <ChevronDown
                                className={`w-4 h-4 text-sky-500 transition-transform duration-200 ${
                                  isExpanded ? 'rotate-180' : ''
                                }`}
                              />
                            </div>
                          </div>

                          {/* Expanded Attributes Panel */}
                          {isExpanded && (
                            <div className="p-3 border-t border-slate-100 space-y-2.5">
                              {isCharDisabled ? (
                                <div className="py-3 px-3 rounded-xl bg-slate-50 border border-dashed border-slate-200 text-center space-y-1">
                                  <p className="text-xs font-semibold text-slate-600">
                                    该角色状况已关闭 · 后台暂不记录其数值
                                  </p>
                                  <p className="text-[10px] text-slate-400 leading-relaxed">
                                    点击右上方“开启”后，AI将在下轮交互中根据剧情上下文自动重新计算该角色的最新数值
                                  </p>
                                </div>
                              ) : (
                                <>
                                  {isRecalcPending && (
                                    <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-[11px] flex items-center gap-1.5 font-medium">
                                      <span>⏳</span>
                                      <span>
                                        已重新开启状况追踪，将在下轮交互中根据剧情上下文自动重新计算该角色数值...
                                      </span>
                                    </div>
                                  )}

                                  {charStats.length === 0 ? (
                                    <div className="py-3 text-center text-slate-400 text-xs">
                                      暂无独立属性
                                    </div>
                                  ) : (
                                    charStats.map((stat) => {
                                      const isAffection100 =
                                        stat.name === '好感度' && stat.currentValue >= 100;
                                      const isAdoration = stat.name === '爱慕值';
                                      const percent = Math.min(
                                        100,
                                        Math.max(
                                          0,
                                          ((stat.currentValue - stat.minValue) /
                                            (stat.maxValue - stat.minValue)) *
                                            100
                                        )
                                      );

                                      if (isAffection100) {
                                        return (
                                          <div
                                            key={stat.id}
                                            className="p-2.5 rounded-xl bg-gradient-to-r from-rose-50/95 via-pink-50/70 to-rose-50/95 border-2 border-rose-400 ring-2 ring-rose-200/80 shadow-2xs space-y-1 relative overflow-hidden"
                                          >
                                            <div className="flex items-center justify-between">
                                              <div className="flex items-center gap-1.5">
                                                <span className="text-rose-500 text-xs animate-pulse">
                                                  ❤️
                                                </span>
                                                <span className="font-semibold text-rose-900 text-xs">
                                                  {stat.name}
                                                </span>
                                                <span className="text-[9px] font-bold px-1.5 py-0.2 rounded-full bg-rose-500 text-white shadow-2xs">
                                                  爱心锁定 · 100%
                                                </span>
                                              </div>
                                              <div className="flex items-center gap-1">
                                                {stat.lastDelta !== undefined && stat.lastDelta !== 0 && (
                                                  <span
                                                    className={`text-[9px] font-bold ${
                                                      stat.lastDelta > 0
                                                        ? 'text-emerald-600'
                                                        : 'text-rose-600'
                                                    }`}
                                                  >
                                                    ({stat.lastDelta > 0
                                                      ? `+${stat.lastDelta}`
                                                      : stat.lastDelta})
                                                  </span>
                                                )}
                                                <span className="font-bold text-rose-600 text-xs">
                                                  100 / 100 {stat.unit}
                                                </span>
                                              </div>
                                            </div>

                                            <div className="w-full h-1.5 rounded-full bg-rose-200/80 overflow-hidden">
                                              <div
                                                className="h-full bg-gradient-to-r from-rose-400 to-pink-500 rounded-full"
                                                style={{ width: '100%' }}
                                              />
                                            </div>
                                          </div>
                                        );
                                      }

                                      if (isAdoration) {
                                        return (
                                          <div
                                            key={stat.id}
                                            className="p-2.5 rounded-xl bg-gradient-to-r from-pink-50/90 via-rose-50/60 to-purple-50/40 border-2 border-pink-300 ring-1 ring-pink-200 space-y-1 shadow-2xs"
                                          >
                                            <div className="flex items-center justify-between">
                                              <div className="flex items-center gap-1.5">
                                                <span className="text-pink-500 text-xs">💖</span>
                                                <span className="font-semibold text-pink-900 text-xs">
                                                  {stat.name}
                                                </span>
                                                <span className="text-[9px] font-bold px-1.5 py-0.2 rounded-full bg-pink-100 text-pink-700 border border-pink-200">
                                                  极度倾慕
                                                </span>
                                              </div>
                                              <div className="flex items-center gap-1">
                                                {stat.lastDelta !== undefined && stat.lastDelta !== 0 && (
                                                  <span
                                                    className={`text-[9px] font-bold ${
                                                      stat.lastDelta > 0
                                                        ? 'text-emerald-600'
                                                        : 'text-rose-600'
                                                    }`}
                                                  >
                                                    ({stat.lastDelta > 0
                                                      ? `+${stat.lastDelta}`
                                                      : stat.lastDelta})
                                                  </span>
                                                )}
                                                <span className="font-bold text-pink-600 text-xs">
                                                  {stat.currentValue} / {stat.maxValue} {stat.unit}
                                                </span>
                                              </div>
                                            </div>

                                            <div className="w-full h-1.5 rounded-full bg-pink-100 overflow-hidden">
                                              <div
                                                className="h-full bg-gradient-to-r from-pink-400 to-rose-500 rounded-full"
                                                style={{ width: `${percent}%` }}
                                              />
                                            </div>
                                          </div>
                                        );
                                      }

                                      return (
                                        <div
                                          key={stat.id}
                                          className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/80 space-y-1"
                                        >
                                          <div className="flex items-center justify-between">
                                            <span className="font-semibold text-slate-800 text-xs">
                                              {stat.name}
                                            </span>
                                            <div className="flex items-center gap-1">
                                              {stat.lastDelta !== undefined && stat.lastDelta !== 0 && (
                                                <span
                                                  className={`text-[9px] font-bold ${
                                                    stat.lastDelta > 0
                                                      ? 'text-emerald-600'
                                                      : 'text-rose-600'
                                                  }`}
                                                >
                                                  ({stat.lastDelta > 0
                                                    ? `+${stat.lastDelta}`
                                                    : stat.lastDelta})
                                                </span>
                                              )}
                                              <span className="font-bold text-sky-600 text-xs">
                                                {stat.currentValue} / {stat.maxValue} {stat.unit}
                                              </span>
                                            </div>
                                          </div>

                                          <div className="w-full h-1.5 rounded-full bg-slate-200 overflow-hidden">
                                            <div
                                              className="h-full bg-gradient-to-r from-sky-400 to-sky-600 rounded-full"
                                              style={{ width: `${percent}%` }}
                                            />
                                          </div>
                                        </div>
                                      );
                                    })
                                  )}
                                </>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              )}

              {/* Tab 2: Characters */}
              {activeDrawerTab === 'characters' && (
                <div className="space-y-3">
                  {activeChars.map((char) => (
                    <div
                      key={char.id}
                      className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/50 space-y-2"
                    >
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-sky-100 text-sky-700 flex items-center justify-center font-bold text-xs shrink-0 overflow-hidden border border-sky-200">
                          {char.avatarImage ? (
                            <img src={char.avatarImage} alt={char.name} className="w-full h-full object-cover" />
                          ) : (
                            <span>{char.name.slice(0, 1)}</span>
                          )}
                        </div>
                        <div>
                          <div className="font-semibold text-slate-800">{char.name}</div>
                          <div className="text-[10px] text-slate-400">
                            {char.identity} · {char.gender}
                          </div>
                        </div>
                      </div>

                      <div className="space-y-1 text-[11px] text-slate-600">
                        <p>
                          <span className="font-medium text-slate-400">性格：</span>
                          {char.personality}
                        </p>
                        <p>
                          <span className="font-medium text-slate-400">外貌：</span>
                          {char.appearance}
                        </p>
                        <p>
                          <span className="font-medium text-slate-400">语气：</span>
                          {char.speechStyle}
                        </p>
                        {char.customNotes && (
                          <p className="text-amber-800 bg-amber-50/80 p-1.5 rounded-lg border border-amber-200/60">
                            <span className="font-medium">暗线：</span>
                            {char.customNotes}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Tab 3: Worldbook */}
              {activeDrawerTab === 'worldbook' && (
                <div className="space-y-3">
                  {activeWorldBook ? (
                    <div>
                      <div className="font-semibold text-slate-800 text-xs mb-1">
                        《{activeWorldBook.title}》
                      </div>
                      <p className="text-[11px] text-slate-500 mb-3">
                        {activeWorldBook.description}
                      </p>

                      <div className="space-y-2">
                        {activeWorldBook.entries
                          .filter((e) => e.enabled)
                          .map((entry) => (
                            <div
                              key={entry.id}
                              className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1"
                            >
                              <div className="font-semibold text-slate-700 text-xs">
                                {entry.name}
                              </div>
                              <p className="text-[11px] text-slate-600 leading-relaxed">
                                {entry.content}
                              </p>
                            </div>
                          ))}
                      </div>
                    </div>
                  ) : (
                    <div className="py-8 text-center text-slate-400">本存档未关联世界书</div>
                  )}
                </div>
              )}

              {/* Tab 4: In-game Settings */}
              {activeDrawerTab === 'settings' && (
                <div className="space-y-3.5">
                  {/* 1. 对话模式 vs 导演模式 */}
                  <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
                    <div className="font-semibold text-slate-800 text-xs">交互模式</div>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          const next = {
                            ...currentSave,
                            config: { ...currentSave.config, playMode: 'dialogue' as const },
                          };
                          commitSave(next);
                        }}
                        className={`py-2 px-2 rounded-xl border text-center transition-all cursor-pointer ${
                          (currentSave.config.playMode || 'dialogue') === 'dialogue'
                            ? 'border-sky-500 bg-sky-50 text-sky-700 shadow-2xs font-semibold'
                            : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                        }`}
                      >
                        <div className="text-xs">💬 对话模式</div>
                        <div className="text-[10px] text-slate-400 mt-0.5">直接承接发言</div>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          const next = {
                            ...currentSave,
                            config: { ...currentSave.config, playMode: 'director' as const },
                          };
                          commitSave(next);
                        }}
                        className={`py-2 px-2 rounded-xl border text-center transition-all cursor-pointer ${
                          currentSave.config.playMode === 'director'
                            ? 'border-sky-500 bg-sky-50 text-sky-700 shadow-2xs font-semibold'
                            : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                        }`}
                      >
                        <div className="text-xs">🎬 导演模式</div>
                        <div className="text-[10px] text-slate-400 mt-0.5">发言作场景指导</div>
                      </button>
                    </div>
                  </div>

                  {/* 2. 防抢话开关 */}
                  <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200">
                    <label className="flex items-center justify-between cursor-pointer">
                      <div className="pr-2">
                        <div className="font-semibold text-slate-800 text-xs">防抢话开关</div>
                        <div className="text-[10px] text-slate-400">
                          {currentSave.config.antiImpersonationEnabled !== false
                            ? '开启：严禁代替玩家发言、决策与行动'
                            : '关闭：允许AI适度代入或自然顺承玩家言行'}
                        </div>
                      </div>
                      <input
                        type="checkbox"
                        checked={currentSave.config.antiImpersonationEnabled !== false}
                        onChange={(e) => {
                          const next = {
                            ...currentSave,
                            config: {
                              ...currentSave.config,
                              antiImpersonationEnabled: e.target.checked,
                            },
                          };
                          commitSave(next);
                        }}
                        className="accent-sky-500 w-4 h-4 rounded cursor-pointer shrink-0"
                      />
                    </label>
                  </div>

                  {/* 3. 人称代词选择 */}
                  <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
                    <div className="font-semibold text-slate-800 text-xs">人称代词选择</div>
                    <div className="grid grid-cols-3 gap-1.5">
                      {[
                        { key: 'first', label: '第一人称', sub: '使用“我”' },
                        { key: 'second', label: '第二人称', sub: '使用“你”' },
                        { key: 'third', label: '第三人称', sub: '使用他/她' },
                      ].map((item) => {
                        const currentPerspective = currentSave.config.narrativePerspective || 'second';
                        const isSelected = currentPerspective === item.key;
                        return (
                          <button
                            key={item.key}
                            type="button"
                            onClick={() => {
                              const next = {
                                ...currentSave,
                                config: {
                                  ...currentSave.config,
                                  narrativePerspective: item.key as any,
                                },
                              };
                              commitSave(next);
                            }}
                            className={`py-2 px-1 rounded-xl border text-center transition-all cursor-pointer ${
                              isSelected
                                ? 'border-sky-500 bg-sky-50 text-sky-700 font-semibold shadow-2xs'
                                : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                            }`}
                          >
                            <div className="text-xs">{item.label}</div>
                            <div className="text-[10px] text-slate-400 mt-0.5">{item.sub}</div>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* 4. 每次输出字数（开关 + 填入多少字到多少字） */}
                  <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200 space-y-2.5">
                    <label className="flex items-center justify-between cursor-pointer">
                      <div className="pr-2">
                        <div className="font-semibold text-slate-800 text-xs">每次输出字数限制</div>
                        <div className="text-[10px] text-slate-400">
                          {currentSave.config.wordCountConstraintEnabled
                            ? '已开启：AI每次输出遵循填入字数'
                            : '已关闭：AI自主发挥，不受字数限制'}
                        </div>
                      </div>
                      <input
                        type="checkbox"
                        checked={!!currentSave.config.wordCountConstraintEnabled}
                        onChange={(e) => {
                          const next = {
                            ...currentSave,
                            config: {
                              ...currentSave.config,
                              wordCountConstraintEnabled: e.target.checked,
                              wordCountMin: currentSave.config.wordCountMin ?? 300,
                              wordCountMax: currentSave.config.wordCountMax ?? 800,
                            },
                          };
                          commitSave(next);
                        }}
                        className="accent-sky-500 w-4 h-4 rounded cursor-pointer shrink-0"
                      />
                    </label>

                    {currentSave.config.wordCountConstraintEnabled && (
                      <div className="pt-2 border-t border-slate-200/70 space-y-2 animate-in fade-in duration-150">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-slate-600 text-[11px] shrink-0">每轮：</span>
                          <input
                            type="number"
                            min={50}
                            max={5000}
                            step={50}
                            value={currentSave.config.wordCountMin ?? 300}
                            onChange={(e) => {
                              const val = Math.max(50, parseInt(e.target.value) || 50);
                              const next = {
                                ...currentSave,
                                config: { ...currentSave.config, wordCountMin: val },
                              };
                              commitSave(next);
                            }}
                            className="w-18 px-2 py-1 bg-white border border-slate-300 rounded-lg text-center text-xs text-slate-800 focus:outline-none focus:border-sky-500"
                          />
                          <span className="text-slate-500 text-[11px]">字 至</span>
                          <input
                            type="number"
                            min={100}
                            max={10000}
                            step={50}
                            value={currentSave.config.wordCountMax ?? 800}
                            onChange={(e) => {
                              const val = Math.max(100, parseInt(e.target.value) || 100);
                              const next = {
                                ...currentSave,
                                config: { ...currentSave.config, wordCountMax: val },
                              };
                              commitSave(next);
                            }}
                            className="w-18 px-2 py-1 bg-white border border-slate-300 rounded-lg text-center text-xs text-slate-800 focus:outline-none focus:border-sky-500"
                          />
                          <span className="text-slate-500 text-[11px]">字</span>
                        </div>

                        {/* Quick preset buttons */}
                        <div className="flex flex-wrap items-center gap-1 pt-0.5">
                          <span className="text-[10px] text-slate-400">快捷:</span>
                          {[
                            { min: 150, max: 300, label: '150-300' },
                            { min: 300, max: 600, label: '300-600' },
                            { min: 500, max: 1000, label: '500-1000' },
                            { min: 800, max: 1500, label: '800-1500' },
                          ].map((preset) => (
                            <button
                              key={preset.label}
                              type="button"
                              onClick={() => {
                                const next = {
                                  ...currentSave,
                                  config: {
                                    ...currentSave.config,
                                    wordCountMin: preset.min,
                                    wordCountMax: preset.max,
                                  },
                                };
                                commitSave(next);
                              }}
                              className={`px-1.5 py-0.5 rounded text-[10px] border transition-colors cursor-pointer ${
                                currentSave.config.wordCountMin === preset.min &&
                                currentSave.config.wordCountMax === preset.max
                                  ? 'bg-sky-50 border-sky-400 text-sky-700 font-semibold'
                                  : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                              }`}
                            >
                              {preset.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* 5. 本场写作指导 */}
                  <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <div className="font-semibold text-slate-800 text-xs">本场写作指导</div>
                      {currentSave.config.writingGuidance && (
                        <button
                          type="button"
                          onClick={() => {
                            const next = {
                              ...currentSave,
                              config: { ...currentSave.config, writingGuidance: '' },
                            };
                            commitSave(next);
                          }}
                          className="text-[10px] text-slate-400 hover:text-rose-500 cursor-pointer"
                        >
                          清空
                        </button>
                      )}
                    </div>
                    <textarea
                      rows={3}
                      value={currentSave.config.writingGuidance || ''}
                      onChange={(e) => {
                        const val = e.target.value;
                        const next = {
                          ...currentSave,
                          config: { ...currentSave.config, writingGuidance: val },
                        };
                        commitSave(next);
                      }}
                      placeholder="填入本场写作指导（如：文风清冷克制、多描写环境与细节、突出心理博弈等）..."
                      className="w-full p-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-sky-500 leading-relaxed"
                    />
                  </div>

                  {/* 6. 其他辅助开关 */}
                  <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
                    <div className="font-semibold text-slate-800 text-xs">其他辅助开关</div>
                    <div className="space-y-2">
                      <label className="flex items-center justify-between cursor-pointer">
                        <span className="text-slate-700 text-xs">角色心声开关</span>
                        <input
                          type="checkbox"
                          checked={currentSave.config.innerVoiceEnabled}
                          onChange={(e) => {
                            const next = {
                              ...currentSave,
                              config: { ...currentSave.config, innerVoiceEnabled: e.target.checked },
                            };
                            commitSave(next);
                          }}
                          className="accent-sky-500 w-4 h-4 rounded cursor-pointer"
                        />
                      </label>

                      <label className="flex items-center justify-between cursor-pointer">
                        <span className="text-slate-700 text-xs">剧情选项建议</span>
                        <input
                          type="checkbox"
                          checked={currentSave.config.branchChoicesEnabled}
                          onChange={(e) => {
                            const next = {
                              ...currentSave,
                              config: { ...currentSave.config, branchChoicesEnabled: e.target.checked },
                            };
                            commitSave(next);
                          }}
                          className="accent-sky-500 w-4 h-4 rounded cursor-pointer"
                        />
                      </label>

                      <label className="flex items-center justify-between cursor-pointer">
                        <span className="text-slate-700 text-xs">数值追踪开关</span>
                        <input
                          type="checkbox"
                          checked={currentSave.config.statsTrackingEnabled}
                          onChange={(e) => {
                            const next = {
                              ...currentSave,
                              config: { ...currentSave.config, statsTrackingEnabled: e.target.checked },
                            };
                            commitSave(next);
                          }}
                          className="accent-sky-500 w-4 h-4 rounded cursor-pointer"
                        />
                      </label>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
