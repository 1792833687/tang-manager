/**
 * 今日概览 + 消息待办（2026-08-05 体验优化：让经营面板不再单调）
 * 顶部一排店况快照（评分/声望/气氛/季节/产业/资产/待办）+ 下方消息待办列表（NPC 找玩家的代办事项）。
 * 全部 ANCIENT 令牌；只读 store。
 */
'use client';
import { useState } from 'react';
import { seasonForDay } from '@/systems/tang-node-prosperity';
import { industryLevel } from '@/config/tang-industry-content';
import { useTangManagerStore } from '@/stores/tang-manager';
import { ANCIENT } from '@/theme/tokens';

const SEASON_LABEL: Record<string, string> = { 春: '春', 夏: '夏', 秋: '秋', 冬: '冬' };

export function ShopOverviewStrip(): React.ReactElement | null {
  const s = useTangManagerStore();
  const [showMessages, setShowMessages] = useState(false);
  if (s.phase !== 'playing') return null;
  const season = seasonForDay(s.day);
  const kind = s.shopType === 'buzhuang' ? 'clothier' : s.shopType === 'yaopu' ? 'herbalist' : 'tavern';
  const lv = industryLevel(kind, kind === 'tavern' ? s.tavernLevel : kind === 'clothier' ? s.clothierLevel : s.herbalistLevel);
  const messages = s.messages ?? [];
  const chips = [
    { label: '评分', value: s.score.toFixed(1), color: ANCIENT.primary },
    { label: '声望', value: String(s.reputation), color: ANCIENT.gold },
    { label: '气氛', value: String(s.shopAtmosphere ?? 50), color: ANCIENT.secondary },
    { label: '季节', value: SEASON_LABEL[season] ?? season, color: ANCIENT.border },
    { label: '产业', value: 'Lv' + lv.level, color: ANCIENT.accent },
    { label: '资产', value: String((s.shopAssets ?? []).length), color: ANCIENT.border },
  ];
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2 rounded-xl px-3 py-2" style={{ backgroundColor: ANCIENT.card, border: `1px solid ${ANCIENT.border}` }}>
        {chips.map((c) => (
          <span key={c.label} className="flex items-center gap-1 rounded px-2 py-0.5 text-xs" style={{ backgroundColor: ANCIENT.background, color: c.color, border: `1px solid ${ANCIENT.border}` }}>
            <span style={{ color: ANCIENT.secondary }}>{c.label}</span>
            <b>{c.value}</b>
          </span>
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
              <span className="text-sm" style={{ color: ANCIENT.gold }}>{m.from === '谢七' ? '🎲' : m.from === '债主' ? '🧾' : m.from === '苏大娘' ? '🗞️' : m.from === '沈听澜' ? '🎐' : '✉️'}</span>
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
    </div>
  );
}
