/**
 * 《我在唐朝当掌柜》店铺资产配置系统（2026-08-05 体验优化）
 * 购置物品配置店铺：一次性属性 + 常驻修饰（气氛/满意度/评分）。
 * effect.modifier 为常驻修饰：atmosphere（接待气氛加成）/ satisfaction（接待满意度加成）。
 */
export interface ShopAssetEffect {
  reputation?: number;
  score?: number;
  atmosphere?: number;
  /** 常驻修饰：atmosphere / satisfaction（接待时叠加） */
  modifier?: { type: 'atmosphere' | 'satisfaction'; value: number };
}

export interface ShopAsset {
  id: string;
  name: string;
  desc: string;
  price: number;
  effect: ShopAssetEffect;
  /** 功能说明（特性文案） */
  feature?: string;
}

export const SHOP_ASSETS: ShopAsset[] = [
  { id: 'asset-sign', name: '描金招牌', desc: '烫金大字的门面招牌，往门口一挂，整条街都认得你。', price: 120, effect: { reputation: 10, modifier: { type: 'atmosphere', value: 2 } }, feature: '声望 +10，店内气氛 +2' },
  { id: 'asset-lantern', name: '古风灯笼', desc: '檐下两盏描花宫灯，入夜亮起，客人路过都要多看一眼。', price: 80, effect: { modifier: { type: 'atmosphere', value: 5 } }, feature: '店内气氛 +5（常驻）' },
  { id: 'asset-counter', name: '檀木柜台', desc: '一水儿檀木柜台，油亮得能照见人影。', price: 200, effect: { score: 0.05, modifier: { type: 'satisfaction', value: 3 } }, feature: '评分 +0.05，接待满意度 +3' },
  { id: 'asset-stove', name: '精铸铁灶', desc: '厨下新换的铁灶，火旺油热，菜色也提了三分。', price: 150, effect: { modifier: { type: 'satisfaction', value: 5 } }, feature: '接待满意度 +5（酒楼更佳）' },
  { id: 'asset-loom', name: '新式织机', desc: '布庄添了一台新织机，织出来的料子更密实。', price: 150, effect: { modifier: { type: 'satisfaction', value: 5 } }, feature: '接待满意度 +5（布庄更佳）' },
  { id: 'asset-cabinet', name: '百格药柜', desc: '一排百格药柜，药材分门别类，取用便当。', price: 150, effect: { modifier: { type: 'satisfaction', value: 5 } }, feature: '接待满意度 +5（药铺更佳）' },
  { id: 'asset-teahouse', name: '雅间小筑', desc: '后院隔出一间雅间，招待贵客更有体面。', price: 300, effect: { score: 0.05, modifier: { type: 'satisfaction', value: 8 } }, feature: '评分 +0.05，接待满意度 +8' },
  { id: 'asset-flag', name: '杏黄酒旗', desc: '门口挑一杆杏黄酒旗，风一吹，远近都看得见。', price: 60, effect: { reputation: 5 }, feature: '声望 +5' },
];

export function shopAssetById(id: string): ShopAsset | undefined {
  return SHOP_ASSETS.find((a) => a.id === id);
}

/** 已购资产的常驻修饰汇总（纯函数；buildReceptionPatch 接入） */
export function shopAssetModifiers(owned: readonly string[]): { atmosphere: number; satisfaction: number } {
  let atmosphere = 0;
  let satisfaction = 0;
  for (const id of owned) {
    const a = shopAssetById(id);
    if (a?.effect.modifier) {
      if (a.effect.modifier.type === 'atmosphere') atmosphere += a.effect.modifier.value;
      if (a.effect.modifier.type === 'satisfaction') satisfaction += a.effect.modifier.value;
    }
  }
  return { atmosphere, satisfaction };
}
