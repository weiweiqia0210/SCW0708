import React, { useState, useRef, useEffect } from 'react';
import {
  ArrowLeft,
  Plus,
  Send,
  Square,
  Sparkles,
  Bot,
  Brain,
  Terminal,
  Cat,
  Copy,
  Edit3,
  RefreshCw,
  Trash2,
  Check,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  Settings2,
  PanelLeft,
  PanelLeftClose,
  MessageSquare,
  Lightbulb,
  Zap,
  Clock,
  Sliders,
} from 'lucide-react';
import {
  DialogueSession,
  DialogueMessage,
  DialogueAISettings,
  AppSettings,
} from '../../types';
import { streamChat } from '../../utils/aiService';
import {
  loadDialogueSessions,
  saveDialogueSessions,
  saveSingleDialogueSession,
  createNewDialogueSession,
  deleteDialogueSession,
  DEFAULT_AI_SETTINGS,
} from '../../utils/dialogueStorage';
import { DialogueAISettingsModal } from './DialogueAISettingsModal';

interface DialogueModeViewProps {
  settings: AppSettings;
  onExit: () => void;
}

export const DialogueModeView: React.FC<DialogueModeViewProps> = ({
  settings,
  onExit,
}) => {
  // Session list
  const [sessions, setSessions] = useState<DialogueSession[]>(() => {
    const list = loadDialogueSessions();
    if (list.length > 0) return list;
    const initial = createNewDialogueSession('新对话');
    return [initial];
  });

  const [activeSessionId, setActiveSessionId] = useState<string>(
    () => sessions[0]?.id || ''
  );

  const activeSession =
    sessions.find((s) => s.id === activeSessionId) || sessions[0];

  // States
  const [inputText, setInputText] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');
  const [streamingThinking, setStreamingThinking] = useState('');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isAISettingsOpen, setIsAISettingsOpen] = useState(false);
  const [copiedMsgId, setCopiedMsgId] = useState<string | null>(null);

  // Inline editing
  const [editingMsgId, setEditingMsgId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState('');

  // Auto scroll & abort controller
  const abortControllerRef = useRef<AbortController | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeSession?.messages, streamingContent, streamingThinking]);

  // Adjust textarea height automatically
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputText(e.target.value);
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 180)}px`;
    }
  };

  // Helper to persist session update
  const updateCurrentSession = (updater: (s: DialogueSession) => DialogueSession) => {
    if (!activeSession) return;
    const updated = updater(activeSession);
    const nextSessions = sessions.map((s) => (s.id === updated.id ? updated : s));
    setSessions(nextSessions);
    saveSingleDialogueSession(updated);
  };

  // Create new session
  const handleCreateNewSession = () => {
    const newSess = createNewDialogueSession(
      '新对话',
      activeSession?.aiSettings || DEFAULT_AI_SETTINGS
    );
    setSessions([newSess, ...sessions]);
    setActiveSessionId(newSess.id);
    setIsSidebarOpen(false);
  };

  // Delete session
  const handleDeleteSession = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    deleteDialogueSession(id);
    const remain = sessions.filter((s) => s.id !== id);
    if (remain.length === 0) {
      const fresh = createNewDialogueSession('新对话');
      setSessions([fresh]);
      setActiveSessionId(fresh.id);
    } else {
      setSessions(remain);
      if (activeSessionId === id) {
        setActiveSessionId(remain[0].id);
      }
    }
  };

  // Parse think tags if model outputs <think>...</think>
  const parseContentAndThinking = (raw: string) => {
    const thinkMatch = raw.match(/<think>([\s\S]*?)<\/think>/);
    if (thinkMatch) {
      const thinking = thinkMatch[1].trim();
      const content = raw.replace(/<think>[\s\S]*?<\/think>/, '').trim();
      return { thinking, content };
    }
    return { thinking: '', content: raw };
  };

  // Send message
  const handleSendMessage = async (textToSend?: string) => {
    const query = (textToSend || inputText).trim();
    if (!query || isGenerating || !activeSession) return;

    setInputText('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }

    const userMsg: DialogueMessage = {
      id: `msg-user-${Date.now()}`,
      role: 'user',
      content: query,
      timestamp: Date.now(),
      versions: [
        {
          id: `v-${Date.now()}-0`,
          content: query,
          timestamp: Date.now(),
        },
      ],
      currentVersionIndex: 0,
    };

    // Update title if first message
    const isFirstUserMsg = activeSession.messages.filter((m) => m.role === 'user').length === 0;
    const nextTitle = isFirstUserMsg
      ? query.slice(0, 16) + (query.length > 16 ? '...' : '')
      : activeSession.title;

    const nextMessages = [...activeSession.messages, userMsg];

    updateCurrentSession((s) => ({
      ...s,
      title: nextTitle,
      messages: nextMessages,
      updatedAt: Date.now(),
    }));

    // Trigger AI streaming
    await executeAIStream(nextMessages, activeSession.aiSettings);
  };

  // Core stream execution
  const executeAIStream = async (
    chatHistory: DialogueMessage[],
    aiConfig: DialogueAISettings
  ) => {
    setIsGenerating(true);
    setStreamingContent('');
    setStreamingThinking('');

    abortControllerRef.current = new AbortController();

    // Prepare system instructions
    let systemInstruction = aiConfig.systemPrompt || DEFAULT_AI_SETTINGS.systemPrompt;
    if (aiConfig.enableThinking) {
      systemInstruction += `\n\n【深度思考模式开启】
