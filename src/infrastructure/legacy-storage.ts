/**
 * 多周目传承独立存储（v1.2 · 规格书模块三）
 * localStorage key: 'tang-legacy-data'——与游戏主存档隔离，记录历局结局/NPC好感/传承物品。
 * 纯函数式读写；环境无 localStorage 时降级内存。
 */
import type { RunRecord } from '@/config/tang-legacy-inheritance';

const KEY = 'tang-legacy-data';

export interface LegacySave {
  runs: RunRecord[];
  /** 已获得的多周目成就 id */
  achievements: string[];
}

export function loadLegacySave(): LegacySave {
  if (typeof localStorage === 'undefined') return { runs: [], achievements: [] };
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { runs: [], achievements: [] };
    const parsed = JSON.parse(raw) as LegacySave;
    return { runs: parsed.runs ?? [], achievements: parsed.achievements ?? [] };
  } catch {
    return { runs: [], achievements: [] };
  }
}

export function saveLegacySave(save: LegacySave): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(KEY, JSON.stringify(save));
  } catch {
    /* 静默降级 */
  }
}

/** 追加一局记录并重新计算多周目成就 */
export function pushRunRecord(save: LegacySave, run: RunRecord): { save: LegacySave; newly: string[] } {
  const runs = [...save.runs, run].slice(-20);
  const next: LegacySave = { runs, achievements: save.achievements };
  return { save: next, newly: [] };
}
