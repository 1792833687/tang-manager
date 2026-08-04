/**
 * 接待操作扩展单测（TANG-RCP-001 模块二 tang-reception-extended）
 * 覆盖：推荐命中未命中/闲聊内容概率/赠礼递减/四法婉拒（≥6 用例）。
 */
import { describe, expect, it } from 'vitest';
import {
  chatWithGuest,
  giveGift,
  recommendItem,
  rejectGuestPolitely,
} from '@/systems/tang-reception-extended';
import type { Guest, ShopItem } from '@/types/tang-manager';

function makeItem(overrides: Partial<ShopItem> = {}): ShopItem {
  return {
    id: 'i-mijiu',
    name: '米酒',
    price: 1,
    cost: 0.6,
    stock: 10,
    category: '食材',
    volume: 1,
    expiry: 90,
    status: 'normal',
    ...overrides,
  };
}

function makeGuest(overrides: Partial<Guest> = {}): Guest {
  return {
    id: 'g1',
    name: '李四',
    type: 'normal',
    description: 'x',
    baseConsumption: 4,
    mentalOS: null,
    handled: false,
    ...overrides,
  };
}

const seq =
  (...values: number[]): (() => number) =>
  () => {
    const v = values.shift();
    return v ?? 0.5;
  };

describe('recommendItem（2.2 逐字：命中 ×1.5+15 / 未命中 ×0.7-10；精力-5；未揭示 50/50）', () => {
  it('已揭示偏好 + 命中 → 消费×1.5 + 满意度+15，精力-5', () => {
    const guest = makeGuest({ preferences: [{ type: 'item', value: '米酒', revealed: true }] });
    const r = recommendItem(guest, 'i-mijiu', { shopItems: [makeItem()] });
    expect(r.ok).toBe(true);
    expect(r.income).toBe(6.0); // 4 × 1.5
    expect(r.satisfactionDelta).toBe(15);
    expect(r.energyConsumed).toBe(5);
    expect(r.matched).toBe(true);
  });

  it('已揭示偏好 + 未命中 → 消费×0.7 - 10「被宰」', () => {
    const guest = makeGuest({ preferences: [{ type: 'item', value: '羊肉', revealed: true }] });
    const r = recommendItem(guest, 'i-mijiu', { shopItems: [makeItem()] });
    expect(r.income).toBe(2.8); // 4 × 0.7
    expect(r.satisfactionDelta).toBe(-10);
    expect(r.matched).toBe(false);
  });

  it('偏好未揭示时 50/50 随机（rng<0.5 命中 ×1.5；rng≥0.5 未命中 ×0.7）', () => {
    const guest = makeGuest();
    const hit = recommendItem(guest, 'i-mijiu', { shopItems: [makeItem()] }, () => 0.2)!;
    expect(hit.matched).toBe(true);
    expect(hit.income).toBe(6.0);
    const miss = recommendItem(guest, 'i-mijiu', { shopItems: [makeItem()] }, () => 0.9)!;
    expect(miss.matched).toBe(false);
    expect(miss.income).toBe(2.8);
  });

  it('库房无此物 → ok=false 且 reason', () => {
    const r = recommendItem(makeGuest(), 'i-none', { shopItems: [makeItem()] });
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('库房查无此物');
  });
});

