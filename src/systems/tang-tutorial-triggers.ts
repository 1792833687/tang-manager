/**
 * 新手引导（TANG-TUT-002 模块二~五）触发决策层 — 纯逻辑 + store 接线入口
 *
 * 职责：
 * 1. 优先级/排队判定（shouldTriggerTutorial）：手札弹窗(handbook) > 阿昭提醒(azhao)；
 *    同类型只展示一个（currentTutorial 做锁）；当前引导清空后（currentTutorial=null）
 *    才放行下一个（排队）。
 * 2. 状态型触发点判定（evaluateTutorialTriggers）：开局 WELCOME / 首日 FIRST_GUEST /
 *    精力<20 FIRST_STRATEGY / 评分≥2.0 FIRST_REGULAR / 声望≥300 FIRST_SHEN_HINT /
 *    负债清零 DEBT_CLEARED / 首次陈损 FIRST_EXPIRY / 首次周要务 FIRST_WEEKLY_TASK /
 *    首次员工事件 FIRST_EMPLOYEE_EVENT。过渡类判定依赖 prev* 快照（watcher 维护）。
 * 3. 事件型接线入口（triggerTutorial / acknowledgeAzhaoTutorial）：按钮点击处直接调用，
 *    统一走 shouldTriggerTutorial 防重/排队（UI 层零散逻辑收敛到此处，可单测）。
 * 4. 面板首次打开映射（TUTORIAL_NAV_TRIGGER）：导航点击处理复用。
 *
 * 铁律：本文件只 import 纯数据/常量与 store action，不含 React；文案不改（T1 已落库）。
 */
import { isTangTutorialId, type TangTutorialId } from '@/config/tang-tutorial-ids';
import { tangTutorialById, type TangTutorialKind } from '@/config/tang-tutorial-content';
import { useTangManagerStore } from '@/stores/tang-manager';

/** 重要引导（不可点遮罩关闭，只能点「知道了」）：welcome/first_guest/first_mind_read/first_preorder */
export const TUTORIAL_IMPORTANT_IDS: ReadonlySet<TangTutorialId> = new Set<TangTutorialId>([
  'WELCOME',
  'FIRST_GUEST',
  'FIRST_MIND_READ',
  'FIRST_PREORDER',
]);

/** 是否为重要引导（遮罩不可点关闭） */
export function isTutorialImportant(id: string): boolean {
  return TUTORIAL_IMPORTANT_IDS.has(id as TangTutorialId);
}

/** 引导呈现方式（handbook 手札弹窗 / azhao 阿昭气泡；未知 id 按 handbook 保守处理） */
export function tutorialKind(id: string): TangTutorialKind {
  return tangTutorialById(id)?.kind ?? 'handbook';
}

/**
 * 优先级/排队判定：
 * - 未知 id / 已读 → false
 * - 无当前引导 → true（队首可出）
 * - 当前即同 id → false（防重复）
 * - 手札（handbook）顶替阿昭（azhao）→ true（展示优先级：手札 > 阿昭）
 * - 其余（阿昭撞手札 / 同类相撞）→ false（排队：等 currentTutorial 清空）
 */
export function shouldTriggerTutorial(
  tutorialFlags: Record<string, boolean>,
  currentTutorial: string | null,
  guideId: string
): boolean {
  if (!isTangTutorialId(guideId)) return false;
  if (tutorialFlags[guideId]) return false;
  if (!currentTutorial) return true;
  if (currentTutorial === guideId) return false;
  // 手札顶替阿昭；其余排队（阿昭不顶手札、同类不互顶）
  return tutorialKind(guideId) === 'handbook' && tutorialKind(currentTutorial) === 'azhao';
}

/**
 * 事件型触发统一入口（UI 按钮点击处调用）：
 * 满足 优先级/排队/未读 → showTutorial 弹出；否则忽略（排队由后续触发点补发）。
 * @returns 是否真正弹出
 */
export function triggerTutorial(guideId: string): boolean {
  const s = useTangManagerStore.getState();
  if (!shouldTriggerTutorial(s.tutorialFlags ?? {}, s.currentTutorial ?? null, guideId)) return false;
  useTangManagerStore.getState().showTutorial(guideId);
  return true;
}

/**
 * 阿昭气泡确认（点击气泡 / 3s 自动淡出后调用）：
 * 标记 FIRST_EXPIRY 已读 + FIRST_SHELF 已读（气泡即提醒翻货架，货架手札视为已阅）。
 */
