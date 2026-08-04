/**
 * 导航统一图标集合（体验优化 · 模块三导航紧凑化）
 * 8 项水墨线描 SVG：我/账本/货架/伙计/接待/成就（新建）+ 钱庄（复用 CoinIcon）+
 * 长安舆图（复用 MapIcon）。支持 size 与 color（选中态由父级传白色）。
 * 供 nav-sidebar（56px 仅图标）与 mobile-bottom-tab（48px 图标+2字）复用。
 */
'use client';
import { CoinIcon } from './coin-icon';
import { MapIcon } from './map-icon';

export type NavIconKey = 'me' | 'ledger' | 'shelf' | 'staff' | 'reception' | 'achievement' | 'bank' | 'map' | 'faction' | 'journal' | 'politics' | 'caravan' | 'shop';

interface StrokeIconProps {
  size?: number;
  color?: string;
}

/** 我（人物剪影） */
function MeIcon({ size = 22, color = '#8B6F47' }: StrokeIconProps): React.ReactElement {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="12" cy="7.5" r="3.2" />
      <path d="M5 19c0-3.3 3.1-5.5 7-5.5s7 2.2 7 5.5" />
    </svg>
  );
}

/** 账本（卷册 + 记账横线） */
function LedgerIcon({ size = 22, color = '#8B6F47' }: StrokeIconProps): React.ReactElement {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="5" y="3.5" width="14" height="17" rx="1.5" />
      <line x1="8.5" y1="7.5" x2="15.5" y2="7.5" />
      <line x1="8.5" y1="11" x2="15.5" y2="11" />
      <line x1="8.5" y1="14.5" x2="13" y2="14.5" />
    </svg>
  );
}

/** 货架（三层搁板 + 陈列物） */
function ShelfIcon({ size = 22, color = '#8B6F47' }: StrokeIconProps): React.ReactElement {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M4 6.5h16M4 12h16M4 17.5h16" />
      <path d="M7 6.5v11M11 6.5v11M15 6.5v11" opacity="0.55" />
      <circle cx="8" cy="14.8" r="1.1" fill={color} stroke="none" />
      <rect x="12" y="14" width="2.6" height="1.6" fill={color} stroke="none" />
      <circle cx="17.2" cy="14.8" r="1.1" fill={color} stroke="none" />
    </svg>
  );
}

/** 伙计（戴帽人物） */
function StaffIcon({ size = 22, color = '#8B6F47' }: StrokeIconProps): React.ReactElement {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="12" cy="7.6" r="3" />
      <path d="M6.5 19.5c0-3.4 2.5-5.6 5.5-5.6s5.5 2.2 5.5 5.6" />
      <path d="M8.4 7.6c.2-1 1.6-1.7 3.6-1.7s3.4.7 3.6 1.7" />
    </svg>
  );
}

/** 接待（茶盏 + 热气） */
function ReceptionIcon({ size = 22, color = '#8B6F47' }: StrokeIconProps): React.ReactElement {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M7 10h10l-.8 7.6a2 2 0 0 1-2 1.9H9.8a2 2 0 0 1-2-1.9L7 10z" />
      <path d="M17 11h1.1a1.7 1.7 0 0 1 0 3.4h-2" />
      <path d="M10.5 6.4c.5-.7.5-1.3 0-2M14.5 6.4c.5-.7.5-1.3 0-2" />
    </svg>
  );
}

/** 成就（功业印章） */
function AchievementIcon({ size = 22, color = '#8B6F47' }: StrokeIconProps): React.ReactElement {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="12" cy="12" r="7.5" />
      <path d="M9.3 12.4l2 2 3.4-4" />
      <path d="M12 4.5v1.8M12 17.7v1.8M4.5 12h1.8M17.7 12h1.8" />
    </svg>
  );
}

/** 门路（作揖小人：拱手行礼，代表「门路/世交」） */
function FactionIcon({ size = 22, color = '#8B6F47' }: StrokeIconProps): React.ReactElement {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {/* 头 */}
      <circle cx="12" cy="6" r="2.4" />
      {/* 身体 */}
      <path d="M6 19.5c.2-3.6 2.6-5.6 6-5.6s5.8 2 6 5.6" />
      {/* 作揖双手（拱手） */}
      <path d="M8.4 9.2l1.2 2.4 4.8 0 1.2-2.4" />
      <path d="M9.6 11.6l-.6 1.2M14.4 11.6l.6 1.2" opacity="0.7" />
    </svg>
  );
}

/** 手札录（书卷：卷册 + 系绳） */
function JournalIcon({ size = 22, color = '#8B6F47' }: StrokeIconProps): React.ReactElement {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {/* 摊开的书卷 */}
      <path d="M12 5.5c-1.5-1.2-3.6-1.6-6-1.4v13.8c2.4-.2 4.5.2 6 1.4 1.5-1.2 3.6-1.6 6-1.4V4.1c-2.4-.2-4.5.2-6 1.4z" />
      <path d="M12 5.5v13.8" />
    </svg>
  );
}

/** 巍明楼（楼阁：重檐 + 柱） */
function PoliticsIcon({ size = 22, color = '#8B6F47' }: StrokeIconProps): React.ReactElement {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {/* 重檐楼阁 */}
      <path d="M4 10.5h16L12 4.5l-8 6z" />
      <path d="M6.5 10.5v8M17.5 10.5v8M4 18.5h16" />
      <path d="M9.5 10.5v8M14.5 10.5v8" opacity="0.55" />
    </svg>
  );
}

/** 镖队（马车：车身 + 轮 + 旗） */
function CaravanIcon({ size = 22, color = '#8B6F47' }: StrokeIconProps): React.ReactElement {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {/* 车厢 */}
      <path d="M4 9.5h11l2.5 3v5H4v-8z" />
      <circle cx="7.5" cy="17.5" r="2" />
      <circle cx="15.5" cy="17.5" r="2" />
      {/* 镖旗 */}
      <path d="M15 6.5l3-1v4l-3-1" />
    </svg>
  );
}

/** 店铺管理（铺面 + 旗幌） */
function ShopIcon({ size = 22, color = '#8B6F47' }: StrokeIconProps): React.ReactElement {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M4 9.5l1-4h14l1 4" />
      <path d="M5 9.5v10h14v-10" />
      <path d="M9 19.5v-5h6v5" />
      <path d="M4 9.5h16" />
    </svg>
  );
}

/** 统一导航图标入口（按 iconKey 分发） */
export function NavIcon({
  iconKey,
  size = 22,
  color = '#8B6F47',
}: {
  iconKey: NavIconKey;
  size?: number;
  color?: string;
}): React.ReactElement {
  switch (iconKey) {
    case 'bank':
      return <CoinIcon size={size} color={color} />;
    case 'map':
      return <MapIcon size={size} color={color} />;
    case 'faction':
      return <FactionIcon size={size} color={color} />;
    case 'journal':
      return <JournalIcon size={size} color={color} />;
    case 'politics':
      return <PoliticsIcon size={size} color={color} />;
    case 'caravan':
      return <CaravanIcon size={size} color={color} />;
    case 'ledger':
      return <LedgerIcon size={size} color={color} />;
    case 'shelf':
      return <ShelfIcon size={size} color={color} />;
    case 'staff':
      return <StaffIcon size={size} color={color} />;
    case 'reception':
      return <ReceptionIcon size={size} color={color} />;
    case 'achievement':
      return <AchievementIcon size={size} color={color} />;
    case 'shop':
      return <ShopIcon size={size} color={color} />;
    case 'me':
    default:
      return <MeIcon size={size} color={color} />;
  }
}
