/**
 * 长安舆图导航图标（Step 5b-2 模块六）— 古地图卷轴水墨 SVG
 * 卷轴 + 简笔山水，供 nav-sidebar / mobile-bottom-tab 第 8 项使用。
 */
export function MapIcon({
  size = 24,
  color = '#8B6F47',
}: {
  size?: number;
  color?: string;
}): React.ReactElement {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {/* 卷轴 */}
      <rect x="4" y="3" width="16" height="18" rx="1.5" />
      <line x1="4" y1="7" x2="20" y2="7" />
      <line x1="4" y1="17" x2="20" y2="17" />
      {/* 简笔山水 */}
      <path d="M8 14.5l2.4-3 1.9 1.9 2.6-3.4" />
      <circle cx="15.5" cy="8.6" r="0.55" fill={color} stroke="none" />
    </svg>
  );
}
