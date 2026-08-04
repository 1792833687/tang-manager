/**
 * 《我在唐朝当掌柜》布庄面料匹配度（2026-08-06 · 规格书模块四 4.3/4.4）
 * 纯函数：身份（40%）/ 季节（30%）/ 场合（30%）三维加权；量体 +20%。
 */
export interface FabricContext {
  /** 客人身份：official 官员 / noble 贵人 / commoner 平民 / merchant 商贾 */
  identity: 'official' | 'noble' | 'commoner' | 'merchant';
  /** 季节：spring/summer/autumn/winter */
  season: string;
  /** 场合：wedding 婚宴 / labor 劳作 / formal 官场 / casual 日常 */
  occasion: 'wedding' | 'labor' | 'formal' | 'casual';
  /** 所选面料：粗布/棉布/丝绸/锦缎 */
  fabric: string;
  /** 是否量体（+20%） */
  measured?: boolean;
}

/** 面料匹配度（0-100；规格书 4.3 加权） */
export function fabricMatchScore(ctx: FabricContext): number {
  let score = 100;
  // 身份 40%
  const identityAdj = identityAdjust(ctx.identity, ctx.fabric);
  score += identityAdj * 0.4;
  // 季节 30%
  const seasonAdj = seasonAdjust(ctx.season, ctx.fabric);
  score += seasonAdj * 0.3;
  // 场合 30%
  const occasionAdj = occasionAdjust(ctx.occasion, ctx.fabric);
  score += occasionAdj * 0.3;
  if (ctx.measured) score += 20;
  return Math.max(0, Math.min(100, Math.round(score)));
}

function identityAdjust(identity: FabricContext['identity'], fabric: string): number {
  if (identity === 'official' && fabric === '锦缎') return 20;
  if (identity === 'commoner' && fabric === '丝绸') return -10;
  return 0;
}

function seasonAdjust(season: string, fabric: string): number {
  if (season === 'summer' && fabric === '棉布') return 15;
  if (season === 'winter' && fabric === '丝绸') return -10;
  return 0;
}

function occasionAdjust(occasion: FabricContext['occasion'], fabric: string): number {
  if (occasion === 'wedding' && fabric === '锦缎') return 20;
  if (occasion === 'labor' && fabric === '丝绸') return -20;
  return 0;
}

/** 匹配档位（规格书 4.3）：≥80 满意 / 50-79 正常 / <50 可能重做退款 */
export function fabricTier(score: number): 'satisfied' | 'normal' | 'refund' {
  if (score >= 80) return 'satisfied';
  if (score >= 50) return 'normal';
  return 'refund';
}
