/**
 * 钱庄导航图标 — SVG 铜钱叠放（Step 5b：钱庄第 7 项导航专用）
 * 两枚方孔铜钱交叠，代表「钱庄」的存取与流通；颜色引用古风令牌。
 * 支持 size 与 color 覆盖（选中态由父级传白色）。
 */
'use client';

interface CoinIconProps {
  size?: number;
  /** 铜钱主体色（默认描金） */
  color?: string;
  /** 方孔内色（默认宣纸底） */
  holeColor?: string;
}

export function CoinIcon({
  size = 24,
  color = '#D4A843',
  holeColor = '#F5F0E8',
}: CoinIconProps): React.ReactElement {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
      role="img"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* 后枚铜钱（右上，略淡） */}
      <g opacity="0.55">
        <circle cx="15.2" cy="8.2" r="6" fill={color} fillOpacity="0.18" />
        <circle cx="15.2" cy="8.2" r="6" stroke={color} strokeWidth="1.4" />
        <rect x="12.9" y="5.9" width="4.6" height="4.6" fill={holeColor} stroke={color} strokeWidth="1.1" />
      </g>
      {/* 前枚铜钱（左下，主色） */}
      <circle cx="8.8" cy="15.8" r="6.4" fill={color} fillOpacity="0.18" />
      <circle cx="8.8" cy="15.8" r="6.4" stroke={color} strokeWidth="1.6" />
      <rect x="6.2" y="13.2" width="5.2" height="5.2" fill={holeColor} stroke={color} strokeWidth="1.2" />
      {/* 两枚之间小圆点（钱文惯例点缀） */}
      <circle cx="12.8" cy="12.8" r="1" fill={color} />
    </svg>
  );
}
