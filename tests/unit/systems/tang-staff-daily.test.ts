/**
 * 员工主动问候 / 打烊报告单测（店员互动提升 模块四 4.1/4.2）
 */
import { describe, expect, it } from 'vitest';
import { pickStaffGreeting, pickStaffReport, reportBand, staffCandidates } from '@/systems/tang-staff-daily';
import type { StaffDailyInput } from '@/systems/tang-staff-daily';

function rngSeq(seq: number[]): () => number {
  let i = 0;
  return () => seq[i++ % seq.length]!;
}

function makeInput(overrides: Partial<StaffDailyInput> = {}): StaffDailyInput {
  return {
    employees: [{ id: 'e1', name: '赵武', type: 'guard', satisfaction: 90 }],
    xiaoerSatisfaction: 70,
    hexagram: null,
    ...overrides,
  };
}

describe('pickStaffGreeting（每日问候）', () => {
  it('随机一位在岗员工问候（含阿昭）', () => {
    const g = pickStaffGreeting(makeInput(), rngSeq([0]));
    expect(g).not.toBeNull();
    expect(g!.content.length).toBeGreaterThan(0);
  });
  it('坎卦微调：问候附坎坷提示', () => {
    const g = pickStaffGreeting(makeInput({ hexagram: 'kan' }), rngSeq([0]));
    expect(g!.content).toContain('坎坷');
  });
  it('无员工时仍有阿昭问候（阿昭常驻）', () => {
    const g = pickStaffGreeting(makeInput({ employees: [] }), rngSeq([0]));
    expect(g!.staffName).toBe('阿昭');
  });
});

describe('reportBand / pickStaffReport（打烊报告）', () => {
  it('满意度分档：≥80 positive / 40-79 neutral / <40 negative', () => {
    expect(reportBand(90)).toBe('positive');
    expect(reportBand(60)).toBe('neutral');
    expect(reportBand(30)).toBe('negative');
  });
  it('高满意度 → 积极报告', () => {
    const r = pickStaffReport(makeInput(), rngSeq([0.5, 0]));
    expect(r).not.toBeNull();
    expect(r!.band).toBe('positive');
  });
  it('低满意度可能沉默（<40 且 30% 概率）', () => {
    const r = pickStaffReport(makeInput({ employees: [{ id: 'e1', name: '赵武', type: 'guard', satisfaction: 20 }], xiaoerSatisfaction: 20 }), rngSeq([0, 0]));
    expect(r).toBeNull();
  });
  it('候选列表含阿昭 + 在岗员工', () => {
    const cands = staffCandidates(makeInput());
    expect(cands.some((c) => c.id === 'a_zhao')).toBe(true);
    expect(cands.some((c) => c.id === 'e1')).toBe(true);
  });
});
