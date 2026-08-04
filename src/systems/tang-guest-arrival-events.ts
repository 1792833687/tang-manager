/**
 * 《我在唐朝当掌柜》接待随机事件（内容深化 TANG-CONT-C 模块五）
 * 纯函数（可测；不直接调用 store）：
 * - rollArrivalEvent：每日清晨生成客人时 30% 概率触发 1 个进场事件
 *   （富商大张旗鼓 15% / 客人带伤员 10% / 同行试探 20% / 阿昭旧识 10% / 无事发生 45%）
 * - applyArrivalEvent：应用进场事件（气氛/好感/客人类型/消费预期）
 * - applyWoundedGuestOutcome：伤员客接待结果（帮忙=精力-10+声望+15+耗药材；婉拒=气氛-5）
 * - rollDepartureEvent：每日结算按当日情况触发离场事件
 *   （满意而归 气氛≥70 / 摔门而去 有投诉 / 遗落物品 5% / 带新客来 有满意度≥90 / 无事）
 * 铁律：古风措辞；rng 可注入；结果由 store 应用（气氛/声望/精力/线索/次日客流）。
 */
import type { ClueCategory } from '@/types/tang-clues';
import type { Guest, GuestType } from '@/types/tang-manager';

// ============================================================
// 进场事件（每日清晨）
// ============================================================

export type ArrivalEventType = 'rich_merchant' | 'wounded' | 'rival_probe' | 'azhao_acquaintance' | 'none';

/** 进场事件结果（store 应用；guests 为空时仅叙事/气氛等） */
export interface ArrivalEventResult {
  type: ArrivalEventType;
  narrative: string;
  /** 事件日志键（store 追加，含 day 防重复） */
  eventKey: string;
  atmosphereDelta?: number;
  xiaoerFavorDelta?: number;
  guests?: Guest[];
}

/** 进场事件权重表（合计 100；仅 30% 触发后按此抽取） */
const ARRIVAL_WEIGHTS: ReadonlyArray<{ type: ArrivalEventType; weight: number }> = [
  { type: 'rich_merchant', weight: 15 },
  { type: 'wounded', weight: 10 },
  { type: 'rival_probe', weight: 20 },
  { type: 'azhao_acquaintance', weight: 10 },
  { type: 'none', weight: 45 },
];

/** 30% 触发进场事件（否则 none） */
export function rollArrivalEvent(rng: () => number = Math.random): ArrivalEventType {
  if (rng() >= 0.3) return 'none';
  const roll = rng() * 100;
  let acc = 0;
  for (const w of ARRIVAL_WEIGHTS) {
    acc += w.weight;
    if (roll < acc) return w.type;
  }
  return 'none';
}

/** 进场事件判定上下文（applyArrivalEvent 所需） */
export interface ArrivalContext {
  guests: readonly Guest[];
  shopAtmosphere: number;
  xiaoerFavor: number;
}

/**
 * 应用进场事件（纯函数）：按类型修改 guests/气氛/好感，返回叙事与补丁。
 * - rich_merchant：首位客人强制大单、消费预期翻倍（baseConsumption×2）、气氛+10
 * - wounded：首位客人转求助型并标记 arrivalEvent='wounded'（帮忙/婉拒见 applyWoundedGuestOutcome）
 * - rival_probe：首位客人强制观察型（同行试探）
 * - azhao_acquaintance：随机一位客人消费+20%（consumptionModifier×1.2）、阿昭好感+3
 */
export function applyArrivalEvent(
  ctx: ArrivalContext,
  eventType: ArrivalEventType,
  _rng: () => number = Math.random
): ArrivalEventResult {
  const { guests, shopAtmosphere, xiaoerFavor } = ctx;
  if (eventType === 'none' || guests.length === 0) {
    return {
      type: eventType,
      narrative: '清晨无甚异动，开门迎客。',
      eventKey: `guest-arrival:${eventType}`,
    };
  }

  const first = guests[0]!;

  if (eventType === 'rich_merchant') {
    const next = guests.map((g, i) =>
      i === 0
        ? { ...g, type: 'big_order' as GuestType, baseConsumption: Math.round(g.baseConsumption * 2 * 10) / 10, description: '富商豪客，出手阔绰，点名要大单。' }
        : g
    );
    return {
      type: eventType,
      narrative: `一早便有富商 ${first.name} 带着仆从大张旗鼓地登门，扬言要订下一桩大单，连市价都不问（气氛+10，该客消费预期翻倍）。`,
      eventKey: `guest-arrival:${eventType}`,
      atmosphereDelta: 10,
      guests: next,
    };
  }

  if (eventType === 'wounded') {
    const next = guests.map((g, i) =>
      i === 0
        ? { ...g, type: 'help' as GuestType, arrivalEvent: 'wounded' as const, description: '一位带着伤的客人被搀扶进店，衣衫带血，恳求你行个方便。' }
        : g
    );
    return {
      type: eventType,
      narrative: `一名受伤的客人 ${first.name} 被路人搀扶进店，衣衫带血，恳求你施以援手。你若不帮，只怕要落个见死不救的名声（帮忙=精力-10+声望+15+耗少许药材；婉拒=气氛-5）。`,
      eventKey: `guest-arrival:${eventType}`,
      guests: next,
    };
  }

  if (eventType === 'rival_probe') {
    const next = guests.map((g, i) =>
      i === 0
        ? { ...g, type: 'observe' as GuestType, description: '这位客人自称是同行，来看你店里的门道。' }
        : g
    );
    return {
      type: eventType,
      narrative: `一位自称同行的客人 ${first.name} 不买东西，只在店里东瞧西看，怕是来探你底细的。`,
      eventKey: `guest-arrival:${eventType}`,
      guests: next,
    };
  }

  // azhao_acquaintance：阿昭旧识
  const target = guests[Math.min(Math.floor(_rng() * guests.length), guests.length - 1)]!;
  const next = guests.map((g) =>
    g.id === target.id
      ? { ...g, consumptionModifier: Math.round((g.consumptionModifier ?? 1) * 1.2 * 100) / 100 }
      : g
  );
  return {
    type: eventType,
    narrative: `阿昭迎出一位旧识 ${target.name}，两人寒暄半晌。那客人念及旧情，今日在店里格外大方（阿昭好感+3，该客消费+20%）。`,
    eventKey: `guest-arrival:${eventType}`,
    xiaoerFavorDelta: 3,
    guests: next,
  };
}

