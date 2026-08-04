/**
 * 主控面板店型场景横幅
 * 按玩家选择的店型动态加载对应场景图（酒楼/布庄/药铺）：
 * - 图片带 fade-in 过渡；上方叠加宣纸渐变遮罩，保证文字可读；
 * - 图片缺失自动降级同名 SVG 占位 → 渐变块（不破图）。
 */
'use client';
import { getShopType, shopDisplayName } from '@/config/tang-shop-types';
import { withBase } from '@/lib/utils/base-path';
import { useTangManagerStore } from '@/stores/tang-manager';
import { ANCIENT } from '@/theme/tokens';
import type { ShopType } from '@/types/tang-manager';
import { TangImage } from './tang-image';

const SCENE_MAP: Record<ShopType, { file: string; sub: string }> = {
  jiulou: { file: 'tavern-interior', sub: '客单稳定 · 靠翻桌率' },
  buzhuang: { file: 'fabric-shop-interior', sub: '客单价高 · 波动大' },
  yaopu: { file: 'herb-shop-interior', sub: '客单价低 · 每客必消费' },
};

export function SceneBanner(): React.ReactElement | null {
  const shopType = useTangManagerStore((s) => s.shopType);
  if (shopType === null) {
    return null;
  }
  const cfg = SCENE_MAP[shopType];
  const shop = getShopType(shopType);

  return (
    <div
      className="relative h-32 w-full shrink-0 overflow-hidden rounded-xl md:h-44"
      style={{
        border: `1px solid ${ANCIENT.border}`,
        boxShadow: '0 6px 16px rgba(60,40,20,0.14)',
        backgroundColor: ANCIENT.card,
      }}
    >
      {/* 场景图：fade-in 由外层 animation 呈现（TangImage 自身无动画，避免换源闪烁） */}
      <TangImage
        src={withBase(`/images/scenes/${cfg.file}.webp`)}
        fallbackSrc={withBase(`/images/scenes/${cfg.file}.svg`)}
        alt={`${shopDisplayName(shopType)}场景`}
        className="absolute inset-0 h-full w-full"
        lazy={false}
      />
      {/* 宣纸渐变遮罩（下实上虚，保证底部文字可读） */}
      <div
        className="absolute inset-0"
        style={{
          background:
            'linear-gradient(180deg, rgba(245,240,232,0.04) 0%, rgba(245,240,232,0.28) 45%, rgba(245,240,232,0.94) 100%)',
        }}
      />
      {/* 文案层（fade-in） */}
      <div className="absolute inset-0" style={{ animation: 'tang-banner-in 0.9s ease-out' }}>
        <div className="absolute bottom-3 left-5">
          <p
            className="text-lg font-bold tracking-[0.35em] md:text-xl"
            style={{ color: ANCIENT.text, fontFamily: 'var(--font-ancient-serif)' }}
          >
            {shopDisplayName(shopType)}
          </p>
          <p className="mt-0.5 text-xs tracking-[0.25em]" style={{ color: ANCIENT.secondary }}>
            {cfg.sub}
          </p>
        </div>
        <span className="absolute bottom-3 right-5 text-2xl" aria-hidden>
          {shop.icon}
        </span>
      </div>
      <style>{`@keyframes tang-banner-in { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }`}</style>
    </div>
  );
}
