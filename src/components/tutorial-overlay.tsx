/**
 * 家传手札弹窗（TANG-TUT-002 模块二；tutorial-overlay）
 * 甲方规格：
 * - 半透明深色遮罩（bg-black/50）；重要引导（welcome/first_guest/first_mind_read/
 *   first_preorder）不可点遮罩关闭，非重要可点遮罩关闭（dismiss，不标已读）。
 * - 中央卷轴卡：宣纸 #FDF6F0 + 竹青边框 #4A7C59 + 圆角 8px；上下卷轴轴杆
 *   （CSS 圆柱深檀 #8B5E3C 渐变立体）；顶部「家传手札」大字墨色居中；
 *   正文字号略大、行距 1.8、首字下沉大两号竹青；底部右对齐「——先祖手书」；
 *   「知道了」竹青居中。
 * - 弹出动画 scale 0.9→1.0 300ms ease-out；关闭 scale 1.0→0.9 + opacity 0 200ms。
 * - 内容取 T1 tangTutorialById(id)；「知道了」→ markTutorialRead(guideId)。
 * 铁律：文案不改（T1 已落库）；只处理 kind='handbook'（阿昭气泡由 a-zhao-reminder 呈现）。
 */
'use client';
import React, { useEffect, useRef, useState } from 'react';
import { tangTutorialById } from '@/config/tang-tutorial-content';
import { useTangManagerStore } from '@/stores/tang-manager';
import { isTutorialImportant } from '@/systems/tang-tutorial-triggers';
import { ANCIENT } from '@/theme/tokens';

/** 卷轴轴杆（上下各一；CSS 圆柱深檀渐变立体） */
function ScrollRod({ className = '' }: { className?: string }): React.ReactElement {
  return (
    <div
      aria-hidden
      className={className}
      style={{
        height: 10,
        borderRadius: 5,
        marginLeft: -6,
        marginRight: -6,
        background: 'linear-gradient(180deg, #B07848 0%, #8B5E3C 45%, #6B4428 100%)',
        boxShadow:
          'inset 0 1px 1px rgba(255,255,255,0.28), inset 0 -1px 1px rgba(0,0,0,0.32), 0 1px 2px rgba(60,40,20,0.35)',
      }}
    />
  );
}

export function TutorialOverlay(): React.ReactElement | null {
  const currentTutorial = useTangManagerStore((s) => s.currentTutorial);
  const markTutorialRead = useTangManagerStore((s) => s.markTutorialRead);
  const dismissTutorial = useTangManagerStore((s) => s.dismissTutorial);

  // 关闭动画门闩：closing=true 播放 200ms 后真正关闭；tutorial 变化时复位
  const [closing, setClosing] = useState(false);
  const [lastId, setLastId] = useState<string | null>(null);
  const closeTimerRef = useRef<number | null>(null);

  useEffect(() => {
    if (currentTutorial !== lastId) {
      setLastId(currentTutorial ?? null);
      setClosing(false);
    }
  }, [currentTutorial, lastId]);

  // 卸载清理定时器
  useEffect(() => {
    return () => {
      if (closeTimerRef.current !== null) window.clearTimeout(closeTimerRef.current);
    };
  }, []);

  const content = currentTutorial ? tangTutorialById(currentTutorial) : null;
  // 阿昭气泡不走手札弹窗（a-zhao-reminder 呈现）；未知 id 不渲染
  if (!currentTutorial || !content || content.kind !== 'handbook') return null;

  const important = isTutorialImportant(currentTutorial);

  /** 非重要引导：遮罩点击 = 关闭（dismiss，不标已读，可再次弹出） */
  const handleOverlayClick = (): void => {
    if (closing || important) return;
    setClosing(true);
    closeTimerRef.current = window.setTimeout(() => dismissTutorial(), 200);
  };

  /** 「知道了」：关闭并标记已读 */
  const handleKnow = (): void => {
    if (closing) return;
    setClosing(true);
    closeTimerRef.current = window.setTimeout(() => markTutorialRead(currentTutorial), 200);
  };

  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
      onClick={handleOverlayClick}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="家传手札"
        className="w-full max-w-md overflow-hidden"
        style={{
          backgroundColor: ANCIENT.card, // 宣纸 #FDF6F0
          border: `2px solid ${ANCIENT.primary}`, // 竹青 #4A7C59
          borderRadius: 8,
          boxShadow: `0 0 0 1px ${ANCIENT.gold} inset, 0 18px 44px rgba(20,12,6,0.45)`,
          animation: closing ? 'tutorial-close 0.2s ease-in forwards' : 'tutorial-pop 0.3s ease-out',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* 上卷轴轴杆 */}
        <ScrollRod />
        {/* 标题：家传手札 大字墨色居中 */}
        <h2
          className="mt-2 text-center text-xl font-bold tracking-[0.4em]"
          style={{ color: ANCIENT.text, fontFamily: 'var(--font-ancient-serif)' }}
        >
          家传手札
        </h2>
        {/* 正文：字号略大、行距 1.8、首字下沉（CSS ::first-letter 大两号竹青） */}
        <div className="tutorial-handbook-body px-6 py-4 text-sm leading-[1.8] tracking-wide" style={{ color: ANCIENT.text }}>
          {content.body}
        </div>
        {/* 落款：右对齐 */}
        <p className="px-6 pb-3 text-right text-xs tracking-[0.3em]" style={{ color: ANCIENT.secondary, fontFamily: 'var(--font-ancient-serif)' }}>
          ——先祖手书
        </p>
        {/* 知道了：竹青居中 */}
        <div className="flex justify-center px-6 pb-4">
          <button
            type="button"
            onClick={handleKnow}
            className="min-w-[9rem] rounded-lg px-8 py-2 text-sm font-bold tracking-[0.4em] text-white transition-opacity hover:opacity-90"
            style={{ backgroundColor: ANCIENT.primary }}
          >
            知道了
          </button>
        </div>
        {/* 下卷轴轴杆 */}
        <ScrollRod />
      </div>
    </div>
  );
}
