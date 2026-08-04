/**
 * 《我在唐朝当掌柜》负债拓展（内容深化 TANG-CONT-D 模块八）
 * 纯函数（可测）：
 * - offerRevolvingLoan(state)：循环借贷——还清抵押贷款后钱庄提供新贷款（额度×1.5、利率+1%），可拒绝不影响关系
 * - canTakeTradeCredit(state)：商业债务（赊账进货）门槛——信用 ≥300、上限=信用×2、总额 >信用×3 无法再赊
 * - takeTradeCredit(amount, state)：赊账进货（30 天无息；逾期月息 5% 可叠加由 accrueTradeCreditInterest 处理）
 * - accrueTradeCreditInterest(state, day)：逾期月息 5% 可叠加
 * - checkShenDebtMoment(state, rng?)：人情债关键时机（shenDebt=true 触发）
 * - resolveShenDebt(choiceId, state, rng?)：三选项（让出一笔生意 / 中断谢七合作 / 站队）；拒绝 沈-30+声望-50
 * - checkFramed(state, rng?)：被栽赃（评分 ≥3.0 概率触发）
 * - resolveFramed(choiceId, state, rng?)：A 找证据（-20 精力，需线索，成功 70%）/ B 花钱摆平（-200 两，京兆+10）/
 *   C 死不认账（京兆-20，可能强制执行扣款）
 * 铁律：古风措辞；纯函数不持有游戏状态；rng 可注入。
 */
import type { BankLoan, TangGameState } from '@/types/tang-manager';

// ============================================================
// 模块八·1 循环借贷
// ============================================================

export interface RevolvingLoanState {
  /** 已还清的抵押贷款记录（最近一笔；额度×1.5 作为新 offer） */
  lastPaidMortgage?: BankLoan | null;
  /** 是否已提供过循环借贷 offer（去重；拒绝后不再重复弹） */
  revolvingLoanOffered?: boolean;
}

export interface RevolvingLoanOffer {
  offered: boolean;
  /** 新贷款额度（已还清抵押贷款额 ×1.5） */
  amount: number;
  /** 新贷款利率（抵押月息 2% + 1%） */
  interestRate: number;
  /** 古风叙事 */
  message: string;
}

/** 循环借贷：还清抵押贷款后钱庄提供新贷款（额度×1.5、利率+1%） */
export function offerRevolvingLoan(state: RevolvingLoanState): RevolvingLoanOffer {
  const loan = state.lastPaidMortgage;
  if (!loan || loan.status !== 'paid' || loan.type !== 'mortgage') {
    return { offered: false, amount: 0, interestRate: 0, message: '' };
  }
  if (state.revolvingLoanOffered === true) {
    return { offered: false, amount: 0, interestRate: 0, message: '' };
  }
  const amount = Math.round(loan.amount * 1.5 * 100) / 100;
  const interestRate = 0.02 + 0.01; // 2% + 1%
  return {
    offered: true,
    amount,
    interestRate,
    message: `你刚还清抵押借贷，钱庄掌柜捋着胡子笑道：「掌柜的信用好，本庄愿再借 ${amount} 两，月息 ${(interestRate * 100).toFixed(0)}%。借与不借，全凭尊意。」`,
  };
}

// ============================================================
// 模块八·2 商业债务（赊账进货）
// ============================================================

export interface TradeCreditState {
  credit: number;
  tradeCredit?: number;
  /** 赊账最早到期日（30 天无息期起点） */
  creditDueDay?: number;
  day?: number;
}

/** 赊账可用：信用 ≥300 且总额 ≤信用×3；单笔上限 = 信用×2（同时受总额上限约束） */
export function canTakeTradeCredit(state: TradeCreditState): { ok: boolean; reason?: string; limit: number } {
  const credit = state.credit ?? 0;
  const tradeCredit = state.tradeCredit ?? 0;
  if (credit < 300) {
    return { ok: false, reason: '信用不足 300，无法赊账进货', limit: 0 };
  }
  const totalLimit = credit * 3;
  if (tradeCredit >= totalLimit) {
    return { ok: false, reason: '赊账总额已达上限（信用×3），无法再赊', limit: 0 };
  }
  const limit = Math.min(credit * 2, totalLimit - tradeCredit);
  return { ok: true, limit: Math.max(0, Math.round(limit * 100) / 100) };
}

