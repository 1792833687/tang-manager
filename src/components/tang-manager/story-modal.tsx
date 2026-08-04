/**
 * 事件/接待故事弹窗（模块四 4.1）
 * 半透明遮罩（bg-black/50）+ 中央卷轴卡：标题（大字）+ 叙事正文（旁白 3-5 句，打字机显示）
 * + NPC 台词（引号包裹）+ 数值变动（底部小字）+「知道了」。
 * 自读 store.storyNarrative；关闭调用 dismissStoryNarrative。全部 ANCIENT 令牌。
 */
'use client';
import { useEffect, useRef, useState } from 'react';
import { useTangManagerStore } from '@/stores/tang-manager';
import { ANCIENT } from '@/theme/tokens';
import type { StoryNarrative } from '@/types/tang-dialogue';

/** 打字机逐字显示（30ms/字；模块五 5.2） */
function useTypewriter(text: string, speed = 30): string {
  const [out, setOut] = useState('');
  const idx = useRef(0);
  useEffect(() => {
    idx.current = 0;
    setOut('');
    const timer = window.setInterval(() => {
      idx.current += 1;
      setOut(text.slice(0, idx.current));
      if (idx.current >= text.length) window.clearInterval(timer);
    }, speed);
    return () => window.clearInterval(timer);
  }, [text, speed]);
  return out;
}

export function StoryModal(): React.ReactElement | null {
  const narrative = useTangManagerStore((s) => s.storyNarrative);
  const dismiss = useTangManagerStore((s) => s.dismissStoryNarrative);
  const body = useTypewriter(narrative?.body ?? '');
  if (!narrative) return null;
  return (
    <div
      className="fixed inset-0 z-[95] flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.5)', animation: 'fade-in 0.2s ease-out' }}
      onClick={dismiss}
    >
      <div
        className="w-full max-w-lg overflow-hidden rounded-2xl px-8 py-10 shadow-xl"
        style={{
          backgroundColor: ANCIENT.card,
          border: `2px solid ${ANCIENT.border}`,
          boxShadow: `0 0 0 1px ${ANCIENT.gold} inset, 0 24px 48px rgba(60,40,20,0.25)`,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-center text-2xl font-bold tracking-[0.3em]" style={{ color: ANCIENT.text }}>
          {narrative.title}
        </h2>
        <div className="mx-auto mt-3 flex items-center justify-center gap-2">
          <span style={{ height: 1, width: 48, backgroundColor: ANCIENT.gold }} />
          <span style={{ color: ANCIENT.gold, fontSize: 14 }}>◆</span>
          <span style={{ height: 1, width: 48, backgroundColor: ANCIENT.gold }} />
        </div>
        <p className="mt-5 text-sm leading-7 tracking-wide" style={{ color: ANCIENT.text }}>
          {body}
        </p>
        {narrative.npcLine && (
          <p className="mt-4 rounded-lg px-4 py-3 text-sm italic leading-6" style={{ backgroundColor: ANCIENT.background, color: ANCIENT.secondary, border: `1px solid ${ANCIENT.border}` }}>
            {narrative.npcLine}
          </p>
        )}
        {narrative.source === 'ai' && (
          <p className="mt-3 text-right text-[10px] tracking-[0.3em] opacity-40" style={{ color: ANCIENT.gold }}>——天机所拟</p>
        )}
        {narrative.numbers.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
            {narrative.numbers.map((n, i) => (
              <span key={i} className="rounded px-2 py-1 text-xs" style={{ backgroundColor: ANCIENT.background, color: ANCIENT.secondary, border: `1px solid ${ANCIENT.border}` }}>
                {n}
              </span>
            ))}
          </div>
        )}
        <div className="mt-6 flex justify-end">
          <button
            type="button"
            onClick={dismiss}
            className="min-h-11 rounded-lg px-8 py-2 text-sm font-bold tracking-[0.3em] transition-transform active:scale-[0.97]"
            style={{ backgroundColor: ANCIENT.gold, color: '#FFFFFF' }}
          >
            知道了
          </button>
        </div>
      </div>
    </div>
  );
}
