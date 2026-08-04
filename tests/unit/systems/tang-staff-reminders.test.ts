/**
 * 店员提醒系统单测（模块三 3.1 / 模块七）
 * 覆盖：差评师（护卫）、库存不足（阿昭）、偏好已揭示（阿昭）、犹豫（阿昭）、价格（账房）；
 * 每阶段最多 1 条；阶段不匹配返回空。
 */
import { describe, expect, it } from 'vitest';
import { checkStaffReminders, hasAnyReminder } from '@/systems/tang-staff-reminders';
import { applyReminderEffect, generateStaffReminders } from '@/systems/tang-staff-reminders';
import type { ReminderContext, StaffReminder } from '@/types/tang-reminders';
import type { DialogueContext } from '@/types/tang-dialogue';

function makeCtx(overrides: Partial<DialogueContext> = {}): DialogueContext {
  return {
    shopType: 'jiulou',
    guestType: 'normal',
    description: '随便看看',
    preferenceRevealed: false,
    baseConsumption: 4,
    hasStock: true,
    hasAccountant: false,
    hasGuard: false,
    isBadReviewer: false,
    patience: 100,
    ...overrides,
  };
}

describe('checkStaffReminders（触发条件）', () => {
  it('greeting：差评师 + 有护卫 → 护卫提醒', () => {
    const r = checkStaffReminders(makeCtx({ isBadReviewer: true, hasGuard: true }), 'greeting');
    expect(r).toHaveLength(1);
    expect(r[0]!.staff).toBe('护卫');
    expect(r[0]!.message).toContain('面熟');
  });
  it('recommend：库存不足 → 阿昭提醒（优先级高于偏好）', () => {
    const r = checkStaffReminders(makeCtx({ hasStock: false, preferenceRevealed: true }), 'recommend');
    expect(r).toHaveLength(1);
    expect(r[0]!.staff).toBe('阿昭');
    expect(r[0]!.message).toContain('不够');
  });
  it('recommend：偏好已揭示 → 阿昭提醒', () => {
    const r = checkStaffReminders(makeCtx({ preferenceRevealed: true }), 'recommend');
    expect(r).toHaveLength(1);
    expect(r[0]!.staff).toBe('阿昭');
    expect(r[0]!.message).toContain('偏好'.slice(0, 2));
  });
  it('guest_feedback：耐心 <40 → 阿昭犹豫提醒（优先于账房）', () => {
    const r = checkStaffReminders(makeCtx({ patience: 30, hasAccountant: true }), 'guest_feedback');
    expect(r).toHaveLength(1);
    expect(r[0]!.staff).toBe('阿昭');
  });
  it('guest_feedback：有账房 → 账房价格提醒', () => {
    const r = checkStaffReminders(makeCtx({ hasAccountant: true, patience: 80 }), 'guest_feedback');
    expect(r).toHaveLength(1);
    expect(r[0]!.staff).toBe('账房');
  });
  it('阶段不匹配 → 空；最多 1 条', () => {
    expect(checkStaffReminders(makeCtx({ isBadReviewer: true, hasGuard: true }), 'recommend')).toHaveLength(0);
    expect(hasAnyReminder(makeCtx({ isBadReviewer: true, hasGuard: true }), 'greeting')).toBe(true);
  });
});

// ============================================================
// 店员互动提升（模块一/六）：generateStaffReminders / applyReminderEffect
// ============================================================

function makeReminderCtx(overrides: Partial<ReminderContext> = {}): ReminderContext {
  return {
    day: 1,
    phase: 'morning',
    shopType: 'jiulou',
    employees: [],
    xiaoerSatisfaction: 60,
    silver: 100,
    ...overrides,
  };
}

