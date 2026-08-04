/**
 * 《我在唐朝当掌柜》客人生成系统（Step 2 需求 2.2）
 * 纯函数：不直接调用 store，接收 shopType/difficulty/day 与可选 rng，返回今日 5 位客人。
 * 可测性：rng 可选参数（默认 Math.random），测试传固定序列即可复现。
 *
 * 类型分布表（难度 → 百分比 → 5 人取整分布）：
 *   A 小本经营：普通 60 / 大单 15 / 特殊 10 / 求助 10 / 观察 5
 *   B 正经营生：普通 50 / 大单 15 / 特殊 15 / 求助 15 / 观察 5
 *   C 大买卖：  普通 40 / 大单 15 / 特殊 20 / 求助 20 / 观察 5
 * 取整规则：先按 期望人数=百分比×5 向下取整，剩余名额按余数从大到小补齐，保证恰好 5 位。
 */
import { v4 as uuidv4 } from 'uuid';
import { getDifficultyParams } from '@/config/tang-difficulty';
import { GUEST_DESC_TEMPLATES, GUEST_NAME_POOLS } from '@/config/tang-guest-content';
import { generatePreferences, revealPreference } from '@/systems/tang-guest-preference';
import { assignStoryTag } from '@/systems/tang-story-assigner';
import type { Difficulty, Guest, GuestType, KnownGuestRecord, ShopType } from '@/types/tang-manager';

/** 类型权重表（百分比；合计 100） */
const TYPE_WEIGHTS: Record<Difficulty, Record<GuestType, number>> = {
  A: { normal: 60, big_order: 15, special: 10, help: 10, observe: 5 },
  B: { normal: 50, big_order: 15, special: 15, help: 15, observe: 5 },
  C: { normal: 40, big_order: 15, special: 20, help: 20, observe: 5 },
};

/** 各类型基础消费区间（两）：普通 2-5 / 大单 8-15 / 特殊 3-8 / 求助 1-3 / 观察 2-4 */
const CONSUMPTION_RANGE: Record<GuestType, readonly [number, number]> = {
  normal: [2, 5],
  big_order: [8, 15],
  special: [3, 8],
  help: [1, 3],
  observe: [2, 4],
};

/** 店型微调系数（±10% 内）：布庄客单略高、药铺略低 */
const SHOP_MODIFIER: Record<ShopType, number> = {
  jiulou: 1.0,
  buzhuang: 1.1,
  yaopu: 0.9,
};

function pick<T>(arr: readonly T[], rng: () => number): T {
  const idx = Math.floor(rng() * arr.length);
  return arr[Math.min(idx, arr.length - 1)]!;
}

function randInt(min: number, max: number, rng: () => number): number {
  return Math.floor(rng() * (max - min + 1)) + min;
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

/** 洗牌（Fisher-Yates） */
function shuffle<T>(arr: readonly T[], rng: () => number): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = a[i]!;
    a[i] = a[j]!;
    a[j] = tmp;
  }
  return a;
}

/**
 * 把百分比权重表摊到 count 人（期望值向下取整后，剩余名额按余数从大到小补齐；
 * 极端情况下以普通客人兜底；最后洗牌）。
 * TANG-TRF-001：从 distributeGuestTypes 抽出的通用实现，供难度权重表与动态权重表复用。
 */
export function distributeTypesByWeights(
  weights: Record<GuestType, number>,
  count: number,
  rng: () => number = Math.random
): GuestType[] {
  const types = Object.keys(weights) as GuestType[];
  const total = types.reduce((s, t) => s + weights[t]!, 0);

  const slots = types.map((type) => ({
    type,
    exact: (weights[type]! / total) * count,
  }));

  const counts: Record<GuestType, number> = {} as Record<GuestType, number>;
  slots.forEach((s) => {
    counts[s.type] = Math.floor(s.exact);
  });

  let assigned = slots.reduce((s, e) => s + counts[e.type]!, 0);
  const remainders = slots
    .map((e, i) => ({ i, rem: e.exact - Math.floor(e.exact) }))
    .sort((a, b) => b.rem - a.rem);

  let k = 0;
  while (assigned < count && k < remainders.length) {
    const type = slots[remainders[k]!.i]!.type;
    counts[type] = (counts[type] ?? 0) + 1;
    assigned++;
    k++;
  }
  // 兜底：仍不足时补普通客人
  while (assigned < count) {
    counts.normal = (counts.normal ?? 0) + 1;
    assigned++;
  }

  const result: GuestType[] = [];
  slots.forEach((s) => {
    for (let i = 0; i < (counts[s.type] ?? 0); i++) {
      result.push(s.type);
    }
  });
  return shuffle(result, rng);
}

