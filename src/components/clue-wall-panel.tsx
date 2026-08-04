/**
 * 蛛丝马迹面板（Step 5b-5 模块二；clue-wall-panel；JournalPanel 标签页内渲染）
 * 「蛛丝马迹：将各处搜集来的零散情报汇集一处，若有心串联，或可窥见长安城暗流之下的真相。」
 * 标题「蛛丝马迹 · 长安暗流」：分类筛选（六类+全部）、宣纸撕边小卡（来源标签+三行摘要+
 * 点击展开）、关联连线（CSS 虚线）、右侧详情+关联列表、底部提示统计。
 * 玩家手动连接：点击两张小卡 → store.connectClues(a,b) 互连（轻量）。
 * 全部 ANCIENT 令牌 + 古风风格；不持有游戏状态。
 */
'use client';
import { useMemo, useState } from 'react';
import { useTangManagerStore } from '@/stores/tang-manager';
import { judgeClueConnection } from '@/systems/tang-clues';
import { ANCIENT } from '@/theme/tokens';
import { CLUE_CATEGORY_LABEL, CLUE_SOURCE_LABEL, type Clue, type ClueCategory } from '@/types/tang-clues';
import { pushActionFeedback } from './action-feedback';

type ClueFilter = 'all' | ClueCategory;

const FILTERS: Array<{ key: ClueFilter; label: string }> = [
  { key: 'all', label: '全部' },
  { key: 'shen', label: '沈氏暗流' },
  { key: 'xie', label: '谢七门道' },
  { key: 'debt', label: '债主往事' },
  { key: 'politics', label: '庙堂风云' },
  { key: 'business', label: '商海秘辛' },
  { key: 'secret', label: '隐秘传闻' },
];

const CATEGORY_COLOR: Record<ClueCategory, string> = {
  shen: ANCIENT.primary,
  xie: '#3B6FB6',
  debt: ANCIENT.secondary,
  politics: ANCIENT.accent,
  business: '#5B3A8E',
  secret: '#8C6A3A',
};

/** 宣纸撕边小卡（三行摘要 + 点击展开 + 选中连接） */
function ClueCard({
  clue,
  selected,
  onSelect,
}: {
  clue: Clue;
  selected: boolean;
  onSelect: (id: string) => void;
}): React.ReactElement {
  const [open, setOpen] = useState(false);
  const color = CATEGORY_COLOR[clue.category];
  return (
    <div
      onClick={() => onSelect(clue.id)}
      className="relative cursor-pointer rounded-md px-3 py-2.5 transition-shadow"
      style={{
        // 宣纸撕边：不规则边框（clip-path 模拟），注释说明
        backgroundColor: clue.resolved ? '#F0E6D2' : '#FBF4E6',
        border: `2px solid ${selected ? ANCIENT.gold : color}`,
        clipPath: 'polygon(2% 0, 98% 1%, 100% 6%, 99% 94%, 95% 100%, 4% 99%, 0 95%, 1% 4%)',
        boxShadow: selected ? `0 0 0 2px ${ANCIENT.gold}` : 'none',
      }}
    >
      <div className="flex items-center gap-1.5 text-[10px]">
        <span className="rounded px-1 text-white" style={{ backgroundColor: color }}>
          {CLUE_CATEGORY_LABEL[clue.category]}
        </span>
        <span style={{ color: ANCIENT.secondary }}>{CLUE_SOURCE_LABEL[clue.sourceType]}·{clue.source}</span>
        <span className="ml-auto" style={{ color: ANCIENT.secondary }}>第 {clue.day} 日</span>
      </div>
      {/* 三行摘要（展开前 line-clamp 由父级控制；展开显示全文） */}
      <p
        className={`mt-1 text-xs leading-relaxed tracking-wider ${open ? '' : 'line-clamp-3'}`}
        style={{ color: ANCIENT.text }}
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
      >
        {clue.content}
      </p>
      <div className="mt-1 flex items-center gap-1 text-[9px]" style={{ color: ANCIENT.secondary }}>
        {clue.connected.length > 0 && <span>关联 {clue.connected.length} 条</span>}
        {clue.resolved && <span className="text-[#5B3A8E]">已解析</span>}
        <span className="ml-auto">{selected ? '已选中，再点另一张连接' : open ? '收起' : '展开'}</span>
      </div>
    </div>
  );
}

