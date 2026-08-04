/**
 * 《我在唐朝当掌柜》迷雾系统纯函数（TANG-MIST-001 模块一）
 * 三类迷雾：区域（regions）/ 势力（factions）/ 人物（npcs）。
 * 纯函数（可测；不直接调用 store）：
 * - buildInitialFogState：开局雾态（L1 揭示；L2/L3 仅核心点揭示；势力/NPC 按好感度部分揭示）
 * - checkFogReveals：每日打烊批量揭示（按好感度/线索数；返回新揭示列表）
 * - revealRegion / revealFactionInfo / revealNPCInfo：单点揭示（幂等）
 * - maybeRevealRegionOnTravel：快速移动经过未探访节点 20% 自动揭示
 * - performExploreRegions：午后「探访未知区域」揭示 1-2 个未探明点位
 * 铁律：古风措辞；纯函数可测；不持有游戏状态；凛冬要塞（src/systems/map/fog-manager.ts）零触碰。
 */
import { MAP_NODES, MAP_NODE_MAP } from '@/config/tang-map-data';
import { FIVE_FACTIONS } from '@/config/tang-factions';
import { REGION_HINTS, buildRegionFogHint } from '@/config/tang-region-hints';
import { FACTION_HIDDEN_AGENDAS } from '@/config/tang-fog-hints';
import type { Faction, NPCFavor } from '@/types/tang-factions';
import type { Clue, ClueCategory } from '@/types/tang-clues';
import type { FactionFog, FogRevealResult, FogState, NPCFog, RegionFog } from '@/types/tang-manager';

// ---- 揭示阈值（用户 1.1 逐字）----
export const FACTION_LEADER_THRESHOLD = 40;
export const FACTION_RELATIONS_THRESHOLD = 60;
export const FACTION_PERKS_THRESHOLD = 80;
export const NPC_BACKGROUND_THRESHOLD = 40;
export const NPC_HEART_THRESHOLD = 60;
export const NPC_TRUE_ATTITUDE_THRESHOLD = 80;
/** 隐藏目的揭示所需线索数（线索墙该势力线索 ≥3 条） */
export const HIDDEN_AGENDA_CLUE_COUNT = 3;
/** 午后「探访未知区域」精力消耗（用户 1.2：10 精力） */
export const EXPLORE_ENERGY_COST = 10;
/** 快速移动经过未探访节点自动揭示概率（用户 1.2：20%） */
export const QUICK_TRAVEL_REVEAL_CHANCE = 0.2;

/** 势力揭示信息类型 */
export type FactionInfoType = 'leader' | 'relations' | 'perks' | 'hiddenAgenda';
/** NPC 揭示信息类型 */
export type NPCInfoType = 'background' | 'heart' | 'trueAttitude' | 'fullStory';

/** 势力 → 线索类别映射（线索墙该势力线索≥3 条揭示隐藏目的；工程定：东市=沈氏线/西市=谢七线/京兆府+朝廷=庙堂/地下=隐秘/平康坊=商海，注释） */
export const FACTION_CLUE_CATEGORY: Record<string, ClueCategory[]> = {
  dongshi: ['shen'],
  xishi: ['xie'],
  jingzhao: ['politics'],
  underground: ['secret'],
  pingkang: ['business'],
  court: ['politics'],
};

/** 迷雾判定所需状态子集（只读；store 组装传入） */
export interface FogRevealState {
  fogOfWar: FogState;
  factions: readonly Faction[];
  npcFavors: readonly NPCFavor[];
  clues: readonly Clue[];
}

/** 初始雾态参数（与 buildNpcFavors 的 favors 一致；a-zhao 取小二好感） */
export interface FogInitParams {
  shenTinglanFavor: number;
  xieQiFavor: number;
  fuyinFavor: number;
  zhaoYuanwaiFavor: number;
  xiaoerFavor: number;
}

/** L2/L3 核心点位（层解锁时首见 1-2 个；工程定：L2 东市商会/西市商团、L3 巍明楼，注释） */
export const CORE_REGION_NODES: readonly string[] = ['dongshi-shanghui', 'xishi-shangtuan', 'weiming-lou'];

// ============================================================
// 初始雾态
// ============================================================

/**
 * 构建开局雾态：
 * - 区域：L1 永乐坊全部揭示；L2/L3 仅核心点揭示，其余未探明（revealed=false）
 * - 势力：五势力 + 朝廷派系 court；按初始关系部分揭示（<40 全部隐藏；≥40 首领已知）
 * - NPC：沈听澜/谢七/京兆府尹/赵员外/阿昭；按初始好感部分揭示（M1 仅结构，文案 M2 填充）
 */
