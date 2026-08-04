/**
 * 《我在唐朝当掌柜》客人偏好系统（TANG-RCP-001 模块一）
 * 纯函数：generatePreferences / checkPreferenceMatch / revealPreference。
 * 规则摘要（用户 1.1 / 1.2 逐字）：
 * - 每位客人生成 1-2 个偏好：酒楼 菜品/风格、布庄 面料/风格、药铺 药性/价格；
 *   偏好初始全部未揭示（revealed=false）。
 * - checkPreferenceMatch：仅检测已揭示偏好；匹配 收益×1.3 + 满意度+10；
 *   不匹配 ×0.8 -5；未揭示任何偏好 → matched=null 不做检测。
 * - revealPreference：mind_read 100%、observation 50%、regular_visit（第三次来访自动）揭示一个；
 *   返回揭示的偏好与是否全揭示。
 * 可测性：rng 可选参数（默认 Math.random），测试传固定序列即可复现。
 */
import type { Guest, GuestPreference, GuestPreferenceType, GuestType, PreferenceMatchResult, RevealPreferenceResult, ShopType } from '@/types/tang-manager';

/** 偏好类型权重（生成第 1 个偏好的类型分布；工程定值，注释） */
const PREF_TYPE_WEIGHTS: Record<ShopType, { item: number; style: number; price: number }> = {
  jiulou: { item: 0.6, style: 0.4, price: 0 },
  buzhuang: { item: 0.6, style: 0.4, price: 0 },
  yaopu: { item: 0.4, style: 0.3, price: 0.3 },
};

/** item 偏好值池（按店型；与 INITIAL_GOODS 商品名一致） */
export const ITEM_PREF_POOL: Record<ShopType, readonly string[]> = {
  jiulou: ['米酒', '酱牛肉', '羊肉', '时蔬'],
  buzhuang: ['丝绸', '锦缎', '粗布', '棉布'],
  yaopu: ['人参', '当归', '黄连', '枸杞'],
};

/** style 偏好值池（风格词） */
export const STYLE_PREF_POOL: readonly string[] = ['排场', '精致', '家常', '简朴'];

/** price 偏好值池（价格档；药铺为主） */
export const PRICE_PREF_POOL: readonly string[] = ['平价', '高价'];

/** 风格词受用客型（style 偏好匹配判定；未知风格词兜底任意客型） */
const STYLE_GUESTS: Record<string, readonly GuestType[]> = {
  排场: ['big_order', 'special'],
  精致: ['special', 'observe'],
  家常: ['normal'],
  简朴: ['help', 'normal'],
};

/** 价格档适用（price 偏好匹配判定；平价 客单<5 / 高价 客单≥8） */
function priceBandApplies(value: string, baseConsumption: number): boolean {
  if (value === '平价') return baseConsumption < 5;
  if (value === '高价') return baseConsumption >= 8;
  return false;
}

function pick<T>(arr: readonly T[], rng: () => number): T {
  const idx = Math.floor(rng() * arr.length);
  return arr[Math.min(idx, arr.length - 1)]!;
}

/**
 * 生成 1-2 个偏好（用户 1.2 逐字：酒楼 菜品/风格、布庄 面料/风格、药铺 药性/价格）。
 * 第 1 个偏好按店型类型权重抽取；约 40% 概率追加第 2 个（style 或 price）。
 * 全部初始未揭示。可测性：rng 序列可控。
 */