export function acknowledgeAzhaoTutorial(): void {
  const s = useTangManagerStore.getState();
  s.markTutorialRead('FIRST_EXPIRY');
  s.markTutorialRead('FIRST_SHELF');
}

/** 面板首次打开 → 引导 id 映射（导航点击处理复用；缺省面板不触发） */
export const TUTORIAL_NAV_TRIGGER: Readonly<Partial<Record<string, TangTutorialId>>> = {
  shelf: 'FIRST_SHELF',
  staff: 'FIRST_STAFF',
  ledger: 'FIRST_LEDGER',
  bank: 'FIRST_BANK',
  map: 'FIRST_MAP',
  politics: 'FIRST_POLITICS',
  caravan: 'FIRST_CARAVAN',
};

/** 状态型触发点所需快照（watcher 从 store 提取；prev* 用于过渡判定） */
export interface TutorialTriggerSnapshot {
  phase: string;
  day: number;
  currentGuestIndex: number;
  energy: number;
  score: number;
  reputation: number;
  legacyDebt: number;
  tutorialFlags: Record<string, boolean>;
  /** 陈损预警：库房有临期/过期货（expiry 0~1） */
  hasNearExpiry: boolean;
  /** 已有周级要务 */
  hasWeeklyTasks: boolean;
  /** 已发生员工事件（eventLog 含 emp-ev:/emp-social: 前缀） */
  hasEmployeeEvent: boolean;
  prevEnergy?: number;
  prevScore?: number;
  prevReputation?: number;
  prevLegacyDebt?: number;
}

/**
 * 状态型触发点判定（纯函数；每次 store 变化由 watcher 调用）。
 * 过渡类（精力跌破20/评分跨2.0/声望跨300/负债清零）依赖 prev* 快照；
 * 其余按当前状态 + 未读标志判重。返回按产品次序排列的候选列表。
 */
export function evaluateTutorialTriggers(s: TutorialTriggerSnapshot): TangTutorialId[] {
  const out: TangTutorialId[] = [];
  // P0 修复（2026-08-05）：状态型引导仅在 playing 阶段触发——
  // 此前 FIRST_GUEST（day===1 && currentGuestIndex===0）在身份/店型/难度阶段即满足，
  // 开局直接弹手札引导遮罩盖住身份面板 → 玩家无法取名/选性别/选店型/选难度。
  if (s.phase !== 'playing') return out;
  // 开局：进入 playing 即弹欢迎手札
  if (s.phase === 'playing' && !s.tutorialFlags['WELCOME']) out.push('WELCOME');
  // 首日首位客人（currentGuestIndex===0 表示尚未接待）
  if (s.day === 1 && s.currentGuestIndex === 0 && !s.tutorialFlags['FIRST_GUEST']) out.push('FIRST_GUEST');
  // 精力跌破 20（身子乏了 → 策略手札）
  if (s.energy < 20 && (s.prevEnergy === undefined || s.prevEnergy >= 20) && !s.tutorialFlags['FIRST_STRATEGY']) {
    out.push('FIRST_STRATEGY');
  }
  // 评分跨过 2.0 → 回头客手札
  if (s.score >= 2.0 && (s.prevScore === undefined || s.prevScore < 2.0) && !s.tutorialFlags['FIRST_REGULAR']) {
    out.push('FIRST_REGULAR');
  }
  // 声望跨过 300 → 沈家预告
  if (s.reputation >= 300 && (s.prevReputation === undefined || s.prevReputation < 300) && !s.tutorialFlags['FIRST_SHEN_HINT']) {
    out.push('FIRST_SHEN_HINT');
  }
  // 负债清零（过渡 >0 → 0）
  if (s.legacyDebt <= 0 && (s.prevLegacyDebt === undefined || s.prevLegacyDebt > 0) && !s.tutorialFlags['DEBT_CLEARED']) {
    out.push('DEBT_CLEARED');
  }
  // 首次陈损（阿昭气泡；只触发一次，确认时连带 FIRST_SHELF 已读）
  if (s.hasNearExpiry && !s.tutorialFlags['FIRST_EXPIRY']) out.push('FIRST_EXPIRY');
  // 首次周要务（首周开档即生成，排队在手札之后展示）
  if (s.hasWeeklyTasks && !s.tutorialFlags['FIRST_WEEKLY_TASK']) out.push('FIRST_WEEKLY_TASK');
  // 首次员工事件（打烊结算触发过 emp-ev:/emp-social:）
  if (s.hasEmployeeEvent && !s.tutorialFlags['FIRST_EMPLOYEE_EVENT']) out.push('FIRST_EMPLOYEE_EVENT');
  return out;
}
