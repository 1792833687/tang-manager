/**
 * 《我在唐朝当掌柜》多周目家族传承配置（v1.2 · 规格书模块三）
 * 上一局结局 → 下一局开局影响（8 结局逐字）。
 * 纯数据，不依赖 store；应用逻辑在 systems/tang-legacy-inheritance.ts。
 */
export interface LegacyEffect {
  /** 结局 id */
  ending: string;
  /** 叙事描述 */
  narrative: string;
  /** 开局影响字段（可选） */
  startSilver?: number;
  startCredit?: number;
  startReputation?: number;
  startFavor?: Record<string, number>;
  startStaffSatisfaction?: number;
  startClueCount?: number;
  clueWallUnlocked?: boolean;
  /** 经验获取倍率 */
  expMultiplier?: number;
  /** 负债倍率 */
  debtMultiplier?: number;
  /** 开局特殊员工（商界教父：徒弟） */
  specialEmployee?: boolean;
  /** 传承物品 id */
  inheritItem?: string;
  /** 官府盘查概率降低 */
  raidChanceReduction?: number;
}

/** 8 结局传承表（规格书 3.2 逐字） */
export const ENDING_LEGACY_EFFECTS: Record<string, LegacyEffect> = {
  'yi-dai-shang-sheng': { ending: 'yi-dai-shang-sheng', narrative: '手札最后一页浮现先祖手迹——那是你上一世的经营心得。', expMultiplier: 1.2 },
  'huang-shang': { ending: 'huang-shang', narrative: '朝廷里有人记得你陆家的功绩——但商界觉得你太过攀附权贵。', startCredit: 50, startReputation: 0, startFavor: { 'shen-tinglan': -20 } },
  'quan-qing-chao-ye': { ending: 'quan-qing-chao-ye', narrative: '前任留下的政治资本仍在——但暗处的人对你不放心。', startReputation: 30, raidChanceReduction: 0.5, startFavor: { 'xie-qi': -30 } },
  'gui-yin': { ending: 'gui-yin', narrative: '先祖留下话说要善待伙计。阿昭听说上一任掌柜的事，对你好感备至。', startFavor: { 'a-zhao': 30 }, startStaffSatisfaction: 20 },
  'shang-jie-jiao-fu': { ending: 'shang-jie-jiao-fu', narrative: '你前世培养的徒弟，这一世依然追随陆家。', specialEmployee: true },
  'jia-dao-zhong-luo': { ending: 'jia-dao-zhong-luo', narrative: '先祖吃过亏，给后人留了教训——同样的坑，你不会再踩。', debtMultiplier: 2, expMultiplier: 1.2 },
  'wu-ren-wen-jin': { ending: 'wu-ren-wen-jin', narrative: '上一世平平无奇，这一世从头再来。' },
  'zhi-qi-zhe': { ending: 'zhi-qi-zhe', narrative: '先祖看透了长安的棋局——他给你留了一张地图。', clueWallUnlocked: true, startClueCount: 3 },
};

/** 传承物品（规格书 3.4） */
export const LEGACY_ITEMS: Record<string, { name: string; narrative: string }> = {
  'persian-jade': { name: '萨迪的波斯玉佩', narrative: '上一世萨迪赠你的玉佩，这一世静静躺在手札里，泛着异域的光。' },
  'ancestral-sign': { name: '陆家祖传招牌', narrative: '你赎回的西市分号招牌，这一世依然挂在手札的扉页。' },
  'recommendation-letter': { name: '上官公子的推荐信', narrative: '那封为你引路的推荐信，这一世又从手札夹层里滑了出来。' },
};

/** 多周目成就定义（规格书 3.5） */
export interface MultiRunAchievementDef {
  id: string;
  name: string;
  desc: string;
  check: (runs: readonly RunRecord[]) => boolean;
}

/** 每局记录 */
export interface RunRecord {
  ending: string;
  totalDays: number;
  npcFavors: Record<string, number>;
  items: string[];
}
