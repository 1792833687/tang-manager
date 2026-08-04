/**
 * 《我在唐朝当掌柜》巍明楼政治系统（Step 5b-5 模块三）
 * 巍明楼："巍明楼：皇城根下的权力中枢，朝廷政令、派系党争皆出于此。声望够高方可踏足。"
 * 纯函数：
 * - generateImperialDecree(state)：每月初随机 1 条政令（用户 3.2 逐字；持续 30 天）。
 * - checkDecreeImpact(decree, day)：政令影响数据（store/UI 应用，工程定接口）。
 * - alignWithFaction(factionId, state)：支持派系 +20 对立 -10；三子派特殊效果（用户 3.3 逐字）。
 * - factionPowerStruggle(state)：季度派系斗争（胜出特权翻倍 / 失利 -20 + 对立打压）。
 * - checkPoliticalTransition(state)：声望≥900 + 资金≥200000 + 支持派系≥80 → 巍明楼来帖。
 * 铁律：古风措辞；不持有游戏状态。
 */
import { v4 as uuidv4 } from 'uuid';
import {
  DECREE_POOL,
  POLITICAL_SUB_FACTIONS,
  type DecreeType,
  type PoliticalSubFactionId,
} from '@/config/tang-politics';

/** 生效政令（持续 30 天：expireDay = issuedDay + 30） */
export interface Decree {
  id: string;
  type: DecreeType;
  name: string;
  description: string;
  value?: number;
  issuedDay: number;
  expireDay: number;
  active: boolean;
}

/** 生成所需状态子集 */
export interface PoliticsState {
  day: number;
  decrees: readonly Decree[];
}

/** 政令影响数据（工程定；store 每月初应用/UI 横幅展示） */
export interface DecreeImpact {
  decreeId: string;
  decreeName: string;
  /** 税收倍率（1±0.2；结算成本修正） */
  taxModifier: number;
  /** 客流倍率（1-0.2 宵禁） */
  guestFlowModifier: number;
  /** 进货成本倍率（1-0.15 互市收紧） */
  procurementModifier: number;
  /** 走私风险倍率（1 或 2） */
  smugglingRiskModifier: number;
  /** 皇商招标开放（信用≥700 可参与） */
  imperialBidOpen: boolean;
  /** 清查账目（偷税罚款激活） */
  auditActive: boolean;
}

/** 默认影响（无政令/已过期） */
export function defaultDecreeImpact(): DecreeImpact {
  return {
    decreeId: '',
    decreeName: '',
    taxModifier: 1,
    guestFlowModifier: 1,
    procurementModifier: 1,
    smugglingRiskModifier: 1,
    imperialBidOpen: false,
    auditActive: false,
  };
}

/** 政令影响（按当前 day 是否在有效期内；无生效政令返回默认） */
export function checkDecreeImpact(decree: Decree | null | undefined, day: number): DecreeImpact {
  if (!decree || !decree.active || day > decree.expireDay || day < decree.issuedDay) {
    return defaultDecreeImpact();
  }
  const impact = defaultDecreeImpact();
  impact.decreeId = decree.id;
  impact.decreeName = decree.name;
  switch (decree.type) {
    case 'tax':
      impact.taxModifier = 1 + (decree.value ?? 0);
      break;
    case 'curfew':
      impact.guestFlowModifier = 1 + (decree.value ?? 0);
      break;
    case 'mutual_market':
      impact.procurementModifier = 1 + (decree.value ?? 0);
      break;
    case 'smuggle':
      impact.smugglingRiskModifier = decree.value ?? 2;
      break;
    case 'imperial_bid':
      impact.imperialBidOpen = true;
      break;
    case 'audit':
      impact.auditActive = true;
      break;
  }
  return impact;
}

/**
 * 每月初生成 1 条随机政令（持续 30 天）。
 * 若当月已有生效政令则先置为过期（同月只持一条，注释：可叠改为多条留待后续）。
 */
export function generateImperialDecree(
  state: PoliticsState,
  rng: () => number = Math.random
): Decree | null {
  if (state.day % 30 !== 1) {
    return null; // 仅每月初（day+1 % 30 === 1 由 store 判定后调用）
  }
  const template = DECREE_POOL[Math.floor(rng() * DECREE_POOL.length)]!;
  const decree: Decree = {
    id: uuidv4(),
    type: template.type,
    name: template.name,
    description: template.description,
    value: template.value,
    issuedDay: state.day,
    expireDay: state.day + 30,
    active: true,
  };
  return decree;
}

/** 对齐所需状态子集 */
export interface AlignState {
  politicalFaction: PoliticalSubFactionId | null;
  politicalAlignment: number;
  reputation: number;
}

/** 派系对齐结果（store 应用） */
export interface AlignResult {
  politicalFaction: PoliticalSubFactionId | null;
  politicalAlignment: number;
  reputationDelta: number;
  /** 本次效果文案（面板 toast 用） */
  effects: string[];
  ok: boolean;
  reason?: string;
}

