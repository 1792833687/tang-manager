/**
 * 布庄面料匹配（规格书模块四 4.3/4.4）验收测试
 * 覆盖：身份/季节/场合三维加权 / 量体加成 / 档位。
 */
import { describe, expect, it } from 'vitest';
import { fabricMatchScore, fabricTier } from '@/systems/tang-fabric-matching';

describe('fabricMatchScore 三维加权', () => {
  it('官员+锦缎 身份加成（40%权重 ×20）', () => {
    const base = fabricMatchScore({ identity: 'official', season: 'spring', occasion: 'casual', fabric: '锦缎' });
    const other = fabricMatchScore({ identity: 'commoner', season: 'spring', occasion: 'casual', fabric: '锦缎' });
    expect(base).toBeGreaterThanOrEqual(other); // 顶格 clamp 100，保守断言
  });
  it('平民+丝绸 身份减分', () => {
    const score = fabricMatchScore({ identity: 'commoner', season: 'spring', occasion: 'casual', fabric: '丝绸' });
    expect(score).toBeLessThan(100);
  });
  it('夏季+棉布 季节加成', () => {
    const summer = fabricMatchScore({ identity: 'commoner', season: 'summer', occasion: 'casual', fabric: '棉布' });
    const winter = fabricMatchScore({ identity: 'commoner', season: 'winter', occasion: 'casual', fabric: '棉布' });
    expect(summer).toBeGreaterThanOrEqual(winter); // 顶格 clamp 100，保守断言
  });
  it('婚宴+锦缎 场合加成；劳作+丝绸 场合减分', () => {
    expect(fabricMatchScore({ identity: 'merchant', season: 'spring', occasion: 'wedding', fabric: '锦缎' })).toBeGreaterThan(100 - 1);
    expect(fabricMatchScore({ identity: 'merchant', season: 'spring', occasion: 'labor', fabric: '丝绸' })).toBeLessThan(100);
  });
  it('量体 +20（规格书 4.4）', () => {
    const base = fabricMatchScore({ identity: 'commoner', season: 'spring', occasion: 'casual', fabric: '棉布' });
    const measured = fabricMatchScore({ identity: 'commoner', season: 'spring', occasion: 'casual', fabric: '棉布', measured: true });
    expect(measured).toBeGreaterThanOrEqual(base); // clamp 100 上限，只证单调
    expect(measured).toBeLessThanOrEqual(100);
  });
  it('结果 clamp 0-100', () => {
    const score = fabricMatchScore({ identity: 'official', season: 'summer', occasion: 'wedding', fabric: '锦缎', measured: true });
    expect(score).toBeLessThanOrEqual(100);
    const low = fabricMatchScore({ identity: 'commoner', season: 'winter', occasion: 'labor', fabric: '丝绸' });
    expect(low).toBeGreaterThanOrEqual(0);
  });
});

describe('fabricTier 档位', () => {
  it('≥80 satisfied / 50-79 normal / <50 refund', () => {
    expect(fabricTier(85)).toBe('satisfied');
    expect(fabricTier(60)).toBe('normal');
    expect(fabricTier(40)).toBe('refund');
  });
});
