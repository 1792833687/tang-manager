/**
 * 「我」面板（Step 2 增强 + Step 5b 信用展示 + 体验优化）
 * 店铺名/位置/掌柜/资金负债偿债进度/声望称号/特殊能力/精力/评分/员工/收益。
 * 体验优化（模块四）：店铺信息区缩小、特殊能力紧凑；模块一新增天机阁状态行（可点击配置弹窗）。
 * Step 2 新增：今日营收（已接待收入预估，结算统一入账）、今日客数。
 * Step 5b 新增：信用值 + 档位（颜色标识）+ 最近 5 条记录 + 可用特权。
 */
'use client';
import { useEffect, useState } from 'react';
import { getDifficultyParams } from '@/config/tang-difficulty';
import { AGE_LABELS, AZHAO_PLAYING_LINE, reputationTitle } from '@/config/tang-narrative';
import { shopDisplayName } from '@/config/tang-shop-types';
import { useTangManagerStore } from '@/stores/tang-manager';
import { loadTangAiConfig } from '@/systems/tang-api-test';
import { estimateShopValue } from '@/systems/tang-shop-sale';
import { BUSINESS_STRATEGY_LABEL } from '@/systems/tang-business-strategy';
import { ANCIENT } from '@/theme/tokens';
import { withBase } from '@/lib/utils/base-path';
import { formatMoney } from '@/lib/format-money';
import { AncientCard } from './ancient-card';
import { ApiConfigModal } from './api-config-modal';
import { CreditPanel } from './credit-panel';
import { BusinessStrategySelector } from './business-strategy-selector';
import { DangerConfirm } from './danger-confirm';
import { pushActionFeedback } from './action-feedback';
import { IndustryPanel } from './tang-manager/industry-panel';

/** 分店序名（天干；shopCount-1 家分店依次命名） */
const BRANCH_LABELS = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'] as const;

/** 星级渲染（score 1.0-5.0）— 唐风梅花图标替代 ★ */
function StarRow({ score }: { score: number }): React.ReactElement {
  const filled = Math.round(score);
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: 5 }, (_, i) => (
        <img key={i} src={withBase('/images/icons/star.svg')} alt="" aria-hidden className="h-4 w-4" style={{ opacity: i < filled ? 1 : 0.22 }} />
      ))}
      <span className="ml-2 text-sm font-bold" style={{ color: ANCIENT.text }}>{score.toFixed(1)}</span>
    </div>
  );
}

/** 通用进度条（8px 紧凑版） */
function ProgressRow({ label, value, ratio, barColor }: { label: string; value: string; ratio: number; barColor: string }): React.ReactElement {
  return (
    <div className="flex flex-col gap-0.5">
      <div className="flex items-center justify-between text-xs">
        <span style={{ color: ANCIENT.secondary }}>{label}</span>
        <span className="font-semibold" style={{ color: ANCIENT.text }}>{value}</span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full" style={{ backgroundColor: ANCIENT.background }}>
        <div style={{ width: `${Math.min(100, Math.max(0, ratio * 100))}%`, height: '100%', backgroundColor: barColor }} />
      </div>
    </div>
  );
}

function InfoCell({ label, value }: { label: string; value: string }): React.ReactElement {
  return (
    <div className="rounded-md px-2 py-1.5" style={{ backgroundColor: ANCIENT.background, border: `1px solid ${ANCIENT.border}` }}>
      <div className="text-[11px]" style={{ color: ANCIENT.secondary }}>{label}</div>
      <div className="text-xs font-semibold" style={{ color: ANCIENT.text }}>{value}</div>
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }): React.ReactElement {
  return (
    <div className="flex items-center justify-between text-xs">
      <span style={{ color: ANCIENT.secondary }}>{label}</span>
      <span className="font-semibold" style={{ color: ANCIENT.text }}>{value}</span>
    </div>
  );
}

