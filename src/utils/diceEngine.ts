import { TRPGRollResult, TRPGCheckResult, TRPGCharacter, TRPGRuleset } from '../types/trpg';

export interface ParsedDiceExpression {
  isValid: boolean;
  count: number;
  sides: number;
  modifier: number;
  normalizedExpression: string;
  error?: string;
}

/**
 * Validates and parses dice expression string.
 * Supports expressions like: "1d20", "2d6+3", "1d100", "d20", "3d8 - 2"
 * Limits count (1..30), sides (2..1000), modifier (-500..500) to prevent overflow/freeze.
 */
export function parseDiceExpression(raw: string): ParsedDiceExpression {
  if (!raw || typeof raw !== 'string') {
    return {
      isValid: false,
      count: 0,
      sides: 0,
      modifier: 0,
      normalizedExpression: '',
      error: '骰子表达式为空',
    };
  }

  const clean = raw.trim().toLowerCase().replace(/\s+/g, '');
  // Matches optional count, 'd', sides, optional + or - modifier
  const match = clean.match(/^(\d*)d(\d+)([+-]\d+)?$/i);

  if (!match) {
    return {
      isValid: false,
      count: 0,
      sides: 0,
      modifier: 0,
      normalizedExpression: clean,
      error: '无效骰子格式，请使用如 1d20、2d6+3、1d100 格式',
    };
  }

  const countStr = match[1];
  const sidesStr = match[2];
  const modStr = match[3];

  const count = countStr ? parseInt(countStr, 10) : 1;
  const sides = parseInt(sidesStr, 10);
  const modifier = modStr ? parseInt(modStr, 10) : 0;

  if (isNaN(count) || count < 1 || count > 30) {
    return {
      isValid: false,
      count: 0,
      sides: 0,
      modifier: 0,
      normalizedExpression: clean,
      error: '骰子数量必须在 1 到 30 之间',
    };
  }

  if (isNaN(sides) || sides < 2 || sides > 1000) {
    return {
      isValid: false,
      count: 0,
      sides: 0,
      modifier: 0,
      normalizedExpression: clean,
      error: '骰子面数必须在 2 到 1000 之间（常用 D4、D6、D8、D10、D12、D20、D100）',
    };
  }

  if (isNaN(modifier) || modifier < -500 || modifier > 500) {
    return {
      isValid: false,
      count: 0,
      sides: 0,
      modifier: 0,
      normalizedExpression: clean,
      error: '修正值必须在 -500 到 +500 之间',
    };
  }

  const sign = modifier > 0 ? `+${modifier}` : modifier < 0 ? `${modifier}` : '';
  const normalized = `${count}d${sides}${sign}`;

  return {
    isValid: true,
    count,
    sides,
    modifier,
    normalizedExpression: normalized,
  };
}

/**
 * Standard crypto-safe or Math.random pseudo-random integer between min and max (inclusive)
 */
function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Execute automatic roll using program RNG
 */
