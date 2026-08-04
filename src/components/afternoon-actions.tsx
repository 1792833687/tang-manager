/**
 * 每日自由行动（Step 5a 1.2 / 内容深化 TANG-CONT-C 模块二）— 打烊前自由行动阶段
 * - 触发：5 客（C 难度 6 客）接待完、dailyActionsRemaining>0 时自动展示。
 * - 统一展示午后可选行动：图标 + 名称 + 精力消耗 + 简述；精力不足/条件不满足灰显。
 * - 四行动真实逻辑：午后巡查（隐患处置：修缮/延后、训诫/无视、加固/雇护卫）、
 *   拜访NPC（沈听澜/谢七/阿昭/债主，3-5 句对话 + 好感 + 情报）、小睡片刻（+20 精力，30% 突发事件）、
 *   市井闲逛（传闻/捡漏/遇谢七/小偷/无事）——由 store performAfternoonAction 统一执行。
 * - 执行后结果叙事进 eventLog + 浮动反馈（pushActionFeedback）；巡查隐患逐件处置。
 * - 全部 ANCIENT 令牌，古风风格。
 */
'use client';
import { useState } from 'react';
import { getAvailableActions } from '@/systems/tang-actions';
import { visitableNpcs } from '@/systems/tang-afternoon-actions';
import { unrevealedRegions, EXPLORE_ENERGY_COST } from '@/systems/tang-fog';
import { visitableGameNpcs } from '@/systems/tang-npc-system';
import { TANG_NPC_IDS } from '@/config/tang-npcs';
import { useTangManagerStore } from '@/stores/tang-manager';
import { ANCIENT } from '@/theme/tokens';
import type { ActionResult, EmployeeCandidate, PatrolHazard } from '@/types/tang-manager';
import { formatMoney } from '@/lib/format-money';
import { AncientCard } from './ancient-card';
import { pushActionFeedback } from './action-feedback';

/** 行动图标（emoji，古风） */
const ACTION_ICON: Record<string, string> = {
  afternoon_patrol: '🔍',
  visit_npc: '🏮',
  market_recruit: '📜',
  nap: '😴',
  street_wander: '🚶',
  explore_unknown_region: '🗺️',
};

function ActionButton({
  icon,
  label,
  sub,
  onClick,
  disabled,
  reason,
}: {
  icon: string;
  label: string;
  sub: string;
  onClick: () => void;
  disabled?: boolean;
  reason?: string;
}): React.ReactElement {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={reason}
      className="rounded-lg px-3 py-2 text-left transition-transform active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
      style={{ backgroundColor: ANCIENT.card, border: `1px solid ${ANCIENT.border}` }}
    >
      <div className="text-sm font-bold" style={{ color: ANCIENT.text }}>
        <span className="mr-1.5">{icon}</span>
        {label}
      </div>
      <div className="mt-0.5 text-xs leading-relaxed" style={{ color: ANCIENT.secondary }}>
        {sub}
      </div>
      {disabled && reason && (
        <div className="mt-0.5 text-xs" style={{ color: ANCIENT.accent }}>
          {reason}
        </div>
      )}
    </button>
  );
}

