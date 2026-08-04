/**
 * 体验优化接线测试（2026-08-05）
 * - 布店/药铺客人需求描述按店型（修"布店客人点菜"）
 * - 店铺资产购置与常驻修饰
 */
import { describe, expect, it } from 'vitest';
import { GUEST_DESC_TEMPLATES } from '@/config/tang-guest-content';
import { SHOP_ASSETS, shopAssetModifiers } from '@/config/tang-shop-assets';
import { generateDailyGuests } from '@/systems/tang-guest-generator';

function rngSeq(seq: number[]): () => number { let i = 0; return () => seq[i++ % seq.length]!; }

describe('需求描述按店型（P0 修复）', () => {
  it('布庄描述不含饮食词；药铺描述含症状关键词', () => {
    const cloth = GUEST_DESC_TEMPLATES.buzhuang.normal.join('');
    expect(cloth).not.toMatch(/菜|酒|热茶|席面/);
    expect(cloth).toMatch(/布|料|衣/);
    const med = GUEST_DESC_TEMPLATES.yaopu.normal.join('');
    expect(med).toMatch(/失眠|咳|虚|药/);
  });
  it('generateDailyGuests 按店型生成描述（布庄客人不会点菜）', () => {
    const guests = generateDailyGuests('buzhuang', 'B', 1, rngSeq([0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1]));
    expect(guests.length).toBeGreaterThan(0);
    for (const g of guests) {
      expect(g.description).not.toMatch(/菜|酒|热茶|席面|点单/);
    }
  });
});

describe('店铺资产系统', () => {
  it('资产配置完整（id 唯一、价格>0、有效果）', () => {
    const ids = new Set(SHOP_ASSETS.map((a) => a.id));
    expect(ids.size).toBe(SHOP_ASSETS.length);
    for (const a of SHOP_ASSETS) {
      expect(a.price).toBeGreaterThan(0);
      expect(a.effect).toBeDefined();
    }
  });
  it('shopAssetModifiers：按已购资产汇总常驻气氛/满意度', () => {
    const mods = shopAssetModifiers(['asset-lantern', 'asset-counter', 'asset-stove']);
    expect(mods.atmosphere).toBe(5); // 灯笼 +5
    expect(mods.satisfaction).toBe(3 + 5); // 柜台 +3 + 铁灶 +5
  });
});

describe('store 接线（消息/资产）', () => {
  it('addMessage/dismissMessage 可用', async () => {
    const { useTangManagerStore } = await import('@/stores/tang-manager');
    useTangManagerStore.getState().resetGame();
    useTangManagerStore.getState().addMessage({ id: 'm1', from: '谢七', type: 'errand', content: '来赌一把', createdDay: 1 });
    expect(useTangManagerStore.getState().messages.some((m) => m.id === 'm1')).toBe(true);
    useTangManagerStore.getState().dismissMessage('m1');
    expect(useTangManagerStore.getState().messages.some((m) => m.id === 'm1')).toBe(false);
  });
  it('purchaseShopAsset：足额购置成功并应用声望；重复购置拒绝', async () => {
    const { useTangManagerStore } = await import('@/stores/tang-manager');
    const st = useTangManagerStore.getState();
    st.initByDifficulty('B');
    useTangManagerStore.setState({ silver: 500, gold: 500 });
    const res = useTangManagerStore.getState().purchaseShopAsset('asset-sign'); // 120 两，声望+10
    expect(res.ok).toBe(true);
    const after = useTangManagerStore.getState();
    expect(after.shopAssets).toContain('asset-sign');
    expect(after.silver).toBe(380);
    expect(after.reputation).toBeGreaterThanOrEqual(10 + 10);
    expect(useTangManagerStore.getState().purchaseShopAsset('asset-sign').ok).toBe(false); // 重复
    expect(useTangManagerStore.getState().purchaseShopAsset('asset-teahouse').ok).toBe(true); // 300 两 还有
  });
});