export function MePanel(): React.ReactElement {
  const state = useTangManagerStore();
  const shopName = state.shopType !== null ? shopDisplayName(state.shopType) : '陆记';
  const ageLabel = state.player !== null ? AGE_LABELS[state.player.age] : '—';
  const title = reputationTitle(state.reputation);
  const params = getDifficultyParams(state.difficulty);
  const debtRatio = Math.min(1, Math.max(0, 1 - state.legacyDebt / params.initialDebt));
  // 今日营收 = 已处理客人的接待收入之和（结算统一入账，此处为当日预估）
  const handled = state.guests.filter((g) => g.handled);
  const todayIncome = handled.reduce((sum, g) => sum + (g.incomeEarned ?? 0), 0);

  // 天机阁状态（模块一）：已通/未启；点击打开配置弹窗
  const [tianjiOpen, setTianjiOpen] = useState(false);
  const [tianjiOk, setTianjiOk] = useState(false);
  useEffect(() => {
    let cancelled = false;
    void loadTangAiConfig().then((cfg) => {
      if (!cancelled) setTianjiOk(!!cfg?.configured && !!cfg?.apiKey);
    });
    return () => { cancelled = true; };
  }, [tianjiOpen]);

  // 内容深化 TANG-CONT-B 模块一：变卖分店二次确认（null 关闭）
  const [sellOpen, setSellOpen] = useState(false);
  const branchCount = Math.max(0, (state.shopCount ?? 1) - 1);
  const branchValuation = estimateShopValue();
  const strategy = state.businessStrategy ?? 'steady';

  // 新手引导（TANG-TUT-002）：重置入口「重读家传手札」（确认后 resetAllTutorials）
  const [resetTutorialOpen, setResetTutorialOpen] = useState(false);
  // P0（2026-08-05）：重新开档入口——有存档的玩家可清档重走开局（身份/店型/难度）
  const [resetGameOpen, setResetGameOpen] = useState(false);
  const handleResetGame = (): void => {
    state.resetGame();
    pushActionFeedback('已重新开档，回到开局', 'success');
  };
  const handleResetTutorials = (): void => {
    state.resetAllTutorials();
    pushActionFeedback('家传手札已重置，重新研读', 'success');
  };

  const handleSellConfirm = (): void => {
    const res = state.sellShop();
    if (res.ok) {
      pushActionFeedback('变卖完成', 'success');
      if ((res.laidOffNames ?? []).length > 0) {
        pushActionFeedback(`伙计${res.laidOffNames!.join('、')}已离店`, 'warning');
      }
    } else {
      pushActionFeedback(res.reason ?? '变卖失败', 'warning');
    }
    setSellOpen(false);
  };

  return (
    <div className="grid gap-3 lg:grid-cols-3">
      <IndustryPanel />
      <AncientCard className="lg:col-span-2" title="我">
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-lg font-bold tracking-[0.2em]" style={{ color: ANCIENT.primary }}>{shopName}</h2>
            <span className="text-xs tracking-widest" style={{ color: ANCIENT.secondary }}>长安东市 · 永乐坊</span>
          </div>
          <div className="flex flex-wrap gap-x-5 gap-y-0.5 text-xs" style={{ color: ANCIENT.secondary }}>
            <span>掌柜：{state.player?.name ?? '—'}</span>
            <span>{ageLabel}</span>
            <span>经营第 {state.day} 日</span>
          </div>
          <div className="flex flex-col gap-2">
            <ProgressRow label="资金" value={formatMoney(state.silver)} ratio={state.silver / (state.silver + state.legacyDebt || 1)} barColor={ANCIENT.primary} />
            <ProgressRow label="负债 · 偿债进度" value={formatMoney(state.legacyDebt)} ratio={debtRatio} barColor={ANCIENT.accent} />
            <ProgressRow label="飞钱" value={formatMoney(state.feiqian)} ratio={Math.min(1, (state.feiqian ?? 0) / Math.max(1, state.silver))} barColor={ANCIENT.gold} />
            <ProgressRow label="今日精力" value={`${state.energy}%`} ratio={state.energy / 100} barColor={ANCIENT.secondary} />
          </div>
          {state.legacyDebt > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs" style={{ color: ANCIENT.secondary }}>偿还债务：</span>
              <button type="button" onClick={() => state.repayDebt(10)} disabled={state.silver < 10} className="rounded px-2 py-0.5 text-xs font-bold tracking-widest disabled:opacity-40" style={{ backgroundColor: ANCIENT.secondary, color: '#FFFFFF' }}>还 10 两</button>
              <button type="button" onClick={() => state.repayDebt(50)} disabled={state.silver < 50} className="rounded px-2 py-0.5 text-xs font-bold tracking-widest disabled:opacity-40" style={{ backgroundColor: ANCIENT.border, color: '#FFFFFF' }}>还 50 两</button>
            </div>
          )}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs" style={{ color: ANCIENT.secondary }}>声望 {state.reputation} · {title}</span>
            <StarRow score={state.score} />
          </div>
          {/* 特殊能力紧凑卡（模块四） */}
          <div className="grid grid-cols-3 gap-2">
            <InfoCell label="通晓人心" value={`×${state.insightRemaining}`} />
            <InfoCell label="福星高照" value={`×${state.luckRemaining}`} />
            <InfoCell label="今日客数" value={`${handled.length} / ${state.guests.length}`} />
            <InfoCell label="今日营收" value={formatMoney(todayIncome)} />
            <InfoCell label="员工数" value="1（阿昭）" />
            <InfoCell label="月息" value={formatMoney(state.monthlyInterest)} />
          </div>
          {/* 手札叙事（AI）开关（4.4）— 关闭/离线/失败时叙事降级为预设模板，不影响经营 */}
          <div className="flex items-center justify-between rounded-md px-2 py-1.5" style={{ backgroundColor: ANCIENT.background, border: `1px solid ${ANCIENT.border}` }}>
            <span className="text-xs" style={{ color: ANCIENT.secondary }}>手札叙事（AI）</span>
            <button type="button" onClick={() => state.setAiNarrationEnabled(!state.aiNarrationEnabled)} className="rounded px-3 py-0.5 text-xs font-bold tracking-widest" style={{ backgroundColor: state.aiNarrationEnabled ? ANCIENT.primary : ANCIENT.border, color: '#FFFFFF' }}>
              {state.aiNarrationEnabled ? '开启' : '关闭'}
            </button>
          </div>
          {/* 天机阁状态行（模块一）：点击打开配置弹窗 */}
          <button
            type="button"
            onClick={() => setTianjiOpen(true)}
            className="flex items-center justify-between rounded-md px-2 py-1.5 text-xs font-bold tracking-widest transition-opacity hover:opacity-85"
            style={{ backgroundColor: tianjiOk ? '#EAF3EA' : ANCIENT.background, border: `1px solid ${tianjiOk ? ANCIENT.primary : ANCIENT.border}`, color: tianjiOk ? ANCIENT.primary : ANCIENT.secondary }}
          >
            <span>{tianjiOk ? '天机阁：已通 ✅' : '天机阁：未启 ⚠️'}</span>
            <span className="font-normal">{tianjiOk ? '点击配置' : '未配置用降级模板'}</span>
          </button>
        </div>
      </AncientCard>

      <AncientCard accent={ANCIENT.primary} title="经营摘要">
        <div className="flex flex-col gap-1.5 text-xs">
          <SummaryRow label="店型" value={shopName.replace('陆记', '')} />
          <SummaryRow label="难度" value={params.label} />
          <SummaryRow label="格言" value={params.tagline} />
          <SummaryRow label="评分" value={state.score.toFixed(1)} />
          <SummaryRow label="小二好感" value={`${state.xiaoerFavor}`} />
          <SummaryRow label="小二满意度" value={`${state.xiaoerSatisfaction}`} />
          <SummaryRow label="沈听澜好感" value={`${state.shenTinglanFavor}`} />
          <SummaryRow label="谢七好感" value={`${state.xieQiFavor}`} />
          {state.shenDebt && <SummaryRow label="人情" value="欠沈听澜一个情" />}
          {state.gamblingAddictionDays > 0 && <SummaryRow label="赌瘾" value={`剩 ${state.gamblingAddictionDays} 日`} />}
          <SummaryRow label="经营策略" value={BUSINESS_STRATEGY_LABEL[strategy]} />
        </div>
        <p className="mt-3 text-xs leading-relaxed" style={{ color: ANCIENT.secondary }}>{AZHAO_PLAYING_LINE}</p>
      </AncientCard>

      {/* 店铺 · 家业（内容深化 TANG-CONT-B 模块一）：主店 + 分店卡片 + 经营策略 */}
      <AncientCard accent={ANCIENT.gold} className="lg:col-span-3" title="店铺 · 家业">
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {/* 祖传老店：不可变卖 */}
          <div className="rounded-lg px-3 py-2" style={{ backgroundColor: ANCIENT.card, border: `1px solid ${ANCIENT.gold}` }}>
            <div className="flex items-center justify-between text-sm">
              <span className="font-bold tracking-widest" style={{ color: ANCIENT.text }}>祖传老店</span>
              <span className="rounded px-1.5 py-0.5 text-[10px] text-white" style={{ backgroundColor: ANCIENT.gold }}>本店</span>
            </div>
            <p className="mt-1 text-[11px] leading-relaxed" style={{ color: ANCIENT.secondary }}>
              长安东市 · 永乐坊。你祖上传下来的铺面，是立足之本。
            </p>
            <p className="mt-1.5 text-[10px] tracking-widest" style={{ color: ANCIENT.border }}>
              此乃祖传老店，不可变卖
            </p>
          </div>
          {/* 分店（抽象计数：每张卡代表一家分店，变卖一家 → shopCount -1） */}
          {branchCount > 0 &&
            Array.from({ length: branchCount }, (_, i) => (
              <div key={i} className="rounded-lg px-3 py-2" style={{ backgroundColor: ANCIENT.background, border: `1px solid ${ANCIENT.border}` }}>
                <div className="flex items-center justify-between text-sm">
                  <span className="font-bold tracking-widest" style={{ color: ANCIENT.text }}>
                    分店 · {BRANCH_LABELS[i] ?? `${i + 1}号`}
                  </span>
                  <span className="rounded px-1.5 py-0.5 text-[10px] text-white" style={{ backgroundColor: ANCIENT.secondary }}>分号</span>
                </div>
                <p className="mt-1 text-[11px] leading-relaxed" style={{ color: ANCIENT.secondary }}>
                  估值约 {formatMoney(branchValuation)} 两（累计投入×七成）。变卖后此店不复存在。
                </p>
                <button
                  type="button"
                  onClick={() => setSellOpen(true)}
                  className="mt-1.5 rounded px-2.5 py-1 text-[10px] tracking-widest text-white transition-opacity hover:opacity-90"
                  style={{ backgroundColor: ANCIENT.accent }}
                >
                  变卖
                </button>
              </div>
            ))}
        </div>
        {/* 经营策略（内容深化 TANG-CONT-B 模块六·1）：薄利多销/奇货可居/稳健经营 */}
        <div className="mt-3 border-t pt-2" style={{ borderColor: ANCIENT.border }}>
          <BusinessStrategySelector />
        </div>
      </AncientCard>

      <CreditPanel />
      <ApiConfigModal open={tianjiOpen} onClose={() => setTianjiOpen(false)} />

      {/* 新手引导（TANG-TUT-002）：底部小字「重读家传手札」→ 确认重置 */}
      <div className="flex justify-center">
        <button
          type="button"
          onClick={() => setResetTutorialOpen(true)}
          className="text-[11px] tracking-widest underline-offset-2 transition-opacity hover:opacity-80 hover:underline"
          style={{ color: ANCIENT.border }}
        >
          重读家传手札
        </button>
        <span style={{ color: ANCIENT.border }}>·</span>
        <button
          type="button"
          onClick={() => setResetGameOpen(true)}
          className="text-[11px] tracking-widest underline-offset-2 transition-opacity hover:opacity-80 hover:underline"
          style={{ color: ANCIENT.accent }}
        >
          重新开档
        </button>
      </div>

      {/* 变卖分店二次确认（内容深化 TANG-CONT-B 模块一；DangerConfirm 复用） */}
      {sellOpen && (
        <DangerConfirm
          title="变卖分店"
          risk={`店铺估值约${formatMoney(branchValuation)}两（累计投入×七成）。变卖后此店不复存在，店内伙计需逐一遣散或调往他店。是否继续？`}
          confirmLabel="确认变卖"
          onConfirm={handleSellConfirm}
          onClose={() => setSellOpen(false)}
        />
      )}

      {/* 重读家传手札确认（新手引导；DangerConfirm 复用） */}
      {resetTutorialOpen && (
        <DangerConfirm
          title="重读家传手札"
          risk="将重置全部新手引导：已读家传手札与阿昭提醒重新弹出，可按先前顺序再次研读。是否继续？"
          confirmLabel="重读"
          onConfirm={handleResetTutorials}
          onClose={() => setResetTutorialOpen(false)}
        />
      )}
      {/* 重新开档确认（P0；DangerConfirm 复用） */}
      {resetGameOpen && (
        <DangerConfirm
          title="重新开档"
          risk="将清除当前存档，回到开局重新选择身份/店型/难度（已解锁成就与局外成长记录保留）。是否继续？"
          confirmLabel="放弃本局，重新开档"
          onConfirm={handleResetGame}
          onClose={() => setResetGameOpen(false)}
        />
      )}
    </div>
  );
}
