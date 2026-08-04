/**
 * 《我在唐朝当掌柜》事件系统（Step 3 3.1；Step 5b-1.5 库存事件）
 * 纯函数：
 * - checkAndTriggerEvents(gameState)：返回满足触发条件且未触发过（eventLog.includes 判定）的事件；
 *   不修改输入（store 负责把返回结果填进 pendingEvents）。
 * - applyEventEffect(state, event, choice)：执行选项 effect（数值增减 + special 处理建议），
 *   返回 Partial 变更与「需要 store 专门处理的 special 标记」；纯数据，不落 store。
 * - checkInventoryEvents(state, rng?)：库存事件（邻居借粮/官府征用/乞丐讨食/窃贼光顾），
 *   条件 + 概率触发，可重复（eventLog 不参与去重）；纯函数可测。
 * - applyInventoryEventSpecial(state, special, rng?)：库存事件专属 special 的数值应用（纯函数）。
 *
 * 去重权威：eventLog。GameEvent.triggered 字段由 store 同步维护（仅展示参考）。
 */
import { EVENT_MAP } from '@/config/tang-events';
import { categoryVolume, warehouseValue } from '@/systems/tang-expiry';
import type { GameEvent, GameEventChoice, GameEventEffect, GameEventSpecial, GameEventTrigger, ShopItem, TangGameState } from '@/types/tang-manager';

/** 触发判定所需的状态子集（5b：信用/好感触发新增字段；debt_zero 改用 legacyDebt） */
export type EventState = Pick<
  TangGameState,
  | 'events'
  | 'eventLog'
  | 'day'
  | 'score'
  | 'reputation'
  | 'legacyDebt'
  | 'credit'
  | 'xieQiFavor'
  | 'shenTinglanFavor'
>;

/** 单个触发条件是否满足 */
export function eventTriggerMet(trigger: GameEventTrigger, state: EventState): boolean {
  switch (trigger.type) {
    case 'day_range':
      // QA-B：minDebt 附加「负债>0」门槛（债主上门负债为零不触发）
      return (
        state.day >= trigger.minDay &&
        state.day <= trigger.maxDay &&
        (trigger.minDebt === undefined || (state.legacyDebt ?? 0) >= trigger.minDebt)
      );
    case 'score':
      return state.score >= trigger.minScore && (trigger.maxScore === undefined || state.score <= trigger.maxScore);
    case 'reputation':
      return state.reputation >= trigger.minReputation;
    case 'debt_zero':
      return (state.legacyDebt ?? 0) === 0;
    case 'credit':
      return (state.credit ?? 0) < trigger.maxCredit && (trigger.minDay === undefined || state.day >= trigger.minDay);
    case 'xie_qi_favor':
      return (state.xieQiFavor ?? 0) >= trigger.minFavor;
    case 'shen_favor':
      return (state.shenTinglanFavor ?? 0) >= trigger.minFavor;
    default:
      return false;
  }
}

/** 事件是否可触发：满足条件且 eventLog 未记录 */
export function eventCanTrigger(event: GameEvent, state: EventState): boolean {
  return !state.eventLog.includes(event.id) && eventTriggerMet(event.trigger, state);
}

/** 返回所有满足条件且未触发过的事件（纯函数；由 store 填入 pendingEvents） */
export function checkAndTriggerEvents(state: EventState): GameEvent[] {
  return state.events.filter((e) => eventCanTrigger(e, state));
}

/** 效果数值应用后的变更（负数即扣减）；special 由 store 专门处理
 *  5b：gold 映射到 silver（compat gold 同步）、debt 映射到 legacyDebt（compat debt 同步） */
