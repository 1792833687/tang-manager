/**
 * 《我在唐朝当掌柜》成就配置与检测（Step 2 2.6 / 2.4；Step 3 3.5 补全）
 * - ACHIEVEMENTS：全量成就表（含未解锁条件的文案，成就面板 ？？？🔒 展示用）
 * - checkAchievements：纯函数；Step 3 签名改为
 *   checkAchievements(gameState, settlement)，一次结算后返回新解锁成就 id。
 *   保留：第一桶金（netIncome≥100）/ 回头客（score≥4.0）
 *   新增：招财进宝（totalNetProfit≥10000）/ 长安名店（score≥5.0）/
 *         无债一身轻（legacyDebt=0）/ 赌神在世（maxGamblingWin≥200）/
 *         东山再起（hasGoneBroke 且 score≥3.0）
 */
import type { DaySettlement, TangGameState } from '@/types/tang-manager';

export interface TangAchievement {
  id: string;
  name: string;
  description: string;
  /** 解锁条件文案（未解锁时展示） */
  conditionText: string;
}

/**
 * 成就奖励（内容深化 TANG-CONT-B 模块六·2）：
 * 解锁即发放微小永久 Buff；reward 与成就一对一（映射表，避免改动 ACHIEVEMENTS 结构）。
 * - regularCustomerBonus：熟客光顾概率加成（百分点；回头客 +5 → 每日熟客 20%→25%）
 * - reputationBonus：一次性声望奖励（封顶由 store clamp）
 * - scoreBonus：一次性评分奖励（封顶 5.0；预留，当前无成就使用）
 */
export interface AchievementReward {
  /** 奖励文案（古风；成就面板已解锁时展示） */
  desc: string;
  /** 熟客光顾概率加成（百分点 0-100；回头客 +5） */
  regularCustomerBonus?: number;
  /** 一次性声望奖励 */
  reputationBonus?: number;
  /** 一次性评分奖励（封顶 5.0） */
  scoreBonus?: number;
}

/** id → 成就奖励 映射表（未配置的成就无奖励） */
export const ACHIEVEMENT_REWARDS: Readonly<Record<string, AchievementReward>> = {
  'first-bucket': { desc: '声名初显 · 声望 +5', reputationBonus: 5 },
  'regular-customer': { desc: '熟客光顾概率 +5%', regularCustomerBonus: 5 },
  fortune: { desc: '财名远播 · 声望 +15', reputationBonus: 15 },
  'changan-famous': { desc: '誉满长安 · 声望 +20', reputationBonus: 20 },
  'debt-free': { desc: '清誉一身轻 · 声望 +10', reputationBonus: 10 },
  comeback: { desc: '东山再起 · 声望 +8', reputationBonus: 8 },
  gambler: { desc: '赌名在外 · 声望 +8', reputationBonus: 8 },
};

/** 按 id 取奖励（无则 null） */
export function achievementRewardById(id: string): AchievementReward | null {
  return ACHIEVEMENT_REWARDS[id] ?? null;
}

/** 汇总已解锁成就的熟客光顾概率加成（百分点；回头客 +5 等；startNewDay 客流接线） */
export function achievementRegularCustomerBonus(unlocked: readonly string[]): number {
  return unlocked.reduce((sum, id) => sum + (ACHIEVEMENT_REWARDS[id]?.regularCustomerBonus ?? 0), 0);
}

/** 应用成就奖励（纯函数）：返回应施加的状态变更（reputation/score）；由 store action 应用。 */
export function applyAchievementReward(
  state: Pick<TangGameState, 'reputation' | 'score'>,
  achievementId: string
): { reputationDelta: number; scoreDelta: number; reward: AchievementReward | null } {
  const reward = achievementRewardById(achievementId);
  if (!reward) {
    return { reputationDelta: 0, scoreDelta: 0, reward: null };
  }
  return {
    reputationDelta: reward.reputationBonus ?? 0,
    scoreDelta: reward.scoreBonus ?? 0,
    reward,
  };
}

/** 全量成就表（顺序即成就面板展示顺序） */
export const ACHIEVEMENTS: readonly TangAchievement[] = [
  {
    id: 'first-bucket',
    name: '第一桶金',
    description: '单日净收益达到 100 两',
    conditionText: '解锁条件：单日净收益 ≥ 100 两',
  },
  {
    id: 'regular-customer',
    name: '回头客',
    description: '店铺评分达到 4.0',
    conditionText: '解锁条件：店铺评分 ≥ 4.0',
  },
  {
    id: 'fortune',
    name: '招财进宝',
    description: '累计净利达到 10000 两',
    conditionText: '解锁条件：累计净利 ≥ 10000 两',
  },
  {
    id: 'changan-famous',
    name: '长安名店',
    description: '店铺评分达到 5.0',
    conditionText: '解锁条件：店铺评分 ≥ 5.0',
  },
  {
    id: 'debt-free',
    name: '无债一身轻',
    description: '还清全部负债',
    conditionText: '解锁条件：还清全部负债',
  },
  {
    id: 'comeback',
    name: '东山再起',
    description: '破产后重新达到 3.0 评分',
    conditionText: '解锁条件：破产后评分重回 ≥ 3.0',
  },
  {
    id: 'gambler',
    name: '赌神在世',
    description: '单次赌场赢超过 200 两',
    conditionText: '解锁条件：单次赌场净赢 > 200 两',
  },
];

/** id → 成就 索引（面板查表用） */
export const ACHIEVEMENT_MAP: Readonly<Record<string, TangAchievement>> = Object.fromEntries(
  ACHIEVEMENTS.map((a) => [a.id, a])
);

/** checkAchievements 所需的状态子集（避免整份 state 耦合；5b：debt → legacyDebt） */
export type AchievementState = Pick<
  TangGameState,
  | 'totalNetProfit'
  | 'score'
  | 'legacyDebt'
  | 'maxGamblingWin'
  | 'hasGoneBroke'
  | 'unlockedAchievements'
>;

/**
 * 成就检测（纯函数）：返回本次新解锁的成就 id（不含已解锁）。
 * gameState 传入「结算后」视角（score 已含当日变动、totalNetProfit 已累加当日净收益）。
 */
export function checkAchievements(
  gameState: AchievementState,
  settlement: Pick<DaySettlement, 'netIncome'>
): string[] {
  const newly: string[] = [];
  const unlocked = gameState.unlockedAchievements;
  const conditions: ReadonlyArray<{ id: string; met: boolean }> = [
    { id: 'first-bucket', met: settlement.netIncome >= 100 },
    { id: 'regular-customer', met: gameState.score >= 4.0 },
    { id: 'fortune', met: gameState.totalNetProfit >= 10000 },
    { id: 'changan-famous', met: gameState.score >= 5.0 },
    { id: 'debt-free', met: (gameState.legacyDebt ?? 0) === 0 },
    { id: 'gambler', met: gameState.maxGamblingWin >= 200 },
    { id: 'comeback', met: gameState.hasGoneBroke && gameState.score >= 3.0 },
  ];
  for (const c of conditions) {
    if (c.met && !unlocked.includes(c.id)) {
      newly.push(c.id);
    }
  }
  return newly;
}

/** 仅保留类型引用（成就面板消费 TangGameState 的 unlockedAchievements 字段） */
export type TangAchievementState = Pick<TangGameState, 'unlockedAchievements'>;
