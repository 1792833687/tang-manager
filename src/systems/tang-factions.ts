/**
 * 《我在唐朝当掌柜》名声关系网系统（TANG-SOC-001 模块五）
 * 世交/门路："世交：商号与长安各大势力之间的交情深浅，影响货源、定价、官府照拂。"
 * 纯函数：updateFactionRelationship / applyFactionTrigger / getFactionPerks / syncNpcFavor；
 * store 接线应用。
 * 规则（用户规格 6.1 逐字）：
 * - updateFactionRelationship：clamp 0-100、记录原因、跨阈值提示解锁。
 * - 触发规则：商会任务+5~15 / 胡商交易+3~8 / 按时缴税+5 / 灰色手段 地下+10 京兆-10 东市-5 /
 *   揭发同行 东市+10 西市-5 / 商会活动+5 / 官府罚款-3。
 * - NPC 好感联动（5.3）：沈听澜/谢七/赵员外/府尹。
 */
import type { Faction, FactionPerk, FactionUpdateResult, NPCFavor } from '@/types/tang-factions';
import {
  FACTION_NPC_MAP,
  FACTION_TRIGGER_RULES,
  factionById,
  factionVerdict,
  perksUnlocked,
} from '@/config/tang-factions';

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * 更新势力关系（clamp 0-100、记录原因、跨阈值提示解锁）。
 * 返回更新后的势力列表 + 结果（含 newlyUnlocked）。
 */
export function updateFactionRelationship(
  factions: readonly Faction[],
  factionId: string,
  delta: number,
  reason: string
): { factions: Faction[]; result: FactionUpdateResult | null } {
  const faction = factions.find((f) => f.id === factionId);
  if (!faction) return { factions: [...factions], result: null };
  const before = faction.relationship;
  const relationship = clamp(before + delta, 0, 100);
  const actualDelta = relationship - before;
  const newlyUnlocked = faction.perks.filter(
    (p) => before < p.threshold && relationship >= p.threshold
  );
  const nextFaction: Faction = {
    ...faction,
    relationship,
    perks: faction.perks, // 静态配置保留；解锁判断按 relationship
  };
  return {
    factions: factions.map((f) => (f.id === factionId ? nextFaction : f)),
    result: {
      factionId,
      factionName: faction.name,
      relationship,
      delta: actualDelta,
      reason,
      newlyUnlocked,
      verdict: factionVerdict(relationship),
    },
  };
}

/**
 * 应用触发规则（6.1）。ruleId 见 FACTION_TRIGGER_RULES；返回更新后势力 + 各势力变动结果。
 */
export function applyFactionTrigger(
  factions: readonly Faction[],
  ruleId: string,
  reason: string
): { factions: Faction[]; results: FactionUpdateResult[] } {
  const rule = FACTION_TRIGGER_RULES[ruleId];
  if (!rule) return { factions: [...factions], results: [] };
  let next = [...factions];
  const results: FactionUpdateResult[] = [];
  for (const [fid, delta] of Object.entries(rule)) {
    const r = updateFactionRelationship(next, fid, delta ?? 0, reason);
    if (r.result) {
      next = r.factions;
      results.push(r.result);
    }
  }
  return { factions: next, results };
}

/** 获取势力已解锁特权（relationship ≥ threshold） */
export function getFactionPerks(faction: Faction): FactionPerk[] {
  return perksUnlocked(faction);
}

/** 按 id 获取势力（兜底东市商会） */
export function getFaction(factions: readonly Faction[], factionId: string): Faction {
  return factions.find((f) => f.id === factionId) ?? factions[0] ?? factionById(factionId);
}

/**
 * NPC 好感联动（5.3）：势力关系变动按 FACTION_NPC_MAP 同步 NPC favor（同向 delta × 0.5）。
 * 返回更新后的 npcFavors 列表。
 */
export function syncNpcFavor(
  npcFavors: readonly NPCFavor[],
  factionId: string,
  factionDelta: number,
  favors: { shenTinglanFavor: number; xieQiFavor: number; fuyinFavor: number; zhaoYuanwaiFavor: number }
): { npcFavors: NPCFavor[]; favors: typeof favors } {
  const map = FACTION_NPC_MAP[factionId];
  if (!map) return { npcFavors: [...npcFavors], favors };
  const npcDelta = Math.round(factionDelta * 0.5);
  const key = map.stateKey;
  const newFavor = clamp(favors[key] + npcDelta, 0, 100);
  const updatedFavors = { ...favors, [key]: newFavor };
  return {
    npcFavors: npcFavors.map((n) =>
      n.npcId === map.npcId
        ? {
            ...n,
            favor: newFavor,
            relationship: factionVerdict(newFavor),
            unlockedPerks: getFactionPerks(getFaction([], factionId)).filter((p) => newFavor >= p.threshold).map((p) => p.name),
          }
        : n
    ),
    favors: updatedFavors,
  };
}

/** 重建完整 npcFavors（store 初始化/刷新；config buildNpcFavors） */
export { buildNpcFavors } from '@/config/tang-factions';
