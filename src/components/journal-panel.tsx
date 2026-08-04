/**
 * 手札录面板（Step 5b-5 模块一；journal-panel）
 * 「手札录：家传手札的空白页，自动记录经营历程、人物往来、重大抉择。可随时翻阅回味。」
 * 古风册子「陆氏手札录」：筛选栏（全部/事件/NPC/里程碑/抉择/成就）、按日期倒序、
 * 点击展开、简化翻页（CSS page-turn 过渡注释）、底部统计。
 * 与蛛丝马迹同面板标签页（手札录 / 蛛丝马迹 两 tab；蛛丝马迹内容由 ClueWallPanel 渲染）。
 * v1.0 面板统一化：由 overlay（portal）迁移为主内容区切面渲染
 * （tang-manager/page.tsx 12 面板映射，NavItemKey 'journal'），不再依赖 store 开关。
 * 全部 ANCIENT 令牌 + 古风风格；不持有游戏状态。
 */
'use client';
import { useMemo, useState } from 'react';
import { useTangManagerStore } from '@/stores/tang-manager';
import { ANCIENT } from '@/theme/tokens';
import { AncientCard } from './ancient-card';
import { ClueWallPanel } from './clue-wall-panel';
import { TasksQuestsPanel } from './tasks-quests-panel';
import { ModalContainer } from './modal-container';
import { JOURNAL_TYPE_LABEL, type JournalEntry, type JournalEntryType } from '@/types/tang-journal';

const PAGE_SIZE = 5;

/** 筛选：全部 + 五类 */
type JournalFilter = 'all' | JournalEntryType;

const FILTERS: Array<{ key: JournalFilter; label: string }> = [
  { key: 'all', label: '全部' },
  { key: 'event', label: '事件' },
  { key: 'npc', label: '人物' },
  { key: 'milestone', label: '里程碑' },
  { key: 'choice', label: '抉择' },
  { key: 'achievement', label: '成就' },
];

