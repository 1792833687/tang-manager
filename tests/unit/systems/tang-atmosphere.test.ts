/**
 * 气氛与连锁系统单测（TANG-RCP-001 模块三 tang-atmosphere）
 * 覆盖：气氛更新事件映射/传染/耐心递减归零/拼桌并单（≥6 用例）。
 */
import { describe, expect, it } from 'vitest';
import {
  checkEmotionContagion,
  checkGuestBookTrigger,
  mergeGuests,
  updateAtmosphere,
  updatePatience,
} from '@/systems/tang-atmosphere';
import type { Guest } from '@/types/tang-manager';

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

describe('updateAtmosphere（3.1 逐字：夸奖+10/投诉-15/当场离开-8/解决投诉+5；clamp 0-100）', () => {
  it('夸奖 +10 / 投诉 -15 / 当场离开 -8 / 解决投诉 +5', () => {
    expect(updateAtmosphere('praise', { shopAtmosphere: 50 }).shopAtmosphere).toBe(60);
    expect(updateAtmosphere('complaint', { shopAtmosphere: 50 }).shopAtmosphere).toBe(35);
    expect(updateAtmosphere('leave', { shopAtmosphere: 50 }).shopAtmosphere).toBe(42);
    expect(updateAtmosphere('resolve_complaint', { shopAtmosphere: 50 }).shopAtmosphere).toBe(55);
  });

  it('clamp 0-100（投诉叠到负、夸奖叠到满）', () => {
    expect(updateAtmosphere('complaint', { shopAtmosphere: 5 }).shopAtmosphere).toBe(0);
    expect(updateAtmosphere('praise', { shopAtmosphere: 95 }).shopAtmosphere).toBe(100);
  });

  it('缺省 shopAtmosphere 按 50 起步', () => {
    expect(updateAtmosphere('praise', {}).shopAtmosphere).toBe(60);
  });
});

describe('checkEmotionContagion（3.1：当众投诉 30% 走掉 / 当众夸奖 消费意愿+10%）', () => {
  it('当众投诉 30% 概率其他客人走掉（walkOutIds 含全部未接待客人）', () => {
    const others = [makeGuest({ id: 'a' }), makeGuest({ id: 'b' })];
    const hit = checkEmotionContagion(makeGuest(), 'complaint', { guests: [makeGuest(), ...others] }, () => 0.2);
    expect(hit.walkOutIds).toEqual(['a', 'b']);
    const miss = checkEmotionContagion(makeGuest(), 'complaint', { guests: [makeGuest(), ...others] }, () => 0.9);
    expect(miss.walkOutIds).toEqual([]);
  });

  it('当众夸奖：其余未接待客人 boostIds（消费意愿+10%）', () => {
    const r = checkEmotionContagion(makeGuest(), 'praise', {
      guests: [makeGuest(), makeGuest({ id: 'a' }), makeGuest({ id: 'b', handled: true })],
    });
    expect(r.boostIds).toEqual(['a']); // b 已处理不传染
  });
});

describe('updatePatience（3.1：上一位接待每超 30s（每轮）下一位-5；归零离开+差评；<30 消费意愿-20%）', () => {
  it('每轮（30s）-5', () => {
    const r = updatePatience(makeGuest({ patience: 100 }), 30);
    expect(r.patience).toBe(95);
    expect(r.zeroed).toBe(false);
    expect(r.lowPatience).toBe(false);
  });

  it('耐心归零 → zeroed=true（离开+差评）', () => {
    const r = updatePatience(makeGuest({ patience: 10 }), 30);
    expect(r.patience).toBe(5); // 10-5
    const r2 = updatePatience(makeGuest({ patience: 3 }), 30);
    expect(r2.zeroed).toBe(true);
    expect(r2.consumptionModifier).toBe(0);
  });

  it('耐心<30 且未归零 → 消费意愿-20%（0.8）', () => {
    const r = updatePatience(makeGuest({ patience: 32 }), 30);
    expect(r.patience).toBe(27);
    expect(r.zeroed).toBe(false);
    expect(r.lowPatience).toBe(true);
    expect(r.consumptionModifier).toBe(0.8);
  });

  it('缺省 patience 按 100 起步', () => {
    expect(updatePatience(makeGuest(), 30).patience).toBe(95);
  });
});

describe('mergeGuests（3.4 逐字：同类型+耐心都>50；一次接待两人效率翻倍、每人消费 8 折、精力×1.5；双命中偏好+10 气氛）', () => {
  it('不同类型 → 拒绝拼桌', () => {
    const r = mergeGuests(makeGuest({ type: 'normal' }), makeGuest({ id: 'a', type: 'big_order' }));
    expect(r.ok).toBe(false);
  });

  it('耐心 ≤50 → 拒绝拼桌', () => {
    const r = mergeGuests(makeGuest(), makeGuest({ id: 'a', patience: 40 }));
    expect(r.ok).toBe(false);
    expect(r.reason).toContain('久候');
  });

  it('同类型 + 耐心>50：income=(A+B)×0.8，精力×1.5（7.5）', () => {
    const a = makeGuest({ baseConsumption: 4 });
    const b = makeGuest({ id: 'a', baseConsumption: 6 });
    const r = mergeGuests(a, b);
    expect(r.ok).toBe(true);
    expect(r.income).toBe(8.0); // (4+6)×0.8
    expect(r.energyConsumed).toBe(7.5);
    expect(r.doubleHit).toBe(false);
    expect(r.atmosphereBonus).toBe(0);
  });

  it('双命中偏好 → 额外 +10 气氛', () => {
    const prefs = [{ type: 'style', value: '家常', revealed: true }];
    const a = makeGuest({ preferences: prefs });
    const b = makeGuest({ id: 'a', preferences: prefs });
    const r = mergeGuests(a, b);
    expect(r.doubleHit).toBe(true);
    expect(r.atmosphereBonus).toBe(10);
  });
});

describe('checkGuestBookTrigger（4.1：满意度≥80 且累计消费≥50 praise / 第三次 story / 特殊事件客 event）', () => {
  it('满意度≥80 且累计消费≥50 → praise', () => {
    const r = checkGuestBookTrigger(makeGuest({ satisfaction: 85, totalSpent: 60 }), { guestBook: [] });
    expect(r.type).toBe('praise');
    expect(r.content.length).toBeGreaterThan(0);
  });

  it('回头客第三次（visitCount≥3）→ story', () => {
    const r = checkGuestBookTrigger(makeGuest({ visitCount: 3, satisfaction: 40, totalSpent: 10 }), { guestBook: [] });
    expect(r.type).toBe('story');
  });

  it('特殊事件客（胡商/进士/赵管家）→ event', () => {
    expect(checkGuestBookTrigger(makeGuest({ name: '胡商' }), { guestBook: [] }).type).toBe('event');
    expect(checkGuestBookTrigger(makeGuest({ name: '李四' }), { guestBook: [] }).type).toBeNull();
  });
});
