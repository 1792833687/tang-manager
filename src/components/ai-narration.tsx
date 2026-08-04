/**
 * AI 叙事卷轴卡片（Step 4 4.2）— 纯展示组件
 * - 古风卷轴：竹青边框 + 宣纸底 + 描金点缀（ANCIENT 令牌）；
 * - 顶部标题按 type：结算→「今夜手札」/ 事件→「坊间纪事」/ 成就→「手札浮现」；
 * - 正文打字机逐字显示（30ms/字符）；显示完毕前关闭按钮 disabled，完成后可 onClose；
 * - 异步获取 AI 文本：loading 显示「手札正在书写……」，AI 文本到达后替换并打字机显示；
 *   关闭/离线/失败 → 降级模板（不阻塞、不报错，视觉连贯）。
 */
'use client';
import { useEffect, useState } from 'react';
import { useTangManagerStore } from '@/stores/tang-manager';
import { buildFallbackTemplate, generateNarration } from '@/systems/tang-narrator';
import { ANCIENT } from '@/theme/tokens';
import type { NarrationContext, NarrationType } from '@/types/tang-manager';

const TYPE_TITLES: Record<NarrationType, string> = {
  settlement: '今夜手札',
  event: '坊间纪事',
  achievement: '手札浮现',
  reception: '客来小记',
};

const TYPEWRITER_MS = 30;

export function AiNarration({
  context,
  onClose,
}: {
  context: NarrationContext;
  onClose: () => void;
}): React.ReactElement {
  const aiNarrationEnabled = useTangManagerStore((s) => s.aiNarrationEnabled);
  const aiModel = useTangManagerStore((s) => s.aiModel);

  // 初始即降级模板文本：AI 未返回前也展示占位（视觉连贯）
  const [fullText, setFullText] = useState<string>(() => buildFallbackTemplate(context.type, context));
  const [visibleCount, setVisibleCount] = useState(0);
  const [loading, setLoading] = useState(true);

  // 异步获取 AI 文本；卸载/关闭后取消 setState，避免竞态
  // v1.0 模块四：AI 叙事防抖 500ms——快速连续触发（接待/事件/结算接连弹出）时
  // 延迟发起网络请求，避免并发 AI 调用刷接口（每次挂载仅一次防抖）。
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setVisibleCount(0);
    const timer = setTimeout(() => {
      generateNarration(context, { enabled: aiNarrationEnabled, model: aiModel })
        .then((text) => {
          if (cancelled) {
            return;
          }
          setFullText(text);
          setLoading(false);
        })
        .catch(() => {
          if (!cancelled) {
            setFullText(buildFallbackTemplate(context.type, context));
            setLoading(false);
          }
        });
    }, 500);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [context, aiNarrationEnabled, aiModel]);

  // 打字机：AI 文本到达后逐字显示；显示完 → done（解锁关闭按钮）
  useEffect(() => {
    if (loading) {
      return;
    }
    if (visibleCount >= fullText.length) {
      return;
    }
    const timer = setTimeout(() => {
      setVisibleCount((c) => Math.min(fullText.length, c + 1));
    }, TYPEWRITER_MS);
    return () => clearTimeout(timer);
  }, [loading, visibleCount, fullText]);

  const done = !loading && visibleCount >= fullText.length;

  return (
    <div
      className="relative mt-3 rounded-xl px-4 py-5 sm:px-6"
      style={{
        backgroundColor: ANCIENT.card,
        border: `2px solid ${ANCIENT.primary}`,
        boxShadow: `0 0 0 1px ${ANCIENT.gold} inset`,
      }}
    >
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span style={{ width: 4, height: 20, backgroundColor: ANCIENT.gold }} />
          <h4 className="text-base font-bold tracking-[0.2em]" style={{ color: ANCIENT.primary }}>
            {TYPE_TITLES[context.type]}
          </h4>
        </div>
        <button
          type="button"
          onClick={onClose}
          disabled={!done}
          className="rounded-md px-3 py-1 text-xs font-bold tracking-widest transition-opacity disabled:cursor-not-allowed disabled:opacity-40"
          style={{ backgroundColor: ANCIENT.border, color: '#FFFFFF' }}
        >
          收起
        </button>
      </div>
      <p className="text-sm leading-relaxed tracking-wide" style={{ color: ANCIENT.text }}>
        {loading ? '手札正在书写……' : fullText.slice(0, visibleCount)}
        {!done && <span style={{ color: ANCIENT.gold }}>▍</span>}
      </p>
      <p className="mt-2 text-right text-xs tracking-widest" style={{ color: ANCIENT.gold }}>
        ——手札自动记录
      </p>
    </div>
  );
}