describe('generateStaffReminders（触发/优先级/上限）', () => {
  it('清晨坎卦 → 阿昭高优先级提醒', () => {
    const rs = generateStaffReminders(makeReminderCtx({ todayHexagram: 'kan' }), 'morning');
    expect(rs.length).toBeGreaterThan(0);
    expect(rs[0]!.staffName).toBe('阿昭');
    expect(rs[0]!.priority).toBe('high');
    expect(rs[0]!.content).toContain('卦象');
  });
  it('接待阶段：观察客 + 有护卫 → 护卫高优先级（且同店只 1 条）', () => {
    const ctx = makeReminderCtx({
      phase: 'reception',
      guests: [{ id: 'g1', name: '神秘客', type: 'observe', visitCount: 1, isBadReviewer: false, patience: 90 }],
      employees: [{ id: 'e1', name: '赵武', type: 'guard', satisfaction: 70 }],
    });
    const rs = generateStaffReminders(ctx, 'reception');
    expect(rs.length).toBeGreaterThan(0);
    expect(rs.some((r) => r.staffId === 'guard')).toBe(true);
  });
  it('员工不在岗（无护卫）→ 护卫提醒不生成', () => {
    const ctx = makeReminderCtx({
      phase: 'reception',
      guests: [{ id: 'g1', name: '神秘客', type: 'observe', visitCount: 1, isBadReviewer: false, patience: 90 }],
      employees: [],
    });
    const rs = generateStaffReminders(ctx, 'reception');
    expect(rs.some((r) => r.staffId === 'guard')).toBe(false);
  });
  it('库存阶段：陈损 ≤2 天 → 阿昭打折提醒', () => {
    const ctx = makeReminderCtx({
      phase: 'inventory',
      shopItems: [{ name: '羊肉', stock: 5, expiry: 1, price: 3, category: '食材' }],
    });
    const rs = generateStaffReminders(ctx, 'inventory');
    expect(rs.some((r) => r.content.includes('只剩两天'))).toBe(true);
  });
  it('最多 2 条、按优先级排序', () => {
    const ctx = makeReminderCtx({
      phase: 'reception',
      guests: [
        { id: 'g1', name: '熟客甲', type: 'normal', visitCount: 5, isBadReviewer: false, patience: 30 },
        { id: 'g2', name: '神秘客', type: 'observe', visitCount: 1, isBadReviewer: false, patience: 90 },
      ],
      employees: [{ id: 'e1', name: '赵武', type: 'guard', satisfaction: 70 }],
      shopItems: [{ name: '米酒', stock: 2, price: 2, category: '食材' }],
    });
    const rs = generateStaffReminders(ctx, 'reception');
    expect(rs.length).toBeLessThanOrEqual(2);
    for (let i = 1; i < rs.length; i++) {
      const order: Record<string, number> = { high: 0, medium: 1, low: 2 };
      expect(order[rs[i]!.priority]!).toBeGreaterThanOrEqual(order[rs[i - 1]!.priority]!);
    }
  });
});

describe('applyReminderEffect（采纳/忽略/连续忽略）', () => {
  function makeOne(): StaffReminder {
    return {
      id: 'r1', staffId: 'a_zhao', staffName: '阿昭', triggerPhase: 'morning',
      condition: '测试', content: '测试提醒', suggestion: '照办',
      effectIfAccepted: { type: 'a_zhao_satisfaction', value: 1, note: '阿昭满意度 +1' },
      priority: 'high',
    };
  }
  it('采纳：移除提醒 + 该店员满意度 +2 + 返回效果', () => {
    const res = applyReminderEffect([makeOne()], 'r1', true, {});
    expect(res.reminders).toHaveLength(0);
    expect(res.satisfactionDeltas['a_zhao']).toBe(2);
    expect(res.acceptedEffect?.type).toBe('a_zhao_satisfaction');
  });
  it('忽略：无效果、计数 +1', () => {
    const res = applyReminderEffect([makeOne()], 'r1', false, {});
    expect(res.acceptedEffect).toBeUndefined();
    expect(res.ignoreCounts['a_zhao']).toBe(1);
    expect(res.satisfactionDeltas['a_zhao']).toBeUndefined();
  });
  it('连续忽略 3 次 → 满意度 -5、计数清零', () => {
    let res = applyReminderEffect([makeOne()], 'r1', false, {});
    res = applyReminderEffect([makeOne()], 'r1', false, res.ignoreCounts);
    res = applyReminderEffect([makeOne()], 'r1', false, res.ignoreCounts);
    expect(res.satisfactionDeltas['a_zhao']).toBe(-5);
    expect(res.ignoreCounts['a_zhao']).toBe(0);
  });
});
