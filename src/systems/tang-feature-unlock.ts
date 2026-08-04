/**
 * 功能解锁判定系统（v1.0 打磨 TANG-POLISH-001 模块二；tang-feature-unlock）
 * 「逐字解锁条件表」裁决层：只判定，不持有数值。
 * 与 config/tang-feature-ids.ts 分工：
 * - config：12 个 featureId 与「逐字解锁条件表」（纯描述，不裁决）
 * - 本系统：checkFeatureUnlock 按当前状态裁决哪些 featureId 达标、返回本次新解锁；
 *           getUnlockCondition 取某功能未满足的首条条件（tooltip 展示用）；
 *           getUnlockNarrative 生成解锁手札文案（解锁时浮现提示用）。
 * 铁律：多条件 and 关系（全部满足才解锁）；always 类型恒解锁。
 */
import { TANG_FEATURES, tangFeatureById, type TangFeatureConditionType, type TangFeatureId } from '@/config/tang-feature-ids';

/** 判定输入：store 传入的最小状态子集（checkFeatureUnlock 只读，不写 store） */
export interface FeatureUnlockInput {
  day: number;
  reputation: number;
  employeesCount: number;
  stage: number;
  unlockedAchievementsCount: number;
}

/** 条件值读取（always 恒 true；其余按 type 取门槛比较） */
function conditionMet(condType: TangFeatureConditionType, value: number, s: FeatureUnlockInput): boolean {
  switch (condType) {
    case 'always':
      return true;
    case 'day':
      return s.day >= value;
    case 'reputation':
      return s.reputation >= value;
    case 'employees':
      return s.employeesCount >= value;
    case 'stage':
      return s.stage >= value;
    case 'achievements':
      return s.unlockedAchievementsCount >= value;
    default:
      return false;
  }
}

/**
 * 判定单个 featureId 是否解锁（全部条件 and 满足）。
 * 纯函数：不做任何副作用；已被解锁（known[id]）时直接返回 true（不重复判定）。
 */
export function isFeatureUnlocked(id: string, known: Record<string, boolean>, s: FeatureUnlockInput): boolean {
  if (known[id]) return true;
  const def = tangFeatureById(id);
  if (!def) return false;
  return def.conditions.every((c) => conditionMet(c.type, c.value, s));
}

/**
 * 每日解锁检查：返回「本次新解锁」的 featureId 列表（此前未解锁且当前条件满足）。
 * store 的 checkFeatureUnlock action 调用本函数后写入 unlockedFeatures。
 */
export function checkFeatureUnlock(known: Record<string, boolean>, s: FeatureUnlockInput): string[] {
  const newly: string[] = [];
  for (const def of TANG_FEATURES) {
    if (!known[def.id] && isFeatureUnlocked(def.id, known, s)) {
      newly.push(def.id);
    }
  }
  return newly;
}

/**
 * 获取某功能「未满足」的首条条件描述（UI 灰显 tooltip 用）。
 * 已解锁返回 null；无该功能返回 null；全部满足返回 null（调用方应先查 isFeatureUnlocked）。
 */
export function getUnlockCondition(id: string, known: Record<string, boolean>, s: FeatureUnlockInput): string | null {
  if (known[id]) return null;
  const def = tangFeatureById(id);
  if (!def) return null;
  for (const c of def.conditions) {
    if (!conditionMet(c.type, c.value, s)) return c.hint;
  }
  return null;
}

/** 解锁叙事文案（解锁时手札浮现提示用） */
export function getUnlockNarrative(id: string): string {
  const def = tangFeatureById(id);
  const name = def?.name ?? id;
  const intro: Record<string, string> = {
    staff: '店中渐有起色，是时候添些人手了。',
    bank: '长安钱庄的大门朝你敞开。',
    map: '长安舆图徐徐展开，天下商路尽收眼底。',
    faction: '门路渐通，长安各方势力皆可结交。',
    caravan: '镖旗招展，商队可护送你往来各地。',
    politics: '巍明楼前，你已够格踏足权力中枢。',
    journal: '手札录自动记下这段经营旅程。',
    achievement: '功业簿开启，成就之路由此而起。',
  };
  return intro[id] ?? `${name}已解锁。`;
}
