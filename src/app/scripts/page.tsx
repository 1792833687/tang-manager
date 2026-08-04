/**
 * 剧本选择中心（/scripts）— 《我在唐朝当掌柜》独立项目
 *
 * 源仓库 /scripts 原为「凛冬要塞 + 唐朝掌柜」双剧本入口，提取独立项目后
 * 仅保留唐朝掌柜一个入口（→ /，游戏首页）。工程决策：
 * - 保留 /scripts 简单入口页（任务书允许「保留简单入口页，只列唐朝掌柜」或并入首页；
 *   保留独立页便于未来扩展新剧本，成本极低）。
 * - 删除凛冬要塞卡片与 FROST 冷灰调引用。
 * 服务端组件：仅静态内容 + Link，可导出 metadata。
 */
import type { Metadata } from 'next';
import Link from 'next/link';
import { withBase } from '@/lib/utils/base-path';
import { ANCIENT } from '@/theme/tokens';

export const metadata: Metadata = {
  title: '择一剧 · 入一世',
  description: '选择你的剧本，进入属于你的世界',
};

/** 卷轴卡片：描金内框角饰（四角 L 形） */
function ScrollCorner({ color, flipX, flipY }: { color: string; flipX?: boolean; flipY?: boolean }): React.ReactElement {
  const base: React.CSSProperties = {
    position: 'absolute',
    width: 18,
    height: 18,
    borderColor: color,
    borderStyle: 'solid',
    borderWidth: 0,
    transform: `${flipX ? 'scaleX(-1)' : ''} ${flipY ? 'scaleY(-1)' : ''}`,
  };
  const corner: React.CSSProperties = {
    topLeft: { top: -3, left: -3, borderTopWidth: 2, borderLeftWidth: 2 },
    topRight: { top: -3, right: -3, borderTopWidth: 2, borderRightWidth: 2 },
    bottomLeft: { bottom: -3, left: -3, borderBottomWidth: 2, borderLeftWidth: 2 },
    bottomRight: { bottom: -3, right: -3, borderBottomWidth: 2, borderRightWidth: 2 },
  }[flipX && flipY ? 'bottomRight' : flipX ? 'topRight' : flipY ? 'bottomLeft' : 'topLeft'];
  return <span style={{ ...base, ...corner }} aria-hidden="true" />;
}

export default function ScriptsPage(): React.ReactElement {
  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      {/* 卷轴风格卡片 */}
      <section
        className="relative w-full max-w-2xl rounded-2xl px-8 py-10 shadow-xl sm:px-12"
        style={{
          backgroundColor: ANCIENT.card,
          // 场景图作底（烛下展卷）+ 宣纸渐变遮罩保证文字可读；图片缺失时 card 底色兜底
          backgroundImage: `linear-gradient(180deg, rgba(253,246,240,0.93) 0%, rgba(253,246,240,0.82) 45%, rgba(253,246,240,0.97) 100%), url(${withBase('/images/scenes/script-selection.webp')})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          border: `2px solid ${ANCIENT.border}`,
          boxShadow: `0 0 0 1px ${ANCIENT.gold} inset, 0 24px 48px rgba(60,40,20,0.18)`,
        }}
      >
        {/* 描金内框四角 */}
        <ScrollCorner color={ANCIENT.gold} />
        <ScrollCorner color={ANCIENT.gold} flipX />
        <ScrollCorner color={ANCIENT.gold} flipY />
        <ScrollCorner color={ANCIENT.gold} flipX flipY />

        {/* 标题 */}
        <header className="mb-8 text-center">
          <h1
            className="text-3xl font-bold tracking-[0.35em] sm:text-4xl"
            style={{ color: ANCIENT.text }}
          >
            择一剧 · 入一世
          </h1>
          <div className="mx-auto mt-4 flex items-center justify-center gap-3">
            <span style={{ height: 1, width: 56, backgroundColor: ANCIENT.gold }} />
            <span style={{ color: ANCIENT.gold, fontSize: 18 }}>◆</span>
            <span style={{ height: 1, width: 56, backgroundColor: ANCIENT.gold }} />
          </div>
          <p className="mt-3 text-sm tracking-widest" style={{ color: ANCIENT.secondary }}>
            一盏灯，一卷册，一方天地
          </p>
        </header>

        {/* 剧本选项 — 唐朝掌柜（独立项目唯一剧本） */}
        <div className="grid gap-5 sm:grid-cols-1">
          <Link
            href="/"
            className="group relative block rounded-xl p-5 transition-transform hover:-translate-y-1"
            style={{
              backgroundColor: ANCIENT.card,
              border: `2px solid ${ANCIENT.primary}`,
              color: ANCIENT.text,
            }}
          >
            <span
              className="absolute -right-2 -top-2 rotate-12 rounded px-2 py-0.5 text-xs font-bold tracking-widest shadow"
              style={{ backgroundColor: ANCIENT.accent, color: '#FFFFFF' }}
            >
              全新
            </span>
            <span className="text-3xl">🍶</span>
            <h2 className="mt-3 text-xl font-bold tracking-widest">我在唐朝当掌柜</h2>
            <p className="mt-2 text-sm leading-relaxed" style={{ color: ANCIENT.secondary }}>
              长安东市，一间铺面，一本手札。商海浮沉，从陆记起步。
            </p>
            <span
              className="mt-4 inline-block text-sm font-semibold tracking-widest transition-transform group-hover:translate-x-1"
              style={{ color: ANCIENT.primary }}
            >
              开张营业 →
            </span>
          </Link>
        </div>

        {/* 页脚注 */}
        <p className="mt-8 text-center text-xs tracking-widest" style={{ color: ANCIENT.secondary }}>
          《我在唐朝当掌柜》 · 剧本选择中心
        </p>
      </section>
    </main>
  );
}
