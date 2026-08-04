/**
 * 唐风图片组件 — 防破图兜底
 * 优先加载正式光栅资源（webp/png）；失败自动降级到同名 SVG 占位；
 * SVG 再失败 → 渐变占位块（绝不显示破图图标）。
 * 统一 object-fit: cover，防止变形。
 */
'use client';
import { useState, type CSSProperties } from 'react';

interface TangImageProps {
  /** 正式资源路径（/images/...webp 或 .png） */
  src: string;
  /** 降级 SVG 占位路径（不存在时省略，直接走渐变块） */
  fallbackSrc?: string;
  /** 中文 alt 文本 */
  alt: string;
  className?: string;
  style?: CSSProperties;
  /** 默认 cover 防变形 */
  fit?: 'cover' | 'contain';
  /** 懒加载（背景装饰默认 true；首屏关键图可关） */
  lazy?: boolean;
}

export function TangImage({
  src,
  fallbackSrc,
  alt,
  className = '',
  style,
  fit = 'cover',
  lazy = true,
}: TangImageProps): React.ReactElement {
  const [current, setCurrent] = useState(src);
  const [failed, setFailed] = useState(false);

  if (failed) {
    // 全部失败 → 渐变占位块（宣纸→檀木），中央古籍符号
    return (
      <div
        className={className}
        role="img"
        aria-label={alt}
        style={{
          ...style,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(150deg, #FDF6F0 0%, #EAD9BE 55%, #C9A86A 100%)',
        }}
      >
        <span
          aria-hidden
          style={{
            color: 'rgba(60,40,20,0.45)',
            fontFamily: "'Noto Serif SC','Songti SC',serif",
            fontSize: 22,
            letterSpacing: '0.5em',
          }}
        >
          卷
        </span>
      </div>
    );
  }

  return (
    <img
      src={current}
      alt={alt}
      loading={lazy ? 'lazy' : undefined}
      decoding="async"
      className={className}
      style={{ ...style, objectFit: fit }}
      onError={() => {
        if (fallbackSrc && current !== fallbackSrc) {
          setCurrent(fallbackSrc);
        } else {
          setFailed(true);
        }
      }}
    />
  );
}
