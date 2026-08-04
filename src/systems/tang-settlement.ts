/**
 * 《我在唐朝当掌柜》结算系统（Step 2 需求 2.4；Step 5a 1.3 难度微调 / 2.6 员工影响）
 * 纯函数：settleDay 接收 state 快照与可选 rng，返回结算结果（settlement/账本条目/
 * 各类变更/新解锁成就/变更建议），由 store action 应用变更。
 *
 * 规则摘要：
 * - 基础收益：评分档位区间随机 × 员工效率系数（满意度 ≥80→1.2 / 60-79→1.0 / 40-59→0.8 / <40→0.5）
 *   档位：1.0-1.9→5-10、2.0-2.9→10-20、3.0-3.9→20-35、4.0-4.4→35-55、4.5-5.0→55-80（<1.0 按最低档）
 * - 员工影响（2.6）：在职员工（restToday 除外）——
 *   ① 平均满意度≥80 → 基础收益系数 +0.1
 *   ② 有对应店型技师（chef/tailor/pharmacist）→ 出品品质评分额外 +0.2~0.5（随机，按技师技能）
 *   ③ 有账房 → 随机支出（管理不善丢失/赊账跑路）概率 -30%
 *   ④ 有护卫 → 管理不善丢失（小偷）概率 -50%（差评师概率 -50% 见 startNewDay 接线）
 *   ⑤ 过劳继续工作（满意度<30 且当日工作）→ 满意度每日 -5，连续 3 天触发崩溃离职
 *   ⑥ 员工改进建议（2.5）：employeeBonusRate>0 → 基础收益 ×(1+rate)（昨日事件顺延生效）
 * - 难度微调（1.3）：penaltyChance 触发时基础收益 ×(0.5~0.8) 打折；
 *   特殊支出概率按 specialExpenseChance 调整（B 标准 / A 减半 / C 翻倍）
 * - 客单消费 = 已处理客人（handled=true）的 incomeEarned 总和（不写死 5，C 难度 6 客）
 * - 当日支出：随机 1-2 项店型采购 + 概率项（管理不善丢失/赊账跑路，按难度与账房/护卫调整）
 * - 净收益 = 基础收益 + 客单消费 - 支出
 * - 评分变动：每单 good +0.01 / bad -0.02；day%10===0 且 day>0 时 +0.05；上限 5.0
 * - 声望变动：当日有夸奖（20% 夸奖累计 或 好评≥3）+2；有身份光顾（big_order/special 已接待）+5
 * - 小二好感：净收益>0 → +1；<0 → -1（每日仅结算一次）
 * - 精力消耗 = dailyEnergyConsumed（接待累计 + 自由行动消耗）
 * - 成就检测：checkAchievements(gameState, settlement)
 * - 赌瘾剧情（3.3）：gamblingAddictionDays>0 时结算递减并在 settlement.gamblingLine 展示一行
 */
import { getDifficultyParams } from '@/config/tang-difficulty';
import { checkAchievements } from '@/config/tang-achievements';
import { businessStrategyIncomeFactor } from '@/systems/tang-business-strategy';
import { applyPriceIndex } from '@/systems/tang-inflation';
import { ATMOSPHERE_HIGH, ATMOSPHERE_HIGH_FACTOR, ATMOSPHERE_LOW, ATMOSPHERE_LOW_FACTOR } from '@/systems/tang-atmosphere';
import type { DaySettlement, Difficulty, Employee, LedgerEntry, ShopType, TangGameState } from '@/types/tang-manager';

/** settleDay 返回：结算结果 + 由 store 应用的变更建议 */
export interface SettleDayResult {
  settlement: DaySettlement;
  ledgerEntries: LedgerEntry[];
  scoreChange: number;
  reputationChange: number;
  xiaoerFavorChange: number;
  newlyUnlocked: string[];
  suggestions: Partial<TangGameState>;
}

/** 评分档位 → 基础收益区间（两） */
const SCORE_BRACKETS: ReadonlyArray<{ min: number; max: number; range: readonly [number, number] }> = [
  { min: 1.0, max: 1.9, range: [5, 10] },
  { min: 2.0, max: 2.9, range: [10, 20] },
  { min: 3.0, max: 3.9, range: [20, 35] },
  { min: 4.0, max: 4.4, range: [35, 55] },
  { min: 4.5, max: 5.0, range: [55, 80] },
];

