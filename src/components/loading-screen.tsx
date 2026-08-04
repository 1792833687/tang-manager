/**
 * 初始加载画面 — 《我在唐朝当掌柜》
 * - 游戏挂载（mounted 门闩）期间全屏展示，9 张长安场景随机选一；
 * - 深色半透明蒙版保证中央文字可读；
 * - 「长安万里，始于足下...」逐字淡入；
 * - 页面就绪后（visible=false）1 秒淡出并卸载；
 * - 加载图缺失自动降级为同名 SVG 占位，再失败走纯色底（不破图）。
 */
'use client';
import { useEffect, useState } from 'react';
import { ANCIENT } from '@/theme/tokens';
import { withBase } from '@/lib/utils/base-path';

/** 9 张加载图路径（与 /public/images/loading/loading-XX.webp 对应） */
const LOADING_IMAGES: readonly string[] = Array.from(
  { length: 9 },
  (_, i) => withBase(`/images/loading/loading-${String(i + 1).padStart(2, '0')}.webp`),
);
/** SVG 占位兜底（存在同目录同名 .svg） */
const FALLBACK_SVG = withBase('/images/loading/loading-01.svg');
/** 逐字淡入口号 */
const SLOGAN = '长安万里，始于足下...';

interface LoadingScreenProps {
  /** false → 淡出（1s）后卸载 */
  visible: boolean;
}

export function LoadingScreen({ visible }: LoadingScreenProps): React.ReactElement | null {
  // 客户端挂载后再随机选图，避免 SSR/hydration 闪烁
  const [imgSrc, setImgSrc] = useState<string>(LOADING_IMAGES[0]!);
  const [imgFailed, setImgFailed] = useState(false);
  const [gone, setGone] = useState(false);

  useEffect(() => {
    // noUncheckedIndexedAccess：随机下标可能越界 → ?? 兜底第一张
    const pick = LOADING_IMAGES[Math.floor(Math.random() * LOADING_IMAGES.length)];
    setImgSrc(pick ?? LOADING_IMAGES[0]!);
  }, []);

  // 页面就绪 → 淡出 1s 后卸载
  useEffect(() => {
    if (!visible) {
      const t = window.setTimeout(() => setGone(true), 1000);
      return () => window.clearTimeout(t);
    }
    return undefined;
  }, [visible]);

  if (gone) {
    return null;
  }

  const shown = imgFailed ? FALLBACK_SVG : imgSrc;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center overflow-hidden"
      style={{
        backgroundColor: '#221D18',
        opacity: visible ? 1 : 0,
        transition: 'opacity 1000ms ease',
      }}
      aria-label="游戏加载中"
      role="status"
    >
      {/* 背景图：覆盖全屏，防变形 */}
      <img
        src={shown}
        alt="长安城景"
        className="absolute inset-0 h-full w-full"
        style={{ objectFit: 'cover' }}
        onError={() => setImgFailed(true)}
      />
      {/* 深色半透明蒙版（保证文字可读） */}
      <div
        className="absolute inset-0"
        style={{ background: 'linear-gradient(180deg, rgba(20,16,12,0.42) 0%, rgba(20,16,12,0.55) 50%, rgba(20,16,12,0.78) 100%)' }}
      />

      {/* 中央加载文字：逐字淡入 */}
      <div className="relative z-10 flex flex-col items-center gap-6 px-6 text-center">
        <p
          className="text-sm tracking-[0.6em]"
          style={{ color: 'rgba(212,168,67,0.9)', fontFamily: 'var(--font-ancient-serif)' }}
        >
          陆记 · 开张准备中
        </p>
        <h1
          className="text-2xl leading-relaxed sm:text-3xl"
          style={{ color: ANCIENT.card, fontFamily: 'var(--font-ancient-serif)', letterSpacing: '0.35em' }}
        >
          {SLOGAN.split('').map((ch, i) => (
            <span
              key={`${ch}-${i}`}
              className="inline-block"
              style={{ opacity: 0, animation: `slogan-fade-in 0.7s ${i * 0.12}s ease-out forwards` }}
            >
              {ch}
            </span>
          ))}
        </h1>
        <p
          className="text-xs tracking-[0.5em]"
          style={{ color: 'rgba(245,240,232,0.6)', fontFamily: 'var(--font-ancient-serif)' }}
        >
          ◆
        </p>
      </div>

      {/* 逐字淡入 keyframes（组件自包含，不依赖全局样式） */}
      <style>{`
        @keyframes slogan-fade-in {
          from { opacity: 0; transform: translateY(6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
