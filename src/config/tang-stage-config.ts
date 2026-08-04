/**
 * 《我在唐朝当掌柜》阶段门槛配置（Step 5a 1.1）
 * - 用户 1.1 规格逐字落库；checkStageUpgrade（systems/tang-stage.ts）读取本表判定。
 * - 缺失字段的映射方案（工程决策，注释说明）：
 *   ① 店铺数量 → state.shopCount（初始 1；与沈听澜结为伙伴 shenPartner 时 +1）
 *   ② 谢七身份揭晓 → state.xieQiIdentityRevealed（谢七登场事件 resolveEventChoice 后置 true）
 *   ③ 谢七灰色线完成 → 以 xieQiFavor≥50 近似（当前事件系统无独立「灰色线完成」标记）
 *   ④ 特殊员工完整剧情 → state.specialEmployeeStoryCompleted（特殊员工背景揭露事件后置 true）
 * - 纯数据，不依赖 store。
 */
import type { StageRequirement } from '@/types/tang-manager';

/** 1→2、2→3、3→4 门槛（Record<1|2|3, StageRequirement>，key=当前阶段，升入 key+1） */
export const STAGE_REQUIREMENTS: Record<1 | 2 | 3, StageRequirement> = {
  1: {
    // 1→2：资金≥800 + 评分≥4.2 + 声望≥400 + 已触发沈听澜登场（eventLog 含 'shen-tinglan'）
    minGold: 800,
    minScore: 4.2,
    minReputation: 400,
    requiredEvent: 'shen-tinglan',
  },
  2: {
    // 2→3：店铺≥3 + 总收益≥80000 + 谢七身份揭晓 + ≥2 名员工满意度≥80
    minGold: 0,
    minScore: 0,
    minReputation: 0,
    minShopCount: 3,
    minTotalNetProfit: 80000,
    requireXieQiIdentityRevealed: true,
    minEmployeesSatisfied: 2,
    employeeSatisfactionThreshold: 80,
  },
  3: {
    // 3→4：声望≥700 + 资金≥150000 + （沈听澜合作线 或 谢七灰色线完成）+ ≥1 特殊员工完整剧情
    minGold: 150000,
    minScore: 0,
    minReputation: 700,
    requireShenPartner: true,
    minXieQiFavor: 50,
    requireSpecialEmployeeStory: true,
  },
};

/** 阶段中文名（UI 展示） */
export const STAGE_NAMES: Record<1 | 2 | 3 | 4, string> = {
  1: '初入商海',
  2: '崭露头角',
  3: '名动一坊',
  4: '长安翘楚',
};
