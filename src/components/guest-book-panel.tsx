/**
 * 宾客留言簿（TANG-RCP-001 模块四）
 * 古风册子样式：按日期倒序、每页 3 条翻页；底部「合上留言簿」返回接待面板。
 * 只读展示 store.guestBook，不持有游戏状态。
 */
'use client';
import { useMemo, useState } from 'react';
import { withBase } from '@/lib/utils/base-path';
import { useTangManagerStore } from '@/stores/tang-manager';
import { ANCIENT } from '@/theme/tokens';
import { GUEST_LEVEL_LABEL } from '@/config/tang-guest-book-content';

const PAGE_SIZE = 3;

const TYPE_LABEL: Record<string, string> = {
  praise: '好评',
  story: '故事',
  event: '异客',
};

export function GuestBookPanel({ onBack }: { onBack: () => void }): React.ReactElement {
  const guestBook = useTangManagerStore((s) => s.guestBook ?? []);
  const [page, setPage] = useState(0);

  // 按日期倒序（同日按加入顺序）
  const sorted = useMemo(() => [...guestBook].sort((a, b) => b.day - a.day), [guestBook]);
  const pageCount = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const rows = sorted.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);

  return (
    <div>
      <header className="mb-3 flex items-center gap-2">
        <span style={{ width: 4, height: 16, backgroundColor: ANCIENT.gold }} />
        <span className="text-xs tracking-widest" style={{ color: ANCIENT.secondary }}>
          共 {sorted.length} 则 · 第 {safePage + 1}/{pageCount} 页
        </span>
      </header>

      {sorted.length === 0 ? (
        <p className="py-10 text-center text-sm tracking-[0.4em]" style={{ color: ANCIENT.border }}>
          尚无人留墨。
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {rows.map((e) => (
            <div
              key={e.id}
              className="rounded-lg border-l-4 px-4 py-3"
              style={{ borderLeftColor: ANCIENT.gold, backgroundColor: ANCIENT.card, border: `1px solid ${ANCIENT.border}` }}
            >
              <div className="flex items-center gap-2 text-xs" style={{ color: ANCIENT.secondary }}>
                <span className="font-bold tracking-widest" style={{ color: ANCIENT.text }}>
                  {e.guestName}
                </span>
                <span className="flex items-center gap-1">
                  <img
                    src={withBase(`/images/icons/guest-levels/${e.guestLevel}.svg`)}
                    alt={`${GUEST_LEVEL_LABEL[e.guestLevel]}标识`}
                    aria-hidden
                    className="h-3.5 w-3.5"
                  />
                  客等·{GUEST_LEVEL_LABEL[e.guestLevel]}
                </span>
                <span>第 {e.visitCount} 次光顾</span>
                <span className="ml-auto">
                  {TYPE_LABEL[e.type]} · 第 {e.day} 日
                </span>
              </div>
              <p className="mt-1.5 text-sm leading-relaxed tracking-wider" style={{ color: ANCIENT.text }}>
                {e.content}
              </p>
            </div>
          ))}
        </div>
      )}

      <div className="mt-4 flex items-center justify-between">
        <button
          type="button"
          onClick={() => setPage(Math.max(0, safePage - 1))}
          disabled={safePage <= 0}
          className="rounded px-3 py-1 text-xs tracking-widest disabled:opacity-30"
          style={{ backgroundColor: ANCIENT.background, color: ANCIENT.text, border: `1px solid ${ANCIENT.border}` }}
        >
          ← 上一页
        </button>
        <button
          type="button"
          onClick={() => setPage(Math.min(pageCount - 1, safePage + 1))}
          disabled={safePage >= pageCount - 1}
          className="rounded px-3 py-1 text-xs tracking-widest disabled:opacity-30"
          style={{ backgroundColor: ANCIENT.background, color: ANCIENT.text, border: `1px solid ${ANCIENT.border}` }}
        >
          下一页 →
        </button>
      </div>
    </div>
  );
}
