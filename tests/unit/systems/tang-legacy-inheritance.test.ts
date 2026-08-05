/**
 * 多周目家族传承（v1.2 规格书模块三）验收测试
 * 覆盖：结局传承效果 / 传承角色好感继承 / 跨周目物品 / 多周目成就。
 */
import { describe, expect, it } from 'vitest';
import { computeLegacyInheritance, checkMultiRunAchievements, legacyItemName, MULTI_RUN_ACHIEVEMENTS } from '@/systems/tang-legacy-inheritance';
import { ENDING_LEGACY_EFFECTS, LEGACY_ITEMS } from '@/config/tang-legacy-inheritance';
import type { RunRecord } from '@/config/tang-legacy-inheritance';

function run(partial: Partial<RunRecord>): RunRecord {
  return { ending: 'unknown', totalDays: 100, npcFavors: {}, items: [], ...partial };
}

describe('结局传承效果（规格书 3.2）', () => {
  it('一代商圣 → 经验倍率 1.2 + 叙事', () => {
    const r = computeLegacyInheritance(run({ ending: 'yi-dai-shang-sheng' }));
    expect(r.effect?.expMultiplier).toBe(1.2);
    expect(r.effect?.narrative).toContain('先祖手迹');
  });
  it('皇商之路 → 信用+50 / 商会-20；权倾朝野 → 声望+30 / 地下-30', () => {
    expect(computeLegacyInheritance(run({ ending: 'huang-shang' })).effect?.startCredit).toBe(50);
    expect(computeLegacyInheritance(run({ ending: 'quan-qing-chao-ye' })).effect?.startReputation).toBe(30);
  });
  it('执棋者 → 解锁线索墙 + 初始线索 3', () => {
    const r = computeLegacyInheritance(run({ ending: 'zhi-qi-zhe' }));
    expect(r.effect?.clueWallUnlocked).toBe(true);
    expect(r.effect?.startClueCount).toBe(3);
  });
  it('无上一局 → 无传承', () => {
    const r = computeLegacyInheritance(null);
    expect(r.effect).toBeNull();
    expect(r.inheritedItems).toHaveLength(0);
  });
});

describe('传承角色好感继承（规格书 3.3）', () => {
  it('沈听澜/谢七好感≥80 → 开局 +20；阿昭≥90 → +30', () => {
    const r = computeLegacyInheritance(run({ npcFavors: { 'shen-tinglan': 85, 'xie-qi': 80, 'a-zhao': 95 } }));
    expect(r.npcFavorCarryover['shen-tinglan']).toBe(20);
    expect(r.npcFavorCarryover['xie-qi']).toBe(20);
    expect(r.npcFavorCarryover['a-zhao']).toBe(30);
  });
  it('好感不足 → 不继承', () => {
    const r = computeLegacyInheritance(run({ npcFavors: { 'shen-tinglan': 50 } }));
    expect(r.npcFavorCarryover['shen-tinglan']).toBeUndefined();
  });
});

describe('传承物品（规格书 3.4）', () => {
  it('萨迪玉佩（好感≥80）/ 推荐信（权倾朝野）', () => {
    const r1 = computeLegacyInheritance(run({ npcFavors: { sadi: 85 } }));
    expect(r1.inheritedItems).toContain('persian-jade');
    const r2 = computeLegacyInheritance(run({ ending: 'quan-qing-chao-ye' }));
    expect(r2.inheritedItems).toContain('recommendation-letter');
  });
  it('传承物品有古风名称', () => {
    expect(legacyItemName('persian-jade')).toContain('波斯玉佩');
    expect(LEGACY_ITEMS['ancestral-sign'].name).toContain('祖传招牌');
  });
});

describe('多周目成就（规格书 3.5）', () => {
  it('陆家三代：三个不同结局通关', () => {
    const runs = [run({ ending: 'a' }), run({ ending: 'b' }), run({ ending: 'c' })];
    const ids = checkMultiRunAchievements(runs);
    expect(ids).toContain('legacy-three-generations');
  });
  it('长安活化石：累计 1000 天', () => {
    const runs = [run({ totalDays: 600 }), run({ totalDays: 500 })];
    expect(checkMultiRunAchievements(runs)).toContain('legacy-living-fossil');
  });
  it('全结局制霸：8 种结局', () => {
    const runs = Array.from({ length: 8 }, (_, i) => run({ ending: 'e' + i }));
    expect(checkMultiRunAchievements(runs)).toContain('legacy-all-endings');
  });
  it('成就定义齐全', () => {
    expect(MULTI_RUN_ACHIEVEMENTS.length).toBeGreaterThanOrEqual(4);
  });
});
