/**
 * 《我在唐朝当掌柜》功能解锁配置（v1.0 打磨 TANG-POLISH-001 模块二；tang-feature-ids）
 * 12 个功能 featureId 与「逐字解锁条件表」。
 * featureId 与导航面板 key 一一对应（NavItemKey 12 项），解锁后导航/功能方可操作；
 * 未解锁 → UI 灰显（opacity 0.4 + grayscale）+ hover 提示 + 解锁时手札浮现提示。
 * 铁律：只描述条件，不裁决数值；判定逻辑在 systems/tang-feature-unlock.ts。
 */
export type TangFeatureId =
  | 'me'
  | 'reception'
  | 'shelf'
  | 'ledger'
  | 'staff'
  | 'bank'
  | 'map'
  | 'faction'
  | 'caravan'
  | 'politics'
  | 'journal'
  | 'achievement';

/** 条件类型：always 恒解锁 / day 天数 / reputation 声望 / employees 员工数 / stage 阶段 / achievements 成就数 */
export type TangFeatureConditionType = 'always' | 'day' | 'reputation' | 'employees' | 'stage' | 'achievements';

/** 单条解锁条件（逐字表行） */
export interface TangFeatureCondition {
  type: TangFeatureConditionType;
  /** 门槛值（always 类型忽略） */
  value: number;
  /** 条件描述（tooltip 展示） */
  hint: string;
}

/** 功能定义：id + 名称 + 解锁条件（多条件时全部满足 and） */
export interface TangFeatureDef {
  id: TangFeatureId;
  name: string;
  /** 逐字解锁条件表（and 关系） */
  conditions: TangFeatureCondition[];
}

/** 12 功能解锁条件表（featureId = 导航面板 key） */
export const TANG_FEATURES: readonly TangFeatureDef[] = [
  { id: 'me', name: '我', conditions: [{ type: 'always', value: 0, hint: '掌柜本尊，开局即见' }] },
  { id: 'reception', name: '接待', conditions: [{ type: 'always', value: 0, hint: '开门迎客，开局即见' }] },
  { id: 'shelf', name: '货架', conditions: [{ type: 'always', value: 0, hint: '货架陈设，开局即见' }] },
  { id: 'ledger', name: '账本', conditions: [{ type: 'always', value: 0, hint: '账目收支，开局即见' }] },
  {
    id: 'staff',
    name: '伙计',
    conditions: [{ type: 'always', value: 0, hint: '伙计面板开局即见（排班/涨薪等操作另行解锁）' }],
  },
  { id: 'bank', name: '钱庄', conditions: [{ type: 'day', value: 5, hint: '第 5 日起，钱庄开门' }] },
  {
    id: 'map',
    name: '长安舆图',
    conditions: [
      { type: 'reputation', value: 100, hint: '声望 ≥ 100' },
      { type: 'day', value: 10, hint: '第 10 日起' },
    ],
  },
  {
    id: 'faction',
    name: '门路',
    conditions: [
      { type: 'reputation', value: 50, hint: '声望 ≥ 50' },
      { type: 'day', value: 8, hint: '第 8 日起' },
    ],
  },
  {
    id: 'caravan',
    name: '镖队',
    conditions: [
      { type: 'stage', value: 2, hint: '经营晋入第 2 阶' },
      { type: 'reputation', value: 200, hint: '声望 ≥ 200' },
    ],
  },
  {
    id: 'politics',
    name: '巍明楼',
    conditions: [
      { type: 'reputation', value: 700, hint: '声望 ≥ 700' },
      { type: 'stage', value: 3, hint: '经营晋入第 3 阶' },
    ],
  },
  {
    id: 'journal',
    name: '手札录',
    conditions: [
      { type: 'day', value: 15, hint: '第 15 日起，可翻阅手札' },
      { type: 'achievements', value: 1, hint: '解锁首个成就' },
    ],
  },
  {
    id: 'achievement',
    name: '成就',
    conditions: [
      { type: 'achievements', value: 1, hint: '解锁首个成就后开启功业簿' },
    ],
  },
];

/** 按 id 查功能定义（不存在返回 null） */
export function tangFeatureById(id: string): TangFeatureDef | null {
  return TANG_FEATURES.find((f) => f.id === id) ?? null;
}