/** 赊账进货（30 天无息；到期日 = day+30；返回更新后的赊账字段建议） */
export function takeTradeCredit(
  amount: number,
  state: TradeCreditState
): { ok: boolean; reason?: string; tradeCredit: number; creditDueDay: number } {
  if (!Number.isFinite(amount) || amount <= 0) {
    return { ok: false, reason: '赊账金额须为正', tradeCredit: state.tradeCredit ?? 0, creditDueDay: state.creditDueDay ?? 0 };
  }
  const gate = canTakeTradeCredit(state);
  if (!gate.ok) {
    return { ok: false, reason: gate.reason, tradeCredit: state.tradeCredit ?? 0, creditDueDay: state.creditDueDay ?? 0 };
  }
  if (amount > gate.limit) {
    return { ok: false, reason: `单笔赊账上限 ${gate.limit} 两`, tradeCredit: state.tradeCredit ?? 0, creditDueDay: state.creditDueDay ?? 0 };
  }
  const tradeCredit = Math.round(((state.tradeCredit ?? 0) + amount) * 100) / 100;
  const creditDueDay = (state.creditDueDay ?? 0) === 0 ? (state.day ?? 1) + 30 : state.creditDueDay!;
  return { ok: true, tradeCredit, creditDueDay };
}

/** 赊账逾期月息（月息 5% 可叠加：每逾期一个月按总额 5% 计息累加进 tradeCredit） */
export function accrueTradeCreditInterest(
  state: TradeCreditState
): { tradeCredit: number; interest: number; overdueMonths: number } {
  const tradeCredit = state.tradeCredit ?? 0;
  const dueDay = state.creditDueDay ?? 0;
  const day = state.day ?? 1;
  if (tradeCredit <= 0 || dueDay <= 0 || day <= dueDay) {
    return { tradeCredit, interest: 0, overdueMonths: 0 };
  }
  const overdueMonths = Math.floor((day - dueDay) / 30) + 1; // 逾期整月+当月
  const interest = Math.round(tradeCredit * 0.05 * overdueMonths * 100) / 100;
  return { tradeCredit: Math.round((tradeCredit + interest) * 100) / 100, interest, overdueMonths };
}

// ============================================================
// 模块八·3 人情债（沈听澜）
// ============================================================

export interface ShenDebtState {
  day: number;
  silver: number;
  reputation: number;
  shenTinglanFavor: number;
  xieQiFavor: number;
  shenDebt: boolean;
}

export interface ShenDebtMoment {
  triggered: boolean;
  title: string;
  description: string;
  message?: string;
}

/** 人情债关键时机（shenDebt=true 且未在冷却中触发） */
export function checkShenDebtMoment(
  state: ShenDebtState,
  _rng: () => number = Math.random
): ShenDebtMoment {
  if (!state.shenDebt) {
    return { triggered: false, title: '', description: '' };
  }
  return {
    triggered: true,
    title: '沈听澜要你还人情',
    description:
      '这一日，沈听澜亲自登门，品着茶慢悠悠开口：「陆掌柜，当日我替你周转的那笔人情，如今该还了吧？」他放下茶盏，目光却不容拒绝。',
  };
}

export type ShenDebtChoice = 'concede' | 'break_xie' | 'align' | 'refuse';

/** 人情债三选项 + 拒绝（纯函数返回变更建议） */
export function resolveShenDebt(
  choiceId: string,
  state: ShenDebtState
): { ok: boolean; message: string; changes: Partial<TangGameState>; eventLog: string[] } {
  switch (choiceId) {
    case 'concede': {
      // 让出一笔生意：银两损失（工程定值 50 两，注释）、人情了结
      return {
        ok: true,
        message: '你让出了一笔东市的生意，沈听澜满意地点点头：「掌柜的是个明白人。」',
        changes: {
          shenDebt: false,
          shenTinglanFavor: Math.min(100, state.shenTinglanFavor + 10),
          silver: Math.max(0, state.silver - 50),
        },
        eventLog: ['[人情债] 让出一笔生意：人情了结，沈好感 +10'],
      };
    }
    case 'break_xie': {
      // 中断谢七合作：谢七好感 -30
      return {
        ok: true,
        message: '你当面回绝了谢七的下一桩买卖，沈听澜看在眼里，承你这份情。',
        changes: {
          shenDebt: false,
          shenTinglanFavor: Math.min(100, state.shenTinglanFavor + 10),
          xieQiFavor: Math.max(0, state.xieQiFavor - 30),
        },
        eventLog: ['[人情债] 中断谢七合作：人情了结，沈好感 +10，谢七好感 -30'],
      };
    }
    case 'align': {
      // 站队（偏沈）：沈好感 +10，声望 +5（东市看重）
      return {
        ok: true,
        message: '你在商会诸人面前替沈听澜说了话，算是当众站了队。',
        changes: {
          shenDebt: false,
          shenTinglanFavor: Math.min(100, state.shenTinglanFavor + 10),
          reputation: Math.min(1000, state.reputation + 5),
        },
        eventLog: ['[人情债] 站队沈听澜：人情了结，沈好感 +10，声望 +5'],
      };
    }
    default: {
      // 拒绝：沈-30 + 声望-50；人情未了
      return {
        ok: true,
        message: '你婉言推拒，沈听澜笑容微敛：「好，好。」他拂袖而去，你晓得，这梁子算是结下了。',
        changes: {
          shenDebt: true,
          shenTinglanFavor: Math.max(0, state.shenTinglanFavor - 30),
          reputation: Math.max(0, state.reputation - 50),
        },
        eventLog: ['[人情债] 拒绝还人情：沈好感 -30，声望 -50'],
      };
    }
  }
}