export function applyEventEffect(state: TangGameState, choice: GameEventChoice): {
  changes: Partial<TangGameState>;
  special?: GameEventEffect['special'];
} {
  const eff = choice.effect;
  const changes: Partial<TangGameState> = {};
  if (eff.gold !== undefined) {
    changes.silver = state.silver + eff.gold;
    changes.gold = changes.silver;
  }
  if (eff.debt !== undefined) {
    changes.legacyDebt = Math.max(0, (state.legacyDebt ?? 0) + eff.debt);
    changes.debt = changes.legacyDebt;
  }
  if (eff.feiqian !== undefined) changes.feiqian = (state.feiqian ?? 0) + eff.feiqian;
  if (eff.credit !== undefined) changes.credit = Math.max(0, (state.credit ?? 0) + eff.credit);
  if (eff.inflationModifier !== undefined)
    changes.inflationModifier = (state.inflationModifier ?? 0) + eff.inflationModifier;
  if (eff.depositRateBoostDays !== undefined)
    changes.depositRateBoostDays = Math.max(0, (state.depositRateBoostDays ?? 0) + eff.depositRateBoostDays);
  if (eff.score !== undefined) changes.score = Math.min(5, Math.max(1, state.score + eff.score));
  if (eff.reputation !== undefined)
    changes.reputation = Math.min(1000, Math.max(0, state.reputation + eff.reputation));
  if (eff.xiaoerFavor !== undefined)
    changes.xiaoerFavor = Math.min(100, Math.max(0, state.xiaoerFavor + eff.xiaoerFavor));
  if (eff.xiaoerSatisfaction !== undefined)
    changes.xiaoerSatisfaction = Math.min(100, Math.max(0, state.xiaoerSatisfaction + eff.xiaoerSatisfaction));
  if (eff.shenTinglanFavor !== undefined)
    changes.shenTinglanFavor = Math.min(100, Math.max(0, state.shenTinglanFavor + eff.shenTinglanFavor));
  if (eff.xieQiFavor !== undefined)
    changes.xieQiFavor = Math.min(100, Math.max(0, state.xieQiFavor + eff.xieQiFavor));
  if (eff.energy !== undefined) changes.energy = Math.min(100, Math.max(0, state.energy + eff.energy));
  return { changes, special: eff.special };
}

/** 按 id 取事件定义 */
export function getEventById(id: string): GameEvent | undefined {
  return EVENT_MAP[id];
}

// ============================================================
// Step 5b-1.5：库存事件（邻居借粮 / 官府征用 / 乞丐讨食 / 窃贼光顾）
// 古风旁白逐字；触发概率为工程定值（注释）。可重复触发（eventLog 不去重）。
// ============================================================

export const INVENTORY_EVENT_DEFINITIONS: readonly GameEvent[] = [
  {
    type: 'random',
    id: 'inv-neighbor-borrow',
    title: '邻居借粮',
    description: '隔壁的王婶子推门进来，局促地搓着手：「掌柜的，家中揭不开锅了，想借些米粮度日。」',
    trigger: { type: 'day_range', minDay: 0, maxDay: 9999 },
    choices: [
      {
        id: 'borrow',
        label: '借她五斤',
        consequence: '你从库房取了些食材给她。王婶子千恩万谢，邻里之间也添了几分和睦。',
        effect: { special: 'inv_borrow' },
      },
      {
        id: 'refuse',
        label: '婉拒',
        consequence: '你委婉推说自家也紧巴，王婶子叹口气走了。',
        effect: { special: 'inv_borrow_refuse' },
      },
    ],
  },
  {
    type: 'random',
    id: 'inv-requisition',
    title: '官府征用',
    description: '衙门的差役登门，说官府办药局急需药材，要按市价征用你库房中的药材。',
    trigger: { type: 'day_range', minDay: 0, maxDay: 9999 },
    choices: [
      {
        id: 'accept',
        label: '配合征用',
        consequence: '你痛快应下，差役连连道谢，官面上也记了你一份情。',
        effect: { special: 'inv_requisition_accept' },
      },
      {
        id: 'reduce',
        label: '请求减免',
        consequence: '你央求少征些，差役勉强答应按两成价收——可也记下了你「不配合」。',
        effect: { special: 'inv_requisition_reduce' },
      },
    ],
  },
  {
    type: 'random',
    id: 'inv-beggar',
    title: '乞丐讨食',
    description: '一个衣衫褴褛的乞丐倚在门边，怯怯讨一口吃食。',
    trigger: { type: 'day_range', minDay: 0, maxDay: 9999 },
    choices: [
      {
        id: 'alms',
        label: '施舍一餐',
        consequence: '你舀了一碗热食给他，乞丐千恩万谢，街坊看在眼里，都夸你心善。',
        effect: { special: 'inv_beggar_alms' },
      },
      {
        id: 'drive',
        label: '驱赶出去',
        consequence: '你摆摆手赶他走，乞丐低头离去，路人侧目。',
        effect: { special: 'inv_beggar_drive' },
      },
    ],
  },
  {
    type: 'random',
    id: 'inv-thief',
    title: '窃贼光顾',
    description: '夜里，你听得库房传来窸窣动静——遭贼了！',
    trigger: { type: 'day_range', minDay: 0, maxDay: 9999 },
    choices: [
      {
        id: 'report',
        label: '报官追赃',
        consequence: '你连夜报官。运气好，赃物追回；运气差，损失些货物。',
        effect: { special: 'inv_thief_report' },
      },
      {
        id: 'loss',
        label: '自认倒霉',
        consequence: '你叹口气，只当破财消灾，收拾了库房残局。',
        effect: { special: 'inv_thief_loss' },
      },
    ],
  },
];