在给出最终回答前，请进行深度思考，并将你的思考推理与分析过程置于 <think> 与 </think> 标签之间，随后输出正文回答。`;
    }

    let accumulatedRaw = '';

    try {
      await streamChat({
        provider: settings.provider,
        model: settings.model,
        customApiKey: settings.customApiKey,
        customEndpoint: settings.customEndpoint,
        temperature: aiConfig.temperature,
        systemInstruction,
        messages: chatHistory.map((m) => ({
          role: m.role === 'assistant' ? 'assistant' : 'user',
          text: m.content,
        })),
        signal: abortControllerRef.current.signal,
        onChunk: (chunk) => {
          accumulatedRaw += chunk;
          const { thinking, content } = parseContentAndThinking(accumulatedRaw);
          setStreamingThinking(thinking);
          setStreamingContent(content);
        },
      });

      // Stream complete: commit message to session
      const { thinking, content } = parseContentAndThinking(accumulatedRaw);
      const finalContent = content || accumulatedRaw;
      const assistantMsg: DialogueMessage = {
        id: `msg-ai-${Date.now()}`,
        role: 'assistant',
        content: finalContent,
        thinking: thinking || undefined,
        isThinkingExpanded: false,
        timestamp: Date.now(),
        versions: [
          {
            id: `v-${Date.now()}-0`,
            content: finalContent,
            thinking: thinking || undefined,
            timestamp: Date.now(),
          },
        ],
        currentVersionIndex: 0,
      };

      updateCurrentSession((s) => ({
        ...s,
        messages: [...chatHistory, assistantMsg],
        updatedAt: Date.now(),
      }));
    } catch (err: any) {
      if (err?.name !== 'AbortError') {
        const errorMsg: DialogueMessage = {
          id: `msg-err-${Date.now()}`,
          role: 'system',
          content: `⚠️ 生成出现问题：${err?.message || '网络连接或 API 异常，请检查设置'}`,
          timestamp: Date.now(),
        };
        updateCurrentSession((s) => ({
          ...s,
          messages: [...chatHistory, errorMsg],
          updatedAt: Date.now(),
        }));
      }
    } finally {
      setIsGenerating(false);
      setStreamingContent('');
      setStreamingThinking('');
      abortControllerRef.current = null;
    }
  };

  // Stop generation
  const handleStopGenerating = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsGenerating(false);
  };

  // Copy message
  const handleCopyMessage = async (msgId: string, content: string) => {
    try {
      await navigator.clipboard.writeText(content);
      setCopiedMsgId(msgId);
      setTimeout(() => setCopiedMsgId(null), 1800);
    } catch {
      // ignore
    }
  };

  // Switch version of a message (切换历史旧版本与新版本)
  const handleSwitchVersion = (msgId: string, targetIndex: number) => {
    updateCurrentSession((s) => ({
      ...s,
      messages: s.messages.map((m) => {
        if (m.id !== msgId) return m;
        const versions =
          m.versions && m.versions.length > 0
            ? m.versions
            : [
                {
                  id: `v-${m.timestamp}`,
                  content: m.content,
                  thinking: m.thinking,
                  timestamp: m.timestamp,
                },
              ];
        if (targetIndex < 0 || targetIndex >= versions.length) return m;
        const target = versions[targetIndex];
        return {
          ...m,
          content: target.content,
          thinking: target.thinking,
          currentVersionIndex: targetIndex,
        };
      }),
      updatedAt: Date.now(),
    }));
  };

  // Re-roll Assistant Message (保留旧版本，推演新版本并切换到新版本)
  const handleRerollAssistant = async (msgId: string) => {
    if (!activeSession || isGenerating) return;
    const msgIndex = activeSession.messages.findIndex((m) => m.id === msgId);
    if (msgIndex === -1) return;

    const currentMsg = activeSession.messages[msgIndex];
    const existingVersions =
      currentMsg.versions && currentMsg.versions.length > 0
        ? currentMsg.versions
        : [
            {
              id: `v-${currentMsg.timestamp}-0`,
              content: currentMsg.content,
              thinking: currentMsg.thinking,
              timestamp: currentMsg.timestamp,
            },
          ];

    const chatHistory = activeSession.messages.slice(0, msgIndex);

    setIsGenerating(true);
    setStreamingContent('');
    setStreamingThinking('');
    abortControllerRef.current = new AbortController();

    const aiConfig = activeSession.aiSettings;
    let systemInstruction = aiConfig.systemPrompt || DEFAULT_AI_SETTINGS.systemPrompt;
    if (aiConfig.enableThinking) {
      systemInstruction += `\n\n【深度思考模式开启】