/** 店型 → 当日采购支出定义 */
const PROCUREMENT: Record<ShopType, { project: string; min: number; max: number }> = {
  jiulou: { project: '采购食材', min: 3, max: 8 },
  buzhuang: { project: '布匹损耗', min: 2, max: 5 },
  yaopu: { project: '药材补货', min: 1, max: 4 },
};

/** 店型 → 客单消费账目文案 */
const GUEST_LEDGER_PROJECT: Record<ShopType, string> = {
  jiulou: '胡商宴席',
  buzhuang: '布匹成交',
  yaopu: '药材售出',
};

/** 店型 → 对应技师员工类型（2.6 ②） */
export const TECHNICIAN_BY_SHOP: Record<ShopType, Employee['type']> = {
  jiulou: 'chef',
  buzhuang: 'tailor',
  yaopu: 'pharmacist',
};

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function randIn(min: number, max: number, rng: () => number): number {
  return min + rng() * (max - min);
}

/** 员工效率系数：满意度 ≥80→1.2 / 60-79→1.0 / 40-59→0.8 / <40→0.5 */
export function satisfactionCoefficient(satisfaction: number): number {
  if (satisfaction >= 80) return 1.2;
  if (satisfaction >= 60) return 1.0;
  if (satisfaction >= 40) return 0.8;
  return 0.5;
}

/** 评分 → 基础收益区间；评分 <1.0（如 C 难度初始 0.8）按最低档处理 */
export function scoreBracketBase(score: number): readonly [number, number] {
  for (const b of SCORE_BRACKETS) {
    if (score >= b.min && score <= b.max) {
      return b.range;
    }
  }
  if (score < 1.0) {
    return SCORE_BRACKETS[0]!.range;
  }
  return SCORE_BRACKETS[SCORE_BRACKETS.length - 1]!.range;
}

/**
 * 当日支出：1-2 项店型采购（各自随机金额）+ 概率项。
 * 概率项（1.3/2.6）：
 * - 管理不善丢失：基准 0.1 × specialExpenseChance（A 0.05 / B 0.1 / C 0.2）；
 *   有护卫 ×0.5（小偷事件 -50%）、有账房 ×0.7（随机支出 -30%）
 * - 赊账跑路：基准 0.05 × specialExpenseChance（A 0.025 / B 0.05 / C 0.1）；有账房 ×0.7
 */
function pickExpenses(
  shopType: ShopType,
  difficulty: Difficulty,
  rng: () => number,
  modifiers: { hasAccountant: boolean; hasGuard: boolean }
): { project: string; amount: number }[] {
  const def = PROCUREMENT[shopType] ?? PROCUREMENT.jiulou;
  const count = rng() < 0.5 ? 1 : 2;
  const items: { project: string; amount: number }[] = [];
  for (let i = 0; i < count; i++) {
    items.push({ project: def.project, amount: round1(randIn(def.min, def.max, rng)) });
  }
  // 特殊支出倍率（B 标准 / A 减半 / C 翻倍）
  const expenseMult = getDifficultyParams(difficulty).specialExpenseChance;
  const acctFactor = modifiers.hasAccountant ? 0.7 : 1; // 账房：随机支出概率 -30%
  const lossRate = 0.1 * expenseMult * acctFactor * (modifiers.hasGuard ? 0.5 : 1); // 小偷/丢失：护卫 -50%
  if (rng() < lossRate) {
    items.push({ project: '管理不善丢失', amount: round1(randIn(1, 5, rng)) });
  }
  const runawayRate = 0.05 * expenseMult * acctFactor; // 赊账跑路：账房 -30%
  if (rng() < runawayRate) {
    items.push({ project: '赊账跑路', amount: round1(randIn(3, 10, rng)) });
  }
  return items;
}

/**
 * 过劳处理（2.6 ⑤）：满意度<30 且当日工作 → 满意度 -5、overworkDays+1；
 * 连续 3 天触发崩溃离职（返回剩余员工 + 离职名单）。
 */
export function applyOverwork(employees: readonly Employee[]): { employees: Employee[]; quitIds: string[] } {
  const quitIds: string[] = [];
  const next: (Employee | null)[] = employees.map((e): Employee | null => {
    if (e.restToday) {
      // 休假：当日不工作，清空休假标记
      return { ...e, restToday: false };
    }
    if (e.satisfaction < 30) {
      const overworkDays = (e.overworkDays ?? 0) + 1;
      if (overworkDays >= 3) {
        quitIds.push(e.id);
        return null;
      }
      return { ...e, satisfaction: Math.max(0, e.satisfaction - 5), overworkDays };
    }
    return { ...e, restToday: false };
  });
  return {
    employees: next.filter((e): e is Employee => e !== null),
    quitIds,
  };
}

