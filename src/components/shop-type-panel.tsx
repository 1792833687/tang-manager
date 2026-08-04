/**
 * 店型阶段（shop-type）面板
 * 阿昭引导语 → 三张横向店型卡片（酒楼🍶竹青 / 布庄🧵檀木 / 药铺🌿朱砂）
 * → 点击选中高亮 → 确认按钮 → setShopType + setPhase('difficulty')。
 */
'use client';
import { useState } from 'react';
import { getShopType } from '@/config/tang-shop-types';
import { AZHAO_SHOP_TYPE_LINE } from '@/config/tang-narrative';
import { withBase } from '@/lib/utils/base-path';
import { useTangManagerStore } from '@/stores/tang-manager';
import { ANCIENT, ANCIENT_ASSETS } from '@/theme/tokens';
import type { ShopType } from '@/types/tang-manager';
import { AncientCard } from './ancient-card';

const SHOP_ORDER: readonly ShopType[] = ['jiulou', 'buzhuang', 'yaopu'];

export function ShopTypePanel(): React.ReactElement {
  const setShopType = useTangManagerStore((s) => s.setShopType);
  const setPhase = useTangManagerStore((s) => s.setPhase);
  const [selected, setSelected] = useState<ShopType | null>(null);

  const handleConfirm = (): void => {
    if (selected === null) {
      return;
    }
    setShopType(selected);
    setPhase('difficulty');
  };

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
      {/* 阿昭引导语 */}
      <div
        className="rounded-xl px-6 py-4"
        style={{
          backgroundColor: ANCIENT.primary,
          color: '#FFFFFF',
          border: `2px solid ${ANCIENT.border}`,
        }}
      >
        <p className="text-base tracking-widest">
          <span className="mr-2">阿昭：</span>
          {AZHAO_SHOP_TYPE_LINE}
        </p>
      </div>

      {/* 三张店型卡片 */}
      <div className="grid gap-4 sm:grid-cols-3">
        {SHOP_ORDER.map((shopId) => {
          const shop = getShopType(shopId);
          const isSelected = selected === shopId;
          return (
            <button
              key={shopId}
              type="button"
              onClick={() => setSelected(shopId)}
              className="flex flex-col items-center gap-3 rounded-xl px-4 py-6 text-center transition-transform hover:-translate-y-1"
              style={{
                backgroundColor: ANCIENT.card,
                border: isSelected ? `3px solid ${shop.color}` : `2px solid ${shop.color}`,
                boxShadow: isSelected ? `0 0 0 1px ${ANCIENT.gold} inset, 0 8px 18px rgba(60,40,20,0.14)` : undefined,
                opacity: selected !== null && !isSelected ? 0.65 : 1,
              }}
            >
              <span className="text-4xl">{shop.icon}</span>
              <span className="text-xl font-bold tracking-[0.3em]" style={{ color: shop.color }}>
                {shop.name}
              </span>
              <span className="text-sm leading-relaxed" style={{ color: ANCIENT.secondary }}>
                {shop.description}
              </span>
              {isSelected && (
                <span className="mt-1 text-sm font-bold tracking-widest" style={{ color: shop.color }}>
                  ✓ 已选中
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* 确认按钮 */}
      <div className="flex justify-end">
        <button
          type="button"
          onClick={handleConfirm}
          disabled={selected === null}
          className="w-full min-h-11 rounded-lg px-10 py-3 text-base font-bold tracking-[0.4em] transition-transform active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-40 md:w-auto"
          style={{
            backgroundColor: ANCIENT.primary,
            color: '#FFFFFF',
            backgroundImage: `url(${withBase(ANCIENT_ASSETS.btnBg)})`,
            backgroundSize: 'cover',
          }}
        >
          确认
        </button>
      </div>
    </div>
  );
}
