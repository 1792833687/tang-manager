/**
 * 局外成长单测（TANG-ADD-001 模块九）
 * 覆盖：结局点数评定、8 传承选项、点数扣减/不足/重复、独立存储读写与删档隔离。
 */
import { describe, expect, it } from 'vitest';
import {
  ANCESTRAL_BLESSINGS,
  ANCESTRAL_BLESSING_MAP,
  LEGACY_GROWTH_STORAGE_KEY,
  addEndingBlessing,
  applyAncestralBlessing,
  calculateAncestralBlessing,
  emptyLegacyGrowthSave,
  getAncestralBlessingOptions,
  loadLegacyGrowthSave,
  saveLegacyGrowthSave,
} from '@/systems/tang-legacy-growth';
import type { LegacyGrowthSave } from '@/types/tang-manager';

/** 内存 Storage 桩（模拟 localStorage，独立于主存档） */
function mockStorage(): { store: Map<string, string>; getItem: (k: string) => string | null; setItem: (k: string, v: string) => void } {
  const store = new Map<string, string>();
  return {
    store,
    getItem: (k) => store.get(k) ?? null,
    setItem: (k, v) => {
      store.set(k, v);
    },
  };
}

describe('calculateAncestralBlessing · 结局点数', () => {
  it('商圣/皇商 3、权倾 4、执棋者 5、教父 2、归隐 1、家道/无人 0', () => {
    expect(calculateAncestralBlessing('shang-sheng')).toBe(3);
    expect(calculateAncestralBlessing('huangshang')).toBe(3);
    expect(calculateAncestralBlessing('quanqing-chaoye')).toBe(4);
    expect(calculateAncestralBlessing('zhiqizhe')).toBe(5);
    expect(calculateAncestralBlessing('shangjie-jiaofu')).toBe(2);
    expect(calculateAncestralBlessing('guiyin')).toBe(1);
    expect(calculateAncestralBlessing('jiadao-zhongluo')).toBe(0);
    expect(calculateAncestralBlessing('wuren-wenjin')).toBe(0);
    expect(calculateAncestralBlessing(null)).toBe(0);
    expect(calculateAncestralBlessing(undefined)).toBe(0);
  });

  it('addEndingBlessing：入账点数并记录结局', () => {
    const save = addEndingBlessing(emptyLegacyGrowthSave(), 'shang-sheng');
    expect(save.blessingPoints).toBe(3);
    expect(save.endings['shang-sheng']).toBe(1);
    const twice = addEndingBlessing(save, 'shang-sheng');
    expect(twice.endings['shang-sheng']).toBe(2);
    expect(twice.blessingPoints).toBe(6);
  });
});

describe('getAncestralBlessingOptions · 8 传承逐字', () => {
  it('8 传承：name/cost/description 齐全', () => {
    const options = getAncestralBlessingOptions();
    expect(options).toHaveLength(8);
    const map = Object.fromEntries(options.map((o) => [o.id, o]));
    expect(map['blessing-remainder']!.cost).toBe(1);
    expect(map['blessing-remainder']!.description).toContain('三十两');
    expect(map['blessing-old-friend']!.cost).toBe(2);
    expect(map['blessing-old-shop']!.cost).toBe(2);
    expect(map['blessing-shiren']!.cost).toBe(3);
    expect(map['blessing-debt-free']!.cost).toBe(3);
    expect(map['blessing-craft']!.cost).toBe(3);
    expect(map['blessing-map']!.cost).toBe(3);
    expect(map['blessing-eye']!.cost).toBe(5);
  });
});

describe('applyAncestralBlessing · 点数扣减', () => {
  it('点数足够 → 扣点并记录', () => {
    const save: LegacyGrowthSave = { blessingPoints: 5, chosenBlessings: [], endings: {}, activeBlessings: [] };
    const res = applyAncestralBlessing(save, 'blessing-remainder');
    expect(res.ok).toBe(true);
    expect(res.save.blessingPoints).toBe(4);
    expect(res.save.chosenBlessings).toContain('blessing-remainder');
    expect(res.save.activeBlessings).toContain('blessing-remainder');
  });

  it('点数不足 → 拒绝', () => {
    const save: LegacyGrowthSave = { blessingPoints: 0, chosenBlessings: [], endings: {}, activeBlessings: [] };
    const res = applyAncestralBlessing(save, 'blessing-eye');
    expect(res.ok).toBe(false);
    expect(res.reason).toBe('传承点数不足');
  });

  it('重复选择 → 拒绝', () => {
    const save: LegacyGrowthSave = { blessingPoints: 5, chosenBlessings: ['blessing-eye'], endings: {}, activeBlessings: ['blessing-eye'] };
    const res = applyAncestralBlessing(save, 'blessing-eye');
    expect(res.ok).toBe(false);
    expect(res.reason).toBe('该传承本局已选');
  });

  it('传承不存在 → 拒绝', () => {
    const res = applyAncestralBlessing(emptyLegacyGrowthSave(), 'blessing-nope');
    expect(res.ok).toBe(false);
  });
});

describe('独立存储 · 与主存档隔离', () => {
  it('save/load 往返一致（key = tang-legacy-growth）', () => {
    const storage = mockStorage();
    const save: LegacyGrowthSave = { blessingPoints: 7, chosenBlessings: ['blessing-eye'], endings: { 'shang-sheng': 1 }, activeBlessings: ['blessing-eye'] };
    saveLegacyGrowthSave(save, storage);
    expect(storage.store.has(LEGACY_GROWTH_STORAGE_KEY)).toBe(true);
    const loaded = loadLegacyGrowthSave(storage);
    expect(loaded).toEqual(save);
  });

  it('无存储/无数据 → 空档', () => {
    expect(loadLegacyGrowthSave(null)).toEqual(emptyLegacyGrowthSave());
    expect(loadLegacyGrowthSave(mockStorage())).toEqual(emptyLegacyGrowthSave());
  });

  it('损坏 JSON → 空档（不抛错）', () => {
    const storage = mockStorage();
    storage.store.set(LEGACY_GROWTH_STORAGE_KEY, '{bad json');
    expect(loadLegacyGrowthSave(storage)).toEqual(emptyLegacyGrowthSave());
  });

  it('删档（清除主存档键）不影响局外成长：独立键互不干扰', () => {
    const storage = mockStorage();
    saveLegacyGrowthSave({ blessingPoints: 3, chosenBlessings: [], endings: {}, activeBlessings: [] }, storage);
    // 模拟删除主存档（tang-manager-store），局外成长仍在
    storage.store.delete('tang-manager-store');
    expect(loadLegacyGrowthSave(storage).blessingPoints).toBe(3);
  });

  it('ANCESTRAL_BLESSING_MAP 索引完整', () => {
    for (const b of ANCESTRAL_BLESSINGS) {
      expect(ANCESTRAL_BLESSING_MAP[b.id]).toBe(b);
    }
  });
});
