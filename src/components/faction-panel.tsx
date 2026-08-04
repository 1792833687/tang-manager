/**
 * 名声关系网面板（TANG-SOC-001 模块五；faction-panel）
 * 「世交：商号与长安各大势力之间的交情深浅，影响货源、定价、官府照拂。」
 * 标题「长安故旧 · 门路」：五势力卡片横排（名称/关系值/状态）+ 势力详情（特权列表已解锁高亮）+
 * NPC 好感列表（头像/姓名/好感条/描述）。配色按势力。
 * v1.0 面板统一化：由 overlay（portal）迁移为主内容区切面渲染
 * （tang-manager/page.tsx 12 面板映射，NavItemKey 'faction'），不再依赖 store 开关。
 * 全部 ANCIENT 令牌 + 势力配置色，古风风格。
 */
'use client';
import { useState } from 'react';
import { withBase } from '@/lib/utils/base-path';
import { useTangManagerStore } from '@/stores/tang-manager';
import { ANCIENT } from '@/theme/tokens';
import { FACTION_ICON_MAP } from '@/config/tang-faction-icons';
import { AncientCard } from './ancient-card';
import { FogCard } from './fog-card';
import { NpcListPanel } from './npc-list-panel';
import { FACTION_LEADER_THRESHOLD, FACTION_RELATIONS_THRESHOLD, FACTION_PERKS_THRESHOLD } from '@/systems/tang-fog';
import type { Faction } from '@/types/tang-factions';

/** 势力类型中文标签 */
const FACTION_TYPE_LABEL: Record<Faction['type'], string> = {
  guild: '行会',
  government: '官府',
  underground: '地下',
  commercial: '商团',
  court: '朝廷',
};

/** 门路子标签：势力关系 / 长安故人（TANG-MIST-002 模块三） */
type FactionTab = 'relations' | 'npcs';

