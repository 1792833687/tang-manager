/**
 * 《我在唐朝当掌柜》经营策略系统（内容深化 TANG-CONT-B 模块六·1）
 * 三档经营策略（玩家预设，当日生效；settleDay/startNewDay 接线）：
 * - thin 薄利多销：基础收益 ×0.8、客人数 +30%
 * - rare 奇货可居：基础收益 ×1.3、客人数 -30%
 * - steady 稳健经营：无修正
 * 设计决策（grep 确认现状后补接）：
 * ① 原代码无 businessStrategy 字段（接待策略 receptionStrategy 为另一概念，不参与结算）；
 *    本文件为唯一事实源：类型标注在 types/tang-manager.ts，数值因子在此，store 接线。
 * ② 收益修正放 settleDay 纯函数（影响基础收益 → 净收益），客人数修正放 startNewDay
 *    客流生成（影响今日客数），两处独立可测。
 * 铁律：古风措辞；纯函数；不持有游戏状态。
 */
import type { BusinessStrategy } from '@/types/tang-manager';

/** 三档策略中文名（UI/结算文案共用） */
export const BUSINESS_STRATEGY_LABEL: Record<BusinessStrategy, string> = {
  thin: '薄利多销',
  rare: '奇货可居',
  steady: '稳健经营',
};

/** 三档策略说明（策略选择器展示） */
export const BUSINESS_STRATEGY_DESC: Record<BusinessStrategy, string> = {
  thin: '基础收益 ×0.8 · 客人数 +30%',
  rare: '基础收益 ×1.3 · 客人数 -30%',
  steady: '无修正',
};

/** 基础收益系数（settleDay 接线；薄利多销 ×0.8 / 奇货可居 ×1.3 / 稳健 1） */
export function businessStrategyIncomeFactor(strategy: BusinessStrategy | undefined): number {
  switch (strategy) {
    case 'thin':
      return 0.8;
    case 'rare':
      return 1.3;
    default:
      return 1;
  }
}

/** 客人数系数（startNewDay 客流接线；薄利多销 +30% / 奇货可居 -30% / 稳健 1） */
export function businessStrategyGuestFactor(strategy: BusinessStrategy | undefined): number {
  switch (strategy) {
    case 'thin':
      return 1.3;
    case 'rare':
      return 0.7;
    default:
      return 1;
  }
}
