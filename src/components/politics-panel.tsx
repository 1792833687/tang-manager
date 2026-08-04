/**
 * 巍明楼面板（Step 5b-5 模块三；politics-panel）
 * 「巍明楼：皇城根下的权力中枢，朝廷政令、派系党争皆出于此。声望够高方可踏足。」
 * 政令横幅（红诏书样式）+ 六派系关系（东市/西市/京兆/地下/平康 + 朝廷派系列表）+
 * 派系详情（朝廷三子派：保守/开明/宦官，可站队）+ 皇商招标（信用≥700 可参与）+
 * 从商转政入口（声望≥900 且资金≥200000 且支持派系≥80 高亮）。
 * 官场线（phase='politics'）：占位面板（深度玩法后续），提供再开一局退出。
 * v1.0 面板统一化：由 overlay（portal）迁移为主内容区切面渲染
 * （tang-manager/page.tsx 12 面板映射，NavItemKey 'politics'），不再依赖 store 开关。
 * 全部 ANCIENT 令牌 + 古风风格；不持有游戏状态。
 */
'use client';
import { useMemo, useState } from 'react';
import { useTangManagerStore } from '@/stores/tang-manager';
import { ANCIENT } from '@/theme/tokens';
import { AncientCard } from './ancient-card';
import { checkDecreeImpact } from '@/systems/tang-politics';
import { politicalSubFactionName } from '@/systems/tang-politics';
import { POLITICAL_SUB_FACTIONS, type PoliticalSubFactionId } from '@/config/tang-politics';
import { DangerConfirm } from './danger-confirm';

/** 子派系代表色 */
const SUB_COLOR: Record<PoliticalSubFactionId, string> = {
  conservative: '#6E5A3A',
  reformist: '#2E6FB7',
  eunuch: '#5B3A8E',
};

