/**
 * 巍明楼政治单测（tang-politics · Step 5b-5 模块三）
 * 覆盖：政令生成（仅月初/持续 30 天）、政令影响（税收/宵禁/互市/禁私/皇商/清查）、
 *       派系对齐（+20 对立 -10 + 三子派特殊效果）、季度权力斗争、转政门槛。
 */
import { describe, expect, it } from 'vitest';
import {
  generateImperialDecree,
  checkDecreeImpact,
  alignWithFaction,
  factionPowerStruggle,
  checkPoliticalTransition,
  type Decree,
} from '@/systems/tang-politics';

const seq =
  (...values: number[]): (() => number) =>
  () => values.shift() ?? 0.5;

function decree(overrides: Partial<Decree> = {}): Decree {
  return {
    id: 'd1',
    type: 'tax',
    name: '加征商税',
    description: '加征两成。',
    value: 0.2,
    issuedDay: 1,
    expireDay: 31,
    active: true,
    ...overrides,
  };
}

describe('generateImperialDecree 政令生成', () => {
  it('仅每月初（day%30===1）生成 1 条，expireDay=issuedDay+30', () => {
    const d = generateImperialDecree({ day: 31, decrees: [] }, seq(0));
    expect(d).not.toBeNull();
    expect(d!.issuedDay).toBe(31);
    expect(d!.expireDay).toBe(61);
    expect(d!.active).toBe(true);
    expect(['tax', 'curfew', 'mutual_market', 'smuggle', 'imperial_bid', 'audit']).toContain(d!.type);
  });

  it('非月初返回 null', () => {
    expect(generateImperialDecree({ day: 5, decrees: [] })).toBeNull();
  });
});

describe('checkDecreeImpact 政令影响', () => {
  it('税收 ±20% → taxModifier 1±0.2', () => {
    expect(checkDecreeImpact(decree({ type: 'tax', value: 0.2 }), 10).taxModifier).toBe(1.2);
    expect(checkDecreeImpact(decree({ type: 'tax', value: -0.2 }), 10).taxModifier).toBe(0.8);
  });

  it('宵禁客流 -20% / 互市进货 -15% / 禁私走私风险翻倍', () => {
    expect(checkDecreeImpact(decree({ type: 'curfew', value: -0.2 }), 10).guestFlowModifier).toBe(0.8);
    expect(checkDecreeImpact(decree({ type: 'mutual_market', value: -0.15 }), 10).procurementModifier).toBe(0.85);
    expect(checkDecreeImpact(decree({ type: 'smuggle', value: 2 }), 10).smugglingRiskModifier).toBe(2);
  });

  it('皇商招标开放 / 清查账目激活', () => {
    const bid = checkDecreeImpact(decree({ type: 'imperial_bid', value: 700 }), 10);
    expect(bid.imperialBidOpen).toBe(true);
    const audit = checkDecreeImpact(decree({ type: 'audit' }), 10);
    expect(audit.auditActive).toBe(true);
  });

  it('政令过期 → 返回默认影响', () => {
    const impact = checkDecreeImpact(decree({ issuedDay: 1, expireDay: 31 }), 40);
    expect(impact.decreeId).toBe('');
    expect(impact.taxModifier).toBe(1);
    expect(impact.imperialBidOpen).toBe(false);
  });

  it('无政令 → 默认影响', () => {
    const impact = checkDecreeImpact(null, 10);
    expect(impact.taxModifier).toBe(1);
  });
});

describe('alignWithFaction 派系对齐', () => {
  it('支持派系 +20（clamp 100）；站队为子派系', () => {
    const r = alignWithFaction('conservative', { politicalFaction: null, politicalAlignment: 30, reputation: 100 }, seq(0.5));
    expect(r.ok).toBe(true);
    expect(r.politicalFaction).toBe('conservative');
    expect(r.politicalAlignment).toBe(50);
    expect(r.effects.some((e) => e.includes('保守派'))).toBe(true);
  });

  it('宦官派：声望 -5（绕官府但声望损）', () => {
    const r = alignWithFaction('eunuch', { politicalFaction: null, politicalAlignment: 20, reputation: 100 }, seq(0.5));
    expect(r.reputationDelta).toBe(-5);
  });

  it('无此派系 → ok:false', () => {
    const r = alignWithFaction('dongshi', { politicalFaction: null, politicalAlignment: 0, reputation: 100 });
    expect(r.ok).toBe(false);
  });
});

describe('factionPowerStruggle 季度派系斗争', () => {
  it('玩家派系胜出 → +10；失利 → -20', () => {
    // rng 序列：opponent 抽取 + winner 判定（0.2 < 0.5 → winner=current）
    const win = factionPowerStruggle({ politicalFaction: 'conservative', politicalAlignment: 50, day: 91 }, seq(0.2, 0.2));
    expect(win.alignmentDelta).toBe(10);
    // 0.8 > 0.5 → winner=opponent → 失利 -20
    const lose = factionPowerStruggle({ politicalFaction: 'conservative', politicalAlignment: 50, day: 91 }, seq(0.2, 0.8));
    expect(lose.alignmentDelta).toBe(-20);
    expect(lose.winnerBonus).toBe(true);
    expect(lose.description).toContain('党争');
  });
});

describe('checkPoliticalTransition 转政门槛', () => {
  it('声望≥900 且资金≥200000 且支持派系≥80 → true', () => {
    expect(checkPoliticalTransition({ reputation: 900, silver: 200000, politicalAlignment: 80 })).toBe(true);
  });

  it('任一不满足 → false', () => {
    expect(checkPoliticalTransition({ reputation: 899, silver: 200000, politicalAlignment: 80 })).toBe(false);
    expect(checkPoliticalTransition({ reputation: 900, silver: 199999, politicalAlignment: 80 })).toBe(false);
    expect(checkPoliticalTransition({ reputation: 900, silver: 200000, politicalAlignment: 79 })).toBe(false);
  });
});
