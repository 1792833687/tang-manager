/**
 * 多结局单测（tang-endings · Step 5b-5 模块五）
 * 覆盖：8 结局条件逐项（构造满足/不满足状态）；判定顺序（家道中落优先；无人问津兜底；执棋者隐藏）。
 */
import { describe, expect, it } from 'vitest';
import { checkEndingConditions, endingById, ENDING_DEFINITIONS } from '@/systems/tang-endings';
import type { EndingCheckContext } from '@/systems/tang-endings';
import type { Clue } from '@/types/tang-clues';

function makeClue(id: string, resolved = false): Clue {
  return { id, source: '沈听澜', sourceType: 'npc', content: '线索', category: 'shen', day: 1, connected: [], resolved };
}

function makeCtx(overrides: Partial<EndingCheckContext> = {}): EndingCheckContext {
  return {
    shopCount: 1,
    silver: 1000,
    reputation: 100,
    score: 3.0,
    day: 10,
    legacyDebt: 0,
    credit: 500,
    courtCooperation: false,
    imperialBidCount: 0,
    soldShops: false,
    apprenticeOpenedShop: false,
    retiredDays: 0,
    politicalLine: false,
    politicalAlignment: 0,
    politicalEndgame: false,
    factions: [],
    clues: [],
    joinedCourt: false,
    ...overrides,
  };
}

describe('结局定义完整性', () => {
  it('8 个结局逐字齐全且 id 可查', () => {
    expect(ENDING_DEFINITIONS.length).toBe(8);
    for (const def of ENDING_DEFINITIONS) {
      expect(endingById(def.id)!.id).toBe(def.id);
      expect(def.paragraphs.length).toBeGreaterThanOrEqual(2);
    }
  });
});

describe('一代商圣', () => {
  it('3 店 + 50 万 + 声望 900 → 触发', () => {
    expect(checkEndingConditions(makeCtx({ shopCount: 3, silver: 500000, reputation: 900 }))).toBe('shang-sheng');
  });
  it('缺条件不触发', () => {
    expect(checkEndingConditions(makeCtx({ shopCount: 2, silver: 500000, reputation: 900 }))).toBeNull();
  });
});

describe('皇商之路', () => {
  it('朝廷合作 + 信用 900 + 皇商 3 次 → 触发', () => {
    expect(checkEndingConditions(makeCtx({ courtCooperation: true, credit: 900, imperialBidCount: 3 }))).toBe('huangshang');
  });
});

describe('归隐田园', () => {
  it('10 万 + 主动卖店 → 触发（forceEnd）', () => {
    expect(checkEndingConditions(makeCtx({ silver: 100000, soldShops: true }))).toBe('guiyin');
    expect(endingById('guiyin')!.forceEnd).toBe(true);
  });
});

describe('商界教父', () => {
  it('徒弟独立 1 店 + 评分 4.0 + 退居 30 天 → 触发（可继续）', () => {
    expect(
      checkEndingConditions(makeCtx({ apprenticeOpenedShop: true, score: 4.0, retiredDays: 30 }))
    ).toBe('shangjie-jiaofu');
    expect(endingById('shangjie-jiaofu')!.forceEnd).toBe(false);
  });
});

describe('家道中落（优先判定）', () => {
  it('负债 500 + 资金 0 + 评分<2 → 触发（forceEnd）', () => {
    expect(checkEndingConditions(makeCtx({ legacyDebt: 500, silver: 0, score: 1.5 }))).toBe('jiadao-zhongluo');
  });
  it('即便满足其他条件也优先家道中落', () => {
    // 同时满足一代商圣外形（店/钱/声望）但负债 500+资金 0+评分<2 → 仍是家道中落
    expect(
      checkEndingConditions(makeCtx({ shopCount: 3, silver: 0, reputation: 900, score: 1.5, legacyDebt: 500 }))
    ).toBe('jiadao-zhongluo');
  });
});

describe('权倾朝野', () => {
  it('转政 + 派系 90 + 政治终局 → 触发（forceEnd）', () => {
    expect(
      checkEndingConditions(makeCtx({ politicalLine: true, politicalAlignment: 90, politicalEndgame: true }))
    ).toBe('quanqing-chaoye');
  });
  it('缺政治终局不触发', () => {
    expect(
      checkEndingConditions(makeCtx({ politicalLine: true, politicalAlignment: 90, politicalEndgame: false }))
    ).toBeNull();
  });
});

describe('无人问津（兜底）', () => {
  it('365 天 + <1000 两 + 评分<3 → 触发', () => {
    expect(checkEndingConditions(makeCtx({ day: 365, silver: 999, score: 2.5 }))).toBe('wuren-wenjin');
  });
  it('已满足一代商圣时不落入无人问津', () => {
    expect(
      checkEndingConditions(makeCtx({ day: 365, silver: 500000, score: 2.5, reputation: 900, shopCount: 3 }))
    ).toBe('shang-sheng');
  });
});

describe('执棋者（隐藏）', () => {
  it('五势力≥70 + 线索全解析 + 未加入朝廷 → 触发（隐藏可继续）', () => {
    const ctx = makeCtx({
      factions: [
        { id: 'dongshi', relationship: 80 },
        { id: 'xishi', relationship: 75 },
        { id: 'jingzhao', relationship: 70 },
        { id: 'underground', relationship: 72 },
        { id: 'pingkang', relationship: 78 },
      ],
      clues: [makeClue('c1', true), makeClue('c2', true)],
      joinedCourt: false,
    });
    expect(checkEndingConditions(ctx)).toBe('zhiqizhe');
    expect(endingById('zhiqizhe')!.hidden).toBe(true);
  });
  it('已加入朝廷 → 不触发执棋者', () => {
    const ctx = makeCtx({
      factions: [{ id: 'dongshi', relationship: 80 }],
      clues: [makeClue('c1', true)],
      joinedCourt: true,
    });
    expect(checkEndingConditions(ctx)).toBeNull();
  });
});

describe('未满足任何结局', () => {
  it('普通状态返回 null', () => {
    expect(checkEndingConditions(makeCtx())).toBeNull();
  });
});