export function buildInitialFogState(params: FogInitParams): FogState {
  // ---- 区域 ----
  const regions: Record<string, RegionFog> = {};
  MAP_NODES.forEach((n, idx) => {
    const isCore = n.layer !== 'yongle' && CORE_REGION_NODES.includes(n.id);
    const revealed = n.layer === 'yongle' || isCore;
    const hint = REGION_HINTS[idx % REGION_HINTS.length] ?? REGION_HINTS[0]!;
    regions[n.id] = {
      nodeId: n.id,
      revealed,
      hint,
      revealCondition: buildRegionFogHint(n.id).revealCondition,
    };
  });

  // ---- 势力 ----
  const factions: Record<string, FactionFog> = {};
  const initialRel: Record<string, number> = {};
  for (const f of FIVE_FACTIONS) initialRel[f.id] = f.relationship;
  initialRel.court = 0; // 朝廷派系无势力卡，开局 0
  for (const fid of ['dongshi', 'xishi', 'jingzhao', 'underground', 'pingkang', 'court'] as const) {
    const rel = initialRel[fid] ?? 0;
    factions[fid] = {
      factionId: fid,
      leaderRevealed: rel >= FACTION_LEADER_THRESHOLD,
      relationsRevealed: rel >= FACTION_RELATIONS_THRESHOLD,
      perksRevealed: rel >= FACTION_PERKS_THRESHOLD,
      hiddenAgendaRevealed: false, // 线索墙 ≥3 条才揭示
      hiddenAgenda: FACTION_HIDDEN_AGENDAS[fid] ?? '',
    };
  }

  // ---- NPC（M1 仅结构；文案占位空串，M2 填充）----
  const npcFavor: Record<string, number> = {
    'shen-tinglan': params.shenTinglanFavor,
    'xie-qi': params.xieQiFavor,
    'fu-yin': params.fuyinFavor,
    'zhao-yuanwai': params.zhaoYuanwaiFavor,
    'a-zhao': params.xiaoerFavor,
  };
  const npcs: Record<string, NPCFog> = {};
  for (const [nid, favor] of Object.entries(npcFavor)) {
    npcs[nid] = {
      npcId: nid,
      backgroundRevealed: favor >= NPC_BACKGROUND_THRESHOLD,
      heartRevealed: favor >= NPC_HEART_THRESHOLD,
      trueAttitudeRevealed: favor >= NPC_TRUE_ATTITUDE_THRESHOLD,
      fullStoryRevealed: false,
      trueAttitude: '', // M2 填充
      hiddenStory: '', // M2 填充
    };
  }

  return { regions, factions, npcs };
}

// ============================================================
// 揭示判定（checkFogReveals：每日打烊批量）
// ============================================================

/** 该势力已关联线索数（按 FACTION_CLUE_CATEGORY 聚合计数） */
export function countCluesForFaction(factionId: string, clues: readonly Clue[]): number {
  const cats = FACTION_CLUE_CATEGORY[factionId] ?? [];
  if (cats.length === 0) return 0;
  return clues.filter((c) => cats.includes(c.category)).length;
}

/** 势力隐藏目的是否已满足揭示条件（线索墙该势力线索 ≥3 条） */
export function factionHiddenAgendaRevealed(factionId: string, clues: readonly Clue[]): boolean {
  return countCluesForFaction(factionId, clues) >= HIDDEN_AGENDA_CLUE_COUNT;
}

const FACTION_INFO_LABEL: Record<FactionInfoType, string> = {
  leader: '已探明首领',
  relations: '已探明关系脉络',
  perks: '已探明门路特权',
  hiddenAgenda: '已窥破隐藏目的',
};

const NPC_INFO_LABEL: Record<NPCInfoType, string> = {
  background: '已探知其背景',
  heart: '已探知其心结',
  trueAttitude: '已探知其真实态度',
  fullStory: '已探知完整隐藏故事',
};

/**
 * 每日打烊批量揭示（纯函数）：按好感度/线索数把满足阈值的信息点亮。
 * 返回更新后的雾态（无变化时返回原引用，便于 store 跳过 set）与新揭示列表。
 * 注：NPC fullStory 仅在专属事件后由 revealNPCInfo 触发，此处不自动揭示。
 */