// ============================================================
// 模块八·4 被栽赃
// ============================================================

export interface FramedState {
  day: number;
  score: number;
  silver: number;
  reputation: number;
  energy: number;
  /** 是否拥有线索墙相关线索（A 找证据前置） */
  hasClue: boolean;
  /** 京兆府好感（B/C 影响） */
  fuyinFavor?: number;
}

export interface FramedMoment {
  triggered: boolean;
  title: string;
  description: string;
}

/** 被栽赃（评分 ≥3.0 概率触发：约 3%/日，注释） */
export function checkFramed(
  state: FramedState,
  rng: () => number = Math.random
): FramedMoment {
  if ((state.score ?? 0) < 3.0) {
    return { triggered: false, title: '', description: '' };
  }
  if (rng() >= 0.03) {
    return { triggered: false, title: '', description: '' };
  }
  return {
    triggered: true,
    title: '京兆府差人登门',
    description:
      '你正盘账，忽闻门外一阵急促的马蹄。京兆府两名差役翻身下马，面色不善：「陆掌柜，有人递了状子，说你以次充好、哄抬物价，请随我们走一趟问话。」',
  };
}

/** 被栽赃选项处理（纯函数）：A 找证据 / B 花钱摆平 / C 死不认账 */
export function resolveFramed(
  choiceId: string,
  state: FramedState,
  rng: () => number = Math.random
): { ok: boolean; message: string; changes: Partial<TangGameState>; eventLog: string[] } {
  switch (choiceId) {
    case 'evidence': {
      if (!state.hasClue) {
        return { ok: false, message: '你手上并无线索，无从自证清白。', changes: {}, eventLog: [] };
      }
      const energy = Math.max(0, (state.energy ?? 100) - 20);
      const success = rng() < 0.7; // 成功 70%
      if (success) {
        return {
          ok: true,
          message: '你翻出线索墙上的凭证，当堂对质，京兆府尹细看之后连连点头，还你清白，反斥那告状之人。',
          changes: {
            energy,
            reputation: Math.min(1000, state.reputation + 10),
            fuyinFavor: Math.min(100, (state.fuyinFavor ?? 20) + 10),
          },
          eventLog: ['[被栽赃] 找证据·成功：自证清白，声望 +10，京兆府好感 +10'],
        };
      }
      return {
        ok: true,
        message: '你寻来的证据含含糊糊，府尹摇了摇头：「证据不足，此案再查。」你白费了二十两银子的打点。',
        changes: { energy, silver: Math.max(0, state.silver - 20) },
        eventLog: ['[被栽赃] 找证据·失败：耗 20 两打点，案子悬而未决'],
      };
    }
    case 'payoff': {
      return {
        ok: true,
        message: '你塞了二百两银子给师爷，又托人递话。府尹收了孝敬，含糊其辞：「此事再议。」真相，终究没查明白。',
        changes: {
          silver: Math.max(0, state.silver - 200),
          fuyinFavor: Math.min(100, (state.fuyinFavor ?? 20) + 10),
        },
        eventLog: ['[被栽赃] 花钱摆平：-200 两，京兆府好感 +10，真相未明'],
      };
    }
    default: {
      // 死不认账：京兆-20，50% 强制执行扣款（100-300 两）
      const forced = rng() < 0.5;
      const amount = forced ? 100 + Math.floor(rng() * 201) : 0;
      return {
        ok: true,
        message: forced
          ? `你梗着脖子不认账，府尹一拍惊堂木：「好一个刁商！」当即罚银 ${amount} 两充公。`
          : '你梗着脖子不认账，府尹冷冷看了你一眼，拂袖而去——此事怕没完。',
        changes: {
          fuyinFavor: Math.max(0, (state.fuyinFavor ?? 20) - 20),
          silver: Math.max(0, state.silver - amount),
          reputation: Math.max(0, state.reputation - (forced ? 10 : 5)),
        },
        eventLog: forced
          ? [`[被栽赃] 死不认账：京兆府好感 -20，强制执行扣款 ${amount} 两`]
          : ['[被栽赃] 死不认账：京兆府好感 -20，恐有后患'],
      };
    }
  }
}
