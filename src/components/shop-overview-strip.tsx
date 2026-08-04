/**
 * 今日概览 + 消息待办（2026-08-05 体验优化）
 * 顶部一排店况快照，**吸附在屏幕上方**（sticky），每项可点击展开二级详情弹窗；
 * 产业/资产点击跳转「店铺管理」面板；下方消息待办（NPC 找玩家的代办事项）。
 * 全部 ANCIENT 令牌；只读 store。
 */
'use client';
import { useState } from 'react';
import { seasonForDay, type Season } from '@/systems/tang-node-prosperity';
import { industryLevel } from '@/config/tang-industry-content';
import { ModalContainer } from '@/components/modal-container';
import { useTangManagerStore } from '@/stores/tang-manager';
import { ANCIENT } from '@/theme/tokens';

const SEASON_LABEL: Record<Season, string> = { spring: '春', summer: '夏', autumn: '秋', winter: '冬' };

/** 门面外观随产业等级（成长可视化）：Lv1 街边 → Lv5 天下第一 */
const FACADE_ICON: Record<number, string> = { 1: '🛖', 2: '🏮', 3: '🏯', 4: '🏛️', 5: '👑' };

interface Chip {
  label: string;
  value: string;
  color: string;
  onClick: () => void;
}

export function ShopOverviewStrip(): React.ReactElement | null {
  const s = useTangManagerStore();
  const [showMessages, setShowMessages] = useState(false);
  const [detail, setDetail] = useState<{ label: string; lines: string[] } | null>(null);
  if (s.phase !== 'playing') return null;
  const season = seasonForDay(s.day);
  const kind = s.shopType === 'buzhuang' ? 'clothier' : s.shopType === 'yaopu' ? 'herbalist' : 'tavern';
  const lv = industryLevel(kind, kind === 'tavern' ? s.tavernLevel : kind === 'clothier' ? s.clothierLevel : s.herbalistLevel);
  const messages = s.messages ?? [];
  const openDetail = (label: string, lines: string[]): void => setDetail({ label, lines });
  const goShop = (): void => s.requestNavPanel('shop');
  const chips: Chip[] = [
    { label: '评分', value: s.score.toFixed(1), color: ANCIENT.primary, onClick: () => openDetail('店铺评分', ['当前 ' + s.score.toFixed(2) + ' / 5.0', '评分决定基础收益档位：1.0-1.9 → 5-10两/日，2.0-2.9 → 10-20，3.0-3.9 → 20-35，4.0 以上更高']) },
    { label: '声望', value: String(s.reputation), color: ANCIENT.gold, onClick: () => openDetail('声望', ['当前 ' + s.reputation + ' / 1000', '声望影响 NPC 登场、势力关系与官阶（巍明楼需 ≥700）']) },
    { label: '气氛', value: String(s.shopAtmosphere ?? 50), color: ANCIENT.secondary, onClick: () => openDetail('店内气氛', ['当前 ' + (s.shopAtmosphere ?? 50) + ' / 100', '夸奖 +10、投诉 -15；影响客人与情绪传染']) },
    { label: '季节', value: SEASON_LABEL[season] ?? season, color: ANCIENT.border, onClick: () => openDetail('时令', ['当前时令：' + (SEASON_LABEL[season] ?? season), '季节影响地图色调与部分事件']) },
    { label: '门面', value: FACADE_ICON[lv.level] + lv.name, color: ANCIENT.accent, onClick: goShop },
    { label: '资产', value: String((s.shopAssets ?? []).length), color: ANCIENT.border, onClick: goShop },
  ];
  return (
    <div className="flex flex-col gap-2">
      <div className="sticky top-0 z-30 flex flex-wrap items-center gap-2 rounded-xl px-3 py-2" style={{ backgroundColor: ANCIENT.background, border: `1px solid ${ANCIENT.border}`, boxShadow: '0 2px 8px rgba(60,40,20,0.12)' }}>
        {chips.map((c) => (
          <button key={c.label} type="button" onClick={c.onClick} title="点击查看详情" className="flex items-center gap-1 rounded px-2 py-0.5 text-xs transition-transform active:scale-[0.96]" style={{ backgroundColor: ANCIENT.card, color: c.color, border: `1px solid ${ANCIENT.border}` }}>
            <span style={{ color: ANCIENT.secondary }}>{c.label}</span>
            <b>{c.value}</b>
          </button>
        ))}
        <button
          type="button"
          onClick={() => setShowMessages((v) => !v)}
          className="ml-auto rounded px-2 py-0.5 text-xs font-bold tracking-widest"
          style={{ backgroundColor: messages.length > 0 ? ANCIENT.gold : 'transparent', color: messages.length > 0 ? '#FFFFFF' : ANCIENT.secondary, border: `1px solid ${messages.length > 0 ? ANCIENT.gold : ANCIENT.border}` }}
        >
          待办{messages.length > 0 ? `（${messages.length}）` : ''}
        </button>
      </div>
      {showMessages && (
        <div className="flex flex-col gap-1.5 rounded-xl px-3 py-2" style={{ backgroundColor: ANCIENT.card, border: `1px solid ${ANCIENT.gold}` }}>
          <div className="text-xs font-bold tracking-[0.3em]" style={{ color: ANCIENT.secondary }}>消息 · 待办</div>
          {messages.length === 0 && <p className="text-xs" style={{ color: ANCIENT.secondary }}>眼下并无待办之事。</p>}
          {messages.map((m) => (
            <div key={m.id} className="flex items-start gap-2 rounded-lg px-2.5 py-1.5" style={{ backgroundColor: ANCIENT.background, border: `1px solid ${ANCIENT.border}` }}>
              <span style={{ color: ANCIENT.gold }}>{m.from === '谢七' ? '🎲' : m.from === '债主' ? '🧾' : m.from === '苏大娘' ? '🗞️' : m.from === '沈听澜' ? '🎐' : '✉️'}</span>
              <div className="min-w-0 flex-1">
                <div className="text-[11px] font-bold tracking-widest" style={{ color: ANCIENT.secondary }}>{m.from}</div>
                <p className="text-xs leading-5" style={{ color: ANCIENT.text }}>{m.content}</p>
              </div>
              <button type="button" onClick={() => s.dismissMessage(m.id)} className="shrink-0 text-[11px]" style={{ color: ANCIENT.border }}>
                已知
              </button>
            </div>
          ))}
        </div>
      )}
      {detail && (
        <ModalContainer title={detail.label} onClose={() => setDetail(null)} showConfirm={false}>
          <div className="flex flex-col gap-2">
            {detail.lines.map((l, i) => (
              <p key={i} className="text-sm leading-6" style={{ color: ANCIENT.text }}>{l}</p>
            ))}
          </div>
        </ModalContainer>
      )}
    </div>
  );
}
