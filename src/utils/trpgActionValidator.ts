import {
  TRPGSession,
  TRPGCompanion,
  TRPGNpcRelation,
  TRPGQuest,
  TRPGStoryLogEntry,
  TRPGItem,
} from '../types/trpg';

interface RelationActionPayload {
  name: string;
  favorChange?: number;
  trustChange?: number;
  reason?: string;
  identity?: string;
}

interface QuestActionPayload {
  action: 'discover' | 'progress' | 'complete' | 'fail';
  title: string;
  category?: 'main' | 'side' | 'hidden';
  objective?: string;
  reward?: string;
  reason?: string;
}

interface PartyActionPayload {
  action: 'recruit' | 'leave' | 'dismiss';
  name: string;
  reason?: string;
}

interface MapActionPayload {
  action: 'unlock' | 'move';
  name?: string;
  locationId?: string;
  reason?: string;
}

interface LogActionPayload {
  category: 'story' | 'choice' | 'item' | 'relation' | 'quest' | 'party';
  title: string;
  detail: string;
}

/**
 * Validates, executes, and sanitizes structured AI action events from the narration text.
 * Prevents duplicates, clamps numeric values, and records story logs.
 */
export function parseAndValidateAIActions(
  rawText: string,
  session: TRPGSession
): {
  cleanText: string;
  updatedSession: TRPGSession;
  appliedLogs: TRPGStoryLogEntry[];
} {
  let cleanText = rawText;
  const newLogs: TRPGStoryLogEntry[] = [];

  // Deep clone session components to safely mutate
  const companions: TRPGCompanion[] = JSON.parse(JSON.stringify(session.companions || []));
  const npcRelations: TRPGNpcRelation[] = JSON.parse(JSON.stringify(session.npcRelations || []));
  const quests: TRPGQuest[] = JSON.parse(JSON.stringify(session.quests || []));
  const storyLogs: TRPGStoryLogEntry[] = JSON.parse(JSON.stringify(session.storyLogs || []));
  const mapState = JSON.parse(
    JSON.stringify(
      session.mapState || {
        currentLocationId: 'loc-tavern',
        locations: [],
      }
    )
  );

  // Regex pattern for [EVENT_TYPE: {JSON}]
  const eventRegex = /\[EVENT_(RELATION|QUEST|PARTY|LOG|MAP):\s*(\{[\s\S]*?\})\s*\]/g;
  let match: RegExpExecArray | null;

  while ((match = eventRegex.exec(rawText)) !== null) {
    const eventType = match[1];
    const jsonStr = match[2];

    try {
      const payload = JSON.parse(jsonStr);

      if (eventType === 'RELATION') {
        const p = payload as RelationActionPayload;
        if (p.name && (p.favorChange !== undefined || p.trustChange !== undefined)) {
          const targetName = p.name.trim();
          const fChange = Number(p.favorChange) || 0;
          const tChange = Number(p.trustChange) || 0;
          const reason = p.reason || '经历事件影响了双方的关系';

          // 1. Check if companion
          const companion = companions.find(
            (c) => c.name.toLowerCase() === targetName.toLowerCase()
          );

          if (companion) {
            companion.favorability = Math.max(-100, Math.min(100, companion.favorability + fChange));
            companion.trust = Math.max(0, Math.min(100, companion.trust + tChange));

            // Dynamic title based on relationship
            if (companion.favorability >= 70 && companion.trust >= 70) {
              companion.relationshipTitle = '生死与共的战友';
            } else if (companion.favorability >= 40) {
              companion.relationshipTitle = '值得信赖的同伴';
            } else if (companion.favorability <= -40) {
              companion.relationshipTitle = '心怀芥蒂/矛盾重重';
            }

            const logEntry: TRPGStoryLogEntry = {
              id: `log-rel-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
              category: 'relation',
              title: `同伴 ${companion.name} 关系变化`,
              detail: `${reason}（好感 ${fChange >= 0 ? `+${fChange}` : fChange}，信任 ${tChange >= 0 ? `+${tChange}` : tChange}）➔ 当前好感: ${companion.favorability}，信任: ${companion.trust}`,
              timestamp: Date.now(),
            };
            newLogs.push(logEntry);
            storyLogs.push(logEntry);
          } else {
            // 2. Check or create NPC relation
            let npc = npcRelations.find((n) => n.name.toLowerCase() === targetName.toLowerCase());
            if (!npc) {
              npc = {
                id: `npc-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                name: targetName,
                identity: p.identity || '重要人物',
                attitude: 'neutral',
                favorability: 0,
                trust: 30,
                notes: reason,
                firstMetAt: Date.now(),
                updatedAt: Date.now(),
              };
              npcRelations.push(npc);
            }

            npc.favorability = Math.max(-100, Math.min(100, npc.favorability + fChange));
            npc.trust = Math.max(0, Math.min(100, npc.trust + tChange));
            if (npc.favorability >= 50) npc.attitude = 'friendly';
            else if (npc.favorability <= -50) npc.attitude = 'hostile';
            else if (npc.trust <= 15) npc.attitude = 'suspicious';
            npc.updatedAt = Date.now();
            if (p.reason) {
              npc.notes = `${npc.notes ? `${npc.notes}；` : ''}${p.reason}`;
            }

            const logEntry: TRPGStoryLogEntry = {
              id: `log-rel-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
              category: 'relation',
              title: `NPC [${npc.name}] 印象更迭`,
              detail: `${reason}（好感 ${fChange >= 0 ? `+${fChange}` : fChange}，信任 ${tChange >= 0 ? `+${tChange}` : tChange}）➔ 好感: ${npc.favorability}，态度: ${npc.attitude}`,
              timestamp: Date.now(),
            };
            newLogs.push(logEntry);
            storyLogs.push(logEntry);
          }
        }
      } else if (eventType === 'QUEST') {
        const p = payload as QuestActionPayload;
        if (p.title) {
          const questTitle = p.title.trim();
          const existing = quests.find(
            (q) => q.title.toLowerCase() === questTitle.toLowerCase()
          );

          if (p.action === 'discover') {
            if (existing) {
              // If it was undiscovered, now discovered
              if (existing.status === 'undiscovered') {
                existing.status = 'active';
                existing.discoveredAt = Date.now();
                if (p.objective) existing.currentObjective = p.objective;
                const logEntry: TRPGStoryLogEntry = {
                  id: `log-qst-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                  category: 'quest',
                  title: `解锁隐藏任务：${existing.title}`,
                  detail: p.reason || existing.description || '机缘巧合之下，一段尘封的秘密展露于你眼前。',
                  timestamp: Date.now(),
                };
                newLogs.push(logEntry);
                storyLogs.push(logEntry);
              }
            } else {
              // Brand new quest discovered
              const isHidden = p.category === 'hidden';
              const newQuest: TRPGQuest = {
                id: `quest-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                title: questTitle,
                category: p.category || 'side',
                status: 'active',
                description: p.reason || '在冒险探索中接到的新委托与契机。',
                currentObjective: p.objective || '调查进一步线索',
                objectives: [
                  {
                    id: `obj-${Date.now()}-1`,
                    text: p.objective || '调查进一步线索',
                    done: false,
                  },
                ],
                rewards: p.reward,
                isHidden,
                discoveredAt: Date.now(),
              };
              quests.push(newQuest);

              const logEntry: TRPGStoryLogEntry = {
                id: `log-qst-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                category: 'quest',
                title: `${isHidden ? '发现隐藏任务' : '触发新任务'}：${newQuest.title}`,
                detail: `目标：${newQuest.currentObjective}${newQuest.rewards ? `（奖励：${newQuest.rewards}）` : ''}`,
                timestamp: Date.now(),
              };
              newLogs.push(logEntry);
              storyLogs.push(logEntry);
            }
          } else if (p.action === 'progress' && existing && existing.status === 'active') {
            if (p.objective) {
              existing.currentObjective = p.objective;
              existing.objectives.push({
                id: `obj-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
                text: p.objective,
                done: false,
              });
            }
            const logEntry: TRPGStoryLogEntry = {
              id: `log-qst-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
              category: 'quest',
              title: `任务阶段进展：${existing.title}`,
              detail: p.reason || `新目标已更新为：${existing.currentObjective}`,
              timestamp: Date.now(),
            };
            newLogs.push(logEntry);
            storyLogs.push(logEntry);
          } else if (p.action === 'complete' && existing) {
            if (existing.status !== 'completed') {
              existing.status = 'completed';
              existing.completedAt = Date.now();
              existing.objectives.forEach((o) => (o.done = true));

              const logEntry: TRPGStoryLogEntry = {
                id: `log-qst-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                category: 'quest',
                title: `🎉 达成目标：${existing.title}`,
                detail: p.reason || `成功完成了该项委托与使命！${existing.rewards ? `获取战役奖励: ${existing.rewards}` : ''}`,
                timestamp: Date.now(),
              };
              newLogs.push(logEntry);
              storyLogs.push(logEntry);
            }
          } else if (p.action === 'fail' && existing && existing.status === 'active') {
            existing.status = 'failed';
            const logEntry: TRPGStoryLogEntry = {
              id: `log-qst-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
              category: 'quest',
              title: `⚠️ 任务失败：${existing.title}`,
              detail: p.reason || '因错失时机或遭遇不可挽回的变故，此任务已无法继续推进。',
              timestamp: Date.now(),
            };
            newLogs.push(logEntry);
            storyLogs.push(logEntry);
          }
        }
      } else if (eventType === 'PARTY') {
        const p = payload as PartyActionPayload;
        if (p.name) {
          const compName = p.name.trim();
          const targetComp = companions.find((c) => c.name.toLowerCase() === compName.toLowerCase());

          if (p.action === 'leave' && targetComp && targetComp.status === 'active') {
            targetComp.status = 'left';
            targetComp.leftReason = p.reason || '因个人理念或外部变故暂时离开队伍';
            const logEntry: TRPGStoryLogEntry = {
              id: `log-pty-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
              category: 'party',
              title: `队友离队：${targetComp.name}`,
              detail: targetComp.leftReason,
              timestamp: Date.now(),
            };
            newLogs.push(logEntry);
            storyLogs.push(logEntry);
          } else if (p.action === 'recruit' && targetComp && targetComp.status !== 'active') {
            targetComp.status = 'active';
            targetComp.leftReason = undefined;
            const logEntry: TRPGStoryLogEntry = {
              id: `log-pty-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
              category: 'party',
              title: `队友重新入队：${targetComp.name}`,
              detail: p.reason || '再次并肩作战',
              timestamp: Date.now(),
            };
            newLogs.push(logEntry);
            storyLogs.push(logEntry);
          }
        }
      } else if (eventType === 'LOG') {
        const p = payload as LogActionPayload;
        if (p.title && p.detail) {
          const logEntry: TRPGStoryLogEntry = {
            id: `log-custom-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            category: p.category || 'story',
            title: p.title.trim(),
            detail: p.detail.trim(),
            timestamp: Date.now(),
          };
          newLogs.push(logEntry);
          storyLogs.push(logEntry);
        }
      } else if (eventType === 'MAP') {
        const p = payload as MapActionPayload;
        const targetQuery = (p.locationId || p.name || '').toLowerCase().trim();

        if (targetQuery && Array.isArray(mapState.locations)) {
          const targetLoc = mapState.locations.find(
            (l: any) =>
              l.id.toLowerCase() === targetQuery ||
              l.name.toLowerCase() === targetQuery ||
              l.name.toLowerCase().includes(targetQuery)
          );

          if (targetLoc) {
            if (p.action === 'unlock' && targetLoc.status === 'unexplored') {
              targetLoc.status = 'known';
              targetLoc.discoveredAt = Date.now();
              const logEntry: TRPGStoryLogEntry = {
                id: `log-map-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                category: 'story',
                title: `探明新地点：${targetLoc.name}`,
                detail: p.reason || `通过剧情线索与行商传闻，你得知了前往【${targetLoc.name}】的通路。`,
                timestamp: Date.now(),
              };
              newLogs.push(logEntry);
              storyLogs.push(logEntry);
            } else if (p.action === 'move') {
              const prevLoc = mapState.locations.find(
                (l: any) => l.id === mapState.currentLocationId
              );
              if (prevLoc) {
                prevLoc.status = 'explored';
              }
              targetLoc.status = 'current';
              targetLoc.lastVisitedAt = Date.now();
              mapState.currentLocationId = targetLoc.id;

              const logEntry: TRPGStoryLogEntry = {
                id: `log-map-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                category: 'story',
                title: `抵达地点：${targetLoc.name}`,
                detail: p.reason || `队伍已踏足【${targetLoc.name}】。`,
                timestamp: Date.now(),
              };
              newLogs.push(logEntry);
              storyLogs.push(logEntry);
            }
          }
        }
      }
    } catch (err) {
      console.warn('Failed to parse structured TRPG event tag:', jsonStr, err);
    }
  }

  // Sanitize all [EVENT_...: {...}] from user-facing text
  cleanText = cleanText.replace(/\[EVENT_(RELATION|QUEST|PARTY|LOG|MAP):\s*\{[\s\S]*?\}\s*\]\n?/g, '').trim();

  const updatedSession: TRPGSession = {
    ...session,
    companions,
    npcRelations,
    quests,
    storyLogs,
    mapState,
    updatedAt: Date.now(),
  };

  return {
    cleanText,
    updatedSession,
    appliedLogs: newLogs,
  };
}

/**
 * Transfers an item between player and a companion, ensuring equipment state and quantities are cleanly handled
 */
export function transferItemBetweenPlayerAndCompanion(params: {
  session: TRPGSession;
  itemId: string;
  from: 'player' | { companionId: string };
  to: 'player' | { companionId: string };
}): TRPGSession {
  const { session, itemId, from, to } = params;
  const player = JSON.parse(JSON.stringify(session.character));
  const companions: TRPGCompanion[] = JSON.parse(JSON.stringify(session.companions || []));

  let sourceItem: TRPGItem | undefined;

  // 1. Remove from source
  if (from === 'player') {
    const idx = player.inventory.findIndex((i: TRPGItem) => i.id === itemId);
    if (idx >= 0) {
      sourceItem = player.inventory[idx];
      player.inventory.splice(idx, 1);
    }
  } else {
    const comp = companions.find((c) => c.id === from.companionId);
    if (comp) {
      const idx = comp.character.inventory.findIndex((i: TRPGItem) => i.id === itemId);
      if (idx >= 0) {
        sourceItem = comp.character.inventory[idx];
        comp.character.inventory.splice(idx, 1);
      }
    }
  }

  if (!sourceItem) return session;

  // Un-equip during transit
  const transferredItem: TRPGItem = {
    ...sourceItem,
    equipped: false,
  };

  let targetName = '玩家';
  let sourceName = '玩家';

  if (from !== 'player') {
    const sComp = companions.find((c) => c.id === from.companionId);
    if (sComp) sourceName = sComp.name;
  }

  // 2. Add to destination
  if (to === 'player') {
    player.inventory.push(transferredItem);
    targetName = player.name;
  } else {
    const dComp = companions.find((c) => c.id === to.companionId);
    if (dComp) {
      dComp.character.inventory.push(transferredItem);
      targetName = dComp.name;
    }
  }

  const logEntry: TRPGStoryLogEntry = {
    id: `log-item-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    category: 'item',
    title: `装备分配：${transferredItem.name}`,
    detail: `将【${transferredItem.name}】从 [${sourceName}] 移交分配给了 [${targetName}]。`,
    timestamp: Date.now(),
  };

  const updatedStoryLogs = [...(session.storyLogs || []), logEntry];

  return {
    ...session,
    character: player,
    companions,
    storyLogs: updatedStoryLogs,
    updatedAt: Date.now(),
  };
}
