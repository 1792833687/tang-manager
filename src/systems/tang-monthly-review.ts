/**
 * 《我在唐朝当掌柜》月度总结系统（TANG-ADD-001 模块十）
 * 月度总结：每月初一打烊后汇总（净收益/最受欢迎商品/最难忘客人/最大失误/员工变化）；
 * AI 生成（天机阁已配）或模板（逐字「本月进账XX两，较上月盈亏XX…等你来写。」）。
 * 纯函数：
 * - generateMonthlyReview(state, 上月净收益, 本月销售/客人/失误/员工数据)：生成 MonthlyReview（模板优先）。
 * - displayMonthlyReview(review)：返回手札录条目文案。
 * 铁律：古风措辞；不持有游戏状态。
 */
import type { MonthlyReview } from '@/types/tang-manager';

/** 月度汇总所需数据（store 从本月逐日结算/接待/账本统计） */
export interface MonthlyReviewInput {
  day: number;
  month: number;
  /** 本月净收益合计 */
  netProfit: number;
  /** 上月净收益合计（首月为 0） */
  prevNetProfit: number;
  /** 本月最受欢迎商品（按销量统计；缺省 '无'） */
  bestGood: string;
  /** 本月最难忘客人（按特殊客/大单；缺省 '无'） */
  memorableGuest: string;
  /** 本月最大失误（按亏损支出；缺省 '无'） */
  biggestMistake: string;
  /** 本月员工变化（入职/离职/学艺；缺省 '无'） */
  employeeChanges: string;
  /** AI 生成文案（天机阁已配时传入；缺省用模板） */
  aiContent?: string;
}

/** 模板逐字（含「等你来写」留白；AI 未配置时降级） */
export function monthlyReviewTemplate(input: MonthlyReviewInput): string {
  const diff = input.netProfit - input.prevNetProfit;
  const diffText = diff >= 0 ? `盈 ${diff} 两` : `亏 ${-diff} 两`;
  return (
    `本月进账 ${input.netProfit} 两，较上月${diffText}。` +
    `最受欢迎之物是「${input.bestGood}」，最难忘的客是「${input.memorableGuest}」。` +
    `最大失误：「${input.biggestMistake}」。伙计更替：「${input.employeeChanges}」。` +
    `长安月升月落，陆记的下一章——等你来写。`
  );
}

/** 生成月度总结（AI 已配置 → 用 AI 文案；否则模板；返回 MonthlyReview） */
export function generateMonthlyReview(input: MonthlyReviewInput): MonthlyReview {
  return {
    day: input.day,
    month: input.month,
    netProfit: input.netProfit,
    prevNetProfit: input.prevNetProfit,
    bestGood: input.bestGood,
    memorableGuest: input.memorableGuest,
    biggestMistake: input.biggestMistake,
    employeeChanges: input.employeeChanges,
    content: input.aiContent && input.aiContent.trim() ? input.aiContent : monthlyReviewTemplate(input),
  };
}

/** 展示：返回手札录条目文案（标题 + 内容） */
export function displayMonthlyReview(review: MonthlyReview): { title: string; content: string } {
  return {
    title: `陆记·第${review.month}月账`,
    content: review.content,
  };
}