/** 单条手札（点击展开） */
function JournalRow({ entry }: { entry: JournalEntry }): React.ReactElement {
  const [open, setOpen] = useState(false);
  const typeColor = typeColorFor(entry.type);
  return (
    <div
      className="rounded-lg border-l-4 px-4 py-3 transition-colors"
      style={{
        borderLeftColor: typeColor,
        backgroundColor: ANCIENT.card,
        border: `1px solid ${ANCIENT.border}`,
        cursor: 'pointer',
      }}
      onClick={() => setOpen((v) => !v)}
    >
      <div className="flex items-center gap-2 text-xs" style={{ color: ANCIENT.secondary }}>
        <span className="rounded px-1.5 py-0.5 text-[10px] text-white" style={{ backgroundColor: typeColor }}>
          {JOURNAL_TYPE_LABEL[entry.type]}
        </span>
        <span className="font-bold tracking-widest" style={{ color: ANCIENT.text }}>{entry.title}</span>
        <span className="ml-auto">第 {entry.day} 日</span>
        {entry.relatedNPC && <span>· {entry.relatedNPC}</span>}
      </div>
      {open && (
        <div className="mt-2">
          <p className="text-sm leading-relaxed tracking-wider" style={{ color: ANCIENT.text }}>
            {entry.content}
          </p>
          {entry.tags.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {entry.tags.map((t) => (
                <span key={t} className="rounded px-1.5 py-0.5 text-[10px]" style={{ backgroundColor: ANCIENT.background, color: ANCIENT.secondary, border: `1px solid ${ANCIENT.border}` }}>
                  #{t}
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/** 条目类型色（古风令牌内近似；工程定） */
function typeColorFor(type: JournalEntryType): string {
  switch (type) {
    case 'event':
      return ANCIENT.accent; // 朱砂
    case 'npc':
      return '#3B6FB6'; // 蓝
    case 'milestone':
      return ANCIENT.gold; // 描金
    case 'choice':
      return '#5B3A8E'; // 暗紫
    case 'achievement':
      return ANCIENT.primary; // 竹青
    default:
      return ANCIENT.secondary;
  }
}

export function JournalPanel(): React.ReactElement {
  const journal = useTangManagerStore((s) => s.journal ?? []);
  const [cluesOpen, setCluesOpen] = useState(false);
  const [questsOpen, setQuestsOpen] = useState(false);
  const [filter, setFilter] = useState<JournalFilter>('all');
  const [page, setPage] = useState(0);

  // 按日期倒序（同日按加入顺序）
  const sorted = useMemo(
    () => [...journal].sort((a, b) => b.day - a.day || 0),
    [journal]
  );
  const filtered = useMemo(
    () => (filter === 'all' ? sorted : sorted.filter((e) => e.type === filter)),
    [sorted, filter]
  );
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const rows = filtered.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);

  // 底部统计
  const stats = useMemo(() => {
    const byType: Record<JournalEntryType, number> = { event: 0, npc: 0, milestone: 0, choice: 0, achievement: 0 };
    for (const e of journal) byType[e.type] = (byType[e.type] ?? 0) + 1;
    return byType;
  }, [journal]);

  return (
    <AncientCard title="陆氏手札录" accent={ANCIENT.gold}>
      <div className="flex flex-col gap-2">
      {/* 蛛丝马迹入口（v1.0 统一 modal-container 弹窗） */}
      <div className="mb-3 flex gap-2">
        <button
          type="button"
          onClick={() => setCluesOpen(true)}
          className="rounded px-3 py-1 text-xs tracking-[0.3em]"
          style={{
            backgroundColor: ANCIENT.primary,
            color: '#FFFFFF',
            border: `1px solid ${ANCIENT.primary}`,
          }}
        >
          蛛丝马迹
        </button>
        <button
          type="button"
          onClick={() => setQuestsOpen(true)}
          className="rounded px-3 py-1 text-xs tracking-[0.3em]"
          style={{
            backgroundColor: ANCIENT.gold,
            color: '#FFFFFF',
            border: `1px solid ${ANCIENT.gold}`,
          }}
        >
          要务与遗命
        </button>
      </div>

      {/* 筛选栏 */}
          <div className="mb-3 flex flex-wrap gap-1.5">
            {FILTERS.map((f) => (
              <button
                key={f.key}
                type="button"
                onClick={() => {
                  setFilter(f.key);
                  setPage(0);
                }}
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
            <span className="ml-auto self-center text-[11px] tracking-widest" style={{ color: ANCIENT.secondary }}>
              第 {safePage + 1}/{pageCount} 页
            </span>
          </div>

          {rows.length === 0 ? (
            <p className="py-10 text-center text-sm tracking-[0.4em]" style={{ color: ANCIENT.border }}>
              此页尚无一字。
            </p>
          ) : (
            <div className="flex flex-col gap-2.5">
              {rows.map((e) => (
                <JournalRow key={e.id} entry={e} />
              ))}
            </div>
          )}

          {/* 翻页（简化 CSS page-turn 过渡：切换页时内容淡入；注释留痕） */}
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
            <span className="text-[11px] tracking-widest" style={{ color: ANCIENT.secondary }}>
              共 {filtered.length} 则
            </span>
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

          {/* 底部统计 */}
          <div className="mt-3 flex flex-wrap gap-1.5 border-t pt-2" style={{ borderColor: ANCIENT.border }}>
            <span className="text-[10px] tracking-widest" style={{ color: ANCIENT.secondary }}>统计：</span>
            {FILTERS.filter((f) => f.key !== 'all').map((f) => (
              <span key={f.key} className="rounded px-1.5 py-0.5 text-[10px]" style={{ backgroundColor: ANCIENT.background, color: ANCIENT.secondary, border: `1px solid ${ANCIENT.border}` }}>
                {f.label} {stats[f.key as JournalEntryType] ?? 0}
              </span>
            ))}
          </div>
      </div>

      {/* 蛛丝马迹弹窗（v1.0 统一 modal-container） */}
      {cluesOpen && (
        <ModalContainer title="蛛丝马迹 · 长安暗流" onClose={() => setCluesOpen(false)} showConfirm={false}>
          <ClueWallPanel />
        </ModalContainer>
      )}
      {questsOpen && (
        <ModalContainer title="要务与遗命" onClose={() => setQuestsOpen(false)} showConfirm={false}>
          <TasksQuestsPanel />
        </ModalContainer>
      )}
    </AncientCard>
  );
}