/** 库存事件触发条件 + 概率（工程定值，注释）：借粮 15% / 征用 10% / 乞讨 20% / 窃贼 10% */
const INVENTORY_EVENT_RULES: ReadonlyArray<{
  id: string;
  condition: (items: readonly ShopItem[]) => boolean;
  probability: number;
}> = [
  { id: 'inv-neighbor-borrow', condition: (items) => categoryVolume(items, '食材') > 20, probability: 0.15 },
  { id: 'inv-requisition', condition: (items) => categoryVolume(items, '药材') > 30, probability: 0.1 },
  { id: 'inv-beggar', condition: (items) => categoryVolume(items, '食材') > 5, probability: 0.2 },
  { id: 'inv-thief', condition: (items) => warehouseValue(items) > 100, probability: 0.1 },
];

/** 库存事件检查（纯函数）：满足条件且概率通过 → 返回待入队事件（可重复，eventLog 不去重） */
export function checkInventoryEvents(
  state: { shopItems?: readonly ShopItem[] },
  rng: () => number = Math.random
): GameEvent[] {
  const items = state.shopItems ?? [];
  const out: GameEvent[] = [];
  for (const rule of INVENTORY_EVENT_RULES) {
    const def = INVENTORY_EVENT_DEFINITIONS.find((e) => e.id === rule.id);
    if (def && rule.condition(items) && rng() < rule.probability) {
      out.push(def);
    }
  }
  return out;
}

/** 从指定类目按顺序消耗库存（不越界），返回消耗后的商品列表与实耗量 */
function consumeCategory(
  shopItems: readonly ShopItem[] | undefined,
  category: string,
  amount: number
): { items: ShopItem[]; consumed: number } {
  let remaining = amount;
  const items = (shopItems ?? []).map((it) => {
    if (remaining <= 0 || it.category !== category) return it;
    const take = Math.min(it.stock ?? 0, remaining);
    remaining -= take;
    return { ...it, stock: Math.round(((it.stock ?? 0) - take) * 100) / 100, status: (it.stock ?? 0) - take <= 0 ? ('out_of_stock' as const) : it.status };
  });
  return { items, consumed: amount - remaining };
}

/**
 * 库存事件专属 special 应用（纯函数；store resolveEventChoice 调用）。
 * 邻居借粮：借（耗 5 食材、声望+2）/ 婉拒（无）；
 * 官府征用：配合（声望+5）/ 请求减免（扣两成价、30% 概率得罪声望-5）；
 * 乞丐讨食：施舍（耗 2 食材、声望+3）/ 驱赶（声望-1）；
 * 窃贼光顾：报官（半概率追回：声望+2；失败损 5% 库房价值）/ 自认倒霉（损 5% 库房价值）。
 */
export function applyInventoryEventSpecial(
  state: Pick<TangGameState, 'shopItems' | 'silver' | 'reputation'>,
  special: GameEventSpecial,
  rng: () => number = Math.random
): Partial<TangGameState> {
  const items = state.shopItems ?? [];
  const clampRep = (v: number): number => Math.min(1000, Math.max(0, v));
  switch (special) {
    case 'inv_borrow': {
      const { items: next, consumed } = consumeCategory(items, '食材', 5);
      return { shopItems: next, reputation: clampRep(state.reputation + 2) };
    }
    case 'inv_borrow_refuse':
      return {};
    case 'inv_requisition_accept':
      return { reputation: clampRep(state.reputation + 5) };
    case 'inv_requisition_reduce': {
      const herbValue = warehouseValue(items.filter((it) => it.category === '药材'));
      const loss = Math.round(herbValue * 0.2 * 100) / 100; // 扣两成价
      const offended = rng() < 0.3;
      return {
        silver: Math.max(0, Math.round((state.silver - loss) * 100) / 100),
        reputation: offended ? clampRep(state.reputation - 5) : state.reputation,
      };
    }
    case 'inv_beggar_alms': {
      const { items: next } = consumeCategory(items, '食材', 2);
      return { shopItems: next, reputation: clampRep(state.reputation + 3) };
    }
    case 'inv_beggar_drive':
      return { reputation: clampRep(state.reputation - 1) };
    case 'inv_thief_report': {
      if (rng() < 0.5) {
        return { reputation: clampRep(state.reputation + 2) }; // 半概率追回
      }
      const loss = Math.round(warehouseValue(items) * 0.05 * 100) / 100;
      return { silver: Math.max(0, Math.round((state.silver - loss) * 100) / 100) };
    }
    case 'inv_thief_loss': {
      const loss = Math.round(warehouseValue(items) * 0.05 * 100) / 100;
      return { silver: Math.max(0, Math.round((state.silver - loss) * 100) / 100) };
    }
    default:
      return {};
  }
}
