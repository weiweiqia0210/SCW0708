import { CharacterCard, WorldBook, SystemPreset, GameStatDefinition, StorySaveConfig, StorySave, WorldBookEntry, UserMask } from '../types';

export function buildSystemInstruction(
  save: StorySave,
  characters: CharacterCard[],
  worldbook?: WorldBook | WorldBook[],
  preset?: SystemPreset | SystemPreset[],
  userMask?: UserMask
): string {
  const parts: string[] = [];

  parts.push(`【文游系统设定】
你是一名顶尖的互动叙事大师与文学跑团DM。正在运行一场高质量、沉浸式的互动文游。
请以深厚的文学造诣、细腻的情感笔触与画面感极强的分镜语言，为玩家呈现跌宕起伏的互动旅程。`);

  if (save.mode === 'novel') {
    parts.push(`【当前模式：沉浸式连载小说创作模式（Novel Mode）】
本场文游以高水准长篇小说连载为叙事架构，请遵循严肃文学与精品流行小说的创作规范：
1. 小说文学质感：注重环境构图、光影声色、时代质感、心理潜流与人物动作微表情，行文讲究文学美感与阅读沉浸感；
2. 章节式叙事起伏：每轮推演如同一小节结构严谨的小说正文，承接前情并设置微悬念或情境转折，段落排版分明；
3. 人物鲜活动态：出场角色的对话与心理动机紧密咬合，主次分明，顺应剧情因果水到渠成推进；
4. 叙事连贯自然：将玩家的每次指令或互动自然化作小说情节发展的内在动力，以纯粹的小说正文呈现，绝不出戏或使用说教口吻。`);
  }

  // Output word count range or free play
  if (save.config.wordCountConstraintEnabled) {
    const minW = save.config.wordCountMin ?? 300;
    const maxW = save.config.wordCountMax ?? 800;
    parts.push(`【每次输出字数要求（严格遵循）】：
本场游戏已开启自定义字数区间，每轮回复字数必须严格控制在 ${minW} 字至 ${maxW} 字之间（不低于 ${minW} 字，不超过 ${maxW} 字）。`);
  } else if (save.config.wordCountConstraintEnabled === false) {
    parts.push(`【每次输出字数规范】：
字数限制已关闭。请AI完全自主发挥，根据剧情张力与情节发展自然掌控篇幅，不受固定字数限制。`);
  } else {
    const wordCountMap = {
      short: '每轮回复目标字数：精炼紧凑，约 150 - 300 字。',
      medium: '每轮回复目标字数：充实饱满，约 400 - 800 字。',
      long: '每轮回复目标字数：长篇细腻，约 800 - 1500 字。',
    };
    parts.push(`【篇幅规范】：${wordCountMap[save.config.targetWordCount] || wordCountMap.medium}`);
  }

  // Narrative perspective (人称代词选择)
  const perspective = save.config.narrativePerspective || 'second';
  if (perspective === 'first') {
    parts.push(`【叙事视角与人称】：采用【第一人称】叙事。涉及互动主角体验、心理、视线与动作时使用“我”（例如：“我握紧了刀柄……”、“我看见眼前……”）。`);
  } else if (perspective === 'third') {
    const userDisplayName = userMask?.name ? `玩家姓名“${userMask.name}”` : '玩家姓名';
    parts.push(`【叙事视角与人称】：采用【第三人称】叙事。
- 叙事指代规则：严禁使用第二人称“你”或第一人称“我”来指代玩家。
- 称谓平衡规则（重中之重）：在描写涉及玩家角色时，【必须自然穿插结合使用“姓名”与“代词（他/她）”】！
  * 严禁整篇从头到尾只机械重复名字（会显得生硬失真）；
  * 严禁整篇从头到尾只使用“他/她”而丢失玩家姓名；
  * 正确要求：必须做到【姓名 / 他 / 她】自然交织、有机融合（例如：以${userDisplayName}作为主语引入，随后的动作神态自然承接代词“他”或“她”，在多人互动或场景切换时适时再次出现姓名，使行文生动自然）。`);
  } else {
    parts.push(`【叙事视角与人称】：采用【第二人称】互动叙事。以“你”作为互动主体指代玩家推进故事与环境互动（例如：“你推开殿门……”、“你注意到……”）。`);
  }

  // Interaction Play Mode (对话模式 vs 导演模式)
  const isDirectorMode = save.config.playMode === 'director';
  if (isDirectorMode) {
    parts.push(`【交互模式：导演模式】：
玩家在对话框中的所有输入，均被视为对本场戏的【场景指导 / 剧情导向指令】（如指示场景氛围、安排突发事件、环境走向、NPC行动动机等），而非角色台词。
AI应将玩家的输入作为场景导演指令来推演整个场景。
${save.config.antiImpersonationEnabled !== false ? '因防抢话开关开启，场景中涉及玩家角色时，切勿擅自替玩家角色做决定或替玩家说话。' : '因防抢话开关关闭，AI可根据导演指示统筹调度包含玩家在内的各方人物言行与剧情推进。'}`);
  } else {
    parts.push(`【交互模式：对话模式】：
玩家在对话框中的每次发言，均被视为玩家角色在场景中面对面的直接发言或台词动作。
NPC与现场环境必须直接承接玩家的发言，进行面对面的交互与对话应答。`);
  }

  // Anti-impersonation rule (防抢话开关)
  if (save.config.antiImpersonationEnabled !== false) {
    const playerName = userMask?.name ? `玩家“${userMask.name}”` : '玩家（User）';
    parts.push(`【🚨 最高红线禁令·防抢话规则（违者严重越界，必须绝对服从）】：
防抢话开关处于【强制开启】状态。你的身份【绝对仅限于扮演 NPC 与世界环境】，【绝对禁止扮演${playerName}】！
请把以下四条红线作为最高硬性约束：
1. 🚫【绝对禁止替玩家说出任何台词】：
   严禁在输出中生成任何属于玩家的对话、言论或口头回答（无论使用第二人称“你”、姓名“${playerName}”还是第三人称“他/她”），严禁为玩家角色添加任何双引号台词（如“...”）！
2. 🚫【绝对禁止替玩家做出任何行动决策】：
   严禁替玩家做出任何主动动作（如替玩家“点头同意”、“拔剑冲去”、“接过物品”、“跟随前往”、“伸手阻拦”等）。玩家上一轮做了什么就是什么，你绝不能替玩家擅自推进随后的新动作！
3. 🚫【绝对禁止描写玩家的内心与主观感受】：
   严禁描写玩家“心中暗想”、“感到震惊”、“犹豫不决”、“内心动摇”等任何主观心理！主观意识完全归玩家所有。
4. 🛑【必须在 NPC 反应完毕后立即停笔】：
   你的描写仅能包含：NPC对玩家上一句话的言语回复、神情体态变化、现场客观环境的演化。一旦NPC说完话或把局势/选择抛给玩家，【必须立刻刹车停笔】，交还发言权等待玩家在输入框中自主输入！`);
  } else {
    parts.push(`【防抢话已关闭】：
AI可根据剧情流畅度自然编排与推进互动，适度代入或自然顺承玩家角色的连贯动作与配合反应。`);
  }

  // Writing guidance (本场写作指导)
  if (save.config.writingGuidance && save.config.writingGuidance.trim()) {
    parts.push(`【本场专属写作指导（玩家特别指定）】：
${save.config.writingGuidance.trim()}`);
  }

  // User Mask (Player Identity Card) or Observer Mode
  if (save.config.userMaskEnabled === false || !save.userMaskId || !userMask) {
    parts.push(`【玩家参演模式：观察者 / 客观视角（User 不作为角色参与本次故事）】：
本次故事已关闭玩家面具，User 不作为剧中的具体角色参演。
请严格以纯群像视角或第三人称客观叙事推进故事。不要在叙事中为玩家预设立场、身份、代号或称谓，所有登场角色各自围绕自身动机、人设心性与当前境遇自然互动，不与玩家产生绑定式的亲近或敌对关系。玩家作为客观观察者与故事推演者推进剧情。`);
  } else if (userMask) {
    const maskLines: string[] = [];
    maskLines.push(`- 姓名：${userMask.name || '未设'}`);
    if (userMask.codeName) maskLines.push(`- 代号：${userMask.codeName}`);
    if (userMask.nickname) maskLines.push(`- 昵称：${userMask.nickname}`);
    if (userMask.gender) maskLines.push(`- 性别：${userMask.gender}`);
    if (userMask.identity) maskLines.push(`- 身份：${userMask.identity}`);
    if (userMask.appearance) maskLines.push(`- 外貌：${userMask.appearance}`);
    if (userMask.personality) maskLines.push(`- 性格：${userMask.personality}`);
    if (userMask.customNotes) maskLines.push(`- 额外设定：${userMask.customNotes}`);
    if (userMask.speechStyle) maskLines.push(`- 言谈习惯：${userMask.speechStyle}`);

    parts.push(`【当前玩家(User)人设卡档案】：
玩家当前穿戴的人设卡档案如下：
${maskLines.join('\n')}
NPC及世界剧情对玩家的态度、称谓（可根据交情熟稔度与情境合理称呼其真实姓名、行动代号或昵称）、互动与防备需严格契合该人设卡。玩家依然保留完全自由的行动权与决策权。`);
  }

  // Normalize worldbooks and presets (supports multiple)
  const worldbookList: WorldBook[] = Array.isArray(worldbook)
    ? worldbook
    : worldbook
    ? [worldbook]
    : [];
  const presetList: SystemPreset[] = Array.isArray(preset)
    ? preset
    : preset
    ? [preset]
    : [];

  // Collect and sort worldbook entries across all linked worldbooks by priority (descending)
  const allEntriesRaw: WorldBookEntry[] = [];
  worldbookList.forEach((wb) => {
    if (wb && wb.entries) {
      wb.entries.forEach((entry) => {
        if (entry.enabled) allEntriesRaw.push(entry);
      });
    }
  });

  const seenEntryIds = new Set<string>();
  const activeEntries = allEntriesRaw
    .filter((e) => {
      if (seenEntryIds.has(e.id)) return false;
      seenEntryIds.add(e.id);
      return true;
    })
    .sort((a, b) => (b.priority ?? 50) - (a.priority ?? 50));

  const formatEntries = (entries: WorldBookEntry[]) =>
    entries.map(e => `[${e.name}] (优先级:${e.priority ?? 50}, 关键词:${e.keywords.join(', ')}): ${e.content}`).join('\n');

  // 1. Worldbook entries with insertionPosition === 'system'
  const systemEntries = activeEntries.filter(e => e.insertionPosition === 'system');
  if (systemEntries.length > 0) {
    parts.push(`【世界观核心规则（系统级设定）】\n${formatEntries(systemEntries)}`);
  }

  // 2. Preset custom prompts (supports multiple combined presets)
  if (presetList.length > 0) {
    const presetBlocks = presetList
      .filter((p) => p && p.contentPrompt)
      .map((p) => `【叙事预设 - ${p.title}】\n${p.contentPrompt}`);
    if (presetBlocks.length > 0) {
      parts.push(presetBlocks.join('\n\n'));
    }
  }

  // 3. Worldbook entries before characters
  const beforeCharEntries = activeEntries.filter(e => e.insertionPosition === 'before_character' || !e.insertionPosition);
  if (beforeCharEntries.length > 0) {
    parts.push(`【世界观与环境背景设定】\n${formatEntries(beforeCharEntries)}`);
  }

  // 4. Active characters with role tiers (主角 / 配角 / 群演)
  const activeChars = characters.filter(c => save.characterIds.includes(c.id));
  if (activeChars.length > 0) {
    const getRoleName = (charId: string, defaultRole?: string) => {
      const assigned = save.characterRoleMap?.[charId] || defaultRole;
      if (assigned === 'protagonist') return '【主角】';
      if (assigned === 'supporting') return '【配角】';
      if (assigned === 'extra') return '【群演】';
      return '';
    };

    parts.push(`【登场角色档案】
${activeChars.map((c, i) => `--- 角色 ${i + 1}：${c.name} ${getRoleName(c.id, c.roleType)} (${c.identity}) ---
- 外貌容姿：${c.appearance}
- 性格心性：${c.personality}
- 背景渊源：${c.background}
- 说话习惯与语气：${c.speechStyle}
- 秘密与特殊备注：${c.customNotes}`).join('\n\n')}`);

    if (save.characterRoleMap && Object.keys(save.characterRoleMap).length > 0) {
      parts.push(`【群像叙事·人物戏份重要度与剧情展开原则（核心法则）】：
AI必须充分理解当前登场人物的戏份权重与重要度分布，让叙事重心聚焦于核心人物，但【必须遵循自然故事逻辑，顺其自然随剧情推移发展，绝对禁止机械加戏或突发剧情杀】：

1. 标为【主角】的人物（核心戏份与命运重心）：
   - 在群像世界中占据最核心的叙事权重与故事发展空间，其神态动作、心理起伏、与玩家/世界的深层羁绊是重点刻画的对象；
   - ⚠️【严禁突兀剧情杀与机械硬塞剧情】：主角戏份展开必须严格依托当下场景的因果逻辑，水到渠成、顺其自然随情节演进逐步展现，绝不可为了突显其核心地位而毫无铺垫地突发“剧情杀”、断崖式强塞超量戏份或强行安排生硬的情节转折；

2. 标为【配角】的人物（重要剧情推进者与羁绊交织）：
   - 戏份比重次于主角，在情境因由合理、主线或支线推进需要时自然登场，与主角及玩家展开鲜明对话对质、合作或情节反转；
   - 具备独立且鲜活的人设立场与行事动机，不盲目沦为陪衬，亦不喧宾夺主抢占主角的长线叙事主轴；

3. 标为【群演】的人物（环境与市井背景角色）：
   - 戏份最轻，主要承担场景氛围渲染、市井声色烘托、局部关键信息通报或环境线索过渡；
   - 言行简明利落、点到即止，随剧情场景转换而自然淡出，绝不拖泥带水或喧宾夺主。

【总体群像因果原则】：尊重剧本内在发展因果，所有角色的登场、互动与戏份倾斜均需顺理成章、水到渠成，做到主次分明、剧情流转浑然天成。`);
    }
  }

  // 5. Worldbook entries after characters
  const afterCharEntries = activeEntries.filter(e => e.insertionPosition === 'after_character');
  if (afterCharEntries.length > 0) {
    parts.push(`【地点势力与附加规则设定】\n${formatEntries(afterCharEntries)}`);
  }

  // 6. Core Game Stats & Background Tracking System (Per-character independent tracking)
  const isStatsTrackingActive = save.config.statsTrackingEnabled !== false;
  const disabledCharIds = save.disabledCharacterStatIds || [];
  const recalcPendingIds = save.recalcPendingCharacterIds || [];
  const allActiveCharsDisabled = activeChars.length > 0 && activeChars.every((c) => disabledCharIds.includes(c.id));
  const activeCharsNotDisabled = activeChars.filter((c) => !disabledCharIds.includes(c.id));

  if (!isStatsTrackingActive || allActiveCharsDisabled) {
    parts.push(`【数值追踪系统已关闭（纯文学叙事模式）】：
本场文游已完全关闭好感度与属性数值追踪系统${allActiveCharsDisabled ? '（登场角色状况追踪已设为关闭）' : ''}。
1. 请专注于纯粹的文学描写、光影声色、情节因果推进与角色沉浸对话；
2. 严禁在思考过程中计算任何角色的数值波动；
3. 严禁在每轮回复中输出任何 <!--STATS_UPDATE--> 标签或数值变动信息，正文中亦严禁输出任何加减好感度等数值提示。`);
  } else if (save.stats && save.stats.length > 0 && activeCharsNotDisabled.length > 0) {
    const validStatNames = Array.from(
      new Set(save.stats.filter((s) => s.enabled).map((s) => s.name))
    );

    const charStatsBlocks = activeChars.map((char) => {
      const isCharDisabled = disabledCharIds.includes(char.id);
      const isRecalcPending = recalcPendingIds.includes(char.id);

      if (isCharDisabled) {
        return `【角色：${char.name}】（该人物状况追踪已关闭，后台不记录其数值变化）`;
      }

      const charStats = save.stats.filter(
        (s) => (s.characterId === char.id || s.characterName === char.name) && s.enabled
      );

      if (charStats.length === 0) {
        return `【角色：${char.name}】暂无属性`;
      }

      if (isRecalcPending) {
        const sampleRecalc = charStats.map((s) => `"${s.name}": ${s.currentValue}`).join(', ');
        return `【角色：${char.name}】（⚠️ 刚重新开启状况追踪！请结合截至目前的上下文剧情，重新计算并给出该角色各项数值，以 <!--STATS_RECALC: {"${char.name}": {${sampleRecalc}}} --> 输出）`;
      }

      return `【角色：${char.name}】当前独立数值（严格以此列表为准）：\n` +
        charStats.map((s) => `  - ${s.name}：当前值 ${s.currentValue}${s.unit}（取值范围 ${s.minValue} ~ ${s.maxValue}）`).join('\n');
    });

    const corruptionRuleText = save.config.corruptionConstraintEnabled !== false
      ? '极其正面、高洁纯良的角色形象，黑化值强制锁定为 0；复杂、灰色或反面性格角色，可随剧情经历合理增减。'
      : '黑化人设约束已关闭：所有角色（包括正面高洁形象）均与其他属性一致，完全随剧情经历、遭遇诱惑或挫折打击正常增减黑化值。';

    const exampleStat1 = validStatNames[0] || '好感度';
    const exampleStat2 = validStatNames.length > 1 ? validStatNames[1] : '';
    const exampleDeltaObj = exampleStat2 ? `{"${exampleStat1}": 2, "${exampleStat2}": -1}` : `{"${exampleStat1}": 2}`;

    parts.push(`【各角色独立数值与后台因果系统】
群像及多角色模式下，每个角色的属性数值相互独立，绝不共用同一套数值：
${charStatsBlocks.join('\n\n')}

【🚨 属性变动最高执行白名单禁令（必须绝对严格服从，违者严重越界）】：
1. 属性严格白名单：当前有效设定的属性【仅限且严格限定为以下列出的属性】：
   👉【${validStatNames.join('、')}】
2. 严禁思考与输出已删除的属性：
   玩家若已删除某项属性（例如上述有效列表中【没有】出现“戒备值”或其他已被玩家删除的项），【绝对禁止在思考过程中擅自计算该属性，绝对严禁在 <!--STATS_UPDATE--> 中输出任何增减】！任何未在上方列出的已删除属性均视为非法数据，必须彻底剔除！
3. 本轮后台因果计算：
   只能且必须仅在上述有效设定的属性（${validStatNames.join('、')}）中，根据角色在剧情中的经历合理增减。未变动的属性无需包含。

系统内置核心数值运作法则（严格遵循，不向玩家暴露系统元规则）：
1. 真实真人感与剧情走向：
   每个角色的数值都深刻影响其言行、神情、潜意识态度和剧情走向，严禁当成摆设，严禁突兀加好感或长期僵死无波动。
   各角色表面言行贴合人设，但内在态度与数值可以具有鲜明反差。
2. 精神值与体力值的环境动态感应与日常稳态：
   - 角色精神值与体力值密切随剧情环境优劣而波动：
     * 环境优渥、舒适安全、得到温情照料时，角色体力充沛，精神值自然饱满高涨；
     * 环境恶劣、严寒饥渴、逼仄险恶时，角色体力急剧消耗，精神值持续走低；
     * 特殊设定豁免：除非角色人设卡明确标注其内心极其强大、意志坚韧不可摧折，才可在恶劣逆境中依然维持高精神值；
     * 日常稳态基线：在平常日常状态下，角色常规精神值基本稳定在 80 左右；若剧情处于危机、险境或重大变故，则根据角色具体处境实时调整。
3. 精神值归零与【人物崩坏】（必须根据人设深刻演绎，严禁脸谱化）：
   - 当任意角色的精神值降至 0 时，立即触发【人物崩坏】！
     * 崩溃反应必须严格根据人设因人而异：例如老实纯良的好人可能会绝望选择自我了结或彻底自闭；聪慧敏锐的人可能会选择离开回避、长期下线自我调节；性格恶劣之徒则会将巨大压力宣泄向外人进行残酷施暴、丧心病狂地报复；
     * 性格恶劣阴暗者若精神值降低，其【黑化值】会相应显著升高！
4. 黑化值规则：
   ${corruptionRuleText}
5. 好感度与爱慕值规则：
   单人好感度上限 100。达到 100 后锁定为 100 并开启【爱慕值】（0~100+），后续深情全部转入该角色的【爱慕值】；若好感度跌破 100，爱慕值自动消失。
6. 后台追踪与本轮数值变动输出格式（必须分角色输出，且仅限上述有效白名单中的属性）：
   无论前台是否开启显示，只要角色状况未关闭，每轮回复最末尾必须分角色输出变动量（未变动的数值无需包含）：
<!--STATS_UPDATE: {"${activeCharsNotDisabled[0]?.name || '角色名'}": ${exampleDeltaObj}} -->
若多名角色同时变动，必须分别归于各角色名下：
<!--STATS_UPDATE: {"${activeCharsNotDisabled[0]?.name || '角色A'}": {"${exampleStat1}": 2}, "${activeCharsNotDisabled[1]?.name || '角色B'}": {"${exampleStat1}": -1}} -->
（注意：JSON数值内请使用纯数字如 2 或 -1，不要带加号）`);
  }

  // 7. Inner thoughts (Must be inserted inline into the narrative where action happens)
  if (save.config.innerVoiceEnabled && activeChars.length > 0) {
    const charNames = activeChars.map(c => c.name).join('、');
    parts.push(`【角色心声系统（必须跟随情节在文中就地插入，绝对禁止堆在文首或文末）】：
登场角色（${charNames}）在剧情中的心声独白，【必须紧随剧情展开，就地插入在正文发生动作、对视、对话停顿的自然段落之间】！
严禁将心声堆在文首第一段，严禁将心声集中在文末！
当剧情推进到某个角色发生特定动作、眼神闪烁、产生隐秘心理波动的情节点时，立刻在该情节正文段落下方直接就地插入：
<!--THOUGHT:角色名:紧扣此时此刻具体情节的内心独白-->
例如：
“你方才说的那些话，可还作数？”${activeChars[0]?.name || '角色'}握紧了腰间的佩剑，指节因用力而泛白。
<!--THOUGHT:${activeChars[0]?.name || '角色'}:明知这或许又是一场诱捕，我却依然忍不住想去信他一次……-->
他深吸了一口气，松开剑柄，目光复杂地望向你。`);
  }

  // 8. Branch choices
  if (save.config.branchChoicesEnabled) {
    parts.push(`【剧情交互选项功能已启用】：
请在回复结尾提供 2 到 4 个简明而有张力的可能行动启发，放在标签中供玩家参考（但玩家依然完全可以自由输入任意自由文本）：
<!--BRANCHES: ["探索右侧幽暗回廊", "质问对方隐瞒的真相", "拔出短刃保持戒备"] -->`);
  }

  // 9. Worldbook entries at history end
  const historyEndEntries = activeEntries.filter(e => e.insertionPosition === 'history_end');
  if (historyEndEntries.length > 0) {
    parts.push(`【即时情境线索（终末优先判定）】\n${formatEntries(historyEndEntries)}`);
  }

  return parts.join('\n\n');
}