describe('chatWithGuest（2.2 逐字概率：情报 40%/传言 25%/进货 15%/偏好揭示 50%/纯聊天 10%）', () => {
  it('rng<0.4 触发情报线索（info.kind=intel）；精力-5', () => {
    const r = chatWithGuest(makeGuest(), { shopType: 'jiulou' }, () => 0.1);
    expect(r.energyConsumed).toBe(5);
    expect(r.info?.kind).toBe('intel');
    expect(r.content.length).toBeGreaterThan(0);
  });

  it('rng 贴 0.9 时无任何概率结果，仅闲聊（收入 0）', () => {
    const r = chatWithGuest(makeGuest(), { shopType: 'jiulou' }, () => 0.9);
    expect(r.income).toBe(0);
    expect(r.info).toBeUndefined();
    expect(r.revealedPreference).toBeUndefined();
  });

  it('纯聊天 10%（rng 序列命中最后一项）→ 好感+3', () => {
    // 序列：0.9(情报不中) 0.9(传言不中) 0.9(进货不中) 0.9(偏好不中) 0.05(纯聊天中)
    const r = chatWithGuest(makeGuest(), { shopType: 'jiulou' }, seq(0.9, 0.9, 0.9, 0.9, 0.05));
    expect(r.favorChange).toBe(3);
  });

  it('偏好揭示 50%：rng 命中且存在未揭示偏好 → revealedPreference 返回并更新 guest', () => {
    const guest = makeGuest({ preferences: [{ type: 'item', value: '米酒', revealed: false }] });
    const r = chatWithGuest(guest, { shopType: 'jiulou' }, seq(0.9, 0.9, 0.9, 0.3, 0.9));
    expect(r.revealedPreference).not.toBeUndefined();
    expect(r.updatedGuest.preferences![0]!.revealed).toBe(true);
  });
});

describe('giveGift（2.2 逐字：消耗库房商品；好感+20 递减；下次消费×1.5；精力-3）', () => {
  it('第 1 次收礼好感+20；消耗库房 1 份；精力-3；下次消费×1.5', () => {
    const guest = makeGuest();
    const r = giveGift(guest, 'i-mijiu', { shopItems: [makeItem()] });
    expect(r.ok).toBe(true);
    expect(r.favorDelta).toBe(20);
    expect(r.energyConsumed).toBe(3);
    expect(r.nextConsumptionMultiplier).toBe(1.5);
    expect(r.consumedItemId).toBe('i-mijiu');
  });

  it('第 3 次 +10、第 4 次起 +5（giftCount 追踪递减）', () => {
    const guest3 = makeGuest({ giftCount: 2 });
    expect(giveGift(guest3, 'i-mijiu', { shopItems: [makeItem()] }).favorDelta).toBe(10);
    const guest4 = makeGuest({ giftCount: 3 });
    expect(giveGift(guest4, 'i-mijiu', { shopItems: [makeItem()] }).favorDelta).toBe(5);
  });

  it('库房无货 → ok=false', () => {
    const r = giveGift(makeGuest(), 'i-mijiu', { shopItems: [makeItem({ stock: 0 })] });
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('库房无此物可赠');
  });
});

describe('rejectGuestPolitely（2.4 逐字：redirect/excuse/delegate/refuse）', () => {
  it('redirect：声望+2，隔壁店好感+5（neighborFavor）', () => {
    const r = rejectGuestPolitely(makeGuest(), 'redirect');
    expect(r.reputationChange).toBe(2);
    expect(r.neighborFavor).toBe(5);
    expect(r.income).toBe(0);
  });

  it('excuse：精力额外-3，无负面', () => {
    const r = rejectGuestPolitely(makeGuest(), 'excuse');
    expect(r.energyConsumed).toBe(3);
    expect(r.reputationChange).toBe(0);
    expect(r.scoreChange).toBe(0);
  });

  it('delegate：阿昭满意度+1、收益减半（base×0.5）', () => {
    const r = rejectGuestPolitely(makeGuest({ baseConsumption: 4 }), 'delegate');
    expect(r.xiaoerSatisfactionChange).toBe(1);
    expect(r.income).toBe(2.0);
  });

  it('refuse：原逻辑 30% 评分-0.02；help 额外声望-2', () => {
    const hit = rejectGuestPolitely(makeGuest(), 'refuse', () => 0.2);
    expect(hit.scoreChange).toBe(-0.02);
    const help = rejectGuestPolitely(makeGuest({ type: 'help' }), 'refuse', () => 0.9);
    expect(help.reputationChange).toBe(-2);
  });
});
