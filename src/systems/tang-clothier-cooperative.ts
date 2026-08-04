/**
 * 《我在唐朝当掌柜》布庄·织造合作系统（产业系统 模块二 2.1）
 * 独立于酒楼/药铺产业逻辑：寻访织工（午后续）→ 合作 → 织工定期寄卖商品 → 售出按抽成分账。
 * 织工技艺越高抽成越高、自带客源；满意度低会离开。
 * 纯函数：rng 可注入。
 */
import { WEAVER_GOODS_POOL, WEAVER_NAME_POOL, industryLevel } from '@/config/tang-industry-content';
import type { Weaver, WeaverGoods } from '@/types/tang-industry';

function pick<T>(arr: readonly T[], rng: () => number): T {
  const idx = Math.floor(rng() * arr.length);
  return arr[Math.min(idx, arr.length - 1)]!;
}

/** 生成织工（纯函数）：技艺越高抽成越高 */
export function generateWeaver(rng: () => number = Math.random): Weaver {
  const skill = 1 + Math.floor(rng() * 5); // 1-5
  const commission = 0.2 + skill * 0.05; // 0.25-0.45
  return {
    id: `wv-${Date.now().toString(36)}-${Math.floor(rng() * 1000)}`,
    name: pick(WEAVER_NAME_POOL, rng),
    skill,
    commission: Math.round(commission * 100) / 100,
    reputation: skill * 12 + Math.floor(rng() * 20),
    satisfaction: 60,
    currentGoods: [],
    status: 'active',
  };
}

/** 织工提供一批寄卖商品（纯函数）：品质由技艺决定，售价比普通高 20-50% */
export function consignmentGoods(weaver: Weaver, basePrice: number, rng: () => number = Math.random): WeaverGoods[] {
  const count = 2 + Math.floor(rng() * 3); // 2-4 件
  const goods: WeaverGoods[] = [];
  for (let i = 0; i < count; i++) {
    const premium = 1.2 + rng() * 0.3;
    goods.push({
      id: `wg-${Date.now().toString(36)}-${i}-${Math.floor(rng() * 1000)}`,
      name: pick(WEAVER_GOODS_POOL, rng),
      category: rng() < 0.4 ? '成衣' : rng() < 0.7 ? '布匹' : '刺绣品',
      quality: weaver.skill,
      price: Math.round(basePrice * premium),
      sold: false,
    });
  }
  return goods;
}

/** 售出寄卖商品（纯函数）：按抽成分账 → 店铺所得 */
export function sellConsignment(
  weaver: Weaver,
  goodsId: string,
  day: number
): { weaver: Weaver; goods: WeaverGoods; shopIncome: number; weaverIncome: number } {
  const goods = weaver.currentGoods.find((g) => g.id === goodsId);
  if (!goods || goods.sold) {
    return { weaver, goods: goods ?? { id: goodsId, name: '', category: '布匹', quality: 1, price: 0, sold: false }, shopIncome: 0, weaverIncome: 0 };
  }
  const soldGoods: WeaverGoods = { ...goods, sold: true, soldDay: day };
  const weaverIncome = Math.round(goods.price * weaver.commission * 100) / 100;
  return {
    weaver: { ...weaver, currentGoods: weaver.currentGoods.map((g) => (g.id === goodsId ? soldGoods : g)) },
    goods: soldGoods,
    shopIncome: Math.round((goods.price - weaverIncome) * 100) / 100,
    weaverIncome,
  };
}

/** 织工满意度变化（纯函数）：长期无销售/抽成低 → 下降；鼓励 → 上升 */
export function weaverSatisfactionChange(
  weaver: Weaver,
  daysSinceLastSale: number,
  encouraged: boolean
): number {
  let delta = 0;
  if (daysSinceLastSale >= 5) delta -= 5;
  if (weaver.commission < 0.25) delta -= 3;
  if (encouraged) delta += 10;
  return delta;
}

/** 织工是否离开（纯函数）：满意度 <30 或 长期无销售 */
export function weaverLeaves(weaver: Weaver, daysSinceLastSale: number): boolean {
  return weaver.satisfaction < 30 || daysSinceLastSale >= 10;
}

/** 升级条件（2.3）：评分 + 累计定制订单数 */
export function checkClothierLevelUp(level: number, score: number, customOrderCount: number): boolean {
  const next = industryLevel('clothier', level + 1);
  if (next.level <= level) return false;
  return score >= next.require.score && customOrderCount >= next.require.count;
}

/** 织工合作上限（按等级） */
export function maxWeavers(clothierLevel: number): number {
  if (clothierLevel >= 3) return 3;
  if (clothierLevel >= 2) return 2;
  return 1;
}

/** Lv4 寄卖溢价 +20%（纯函数） */
export function consignmentPremium(clothierLevel: number, base: number): number {
  return Math.round(base * (clothierLevel >= 4 ? 1.2 : 1) * 10) / 10;
}

/** Lv5 织工抽成可降 5%（纯函数） */
export function weaverCommissionFloor(clothierLevel: number): number {
  return Math.max(0.15, 0.2 - (clothierLevel >= 5 ? 0.05 : 0));
}
