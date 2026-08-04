/**
 * 《我在唐朝当掌柜》蛛丝马迹系统（Step 5b-5 模块二）
 * 蛛丝马迹："蛛丝马迹：将各处搜集来的零散情报汇集一处，若有心串联，或可窥见长安城暗流之下的真相。"
 * 纯函数：
 * - generateClue(source, sourceType, category, state)：从 CLUE_POOL 按类别抽取未落线索，生成 Clue。
 * - connectClues(state)：每日打烊自动关联（同类别 ≥3 条，两两互连，去重）。
 * - 玩家手动连接由 store action connectClues(a,b) 调用（系统层提供 pairwiseConnect 供复用）。
 * 铁律：古风措辞；不持有游戏状态。
 */
import { CLUE_POOL_MAP, unusedCluesByCategory } from '@/config/tang-clue-pool';
import type { Clue, ClueCategory, ClueSourceType } from '@/types/tang-clues';

/** 生成所需状态子集（只读 day + 已有线索） */
export interface ClueState {
  day: number;
  clues: readonly Clue[];
}

/** 生成线索（池中抽取；该类别已抽尽返回 null） */
export function generateClue(
  source: string,
  sourceType: ClueSourceType,
  category: ClueCategory,
  state: ClueState,
  rng: () => number = Math.random
): Clue | null {
  const existingIds = state.clues.map((c) => c.id);
  const candidates = unusedCluesByCategory(category, existingIds);
  if (candidates.length === 0) {
    return null;
  }
  const item = candidates[Math.floor(rng() * candidates.length)]!;
  return {
    id: item.id,
    source,
    sourceType,
    content: item.content,
    category,
    day: state.day,
    connected: [],
    resolved: false,
  };
}

/** 两两互连（去重；返回更新后的线索数组与本次新增连线） */
export function pairwiseConnect(
  clues: readonly Clue[],
  idA: string,
  idB: string
): { clues: Clue[]; connected: boolean } {
  if (idA === idB) return { clues: [...clues], connected: false };
  let changed = false;
  const next = clues.map((c) => {
    if (c.id === idA && !c.connected.includes(idB)) {
      changed = true;
      return { ...c, connected: [...c.connected, idB] };
    }
    if (c.id === idB && !c.connected.includes(idA)) {
      changed = true;
      return { ...c, connected: [...c.connected, idA] };
    }
    return c;
  });
  return { clues: next, connected: changed };
}

/**
 * 每日打烊自动关联：同类别线索 ≥3 条时两两互连（去重）。
 * 返回更新后的线索 + 本次新增连线对（[a,b]）。
 */
export function connectClues(
  state: ClueState
): { clues: Clue[]; connections: Array<[string, string]> } {
  let clues = [...state.clues];
  const connections: Array<[string, string]> = [];
  const byCategory = new Map<ClueCategory, Clue[]>();
  for (const c of clues) {
    const list = byCategory.get(c.category) ?? [];
    list.push(c);
    byCategory.set(c.category, list);
  }
  for (const group of byCategory.values()) {
    if (group.length < 3) continue;
    for (let i = 0; i < group.length; i++) {
      for (let j = i + 1; j < group.length; j++) {
        const a = group[i]!;
        const b = group[j]!;
        if (a.connected.includes(b.id) || b.connected.includes(a.id)) continue;
        const res = pairwiseConnect(clues, a.id, b.id);
        clues = res.clues;
        connections.push([a.id, b.id]);
      }
    }
  }
  return { clues, connections };
}

/** 解析线索（置 resolved=true；返回更新后线索；不存在返回原数组） */
export function resolveClue(
  clues: readonly Clue[],
  clueId: string
): { clues: Clue[]; changed: boolean } {
  let changed = false;
  const next = clues.map((c) => {
    if (c.id === clueId && !c.resolved) {
      changed = true;
      return { ...c, resolved: true };
    }
    return c;
  });
  return { clues: next, changed };
}

/**
 * 手动连接判定（内容深化 TANG-CONT-B 模块六·3）：
 * 同类别或已在关联 → 'match'（提示「你隐约觉得这两件事有关联」并 connectClues）；
 * 否则 → 'none'（提示「这两件事似乎没什么关系」，不连接）。
 */
export function judgeClueConnection(
  clues: readonly Clue[],
  idA: string,
  idB: string
): 'match' | 'none' {
  if (idA === idB) return 'none';
  const a = clues.find((c) => c.id === idA);
  const b = clues.find((c) => c.id === idB);
  if (!a || !b) return 'none';
  if (a.connected.includes(idB) || b.connected.includes(idA)) return 'match';
  return a.category === b.category ? 'match' : 'none';
}

/** 从线索池按 id 取默认内容（生成时若未命中池则兜底） */
export function cluePoolContentById(id: string): string {
  return CLUE_POOL_MAP[id]?.content ?? '';
}