export function FactionPanel(): React.ReactElement {
  const factions = useTangManagerStore((s) => s.factions ?? []);
  const npcFavors = useTangManagerStore((s) => s.npcFavors ?? []);
  const fogOfWar = useTangManagerStore((s) => s.fogOfWar);
  const [tab, setTab] = useState<FactionTab>('relations');
  const [selectedId, setSelectedId] = useState<string | null>(factions[0]?.id ?? null);

  const selected = factions.find((f) => f.id === selectedId) ?? factions[0];
  const selectedFog = selected ? fogOfWar.factions[selected.id] : undefined;

  return (
    <AncientCard title="长安故旧 · 门路" accent={ANCIENT.gold}>
      {/* 子标签：势力关系 / 长安故人（与势力关系并列；TANG-MIST-002） */}
      <div className="mb-3 flex gap-2 text-xs">
        {(
          [
            { key: 'relations', label: '势力关系' },
            { key: 'npcs', label: '长安故人' },
          ] as const
        ).map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className="rounded-full px-3 py-1 tracking-[0.2em]"
            style={{
              backgroundColor: tab === t.key ? ANCIENT.primary : ANCIENT.card,
              color: tab === t.key ? '#FFF' : ANCIENT.secondary,
              border: `1px solid ${tab === t.key ? ANCIENT.primary : ANCIENT.border}`,
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'npcs' ? (
        /* 长安故人 · 六位新 NPC（TANG-MIST-002 模块三；列表 + 详情弹窗 fog-card 揭示） */
        <NpcListPanel />
      ) : (
        <>
      {/* 五势力卡片横排（迷雾铁律：首次接触只显示势力名 + 关系值） */}
      <div className="grid grid-cols-5 gap-1.5">
        {factions.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => setSelectedId(f.id)}
            className="flex flex-col items-center rounded-lg px-1 py-2"
            style={{
              backgroundColor: selectedId === f.id ? f.color : ANCIENT.card,
              border: `2px solid ${f.color}`,
              color: selectedId === f.id ? '#FFF' : ANCIENT.text,
            }}
          >
            {FACTION_ICON_MAP[f.id] !== undefined && (
              <img
                src={withBase(`/images/icons/factions/${FACTION_ICON_MAP[f.id]}.png`)}
                alt={`${f.name}徽章`}
                aria-hidden
                className="mb-1 h-8 w-8"
              />
            )}
            <span className="text-xs font-bold">{f.name}</span>
            <span className="mt-1 text-lg font-bold">{f.relationship}</span>
            <span className="text-[10px] opacity-90">{factionVerdict(f.relationship)}</span>
          </button>
        ))}
      </div>

      {/* 势力详情（迷雾：首领≥40 / 关系线≥60 / 特权≥80 / 隐藏目的=线索≥3） */}
      {selected && (
        <div className="mt-3 rounded-lg px-3 py-2" style={{ backgroundColor: ANCIENT.card, border: `1px solid ${selected.color}` }}>
          <FogCard
            revealed={!!selectedFog?.leaderRevealed}
            condition={`关系 ≥ ${FACTION_LEADER_THRESHOLD} 可探明首领门路`}
          >
            <div className="flex items-center gap-2 text-sm">
              <span className="font-bold" style={{ color: ANCIENT.text }}>{selected.name}</span>
              <span className="rounded px-1 text-[10px] text-white" style={{ backgroundColor: selected.color }}>{FACTION_TYPE_LABEL[selected.type]}</span>
              <span className="text-[11px]" style={{ color: ANCIENT.secondary }}>
                首领：{selectedFog?.leaderRevealed ? selected.leader : '？？？'}
              </span>
            </div>
            {selectedFog?.relationsRevealed ? (
              <p className="mt-1 text-[11px]" style={{ color: ANCIENT.secondary }}>{selected.description}</p>
            ) : (
              <p className="mt-1 text-[11px]" style={{ color: ANCIENT.secondary }}>
                相交尚浅，其门路尚在迷雾之中（关系 ≥ {FACTION_RELATIONS_THRESHOLD} 可探明）。
              </p>
            )}
            {/* 特权列表（已解锁高亮；未探明时全部以「？？？」展示） */}
            {selectedFog?.perksRevealed ? (
              <div className="mt-2 flex flex-wrap gap-1">
                {selected.perks.map((p) => {
                  const unlocked = selected.relationship >= p.threshold;
                  return (
                    <span
                      key={p.threshold}
                      title={`${p.name}：${p.description}`}
                      className="rounded px-1.5 py-0.5 text-[10px]"
                      style={{
                        backgroundColor: unlocked ? selected.color : ANCIENT.background,
                        color: unlocked ? '#FFF' : ANCIENT.secondary,
                        border: `1px solid ${unlocked ? selected.color : ANCIENT.border}`,
                        opacity: unlocked ? 1 : 0.6,
                      }}
                    >
                      {p.threshold} · {p.name}
                    </span>
                  );
                })}
              </div>
            ) : (
              <div className="mt-2 flex flex-wrap gap-1">
                {selected.perks.map((p) => (
                  <span
                    key={p.threshold}
                    title={`关系 ≥ ${p.threshold} 可探明`}
                    className="rounded px-1.5 py-0.5 text-[10px]"
                    style={{
                      backgroundColor: ANCIENT.background,
                      color: ANCIENT.secondary,
                      border: `1px solid ${ANCIENT.border}`,
                      opacity: 0.6,
                    }}
                  >
                    {p.threshold} · ？？？
                  </span>
                ))}
              </div>
            )}
            {/* 隐藏目的（线索墙该势力线索 ≥3 条揭示） */}
            {selectedFog?.hiddenAgendaRevealed ? (
              <p className="mt-2 text-[11px]" style={{ color: ANCIENT.accent }}>
                隐藏目的：{selectedFog.hiddenAgenda}
              </p>
            ) : (
              <p className="mt-2 text-[11px]" style={{ color: ANCIENT.secondary }}>
                （此势力线索渐多，或可窥其隐藏目的——同线线索 ≥ 3 条）
              </p>
            )}
          </FogCard>
        </div>
      )}

      {/* NPC 好感列表 */}
      <div className="mt-3">
        <h4 className="mb-1 text-xs font-bold tracking-widest" style={{ color: ANCIENT.secondary }}>故旧相知</h4>
        <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
          {npcFavors.map((n) => (
            <div key={n.npcId} className="flex items-center gap-2 rounded-lg px-2 py-1.5" style={{ backgroundColor: ANCIENT.card, border: `1px solid ${ANCIENT.border}` }}>
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-xs font-bold text-white" style={{ backgroundColor: ANCIENT.secondary }}>
                {n.npcName.charAt(0)}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 text-[11px]">
                  <span className="font-bold" style={{ color: ANCIENT.text }}>{n.npcName}</span>
                  <span className="rounded px-1 text-[10px]" style={{ backgroundColor: ANCIENT.border, color: '#FFF' }}>{n.relationship}</span>
                </div>
                <div className="mt-0.5 h-1.5 w-full overflow-hidden rounded-full" style={{ backgroundColor: ANCIENT.background }}>
                  <div style={{ width: `${Math.min(100, Math.max(0, n.favor))}%`, height: '100%', backgroundColor: ANCIENT.gold }} />
                </div>
                {n.unlockedPerks.length > 0 && (
                  <div className="mt-0.5 truncate text-[10px]" style={{ color: ANCIENT.secondary }}>
                    特权：{n.unlockedPerks.join('、')}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
        </>
      )}
    </AncientCard>
  );
}

/** 势力关系评语（与 config 一致，内联避免循环依赖） */
function factionVerdict(relationship: number): string {
  if (relationship >= 80) return '生死之交';
  if (relationship >= 60) return '推心置腹';
  if (relationship >= 40) return '相交莫逆';
  if (relationship >= 20) return '初有来往';
  return '素不相识';
}
