/**
 * 《我在唐朝当掌柜》变卖分店系统（内容深化 TANG-CONT-B 模块一）
 * 变卖："店铺估值约XX两（累计投入×七成）。变卖后此店不复存在。"
 * 设计决策（grep 确认现状后新增；原无 sellShop/closeShop，下架仅等效于货架出售）：
 * ① 店数为抽象计数（state.shopCount，无独立分店实体/资金流记录），故「累计投入」以
 *    工程定值基准 BRANCH_INVESTMENT_BASE 折算（扩张/备货/修缮的近似基线，注释决策）。
 * ② 员工与店铺无绑定（扁平 employees 列表）；变卖后按员工上限收敛——
 *    maxEmployees = 2×shopCount + 2（shopCount 每 +1 → +2），超出新上限的员工
 *    视为该店伙计离职（逐一提示去向，store 回传名单）。
 * ③ sellBranch 为纯函数：不直接改 store，返回变更建议由 store action 应用。
 * 铁律：古风措辞；纯函数；不持有游戏状态。
 */
import type { Employee } from '@/types/tang-manager';

/** 分店累计投入基准（两；工程定值：无独立分店资金流，扩张/备货/修缮折算近似） */
export const BRANCH_INVESTMENT_BASE = 200;

/** 变卖成数（累计投入 × 七成） */
export const BRANCH_SALE_RATE = 0.7;

/** 变卖估值 = 累计投入 × 七成（两，取整） */
export function estimateShopValue(): number {
  return Math.round(BRANCH_INVESTMENT_BASE * BRANCH_SALE_RATE);
}

/** 员工上限公式（与 store 初始 4 / shopCount 每 +1 → +2 一致） */
export function maxEmployeesForShops(shopCount: number): number {
  return Math.max(1, 2 * Math.max(1, shopCount) + 2);
}

export interface SellBranchResult {
  ok: boolean;
  reason?: string;
  /** 变卖估值（两；成功后） */
  valuation?: number;
  /** 新店铺数（成功后） */
  newShopCount?: number;
  /** 新员工上限（成功后） */
  newMaxEmployees?: number;
  /** 离职员工名（超出新上限的部分；调往他店注释见下） */
  laidOffNames?: string[];
  /** 保留员工（调往他店：主店可容纳的上限内全部保留） */
  keptEmployees?: Employee[];
}

/**
 * 变卖一家分店（纯函数）：
 * - shopCount ≤ 1 → 祖传老店不可变卖
 * - 现银 + 估值；店铺数 -1；员工上限按公式收敛；
 *   超出新上限的员工离职（分店伙计），其余自动调往他店。
 */
export function sellBranch(
  shopCount: number,
  employees: readonly Employee[]
): SellBranchResult {
  if (shopCount <= 1) {
    return { ok: false, reason: '此乃祖传老店，不可变卖' };
  }
  const newShopCount = shopCount - 1;
  const newMaxEmployees = maxEmployeesForShops(newShopCount);
  const kept = employees.slice(0, newMaxEmployees);
  const laidOff = employees.slice(newMaxEmployees);
  return {
    ok: true,
    valuation: estimateShopValue(),
    newShopCount,
    newMaxEmployees,
    laidOffNames: laidOff.map((e) => e.name),
    keptEmployees: kept.map((e) => ({ ...e })),
  };
}
