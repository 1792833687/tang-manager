/**
 * 《我在唐朝当掌柜》节点居民对话系统（地图与事件深化 模块一 1.2）
 * 每个节点 1-2 位常驻居民；访问时概率触发简短对话；部分对话带效果（如 羊肉进价-10%）。
 * 不消耗精力（随口聊两句）。纯函数：rng 可注入。
 */
import { RESIDENT_LINES, RESIDENT_NAME_POOL } from '@/config/tang-node-stories-content';
import type { NodeResident, ResidentType } from '@/types/tang-map-story';

function pick<T>(arr: readonly T[], rng: () => number): T {
  const idx = Math.floor(rng() * arr.length);
  return arr[Math.min(idx, arr.length - 1)]!;
}

/** 生成 1-2 位常驻居民（纯函数；按节点确定性种子） */
export function generateResidents(nodeId: string, seed: number, rng: () => number = Math.random): NodeResident[] {
  const types: ResidentType[] = ['店伙计', '老住户', '路人', '小孩'];
  const count = 1 + Math.floor(rng() * 2);
  const chosen = new Set<ResidentType>();
  const residents: NodeResident[] = [];
  let guard = 0;
  while (residents.length < count && guard < 10) {
    guard++;
    const type = pick(types, rng);
    if (chosen.has(type) && residents.length >= 2) continue;
    chosen.add(type);
    const entry = pick(RESIDENT_LINES[type], rng);
    residents.push({
      id: `nr-${nodeId}-${type}-${seed}-${Math.floor(rng() * 1000)}`,
      nodeId,
      name: pick(RESIDENT_NAME_POOL[type], rng),
      type,
      line: entry.line,
      ...(entry.effect ? { effect: entry.effect } : {}),
    });
  }
  return residents;
}

/** 与居民攀谈（纯函数）：随机一位居民说一句话；40% 概率（无消耗） */
export function chatWithResident(
  residents: readonly NodeResident[],
  rng: () => number = Math.random
): { resident: NodeResident; triggered: boolean } {
  if (residents.length === 0 || rng() >= 0.4) {
    return { resident: residents[0] ?? { id: '', nodeId: '', name: '', type: '路人', line: '' }, triggered: false };
  }
  const resident = pick(residents, rng);
  return { resident, triggered: true };
}

/** 居民对话效果摘要（纯函数；UI 展示/落账用） */
export function residentEffectNote(resident: NodeResident): string {
  return resident.effect?.note ?? '';
}

/** 居民效果是否命中类型（纯函数） */
export function residentHasEffect(resident: NodeResident, type: string): boolean {
  return resident.effect?.type === type;
}
