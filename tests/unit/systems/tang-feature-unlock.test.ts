/**
 * TANG-POLISH-001 模块二：功能解锁系统 — 判定逻辑验收测试
 *
 * 验证 points（systems/tang-feature-unlock.ts + config/tang-feature-ids.ts）：
 * 1. checkFeatureUnlock：多条件 and 关系；返回「本次新解锁」；已解锁不重复
 * 2. 12 个 featureId 的解锁条件（staff day≥3+员工≥1 / bank day≥5 / map 声望≥100+day≥10 /
 *    faction 声望≥50+day≥8 / caravan 阶段≥2+声望≥200 / politics 声望≥700+阶段≥3 /
 *    journal day≥15+成就≥1 / achievement 成就≥1；me/reception/shelf/ledger always）
 * 3. getUnlockCondition：未解锁返回首条未满足条件；已解锁/无功能返回 null
 * 4. getUnlockNarrative：始终返回非空文案
 * 5. 与导航条件解锁（isNavItemUnlocked）不冲突：功能解锁独立于导航显示
 */
import { describe, expect, it } from 'vitest';
import {
  checkFeatureUnlock,
  getUnlockCondition,
  getUnlockNarrative,
  isFeatureUnlocked,
  type FeatureUnlockInput,
} from '../../../src/systems/tang-feature-unlock';
import { TANG_FEATURES } from '../../../src/config/tang-feature-ids';

/** 空解锁记录（默认全未解锁） */
function emptyKnown(): Record<string, boolean> {
  return {};
}

/** 构造一个基础满足输入（day=1 开局） */
function baseInput(over: Partial<FeatureUnlockInput> = {}): FeatureUnlockInput {
  return { day: 1, reputation: 0, employeesCount: 0, stage: 1, unlockedAchievementsCount: 0, ...over };
}

describe('TANG-POLISH-001 模块二：checkFeatureUnlock 判定', () => {
  it('开局（day=1）仅解锁 always 四功能：me/reception/shelf/ledger', () => {
    const newly = checkFeatureUnlock(emptyKnown(), baseInput());
    expect(newly.sort()).toEqual(['ledger', 'me', 'reception', 'shelf']);
  });

  it('已解锁记录中的功能不会重复返回', () => {
    const known = { me: true, reception: true, shelf: true, ledger: true };
    const newly = checkFeatureUnlock(known, baseInput());
    expect(newly).toEqual([]);
  });

  it('staff：day≥3 且 员工≥1 才解锁（and 关系）', () => {
    expect(checkFeatureUnlock(emptyKnown(), baseInput({ day: 3, employeesCount: 0 }))).not.toContain('staff');
    expect(checkFeatureUnlock(emptyKnown(), baseInput({ day: 2, employeesCount: 1 }))).not.toContain('staff');
    const newly = checkFeatureUnlock(emptyKnown(), baseInput({ day: 3, employeesCount: 1 }));
    expect(newly).toContain('staff');
  });

  it('bank：day≥5 解锁', () => {
    expect(checkFeatureUnlock(emptyKnown(), baseInput({ day: 4 }))).not.toContain('bank');
    expect(checkFeatureUnlock(emptyKnown(), baseInput({ day: 5 }))).toContain('bank');
  });

  it('map：声望≥100 且 day≥10（and）', () => {
    expect(checkFeatureUnlock(emptyKnown(), baseInput({ reputation: 100, day: 9 }))).not.toContain('map');
    expect(checkFeatureUnlock(emptyKnown(), baseInput({ reputation: 99, day: 10 }))).not.toContain('map');
    expect(checkFeatureUnlock(emptyKnown(), baseInput({ reputation: 100, day: 10 }))).toContain('map');
  });

  it('faction：声望≥50 且 day≥8（and）', () => {
    expect(checkFeatureUnlock(emptyKnown(), baseInput({ reputation: 50, day: 7 }))).not.toContain('faction');
    expect(checkFeatureUnlock(emptyKnown(), baseInput({ reputation: 50, day: 8 }))).toContain('faction');
  });

  it('caravan：阶段≥2 且 声望≥200（and）', () => {
    expect(checkFeatureUnlock(emptyKnown(), baseInput({ stage: 2, reputation: 199 }))).not.toContain('caravan');
    expect(checkFeatureUnlock(emptyKnown(), baseInput({ stage: 2, reputation: 200 }))).toContain('caravan');
  });

  it('politics：声望≥700 且 阶段≥3（and）', () => {
    expect(checkFeatureUnlock(emptyKnown(), baseInput({ reputation: 700, stage: 2 }))).not.toContain('politics');
    expect(checkFeatureUnlock(emptyKnown(), baseInput({ reputation: 700, stage: 3 }))).toContain('politics');
  });

  it('journal：day≥15 且 成就≥1（and）', () => {
    expect(checkFeatureUnlock(emptyKnown(), baseInput({ day: 15, unlockedAchievementsCount: 0 }))).not.toContain('journal');
    expect(checkFeatureUnlock(emptyKnown(), baseInput({ day: 15, unlockedAchievementsCount: 1 }))).toContain('journal');
  });

  it('achievement：成就≥1 解锁', () => {
    expect(checkFeatureUnlock(emptyKnown(), baseInput({ unlockedAchievementsCount: 0 }))).not.toContain('achievement');
    expect(checkFeatureUnlock(emptyKnown(), baseInput({ unlockedAchievementsCount: 1 }))).toContain('achievement');
  });
});

