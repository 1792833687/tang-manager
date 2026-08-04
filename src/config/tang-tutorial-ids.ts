/**
 * 《我在唐朝当掌柜》新手引导（TANG-TUT-001 模块一）引导 ID 常量
 * 21 个引导 id（用户逐字）：家传手札为载体的新手引导，涵盖
 * 开局欢迎 / 策略 / 接待 / 通晓人心 / 预购 / 结算 / 货架 / 伙计 / 账本 / 钱庄 /
 * 舆图 / 籴粜契 / 加工 / 陈损 / 回头客 / 周要务 / 债清 / 员工事件 / 沈家预告 /
 * 巍明楼 / 镖队。
 * 铁律：文案为「祖辈家书」口吻（亲切但有长辈分寸，不用现代词汇）；first_expiry
 * 不占手札弹窗（阿昭气泡）。纯数据，不依赖 store；消费方见 store 引导 actions。
 */

/** 21 个引导 id（顺序即产品定义的展示次序） */
export type TangTutorialId =
  | 'WELCOME'
  | 'FIRST_STRATEGY'
  | 'FIRST_GUEST'
  | 'FIRST_MIND_READ'
  | 'FIRST_PREORDER'
  | 'FIRST_SETTLE'
  | 'FIRST_SHELF'
  | 'FIRST_STAFF'
  | 'FIRST_LEDGER'
  | 'FIRST_BANK'
  | 'FIRST_MAP'
  | 'FIRST_FORWARD_CONTRACT'
  | 'FIRST_PROCESSING'
  | 'FIRST_EXPIRY'
  | 'FIRST_REGULAR'
  | 'FIRST_WEEKLY_TASK'
  | 'DEBT_CLEARED'
  | 'FIRST_EMPLOYEE_EVENT'
  | 'FIRST_SHEN_HINT'
  | 'FIRST_POLITICS'
  | 'FIRST_CARAVAN';

/** 21 个引导 id 全量（有序；文案/测试/UI 迭代共用） */
export const TANG_TUTORIAL_IDS: readonly TangTutorialId[] = [
  'WELCOME',
  'FIRST_STRATEGY',
  'FIRST_GUEST',
  'FIRST_MIND_READ',
  'FIRST_PREORDER',
  'FIRST_SETTLE',
  'FIRST_SHELF',
  'FIRST_STAFF',
  'FIRST_LEDGER',
  'FIRST_BANK',
  'FIRST_MAP',
  'FIRST_FORWARD_CONTRACT',
  'FIRST_PROCESSING',
  'FIRST_EXPIRY',
  'FIRST_REGULAR',
  'FIRST_WEEKLY_TASK',
  'DEBT_CLEARED',
  'FIRST_EMPLOYEE_EVENT',
  'FIRST_SHEN_HINT',
  'FIRST_POLITICS',
  'FIRST_CARAVAN',
];

/** 快速查表集合（showTutorial 校验用；避免每次线性扫数组） */
export const TANG_TUTORIAL_ID_SET: ReadonlySet<string> = new Set<string>(TANG_TUTORIAL_IDS);

/** 是否为合法引导 id（类型守卫；未知 id 不弹引导） */
export function isTangTutorialId(id: string): id is TangTutorialId {
  return TANG_TUTORIAL_ID_SET.has(id);
}