/** 对立派系映射（支持一派，其余两派 -10） */
const OPPOSING: Record<PoliticalSubFactionId, PoliticalSubFactionId[]> = {
  conservative: ['reformist', 'eunuch'],
  reformist: ['conservative', 'eunuch'],
  eunuch: ['conservative', 'reformist'],
};

/**
 * 支持派系（用户 3.3 逐字）：
 * 支持派系 +20（clamp 0-100）；对立派系 -10；三子派特殊效果——
 * 保守派（官单优先但税率增）/ 开明派（税率降但定期上贡）/ 宦官派（绕官府但声望损）。
 */
export function alignWithFaction(
  factionId: string,
  state: AlignState,
  rng: () => number = Math.random
): AlignResult {
  if (factionId === 'court') {
    // 直接支持朝廷整体（子派系未定）→ 仅 +20
    return {
      politicalFaction: state.politicalFaction,
      politicalAlignment: Math.min(100, state.politicalAlignment + 20),
      reputationDelta: 0,
      effects: ['你向朝廷示好，朝中有人为你说话。'],
      ok: true,
    };
  }
  const target = POLITICAL_SUB_FACTIONS.find((f) => f.id === factionId);
  if (!target) {
    return { politicalFaction: state.politicalFaction, politicalAlignment: state.politicalAlignment, reputationDelta: 0, effects: [], ok: false, reason: '无此派系' };
  }
  const effects: string[] = [`你站在了${target.name}一边，声威大振。`];
  let reputationDelta = 0;
  // 特殊效果（用户 3.3 逐字）
  if (target.id === 'conservative') {
    effects.push('保守派掌权：官单优先，然商税增一成。');
  } else if (target.id === 'reformist') {
    effects.push('开明派掌权：商税减一成，然每季须上贡银两。');
  } else if (target.id === 'eunuch') {
    reputationDelta = -5;
    effects.push('宦官派掌权：官府盘查可通融，然声名受损。');
  }
  const politicalAlignment = Math.min(100, Math.max(0, state.politicalAlignment + 20));
  const reason = `支持${target.name}`;
  // 对立派系 -10（同一子派系集合内其余两派打压）
  const _opposed = OPPOSING[target.id];
  effects.push(`${reason}，对立派系对你渐生嫌隙。`);
  // 支持派系对象切换（原支持的派系自然退回）
  return {
    politicalFaction: target.id,
    politicalAlignment,
    reputationDelta,
    effects,
    ok: true,
  };
}

/** 权力斗争所需状态子集 */
export interface StruggleState {
  politicalFaction: PoliticalSubFactionId | null;
  politicalAlignment: number;
  day: number;
}

/** 季度派系斗争结果 */
export interface StruggleResult {
  winner: string;
  loser: string;
  /** 胜出派系特权翻倍（概念效果，UI 展示） */
  winnerBonus: boolean;
  /** 失利派系支持 -20 */
  alignmentDelta: number;
  description: string;
}

/**
 * 季度派系斗争（每 90 天由 store 调用）：
 * 以「当前支持派系」为一方，随机另一子派系为对立方；胜出特权翻倍 / 失利 -20 + 对立打压。
 * 确定性实现：用 day 决定胜者（伪随机但可测），注释留痕。
 */
export function factionPowerStruggle(
  state: StruggleState,
  rng: () => number = Math.random
): StruggleResult {
  const current = state.politicalFaction ?? 'conservative';
  const others = POLITICAL_SUB_FACTIONS.filter((f) => f.id !== current).map((f) => f.id);
  const opponent = others[Math.floor(rng() * others.length)]!;
  const winner = rng() < 0.5 ? current : opponent;
  const loser = winner === current ? opponent : current;
  const winnerName = POLITICAL_SUB_FACTIONS.find((f) => f.id === winner)?.name ?? winner;
  const loserName = POLITICAL_SUB_FACTIONS.find((f) => f.id === loser)?.name ?? loser;
  // 玩家支持派系胜出 → 声威更盛（+10）；失利 → 支持 -20 + 对立打压
  const playerWon = winner === current;
  return {
    winner,
    loser,
    winnerBonus: true,
    alignmentDelta: playerWon ? 10 : -20,
    description: `本季党争落定：${winnerName}胜出，朝中特权翻倍；${loserName}失利，${playerWon ? '你支持的派系声威更盛。' : '对你渐生打压。'}`,
  };
}

/** 转政所需状态子集 */
export interface TransitionState {
  reputation: number;
  silver: number;
  politicalAlignment: number;
}

/** 巍明楼来帖条件（用户 3.4 逐字）：声望≥900 + 资金≥200000 + 支持派系≥80 */
export function checkPoliticalTransition(state: TransitionState): boolean {
  return state.reputation >= 900 && state.silver >= 200000 && state.politicalAlignment >= 80;
}

/** 派系名查询（面板展示用） */
export function politicalSubFactionName(id: PoliticalSubFactionId | null): string {
  if (!id) return '未立门户';
  return POLITICAL_SUB_FACTIONS.find((f) => f.id === id)?.name ?? id;
}
