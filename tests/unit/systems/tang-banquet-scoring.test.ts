/**
 * 宴席菜单组合评分（规格书模块三 3.3）验收测试
 * 覆盖：五项评分规则 / 总分档位。
 */
import { describe, expect, it } from 'vitest';
import { scoreBanquetMenu, banquetTier, type MenuDish } from '@/systems/tang-banquet-scoring';

function dish(id: string, kind: MenuDish['kind'], cost: number, extra: Partial<MenuDish> = {}): MenuDish {
  return { id, name: id, kind, cost, ...extra };
}

describe('scoreBanquetMenu 五项评分', () => {
  it('荤素均衡 +2（荤:素 4:3~5:3）', () => {
    const menu = { dishes: [dish('m1', 'meat', 2), dish('m2', 'meat', 2), dish('m3', 'meat', 2), dish('m4', 'meat', 2), dish('v1', 'veg', 1), dish('v2', 'veg', 1), dish('v3', 'veg', 1)], banquetType: 'shou_yan', budget: 50 };
    expect(scoreBanquetMenu(menu)).toBeGreaterThanOrEqual(2);
  });
  it('招牌菜每道 +3（上限 6）', () => {
    const menu = { dishes: [dish('s1', 'meat', 3, { signature: true }), dish('s2', 'meat', 3, { signature: true }), dish('s3', 'meat', 3, { signature: true })], banquetType: 'shou_yan', budget: 50 };
    expect(scoreBanquetMenu(menu)).toBe(6);
  });
  it('有酒水 +2', () => {
    const menu = { dishes: [dish('w1', 'wine', 2)], banquetType: 'shou_yan', budget: 50 };
    expect(scoreBanquetMenu(menu)).toBe(2);
  });
  it('预算控制（成本占预算 50-70%）+2', () => {
    const menu = { dishes: [dish('m1', 'meat', 3)], banquetType: 'shou_yan', budget: 5 }; // 3/5 = 60%
    expect(scoreBanquetMenu(menu)).toBe(2);
  });
  it('宴席类型必备菜 +3（寿宴含长寿面）', () => {
    const menu = { dishes: [dish('长寿面', 'veg', 1)], banquetType: 'shou_yan', budget: 50 };
    expect(scoreBanquetMenu(menu)).toBe(3);
  });
  it('全要素高分菜单 ≥8（大获成功）', () => {
    const menu = {
      dishes: [
        dish('m1', 'meat', 4, { signature: true }),
        dish('m2', 'meat', 4, { signature: true }),
        dish('m3', 'meat', 3),
        dish('m4', 'meat', 3),
        dish('v1', 'veg', 2),
        dish('v2', 'veg', 2),
        dish('v3', 'veg', 2),
        dish('长寿面', 'veg', 1),
        dish('w1', 'wine', 3),
      ],
      banquetType: 'shou_yan',
      budget: 30,
    };
    expect(banquetTier(scoreBanquetMenu(menu))).toBe('great');
  });
});

describe('banquetTier 档位', () => {
  it('≥8 great / 5-7 ok / <5 flawed', () => {
    expect(banquetTier(9)).toBe('great');
    expect(banquetTier(6)).toBe('ok');
    expect(banquetTier(4)).toBe('flawed');
  });
});