/**
 * 伤员客接待结果（纯函数）：帮忙（normal/mind_read 接待）→ 精力-10+声望+15+耗少许药材；
 * 婉拒（reject）→ 气氛-5。返回补丁由 store 应用（buildReceptionPatch 接线）。
 */
export function applyWoundedGuestOutcome(
  method: 'help' | 'refuse',
  _rng: () => number = Math.random
): { reputationDelta: number; energyCost: number; consumesHerb: boolean; atmosphereDelta: number; narrative: string } {
  if (method === 'help') {
    return {
      reputationDelta: 15,
      energyCost: 10,
      consumesHerb: true,
      atmosphereDelta: 0,
      narrative: '你放下手头的活计，替他清洗包扎伤口，又取了些许药材。他千恩万谢而去（精力-10，声望+15）。',
    };
  }
  return {
    reputationDelta: 0,
    energyCost: 0,
    consumesHerb: false,
    atmosphereDelta: -5,
    narrative: '你终究狠不下心，只推说店里没有药材，婉言谢绝了。他失望地被人搀走，店里气氛也冷了几分（气氛-5）。',
  };
}

// ============================================================
// 离场事件（每日结算）
// ============================================================

export type DepartureEventType = 'satisfied' | 'slam_door' | 'dropped_item' | 'bring_guest' | 'none';

/** 离场事件结果（store 应用；遗落物品三选一：钱袋/玉佩/书信线索） */
export interface DepartureEventResult {
  type: DepartureEventType;
  narrative: string;
  eventKey: string;
  atmosphereDelta?: number;
  silverDelta?: number;
  /** 遗落玉佩（入库稀有品） */
  item?: { name: string; price: number; category: string };
  /** 遗落书信 → 线索（store 生成） */
  clue?: { source: string; category: ClueCategory };
  /** 带新客来 → 次日 +1 客 */
  nextDayExtraGuests?: number;
}

/** 离场事件判定上下文 */
export interface DepartureContext {
  shopAtmosphere: number;
  todayComplaints: number;
  hasSatisfiedGuest: boolean;
}

/**
 * 按当日情况触发离场事件（纯函数）：
 * 1. 满意而归：当日气氛≥70 → 气氛+5
 * 2. 摔门而去：当日有投诉 → 气氛-8
 * 3. 遗落物品：5% 概率（钱袋+5~20 两 / 玉佩稀有品 / 书信线索 三选一）
 * 4. 带新客来：有满意度≥90 客人 → 次日 +1 客
 * 5. 无事发生
 */
export function rollDepartureEvent(
  ctx: DepartureContext,
  rng: () => number = Math.random
): DepartureEventResult {
  const { shopAtmosphere, todayComplaints, hasSatisfiedGuest } = ctx;

  if (shopAtmosphere >= 70) {
    return {
      type: 'satisfied',
      narrative: '打烊时分，最后一位客人临行还回头夸了你一句。这满店的和气，想来明日能带旺些生意（气氛+5）。',
      eventKey: 'departure:satisfied',
      atmosphereDelta: 5,
    };
  }
  if (todayComplaints > 0) {
    return {
      type: 'slam_door',
      narrative: '傍晚有位客人因今日的怠慢摔门而去，动静不小，惊得邻座纷纷侧目（气氛-8）。',
      eventKey: 'departure:slam_door',
      atmosphereDelta: -8,
    };
  }
  if (rng() < 0.05) {
    const roll = rng();
    if (roll < 1 / 3) {
      const silver = 5 + Math.floor(rng() * 16); // 5~20
      return {
        type: 'dropped_item',
        narrative: `收拾桌面时，你发现一位客人遗落的钱袋，里头竟有 ${silver} 两（意外之财）。`,
        eventKey: 'departure:dropped_item',
        silverDelta: silver,
      };
    }
    if (roll < 2 / 3) {
      return {
        type: 'dropped_item',
        narrative: '你在桌角捡到一方羊脂玉佩，温润通透，一看便知是贵重之物。那客人早已走远，你暂且收进库房。',
        eventKey: 'departure:dropped_item',
        item: { name: '羊脂玉佩', price: 30, category: '杂项' },
      };
    }
    return {
      type: 'dropped_item',
      narrative: '你在一张空桌的茶盏下压着一封信，字迹清秀，说的似乎是长安城里的一桩秘事。',
      eventKey: 'departure:dropped_item',
      clue: { source: '遗落书信', category: 'secret' },
    };
  }
  if (hasSatisfiedGuest) {
    return {
      type: 'bring_guest',
      narrative: '一位今日颇为满意的客人临走时说，明日要带几个朋友一同来捧场（次日 +1 客）。',
      eventKey: 'departure:bring_guest',
      nextDayExtraGuests: 1,
    };
  }
  return {
    type: 'none',
    narrative: '打烊后收拾妥当，店里安静如常。',
    eventKey: 'departure:none',
  };
}
