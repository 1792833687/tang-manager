/**
 * 《我在唐朝当掌柜》市井情报系统（v1.2 · 规格书模块一）
 * 纯函数：情报生成（按声望/好感分三级）/ 派人打探验证（准确度提升或失败）/ 来源可信度更新 / 过期判定。
 * 不持有状态；rng 可注入（默认 Math.random）。
 */
import { INTELLIGENCE_TIERS, SOURCE_INITIAL_RELIABILITY, RELIABILITY_UP, RELIABILITY_DOWN, RELIABILITY_MAX, RELIABILITY_MIN } from '@/config/tang-intelligence-tier';

export interface Intelligence {
  id: string;
  tier: 1 | 2 | 3;
  source: string;
  /** 来源可信度 0-1 */
  sourceReliability: number;
  content: string;
  category: 'price' | 'event' | 'npc' | 'opportunity';
  targetItem?: string;
  /** 预测价格变动（%；负=跌） */
  predictedChange?: number;
  /** 失效日（day） */
  expiryDay: number;
  verified: boolean;
  accurate: boolean;
  /** 是否已验证过（打探后 true；未打探时 accurate 无意义） */
  investigated: boolean;
  actionable: boolean;
  investigationCost: number;
  investigationEnergyCost: number;
}

/** 情报生成输入（只取用到的字段） */
export interface IntelligenceState {
  day: number;
  reputation: number;
  xieQiFavor: number;
}

/** 各等级内容池（占位 {item} 由上层插值；简单起见直接给出完整古风句） */
const TIER_POOLS: Record<1 | 2 | 3, Array<{ content: string; category: Intelligence['category']; targetItem?: string; predictedChange?: number }>> = {
  1: [
    { content: '西市码头的船期延误了，听说未来几天丝绸怕要涨价。', category: 'price', targetItem: '丝绸', predictedChange: 10 },
    { content: '张婆说李员外府上又要宴客，采买一车一车地拉。', category: 'opportunity' },
    { content: '城南药田遭了虫，今年药材怕要金贵起来。', category: 'price', targetItem: '药材', predictedChange: 12 },
    { content: '市易务的牙人私下说，今年新丝上市早，布价怕要松一松。', category: 'price', targetItem: '布匹', predictedChange: -10 },
  ],
  2: [
    { content: '据东市商会的内部消息，平准署下月要抛售库存布匹，布价看跌。', category: 'price', targetItem: '布匹', predictedChange: -15 },
    { content: '商会有人放出风声：今秋宫里要采买大批绸缎，绸庄怕要连夜赶工。', category: 'opportunity' },
    { content: '程掌柜托人带话：码头压了一批胡货，急着出手，价钱好商量。', category: 'opportunity' },
  ],
  3: [
    { content: '谢七的兄弟在码头干活，说有一批走私药材今晚到港——品质极高，但要冒风险。', category: 'opportunity' },
    { content: '地下传来的消息：东市有人囤积铜钱，下月铸币或有变动。', category: 'event' },
    { content: '谢七说平康坊有人要低价脱手一批上等锦缎，来路不正但货真。', category: 'price', targetItem: '锦缎', predictedChange: -20 },
  ],
};

const SOURCES_BY_TIER: Record<1 | 2 | 3, string[]> = {
  1: ['市井偶闻', '张婆'],
  2: ['程掌柜', '苏大娘'],
  3: ['谢七'],
};

let seq = 0;
function nextId(): string {
  seq += 1;
  return 'intel-' + seq;
}

function randRange(rng: () => number, min: number, max: number): number {
  return min + rng() * (max - min);
}

function randIntRange(rng: () => number, min: number, max: number): number {
  return Math.floor(min + rng() * (max - min + 1));
}

/** 生成一条指定等级情报（纯函数） */
export function generateIntelligence(tier: 1 | 2 | 3, state: IntelligenceState, rng: () => number = Math.random): Intelligence {
  const tierDef = INTELLIGENCE_TIERS[tier];
  const pool = TIER_POOLS[tier];
  const pick = pool[Math.min(Math.floor(rng() * pool.length), pool.length - 1)]!;
  const sources = SOURCES_BY_TIER[tier];
  const source = sources[Math.min(Math.floor(rng() * sources.length), sources.length - 1)]!;
  const [accMin, accMax] = tierDef.accuracyRange;
  const [valMin, valMax] = tierDef.validityRange;
  const initialAccurate = rng() < randRange(rng, accMin, accMax);
  return {
    id: nextId(),
    tier,
    source,
    sourceReliability: SOURCE_INITIAL_RELIABILITY[source] ?? 0.5,
    content: pick.content,
    category: pick.category,
    targetItem: pick.targetItem,
    predictedChange: pick.predictedChange,
    expiryDay: state.day + randIntRange(rng, valMin, valMax),
    verified: initialAccurate,
    accurate: initialAccurate,
    investigated: false,
    actionable: true,
    investigationCost: tierDef.investigationCost,
    investigationEnergyCost: tierDef.investigationEnergyCost,
  };
}

/** 生成每日情报（纯函数；规格书 1.4：坊间 1-2 + 声望≥300 商会 1 + 谢七好感≥50 地下 1） */
export function generateDailyIntelligence(state: IntelligenceState, rng: () => number = Math.random): Intelligence[] {
  const out: Intelligence[] = [];
  const rumorCount = 1 + (rng() > 0.5 ? 1 : 0);
  for (let i = 0; i < rumorCount; i++) out.push(generateIntelligence(1, state, rng));
  if (state.reputation >= 300) out.push(generateIntelligence(2, state, rng));
  if (state.xieQiFavor >= 50) out.push(generateIntelligence(3, state, rng));
  return out;
}

/**
 * 派人打探验证（纯函数；规格书 1.5）：
 * 结果 accurate 提升至 80-95%（由来源可信度决定），10-20% 概率失败标注「存疑」。
 */
export function investigateIntelligence(
  intel: Intelligence,
  rng: () => number = Math.random
): { intel: Intelligence; investigated: boolean; failed: boolean } {
  const failChance = 0.1 + rng() * 0.1;
  const failed = rng() < failChance;
  const resolvedAccurate = rng() < intel.sourceReliability;
  return {
    intel: { ...intel, investigated: true, verified: !failed && resolvedAccurate, accurate: !failed && resolvedAccurate },
    investigated: !failed,
    failed,
  };
}

/** 来源可信度更新（验证准确 +0.1 上限 0.95；不准确 -0.15 下限 0.2；规格书 1.4） */
export function updateSourceReliability(current: number, accurate: boolean): number {
  if (accurate) return Math.min(RELIABILITY_MAX, current + RELIABILITY_UP);
  return Math.max(RELIABILITY_MIN, current - RELIABILITY_DOWN);
}

/** 过期判定 */
export function isIntelligenceExpired(intel: Intelligence, day: number): boolean {
  return day > intel.expiryDay;
}

/** 剩余有效天数 */
export function intelligenceDaysLeft(intel: Intelligence, day: number): number {
  return Math.max(0, intel.expiryDay - day);
}