在给出最终回答前，请进行深度思考，并将你的思考推理与分析过程置于 <think> 与 </think> 标签之间，随后输出正文回答。`;
    }

    let accumulatedRaw = '';

    try {
      await streamChat({
        provider: settings.provider,
        model: settings.model,
        customApiKey: settings.customApiKey,
        customEndpoint: settings.customEndpoint,
        temperature: aiConfig.temperature,
        systemInstruction,
        messages: chatHistory.map((m) => ({
          role: m.role === 'assistant' ? 'assistant' : 'user',
          text: m.content,
        })),
        signal: abortControllerRef.current.signal,
        onChunk: (chunk) => {
          accumulatedRaw += chunk;
          const { thinking, content } = parseContentAndThinking(accumulatedRaw);
          setStreamingThinking(thinking);
          setStreamingContent(content);
        },
      });

      const { thinking, content } = parseContentAndThinking(accumulatedRaw);
      const newVersionContent = content || accumulatedRaw;
      const newVersionObj = {
        id: `v-${Date.now()}`,
        content: newVersionContent,
        thinking: thinking || undefined,
        timestamp: Date.now(),
      };
      const updatedVersions = [...existingVersions, newVersionObj];

      updateCurrentSession((s) => ({
        ...s,
        messages: s.messages.map((m) =>
          m.id === msgId
            ? {
                ...m,
                content: newVersionContent,
                thinking: thinking || undefined,
                versions: updatedVersions,
                currentVersionIndex: updatedVersions.length - 1,
              }
            : m
        ),
        updatedAt: Date.now(),
      }));
    } catch (err: any) {
      if (err?.name !== 'AbortError') {
        const errorMsg: DialogueMessage = {
          id: `msg-err-${Date.now()}`,
          role: 'system',
          content: `⚠️ 重roll出现问题：${err?.message || '网络连接或 API 异常，请重试'}`,
          timestamp: Date.now(),
        };
        updateCurrentSession((s) => ({
          ...s,
          messages: [...s.messages, errorMsg],
          updatedAt: Date.now(),
        }));
      }
    } finally {
      setIsGenerating(false);
      setStreamingContent('');
      setStreamingThinking('');
      abortControllerRef.current = null;
    }
  };

  // Re-roll User Message (重新推演此提问，若有后续回复则保留版本重生成，若无则生成回复)
  const handleRerollUser = async (msgId: string) => {
    if (!activeSession || isGenerating) return;
    const msgIndex = activeSession.messages.findIndex((m) => m.id === msgId);
    if (msgIndex === -1) return;

    const nextMsg = activeSession.messages[msgIndex + 1];
    if (nextMsg && nextMsg.role === 'assistant') {
      handleRerollAssistant(nextMsg.id);
    } else {
      const chatHistory = activeSession.messages.slice(0, msgIndex + 1);
      await executeAIStream(chatHistory, activeSession.aiSettings);
    }
  };

  // Delete message
  const handleDeleteMessage = (msgId: string) => {
    updateCurrentSession((s) => ({
      ...s,
      messages: s.messages.filter((m) => m.id !== msgId),
      updatedAt: Date.now(),
    }));
  };

  // Save inline edit (同时保留旧版本，追加新版本)
  const handleSaveEdit = (msgId: string) => {
    const trimmed = editingText.trim();
    if (!trimmed || !activeSession) return;

    const msgIndex = activeSession.messages.findIndex((m) => m.id === msgId);
    if (msgIndex === -1) return;

    const targetMsg = activeSession.messages[msgIndex];
    const existingVersions =
      targetMsg.versions && targetMsg.versions.length > 0
        ? targetMsg.versions
        : [
            {
              id: `v-${targetMsg.timestamp}-0`,
              content: targetMsg.content,
              thinking: targetMsg.thinking,
              timestamp: targetMsg.timestamp,
            },
          ];

    const newVersionObj = {
      id: `v-${Date.now()}`,
      content: trimmed,
      thinking: targetMsg.thinking,
      timestamp: Date.now(),
    };
    const updatedVersions = [...existingVersions, newVersionObj];

    const updatedMsg: DialogueMessage = {
      ...targetMsg,
      content: trimmed,
      versions: updatedVersions,
      currentVersionIndex: updatedVersions.length - 1,
    };

    const nextMessages = activeSession.messages.map((m) =>
      m.id === msgId ? updatedMsg : m
    );

    updateCurrentSession((s) => ({
      ...s,
      messages: nextMessages,
      updatedAt: Date.now(),
    }));

    setEditingMsgId(null);

    // If a user message was edited, re-trigger AI answer for this updated prompt
    if (targetMsg.role === 'user') {
      const nextMsg = nextMessages[msgIndex + 1];
      if (nextMsg && nextMsg.role === 'assistant') {
        handleRerollAssistant(nextMsg.id);
      } else {
        const historyUntilEdited = nextMessages.slice(0, msgIndex + 1);
        executeAIStream(historyUntilEdited, activeSession.aiSettings);
      }
    }
  };

  // Render AI Avatar icon helper
  const renderAIAvatar = (type: DialogueAISettings['avatarType'], sizeClass = 'w-4 h-4') => {
    switch (type) {
      case 'brain':
        return <Brain className={sizeClass} />;
      case 'bot':
        return <Bot className={sizeClass} />;
      case 'terminal':
        return <Terminal className={sizeClass} />;
      case 'cat':
        return <Cat className={sizeClass} />;
      default:
        return <Sparkles className={sizeClass} />;
    }
  };

  const aiSettings = activeSession?.aiSettings || DEFAULT_AI_SETTINGS;

  return (
    <div
      data-dialogue-mode="root"
      className="dialogue-mode-root flex h-screen max-h-screen bg-white text-slate-800 antialiased font-sans overflow-hidden select-text"
    >
      {/* Collapsible Sidebar (Drawer) */}
      <aside
        data-dialogue-sidebar
        className={`dialogue-sidebar fixed inset-y-0 left-0 z-40 w-64 bg-slate-900 text-slate-200 border-r border-slate-800 flex flex-col transition-transform duration-200 sm:static sm:translate-x-0 ${
          isSidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Sidebar Header */}
        <div className="p-3.5 border-b border-slate-800/80 flex items-center justify-between">
          <button
            type="button"
            onClick={onExit}
            className="flex items-center gap-2 text-xs font-semibold text-slate-400 hover:text-white transition-colors cursor-pointer py-1 px-2 rounded-lg hover:bg-slate-800"
            title="退出对话模式返回首页"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>返回大厅</span>
          </button>
          <button
            type="button"
            onClick={() => setIsSidebarOpen(false)}
            className="sm:hidden p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
          >
            <PanelLeftClose className="w-4 h-4" />
          </button>
        </div>

        {/* New Chat Button */}
        <div className="p-3">
          <button
            type="button"
            onClick={handleCreateNewSession}
            className="w-full flex items-center justify-center gap-2 py-2.5 px-3.5 rounded-2xl bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 active:scale-98 text-white text-xs font-bold shadow-md shadow-sky-950/40 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>发起新对话</span>
          </button>
        </div>

        {/* Sessions List */}
        <div className="flex-1 overflow-y-auto px-2 space-y-1 py-1">
          <div className="px-2.5 py-1 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
            对话记录 ({sessions.length})
          </div>
          {sessions.map((sess) => {
            const isActive = sess.id === activeSessionId;
            return (
              <div
                key={sess.id}
                onClick={() => {
                  setActiveSessionId(sess.id);
                  setIsSidebarOpen(false);
                }}
                className={`group flex items-center justify-between p-2.5 rounded-xl text-xs font-medium transition-all cursor-pointer ${
                  isActive
                    ? 'bg-slate-800/90 text-white shadow-xs'
                    : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200'
                }`}
              >
                <div className="flex items-center gap-2 min-w-0 pr-1">
                  <MessageSquare
                    className={`w-3.5 h-3.5 shrink-0 ${
                      isActive ? 'text-sky-400' : 'text-slate-500'
                    }`}
                  />
                  <span className="truncate">{sess.title}</span>
                </div>
                <button
                  type="button"
                  onClick={(e) => handleDeleteSession(sess.id, e)}
                  className="opacity-0 group-hover:opacity-100 p-1 text-slate-500 hover:text-rose-400 rounded-md transition-all cursor-pointer"
                  title="删除对话"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            );
          })}
        </div>

        {/* Sidebar Footer: AI Avatar & Settings Quick Entry */}
        <div className="p-3 border-t border-slate-800 bg-slate-950/40">
          <button
            type="button"
            onClick={() => setIsAISettingsOpen(true)}
            className="w-full flex items-center gap-2.5 p-2 rounded-xl hover:bg-slate-800/80 transition-colors text-left cursor-pointer group"
          >
            <div className="w-8 h-8 rounded-xl bg-sky-500/20 text-sky-400 flex items-center justify-center shrink-0 border border-sky-400/30">
              {renderAIAvatar(aiSettings.avatarType, 'w-4 h-4')}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-xs font-bold text-slate-200 truncate group-hover:text-white">
                {aiSettings.name}
              </div>
              <div className="text-[10px] text-slate-500 truncate">
                点击配置人设与提示词
              </div>
            </div>
            <Settings2 className="w-4 h-4 text-slate-500 group-hover:text-slate-300 shrink-0" />
          </button>
        </div>
      </aside>

      {/* Main Chat Workspace (GPT / Gemini / DeepSeek Layout) */}
      <div className="flex-1 flex flex-col min-w-0 h-full relative bg-slate-50/50">
        {/* Top Navbar */}
        <header
          data-dialogue-header
          className="dialogue-header h-14 border-b border-slate-200/80 bg-white/95 backdrop-blur-md px-3 sm:px-6 flex items-center justify-between shrink-0 z-10"
        >
          <div className="flex items-center gap-2 min-w-0">
            <button
              type="button"
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="p-2 rounded-xl text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors cursor-pointer"
              title="切换对话历史列表"
            >
              <PanelLeft className="w-4 h-4" />
            </button>

            <div className="min-w-0">
              <h2 className="text-sm font-bold text-slate-800 truncate">
                {activeSession?.title || '新对话'}
              </h2>
            </div>
          </div>

          {/* AI Avatar Trigger Capsule (User Requirement: 可以点开ai的头像进行设置，输入提示词之类的) */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsAISettingsOpen(true)}
              className="dialogue-ai-avatar flex items-center gap-2 py-1 px-2.5 rounded-full bg-slate-100 hover:bg-sky-50 border border-slate-200/80 hover:border-sky-300 transition-all cursor-pointer group shadow-2xs active:scale-95"
              title="点击设置 AI 提示词与助手形象"
            >
              <div className="w-6 h-6 rounded-full bg-gradient-to-tr from-sky-500 to-indigo-600 text-white flex items-center justify-center shadow-xs">
                {aiSettings.avatarUrl ? (
                  <img
                    src={aiSettings.avatarUrl}
                    alt={aiSettings.name}
                    className="w-full h-full rounded-full object-cover"
                  />
                ) : (
                  renderAIAvatar(aiSettings.avatarType, 'w-3.5 h-3.5')
                )}
              </div>
              <span className="text-xs font-bold text-slate-700 group-hover:text-sky-700 truncate max-w-[120px]">
                {aiSettings.name}
              </span>
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-white text-slate-400 group-hover:text-sky-600 border border-slate-200/60 font-mono">
                提示词
              </span>
            </button>
          </div>
        </header>

        {/* Scrollable Messages Viewport */}
        <main
          data-dialogue-viewport
          className="dialogue-viewport flex-1 overflow-y-auto px-3 sm:px-6 py-6 space-y-6"
        >
          {/* Empty State / Welcome Hero (GPT / DeepSeek Style) */}
          {activeSession?.messages.length === 0 && !isGenerating && (
            <div className="dialogue-empty-hero max-w-xl mx-auto my-auto text-center space-y-6 pt-8 sm:pt-14 pb-8">
              <div
                onClick={() => setIsAISettingsOpen(true)}
                className="w-16 h-16 rounded-3xl bg-gradient-to-tr from-sky-400 via-indigo-500 to-purple-600 text-white flex items-center justify-center mx-auto shadow-xl shadow-sky-500/20 cursor-pointer hover:scale-105 transition-transform"
                title="点击设置此 AI 助手与系统提示词"
              >
                {aiSettings.avatarUrl ? (
                  <img
                    src={aiSettings.avatarUrl}
                    alt={aiSettings.name}
                    className="w-full h-full rounded-3xl object-cover"
                  />
                ) : (
                  renderAIAvatar(aiSettings.avatarType, 'w-8 h-8')
                )}
              </div>

              <div>
                <h3 className="text-lg sm:text-xl font-bold text-slate-800">
                  你好，我是 {aiSettings.name}
                </h3>
                <p className="text-xs sm:text-sm text-slate-500 mt-1 max-w-md mx-auto leading-relaxed">
                  {aiSettings.customPersonaTitle || '你的全能智能创作与思辨伙伴'}
                  。点击上方头像可随时修改我的系统提示词与人设。
                </p>
              </div>

              {/* Prompt Suggestion Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-left pt-2">
                {[
                  {
                    title: '深度哲学思辨',
                    desc: '剖析人工智能对未来人类创作与意识的深远重构',
                    prompt: '请用严谨且富于哲思的视角，深入探讨人工智能与人类意识边界的变化。',
                  },
                  {
                    title: '故事世界观脑暴',
                    desc: '构思一个被暴雨与霓虹笼罩的悬疑幻想都市',
                    prompt: '我想创作一个潮湿多雨、科技与古代神秘学交织的幻想城邦，请帮我构思它的核心势力与世界观。',
                  },
                  {
                    title: '角色弧光与动机',
                    desc: '为一个亦正亦邪的复仇者设计复杂内心冲突',
                    prompt: '请帮我塑造一位看似冷酷无情但内心秉持秘密誓约的反英雄人物设定。',
                  },
                  {
                    title: '逻辑代码与架构',
                    desc: '拆解一个复杂状态机的优雅实现方案',
                    prompt: '请用通俗生动的比喻，阐述在前端大型应用中管理复杂业务状态的最佳实践。',
                  },
                ].map((item, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleSendMessage(item.prompt)}
                    className="p-3.5 rounded-2xl bg-white hover:bg-sky-50/50 border border-slate-200/90 hover:border-sky-300 shadow-xs hover:shadow-sm transition-all text-left cursor-pointer group active:scale-98"
                  >
                    <div className="text-xs font-bold text-slate-800 group-hover:text-sky-700 flex items-center justify-between">
                      <span>{item.title}</span>
                      <Zap className="w-3.5 h-3.5 text-slate-300 group-hover:text-sky-500" />
                    </div>
                    <div className="text-[11px] text-slate-500 line-clamp-2 mt-1 leading-normal">
                      {item.desc}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Messages Feed */}
          <div className="max-w-3xl mx-auto space-y-6">
            {activeSession?.messages.map((msg) => {
              // System warning/status
              if (msg.role === 'system') {
                return (
                  <div
                    key={msg.id}
                    className="dialogue-system-msg p-3 rounded-2xl bg-amber-50/80 border border-amber-200 text-xs text-amber-900 leading-relaxed font-mono"
                  >
                    {msg.content}
                  </div>
                );
              }

              // User Message (Right aligned capsule)
              if (msg.role === 'user') {
                const userVersions =
                  msg.versions && msg.versions.length > 0
                    ? msg.versions
                    : [
                        {
                          id: `v-${msg.timestamp}-0`,
                          content: msg.content,
                          timestamp: msg.timestamp,
                        },
                      ];
                const currentVersionIdx =
                  typeof msg.currentVersionIndex === 'number'
                    ? Math.min(Math.max(0, msg.currentVersionIndex), userVersions.length - 1)
                    : userVersions.length - 1;

                return (
                  <div
                    key={msg.id}
                    data-message-role="user"
                    className="dialogue-message-user flex flex-col items-end group"
                  >
                    {editingMsgId === msg.id ? (
                      <div className="w-full max-w-xl p-3 bg-white rounded-2xl border border-sky-300 shadow-sm space-y-2">
                        <textarea
                          rows={3}
                          value={editingText}
                          onChange={(e) => setEditingText(e.target.value)}
                          className="w-full p-2 text-xs text-slate-800 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-400 font-sans resize-y"
                        />
                        <div className="flex justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => setEditingMsgId(null)}
                            className="px-2.5 py-1 text-xs text-slate-500 hover:bg-slate-100 rounded-lg cursor-pointer"
                          >
                            取消
                          </button>
                          <button
                            type="button"
                            onClick={() => handleSaveEdit(msg.id)}
                            className="px-3 py-1 text-xs font-bold text-white bg-sky-500 hover:bg-sky-600 rounded-lg cursor-pointer"
                          >
                            保存
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="max-w-[85%] sm:max-w-[75%] rounded-3xl px-4 py-3 bg-slate-900 text-white shadow-xs space-y-1">
                        <div className="text-xs sm:text-sm whitespace-pre-wrap leading-relaxed font-sans">
                          {msg.content}
                        </div>
                      </div>
                    )}

                    {/* Actions & Version Switcher */}
                    <div className="flex items-center gap-1 pt-1.5 pr-1 opacity-90 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity text-slate-400">
                      {/* Version Pager */}
                      {userVersions.length > 1 && (
                        <div className="flex items-center gap-0.5 text-[10px] font-mono font-bold text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded-full border border-slate-200 mr-1 shadow-2xs">
                          <button
                            type="button"
                            disabled={currentVersionIdx <= 0}
                            onClick={() => handleSwitchVersion(msg.id, currentVersionIdx - 1)}
                            className="p-0.5 hover:text-slate-900 disabled:opacity-25 cursor-pointer disabled:cursor-not-allowed"
                            title="上一版本"
                          >
                            <ChevronLeft className="w-3 h-3" />
                          </button>
                          <span>
                            {currentVersionIdx + 1}/{userVersions.length}
                          </span>
                          <button
                            type="button"
                            disabled={currentVersionIdx >= userVersions.length - 1}
                            onClick={() => handleSwitchVersion(msg.id, currentVersionIdx + 1)}
                            className="p-0.5 hover:text-slate-900 disabled:opacity-25 cursor-pointer disabled:cursor-not-allowed"
                            title="下一版本"
                          >
                            <ChevronRight className="w-3 h-3" />
                          </button>
                        </div>
                      )}

                      {/* 1. 复制 */}
                      <button
                        type="button"
                        onClick={() => handleCopyMessage(msg.id, msg.content)}
                        className="p-1 rounded-md hover:text-slate-700 hover:bg-slate-200/50 cursor-pointer"
                        title="复制内容"
                      >
                        {copiedMsgId === msg.id ? (
                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>

                      {/* 2. 编辑 */}
                      <button
                        type="button"
                        onClick={() => {
                          setEditingMsgId(msg.id);
                          setEditingText(msg.content);
                        }}
                        className="p-1 rounded-md hover:text-sky-600 hover:bg-slate-200/50 cursor-pointer"
                        title="编辑消息"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>

                      {/* 3. 重roll (保留旧版本) */}
                      <button
                        type="button"
                        onClick={() => handleRerollUser(msg.id)}
                        disabled={isGenerating}
                        className="p-1 rounded-md hover:text-amber-600 hover:bg-slate-200/50 cursor-pointer disabled:opacity-30"
                        title="重roll (重新推演此提问，保留旧版本)"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                      </button>

                      {/* 4. 删除 */}
                      <button
                        type="button"
                        onClick={() => handleDeleteMessage(msg.id)}
                        className="p-1 rounded-md hover:text-rose-600 hover:bg-slate-200/50 cursor-pointer"
                        title="删除消息"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              }

              // Assistant Message (GPT / DeepSeek Style with Avatar, Thinking & 4 Action Icons)
              const assistantVersions =
                msg.versions && msg.versions.length > 0
                  ? msg.versions
                  : [
                      {
                        id: `v-${msg.timestamp}-0`,
                        content: msg.content,
                        thinking: msg.thinking,
                        timestamp: msg.timestamp,
                      },
                    ];
              const currentAssistantVersionIdx =
                typeof msg.currentVersionIndex === 'number'
                  ? Math.min(Math.max(0, msg.currentVersionIndex), assistantVersions.length - 1)
                  : assistantVersions.length - 1;

              return (
                <div
                  key={msg.id}
                  data-message-role="assistant"
                  className="dialogue-message-assistant flex gap-3 group animate-in fade-in duration-150"
                >
                  {/* Clickable AI Avatar */}
                  <div
                    onClick={() => setIsAISettingsOpen(true)}
                    className="w-8 h-8 rounded-2xl bg-gradient-to-tr from-sky-500 to-indigo-600 text-white flex items-center justify-center shrink-0 shadow-xs cursor-pointer hover:ring-2 hover:ring-sky-400 transition-all mt-0.5"
                    title="点击配置此助手人设与提示词"
                  >
                    {aiSettings.avatarUrl ? (
                      <img
                        src={aiSettings.avatarUrl}
                        alt={aiSettings.name}
                        className="w-full h-full rounded-2xl object-cover"
                      />
                    ) : (
                      renderAIAvatar(aiSettings.avatarType, 'w-4 h-4')
                    )}
                  </div>

                  <div className="flex-1 min-w-0 space-y-2">
                    <div className="flex items-center gap-2">
                      <span
                        onClick={() => setIsAISettingsOpen(true)}
                        className="text-xs font-bold text-slate-800 hover:text-sky-600 cursor-pointer transition-colors"
                      >
                        {aiSettings.name}
                      </span>
                      <span className="text-[10px] text-slate-400 font-mono">
                        {new Date(msg.timestamp).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>

                    {/* DeepSeek Style Thinking Block (Collapsible) */}
                    {msg.thinking && (
                      <div className="dialogue-thinking-bubble my-2 rounded-2xl border border-slate-200/90 bg-slate-100/70 overflow-hidden">
                        <button
                          type="button"
                          onClick={() => {
                            updateCurrentSession((s) => ({
                              ...s,
                              messages: s.messages.map((m) =>
                                m.id === msg.id
                                  ? { ...m, isThinkingExpanded: !m.isThinkingExpanded }
                                  : m
                              ),
                            }));
                          }}
                          className="w-full px-3.5 py-2 flex items-center justify-between text-slate-500 hover:text-slate-800 text-[11px] font-bold cursor-pointer transition-colors"
                        >
                          <span className="flex items-center gap-1.5">
                            <Brain className="w-3.5 h-3.5 text-sky-600" />
                            <span>深度思考过程 (已折叠)</span>
                          </span>
                          {msg.isThinkingExpanded ? (
                            <ChevronUp className="w-3.5 h-3.5" />
                          ) : (
                            <ChevronDown className="w-3.5 h-3.5" />
                          )}
                        </button>
                        {msg.isThinkingExpanded && (
                          <div className="p-3.5 text-[11px] text-slate-600 border-t border-slate-200/70 font-mono whitespace-pre-wrap leading-relaxed bg-white/60">
                            {msg.thinking}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Assistant Text Content or Inline Edit */}
                    {editingMsgId === msg.id ? (
                      <div className="w-full p-3 bg-white rounded-2xl border border-sky-300 shadow-sm space-y-2">
                        <textarea
                          rows={4}
                          value={editingText}
                          onChange={(e) => setEditingText(e.target.value)}
                          className="w-full p-2.5 text-xs text-slate-800 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-400 font-sans resize-y leading-relaxed"
                        />
                        <div className="flex justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => setEditingMsgId(null)}
                            className="px-2.5 py-1 text-xs text-slate-500 hover:bg-slate-100 rounded-lg cursor-pointer"
                          >
                            取消
                          </button>
                          <button
                            type="button"
                            onClick={() => handleSaveEdit(msg.id)}
                            className="px-3 py-1 text-xs font-bold text-white bg-sky-500 hover:bg-sky-600 rounded-lg cursor-pointer"
                          >
                            保存修改
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="text-xs sm:text-sm text-slate-800 leading-relaxed font-sans whitespace-pre-wrap">
                        {msg.content}
                      </div>
                    )}

                    {/* 4 Action Icons & Version Switcher */}
                    <div className="flex items-center gap-1 pt-1.5 opacity-90 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity text-slate-400">
                      {/* Version Pager */}
                      {assistantVersions.length > 1 && (
                        <div className="flex items-center gap-0.5 text-[10px] font-mono font-bold text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded-full border border-slate-200 mr-1 shadow-2xs">
                          <button
                            type="button"
                            disabled={currentAssistantVersionIdx <= 0}
                            onClick={() => handleSwitchVersion(msg.id, currentAssistantVersionIdx - 1)}
                            className="p-0.5 hover:text-slate-900 disabled:opacity-25 cursor-pointer disabled:cursor-not-allowed"
                            title="上一版本"
                          >
                            <ChevronLeft className="w-3 h-3" />
                          </button>
                          <span>
                            {currentAssistantVersionIdx + 1}/{assistantVersions.length}
                          </span>
                          <button
                            type="button"
                            disabled={currentAssistantVersionIdx >= assistantVersions.length - 1}
                            onClick={() => handleSwitchVersion(msg.id, currentAssistantVersionIdx + 1)}
                            className="p-0.5 hover:text-slate-900 disabled:opacity-25 cursor-pointer disabled:cursor-not-allowed"
                            title="下一版本"
                          >
                            <ChevronRight className="w-3 h-3" />
                          </button>
                        </div>
                      )}

                      {/* 1. 复制 */}
                      <button
                        type="button"
                        onClick={() => handleCopyMessage(msg.id, msg.content)}
                        className="p-1 rounded-md hover:text-slate-700 hover:bg-slate-200/50 cursor-pointer"
                        title="复制回答"
                      >
                        {copiedMsgId === msg.id ? (
                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>

                      {/* 2. 编辑 */}
                      <button
                        type="button"
                        onClick={() => {
                          setEditingMsgId(msg.id);
                          setEditingText(msg.content);
                        }}
                        className="p-1 rounded-md hover:text-sky-600 hover:bg-slate-200/50 cursor-pointer"
                        title="编辑回答"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>

                      {/* 3. 重roll (保留旧版本) */}
                      <button
                        type="button"
                        onClick={() => handleRerollAssistant(msg.id)}
                        disabled={isGenerating}
                        className="p-1 rounded-md hover:text-amber-600 hover:bg-slate-200/50 cursor-pointer disabled:opacity-30"
                        title="重roll (生成新版本，保留旧版本)"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                      </button>

                      {/* 4. 删除 */}
                      <button
                        type="button"
                        onClick={() => handleDeleteMessage(msg.id)}
                        className="p-1 rounded-md hover:text-rose-600 hover:bg-slate-200/50 cursor-pointer"
                        title="删除该条消息"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}

            {/* Live Streaming Assistant Message */}
            {isGenerating && (
              <div className="dialogue-message-streaming flex gap-3 animate-in fade-in duration-150">
                <div
                  onClick={() => setIsAISettingsOpen(true)}
                  className="w-8 h-8 rounded-2xl bg-gradient-to-tr from-sky-500 to-indigo-600 text-white flex items-center justify-center shrink-0 shadow-xs cursor-pointer mt-0.5"
                >
                  {renderAIAvatar(aiSettings.avatarType, 'w-4 h-4')}
                </div>
                <div className="flex-1 min-w-0 space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-800">
                      {aiSettings.name}
                    </span>
                    <span className="text-[10px] text-sky-600 font-bold flex items-center gap-1">
                      <Sparkles className="w-3 h-3 animate-spin" />
                      实时思考与生成中...
                    </span>
                  </div>

                  {/* Streaming Thinking Process (DeepSeek style) */}
                  {streamingThinking && (
                    <div className="p-3 rounded-2xl bg-slate-100/80 border border-slate-200 text-[11px] font-mono text-slate-600 space-y-1">
                      <div className="font-bold flex items-center gap-1.5 text-sky-700">
                        <Brain className="w-3.5 h-3.5 animate-pulse" />
                        <span>正在进行深度推演...</span>
                      </div>
                      <div className="whitespace-pre-wrap leading-relaxed opacity-85">
                        {streamingThinking}
                      </div>
                    </div>
                  )}

                  {/* Streaming Content */}
                  <div className="text-xs sm:text-sm text-slate-800 leading-relaxed font-sans whitespace-pre-wrap">
                    {streamingContent || '正在组织语言...'}
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        </main>

        {/* Floating Bottom Input Capsule (GPT / Gemini Style) */}
        <footer
          data-dialogue-footer
          className="dialogue-footer p-3 sm:p-5 bg-gradient-to-t from-white via-white/95 to-transparent shrink-0"
        >
          <div className="max-w-3xl mx-auto">
            <div
              data-dialogue-input-box
              className="dialogue-input-box relative rounded-3xl bg-white border border-slate-300/80 shadow-md shadow-slate-200/50 p-2 sm:p-3 transition-all focus-within:border-sky-400 focus-within:ring-2 focus-within:ring-sky-100"
            >
              <textarea
                ref={textareaRef}
                rows={1}
                value={inputText}
                onChange={handleInputChange}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage();
                  }
                }}
                placeholder={`向 ${aiSettings.name} 发送消息... (Enter 发送，Shift+Enter 换行)`}
                className="w-full bg-transparent px-2.5 py-1 text-xs sm:text-sm text-slate-800 focus:outline-none placeholder-slate-400 resize-none max-h-44 leading-relaxed font-sans"
              />

              <div className="flex items-center justify-between pt-1.5 border-t border-slate-100 mt-1">
                {/* Mode status badges & Quick AI prompt trigger */}
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      const next = !aiSettings.enableThinking;
                      updateCurrentSession((s) => ({
                        ...s,
                        aiSettings: { ...s.aiSettings, enableThinking: next },
                      }));
                    }}
                    className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold transition-all cursor-pointer ${
                      aiSettings.enableThinking
                        ? 'bg-sky-50 text-sky-700 border border-sky-200'
                        : 'text-slate-400 hover:text-slate-600'
                    }`}
                    title="点击开启/关闭深度思考推理"
                  >
                    <Brain className="w-3.5 h-3.5" />
                    <span>深度思考</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setIsAISettingsOpen(true)}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
                    title="设置系统提示词与人设"
                  >
                    <Sliders className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">助手人设与提示词</span>
                  </button>
                </div>

                {/* Send / Stop Action */}
                <div>
                  {isGenerating ? (
                    <button
                      type="button"
                      onClick={handleStopGenerating}
                      className="p-2 rounded-2xl bg-rose-500 hover:bg-rose-600 active:scale-95 text-white transition-all shadow-xs cursor-pointer"
                      title="停止生成"
                    >
                      <Square className="w-4 h-4 fill-current" />
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleSendMessage()}
                      disabled={!inputText.trim()}
                      className="p-2 rounded-2xl bg-slate-900 hover:bg-slate-800 active:scale-95 text-white transition-all shadow-xs cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                      title="发送"
                    >
                      <Send className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            </div>

            <p className="text-[10px] text-slate-400 text-center mt-2">
              支持点击任意 AI 头像即时修改系统提示词 · 界面适配 GPT、Gemini、DeepSeek 风格
            </p>
          </div>
        </footer>
      </div>

      {/* AI Persona & System Prompt Modal */}
      <DialogueAISettingsModal
        isOpen={isAISettingsOpen}
        onClose={() => setIsAISettingsOpen(false)}
        settings={aiSettings}
        onSave={(updated) => {
          updateCurrentSession((s) => ({
            ...s,
            aiSettings: updated,
            updatedAt: Date.now(),
          }));
        }}
      />
    </div>
  );
};