export function PoliticsPanel(): React.ReactElement {
  const phase = useTangManagerStore((s) => s.phase);
  const day = useTangManagerStore((s) => s.day);
  const decrees = useTangManagerStore((s) => s.decrees ?? []);
const politicsStep = useTangManagerStore((s) => s.politicsStep ?? 0);
const politicsDone = useTangManagerStore((s) => s.politicsDone ?? false);
const currentDecision = useTangManagerStore((s) => s.currentPoliticsDecision ?? null);
const resolvePoliticsDecision = useTangManagerStore((s) => s.resolvePoliticsDecision);
  const factions = useTangManagerStore((s) => s.factions ?? []);
  const court = factions.find((f) => f.id === 'court');
  const politicalFaction = useTangManagerStore((s) => s.politicalFaction);
  const politicalAlignment = useTangManagerStore((s) => s.politicalAlignment ?? 0);
  const credit = useTangManagerStore((s) => s.credit);
  const reputation = useTangManagerStore((s) => s.reputation);
  const silver = useTangManagerStore((s) => s.silver);
  const alignWithFaction = useTangManagerStore((s) => s.alignWithFaction);
  const [confirmReset, setConfirmReset] = useState(false);
  const [confirmOffice, setConfirmOffice] = useState(false);
  const acceptImperialOffice = useTangManagerStore((s) => s.acceptImperialOffice);
  const declineImperialOffice = useTangManagerStore((s) => s.declineImperialOffice);
  const resetGame = useTangManagerStore((s) => s.resetGame);

  const activeDecree = useMemo(() => {
    const sorted = [...decrees].sort((a, b) => b.issuedDay - a.issuedDay);
    const latest = sorted[0];
    if (!latest) return null;
    const impact = checkDecreeImpact(latest, day);
    return impact.decreeId ? { decree: latest, impact } : null;
  }, [decrees, day]);

  const canBid = (activeDecree?.impact.imperialBidOpen ?? false) && credit >= 700;
  const canTransition =
    reputation >= 900 && silver >= 200000 && politicalAlignment >= 80;

  // 官场线占位（phase='politics'：深度玩法后续）
  if (phase === 'politics') {
    return (
      <AncientCard title="巍明楼 · 官场线" accent={ANCIENT.accent}>
        {currentDecision ? (
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold tracking-[0.2em]" style={{ color: ANCIENT.text }}>{currentDecision.title}</span>
              <span className="rounded px-2 py-0.5 text-[10px] tracking-widest" style={{ backgroundColor: ANCIENT.accent, color: '#FFFFFF' }}>
                政务 {Math.min(politicsStep + 1, 5)} / 5
              </span>
            </div>
            <p className="text-sm leading-relaxed" style={{ color: ANCIENT.secondary }}>{currentDecision.description}</p>
            <div className="flex flex-col gap-2">
              {currentDecision.choices.map((ch) => (
                <button
                  key={ch.id}
                  type="button"
                  onClick={() => resolvePoliticsDecision(ch.id)}
                  className="rounded-lg px-3 py-2 text-left text-xs font-bold tracking-wider transition-transform active:scale-[0.99]"
                  style={{ backgroundColor: ANCIENT.card, color: ANCIENT.text, border: `1px solid ${ANCIENT.accent}` }}
                >
                  {ch.label}
                  <span className="mt-0.5 block text-[10px] font-normal" style={{ color: ANCIENT.secondary }}>{ch.consequence}</span>
                </button>
              ))}
            </div>
          </div>
        ) : politicsDone ? (
          <p className="text-sm leading-relaxed tracking-wider" style={{ color: ANCIENT.text }}>
            五道政务一一落定，朝野上下莫不叹服。你立于庙堂之巅，遥望当年长安东市那间老店——恍如隔世。大业已成，权倾朝野。
          </p>
        ) : (
          <p className="text-sm leading-relaxed tracking-wider" style={{ color: ANCIENT.text }}>
            你已踏入庙堂。今日无待办政务，明日自有朝事相询。
          </p>
        )}
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={() => setConfirmReset(true)}
            className="rounded px-3 py-1 text-xs tracking-[0.3em] text-white"
            style={{ backgroundColor: ANCIENT.accent }}
          >
            再开一局
          </button>
        </div>
        {confirmReset && (
          <DangerConfirm
            title="再开一局"
            risk="将结束本局经营，重新从家传手札开始。本局进度（银两/店铺/势力/官场线）全部清零，不可撤销。"
            confirmLabel="放弃本局，再开一局"
            onConfirm={() => resetGame()}
            onClose={() => setConfirmReset(false)}
          />
        )}
      </AncientCard>
    );
  }

  return (
    <AncientCard title="巍明楼 · 权力中枢" accent={ANCIENT.accent}>
      {/* 政令横幅（红诏书样式） */}
      <div
        className="mb-4 rounded-lg px-4 py-3"
        style={{
          backgroundColor: '#8C1F16',
          border: `1px solid ${ANCIENT.gold}`,
          boxShadow: `0 0 0 1px ${ANCIENT.gold} inset`,
          color: '#F7E8C4',
        }}
      >
        <div className="flex items-center gap-2 text-xs tracking-[0.3em]">
          <span>奉天承运 · 皇帝诏曰</span>
          {activeDecree ? (
            <span className="ml-auto text-[10px]">第 {activeDecree.decree.issuedDay} 日起 30 日内</span>
          ) : (
            <span className="ml-auto text-[10px]">本期无新政</span>
          )}
        </div>
        <p className="mt-1 text-sm leading-relaxed tracking-wider">
          {activeDecree ? `${activeDecree.decree.name}：${activeDecree.decree.description}` : '朝中平静，未有政令颁下。'}
        </p>
      </div>

      {/* 六派系关系（简化列表：五势力 + 朝廷派系） */}
      <h4 className="mb-1.5 text-xs font-bold tracking-widest" style={{ color: ANCIENT.secondary }}>六派系关系</h4>
      <div className="mb-3 grid grid-cols-2 gap-1.5 sm:grid-cols-3">
        {factions.map((f) => (
          <div key={f.id} className="rounded-lg px-2 py-1.5" style={{ backgroundColor: ANCIENT.card, border: `1px solid ${f.color}` }}>
            <div className="flex items-center justify-between text-[11px]">
              <span className="font-bold" style={{ color: ANCIENT.text }}>{f.name}</span>
              <span style={{ color: f.color }}>{f.relationship}</span>
            </div>
          </div>
        ))}
      </div>

      {/* 派系详情：朝廷三子派站队 */}
      <div className="mb-3 rounded-lg px-3 py-2" style={{ backgroundColor: ANCIENT.card, border: `1px solid ${court?.color ?? ANCIENT.accent}` }}>
        <div className="flex items-center gap-2 text-sm">
          <span className="font-bold tracking-widest" style={{ color: ANCIENT.text }}>朝廷派系</span>
          <span className="rounded px-1.5 text-[10px] text-white" style={{ backgroundColor: court?.color ?? ANCIENT.accent }}>
            支持 {politicalAlignment}
          </span>
          <span className="ml-auto text-[10px]" style={{ color: ANCIENT.secondary }}>
            现倚：{politicalSubFactionName(politicalFaction ?? null)}
          </span>
        </div>
        <p className="mt-1 text-[11px] leading-relaxed" style={{ color: ANCIENT.secondary }}>
          皇城根下的权力中枢，朝廷政令、派系党争皆出于此。
        </p>
        <div className="mt-2 grid grid-cols-1 gap-1.5 sm:grid-cols-3">
          {POLITICAL_SUB_FACTIONS.map((sub) => {
            const active = politicalFaction === sub.id;
            return (
              <div key={sub.id} className="rounded-lg px-2 py-1.5" style={{ backgroundColor: ANCIENT.background, border: `1px solid ${active ? SUB_COLOR[sub.id] : ANCIENT.border}` }}>
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold" style={{ color: SUB_COLOR[sub.id] }}>{sub.name}</span>
                  {active && <span className="text-[9px]" style={{ color: ANCIENT.accent }}>倚重</span>}
                </div>
                <p className="mt-0.5 text-[10px] leading-snug" style={{ color: ANCIENT.secondary }}>{sub.perk.name}</p>
                <button
                  type="button"
                  onClick={() => alignWithFaction(sub.id)}
                  disabled={active}
                  className="mt-1 w-full rounded px-1.5 py-0.5 text-[10px] tracking-wider disabled:opacity-40"
                  style={{ backgroundColor: active ? ANCIENT.background : SUB_COLOR[sub.id], color: active ? ANCIENT.secondary : '#FFFFFF' }}
                >
                  {active ? '已倚重' : '站队支持'}
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* 皇商招标（条件可用） */}
      <div className="mb-3 rounded-lg px-3 py-2" style={{ backgroundColor: ANCIENT.card, border: `1px solid ${canBid ? ANCIENT.gold : ANCIENT.border}` }}>
        <div className="flex items-center gap-2 text-sm">
          <span className="font-bold tracking-widest" style={{ color: ANCIENT.text }}>皇商招标</span>
          <span className="text-[10px]" style={{ color: ANCIENT.secondary }}>
            {activeDecree?.impact.imperialBidOpen ? '本期招标开放' : '须朝廷下「皇商招标」政令'}
          </span>
        </div>
        <p className="mt-1 text-[11px]" style={{ color: ANCIENT.secondary }}>
          {canBid
            ? '信用已达 700，可应诏参与皇商招标。'
            : credit >= 700
              ? '本期未开招标，静待政令。'
              : `信用需达 700（当前 ${credit}）。`}
        </p>
      </div>

      {/* 从商转政入口（条件高亮） */}
      <div
        className="rounded-lg px-3 py-2"
        style={{
          backgroundColor: canTransition ? '#FBF0E0' : ANCIENT.card,
          border: `2px solid ${canTransition ? ANCIENT.accent : ANCIENT.border}`,
        }}
      >
        <div className="flex items-center gap-2 text-sm">
          <span className="font-bold tracking-widest" style={{ color: ANCIENT.text }}>从商转政</span>
          <span className="ml-auto text-[10px]" style={{ color: canTransition ? ANCIENT.accent : ANCIENT.secondary }}>
            {canTransition ? '巍明楼来帖——皇上要见你' : `声望≥900 · 资金≥200000 · 支持派系≥80（${reputation}/${silver}/${politicalAlignment}）`}
          </span>
        </div>
        {canTransition ? (
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              onClick={() => setConfirmOffice(true)}
              className="flex-1 rounded px-3 py-1.5 text-xs tracking-[0.3em] text-white"
              style={{ backgroundColor: ANCIENT.accent }}
            >
              接受官职，入朝
            </button>
            <button
              type="button"
              onClick={() => declineImperialOffice()}
              className="flex-1 rounded px-3 py-1.5 text-xs tracking-widest"
              style={{ backgroundColor: ANCIENT.background, color: ANCIENT.text, border: `1px solid ${ANCIENT.border}` }}
            >
              婉拒，仍为商贾
            </button>
          </div>
        ) : (
          <p className="mt-1 text-[11px]" style={{ color: ANCIENT.secondary }}>
            声望够高、根基够厚、朝中有人，方可踏足巍明楼。
          </p>
        )}
      </div>

      {/* 从商转政二次确认（朱砂红风险提示） */}
      {confirmOffice && (
        <DangerConfirm
          title="接受官职，入朝"
          risk="将结束商海生涯，转入官场线。店铺经营、商路、货架等将暂停（官场线为占位玩法），此决定不可撤销，请慎重。"
          confirmLabel="入朝为官"
          onConfirm={() => acceptImperialOffice()}
          onClose={() => setConfirmOffice(false)}
        />
      )}
    </AncientCard>
  );
}
