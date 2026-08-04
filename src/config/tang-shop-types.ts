/**
 * 《我在唐朝当掌柜》店型配置 — 唯一事实源
 * 三种店型：jiulou 酒楼（竹青）/ buzhuang 布庄（檀木）/ yaopu 药铺（朱砂）。
 */
import type { ShopType, TangShopTypeConfig } from '@/types/tang-manager';
import { ANCIENT } from '@/theme/tokens';

export const SHOP_TYPES: Record<ShopType, TangShopTypeConfig> = {
  jiulou: {
    id: 'jiulou',
    name: '酒楼',
    description: '客单稳定，靠翻桌率。单客2-8两。',
    icon: '🍶',
    borderToken: 'primary',
    color: ANCIENT.primary,
  },
  buzhuang: {
    id: 'buzhuang',
    name: '布庄',
    description: '客单价高，波动大。单客3-15两。',
    icon: '🧵',
    borderToken: 'secondary',
    color: ANCIENT.secondary,
  },
  yaopu: {
    id: 'yaopu',
    name: '药铺',
    description: '客单价低，每客必消费。单客1-6两。',
    icon: '🌿',
    borderToken: 'accent',
    color: ANCIENT.accent,
  },
};

/** 兜底店型（理论上不可达） */
const FALLBACK_SHOP: ShopType = 'jiulou';

/** 安全取店型配置 */
export function getShopType(s: ShopType): TangShopTypeConfig {
  const cfg = SHOP_TYPES[s];
  if (cfg) {
    return cfg;
  }
  return SHOP_TYPES[FALLBACK_SHOP]!;
}

/** 店铺名映射：陆记 + 店型中文名（如「陆记酒楼」） */
export function shopDisplayName(s: ShopType): string {
  return `陆记${getShopType(s).name}`;
}