export function ClueWallPanel(): React.ReactElement {
  const clues = useTangManagerStore((s) => s.clues ?? []);
  const connectCluesAction = useTangManagerStore((s) => s.connectClues);
  const resolveClueAction = useTangManagerStore((s) => s.resolveClue);
  const [filter, setFilter] = useState<ClueFilter>('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);

  const filtered = useMemo(
    () => (filter === 'all' ? clues : clues.filter((c) => c.category === filter)),
    [clues, filter]
  );
  const detail = clues.find((c) => c.id === detailId) ?? null;
  const resolvedCount = clues.filter((c) => c.resolved).length;

  /** 点击小卡：已选 → 判定并手动连接（内容深化 TANG-CONT-B 模块六·3）；
   *  同类别或已关联 → 连接 + 「你隐约觉得这两件事有关联」；
   *  不匹配 → 不连接 + 「这两件事似乎没什么关系」；未选 → 选中 */
  const handleCardClick = (id: string): void => {
    setDetailId(id);
    if (selectedId && selectedId !== id) {
      const judge = judgeClueConnection(clues, selectedId, id);
      if (judge === 'match') {
        connectCluesAction(selectedId, id);
        pushActionFeedback('你隐约觉得这两件事有关联', 'success');
      } else {
        pushActionFeedback('这两件事似乎没什么关系', 'warning');
      }
      setSelectedId(null);
    } else if (selectedId === id) {
      setSelectedId(null);
    } else {
      setSelectedId(id);
    }
  };

  return (
    <div>
      <header className="mb-2 flex items-center gap-2">
        <span style={{ width: 4, height: 18, backgroundColor: ANCIENT.gold }} />
        <h4 className="text-base font-bold tracking-[0.3em]" style={{ color: ANCIENT.text }}>
          蛛丝马迹 · 长安暗流
        </h4>
        <span className="ml-auto text-[11px] tracking-widest" style={{ color: ANCIENT.secondary }}>
          已解析 {resolvedCount} / {clues.length}
        </span>
      </header>

      {/* 分类筛选（六类 + 全部） */}
      <div className="mb-3 flex flex-wrap gap-1.5">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() => setFilter(f.key)}
            className="rounded px-2 py-0.5 text-[11px] tracking-wider"
            style={{
              backgroundColor: filter === f.key ? ANCIENT.secondary : ANCIENT.background,
              color: filter === f.key ? '#FFFFFF' : ANCIENT.secondary,
              border: `1px solid ${filter === f.key ? ANCIENT.secondary : ANCIENT.border}`,
            }}
          >
            {f.label}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <p className="py-8 text-center text-sm tracking-[0.4em]" style={{ color: ANCIENT.border }}>
          尚未寻得蛛丝马迹。多与客商闲谈、留意舆图风声。
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((c) => (
            <ClueCard key={c.id} clue={c} selected={selectedId === c.id} onSelect={handleCardClick} />
          ))}
        </div>
      )}

      {/* 右侧详情 + 关联列表（当前选中卡；关联线索用 CSS 虚线连接示意） */}
      {detail && (
        <div className="mt-3 rounded-lg px-3 py-2" style={{ backgroundColor: ANCIENT.card, border: `1px solid ${CATEGORY_COLOR[detail.category]}` }}>
          <div className="flex items-center gap-2 text-xs">
            <span className="rounded px-1.5 py-0.5 text-[10px] text-white" style={{ backgroundColor: CATEGORY_COLOR[detail.category] }}>
              {CLUE_CATEGORY_LABEL[detail.category]}
            </span>
            <span className="font-bold tracking-widest" style={{ color: ANCIENT.text }}>{detail.source}</span>
            <span className="text-[10px]" style={{ color: ANCIENT.secondary }}>{CLUE_SOURCE_LABEL[detail.sourceType]} · 第 {detail.day} 日</span>
            <span className="ml-auto">
              <button
                type="button"
                onClick={() => resolveClueAction(detail.id)}
                disabled={detail.resolved}
                className="rounded px-2 py-0.5 text-[10px] tracking-wider disabled:opacity-40"
                style={{ backgroundColor: detail.resolved ? ANCIENT.background : ANCIENT.primary, color: detail.resolved ? ANCIENT.secondary : '#FFFFFF' }}
              >
                {detail.resolved ? '已解析' : '解析'}
              </button>
            </span>
          </div>
          <p className="mt-1.5 text-xs leading-relaxed tracking-wider" style={{ color: ANCIENT.text }}>
            {detail.content}
          </p>
          {detail.connected.length > 0 && (
            <div className="mt-2">
              <div className="mb-1 flex items-center gap-1 text-[10px]" style={{ color: ANCIENT.secondary }}>
                <span style={{ width: 14, borderTop: `1px dashed ${ANCIENT.gold}` }} />
                关联线索
              </div>
              <div className="flex flex-wrap gap-1.5">
                {detail.connected.map((id) => {
                  const c = clues.find((x) => x.id === id);
                  return c ? (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setDetailId(id)}
                      className="rounded px-2 py-0.5 text-[10px] tracking-wider"
                      style={{ backgroundColor: ANCIENT.background, color: ANCIENT.text, border: `1px solid ${CATEGORY_COLOR[c.category]}` }}
                    >
                      {c.source} · {CLUE_CATEGORY_LABEL[c.category]}
                    </button>
                  ) : null;
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* 底部提示统计 */}
      <div className="mt-3 border-t pt-2" style={{ borderColor: ANCIENT.border }}>
        <p className="text-[10px] tracking-widest" style={{ color: ANCIENT.secondary }}>
          同类别凑齐三条，线索自会彼此串联；六线齐明，方见长安暗流之下的真相。
        </p>
      </div>
    </div>
  );
}
