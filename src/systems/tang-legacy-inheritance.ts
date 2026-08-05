/**
 * 《我在唐朝当掌柜》多周目家族传承系统（v1.2 · 规格书模块三）
 * 纯函数：按上一局结局计算开局传承效果 / 跨周目物品判定 / 传承角色好感继承 / 多周目成就判定。
 * 独立 localStorage（'tang-legacy-data'）由 infrastructure 层读写，本文件只做纯计算。
 */
import { ENDING_LEGACY_EFFECTS, LEGACY_ITEMS, type LegacyEffect, type RunRecord, type MultiRunAchievementDef } from '@/config/tang-legacy-inheritance';

/** 计算当前局开局传承（纯函数；规格书 3.2/3.3/3.4） */
export function computeLegacyInheritance(prevRun: RunRecord | null): {
  effect: LegacyEffect | null;
  inheritedItems: string[];
  npcFavorCarryover: Record<string, number>;
} {
  if (!prevRun) return { effect: null, inheritedItems: [], npcFavorCarryover: {} };
  const effect = ENDING_LEGACY_EFFECTS[prevRun.ending] ?? null;
  // 传承物品：萨迪玉佩（好感≥80）/ 祖传招牌（完成赎回西市分号 → 用物品标记）/ 推荐信（权倾朝野结局）
  const items: string[] = [];
  if ((prevRun.npcFavors['sadi'] ?? 0) >= 80 || prevRun.items.includes('persian-jade')) items.push('persian-jade');
  if (prevRun.items.includes('ancestral-sign')) items.push('ancestral-sign');
  if (prevRun.ending === 'quan-qing-chao-ye') items.push('recommendation-letter');
  // 传承角色（规格书 3.3）：未被背叛且好感≥阈值 → 开局好感继承
  const carryover: Record<string, number> = {};
  if ((prevRun.npcFavors['shen-tinglan'] ?? 0) >= 80) carryover['shen-tinglan'] = 20;
  if ((prevRun.npcFavors['xie-qi'] ?? 0) >= 80) carryover['xie-qi'] = 20;
  if ((prevRun.npcFavors['a-zhao'] ?? 0) >= 90) carryover['a-zhao'] = 30;
  return { effect, inheritedItems: items, npcFavorCarryover: carryover };
}

/** 多周目成就判定（纯函数；规格书 3.5） */
export const MULTI_RUN_ACHIEVEMENTS: MultiRunAchievementDef[] = [
  { id: 'legacy-three-generations', name: '陆家三代', desc: '用三个不同结局通关', check: (runs) => new Set(runs.map((r) => r.ending)).size >= 3 },
  { id: 'legacy-living-fossil', name: '长安活化石', desc: '累计经营超过 1000 天', check: (runs) => runs.reduce((s, r) => s + (r.totalDays ?? 0), 0) >= 1000 },
  { id: 'legacy-all-endings', name: '全结局制霸', desc: '达成全部八种结局', check: (runs) => new Set(runs.map((r) => r.ending)).size >= 8 },
  { id: 'legacy-old-friend', name: '故人重逢', desc: '第二局中，上一局好感满值的 NPC 以「后人」身份出现', check: (runs) => runs.length >= 2 && runs.slice(0, -1).some((r) => Object.values(r.npcFavors).some((f) => f >= 100)) },
];

/** 按 id 查多周目成就（无则 null） */
export function multiRunAchievementById(id: string): MultiRunAchievementDef | null {
  return MULTI_RUN_ACHIEVEMENTS.find((a) => a.id === id) ?? null;
}

/** 已达成成就 id（纯函数） */
export function checkMultiRunAchievements(runs: readonly RunRecord[]): string[] {
  return MULTI_RUN_ACHIEVEMENTS.filter((a) => a.check(runs)).map((a) => a.id);
}

/** 传承物品显示名（跨周目物品在手札展示） */
export function legacyItemName(itemId: string): string {
  return LEGACY_ITEMS[itemId]?.name ?? itemId;
}