describe('TANG-POLISH-001 模块二：isFeatureUnlocked / getUnlockCondition', () => {
  it('isFeatureUnlocked：已解锁直接 true（无需满足条件）', () => {
    expect(isFeatureUnlocked('staff', { staff: true }, baseInput())).toBe(true);
  });

  it('isFeatureUnlocked：未知 featureId 返回 false', () => {
    expect(isFeatureUnlocked('unknown', emptyKnown(), baseInput())).toBe(false);
  });

  it('getUnlockCondition：未解锁返回首条未满足条件描述', () => {
    // staff 未解锁：day<3 时提示第 3 日起
    expect(getUnlockCondition('staff', emptyKnown(), baseInput({ day: 1, employeesCount: 1 }))).toContain('第 3 日');
    // map 未解锁：声望不足时提示声望 ≥ 100
    expect(getUnlockCondition('map', emptyKnown(), baseInput({ day: 10, reputation: 0 }))).toContain('声望');
  });

  it('getUnlockCondition：已解锁返回 null', () => {
    expect(getUnlockCondition('me', { me: true }, baseInput())).toBeNull();
  });

  it('getUnlockCondition：未知 featureId 返回 null', () => {
    expect(getUnlockCondition('unknown', emptyKnown(), baseInput())).toBeNull();
  });

  it('getUnlockCondition：全部满足但未写入记录 → 返回 null（应先查 isFeatureUnlocked）', () => {
    expect(getUnlockCondition('bank', emptyKnown(), baseInput({ day: 5 }))).toBeNull();
  });
});

describe('TANG-POLISH-001 模块二：getUnlockNarrative / 配置完整性', () => {
  it('getUnlockNarrative：任意 featureId 均返回非空文案', () => {
    for (const f of TANG_FEATURES) {
      expect(getUnlockNarrative(f.id).length).toBeGreaterThan(0);
    }
  });

  it('配置完整性：12 个 featureId 与导航 12 面板 key 一致（me..achievement）', () => {
    expect(TANG_FEATURES.map((f) => f.id)).toEqual([
      'me', 'reception', 'shelf', 'ledger', 'staff', 'bank',
      'map', 'faction', 'caravan', 'politics', 'journal', 'achievement',
    ]);
  });

  it('配置完整性：每个 featureId 至少一条条件', () => {
    for (const f of TANG_FEATURES) {
      expect(f.conditions.length).toBeGreaterThan(0);
    }
  });
});