/**
 * 把百分比分布摊到 count 人（默认 5；Step 5a 1.3 起按难度 guestCount：A5/B5/C6）。
 * 期望值向下取整后，剩余名额按余数从大到小补齐；极端情况下以普通客人兜底。
 */
export function distributeGuestTypes(
  difficulty: Difficulty,
  count = 5,
  rng: () => number = Math.random
): GuestType[] {
  return distributeTypesByWeights(TYPE_WEIGHTS[difficulty], count, rng);
}

/** 生成今日客人（数量按难度 guestCount：A5 / B5 / C6；Step 5a 1.3）
 *  TANG-RCP-001 7.3：传入 knownGuests 时，20% 概率把其中一位替换为回头客
 *  （继承偏好/等级/次数/总消费，lastVisit 更新；第三次来访自动揭示偏好）。 */
export function generateDailyGuests(
  shopType: ShopType,
  difficulty: Difficulty,
  _day: number,
  rng: () => number = Math.random,
  knownGuests?: Record<string, KnownGuestRecord>
): Guest[] {
  const count = getDifficultyParams(difficulty).guestCount;
  const types = distributeGuestTypes(difficulty, count, rng);
  const guests = types.map((type) => generateSingleGuest(shopType, difficulty, type, rng));
  // 7.3：20% 概率含一位回头客（从 knownGuests 池抽，继承偏好/等级/次数/总消费）
  const pool = knownGuests ? Object.keys(knownGuests) : [];
  if (pool.length > 0 && rng() < 0.2) {
    const name = pool[Math.min(Math.floor(rng() * pool.length), pool.length - 1)]!;
    const rec = knownGuests![name]!;
    const slot = Math.min(Math.floor(rng() * guests.length), guests.length - 1);
    const base = generateSingleGuest(shopType, difficulty, guests[slot]!.type, rng);
    const visitCount = rec.visitCount + 1;
    let preferences = (rec.preferences ?? []).map((p) => ({ ...p }));
    // 第三次来访自动揭示偏好（7.3；regular_visit 100% 揭示一个）
    let revealedAny = preferences.some((p) => p.revealed);
    if (visitCount >= 3 && !revealedAny && preferences.length > 0) {
      const r = revealPreference(
        { ...base, preferences },
        'regular_visit',
        rng
      );
      preferences = r.guest.preferences ?? preferences;
      revealedAny = preferences.some((p) => p.revealed);
    }
    guests[slot] = {
      ...base,
      name,
      visitCount,
      guestLevel: rec.level,
      totalSpent: rec.totalSpent,
      lastVisit: _day,
      preferences,
      preferenceRevealed: revealedAny,
      patience: 100,
      satisfaction: rec.satisfaction ?? 60,
      baseConsumption: Math.max(1, round1(base.baseConsumption * (rec.consumptionMultiplier ?? 1))),
    };
  }
  return guests;
}

/** 生成单一位指定类型客人（3.1 事件 special：回头客事件额外 +1 大单/普通客人；5a 3.2 附故事标签；
 *  TANG-RCP-001：附 1-2 个初始未揭示偏好、首访次数/客等/耐心/满意度） */
export function generateSingleGuest(
  shopType: ShopType,
  difficulty: Difficulty,
  type: GuestType,
  rng: () => number = Math.random
): Guest {
  const modifier = SHOP_MODIFIER[shopType];
  const range = CONSUMPTION_RANGE[type];
  const min = range[0]!;
  const max = range[1]!;
  const baseConsumption = Math.max(1, round1(randInt(min, max, rng) * modifier));
  const name = pick(GUEST_NAME_POOLS[type], rng);
  // 故事标签（3.2）：70% 分配；跨天回头客延续由调用方传 prevTag（当前每日随机生成，暂不跨天）
  const storyTag = assignStoryTag({ type }, shopType, rng);
  const preferences = generatePreferences(type, shopType, rng);
  return {
    id: uuidv4(),
    name,
    type,
    description: pick(GUEST_DESC_TEMPLATES[shopType]?.[type] ?? GUEST_DESC_TEMPLATES.jiulou[type], rng), // 2026-08-05 P0：按店型取需求描述（修布店/药铺客人点菜的文案错配）
    baseConsumption,
    mentalOS: null,
    handled: false,
    ...(storyTag ? { storyTag: storyTag.label, storyStage: storyTag.stage } : {}),
    // TANG-RCP-001：偏好 / 首访 / 客等 / 耐心 / 满意度
    preferences,
    preferenceRevealed: false,
    visitCount: 1,
    guestLevel: 'bronze',
    totalSpent: 0,
    lastVisit: 0,
    patience: 100,
    satisfaction: 50,
    consumptionModifier: 1,
  };
}