export function generatePreferences(
  guestType: GuestType,
  shopType: ShopType,
  rng: () => number = Math.random
): GuestPreference[] {
  const weights = PREF_TYPE_WEIGHTS[shopType] ?? PREF_TYPE_WEIGHTS.jiulou;
  const roll = rng();
  const firstType: GuestPreferenceType =
    roll < weights.item ? 'item' : roll < weights.item + weights.style ? 'style' : 'price';

  const first: GuestPreference = {
    type: firstType,
    value:
      firstType === 'item'
        ? pick(ITEM_PREF_POOL[shopType], rng)
        : firstType === 'style'
          ? pick(STYLE_PREF_POOL, rng)
          : pick(PRICE_PREF_POOL, rng),
    revealed: false,
  };

  const prefs = [first];
  // 约 40% 追加第 2 个偏好（风格 或 药铺价格）；big_order/special 偏爱「排场」、help 偏「简朴」
  if (rng() < 0.4) {
    const secondType: GuestPreferenceType = shopType === 'yaopu' && rng() < 0.5 ? 'price' : 'style';
    const styleValue =
      guestType === 'big_order' || guestType === 'special'
        ? '排场'
        : guestType === 'help'
          ? '简朴'
          : pick(STYLE_PREF_POOL, rng);
    prefs.push({
      type: secondType,
      value: secondType === 'price' ? pick(PRICE_PREF_POOL, rng) : styleValue,
      revealed: false,
    });
  }
  // 去重（同 type+value 合并），保证 1-2 个不重复偏好
  const seen = new Set<string>();
  const result: GuestPreference[] = [];
  for (const p of prefs) {
    const key = `${p.type}:${p.value}`;
    if (!seen.has(key)) {
      seen.add(key);
      result.push(p);
    }
  }
  return result;
}

/**
 * 偏好匹配检测（用户 1.1 逐字：已揭示才检测；匹配 收益×1.3+满意度+10 / 不匹配 ×0.8-5；
 * 未揭示不做检测）。action 语义：
 * - item 偏好：action='recommend' 且所荐商品名/类别命中 pref.value（itemId 或 itemName 任一匹配）；
 * - style 偏好：action='normal' 且客人类型受用该风格；
 * - price 偏好：客人基础消费落在价格档。
 * 任一已揭示偏好命中即 matched=true；有已揭示但全未命中 → matched=false。
 */
export function checkPreferenceMatch(
  guest: Guest,
  action: 'normal' | 'mind_read' | 'recommend' | 'chat',
  itemId?: string,
  itemName?: string
): PreferenceMatchResult {
  const revealed = (guest.preferences ?? []).filter((p) => p.revealed);
  if (revealed.length === 0) {
    return { matched: null, incomeMultiplier: 1, satisfactionDelta: 0 };
  }
  for (const pref of revealed) {
    if (pref.type === 'item' && action === 'recommend') {
      if (itemId === pref.value || itemName === pref.value || (itemName !== undefined && itemName.includes(pref.value))) {
        return { matched: true, incomeMultiplier: 1.3, satisfactionDelta: 10, matchedPreference: pref };
      }
    } else if (pref.type === 'style' && action === 'normal') {
      const okTypes = STYLE_GUESTS[pref.value];
      if (!okTypes || okTypes.includes(guest.type)) {
        return { matched: true, incomeMultiplier: 1.3, satisfactionDelta: 10, matchedPreference: pref };
      }
    } else if (pref.type === 'price' && priceBandApplies(pref.value, guest.baseConsumption)) {
      return { matched: true, incomeMultiplier: 1.3, satisfactionDelta: 10, matchedPreference: pref };
    }
  }
  return { matched: false, incomeMultiplier: 0.8, satisfactionDelta: -5 };
}

/**
 * 揭示偏好（用户 1.1 逐字：mind_read 100%、observation 50%、regular_visit 第三次来访自动）。
 * 成功时随机揭示一条未揭示偏好，并同步 guest.preferenceRevealed；全揭示后 allRevealed=true。
 */
export function revealPreference(
  guest: Guest,
  method: 'mind_read' | 'observation' | 'regular_visit',
  rng: () => number = Math.random
): RevealPreferenceResult {
  const unrevealed = (guest.preferences ?? []).filter((p) => !p.revealed);
  if (unrevealed.length === 0) {
    return { guest, revealed: null, allRevealed: true };
  }
  const success =
    method === 'mind_read' || method === 'regular_visit' ? true : rng() < 0.5; // observation 50%
  if (!success) {
    return { guest, revealed: null, allRevealed: false };
  }
  const idx = Math.min(Math.floor(rng() * unrevealed.length), unrevealed.length - 1);
  const target = unrevealed[idx]!;
  const updated: Guest = {
    ...guest,
    preferences: (guest.preferences ?? []).map((p) => (p.type === target.type && p.value === target.value ? { ...p, revealed: true } : p)),
    preferenceRevealed: true,
  };
  return { guest: updated, revealed: { ...target, revealed: true }, allRevealed: false };
}