export function checkFogReveals(state: FogRevealState): { fogOfWar: FogState; revealed: FogRevealResult[] } {
  let regions = state.fogOfWar.regions;
  let factions = state.fogOfWar.factions;
  let npcs = state.fogOfWar.npcs;
  const revealed: FogRevealResult[] = [];
  let changed = false;

  // ---- 势力 ----
  const factionRel: Record<string, number> = {};
  for (const f of state.factions) factionRel[f.id] = f.relationship;
  for (const fid of Object.keys(factions)) {
    const fog = factions[fid]!;
    const rel = factionRel[fid] ?? 0;
    let next: FactionFog = fog;
    if (!next.leaderRevealed && rel >= FACTION_LEADER_THRESHOLD) {
      next = { ...next, leaderRevealed: true };
      revealed.push({ kind: 'faction', id: fid, infoType: 'leader', label: FACTION_INFO_LABEL.leader });
    }
    if (!next.relationsRevealed && rel >= FACTION_RELATIONS_THRESHOLD) {
      next = { ...next, relationsRevealed: true };
      revealed.push({ kind: 'faction', id: fid, infoType: 'relations', label: FACTION_INFO_LABEL.relations });
    }
    if (!next.perksRevealed && rel >= FACTION_PERKS_THRESHOLD) {
      next = { ...next, perksRevealed: true };
      revealed.push({ kind: 'faction', id: fid, infoType: 'perks', label: FACTION_INFO_LABEL.perks });
    }
    if (!next.hiddenAgendaRevealed && factionHiddenAgendaRevealed(fid, state.clues)) {
      next = { ...next, hiddenAgendaRevealed: true };
      revealed.push({ kind: 'faction', id: fid, infoType: 'hiddenAgenda', label: FACTION_INFO_LABEL.hiddenAgenda });
    }
    if (next !== fog) {
      changed = true;
      factions = { ...factions, [fid]: next };
    }
  }

  // ---- NPC ----
  const npcFavorMap: Record<string, number> = {};
  for (const n of state.npcFavors) npcFavorMap[n.npcId] = n.favor;
  for (const nid of Object.keys(npcs)) {
    const fog = npcs[nid]!;
    const favor = npcFavorMap[nid] ?? 0;
    let next: NPCFog = fog;
    if (!next.backgroundRevealed && favor >= NPC_BACKGROUND_THRESHOLD) {
      next = { ...next, backgroundRevealed: true };
      revealed.push({ kind: 'npc', id: nid, infoType: 'background', label: NPC_INFO_LABEL.background });
    }
    if (!next.heartRevealed && favor >= NPC_HEART_THRESHOLD) {
      next = { ...next, heartRevealed: true };
      revealed.push({ kind: 'npc', id: nid, infoType: 'heart', label: NPC_INFO_LABEL.heart });
    }
    if (!next.trueAttitudeRevealed && favor >= NPC_TRUE_ATTITUDE_THRESHOLD) {
      next = { ...next, trueAttitudeRevealed: true };
      revealed.push({ kind: 'npc', id: nid, infoType: 'trueAttitude', label: NPC_INFO_LABEL.trueAttitude });
    }
    if (next !== fog) {
      changed = true;
      npcs = { ...npcs, [nid]: next };
    }
  }

  if (!changed) {
    return { fogOfWar: state.fogOfWar, revealed };
  }
  return { fogOfWar: { regions, factions, npcs }, revealed };
}

// ============================================================
// 单点揭示（幂等）
// ============================================================

/** 区域揭示（午后探访/闲聊情报/快速移动调用；已揭示幂等返回 changed=false） */
export function revealRegion(
  state: FogRevealState,
  nodeId: string
): { fogOfWar: FogState; changed: boolean; region?: RegionFog; nodeName?: string } {
  const region = state.fogOfWar.regions[nodeId];
  if (!region || region.revealed) {
    return { fogOfWar: state.fogOfWar, changed: false };
  }
  const nextRegion: RegionFog = { ...region, revealed: true };
  return {
    fogOfWar: { ...state.fogOfWar, regions: { ...state.fogOfWar.regions, [nodeId]: nextRegion } },
    changed: true,
    region: nextRegion,
    nodeName: MAP_NODE_MAP[nodeId]?.name,
  };
}