/** 巡查隐患处置按钮组（按隐患类型渲染；银两不足时修缮/加固/雇护卫灰显） */
function PatrolHazardCard({
  hazard,
  silver,
  onResolve,
}: {
  hazard: PatrolHazard;
  silver: number;
  onResolve: (hazardId: string, choice: string) => void;
}): React.ReactElement {
  let choices: Array<{ choice: string; label: string; warn?: boolean; cost?: number }> = [];
  if (hazard.kind === 'repair') {
    choices = [
      { choice: 'fix', label: `立即修缮（${formatMoney(hazard.repairCost ?? 0)}）`, cost: hazard.repairCost },
      { choice: 'delay', label: '暂缓（十日内或坍塌）', warn: true },
    ];
  } else if (hazard.kind === 'slack') {
    choices = [
      { choice: 'admonish', label: '训诫一番（满意度-8）' },
      { choice: 'ignore', label: '睁一只眼闭一只眼', warn: true },
    ];
  } else {
    choices = [
      { choice: 'lock', label: `加固门锁（${formatMoney(hazard.lockCost ?? 0)}）`, cost: hazard.lockCost },
      { choice: 'guard', label: `雇护卫看顾（${formatMoney(hazard.guardCost ?? 0)}）`, cost: hazard.guardCost },
    ];
  }
  return (
    <div className="rounded-lg px-3 py-2" style={{ backgroundColor: ANCIENT.background, border: `1px solid ${ANCIENT.accent}` }}>
      <div className="mb-1 text-xs font-bold tracking-widest" style={{ color: ANCIENT.accent }}>
        ⚠️ {hazard.title}
      </div>
      <p className="text-xs leading-relaxed" style={{ color: ANCIENT.text }}>
        {hazard.narrative}
      </p>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {choices.map((c) => {
          const insufficient = c.cost !== undefined && silver < c.cost;
          return (
            <button
              key={c.choice}
              type="button"
              disabled={insufficient}
              title={insufficient ? '银两不足' : undefined}
              onClick={() => onResolve(hazard.id, c.choice)}
              className="rounded-lg px-3 py-1 text-xs font-bold text-white transition-transform active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-40"
              style={{ backgroundColor: c.warn ? ANCIENT.accent : ANCIENT.primary }}
            >
              {c.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function AfternoonActions(): React.ReactElement | null {
  const phase = useTangManagerStore((s) => s.phase);
  const guests = useTangManagerStore((s) => s.guests);
  const energy = useTangManagerStore((s) => s.energy);
  const difficulty = useTangManagerStore((s) => s.difficulty);
  const dailyActionsRemaining = useTangManagerStore((s) => s.dailyActionsRemaining);
  const afternoonActions = useTangManagerStore((s) => s.afternoonActions);
  const employees = useTangManagerStore((s) => s.employees);
  const maxEmployees = useTangManagerStore((s) => s.maxEmployees);
  const xieQiFavor = useTangManagerStore((s) => s.xieQiFavor);
  const shenTinglanFavor = useTangManagerStore((s) => s.shenTinglanFavor);
  const xiaoerFavor = useTangManagerStore((s) => s.xiaoerFavor);
  const legacyDebt = useTangManagerStore((s) => s.legacyDebt);
  const shopType = useTangManagerStore((s) => s.shopType);
  const day = useTangManagerStore((s) => s.day);
  const eventLog = useTangManagerStore((s) => s.eventLog);
  const xieQiIdentityRevealed = useTangManagerStore((s) => s.xieQiIdentityRevealed);
  const pendingPatrolHazards = useTangManagerStore((s) => s.pendingPatrolHazards ?? []);
  const strollBargain = useTangManagerStore((s) => s.strollBargain);
  const silver = useTangManagerStore((s) => s.silver);
  const performAfternoonAction = useTangManagerStore((s) => s.performAfternoonAction);
  const visitNpc = useTangManagerStore((s) => s.visitNpc);
  // TANG-MIST-002：长安故人 · 六位新 NPC（午后拜访可选池扩展）
  const gameNPCs = useTangManagerStore((s) => s.gameNPCs);
  const npcVisitCooldowns = useTangManagerStore((s) => s.npcVisitCooldowns ?? {});
  const resolvePatrolHazard = useTangManagerStore((s) => s.resolvePatrolHazard);
  const buyStrollBargain = useTangManagerStore((s) => s.buyStrollBargain);
  const hireEmployee = useTangManagerStore((s) => s.hireEmployee);
  // TANG-MIST-001：迷雾系统——午后探访未知区域（独立于 performAfternoonAction，见 store 注释）
  const fogOfWar = useTangManagerStore((s) => s.fogOfWar);
  const exploreUnknownRegion = useTangManagerStore((s) => s.exploreUnknownRegion);

  const [lastResult, setLastResult] = useState<ActionResult | null>(null);
  const [candidates, setCandidates] = useState<EmployeeCandidate[] | null>(null);
  const [visitNpcOpen, setVisitNpcOpen] = useState(false);
  const [hiredIds, setHiredIds] = useState<string[]>([]);

  if (phase !== 'playing') {
    return null;
  }
  const allHandled = guests.length > 0 && guests.every((g) => g.handled);
  if (!allHandled) {
    return null;
  }
  // 剩余次数为 0 时仍保留面板以处置巡查隐患/捡漏（不消耗次数）；否则隐藏
  const bargainActive = !!strollBargain && strollBargain.day === day;
  if (dailyActionsRemaining <= 0 && pendingPatrolHazards.length === 0 && !bargainActive) {
    return null;
  }

  const ctx = {
    energy,
    difficulty,
    employees,
    maxEmployees,
    dailyActionsRemaining,
    afternoonActions,
    xieQiFavor,
    shenTinglanFavor,
    legacyDebt,
    shopType,
    day,
    eventLog,
    xieQiIdentityRevealed,
  };
  const options = getAvailableActions(ctx);
  const npcOptions = visitableNpcs({
    shenTinglanFavor,
    xieQiFavor,
    xiaoerFavor,
    legacyDebt,
    eventLog,
    xieQiIdentityRevealed,
    shopType,
  });
  // TANG-MIST-002：长安故人六位并入午后拜访可选池（已登场 + 3 天冷却 + 当日未拜访）
  const gameNpcOptions = visitableGameNpcs(gameNPCs, day, npcVisitCooldowns, afternoonActions);

  const runAction = (actionId: string, npcId?: string): void => {
    // 长安故人（六位新 NPC）走 visitNpc 独立行动；旧四位走 performAfternoonAction（legacy 路径）
    if (actionId === 'visit_npc' && npcId && TANG_NPC_IDS.includes(npcId)) {
      const res = visitNpc(npcId);
      if (!res) {
        pushActionFeedback('今日已拜访过故人，或行动次数/精力不足', 'warning');
        return;
      }
      setLastResult(res);
      setCandidates(res.candidates ?? null);
      setVisitNpcOpen(false);
      pushActionFeedback(res.label, 'success');
      return;
    }
    const result = performAfternoonAction(actionId, npcId ? { npcId } : undefined);
    if (!result) {
      return;
    }
    setLastResult(result);
    setCandidates(result.candidates ?? null);
    setVisitNpcOpen(false);
    const isLoss = (result.goldDelta ?? 0) < 0 || (result.reputationDelta ?? 0) < 0 || (result.xiaoerSatisfactionDelta ?? 0) < 0;
    pushActionFeedback(result.label, isLoss ? 'warning' : 'success');
  };

  const resolveHazard = (hazardId: string, choice: string): void => {
    const res = resolvePatrolHazard(hazardId, choice);
    if (res) {
      pushActionFeedback(res.narrative, (res.goldDelta ?? 0) < 0 || res.postponed ? 'warning' : 'success');
      setLastResult((prev) => (prev ? { ...prev, narrative: res.narrative } : prev));
    }
  };

  const doBuyBargain = (): void => {
    if (buyStrollBargain()) {
      pushActionFeedback(`已购入 ${strollBargain?.itemName ?? ''}（七折）`, 'success');
    } else {
      pushActionFeedback('银两不足或已过时效', 'warning');
    }
  };

  // TANG-MIST-001：探访未知区域（揭示 1-2 个未探明 L2/L3 点位；消耗 10 精力 + 1 次行动）
  const hiddenRegionCount = unrevealedRegions(fogOfWar).length;
  const exploreUsed = afternoonActions.includes('explore_unknown_region');
  const exploreDisabledReason = exploreUsed
    ? '今日已探访过未知区域'
    : dailyActionsRemaining <= 0
      ? '今日行动次数已用完'
      : energy < EXPLORE_ENERGY_COST
        ? `精力不足（需 ${EXPLORE_ENERGY_COST}）`
        : undefined;
  const runExplore = (): void => {
    const res = exploreUnknownRegion();
    if (!res || !res.ok) {
      pushActionFeedback(res?.reason ?? '探访失败', 'warning');
      return;
    }
    setLastResult({ actionId: 'explore_unknown_region', label: '探访未知区域', energyDelta: -EXPLORE_ENERGY_COST, narrative: res.narrative ?? '' });
    setCandidates(null);
    setVisitNpcOpen(false);
    pushActionFeedback('探访归来，探明了几处新去处。', 'success');
  };

  return (
    <AncientCard accent={ANCIENT.gold} title={`午后自由行动（剩余 ${dailyActionsRemaining} 次）`}>
      <p className="mb-3 text-xs tracking-widest" style={{ color: ANCIENT.secondary }}>
        今日客人均已接待，打烊前可自由安排。当前精力 {energy}。
      </p>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {options.map((opt) => (
          <ActionButton
            key={opt.id}
            icon={ACTION_ICON[opt.id] ?? '📜'}
            label={`${opt.label}${opt.energyCost > 0 ? `（-${opt.energyCost} 精力）` : `（+${-opt.energyCost} 精力）`}`}
            sub={opt.description}
            onClick={() => {
              if (opt.id === 'visit_npc') {
                setVisitNpcOpen((v) => !v);
                return;
              }
              runAction(opt.id);
            }}
            disabled={opt.disabled}
            reason={opt.disabledReason}
          />
        ))}
        {/* TANG-MIST-001：探访未知区域（有未探明 L2/L3 点位时出现；独立行动，见 store 注释） */}
        {hiddenRegionCount > 0 && (
          <ActionButton
            icon={ACTION_ICON.explore_unknown_region ?? '🗺️'}
            label={`探访未知区域（-${EXPLORE_ENERGY_COST} 精力）`}
            sub={`专挑平日不常去的巷陌走走，兴许能探明一两处新去处（尚有 ${hiddenRegionCount} 处迷雾未散）。`}
            onClick={runExplore}
            disabled={!!exploreDisabledReason}
            reason={exploreDisabledReason}
          />
        )}
      </div>

      {visitNpcOpen && (
        <div className="mt-3 rounded-lg px-3 py-2" style={{ backgroundColor: ANCIENT.background, border: `1px solid ${ANCIENT.border}` }}>
          <div className="mb-2 text-xs font-bold tracking-widest" style={{ color: ANCIENT.secondary }}>
            拜访谁？
          </div>
          <div className="flex flex-col gap-1.5">
            {[...npcOptions, ...gameNpcOptions].map((npc) => (
              <button
                key={npc.npcId}
                type="button"
                disabled={!!npc.unavailableReason}
                onClick={() => runAction('visit_npc', npc.npcId)}
                className="rounded-lg px-3 py-2 text-left text-sm font-bold transition-transform active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
                style={{ backgroundColor: ANCIENT.card, border: `1px solid ${ANCIENT.border}`, color: ANCIENT.text }}
              >
                {npc.name}
                {npc.unavailableReason && <span className="ml-2 text-xs font-normal" style={{ color: ANCIENT.accent }}>（{npc.unavailableReason}）</span>}
              </button>
            ))}
          </div>
        </div>
      )}

      {pendingPatrolHazards.length > 0 && (
        <div className="mt-3 flex flex-col gap-2">
          {pendingPatrolHazards.map((h) => (
            <PatrolHazardCard key={h.id} hazard={h} silver={silver} onResolve={resolveHazard} />
          ))}
        </div>
      )}

      {strollBargain && strollBargain.day === day && (
        <div className="mt-3 flex items-center justify-between gap-2 rounded-lg px-3 py-2" style={{ backgroundColor: ANCIENT.card, border: `1px solid ${ANCIENT.gold}` }}>
          <div className="min-w-0 flex-1 text-xs leading-relaxed" style={{ color: ANCIENT.text }}>
            <span className="font-bold" style={{ color: ANCIENT.gold }}>今日捡漏：</span>
            {strollBargain.itemName} 七折 {formatMoney(strollBargain.price)}（限今日）
          </div>
          <button
            type="button"
            disabled={silver < strollBargain.price}
            onClick={doBuyBargain}
            className="shrink-0 rounded-lg px-3 py-1 text-xs font-bold text-white transition-transform active:scale-[0.97] disabled:opacity-40"
            style={{ backgroundColor: ANCIENT.primary }}
          >
            购入
          </button>
        </div>
      )}

      {candidates && candidates.length > 0 && (
        <div className="mt-3 rounded-lg px-3 py-2" style={{ backgroundColor: ANCIENT.background, border: `1px solid ${ANCIENT.primary}` }}>
          <div className="mb-2 text-xs font-bold tracking-widest" style={{ color: ANCIENT.primary }}>
            集市候选（可雇佣，次日到岗）
          </div>
          <div className="flex flex-col gap-1.5">
            {candidates.map((c) => (
              <div key={c.id} className="flex items-center justify-between gap-2 rounded-lg px-3 py-2" style={{ backgroundColor: ANCIENT.card, border: `1px solid ${ANCIENT.border}` }}>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-bold" style={{ color: ANCIENT.text }}>
                    {c.name}
                    <span className="ml-2 text-xs font-normal" style={{ color: ANCIENT.secondary }}>
                      {c.skills.map((sk) => sk.name).join(' / ') || '无特殊技艺'} · 月钱 {formatMoney(c.salary)}
                    </span>
                  </div>
                  {c.isSpecial && <div className="text-xs" style={{ color: ANCIENT.accent }}>此人来历有些蹊跷……</div>}
                </div>
                <button
                  type="button"
                  disabled={hiredIds.includes(c.id)}
                  onClick={() => {
                    if (hireEmployee(c)) {
                      setHiredIds((h) => [...h, c.id]);
                    }
                  }}
                  className="shrink-0 rounded-lg px-4 py-1.5 text-sm font-bold text-white transition-transform active:scale-[0.97] disabled:opacity-40"
                  style={{ backgroundColor: hiredIds.includes(c.id) ? ANCIENT.border : ANCIENT.primary }}
                >
                  {hiredIds.includes(c.id) ? '已雇佣' : '雇佣'}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {lastResult && (
        <div className="mt-3 rounded-lg px-3 py-2 text-sm leading-relaxed" style={{ backgroundColor: ANCIENT.card, border: `1px solid ${ANCIENT.gold}` }}>
          <div className="mb-1 text-xs font-bold tracking-widest" style={{ color: ANCIENT.gold }}>
            {lastResult.label}
          </div>
          <p style={{ color: ANCIENT.text }}>{lastResult.narrative}</p>
          {lastResult.dialogue && lastResult.dialogue.length > 0 && (
            <div className="mt-2 flex flex-col gap-1">
              {lastResult.dialogue.map((line, i) => (
                <p key={i} className="text-xs leading-relaxed" style={{ color: ANCIENT.secondary }}>
                  {line}
                </p>
              ))}
            </div>
          )}
        </div>
      )}
    </AncientCard>
  );
}
