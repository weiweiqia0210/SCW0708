import {
  NovelProject,
  CharacterCard,
  WorldBook,
  SystemPreset,
  ChatMessage,
} from '../types';

/**
 * Format Novel for Export (TXT or Markdown) from Messages stream
 */
export function exportNovelFromMessages(
  project: NovelProject,
  messages: ChatMessage[],
  format: 'txt' | 'md'
): { filename: string; content: string } {
  const safeTitle = project.title.replace(/[\\/:*?"<>|]/g, '_');
  const filename = `${safeTitle}.${format}`;
  const assistantMessages = messages.filter((m) => m.role === 'assistant' && m.content.trim());

  let content = '';

  if (format === 'md') {
    content += `# ${project.title}\n\n`;
    if (project.summary) {
      content += `> **大纲立意**：${project.summary}\n\n`;
    }
    content += `---\n\n`;

    assistantMessages.forEach((msg, idx) => {
      const text = msg.content.trim();
      const hasHeading = /^(?:#{1,3}\s*)?第[0-9一二三四五六七八九十百千万]+[章回节卷集部]/.test(text);
      if (!hasHeading) {
        content += `## 第${idx + 1}章\n\n`;
      }
      content += `${text}\n\n---\n\n`;
    });
  } else {
    content += `《${project.title}》\n\n`;
    if (project.summary) {
      content += `【大纲立意】\n${project.summary}\n\n`;
    }
    content += `==============================\n\n`;

    assistantMessages.forEach((msg, idx) => {
      const text = msg.content.trim();
      const hasHeading = /^第[0-9一二三四五六七八九十百千万]+[章回节卷集部]/.test(text);
      if (!hasHeading) {
        content += `第${idx + 1}章\n\n`;
      }
      content += `${text}\n\n------------------------------\n\n`;
    });
  }

  return { filename, content };
}

/**
 * Build System & Context Prompt for Novel Turn Writing
 */
export function buildNovelTurnPrompt(params: {
  project: NovelProject;
  historyMessages: ChatMessage[];
  currentUserDirective: string;
  characters: CharacterCard[];
  worldbooks: WorldBook[];
  preset?: SystemPreset;
  nextChapterNumber: number;
}): { systemInstruction: string; userPrompt: string } {
  const {
    project,
    historyMessages,
    currentUserDirective,
    characters,
    worldbooks,
    preset,
    nextChapterNumber,
  } = params;

  // 1. System Instruction
  const systemLines: string[] = [
    '你是一位专业长篇连载小说家与文学创作引擎。你正在与玩家协作撰写一部连贯的长篇小说。',
    '【核心要求】',
    '1. 严禁出现任何AI客套话（如“好的”、“接下来为你撰写”、“希望你喜欢”等），严禁出现【本章完】等无关跳戏标签，直接输出小说正文。',
    '2. 深度结合全书大纲、世界观设定与登场人物性格，注重环境氛围白描、动作神态感官细节与情节冲突推进，拒绝流水账或大纲概括。',
    '3. 紧密承接前文已有章节的发展轨迹与结局，保持剧情与人设绝对连贯。',
  ];

  if (preset?.contentPrompt) {
    systemLines.push(`【全局预设写作风格与指令】\n${preset.contentPrompt}`);
  }

  if (project.globalGuidance) {
    systemLines.push(`【作者全局写作规则与禁忌】\n${project.globalGuidance}`);
  }

  const systemInstruction = systemLines.join('\n\n');

  // 2. Context Assembly
  const contextSections: string[] = [];

  contextSections.push(`【小说概况】\n书名：《${project.title}》\n题材：${project.genre || '长篇小说'}`);

  if (project.outline?.trim()) {
    contextSections.push(`【全书大纲主线走向】\n${project.outline.trim()}`);
  }

  // Worldview
  const activeWorldbooks = worldbooks.filter((wb) => project.worldBookIds.includes(wb.id));
  if (activeWorldbooks.length > 0) {
    const wbLines: string[] = [];
    activeWorldbooks.forEach((wb) => {
      wbLines.push(`▶ 世界书【${wb.title}】`);
      wb.entries
        .filter((e) => e.enabled)
        .slice(0, 15)
        .forEach((entry) => {
          wbLines.push(`- [${entry.name}]: ${entry.content}`);
        });
    });
    contextSections.push(`【世界观资料设定】\n${wbLines.join('\n')}`);
  }

  // Characters
  const activeCharacters = characters.filter((c) => project.characterIds.includes(c.id));
  if (activeCharacters.length > 0) {
    const charLines: string[] = [];
    activeCharacters.forEach((c) => {
      charLines.push(
        `- ${c.name}（${c.gender || '未知'}，${c.identity || '角色'}）：性格【${c.personality || '未详'}】，言谈【${c.speechStyle || '普通'}】，背景【${c.background || '未详'}】`
      );
    });
    contextSections.push(`【核心登场人物档案】\n${charLines.join('\n')}`);
  }

  // Preceding Story History (from prior assistant messages)
  const priorChapters = historyMessages.filter((m) => m.role === 'assistant' && m.content.trim());
  if (priorChapters.length > 0) {
    const historyParts: string[] = [];
    priorChapters.forEach((msg, idx) => {
      const text = msg.content.trim();
      const preview = text.length > 1500 ? text.slice(-1500) : text;
      historyParts.push(`--- [已发生剧情 第${idx + 1}章 关键内容] ---\n${preview}`);
    });
    contextSections.push(`【前文已有章节正文推演（请紧密承接其后自然演进）】\n${historyParts.join('\n\n')}`);
  }

  // Current directive
  const directive = currentUserDirective.trim();
  const taskLines: string[] = [
    `【正在撰写章节】第${nextChapterNumber}章`,
  ];

  if (directive) {
    taskLines.push(`【本章走向与作者指令】\n${directive}`);
    taskLines.push(`【写作任务】请以“第${nextChapterNumber}章 [章节小标题]”开头，严格依照上述“本章走向与作者指令”，自然承接前文继续推演本章完整精彩正文（建议字数约 1200 - 2000 字）。直接输出正文，无任何客套废话。`);
  } else {
    taskLines.push(`【写作任务】请以“第${nextChapterNumber}章 [章节小标题]”开头，紧密承接上文故事结局与主线大纲，向下自然推演出本章引人入胜的精彩正文（建议字数约 1200 - 2000 字）。直接输出正文，无任何客套废话。`);
  }

  contextSections.push(taskLines.join('\n\n'));

  const userPrompt = contextSections.join('\n\n====================\n\n');

  return { systemInstruction, userPrompt };
}

/**
 * Build Prompt for Text Polish, Rewrite, Expansion, Condensation
 */
export function buildNovelEditPrompt(params: {
  action: 'polish' | 'expand' | 'condense';
  selectedText: string;
  contextText?: string;
  directive?: string;
  stylePreset?: string;
}): { systemInstruction: string; userPrompt: string } {
  const { action, selectedText, contextText, directive, stylePreset } = params;

  let actionDesc = '';
  if (action === 'polish') {
    actionDesc = '提升文笔文采、修辞韵味与节奏感，消除生硬表达，增强画面感与感染力';
  } else if (action === 'expand') {
    actionDesc = '场景与细节扩写：深入刻画环境氛围、感官细节、心理微澜与肢体动作';
  } else if (action === 'condense') {
    actionDesc = '精炼缩写：去除冗余赘述，加快叙事节奏，保持干练紧凑';
  }

  const systemInstruction = `你是一位顶尖小说编辑。你的任务是对选定的小说文本进行高质量的${actionDesc}。
严禁出现任何解释性废话或客套话，直接输出修改后的最终小说文本。`;

  const promptParts: string[] = [];
  if (stylePreset) {
    promptParts.push(`【写作风格】\n${stylePreset}`);
  }
  if (contextText) {
    promptParts.push(`【前后文参考】\n${contextText.slice(-400)}`);
  }
  promptParts.push(`【需要处理的原文本】\n${selectedText}`);
  if (directive) {
    promptParts.push(`【补充指令】\n${directive}`);
  }
  promptParts.push(`【任务】执行【${actionDesc}】。直接输出优化后的文本正文。`);

  return {
    systemInstruction,
    userPrompt: promptParts.join('\n\n'),
  };
}
