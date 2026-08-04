/**
 * 《我在唐朝当掌柜》每日自由行动定义（Step 5a 1.2）
 * - 用户 1.2 五种行动逐字；energyCost 正=消耗、负=恢复（小睡）。
 * - 执行逻辑在 systems/tang-actions.ts（纯函数，可测）；本文件只做定义。
 * - 时机：5 客（C 难度 6 客）接待完 → 打烊前，自由行动阶段。
 */
import type { ActionOption } from '@/types/tang-manager';

/** 自由行动定义（id 与 store/UI 一致） */
export interface AfternoonActionDef {
  id: string;
  label: string;
  description: string;
  /** 精力消耗（正=消耗；nap 负=恢复） */
  energyCost: number;
}

export const AFTERNOON_ACTION_DEFS: readonly AfternoonActionDef[] = [
  {
    id: 'afternoon_patrol',
    label: '午后巡查',
    description: '巡视店铺内外，防患于未然（-10 精力）',
    energyCost: 10,
  },
  {
    id: 'visit_npc',
    label: '拜访NPC',
    description: '拜访已登场的故人，联络感情（-15 精力）',
    energyCost: 15,
  },
  {
    id: 'market_recruit',
    label: '市场招聘',
    description: '去集市物色新伙计（-10 精力）',
    energyCost: 10,
  },
  {
    id: 'nap',
    label: '小睡片刻',
    description: '打个盹恢复精力（+20 精力）',
    energyCost: -20,
  },
  {
    id: 'street_wander',
    label: '市井闲逛',
    description: '在坊市间走走，兴许能打听到什么（-10 精力）',
    energyCost: 10,
  },
];

/** id → 定义索引 */
export const AFTERNOON_ACTION_MAP: Readonly<Record<string, AfternoonActionDef>> = Object.fromEntries(
  AFTERNOON_ACTION_DEFS.map((a) => [a.id, a])
);

/** 可拜访 NPC（1.2：按登场状态过滤；债主赵员外需有负债） */
export interface VisitNpcOption {
  npcId: 'shen-tinglan' | 'xie-qi' | 'zhao-yuanwai';
  name: string;
  /** 未登场原因（登场则 undefined） */
  unavailableReason?: string;
}

/** 构建 ActionOption（纯函数，供 getAvailableActions 统一组装） */
export function actionToOption(def: AfternoonActionDef): ActionOption {
  return {
    id: def.id,
    label: def.label,
    description: def.description,
    energyCost: def.energyCost,
  };
}
