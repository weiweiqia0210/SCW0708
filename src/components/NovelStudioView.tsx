import React, { useState, useEffect, useRef } from 'react';
import {
  ArrowLeft,
  Send,
  Square,
  RefreshCw,
  Copy,
  Edit2,
  Trash2,
  Check,
  Download,
  ListOrdered,
  Sliders,
  X,
  Loader2,
  BookOpen,
} from 'lucide-react';
import {
  StorySave,
  NovelProject,
  CharacterCard,
  WorldBook,
  SystemPreset,
  AppSettings,
  ChatMessage,
} from '../types';
import {
  exportNovelFromMessages,
  buildNovelTurnPrompt,
} from '../utils/novelService';
import { streamChat } from '../utils/aiService';

interface NovelStudioViewProps {
  save: StorySave;
  characters: CharacterCard[];
  worldbooks: WorldBook[];
  presets: SystemPreset[];
  settings: AppSettings;
  onBack: () => void;
  onUpdateSave: (updatedSave: StorySave) => void;
}

export const NovelStudioView: React.FC<NovelStudioViewProps> = ({
  save,
  characters,
  worldbooks,
  presets,
  settings,
  onBack,
  onUpdateSave,
}) => {
  // Novel project info
  const [project, setProject] = useState<NovelProject>(() => {
    if (save.novelProject) return save.novelProject;
    return {
      id: `novel-${save.id}`,
      title: save.title || '长篇小说',
      summary: save.summary || save.openingPremise || '',
      genre: '玄幻修真',
      targetWordCountPerChapter: 2500,
      globalGuidance: save.config?.writingGuidance || '',
      characterIds: save.characterIds || [],
      worldBookIds: save.worldBookIds || (save.worldBookId ? [save.worldBookId] : []),
      presetId: save.presetId || 'preset-immersive-novel',
      outline: save.summary || save.openingPremise || '',
      timeline: [],
      chapters: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
  });

  // Messages stream (turn-by-turn novel chapters and directives)
  const [messages, setMessages] = useState<ChatMessage[]>(() => save.messages || []);

  // Bottom chat input
  const [inputDirective, setInputDirective] = useState('');

  // AI Streaming state
  const [isGenerating, setIsGenerating] = useState(false);
  const [streamingText, setStreamingText] = useState('');
  const abortControllerRef = useRef<AbortController | null>(null);

  // Drawers & Modals
  const [showChaptersDrawer, setShowChaptersDrawer] = useState(false);
  const [showProjectDrawer, setShowProjectDrawer] = useState(false);
  const [projectDrawerTab, setProjectDrawerTab] = useState<'outline' | 'characters' | 'worldbooks' | 'settings'>('outline');
  const [exportModalOpen, setExportModalOpen] = useState(false);

  // Edit Message Modal
  const [editingMessage, setEditingMessage] = useState<ChatMessage | null>(null);
  const [editingContent, setEditingContent] = useState('');

  // Copied indicator
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Bottom anchor for auto-scroll
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  // Sync to parent save state
  const commitSave = (newMessages: ChatMessage[], newProject?: NovelProject) => {
    setMessages(newMessages);
    const proj = newProject || project;
    const updatedSave: StorySave = {
      ...save,
      title: proj.title,
      summary: proj.summary,
      characterIds: proj.characterIds,
      worldBookIds: proj.worldBookIds,
      presetId: proj.presetId || save.presetId,
      novelProject: proj,
      messages: newMessages,
      updatedAt: Date.now(),
    };
    onUpdateSave(updatedSave);
  };

  // Scroll to bottom when streaming or new message arrives
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // Extract chapters from AI assistant messages for navigation
  const chapterList = messages
    .filter((m) => m.role === 'assistant')
    .map((m, idx) => {
      const firstLine = m.content.trim().split('\n')[0] || '';
      const match = firstLine.match(/^(?:#{1,3}\s*)?(第[0-9一二三四五六七八九十百千万]+[章回节卷集部][^\n]*)/);
      const title = match ? match[1] : `第${idx + 1}章`;
      const wordCount = m.content.replace(/\s+/g, '').length;
      return {
        id: m.id,
        order: idx + 1,
        title,
        wordCount,
      };
    });

  // Jump to specific chapter element
  const handleScrollToChapter = (msgId: string) => {
    const el = document.getElementById(`novel-chapter-${msgId}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    setShowChaptersDrawer(false);
  };

  // Send directive and trigger AI to generate chapter
  const handleSendAndGenerate = async () => {
    if (isGenerating) return;

    const directive = inputDirective.trim();
    setInputDirective('');

    const assistantChapterCount = messages.filter((m) => m.role === 'assistant').length;
    const nextChapterNumber = assistantChapterCount + 1;

    // Create user message if directive is provided
    let updatedMessages = [...messages];
    if (directive) {
      const userMsg: ChatMessage = {
        id: `user-${Date.now()}`,
        role: 'user',
        content: directive,
        timestamp: Date.now(),
      };
      updatedMessages = [...updatedMessages, userMsg];
      setMessages(updatedMessages);
    }

    // Scroll to show new prompt
    setTimeout(scrollToBottom, 50);

    // AI Generation
    setIsGenerating(true);
    setStreamingText('');
    const controller = new AbortController();
    abortControllerRef.current = controller;

    const activePreset = presets.find((p) => p.id === project.presetId) || presets[0];

    const { systemInstruction, userPrompt } = buildNovelTurnPrompt({
      project,
      historyMessages: updatedMessages,
      currentUserDirective: directive,
      characters,
      worldbooks,
      preset: activePreset,
      nextChapterNumber,
    });

    let accumulated = '';

    try {
      await streamChat({
        provider: settings.provider,
        model: settings.model,
        customApiKey: settings.customApiKey,
        customEndpoint: settings.customEndpoint,
        temperature: settings.temperature,
        systemInstruction,
        messages: [{ role: 'user', content: userPrompt }],
        signal: controller.signal,
        onChunk: (chunk) => {
          accumulated += chunk;
          setStreamingText(accumulated);
          scrollToBottom();
        },
        onDone: () => {
          const aiMsg: ChatMessage = {
            id: `ai-${Date.now()}`,
            role: 'assistant',
            content: accumulated,
            timestamp: Date.now(),
          };
          const finalMessages = [...updatedMessages, aiMsg];
          setStreamingText('');
          setIsGenerating(false);
          commitSave(finalMessages);
          abortControllerRef.current = null;
        },
      });
    } catch (err: any) {
      if (err?.name !== 'AbortError') {
        alert(`生成异常: ${err.message || '网络连接中断'}`);
      }
      setIsGenerating(false);
      setStreamingText('');
      abortControllerRef.current = null;
    }
  };

  // Stop Generation
  const handleStopGeneration = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    // If text was accumulated, keep what was generated so far
    if (streamingText.trim()) {
      const aiMsg: ChatMessage = {
        id: `ai-${Date.now()}`,
        role: 'assistant',
        content: streamingText,
        timestamp: Date.now(),
      };
      commitSave([...messages, aiMsg]);
    }
    setStreamingText('');
    setIsGenerating(false);
  };

  // Re-roll (重新生成本章)
  const handleReroll = async (msgId: string) => {
    if (isGenerating) return;

    const targetIdx = messages.findIndex((m) => m.id === msgId);
    if (targetIdx < 0) return;

    // Messages strictly before this AI message
    const precedingMessages = messages.slice(0, targetIdx);
    const priorAiCount = precedingMessages.filter((m) => m.role === 'assistant').length;
    const chapterNumber = priorAiCount + 1;

    // Check if immediate previous message was user directive
    const prevMsg = precedingMessages[precedingMessages.length - 1];
    const userDirective = prevMsg && prevMsg.role === 'user' ? prevMsg.content : '';

    setIsGenerating(true);
    setStreamingText('');
    const controller = new AbortController();
    abortControllerRef.current = controller;

    const activePreset = presets.find((p) => p.id === project.presetId) || presets[0];

    const { systemInstruction, userPrompt } = buildNovelTurnPrompt({
      project,
      historyMessages: precedingMessages,
      currentUserDirective: userDirective,
      characters,
      worldbooks,
      preset: activePreset,
      nextChapterNumber: chapterNumber,
    });

    let accumulated = '';

    try {
      await streamChat({
        provider: settings.provider,
        model: settings.model,
        customApiKey: settings.customApiKey,
        customEndpoint: settings.customEndpoint,
        temperature: settings.temperature,
        systemInstruction,
        messages: [{ role: 'user', content: userPrompt }],
        signal: controller.signal,
        onChunk: (chunk) => {
          accumulated += chunk;
          setStreamingText(accumulated);
          scrollToBottom();
        },
        onDone: () => {
          const newAiMsg: ChatMessage = {
            id: `ai-${Date.now()}`,
            role: 'assistant',
            content: accumulated,
            timestamp: Date.now(),
          };
          // Replace target message with freshly re-rolled message
          const updated = [...precedingMessages, newAiMsg];
          setStreamingText('');
          setIsGenerating(false);
          commitSave(updated);
          abortControllerRef.current = null;
        },
      });
    } catch (err: any) {
      if (err?.name !== 'AbortError') {
        alert(`重roll异常: ${err.message || '网络连接中断'}`);
      }
      setIsGenerating(false);
      setStreamingText('');
      abortControllerRef.current = null;
    }
  };

  // Copy text to clipboard
  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Open Edit Modal
  const handleStartEdit = (msg: ChatMessage) => {
    setEditingMessage(msg);
    setEditingContent(msg.content);
  };

  // Save Edit
  const handleSaveEdit = () => {
    if (!editingMessage) return;
    const updated = messages.map((m) =>
      m.id === editingMessage.id ? { ...m, content: editingContent } : m
    );
    commitSave(updated);
    setEditingMessage(null);
  };

  // Delete Message
  const handleDelete = (msgId: string) => {
    if (confirm('确定删除此段内容吗？')) {
      const updated = messages.filter((m) => m.id !== msgId);
      commitSave(updated);
    }
  };

  // Export novel
  const handleDownloadExport = (format: 'txt' | 'md') => {
    const { filename, content } = exportNovelFromMessages(project, messages, format);
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setExportModalOpen(false);
  };

  // Total word counts across all assistant chapter text
  const totalWords = messages
    .filter((m) => m.role === 'assistant')
    .reduce((sum, m) => sum + m.content.replace(/\s+/g, '').length, 0);

  return (
    <div className="flex flex-col h-screen h-[100dvh] bg-slate-50 text-slate-800 overflow-hidden font-sans">
      {/* 顶部简洁导航栏 */}
      <header className="h-12 border-b border-slate-200/80 bg-white px-3 flex items-center justify-between shrink-0 z-20">
        <div className="flex items-center gap-2.5 min-w-0">
          <button
            type="button"
            onClick={onBack}
            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors cursor-pointer"
            title="返回书架"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>

          <input
            type="text"
            value={project.title}
            onChange={(e) => {
              const updated = { ...project, title: e.target.value };
              setProject(updated);
              commitSave(messages, updated);
            }}
            className="text-sm font-bold text-slate-800 bg-transparent focus:outline-none focus:border-b focus:border-indigo-400 max-w-[200px] truncate"
            placeholder="小说书名"
          />

          <span className="text-xs text-slate-400 font-mono hidden sm:inline">
            共 {chapterList.length} 章 · {totalWords.toLocaleString()} 字
          </span>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={() => setShowChaptersDrawer(!showChaptersDrawer)}
            className={`px-2.5 py-1 rounded-lg text-xs font-medium border flex items-center gap-1 transition-colors cursor-pointer ${
              showChaptersDrawer
                ? 'bg-indigo-50 border-indigo-200 text-indigo-700 font-semibold'
                : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
            }`}
          >
            <ListOrdered className="w-3.5 h-3.5" />
            <span>章节目录 ({chapterList.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setShowProjectDrawer(!showProjectDrawer)}
            className={`px-2.5 py-1 rounded-lg text-xs font-medium border flex items-center gap-1 transition-colors cursor-pointer ${
              showProjectDrawer
                ? 'bg-indigo-50 border-indigo-200 text-indigo-700 font-semibold'
                : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>大纲设定</span>
          </button>

          <button
            type="button"
            onClick={() => setExportModalOpen(true)}
            className="p-1.5 sm:px-2.5 sm:py-1 rounded-lg bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-medium flex items-center gap-1 transition-colors cursor-pointer"
            title="导出小说"
          >
            <Download className="w-3.5 h-3.5 text-slate-500" />
            <span className="hidden sm:inline">导出</span>
          </button>
        </div>
      </header>

      {/* 主体画布与侧栏 */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* 侧栏：章节目录（纯用来定位） */}
        {showChaptersDrawer && (
          <div className="w-64 sm:w-72 bg-white border-r border-slate-200/80 flex flex-col shrink-0 h-full overflow-hidden z-20 shadow-sm animate-in slide-in-from-left duration-150">
            <div className="p-3 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <span className="text-xs font-bold text-slate-800">章节目录定位</span>
              <button
                type="button"
                onClick={() => setShowChaptersDrawer(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-2 space-y-1">
              {chapterList.map((chap) => (
                <button
                  key={chap.id}
                  type="button"
                  onClick={() => handleScrollToChapter(chap.id)}
                  className="w-full p-2.5 rounded-lg text-left hover:bg-indigo-50/70 transition-colors flex items-center justify-between text-xs text-slate-700 group cursor-pointer"
                >
                  <span className="truncate font-medium group-hover:text-indigo-900">
                    {chap.title}
                  </span>
                  <span className="text-[10px] text-slate-400 font-mono shrink-0 ml-2">
                    {chap.wordCount.toLocaleString()} 字
                  </span>
                </button>
              ))}
              {chapterList.length === 0 && (
                <div className="py-8 text-center text-xs text-slate-400">
                  暂无章节，请在下方输入指令开始生成
                </div>
              )}
            </div>
          </div>
        )}

        {/* 侧栏：大纲与世界观设定 */}
        {showProjectDrawer && (
          <div className="w-72 sm:w-80 bg-white border-r border-slate-200/80 flex flex-col shrink-0 h-full overflow-hidden z-20 shadow-sm animate-in slide-in-from-left duration-150">
            <div className="p-3 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-1">
                {(['outline', 'characters', 'worldbooks', 'settings'] as const).map((tab) => (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => setProjectDrawerTab(tab)}
                    className={`px-2 py-1 rounded text-xs font-semibold cursor-pointer transition-colors ${
                      projectDrawerTab === tab
                        ? 'bg-indigo-600 text-white'
                        : 'text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    {tab === 'outline' && '大纲'}
                    {tab === 'characters' && '人物'}
                    {tab === 'worldbooks' && '设定'}
                    {tab === 'settings' && '配置'}
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={() => setShowProjectDrawer(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-3 text-xs space-y-3">
              {projectDrawerTab === 'outline' && (
                <div className="space-y-2">
                  <span className="text-slate-500 font-medium">全书剧情大纲走向</span>
                  <textarea
                    rows={16}
                    value={project.outline}
                    onChange={(e) => {
                      const updated = { ...project, outline: e.target.value };
                      setProject(updated);
                      commitSave(messages, updated);
                    }}
                    placeholder="在此编写全书大纲主线、主线冲突与结局走向..."
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl leading-relaxed resize-none focus:outline-none focus:bg-white focus:ring-1 focus:ring-indigo-400 font-mono"
                  />
                </div>
              )}

              {projectDrawerTab === 'characters' && (
                <div className="space-y-2">
                  <span className="text-slate-500 font-medium">关联出场人物</span>
                  <div className="space-y-1.5">
                    {characters.map((c) => {
                      const isLinked = project.characterIds.includes(c.id);
                      return (
                        <div
                          key={c.id}
                          onClick={() => {
                            const nextIds = isLinked
                              ? project.characterIds.filter((id) => id !== c.id)
                              : [...project.characterIds, c.id];
                            const updated = { ...project, characterIds: nextIds };
                            setProject(updated);
                            commitSave(messages, updated);
                          }}
                          className={`p-2 rounded-lg border cursor-pointer flex items-center justify-between ${
                            isLinked ? 'bg-indigo-50/70 border-indigo-200' : 'bg-slate-50 border-slate-200 opacity-60'
                          }`}
                        >
                          <div>
                            <span className="font-semibold">{c.name}</span>
                            <span className="text-[10px] text-slate-400 ml-1.5">({c.identity})</span>
                          </div>
                          <span className="text-[10px] font-semibold text-indigo-700">
                            {isLinked ? '已加入' : '+ 加入'}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {projectDrawerTab === 'worldbooks' && (
                <div className="space-y-2">
                  <span className="text-slate-500 font-medium">关联世界观与世界书</span>
                  <div className="space-y-1.5">
                    {worldbooks.map((wb) => {
                      const isLinked = project.worldBookIds.includes(wb.id);
                      return (
                        <div
                          key={wb.id}
                          onClick={() => {
                            const nextIds = isLinked
                              ? project.worldBookIds.filter((id) => id !== wb.id)
                              : [...project.worldBookIds, wb.id];
                            const updated = { ...project, worldBookIds: nextIds };
                            setProject(updated);
                            commitSave(messages, updated);
                          }}
                          className={`p-2 rounded-lg border cursor-pointer flex items-center justify-between ${
                            isLinked ? 'bg-indigo-50/70 border-indigo-200' : 'bg-slate-50 border-slate-200 opacity-60'
                          }`}
                        >
                          <div>
                            <span className="font-semibold">{wb.title}</span>
                            <span className="text-[10px] text-slate-400 ml-1.5">{wb.entries.length} 设定</span>
                          </div>
                          <span className="text-[10px] font-semibold text-indigo-700">
                            {isLinked ? '已关联' : '+ 关联'}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {projectDrawerTab === 'settings' && (
                <div className="space-y-3">
                  <div>
                    <label className="text-slate-600 block mb-1">题材</label>
                    <input
                      type="text"
                      value={project.genre || ''}
                      onChange={(e) => {
                        const updated = { ...project, genre: e.target.value };
                        setProject(updated);
                        commitSave(messages, updated);
                      }}
                      className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs"
                    />
                  </div>
                  <div>
                    <label className="text-slate-600 block mb-1">全局写作规则与禁忌</label>
                    <textarea
                      rows={5}
                      value={project.globalGuidance || ''}
                      onChange={(e) => {
                        const updated = { ...project, globalGuidance: e.target.value };
                        setProject(updated);
                        commitSave(messages, updated);
                      }}
                      placeholder="例如：冷峻白描、注重动作感官细节、主角不圣母..."
                      className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs resize-none"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* 核心叙事流画布：无气泡排版，玩家右输出，AI左输出 */}
        <div className="flex-1 overflow-y-auto flex justify-center pb-32">
          <div className="w-full max-w-3xl px-4 py-6">
            {/* 空白开端提示 */}
            {messages.length === 0 && !streamingText && (
              <div className="py-20 text-center space-y-2">
                <BookOpen className="w-8 h-8 mx-auto text-indigo-300" />
                <h3 className="text-sm font-bold text-slate-700">《{project.title}》长篇创作</h3>
                <p className="text-xs text-slate-400 max-w-md mx-auto leading-relaxed">
                  在下方输入框中输入第 1 章走向指令（例如：<em>第1章 主角自极北冰原苏醒，探寻古宗门残迹……</em>），点击生成开始第一章创作。
                </p>
              </div>
            )}

            {/* 消息序列 */}
            {messages.map((msg) => {
              if (msg.role === 'user') {
                // 玩家在右边输出（无气泡，纯净优雅走向指令卡）
                return (
                  <div key={msg.id} className="flex justify-end my-4 group">
                    <div className="max-w-[85%] sm:max-w-[70%] text-right">
                      <div className="inline-block text-xs text-indigo-950 bg-indigo-50/80 border border-indigo-200/70 rounded-xl px-3.5 py-2.5 shadow-2xs leading-relaxed text-left font-sans">
                        <div className="text-[10px] text-indigo-600 font-semibold mb-0.5">走向指令</div>
                        <div className="whitespace-pre-wrap">{msg.content}</div>
                      </div>

                      {/* 下方符号：复制，编辑，删除 */}
                      <div className="flex items-center justify-end gap-3 mt-1 text-[11px] text-slate-400 opacity-80 group-hover:opacity-100 transition-opacity">
                        <button
                          type="button"
                          onClick={() => handleCopy(msg.id, msg.content)}
                          className="hover:text-indigo-600 flex items-center gap-0.5 cursor-pointer transition-colors"
                          title="复制指令"
                        >
                          {copiedId === msg.id ? (
                            <Check className="w-3 h-3 text-emerald-500" />
                          ) : (
                            <Copy className="w-3 h-3" />
                          )}
                          <span>{copiedId === msg.id ? '已复制' : '复制'}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleStartEdit(msg)}
                          className="hover:text-indigo-600 flex items-center gap-0.5 cursor-pointer transition-colors"
                          title="编辑指令"
                        >
                          <Edit2 className="w-3 h-3" />
                          <span>编辑</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(msg.id)}
                          className="hover:text-rose-600 flex items-center gap-0.5 cursor-pointer transition-colors"
                          title="删除指令"
                        >
                          <Trash2 className="w-3 h-3" />
                          <span>删除</span>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              }

              // AI 在左边输出（纯净长篇小说排版，无气泡）
              return (
                <div
                  key={msg.id}
                  id={`novel-chapter-${msg.id}`}
                  className="my-6 border-b border-slate-100 pb-5 group"
                >
                  {/* 正文排版 */}
                  <div
                    className={`text-slate-800 leading-loose whitespace-pre-wrap selection:bg-indigo-100 font-serif ${
                      settings.fontSize === 'sm'
                        ? 'text-xs'
                        : settings.fontSize === 'lg'
                        ? 'text-base'
                        : settings.fontSize === 'xl'
                        ? 'text-lg'
                        : 'text-sm'
                    }`}
                  >
                    {msg.content}
                  </div>

                  {/* 下方符号：复制，编辑，重roll，删除 */}
                  <div className="flex items-center gap-3.5 mt-3 pt-2 text-xs text-slate-400 select-none">
                    <button
                      type="button"
                      onClick={() => handleCopy(msg.id, msg.content)}
                      className="hover:text-indigo-600 flex items-center gap-1 cursor-pointer transition-colors"
                      title="复制本章正文"
                    >
                      {copiedId === msg.id ? (
                        <Check className="w-3.5 h-3.5 text-emerald-500" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                      <span>{copiedId === msg.id ? '已复制' : '复制'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleStartEdit(msg)}
                      className="hover:text-indigo-600 flex items-center gap-1 cursor-pointer transition-colors"
                      title="编辑本章正文"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                      <span>编辑</span>
                    </button>

                    <button
                      type="button"
                      disabled={isGenerating}
                      onClick={() => handleReroll(msg.id)}
                      className="hover:text-indigo-600 flex items-center gap-1 cursor-pointer transition-colors disabled:opacity-50"
                      title="重新生成本章"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span>重roll</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleDelete(msg.id)}
                      className="hover:text-rose-600 flex items-center gap-1 cursor-pointer transition-colors"
                      title="删除本章"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>删除</span>
                    </button>

                    <span className="ml-auto text-[11px] text-slate-400 font-mono">
                      {msg.content.replace(/\s+/g, '').length.toLocaleString()} 字
                    </span>
                  </div>
                </div>
              );
            })}

            {/* AI 流式生成中展示 */}
            {isGenerating && streamingText && (
              <div className="my-6 border-b border-indigo-100 pb-5 animate-in fade-in duration-100">
                <div
                  className={`text-slate-800 leading-loose whitespace-pre-wrap font-serif ${
                    settings.fontSize === 'sm'
                      ? 'text-xs'
                      : settings.fontSize === 'lg'
                      ? 'text-base'
                      : settings.fontSize === 'xl'
                      ? 'text-lg'
                      : 'text-sm'
                  }`}
                >
                  {streamingText}
                  <span className="inline-block w-1.5 h-4 ml-1 bg-indigo-600 animate-pulse align-middle" />
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* 底部通栏扩宽对话框（像聊天那样） */}
        <div
          style={{ height: '130px', width: '801px' }}
          className="absolute bottom-0 left-0 right-0 mx-auto max-w-full p-3 sm:p-4 bg-gradient-to-t from-white via-white/95 to-white/60 backdrop-blur-md border-t border-slate-200/80 z-10 flex flex-col items-center justify-center"
        >
          <div className="w-full max-w-3xl">
            <div
              style={{ height: '80px' }}
              className="flex items-center gap-2 bg-white rounded-2xl border border-indigo-200 shadow-sm p-1.5 focus-within:ring-2 focus-within:ring-indigo-400 transition-all"
            >
              <textarea
                value={inputDirective}
                onChange={(e) => setInputDirective(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey && !isGenerating) {
                    e.preventDefault();
                    handleSendAndGenerate();
                  }
                }}
                disabled={isGenerating}
                placeholder="输入本章走向指令（例如：第1章 主角深入洞窟，遭遇伏击……留空直接生成）"
                className="flex-1 h-full px-3 py-2 text-xs text-slate-800 focus:outline-none placeholder:text-slate-400 bg-transparent resize-none leading-relaxed"
              />

              {isGenerating ? (
                <button
                  type="button"
                  onClick={handleStopGeneration}
                  className="px-3.5 py-1.5 bg-rose-500 hover:bg-rose-600 active:scale-95 text-white rounded-xl text-xs font-bold flex items-center gap-1 transition-all cursor-pointer shadow-xs shrink-0 self-center"
                >
                  <Square className="w-3.5 h-3.5 fill-current" />
                  <span>停止</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleSendAndGenerate}
                  className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white rounded-xl text-xs font-bold flex items-center gap-1 transition-all cursor-pointer shadow-xs shrink-0 self-center"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>生成</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 弹窗：编辑内容 */}
      {editingMessage && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden">
            <div className="p-3.5 border-b border-slate-100 flex items-center justify-between">
              <span className="font-bold text-xs text-slate-800">
                编辑{editingMessage.role === 'user' ? '走向指令' : '章节正文'}
              </span>
              <button
                type="button"
                onClick={() => setEditingMessage(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 flex-1 overflow-y-auto">
              <textarea
                rows={12}
                value={editingContent}
                onChange={(e) => setEditingContent(e.target.value)}
                className="w-full p-3 rounded-xl border border-slate-200 text-xs text-slate-800 leading-relaxed focus:outline-none focus:ring-1 focus:ring-indigo-400 font-serif resize-none"
              />
            </div>

            <div className="p-3 border-t border-slate-100 flex items-center justify-end gap-2 bg-slate-50/50">
              <button
                type="button"
                onClick={() => setEditingMessage(null)}
                className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs text-slate-600"
              >
                取消
              </button>
              <button
                type="button"
                onClick={handleSaveEdit}
                className="px-4 py-1.5 rounded-lg bg-indigo-600 text-white font-bold text-xs"
              >
                保存修改
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 导出弹窗 */}
      {exportModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-xs p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-800 text-xs">导出全书</span>
              <button
                type="button"
                onClick={() => setExportModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <button
                type="button"
                onClick={() => handleDownloadExport('txt')}
                className="py-2 px-3 rounded-xl border border-slate-200 hover:bg-indigo-50 hover:text-indigo-700 font-semibold text-center cursor-pointer transition-colors"
              >
                导出 TXT
              </button>
              <button
                type="button"
                onClick={() => handleDownloadExport('md')}
                className="py-2 px-3 rounded-xl border border-slate-200 hover:bg-indigo-50 hover:text-indigo-700 font-semibold text-center cursor-pointer transition-colors"
              >
                导出 Markdown
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