/** 势力单点揭示（任务/情报强制揭示；幂等） */
export function revealFactionInfo(
  state: FogRevealState,
  factionId: string,
  infoType: FactionInfoType
): { fogOfWar: FogState; changed: boolean } {
  const fog = state.fogOfWar.factions[factionId];
  if (!fog) return { fogOfWar: state.fogOfWar, changed: false };
  let next: FactionFog = fog;
  if (infoType === 'leader' && !next.leaderRevealed) next = { ...next, leaderRevealed: true };
  else if (infoType === 'relations' && !next.relationsRevealed) next = { ...next, relationsRevealed: true };
  else if (infoType === 'perks' && !next.perksRevealed) next = { ...next, perksRevealed: true };
  else if (infoType === 'hiddenAgenda' && !next.hiddenAgendaRevealed) next = { ...next, hiddenAgendaRevealed: true };
  if (next === fog) return { fogOfWar: state.fogOfWar, changed: false };
  return {
    fogOfWar: { ...state.fogOfWar, factions: { ...state.fogOfWar.factions, [factionId]: next } },
    changed: true,
  };
}

/** NPC 单点揭示（专属事件后完整故事等；幂等） */
export function revealNPCInfo(
  state: FogRevealState,
  npcId: string,
  infoType: NPCInfoType
): { fogOfWar: FogState; changed: boolean } {
  const fog = state.fogOfWar.npcs[npcId];
  if (!fog) return { fogOfWar: state.fogOfWar, changed: false };
  let next: NPCFog = fog;
  if (infoType === 'background' && !next.backgroundRevealed) next = { ...next, backgroundRevealed: true };
  else if (infoType === 'heart' && !next.heartRevealed) next = { ...next, heartRevealed: true };
  else if (infoType === 'trueAttitude' && !next.trueAttitudeRevealed) next = { ...next, trueAttitudeRevealed: true };
  else if (infoType === 'fullStory' && !next.fullStoryRevealed) next = { ...next, fullStoryRevealed: true };
  if (next === fog) return { fogOfWar: state.fogOfWar, changed: false };
  return {
    fogOfWar: { ...state.fogOfWar, npcs: { ...state.fogOfWar.npcs, [npcId]: next } },
    changed: true,
  };
}

// ============================================================
// 快速移动 20% 自动揭示 / 午后探访未知区域
// ============================================================

/** 快速移动经过未探访节点：20% 自动揭示（rng 可注入；用户 1.2） */
export function maybeRevealRegionOnTravel(
  state: FogRevealState,
  nodeId: string,
  rng: () => number = Math.random
): { fogOfWar: FogState; changed: boolean } {
  const region = state.fogOfWar.regions[nodeId];
  if (!region || region.revealed) return { fogOfWar: state.fogOfWar, changed: false };
  if (rng() >= QUICK_TRAVEL_REVEAL_CHANCE) return { fogOfWar: state.fogOfWar, changed: false };
  return revealRegion(state, nodeId);
}

/** 午后探访结果（揭示点位 + 古风叙事） */
export interface RegionRevealOutcome {
  /** 本次探明的点位 id（1-2 个） */
  revealedIds: string[];
  narrative: string;
}

/** 未探明区域列表（UI 探访按钮显隐/禁用判定） */
export function unrevealedRegions(fog: FogState): RegionFog[] {
  return Object.values(fog.regions).filter((r) => !r.revealed);
}

/**
 * 午后「探访未知区域」（用户 1.2：消耗 10 精力，揭示 1-2 个未探明点位）。
 * 纯函数：只返回应揭示的点位与叙事；精力/次数消耗由 store 应用。
 * 精力消耗常量见 EXPLORE_ENERGY_COST（store/UI 共用）。
 */
export function performExploreRegions(state: FogRevealState, rng: () => number = Math.random): RegionRevealOutcome {
  const hidden = unrevealedRegions(state.fogOfWar);
  if (hidden.length === 0) {
    return { revealedIds: [], narrative: '你走遍城中街巷，凡可探之处皆已了然于胸，再无未知的去处。' };
  }
  // 揭示 1-2 个（不超过剩余未探明数）；乱序抽样由 store 逐条 revealRegion 落库
  const count = Math.min(hidden.length, 1 + Math.floor(rng() * 2));
  const shuffled = [...hidden].sort(() => rng() - 0.5);
  const chosen = shuffled.slice(0, count);
  const revealedIds = chosen.map((r) => r.nodeId);
  const names = revealedIds.map((id) => MAP_NODE_MAP[id]?.name ?? id).join('、');
  return {
    revealedIds,
    narrative:
      names.length > 0
        ? `你趁着午后日头，专挑平日不常去的巷陌走了走。东拐西绕间，${names} 的来龙去脉竟被你摸清了几分。`
        : '你趁着午后日头走了半日，却一无所获，只得怏怏而归。',
  };
}
