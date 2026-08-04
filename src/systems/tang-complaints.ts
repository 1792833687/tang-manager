/**
 * 《我在唐朝当掌柜》投诉与差评师（Step 3 3.4）
 * 纯函数：
 * - handleComplaint(complaint, choice, rng?)：应用投诉「选项级」效果并返回结果。
 *   注意：投诉基础后果（消费减半、评分-0.02）已由 handleGuest 直接应用
 *   （保证不处理投诉卡时结算口径仍正确），本函数只追加选项级效果：
 *   普通不满：A 道歉并补偿（退该单收入、评分+0.01）/ B 强硬处理（评分额外-0.03、保持收益）
 *   差评师：A 赔钱了事（扣 5-20 两）/ B 拒绝并报官（50% 官府支持带走 / 50% 不支持评分-0.3）/
 *            C 私下威胁（需 xieQiFavor>0 谢七登场后可用；简化：无额外人情标记）
 * - checkBadReviewer(state, rng?)：B 难度评分≥3.0 / C 难度评分≥2.5 时 5% 概率返回 true；
 *   store 据此在 startNewDay 随机把 1 位普通/观察客人标记 isBadReviewer=true。
 */
import type { ComplaintChoice, ComplaintResult, Difficulty, PendingComplaint, TangGameState } from '@/types/tang-manager';

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

/** 普通不满文案 */
export const NORMAL_COMPLAINT_TEXT: Record<'apologize' | 'tough', string> = {
  apologize: '你赔着笑脸退钱赔罪，客人脸色稍霁，嘟囔着走了。',
  tough: '你冷哼一声，分文不让。客人涨红了脸，甩袖而去，逢人便说你店欺客。',
};

/** 差评师文案 */
export const REVIEWER_COMPLAINT_TEXT: Record<'payoff' | 'report' | 'threaten', string> = {
  payoff: '你赔钱了事，那差评师掂了掂银两，笑嘻嘻地走了。',
  report: '你报官处理——',
  threaten: '你唤来谢七的兄弟，那差评师脸色一变，忙不迭地溜了。',
};

/**
 * 投诉处理（纯函数）。
 * @param complaint 待处理投诉（收入为 handleGuest 减半后的值）
 * @param choice 处理选项
 */
export function handleComplaint(
  complaint: PendingComplaint & { difficulty?: Difficulty; xieQiFavor?: number },
  choice: ComplaintChoice,
  rng: () => number = Math.random
): ComplaintResult {
  const isBad = complaint.isBadReviewer;

  if (isBad) {
    if (choice === 'payoff') {
      const amount = round1(5 + rng() * 15); // 5-20 两
      return {
        choice,
        goldDelta: -amount,
        scoreDelta: 0,
        reputationDelta: 0,
        outcomeText: REVIEWER_COMPLAINT_TEXT.payoff,
        badReviewerRemoved: false,
      };
    }
    if (choice === 'report') {
      const supported = rng() < 0.5; // 50% 官府支持
      return {
        choice,
        goldDelta: 0,
        scoreDelta: supported ? 0 : -0.3,
        reputationDelta: supported ? 3 : 0,
        outcomeText: supported
          ? '官府查明此人是惯骗，当街带走。街坊交口称赞。'
          : '官府说你小题大做，反斥你扰民。那差评师得意地扬长而去。',
        badReviewerRemoved: supported,
      };
    }
    if (choice === 'threaten') {
      // 私下威胁：需谢七登场（xieQiFavor>0）；简化：无额外人情标记
      if ((complaint.xieQiFavor ?? 0) <= 0) {
        // 防御：不应发生（UI 已禁用），此处按无效果返回
        return {
          choice,
          goldDelta: 0,
          scoreDelta: 0,
          reputationDelta: 0,
          outcomeText: '谢七尚未登场，你无从下手，只得作罢。',
          badReviewerRemoved: false,
        };
      }
      return {
        choice,
        goldDelta: 0,
        scoreDelta: 0,
        reputationDelta: 0,
        outcomeText: REVIEWER_COMPLAINT_TEXT.threaten,
        badReviewerRemoved: true,
      };
    }
    // 差评师被误选普通选项：按普通不满处理（防御）
    if (choice === 'apologize') {
      return {
        choice,
        goldDelta: -complaint.income,
        scoreDelta: 0.01,
        reputationDelta: 0,
        outcomeText: NORMAL_COMPLAINT_TEXT.apologize,
        badReviewerRemoved: false,
      };
    }
    return {
      choice,
      goldDelta: 0,
      scoreDelta: -0.03,
      reputationDelta: 0,
      outcomeText: NORMAL_COMPLAINT_TEXT.tough,
      badReviewerRemoved: false,
    };
  }

  // 普通不满：2 选项
  if (choice === 'apologize') {
    return {
      choice,
      goldDelta: -complaint.income, // 退该单消费（该单收入）
      scoreDelta: 0.01,
      reputationDelta: 0,
      outcomeText: NORMAL_COMPLAINT_TEXT.apologize,
      badReviewerRemoved: false,
    };
  }
  if (choice === 'tough') {
    return {
      choice,
      goldDelta: 0, // 保持收益
      scoreDelta: -0.03, // 评分额外 -0.03
      reputationDelta: 0,
      outcomeText: NORMAL_COMPLAINT_TEXT.tough,
      badReviewerRemoved: false,
    };
  }
  // 普通客人被给差评师选项：防御按强硬处理
  return {
    choice,
    goldDelta: 0,
    scoreDelta: -0.03,
    reputationDelta: 0,
    outcomeText: NORMAL_COMPLAINT_TEXT.tough,
    badReviewerRemoved: false,
  };
}

/** 差评师出现概率（5%）：B 评分≥3.0 / C 评分≥2.5；有护卫时概率减半（2.6 ④，-50%） */
export function checkBadReviewer(
  state: Pick<TangGameState, 'difficulty' | 'score'>,
  rng: () => number = Math.random,
  guardPresent = false
): boolean {
  if (state.difficulty === 'A') return false;
  const threshold = state.difficulty === 'B' ? 3.0 : 2.5;
  const rate = guardPresent ? 0.025 : 0.05;
  return state.score >= threshold && rng() < rate;
}

/** 差评师候选：普通/观察客人（checkBadReviewer 为 true 时从中随机挑 1 位） */
export function badReviewerCandidates(guests: readonly TangGameState['guests'][number][]): string[] {
  return guests.filter((g) => g.type === 'normal' || g.type === 'observe').map((g) => g.id);
}
