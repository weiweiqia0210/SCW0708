import { TRPGSession, TRPGCompanion, TRPGNpcRelation, TRPGQuest } from '../types/trpg';
import { WorldBook, SystemPreset } from '../types';
import { calculateAttributeModifier, calculateProficiencyBonus } from './diceEngine';
import { calculatePlayerAC } from './trpgCombatEngine';

/**
 * Builds the AI DM System Prompt for a TRPG Session
 */
export function buildTRPGSystemInstruction(params: {
  session: TRPGSession;
  worldbooks?: WorldBook[];
  preset?: SystemPreset;
}): string {
  const { session, worldbooks = [], preset } = params;
  const char = session.character;
  const rules = session.rulesetSnapshot;
  const companions = session.companions || [];
  const npcRelations = session.npcRelations || [];
  const quests = session.quests || [];

  const parts: string[] = [];

  parts.push(`【身份职责与系统原则】
你是一名公正、资深且充满画面描摹感的专业跑团主持人（DM / 地下城主 / KP）。
当前正在主持一场沉浸式单人 TRPG 跑团文字冒险。
请严格遵循以下核心准则：

1. ⚖️【绝对服从程序计算结果（最高硬性铁律）】：
本游戏的检定骰点、属性加值、命中率、难度判定（DC）、伤害数值以及玩家与敌人的生命值（HP）升降【全部由底层游戏系统程序严格依照规则计算】。
若消息中包含系统提供的【检定判定结果】或【战斗交锋结算】，该结果即为不可更动的既定客观事实！
- 严禁擅自修改、推翻或违背程序给出的成功/失败与伤害数值；
- 你的职责是将系统计算好的冰冷数值结果（如：“检定成功”、“暴击命中造成9点伤害”、“哥布林阵亡”）以高超的文学功底转化为具有临场感、动作感与细节的生动叙事！

2. 🚫【严禁替玩家代行决策（防抢话原则）】：
你扮演的是世界环境、突发遭遇与所有 NPC/队友，【绝对不是玩家】！
严禁擅自替玩家做出新的抉择、行动或台词。在描述完环境变化、队友/NPC 反应或结算结果后，应适时收笔，将主动权交还给玩家。

3. 🎲【掷骰模式提示】：
当前掷骰模式为：【${session.diceMode === 'manual' ? '玩家手动投掷' : 'AI程序自动骰'}】。
当玩家提出需要检定的危险举动（如翻越悬崖、调查隐藏暗门、辨识符文等）时，你可以适时在叙事中指引玩家进行相应属性或技能检定。

4. 📡【底层结构化事件上报规范】：
若当下的剧情发展引发了实质性的「关系变化」、「任务进展」、「队友变动」或「重大剧情转折」，你可以在回复文本的最末尾附带以下专有格式标签（系统会全自动校验、解析并将其存入结构化状态，同时向读者隐去标签内容）：
- 好感/信任变动：[EVENT_RELATION: {"name": "角色名", "favorChange": 5, "trustChange": 2, "reason": "救助原因"}]
- 任务发现/推进/完成：[EVENT_QUEST: {"action": "discover"|"progress"|"complete"|"fail", "title": "任务名称", "category": "main"|"side"|"hidden", "objective": "当前阶段目标", "reward": "奖励说明", "reason": "触发缘由"}]
- 队友离队/归队：[EVENT_PARTY: {"action": "recruit"|"leave", "name": "队友名", "reason": "剧情原因"}]
- 地图区域解锁/行进：[EVENT_MAP: {"action": "unlock"|"move", "name": "地点名称", "reason": "触发缘由"}]
- 关键剧情/重大抉择日志：[EVENT_LOG: {"category": "story"|"choice"|"item", "title": "事件简述", "detail": "详细记录"}]
（若无此类变动，切勿无端输出标签）`);

  // Character Sheet Injection
  const attrList = (rules.attributes || [])
    .map((a) => {
      const val = char.attributes[a.key] ?? 10;
      const mod = calculateAttributeModifier(val, rules.modifierRule);
      const modSign = mod >= 0 ? `+${mod}` : `${mod}`;
      return `${a.name}(${a.abbr}): ${val} [调整值 ${modSign}]`;
    })
    .join(' | ');

  const profBonus = calculateProficiencyBonus(char.level);
  const profSkillNames = (rules.skills || [])
    .filter((s) => (char.proficientSkills || []).includes(s.id))
    .map((s) => s.name)
    .join('、') || '无';

  const equippedItems = (char.inventory || [])
    .filter((i) => i.equipped)
    .map((i) => `${i.name} (${i.damageDice || (i.acBonus ? `+${i.acBonus}护甲` : '已穿戴')})`)
    .join('、') || '无';

  const playerAC = calculatePlayerAC(char, rules.modifierRule);

  parts.push(`【当前主角档案】
- 姓名：${char.name}
- 职业与定位：${char.characterClass || '冒险者'} (等级 Lv.${char.level || 1})
- 生命值(HP)：${char.currentHp} / ${char.maxHp}
- 护甲防御等级(AC)：${playerAC}
- 熟练加值：+${profBonus}
- 核心属性：${attrList}
- 熟练技能：${profSkillNames}
- 装备配置：${equippedItems}
- 外貌特征：${char.appearance || '无特殊记录'}
- 性格特点：${char.personality || '沉着冷静'}
- 身世背景：${char.background || '无特殊记录'}
${char.customNotes ? `- 专长与额外设定：${char.customNotes}` : ''}`);

  // Map & Geographic Location Context Injection
  if (session.mapState && Array.isArray(session.mapState.locations) && session.mapState.locations.length > 0) {
    const currentLoc =
      session.mapState.locations.find((l) => l.id === session.mapState.currentLocationId) ||
      session.mapState.locations[0];

    if (currentLoc) {
      const connectedLocs = session.mapState.locations.filter((l) =>
        (currentLoc.connectedNodeIds || []).includes(l.id)
      );
      const connectedStr =
        connectedLocs
          .map(
            (l) =>
              `${l.name}(${
                l.status === 'unexplored'
                  ? '未探索迷雾'
                  : l.status === 'explored'
                  ? '已探明'
                  : '已知路线'
              })`
          )
          .join('、') || '周围暂无可连通要道';

      parts.push(`【当前所在地理位置与周围环境】
- 当前位置：${currentLoc.name} (${currentLoc.dangerLevel === 'safe' ? '安全区域' : `危险度: ${currentLoc.dangerLevel}`})
- 地理与环境描绘：${currentLoc.description}
- 现场氛围特征：${currentLoc.environmentTags && currentLoc.environmentTags.length > 0 ? currentLoc.environmentTags.join(' / ') : '常态'}
- 相邻可通行地点：${connectedStr}
请根据当前地点的地理地貌、室内外特征与周围氛围进行自然生动的环境渲染。`);
    }
  }

  // Companions Injection (Active Party)
  const activeCompanions = companions.filter((c) => c.status === 'active');
  if (activeCompanions.length > 0) {
    const compTexts = activeCompanions
      .map((c) => {
        const cChar = c.character;
        const cEquipped = (cChar.inventory || [])
          .filter((i) => i.equipped)
          .map((i) => `${i.name} (${i.damageDice || (i.acBonus ? `+${i.acBonus}AC` : '已装备')})`)
          .join('、') || '常规装备';

        return `* 【队友: ${c.name}】
  - 职业/定位: ${cChar.characterClass || '同伴'} (Lv.${cChar.level || 1})
  - 生命值: ${cChar.currentHp}/${cChar.maxHp} | 装备: ${cEquipped}
  - 性格特征: ${cChar.personality || '友善正直'} | 说话习惯: ${cChar.speechStyle || '亲切随和'}
  - 个人宿愿/目标: ${c.personalGoal || '寻求冒险的真义与同行者'}
  - 隐秘背景/顾虑: ${c.hiddenNotes || '暂无隐藏秘密'}
  - 关系定位: ${c.relationshipTitle || '同行伙伴'} (好感度: ${c.favorability}/100, 信任度: ${c.trust}/100)
  - 行为指导: 该队友具备独立意志！请根据其好感、信任与个人目标，主动开口说话、提出战术/道德建议、开展个人行动或在危急时挺身支援。`;
      })
      .join('\n\n');

    parts.push(`【当前同行小队成员（队友）】\n${compTexts}`);
  } else {
    parts.push(`【当前同行小队状态】\n主角当前独自一人启程历练，暂无同行队员。`);
  }

  // Candidate / Cast Companions roaming in the world (waiting to be encountered)
  const candidateCompanions = companions.filter((c) => c.status !== 'active');
  if (candidateCompanions.length > 0) {
    const candidateTexts = candidateCompanions
      .map(
        (c) =>
          `* 【参演伙伴: ${c.name}】(身份: ${c.character.characterClass || '游历者'})
  - 人设与特征: ${c.character.personality || '独行冒险者'} | 说话习惯: ${c.character.speechStyle || '各具个性'}
  - 潜在动机/目标: ${c.personalGoal || '正在世间游历探索'}
  - 剧情偶遇指引: 此角色最开始尚未加入主角队伍，请在后续冒险探索、酒馆休憩、遗迹遭遇或关键危机中，适时安排自然生动的偶遇契机，供玩家互动交涉并决定是否招募其入队！`
      )
      .join('\n\n');

    parts.push(`【可能在冒险途中遇上的参演伙伴（候选中，待剧情偶遇招募）】\n${candidateTexts}`);
  }

  // NPC Relations Injection
  if (npcRelations.length > 0) {
    const npcTexts = npcRelations
      .slice(0, 8)
      .map(
        (n) =>
          `* 【${n.name}】(身份: ${n.identity || '未明'}) - 态度: ${n.attitude} | 好感: ${n.favorability} | 信任: ${n.trust} | 印象: ${n.notes || '初次相遇'}`
      )
      .join('\n');

    parts.push(`【重要 NPC 人际交往关系网】
此数据真实反映玩家在各势力与角色心中的名声与好感，请切实影响他们的对话态度与戒心：\n${npcTexts}`);
  }

  // Quests & Objectives Injection
  const activeQuests = quests.filter((q) => q.status === 'active');
  const undiscoveredHidden = quests.filter((q) => q.status === 'undiscovered' && q.isHidden);

  if (activeQuests.length > 0 || undiscoveredHidden.length > 0) {
    const qParts: string[] = [];

    if (activeQuests.length > 0) {
      const activeText = activeQuests
        .map(
          (q) =>
            `* [${q.category === 'main' ? '主线' : q.category === 'hidden' ? '隐藏任务' : '支线'}]《${q.title}》
  - 当前目标: ${q.currentObjective}
  - 背景概要: ${q.description}${q.rewards ? `\n  - 承诺奖励: ${q.rewards}` : ''}`
        )
        .join('\n');
      qParts.push(`已接受/正在进行的任务：\n${activeText}`);
    }

    if (undiscoveredHidden.length > 0) {
      const hiddenText = undiscoveredHidden
        .map(
          (h) =>
            `* 《${h.title}》- 隐藏触发条件: ${h.triggerCondition || '在探索特定遗迹或取得特定NPC信任时触发'}`
        )
        .join('\n');
      qParts.push(`潜在未触发的隐藏任务（【玩家界面完全不可见】，请在剧情符合触发契机时再行引出并输出 [EVENT_QUEST: {"action": "discover", ...}]）：\n${hiddenText}`);
    }

    parts.push(`【任务与战役目标追踪】\n${qParts.join('\n\n')}`);
  }

  // Worldbook Lore Injection
  if (worldbooks.length > 0) {
    const wbTexts = worldbooks
      .map((wb) => {
        const entries = (wb.entries || [])
          .filter((e) => e.enabled)
          .slice(0, 10)
          .map((e) => `  * 【${e.name}】: ${e.content}`)
          .join('\n');
        return `《${wb.title}》：\n${entries}`;
      })
      .join('\n\n');

    parts.push(`【战役世界观与模组设定（世界书）】\n${wbTexts}`);
  }

  // Preset Narrative Instruction Injection
  if (preset && preset.contentPrompt) {
    parts.push(`【主持带团风格与指导规范（预设要求）】\n${preset.contentPrompt}`);
  }

  // Combat State Injection
  if (session.combatState.inCombat) {
    const living = session.combatState.enemies.filter((e) => e.currentHp > 0);
    const enemyListStr = living
      .map((e) => `${e.name} (HP: ${e.currentHp}/${e.maxHp}, AC: ${e.ac})`)
      .join('、');

    parts.push(`【🚨 当前战场态势：第 ${session.combatState.round} 回合交战中】
战场中的存活敌方目标：${enemyListStr || '所有敌方已失去战斗力'}
请着重刻画当下的紧张战斗局势、兵刃交错声、硝烟气味与敌人的一举一动。`);
  }

  // Opening Premise & Story Outline Injection
  if (session.openingPremise && session.openingPremise.trim()) {
    parts.push(`【📖 玩家指定的开局故事大纲与期望走向】
${session.openingPremise.trim()}
（【至关重要要求】：DM 请务必严格围绕玩家期望的上述开局故事大纲、情境氛围与期望剧情走向进行带团。所有遭遇、突发状况与 NPC 行动均要与该主线脉络协同共鸣，给予玩家高度契合预期的世界反馈与沉浸感！）`);
  }

  return parts.join('\n\n');
}
