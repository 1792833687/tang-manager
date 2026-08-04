/**
 * 月度总结单测（TANG-ADD-001 模块十）
 * 覆盖：模板文案逐字、AI 内容优先、汇总字段、展示条目。
 */
import { describe, expect, it } from 'vitest';
import { displayMonthlyReview, generateMonthlyReview, monthlyReviewTemplate } from '@/systems/tang-monthly-review';
import type { MonthlyReviewInput } from '@/systems/tang-monthly-review';

const input: MonthlyReviewInput = {
  day: 60,
  month: 2,
  netProfit: 300,
  prevNetProfit: 100,
  bestGood: '酱牛肉',
  memorableGuest: '沈听澜',
  biggestMistake: '赊账跑路',
  employeeChanges: '新聘账房一名',
};

describe('generateMonthlyReview · 生成', () => {
  it('无 AI 内容 → 使用模板（含逐字「本月进账XX两」与「等你来写」）', () => {
    const review = generateMonthlyReview(input);
    expect(review.content).toContain('本月进账 300 两');
    expect(review.content).toContain('等你来写');
  });

  it('较上月盈亏：盈 200 → 文案含「盈 200 两」', () => {
    const review = generateMonthlyReview(input);
    expect(review.content).toContain('较上月盈 200 两');
  });

  it('较上月亏 → 文案含「亏 XX 两」', () => {
    const review = generateMonthlyReview({ ...input, netProfit: 50, prevNetProfit: 100 });
    expect(review.content).toContain('较上月亏 50 两');
  });

  it('AI 内容已配 → 优先使用 AI 文案', () => {
    const review = generateMonthlyReview({ ...input, aiContent: 'AI 撰写的月度总结正文。' });
    expect(review.content).toBe('AI 撰写的月度总结正文。');
  });

  it('汇总字段齐全：day/month/netProfit/bestGood/memorableGuest/biggestMistake/employeeChanges', () => {
    const review = generateMonthlyReview(input);
    expect(review.day).toBe(60);
    expect(review.month).toBe(2);
    expect(review.netProfit).toBe(300);
    expect(review.prevNetProfit).toBe(100);
    expect(review.bestGood).toBe('酱牛肉');
    expect(review.memorableGuest).toBe('沈听澜');
    expect(review.biggestMistake).toBe('赊账跑路');
    expect(review.employeeChanges).toBe('新聘账房一名');
  });
});

describe('monthlyReviewTemplate · 模板逐字', () => {
  it('模板含最受欢迎之物/最难忘的客/最大失误/伙计更替', () => {
    const text = monthlyReviewTemplate(input);
    expect(text).toContain('最受欢迎之物是「酱牛肉」');
    expect(text).toContain('最难忘的客是「沈听澜」');
    expect(text).toContain('最大失误：「赊账跑路」');
    expect(text).toContain('伙计更替：「新聘账房一名」');
  });
});

describe('displayMonthlyReview · 展示', () => {
  it('返回手札录条目（标题 = 陆记·第N月账）', () => {
    const review = generateMonthlyReview(input);
    const display = displayMonthlyReview(review);
    expect(display.title).toBe('陆记·第2月账');
    expect(display.content).toBe(review.content);
  });

  it('空输入降级：bestGood/memorableGuest 缺省「无」（store 接线兜底）', () => {
    const review = generateMonthlyReview({ day: 30, month: 1, netProfit: 0, prevNetProfit: 0, bestGood: '无', memorableGuest: '无', biggestMistake: '无', employeeChanges: '无' });
    expect(review.bestGood).toBe('无');
    expect(review.content).toContain('最受欢迎之物是「无」');
  });
});