export function rollDice(expression: string, reason?: string): TRPGRollResult {
  const parsed = parseDiceExpression(expression);
  if (!parsed.isValid) {
    // Return fallback 1d20 with error log
    return {
      id: `roll-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      expression: expression || '1d20',
      diceCount: 1,
      diceSides: 20,
      rolls: [10],
      modifier: 0,
      total: 10,
      reason: reason || parsed.error || '非法骰子表达式，已回退默认骰',
      timestamp: Date.now(),
    };
  }

  const rolls: number[] = [];
  for (let i = 0; i < parsed.count; i++) {
    rolls.push(randomInt(1, parsed.sides));
  }

  const sumRolls = rolls.reduce((acc, curr) => acc + curr, 0);
  const total = sumRolls + parsed.modifier;

  // D20 Critical Success / Failure checks
  const isCriticalSuccess = parsed.count === 1 && parsed.sides === 20 && rolls[0] === 20;
  const isCriticalFailure = parsed.count === 1 && parsed.sides === 20 && rolls[0] === 1;

  return {
    id: `roll-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    expression: parsed.normalizedExpression,
    diceCount: parsed.count,
    diceSides: parsed.sides,
    rolls,
    modifier: parsed.modifier,
    total,
    isCriticalSuccess,
    isCriticalFailure,
    reason,
    timestamp: Date.now(),
    isManual: false,
  };
}

/**
 * Formulate roll result from manual player entry
 */
export function rollDiceManual(
  expression: string,
  manualRolls: number[],
  reason?: string
): TRPGRollResult {
  const parsed = parseDiceExpression(expression);
  if (!parsed.isValid) {
    return rollDice('1d20', reason);
  }

  // Sanitize manual rolls within [1, sides]
  const rolls: number[] = [];
  for (let i = 0; i < parsed.count; i++) {
    const rawVal = manualRolls[i];
    const val = typeof rawVal === 'number' && !isNaN(rawVal) ? rawVal : 1;
    rolls.push(Math.min(Math.max(Math.floor(val), 1), parsed.sides));
  }

  const sumRolls = rolls.reduce((acc, curr) => acc + curr, 0);
  const total = sumRolls + parsed.modifier;

  const isCriticalSuccess = parsed.count === 1 && parsed.sides === 20 && rolls[0] === 20;
  const isCriticalFailure = parsed.count === 1 && parsed.sides === 20 && rolls[0] === 1;

  return {
    id: `roll-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    expression: parsed.normalizedExpression,
    diceCount: parsed.count,
    diceSides: parsed.sides,
    rolls,
    modifier: parsed.modifier,
    total,
    isCriticalSuccess,
    isCriticalFailure,
    reason,
    timestamp: Date.now(),
    isManual: true,
  };
}

/**
 * Standard D20 Attribute Modifier:
 * Score 10-11 -> +0
 * Score 12-13 -> +1
 * Score 14-15 -> +2
 * Score 8-9   -> -1
 * Formula: Math.floor((score - 10) / 2)
 */
export function calculateAttributeModifier(
  value: number,
  rule: 'd20_standard' | 'flat' = 'd20_standard'
): number {
  if (rule === 'flat') {
    return Math.floor(value);
  }
  return Math.floor(((value || 10) - 10) / 2);
}

/**
 * Calculate proficiency bonus from character level (Standard: Level 1-4 = +2, 5-8 = +3, etc.)
 */
export function calculateProficiencyBonus(level: number = 1): number {
  return Math.floor((Math.max(1, level) - 1) / 4) + 2;
}

/**
 * Programmatically execute an Attribute Check or Skill Check
 */
export function executeCheck(params: {
  character: TRPGCharacter;
  ruleset: TRPGRuleset;
  checkType: 'attribute' | 'skill';
  targetKey: string;
  dc?: number;
  manualRoll?: number; // If player manual rolled
  reason?: string;
}): TRPGCheckResult {
  const { character, ruleset, checkType, targetKey, dc, manualRoll, reason } = params;

  let attrKey = targetKey;
  let targetName = '';
  let isProficient = false;

  if (checkType === 'attribute') {
    const attrDef = ruleset.attributes.find((a) => a.key === targetKey);
    targetName = attrDef ? `${attrDef.name}检定` : '属性检定';
  } else {
    const skillDef = ruleset.skills.find((s) => s.id === targetKey);
    if (skillDef) {
      attrKey = skillDef.attributeKey;
      targetName = `${skillDef.name}检定`;
    } else {
      targetName = '技能检定';
    }
    isProficient = (character.proficientSkills || []).includes(targetKey);
  }

  const rawAttrVal = character.attributes[attrKey] ?? 10;
  const attrModifier = calculateAttributeModifier(rawAttrVal, ruleset.modifierRule);
  const profBonus = isProficient ? calculateProficiencyBonus(character.level) : 0;
  const totalBonus = attrModifier + profBonus;

  // Roll 1d20
  const rollRes = manualRoll !== undefined
    ? rollDiceManual('1d20', [manualRoll], reason || targetName)
    : rollDice('1d20', reason || targetName);

  const finalTotal = rollRes.rolls[0] + totalBonus;
  // Overwrite total to include character bonus
  rollRes.modifier = totalBonus;
  rollRes.total = finalTotal;

  let isSuccess: boolean | undefined = undefined;
  if (dc !== undefined) {
    if (rollRes.isCriticalSuccess) {
      isSuccess = true;
    } else if (rollRes.isCriticalFailure) {
      isSuccess = false;
    } else {
      isSuccess = finalTotal >= dc;
    }
  }

  // Construct readable summary text
  const dicePart = `d20(${rollRes.rolls[0]})`;
  const bonusSign = totalBonus >= 0 ? `+${totalBonus}` : `${totalBonus}`;
  let summaryText = `【${character.name}·${targetName}】: ${dicePart} ${bonusSign} = ${finalTotal}`;

  if (rollRes.isCriticalSuccess) {
    summaryText += ` (🌟 极佳大成功/Natural 20!)`;
  } else if (rollRes.isCriticalFailure) {
    summaryText += ` (💀 绝险大失败/Natural 1!)`;
  }

  if (dc !== undefined) {
    summaryText += ` vs 难度DC ${dc} ➔ ${isSuccess ? '【检定成功】' : '【检定失败】'}`;
  }

  return {
    id: `chk-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    characterId: character.id,
    characterName: character.name,
    type: checkType,
    targetKey,
    targetName,
    roll: rollRes,
    attributeBonus: attrModifier,
    proficiencyBonus: profBonus,
    totalBonus,
    dc,
    isSuccess,
    summaryText,
    timestamp: Date.now(),
  };
}
