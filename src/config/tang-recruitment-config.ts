/**
 * 《我在唐朝当掌柜》招聘配置（Step 5a 2.2）
 * - 姓名池（用户 2.2 逐字）：男 8 / 女 6 古风名。
 * - 类型权重：waiter 40% / 技师类（chef+tailor+pharmacist）30% / accountant 20% / guard 10%。
 *   技师类在无店型时三等分；给定 shopType 时按「匹配店型技师 50% / 另两类各 25%」细分。
 * - 特殊员工 10%（表面正常，hiddenBackground/hiddenFlaw 预设）。
 * - 纯数据，不依赖 store。
 */
import type { EmployeeType } from '@/types/tang-manager';

/** 男性姓名池（2.2 用户原文） */
export const MALE_NAME_POOL = ['赵铁柱', '钱满仓', '孙大力', '李守拙', '周望山', '吴长贵', '郑老实', '王根生'] as const;

/** 女性姓名池（2.2 用户原文） */
export const FEMALE_NAME_POOL = ['孙翠娘', '李巧儿', '周秀娘', '吴玉兰', '郑三娘', '王春桃'] as const;

/** 类型权重（合计 100；技师类合并占 30） */
export const TYPE_WEIGHTS: ReadonlyArray<{ type: EmployeeType; weight: number }> = [
  { type: 'waiter', weight: 40 },
  { type: 'chef', weight: 10 },
  { type: 'tailor', weight: 10 },
  { type: 'pharmacist', weight: 10 },
  { type: 'accountant', weight: 20 },
  { type: 'guard', weight: 10 },
];

/** 店型 → 匹配技师类型 */
export const SHOP_TECHNICIAN: Record<string, EmployeeType> = {
  jiulou: 'chef',
  buzhuang: 'tailor',
  yaopu: 'pharmacist',
};

/** 特殊员工隐藏背景池（10% 概率命中 isSpecial 时抽取） */
export const HIDDEN_BACKGROUNDS: readonly string[] = [
  '曾在赌场当过打手',
  '原是前朝小吏，逃难至此',
  '与东市贵人沾亲带故',
  '犯过事，改了名姓',
];

/** 特殊员工隐藏缺陷池（背景揭露事件后产生负面效果） */
export const HIDDEN_FLAWS: readonly string[] = [
  '嗜赌如命，逢赌必去',
  '手脚不干净，爱顺小钱',
  '好勇斗狠，常与人争执',
  '身负旧仇，恐引仇家上门',
];