export interface ParsedAIResponse {
  cleanText: string;
  statsDelta: Record<string, number>;
  statsDeltaByCharacter: Record<string, Record<string, number>>;
  recalcStats?: Record<string, Record<string, number>>;
  thoughts: Record<string, string>;
  suggestedBranches: string[];
}

export function parseAIResponseTags(rawText: string): ParsedAIResponse {
  let cleanText = rawText;
  const statsDelta: Record<string, number> = {};
  const statsDeltaByCharacter: Record<string, Record<string, number>> = {};
  let recalcStats: Record<string, Record<string, number>> | undefined = undefined;
  const thoughts: Record<string, string> = {};
  let suggestedBranches: string[] = [];

  // Helper to sanitize JSON string (handles +2, trailing commas, single quotes)
  const sanitizeJson = (str: string): string => {
    return str
      .replace(/:\s*\+(\d+)/g, ': $1') // change "+2" to "2"
      .replace(/'/g, '"')
      .replace(/,\s*\}/g, '}')
      .replace(/,\s*\]/g, ']');
  };

  // 1. Match STATS_RECALC: <!--STATS_RECALC: {"角色名": {"好感度": 50, ...}} -->
  const recalcRegex = /<!--(?:STATS_RECALC|RECALC_STATS|RECALC):\s*(\{.*?\})\s*-->/s;
  const recalcMatch = cleanText.match(recalcRegex);
  if (recalcMatch && recalcMatch[1]) {
    try {
      const sanitized = sanitizeJson(recalcMatch[1]);
      const parsed = JSON.parse(sanitized);
      if (typeof parsed === 'object') {
        recalcStats = parsed;
      }
    } catch (e) {
      console.warn('Failed to parse STATS_RECALC tag:', e);
    }
    cleanText = cleanText.replace(recalcRegex, '');
  }

  // 2. Match STATS_UPDATE: <!--STATS_UPDATE: {"角色名": {"好感度": 2}} --> or flat {"好感度": 2}
  const statsRegex = /<!--(?:STATS_UPDATE|STATS|STAT_UPDATE|STATS_DELTA|数值变动):\s*(\{.*?\})\s*-->/s;
  const statsMatch = cleanText.match(statsRegex);
  if (statsMatch && statsMatch[1]) {
    let parsedSuccess = false;
    try {
      const sanitized = sanitizeJson(statsMatch[1]);
      const parsed = JSON.parse(sanitized);
      if (typeof parsed === 'object' && parsed !== null) {
        for (const [key, val] of Object.entries(parsed)) {
          if (typeof val === 'number') {
            statsDelta[key] = val;
          } else if (typeof val === 'object' && val !== null) {
            statsDeltaByCharacter[key] = statsDeltaByCharacter[key] || {};
            for (const [sKey, sVal] of Object.entries(val as Record<string, any>)) {
              const numVal = Number(sVal);
              if (!isNaN(numVal)) {
                statsDeltaByCharacter[key][sKey] = numVal;
                statsDelta[sKey] = numVal;
              }
            }
          }
        }
        parsedSuccess = true;
      }
    } catch (e) {
      console.warn('JSON parse on STATS_UPDATE failed, trying regex fallback:', e);
    }

    // Fallback regex parser for non-strict JSON like {"林清寒": {"好感度": +2, "戒备值": -1}}
    if (!parsedSuccess) {
      const rawBody = statsMatch[1];
      // Match "角色名": { ... }
      const charBlockRegex = /["']?([^"'{}:,]+)["']?\s*:\s*\{([^}]+)\}/g;
      let blockMatch: RegExpExecArray | null;
      while ((blockMatch = charBlockRegex.exec(rawBody)) !== null) {
        const charName = blockMatch[1].trim();
        const innerPairs = blockMatch[2];
        const statPairRegex = /["']?([^"'{}:,]+)["']?\s*:\s*([+-]?\d+)/g;
        let statMatch: RegExpExecArray | null;
        statsDeltaByCharacter[charName] = statsDeltaByCharacter[charName] || {};
        while ((statMatch = statPairRegex.exec(innerPairs)) !== null) {
          const sName = statMatch[1].trim();
          const sVal = parseInt(statMatch[2], 10);
          if (!isNaN(sVal)) {
            statsDeltaByCharacter[charName][sName] = sVal;
            statsDelta[sName] = sVal;
          }
        }
      }
    }

    cleanText = cleanText.replace(statsRegex, '');
  }

  // Globally clean all stats comment tags from narrative text
  cleanText = cleanText.replace(/<!--(?:STATS_UPDATE|STATS|STAT_UPDATE|STATS_DELTA|数值变动)[\s\S]*?-->/gi, '');
  cleanText = cleanText.replace(/<!--STATS_RECALC[\s\S]*?-->/gi, '');

  // 3. Match inline THOUGHT tags: <!--THOUGHT:角色名:内容--> or <!--心声:角色名:内容-->
  // Support both English (:) and Chinese (：) colons
  const inlineThoughtRegex = /<!--(?:THOUGHT|心声|内心独白)[:：]\s*([^:：]+?)\s*[:：]\s*(.*?)\s*-->/gs;
  cleanText = cleanText.replace(inlineThoughtRegex, (_match, charName, thoughtText) => {
    const cName = charName.trim();
    const tText = thoughtText.trim();
    thoughts[cName] = tText;
    return `\n[[INLINE_THOUGHT:${cName}:${tText}]]\n`;
  });

  // 4. Also match bracketed thoughts inline like 【林清寒心声：内容】 or 【苏雪儿内心：内容】
  const bracketThoughtRegex = /【([^【】]+?)(?:的心声|心声|内心独白|内心)[:：]([^【】]+?)】/g;
  cleanText = cleanText.replace(bracketThoughtRegex, (_match, charName, thoughtText) => {
    const cName = charName.trim();
    const tText = thoughtText.trim();
    thoughts[cName] = tText;
    return `\n[[INLINE_THOUGHT:${cName}:${tText}]]\n`;
  });

  // 5. Match old THOUGHTS block at end: <!--THOUGHTS: {"角色名": "..."} -->
  const thoughtsRegex = /<!--THOUGHTS:\s*(\{.*?\})\s*-->/s;
  const thoughtsMatch = cleanText.match(thoughtsRegex);
  if (thoughtsMatch && thoughtsMatch[1]) {
    try {
      const sanitized = sanitizeJson(thoughtsMatch[1]);
      const parsed = JSON.parse(sanitized);
      if (typeof parsed === 'object') {
        for (const [k, v] of Object.entries(parsed)) {
          if (typeof v === 'string') {
            thoughts[k] = v;
          }
        }
      }
    } catch (e) {
      console.warn('Failed to parse THOUGHTS tag:', e);
    }
    cleanText = cleanText.replace(thoughtsRegex, '');
  }

  // 6. Match BRANCHES
  const branchesRegex = /<!--BRANCHES:\s*(\[.*?\])\s*-->/s;
  const branchesMatch = cleanText.match(branchesRegex);
  if (branchesMatch && branchesMatch[1]) {
    try {
      const sanitized = sanitizeJson(branchesMatch[1]);
      const parsed = JSON.parse(sanitized);
      if (Array.isArray(parsed)) {
        suggestedBranches = parsed.map(String).filter((s) => s.trim().length > 0);
      }
    } catch (e) {
      console.warn('Failed to parse BRANCHES tag:', e);
    }
    cleanText = cleanText.replace(branchesRegex, '');
  }

  return {
    cleanText: cleanText.trim(),
    statsDelta,
    statsDeltaByCharacter,
    recalcStats,
    thoughts,
    suggestedBranches,
  };
}
