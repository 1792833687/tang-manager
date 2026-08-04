/**
 * 内容深化 TANG-CONT-C 模块五单测（接待随机事件）
 * 覆盖：进场事件 30% 触发与权重抽取、四类进场事件效果（富商/伤员/试探/旧识）、
 *       伤员帮忙/婉拒结果、离场事件（满意/摔门/遗落/带客/无事）条件与效果。
 * 验证驱动：纯函数 + rng 注入确定性。
 */
import { describe, expect, it } from 'vitest';
import {
  rollArrivalEvent,
  applyArrivalEvent,
  applyWoundedGuestOutcome,
  rollDepartureEvent,
} from '@/systems/tang-guest-arrival-events';
import type { Guest } from '@/types/tang-manager';

const seq =
  (...values: number[]): (() => number) =>
  () => values.shift() ?? 0.5;

function makeGuests(n = 2): Guest[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `g${i + 1}`,
    name: `客${i + 1}`,
    type: 'normal' as const,
    description: '普通客人',
    baseConsumption: 5,
    mentalOS: null,
    handled: false,
    satisfaction: 50,
    consumptionModifier: 1,
  }));
}

describe('进场事件（30% 触发 + 权重）', () => {
  it('rng ≥ 0.3 不触发；rng < 0.3 按权重抽取（0.05 → 富商 15%）', () => {
    expect(rollArrivalEvent(seq(0.5))).toBe('none');
    expect(rollArrivalEvent(seq(0.1, 0.05))).toBe('rich_merchant');
  });

  it('权重抽取：0.1*100=10 < 15 → 富商；[15,25) → 伤员；[25,45) → 试探；[45,55) → 旧识；[55,100) → 无事', () => {
    expect(rollArrivalEvent(seq(0.1, 0.1))).toBe('rich_merchant');
    expect(rollArrivalEvent(seq(0.1, 0.2))).toBe('wounded');
    expect(rollArrivalEvent(seq(0.1, 0.35))).toBe('rival_probe');
    expect(rollArrivalEvent(seq(0.1, 0.5))).toBe('azhao_acquaintance');
    expect(rollArrivalEvent(seq(0.1, 0.9))).toBe('none');
  });
});

describe('进场事件应用效果', () => {
  it('富商大张旗鼓：首位客强制大单、消费预期翻倍、气氛+10', () => {
    const guests = makeGuests();
    const res = applyArrivalEvent({ guests, shopAtmosphere: 50, xiaoerFavor: 40 }, 'rich_merchant', seq(0.5));
    expect(res.atmosphereDelta).toBe(10);
    expect(res.guests![0]!.type).toBe('big_order');
    expect(res.guests![0]!.baseConsumption).toBe(10); // 5 × 2
  });

  it('客人带伤员：首位客转求助型并标记 arrivalEvent=wounded', () => {
    const res = applyArrivalEvent({ guests: makeGuests(), shopAtmosphere: 50, xiaoerFavor: 40 }, 'wounded', seq(0.5));
    expect(res.guests![0]!.type).toBe('help');
    expect(res.guests![0]!.arrivalEvent).toBe('wounded');
  });

  it('同行试探：首位客强制观察型', () => {
    const res = applyArrivalEvent({ guests: makeGuests(), shopAtmosphere: 50, xiaoerFavor: 40 }, 'rival_probe', seq(0.5));
    expect(res.guests![0]!.type).toBe('observe');
  });

  it('阿昭旧识：随机一位客消费+20%、阿昭好感+3', () => {
    const res = applyArrivalEvent({ guests: makeGuests(), shopAtmosphere: 50, xiaoerFavor: 40 }, 'azhao_acquaintance', seq(0));
    expect(res.xiaoerFavorDelta).toBe(3);
    expect(res.guests!.some((g) => g.consumptionModifier === 1.2)).toBe(true);
  });

  it('无事发生：不修改客人/气氛/好感', () => {
    const res = applyArrivalEvent({ guests: makeGuests(), shopAtmosphere: 50, xiaoerFavor: 40 }, 'none', seq(0.5));
    expect(res.atmosphereDelta).toBeUndefined();
    expect(res.xiaoerFavorDelta).toBeUndefined();
    expect(res.guests).toBeUndefined();
  });
});

describe('伤员帮忙/婉拒', () => {
  it('帮忙：精力-10、声望+15、耗少许药材', () => {
    const r = applyWoundedGuestOutcome('help');
    expect(r.reputationDelta).toBe(15);
    expect(r.energyCost).toBe(10);
    expect(r.consumesHerb).toBe(true);
    expect(r.atmosphereDelta).toBe(0);
  });

  it('婉拒：气氛-5、无数值收益', () => {
    const r = applyWoundedGuestOutcome('refuse');
    expect(r.atmosphereDelta).toBe(-5);
    expect(r.reputationDelta).toBe(0);
    expect(r.energyCost).toBe(0);
  });
});

describe('离场事件', () => {
  it('当日气氛≥70 → 满意而归（气氛+5）', () => {
    const r = rollDepartureEvent({ shopAtmosphere: 75, todayComplaints: 0, hasSatisfiedGuest: false }, seq(0.5));
    expect(r.type).toBe('satisfied');
    expect(r.atmosphereDelta).toBe(5);
  });

  it('当日有投诉 → 摔门而去（气氛-8）', () => {
    const r = rollDepartureEvent({ shopAtmosphere: 40, todayComplaints: 2, hasSatisfiedGuest: false }, seq(0.5));
    expect(r.type).toBe('slam_door');
    expect(r.atmosphereDelta).toBe(-8);
  });

  it('遗落物品 5%：钱袋+5~20 两', () => {
    const r = rollDepartureEvent({ shopAtmosphere: 40, todayComplaints: 0, hasSatisfiedGuest: false }, seq(0.02, 0.1, 0.5));
    expect(r.type).toBe('dropped_item');
    expect(r.silverDelta).toBeGreaterThanOrEqual(5);
    expect(r.silverDelta).toBeLessThanOrEqual(20);
  });

  it('遗落物品 5%：玉佩稀有品（入库 item）/ 书信线索（clue）', () => {
    const item = rollDepartureEvent({ shopAtmosphere: 40, todayComplaints: 0, hasSatisfiedGuest: false }, seq(0.02, 0.5, 0.5));
    expect(item.item?.name).toBe('羊脂玉佩');
    const clue = rollDepartureEvent({ shopAtmosphere: 40, todayComplaints: 0, hasSatisfiedGuest: false }, seq(0.02, 0.9, 0.5));
    expect(clue.clue?.category).toBe('secret');
  });

  it('有满意度≥90 客人 → 带新客来（次日 +1 客）；否则无事', () => {
    const r = rollDepartureEvent({ shopAtmosphere: 40, todayComplaints: 0, hasSatisfiedGuest: true }, seq(0.5));
    expect(r.type).toBe('bring_guest');
    expect(r.nextDayExtraGuests).toBe(1);
    const none = rollDepartureEvent({ shopAtmosphere: 40, todayComplaints: 0, hasSatisfiedGuest: false }, seq(0.9));
    expect(none.type).toBe('none');
  });
});
