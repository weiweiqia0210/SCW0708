import {
  TRPGSession,
  TRPGCharacter,
  TRPGItem,
  TRPGEnemy,
  CombatActionLog,
} from '../types/trpg';
import {
  rollDice,
  rollDiceManual,
  calculateAttributeModifier,
  calculateProficiencyBonus,
  parseDiceExpression,
} from './diceEngine';

/**
 * Calculate player's effective Armor Class (AC)
 * Base 10 + DEX modifier + equipped armor/shield AC bonus
 */
export function calculatePlayerAC(character: TRPGCharacter, rulesetRule = 'd20_standard'): number {
  const dexMod = calculateAttributeModifier(character.attributes.dex ?? 10, rulesetRule as any);
  const armorBonus = (character.inventory || [])
    .filter((item) => item.equipped && item.type === 'armor')
    .reduce((sum, item) => sum + (item.acBonus || 0), 0);

  return 10 + dexMod + armorBonus;
}

/**
 * Execute player weapon attack against an enemy
 */
export function executePlayerAttack(params: {
  session: TRPGSession;
  weapon: TRPGItem;
  targetEnemyId: string;
  manualAttackD20?: number;
  manualDamageRolls?: number[];
}): { updatedSession: TRPGSession; actionLog: CombatActionLog } {
  const { session, weapon, targetEnemyId, manualAttackD20, manualDamageRolls } = params;
  const character = session.character;
  const ruleset = session.rulesetSnapshot;
  const enemy = session.combatState.enemies.find((e) => e.id === targetEnemyId);

  if (!enemy || enemy.currentHp <= 0) {
    const errorLog: CombatActionLog = {
      id: `act-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      round: session.combatState.round,
      actor: character.name,
      actorType: 'player',
      actionType: 'attack',
      detail: `目标已被击败或不存在。`,
      isHit: false,
      timestamp: Date.now(),
    };
    return { updatedSession: session, actionLog: errorLog };
  }

  // Determine attack bonus (STR for melee, DEX for ranged/finesse)
  const isRanged = weapon.damageDice?.includes('DEX');
  const attrKey = isRanged ? 'dex' : 'str';
  const attrMod = calculateAttributeModifier(character.attributes[attrKey] ?? 10, ruleset.modifierRule);
  const profBonus = calculateProficiencyBonus(character.level);
  const totalAttackBonus = attrMod + profBonus;

  // 1. Roll Attack (D20)
  const attackRoll = manualAttackD20 !== undefined
    ? rollDiceManual('1d20', [manualAttackD20], `${weapon.name}命中检定`)
    : rollDice('1d20', `${weapon.name}命中检定`);

  const attackTotal = attackRoll.rolls[0] + totalAttackBonus;
  const isCrit = attackRoll.isCriticalSuccess;
  const isFumble = attackRoll.isCriticalFailure;
  const isHit = isCrit || (!isFumble && attackTotal >= enemy.ac);

  let damageDealt = 0;
  let damageDetails = '';

  if (isHit) {
    // 2. Parse damage dice formula, e.g. "1d8+STR"
    let rawFormula = weapon.damageDice || ruleset.defaultDamageFormula || '1d4+STR';
    // Replace STR / DEX keywords with calculated numerical modifier
    rawFormula = rawFormula.replace(/\+?STR/gi, attrMod >= 0 ? `+${attrMod}` : `${attrMod}`);
    rawFormula = rawFormula.replace(/\+?DEX/gi, attrMod >= 0 ? `+${attrMod}` : `${attrMod}`);

    const parsedDamage = parseDiceExpression(rawFormula);
    const countToRoll = isCrit ? parsedDamage.count * 2 : parsedDamage.count; // Double dice on crit!
    const effectiveFormula = `${countToRoll}d${parsedDamage.sides}${
      parsedDamage.modifier >= 0 ? `+${parsedDamage.modifier}` : `${parsedDamage.modifier}`
    }`;

    const damageRoll = manualDamageRolls && manualDamageRolls.length > 0
      ? rollDiceManual(effectiveFormula, manualDamageRolls, '伤害计算')
      : rollDice(effectiveFormula, '伤害计算');

    damageDealt = Math.max(1, damageRoll.total);
    damageDetails = `造成 ${damageRoll.total} 点伤害 [${damageRoll.rolls.join('+')}${
      parsedDamage.modifier !== 0 ? (parsedDamage.modifier > 0 ? `+${parsedDamage.modifier}` : `${parsedDamage.modifier}`) : ''
    }]`;
  }

  const newEnemyHp = Math.max(0, enemy.currentHp - damageDealt);
  const isDefeated = newEnemyHp === 0;

  let detail = `${character.name} 挥动【${weapon.name}】攻击 ${enemy.name}：命中 d20(${attackRoll.rolls[0]})${
    totalAttackBonus >= 0 ? `+${totalAttackBonus}` : `${totalAttackBonus}`
  }=${attackTotal} vs AC ${enemy.ac} ➔ `;

  if (isCrit) {
    detail += `🌟 暴击！${damageDetails}。`;
  } else if (isFumble) {
    detail += `💀 大失败未命中！`;
  } else if (isHit) {
    detail += `命中！${damageDetails}。`;
  } else {
    detail += `未命中。`;
  }

  if (isDefeated) {
    detail += ` 🎯 【${enemy.name}】倒地阵亡！`;
  }

  const actionLog: CombatActionLog = {
    id: `act-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    round: session.combatState.round,
    actor: character.name,
    actorType: 'player',
    actionType: 'attack',
    target: enemy.name,
    detail,
    isHit,
    damageOrHeal: damageDealt,
    timestamp: Date.now(),
  };

  // Update enemy in session
  const nextEnemies = session.combatState.enemies.map((e) =>
    e.id === enemy.id ? { ...e, currentHp: newEnemyHp } : e
  );

  // Check if all enemies defeated
  const allDefeated = nextEnemies.every((e) => e.currentHp <= 0);

  const updatedSession: TRPGSession = {
    ...session,
    combatState: {
      ...session.combatState,
      inCombat: !allDefeated,
      enemies: nextEnemies,
      actionLogs: [actionLog, ...session.combatState.actionLogs].slice(0, 50),
    },
    updatedAt: Date.now(),
  };

  return { updatedSession, actionLog };
}

/**
 * Execute player consumable healing/potion use
 */
export function executePlayerHeal(params: {
  session: TRPGSession;
  itemId: string;
  manualRolls?: number[];
}): { updatedSession: TRPGSession; actionLog: CombatActionLog } {
  const { session, itemId, manualRolls } = params;
  const character = session.character;
  const itemIndex = character.inventory.findIndex((i) => i.id === itemId);

  if (itemIndex < 0 || character.inventory[itemIndex].quantity <= 0) {
    const errorLog: CombatActionLog = {
      id: `act-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      round: session.combatState.round,
      actor: character.name,
      actorType: 'player',
      actionType: 'heal',
      detail: '背包中没有该可用物品。',
      timestamp: Date.now(),
    };
    return { updatedSession: session, actionLog: errorLog };
  }

  const item = character.inventory[itemIndex];
  const healFormula = item.healValue || '2d4+2';

  const healRoll = manualRolls && manualRolls.length > 0
    ? rollDiceManual(healFormula, manualRolls, '治疗效果')
    : rollDice(healFormula, '治疗效果');

  const healedAmount = Math.max(1, healRoll.total);
  const newHp = Math.min(character.maxHp, character.currentHp + healedAmount);
  const actualRecovered = newHp - character.currentHp;

  // Deduct 1 item quantity
  const nextInventory = character.inventory
    .map((inv, idx) => (idx === itemIndex ? { ...inv, quantity: inv.quantity - 1 } : inv))
    .filter((inv) => inv.quantity > 0);

  const detail = `${character.name} 使用了【${item.name}】，恢复了 ${actualRecovered} 点生命值 (HP: ${newHp}/${character.maxHp})。`;

  const actionLog: CombatActionLog = {
    id: `act-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    round: session.combatState.round,
    actor: character.name,
    actorType: 'player',
    actionType: 'heal',
    detail,
    damageOrHeal: actualRecovered,
    timestamp: Date.now(),
  };

  const updatedSession: TRPGSession = {
    ...session,
    character: {
      ...character,
      currentHp: newHp,
      inventory: nextInventory,
    },
    combatState: {
      ...session.combatState,
      actionLogs: [actionLog, ...session.combatState.actionLogs].slice(0, 50),
    },
    updatedAt: Date.now(),
  };

  return { updatedSession, actionLog };
}

/**
 * Execute enemy turns programmatically
 */
export function executeEnemyTurn(session: TRPGSession): {
  updatedSession: TRPGSession;
  actionLogs: CombatActionLog[];
} {
  if (!session.combatState.inCombat) {
    return { updatedSession: session, actionLogs: [] };
  }

  const livingEnemies = session.combatState.enemies.filter((e) => e.currentHp > 0);
  if (livingEnemies.length === 0) {
    return {
      updatedSession: {
        ...session,
        combatState: { ...session.combatState, inCombat: false },
      },
      actionLogs: [],
    };
  }

  let currentCharHp = session.character.currentHp;
  const playerAC = calculatePlayerAC(session.character, session.rulesetSnapshot.modifierRule);
  const generatedLogs: CombatActionLog[] = [];

  for (const enemy of livingEnemies) {
    if (currentCharHp <= 0) break;

    // Enemy rolls attack
    const attackRoll = rollDice('1d20', `${enemy.name}攻击检定`);
    const attackTotal = attackRoll.rolls[0] + enemy.attackBonus;
    const isHit = attackRoll.isCriticalSuccess || (!attackRoll.isCriticalFailure && attackTotal >= playerAC);

    let damage = 0;
    let detail = `${enemy.name} 对 ${session.character.name} 发动攻击：命中 d20(${attackRoll.rolls[0]})+${enemy.attackBonus}=${attackTotal} vs AC ${playerAC} ➔ `;

    if (isHit) {
      const damageRoll = rollDice(enemy.damageFormula || '1d6+1', '敌人伤害检定');
      damage = Math.max(1, damageRoll.total);
      currentCharHp = Math.max(0, currentCharHp - damage);
      detail += `命中！造成 ${damage} 点伤害 (玩家当前 HP: ${currentCharHp}/${session.character.maxHp})。`;
      if (currentCharHp <= 0) {
        detail += ` ⚠️ 【${session.character.name}】遭受致命创伤陷入昏迷！`;
      }
    } else {
      detail += `被玩家格挡或躲避！`;
    }

    generatedLogs.push({
      id: `act-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      round: session.combatState.round,
      actor: enemy.name,
      actorType: 'enemy',
      actionType: 'attack',
      target: session.character.name,
      detail,
      isHit,
      damageOrHeal: damage,
      timestamp: Date.now(),
    });
  }

  const updatedSession: TRPGSession = {
    ...session,
    character: {
      ...session.character,
      currentHp: currentCharHp,
    },
    combatState: {
      ...session.combatState,
      round: session.combatState.round + 1,
      actionLogs: [...generatedLogs, ...session.combatState.actionLogs].slice(0, 50),
    },
    updatedAt: Date.now(),
  };

  return { updatedSession, actionLogs: generatedLogs };
}

/**
 * Attempt to flee combat (Dexterity check vs DC 13)
 */
export function executeFleeCombat(params: {
  session: TRPGSession;
  manualD20?: number;
}): { updatedSession: TRPGSession; actionLog: CombatActionLog; success: boolean } {
  const { session, manualD20 } = params;
  const character = session.character;
  const dexMod = calculateAttributeModifier(character.attributes.dex ?? 10, session.rulesetSnapshot.modifierRule);
  const dc = 13;

  const roll = manualD20 !== undefined
    ? rollDiceManual('1d20', [manualD20], '脱离战斗敏捷检定')
    : rollDice('1d20', '脱离战斗敏捷检定');

  const total = roll.rolls[0] + dexMod;
  const success = total >= dc;

  const detail = `${character.name} 尝试利用敏捷脱离战斗：d20(${roll.rolls[0]})${dexMod >= 0 ? `+${dexMod}` : `${dexMod}`}=${total} vs DC ${dc} ➔ ${
    success ? '【成功脱险！脱离当前交战状态】' : '【撤退受阻！未能成功脱离】'
  }`;

  const actionLog: CombatActionLog = {
    id: `act-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    round: session.combatState.round,
    actor: character.name,
    actorType: 'player',
    actionType: 'flee',
    detail,
    isHit: success,
    timestamp: Date.now(),
  };

  const updatedSession: TRPGSession = {
    ...session,
    combatState: {
      ...session.combatState,
      inCombat: !success,
      actionLogs: [actionLog, ...session.combatState.actionLogs].slice(0, 50),
    },
    updatedAt: Date.now(),
  };

  return { updatedSession, actionLog, success };
}

/**
 * Execute companion attack against an enemy
 */
export function executeCompanionAttack(params: {
  session: TRPGSession;
  companionId: string;
  targetEnemyId: string;
}): { updatedSession: TRPGSession; actionLog: CombatActionLog } {
  const { session, companionId, targetEnemyId } = params;
  const companion = (session.companions || []).find((c) => c.id === companionId);
  const enemy = session.combatState.enemies.find((e) => e.id === targetEnemyId);

  if (!companion || !enemy || enemy.currentHp <= 0) {
    const errorLog: CombatActionLog = {
      id: `act-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      round: session.combatState.round,
      actor: companion?.name || '队友',
      actorType: 'player',
      actionType: 'attack',
      detail: `目标已被消灭或队友无法行动。`,
      isHit: false,
      timestamp: Date.now(),
    };
    return { updatedSession: session, actionLog: errorLog };
  }

  const cChar = companion.character;
  const ruleset = session.rulesetSnapshot;
  const equippedWeapons = (cChar.inventory || []).filter((i) => i.equipped && i.type === 'weapon');
  const weapon = equippedWeapons[0] || {
    id: 'comp-unarmed',
    name: '战术协力打击',
    type: 'weapon' as const,
    quantity: 1,
    equipped: true,
    damageDice: '1d6+STR',
    description: '近身协力打击',
  };

  const isRanged = weapon.damageDice?.includes('DEX');
  const attrKey = isRanged ? 'dex' : 'str';
  const attrMod = calculateAttributeModifier(cChar.attributes[attrKey] ?? 10, ruleset.modifierRule);
  const profBonus = calculateProficiencyBonus(cChar.level);
  const totalAttackBonus = attrMod + profBonus;

  const attackRoll = rollDice('1d20', `${companion.name} 协力攻击检定`);
  const attackTotal = attackRoll.rolls[0] + totalAttackBonus;
  const isHit = attackRoll.isCriticalSuccess || (!attackRoll.isCriticalFailure && attackTotal >= enemy.ac);

  let damageDealt = 0;
  let detail = '';

  if (isHit) {
    let rawFormula = weapon.damageDice || '1d6+STR';
    rawFormula = rawFormula.replace(/\+?STR/gi, attrMod >= 0 ? `+${attrMod}` : `${attrMod}`);
    rawFormula = rawFormula.replace(/\+?DEX/gi, attrMod >= 0 ? `+${attrMod}` : `${attrMod}`);
    const parsed = parseDiceExpression(rawFormula);
    const countToRoll = attackRoll.isCriticalSuccess ? (parsed.count || 1) * 2 : (parsed.count || 1);
    const effectiveFormula = parsed.isValid
      ? `${countToRoll}d${parsed.sides}${parsed.modifier >= 0 ? `+${parsed.modifier}` : `${parsed.modifier}`}`
      : '1d6';
    const damageRoll = rollDice(effectiveFormula, `${companion.name} 伤害投掷`);
    damageDealt = Math.max(1, damageRoll.total);

    detail = `【队友援护】${companion.name} 挥舞【${weapon.name}】突袭 ${enemy.name}：检定 d20(${attackRoll.rolls[0]})+${totalAttackBonus}=${attackTotal} vs AC ${enemy.ac} ➔ 【命中！】造成 ${damageDealt} 点伤害！`;
  } else {
    detail = `【队友援护】${companion.name} 尝试以【${weapon.name}】夹击 ${enemy.name}：检定 d20(${attackRoll.rolls[0]})+${totalAttackBonus}=${attackTotal} vs AC ${enemy.ac} ➔ 【未命中】被敌方格挡！`;
  }

  const actionLog: CombatActionLog = {
    id: `act-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    round: session.combatState.round,
    actor: companion.name,
    actorType: 'player',
    actionType: 'attack',
    target: enemy.name,
    detail,
    isHit,
    damageOrHeal: damageDealt,
    timestamp: Date.now(),
  };

  const updatedEnemies = session.combatState.enemies.map((e) => {
    if (e.id !== targetEnemyId) return e;
    const nextHp = Math.max(0, e.currentHp - damageDealt);
    return { ...e, currentHp: nextHp };
  });

  const stillLiving = updatedEnemies.some((e) => e.currentHp > 0);

  const updatedSession: TRPGSession = {
    ...session,
    combatState: {
      ...session.combatState,
      enemies: updatedEnemies,
      inCombat: stillLiving,
      actionLogs: [actionLog, ...session.combatState.actionLogs].slice(0, 50),
    },
    updatedAt: Date.now(),
  };

  return { updatedSession, actionLog };
}

