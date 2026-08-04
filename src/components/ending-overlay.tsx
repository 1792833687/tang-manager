/**
 * 多结局弹窗（Step 5b-5 模块五；ending-overlay）
 * 归途："归途：商海浮沉终有尽头。或富甲一方，或权倾朝野，或归隐田园——你的选择，决定你的归途。"
 * 全屏古风画卷：结局标题（书法体大字）+ 旁白描述 2-3 段 + 数据回顾
 * （天数/总收益/最高评分/员工/势力）+「复制结局」+「再开一局」（resetGame 保留成就与局外记录，注释）。
 * 触发后暂停 + 弹窗：可继续（一代商圣/皇商之路/商界教父，forceEnd=false）或强制结束
 * （家道中落/权倾朝野/归隐田园/无人问津，forceEnd=true；用户 5.3 逐字）。
 * store.endingTriggered 非空时渲染（portal），page.tsx 零触碰。
 */
'use client';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTangManagerStore } from '@/stores/tang-manager';
import { ANCIENT } from '@/theme/tokens';
import { endingById } from '@/systems/tang-endings';
import { formatMoney } from '@/lib/format-money';
import { DangerConfirm } from './danger-confirm';

/** 复制结局文案（浏览器 Clipboard API；失败静默） */
async function copyEndingText(text: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    /* 剪贴板不可用则静默 */
  }
}

export function EndingOverlay(): React.ReactElement | null {
  const endingId = useTangManagerStore((s) => s.endingTriggered);
  const continueEnding = useTangManagerStore((s) => s.continueEnding);
  const resetGame = useTangManagerStore((s) => s.resetGame);
  const day = useTangManagerStore((s) => s.day);
  const totalNetProfit = useTangManagerStore((s) => s.totalNetProfit);
  const score = useTangManagerStore((s) => s.score);
  const employees = useTangManagerStore((s) => s.employees ?? []);
  const factions = useTangManagerStore((s) => s.factions ?? []);
  const [copied, setCopied] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);

  const def = endingId ? endingById(endingId) : null;

  // 每次新结局重置复制提示
  useEffect(() => {
    setCopied(false);
  }, [endingId]);

  if (!endingId || !def) {
    return null;
  }

  const review = [
    `历时 ${day} 日`,
    `累计净收益 ${formatMoney(totalNetProfit)}`,
    `最高评分 ${score.toFixed(1)}`,
    `员工 ${employees.length} 人`,
    `六派系均势 ${factions.map((f) => f.name).join('、')}`,
  ].join(' · ');

  const copyText = `【${def.title}】${def.subtitle}\n${def.paragraphs.join('\n')}\n——${review}`;

  return createPortal(
    <div className="fixed inset-0 z-[120] flex items-center justify-center overflow-y-auto bg-black/60 p-4">
      {/* 古风画卷：米白卷轴 + 描金内框 */}
      <div
        className="relative w-full max-w-xl rounded-xl px-6 py-8 text-center sm:px-10"
        style={{
          backgroundColor: '#FBF4E6',
          border: `2px solid ${ANCIENT.border}`,
          boxShadow: `0 0 0 1px ${ANCIENT.gold} inset, 0 24px 48px rgba(0,0,0,0.5)`,
        }}
      >
        {/* 卷轴上下轴 */}
        <div className="absolute inset-x-6 top-2 h-1.5 rounded" style={{ backgroundColor: ANCIENT.gold }} />
        <div className="absolute inset-x-6 bottom-2 h-1.5 rounded" style={{ backgroundColor: ANCIENT.gold }} />

        <p className="text-xs tracking-[0.5em]" style={{ color: ANCIENT.secondary }}>
          归途 · {def.category === 'hidden' ? '隐局' : '终局'}
        </p>
        {/* 结局标题（书法体大字） */}
        <h2
          className="mt-2 text-4xl font-bold tracking-[0.3em] sm:text-5xl"
          style={{ color: ANCIENT.text, fontFamily: 'var(--font-ancient-serif)' }}
        >
          {def.title}
        </h2>
        <p className="mt-1 text-sm tracking-[0.35em]" style={{ color: ANCIENT.accent }}>
          {def.subtitle}
        </p>
        <div className="mx-auto my-4 flex items-center justify-center gap-3">
          <span style={{ height: 1, width: 48, backgroundColor: ANCIENT.gold }} />
          <span style={{ color: ANCIENT.gold }}>◆</span>
          <span style={{ height: 1, width: 48, backgroundColor: ANCIENT.gold }} />
        </div>

        {/* 旁白描述 2-3 段 */}
        <div className="space-y-3 text-left">
          {def.paragraphs.map((p, i) => (
            <p key={i} className="text-sm leading-relaxed tracking-wider" style={{ color: ANCIENT.text }}>
              {p}
            </p>
          ))}
        </div>

        {/* 数据回顾 */}
        <div className="mt-4 rounded-lg px-3 py-2 text-[11px] tracking-wider" style={{ backgroundColor: ANCIENT.background, color: ANCIENT.secondary, border: `1px solid ${ANCIENT.border}` }}>
          {review}
        </div>

        {/* 操作 */}
        <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
          <button
            type="button"
            onClick={() => {
              void copyEndingText(copyText);
              setCopied(true);
            }}
            className="rounded px-4 py-1.5 text-xs tracking-[0.3em]"
            style={{ backgroundColor: ANCIENT.background, color: ANCIENT.text, border: `1px solid ${ANCIENT.border}` }}
          >
            {copied ? '已复制' : '复制结局'}
          </button>
          {!def.forceEnd && (
            <button
              type="button"
              onClick={() => continueEnding()}
              className="rounded px-4 py-1.5 text-xs tracking-[0.3em]"
              style={{ backgroundColor: ANCIENT.primary, color: '#FFFFFF' }}
            >
              继续经营
            </button>
          )}
          <button
            type="button"
            onClick={() => setConfirmReset(true)}
            className="rounded px-4 py-1.5 text-xs tracking-[0.3em] text-white"
            style={{ backgroundColor: ANCIENT.accent }}
          >
            再开一局
          </button>
        </div>
        <p className="mt-3 text-[10px] tracking-widest" style={{ color: ANCIENT.secondary }}>
          再开一局将保留已解锁成就与局外成长记录（resetGame 扩展，注释）。
        </p>
      </div>

      {/* 再开一局二次确认（朱砂红风险提示） */}
      {confirmReset && (
        <DangerConfirm
          title="再开一局"
          risk="将结束本局经营，重新从家传手札开始。已解锁成就与局外成长记录会保留，但本局进度（银两/店铺/员工/势力）全部清零，不可撤销。"
          confirmLabel="放弃本局，再开一局"
          onConfirm={() => resetGame()}
          onClose={() => setConfirmReset(false)}
        />
      )}
    </div>,
    document.body
  );
}