/** 平均满意度（在职员工） */
function averageSatisfaction(employees: readonly Employee[]): number {
  if (employees.length === 0) return 0;
  return employees.reduce((s, e) => s + e.satisfaction, 0) / employees.length;
}

export function settleDay(state: TangGameState, rng: () => number = Math.random): SettleDayResult {
  const day = state.day;
  const shopType: ShopType = state.shopType ?? 'jiulou';
  const handledGuests = state.guests.filter((g) => g.handled);

  // 客单消费 = 已处理客人的接待收入总和（不写死 5；C 难度 6 客）
  const guestIncome = round1(handledGuests.reduce((s, g) => s + (g.incomeEarned ?? 0), 0));

  // 员工状态（2.6）：在职、非休假
  // 内容深化 TANG-CONT-C 模块二：当日偷懒未训诫的员工（slackingEmployeeIds）不计入加成（效率-30% 近似）
  const employees = state.employees ?? [];
  const activeEmployees = employees.filter(
    (e) => !e.restToday && !(state.slackingEmployeeIds ?? []).includes(e.id)
  );
  const avgSatisfaction = averageSatisfaction(activeEmployees);
  const technicianType = TECHNICIAN_BY_SHOP[shopType];
  const hasTechnician = activeEmployees.some((e) => e.type === technicianType);
  const hasAccountant = activeEmployees.some((e) => e.type === 'accountant');
  const hasGuard = activeEmployees.some((e) => e.type === 'guard');

  // 基础收益 = 档位区间随机 × 员工效率系数（平均满意度≥80 → +0.1）
  const bracket = scoreBracketBase(state.score);
  let coef = satisfactionCoefficient(state.xiaoerSatisfaction);
  if (avgSatisfaction >= 80) {
    coef += 0.1;
  }
  let baseIncome = round1(randIn(bracket[0]!, bracket[1]!, rng) * coef);

  // 出品品质加成（2.6 ②）：对应店型技师 → 额外 +0.2~0.5（随机，按技师技能：有品质技能再 +0.1）
  if (hasTechnician) {
    const technicianHasQuality = activeEmployees.some(
      (e) => e.type === technicianType && e.skills.some((sk) => sk.type === 'quality')
    );
    const bonus = clamp(0.2 + rng() * 0.3, 0.2, 0.5) + (technicianHasQuality ? 0.1 : 0);
    baseIncome = round1(baseIncome * (1 + Math.min(0.5, bonus)));
  }

  // 难度惩罚（1.3）：penaltyChance 触发 → 基础收益 ×(0.5~0.8) 打折
  const penaltyChance = getDifficultyParams(state.difficulty).penaltyChance;
  if (rng() < penaltyChance) {
    baseIncome = round1(baseIncome * (0.5 + rng() * 0.3));
  }

  // 员工改进建议（2.5 ⑥）：昨日事件顺延的加成今日消费并清零
  const employeeBonusRate = state.employeeBonusRate ?? 0;
  if (employeeBonusRate > 0) {
    baseIncome = round1(baseIncome * (1 + employeeBonusRate));
  }

  // 经营策略（内容深化 TANG-CONT-B 模块六·1）：薄利多销 基础收益×0.8 / 奇货可居 ×1.3 / 稳健 1
  // （grep 确认原无 businessStrategy 字段，此处为新增接线；客人数修正见 startNewDay 客流生成）
  const strategyFactor = businessStrategyIncomeFactor(state.businessStrategy);
  if (strategyFactor !== 1) {
    baseIncome = round1(baseIncome * strategyFactor);
  }

  // 物价指数（5b 5.x）：基础收益 ×priceIndex（涨薪阈值随 priceIndex 为注释预留，未实装）
  const priceIndex = state.priceIndex ?? 1;
  baseIncome = round1(applyPriceIndex(baseIncome, priceIndex));

  // 气氛影响消费意愿（TANG-RCP-001 3.1）：高气氛≥70 +10% / 低气氛<30 -15%（工程定值，注释）
  const atmosphere = state.shopAtmosphere ?? 50;
  let atmosphereFactor = 1;
  if (atmosphere >= ATMOSPHERE_HIGH) atmosphereFactor = ATMOSPHERE_HIGH_FACTOR;
  else if (atmosphere < ATMOSPHERE_LOW) atmosphereFactor = ATMOSPHERE_LOW_FACTOR;
  if (atmosphereFactor !== 1) {
    baseIncome = round1(baseIncome * atmosphereFactor);
  }

  // 当日支出（进货成本 ×priceIndex）
  const expenses = pickExpenses(shopType, state.difficulty, rng, { hasAccountant, hasGuard });
  const totalExpense = round1(
    expenses.reduce((s, e) => s + applyPriceIndex(e.amount, priceIndex), 0)
  );

  // 仓储费（TANG-S5B15-002 统一口径）：不再按日扣「超出 maxStorage」旧逻辑（tang-inflation 已标记 deprecated）；
  // 改为 tang-expiry.calculateStorageCost 月初一次性扣整月（store 月初钩子记账），此处不重复计费。
  const netIncome = round1(baseIncome + guestIncome - totalExpense);

  // 评分变动：每单 good +0.01 / bad -0.02；每满 10 天 +0.05；上限 5.0
  const goodCount = handledGuests.filter((g) => g.review === 'good').length;
  const badCount = handledGuests.filter((g) => g.review === 'bad').length;
  let scoreChange = goodCount * 0.01 - badCount * 0.02;
  if (day % 10 === 0 && day > 0) {
    scoreChange += 0.05;
  }
  const finalScore = clamp(state.score + scoreChange, 1.0, 5.0);
  scoreChange = round2(finalScore - state.score); // 封顶后回写实际变动

  // 声望变动：当日有夸奖（20% 夸奖累计 或 好评≥3）+2；有身份光顾 +5
  const hasPraise = handledGuests.some((g) => g.praised) || goodCount >= 3;
  const hasIdentity = handledGuests.some((g) => g.type === 'big_order' || g.type === 'special');
  let reputationChange = 0;
  if (hasPraise) reputationChange += 2;
  if (hasIdentity) reputationChange += 5;

  // 小二好感：净收益>0 → +1；<0 → -1（每日仅一次结算）
  const xiaoerFavorChange = netIncome > 0 ? 1 : netIncome < 0 ? -1 : 0;

  // 精力消耗汇总 = 当日接待累计 + 自由行动消耗（store 已并入 dailyEnergyConsumed）
  const energyConsumed = state.dailyEnergyConsumed;

  // 赌瘾剧情（3.3）：gamblingAddictionDays>0 → 打烊递减并展示一行剧情（store 应用递减）
  const gamblingActive = (state.gamblingAddictionDays ?? 0) > 0;
  const gamblingLine = gamblingActive
    ? `你鬼使神差地又摸向赌场方向——好在只是逛了一圈（赌瘾还剩 ${state.gamblingAddictionDays! - 1} 日）`
    : null;

  // 过劳（2.6 ⑤）：满意度<30 且当日工作 → -5/日；连续 3 天离职
  const { employees: afterOverwork, quitIds } = applyOverwork(employees);

  const settlement: DaySettlement = {
    day,
    baseIncome,
    guestIncome,
    expenses: totalExpense,
    netIncome,
    scoreChange,
    reputationChange,
    xiaoerFavorChange,
    energyConsumed,
    gamblingLine,
  };

  // 账本条目：基础收益（经营）+ 客单消费（接待）+ 各支出项（支出，负数）
  // （仓储费不在打烊账本记——月初由 store 一次性记「仓储费」，见 tang-expiry.calculateStorageCost）
  const ledgerEntries: LedgerEntry[] = [
    { day, project: '基础营收', category: '经营', amount: baseIncome },
    { day, project: GUEST_LEDGER_PROJECT[shopType], category: '接待', amount: guestIncome },
    ...expenses.map((e) => ({ day, project: e.project, category: '支出' as const, amount: -applyPriceIndex(e.amount, priceIndex) })),
  ];

  // 成就检测（3.5）：传入「结算后」视角（score 含当日变动、totalNetProfit 已累加当日净收益）
  const newlyUnlocked = checkAchievements(
    {
      ...state,
      score: finalScore,
      totalNetProfit: (state.totalNetProfit ?? 0) + netIncome,
    },
    settlement
  );
  settlement.newlyUnlocked = newlyUnlocked;

  return {
    settlement,
    ledgerEntries,
    scoreChange,
    reputationChange,
    xiaoerFavorChange,
    newlyUnlocked,
    suggestions: {
      employees: afterOverwork,
      employeeBonusRate: 0, // 建议加成今日已消费
      eventLog: quitIds.length > 0 ? quitIds.map((id) => `emp-overwork-quit:${id}`) : undefined,
    },
  };
}
