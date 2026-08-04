/**
 * 《我在唐朝当掌柜》学艺/拜师系统（TANG-SOC-001 模块三）
 * 学艺："学艺：花费束脩请名师指点，可精进技艺或习得新技。"
 * 授业："授业：送伙计去师傅处学手艺，耗时数日，学成后技艺精进。"
 * 纯函数：sendForTraining / checkTrainingCompletion / findMaster / azhaoGrowth；
 * store 接线（每日清晨 checkTrainingCompletion）。
 * 规则（用户 6.1 逐字）：
 * - sendForTraining：束脩 基础 50 + 每级 30（按已有技能数）；周期 3-7 天（技能等级/复杂度）；
 *   学艺中不可排班（trainingCompletionDay）；学成 effect×1.5 或解锁新技能；失败 5%（满意度-10）。
 * - findMaster：需地图对应区域解锁；费用 200+；周期 2-4 天；成功率 95%；10% 隐藏绝技
 *   （宫廷秘方 酒楼售价+30% / 蜀锦织法 布庄丝绸品质+25% / 太医院手法 药铺问诊+30%——effect 注释接入）。
 * - azhaoGrowth：好感 60→「心思细腻」（反噬-20%）/80→「死心塌地」（满意度下限 40）/
 *   赎妹妹剧情→「兄妹同心」（效率×1.5）——配置/注释占位（剧情未实装，函数可测）。
 */
import type { Employee, EmployeeSkillType, MasterResult, TrainingCompletionResult, TrainingResult } from '@/types/tang-manager';
import { SKILL_POOL } from '@/config/tang-employee-skills';
import { getLayerUnlockRule } from '@/config/tang-map-data';
import type { MapLayer } from '@/types/tang-map';

/** 学艺束脩基础（两） */
export const TRAINING_BASE_COST = 50;
/** 每级束脩（两；按已有技能数） */
export const TRAINING_COST_PER_SKILL = 30;
/** 学艺失败率 */
export const TRAINING_FAIL_RATE = 0.05;
/** 学艺失败满意度惩罚 */
export const TRAINING_FAIL_SATISFACTION = 10;
/** 学成效果倍率 */
export const TRAINING_EFFECT_MULTIPLIER = 1.5;

/** 技能类型 → 复杂度（决定周期档位） */
const SKILL_COMPLEXITY: Record<EmployeeSkillType, number> = {
  quality: 3,
  efficiency: 2,
  cost: 2,
  special: 4,
};

/** 拜师成功率 */
export const MASTER_SUCCESS_RATE = 0.95;
/** 拜师费用基础（两） */
export const MASTER_BASE_COST = 200;
/** 隐藏绝技概率 */
export const MASTER_HIDDEN_RATE = 0.1;

/** 师傅名池 */
const MASTER_NAMES = ['张老师傅', '刘把式', '孙掌柜', '李师傅', '王先生'];

/** 隐藏绝技（酒楼/布庄/药铺；effect 注释接入结算） */
export const HIDDEN_MASTERPIECES: Record<string, { name: string; description: string; effect: { type: string; value: number } }> = {
  jiulou: {
    name: '宫廷秘方',
    description: '学得宫廷御膳秘方，酒楼售价 +30%。',
    effect: { type: 'price', value: 0.3 },
  },
  buzhuang: {
    name: '蜀锦织法',
    description: '学得蜀锦织法，布庄丝绸品质 +25%。',
    effect: { type: 'quality', value: 0.25 },
  },
  yaopu: {
    name: '太医院手法',
    description: '学得太医院问诊手法，药铺问诊 +30%。',
    effect: { type: 'diagnose', value: 0.3 },
  },
};

/** 技能按 id 查找（全池） */
export function skillById(skillId: string) {
  return Object.values(SKILL_POOL).flat().find((s) => s.id === skillId);
}

/** 学艺周期（天）：复杂度基础 + 已有技能数 0-2 随机浮动 → 3-7 */
export function trainingDuration(skillType: EmployeeSkillType, skillCount: number, rng: () => number): number {
  const base = SKILL_COMPLEXITY[skillType] ?? 2;
  return Math.min(7, Math.max(3, base + skillCount + Math.floor(rng() * 2)));
}

/**
 * 送伙计学艺。返回 TrainingResult；失败（钱不够/已学艺中/技能不存在）ok=false。
 * 学艺中不可排班（trainingCompletionDay>day 时 assignShift 拒绝）。
 */
export function sendForTraining(
  employeeId: string,
  skillId: string,
  employees: readonly Employee[],
  silver: number,
  day: number,
  rng: () => number = Math.random
): TrainingResult | null {
  const emp = employees.find((e) => e.id === employeeId);
  const skill = skillById(skillId);
  if (!emp || !skill) {
    return { ok: false, employeeId, cost: 0, durationDays: 0, completionDay: 0, reason: '伙计或技艺不存在', content: '' };
  }
  if ((emp.trainingCompletionDay ?? 0) > day) {
    return { ok: false, employeeId, cost: 0, durationDays: 0, completionDay: 0, reason: '学艺中不可再学', content: '' };
  }
  const skillCount = emp.skills?.length ?? 0;
  const cost = TRAINING_BASE_COST + skillCount * TRAINING_COST_PER_SKILL;
  if (silver < cost) {
    return { ok: false, employeeId, cost, durationDays: 0, completionDay: 0, reason: `束脩不足（需 ${cost} 两）`, content: '' };
  }
  const durationDays = trainingDuration(skill.type, skillCount, rng);
  const completionDay = day + durationDays;
  // 学成效果：已有该技能 → effect×1.5；否则解锁新技能
  const unlockedNew = !emp.skills.some((s) => s.id === skillId);
  return {
    ok: true,
    employeeId,
    cost,
    durationDays,
    completionDay,
    effectMultiplier: unlockedNew ? undefined : TRAINING_EFFECT_MULTIPLIER,
    unlockedNew,
    content: `东家出资 ${cost} 两束脩，送${emp.name}去学「${skill.name}」，约 ${durationDays} 日后学成。`,
  };
}

/**
 * 每日清晨结算学艺到期。返回学成/失败列表 + 更新后员工。
 * 学成：解锁新技能（追加 skills）或 effect×1.5（标记 trainedSkillIds）；失败：满意度-10。
 */
export function checkTrainingCompletion(
  employees: readonly Employee[],
  day: number,
  rng: () => number = Math.random
): { employees: Employee[]; results: TrainingCompletionResult[] } {
  const results: TrainingCompletionResult[] = [];
  const next = employees.map((e) => {
    if (!e.trainingCompletionDay || e.trainingCompletionDay > day) {
      return { ...e };
    }
    // 到期结算（用 trainedSkillIds 记录本次学艺的 skillId；缺省按满意度失败逻辑）
    const trainedId = e.trainedSkillIds?.at(-1);
    const skill = trainedId ? skillById(trainedId) : undefined;
    const success = rng() >= TRAINING_FAIL_RATE;
    if (!success) {
      results.push({
        employeeId: e.id,
        employeeName: e.name,
        skillId: trainedId ?? 'unknown',
        skillName: skill?.name ?? '技艺',
        success: false,
        satisfactionPenalty: TRAINING_FAIL_SATISFACTION,
        content: `${e.name}学艺不成，白费了束脩，垂头丧气（满意度-${TRAINING_FAIL_SATISFACTION}）。`,
      });
      return {
        ...e,
        trainingCompletionDay: undefined,
        satisfaction: Math.max(0, e.satisfaction - TRAINING_FAIL_SATISFACTION),
      };
    }
    if (skill) {
      // 学成：解锁新技能或强化
      const hasSkill = e.skills.some((s) => s.id === skill.id);
      results.push({
        employeeId: e.id,
        employeeName: e.name,
        skillId: skill.id,
        skillName: skill.name,
        success: true,
        effectMultiplier: hasSkill ? TRAINING_EFFECT_MULTIPLIER : undefined,
        content: hasSkill
          ? `${e.name}学成归来，「${skill.name}」更精进一层（效果×${TRAINING_EFFECT_MULTIPLIER}）。`
          : `${e.name}学成归来，习得新技「${skill.name}」。`,
      });
      return {
        ...e,
        trainingCompletionDay: undefined,
        trainedSkillIds: [...(e.trainedSkillIds ?? []).filter((id) => id !== skill.id), skill.id],
        skills: hasSkill ? e.skills : [...e.skills, skill],
      };
    }
    // skill 缺失（防御）：仍结算成功但无具体技艺
    results.push({
      employeeId: e.id,
      employeeName: e.name,
      skillId: trainedId ?? 'unknown',
      skillName: '技艺',
      success: true,
      content: `${e.name}学成归来，技艺精进。`,
    });
    return { ...e, trainingCompletionDay: undefined };
  });
  return { employees: next, results };
}

/**
 * 拜师（授业）。需地图对应区域解锁（skillType 映射层）；费用 200+；周期 2-4 天；成功率 95%；10% 隐藏绝技。
 * @param skillType 技能类别（quality/efficiency/cost/special）
 * @param unlockedLayers 已解锁地图层（store state）
 * @param shopType 店型（决定隐藏绝技）
 */
export function findMaster(
  skillType: EmployeeSkillType,
  unlockedLayers: readonly MapLayer[],
  shopType: string | null,
  rng: () => number = Math.random
): MasterResult {
  // 需地图对应区域解锁：east_west_market（东市西市）为拜师门槛
  const requiredLayer: MapLayer = 'east_west_market';
  const rule = getLayerUnlockRule(requiredLayer);
  if (!unlockedLayers.includes(requiredLayer)) {
    return {
      ok: false,
      masterName: '',
      cost: 0,
      durationDays: 0,
      successRate: MASTER_SUCCESS_RATE,
      reason: `需先解锁「${rule.label}」方可拜师`,
      content: `地图上东市西市尚未打通，拜师无门。`,
    };
  }
  const masterName = MASTER_NAMES[Math.floor(rng() * MASTER_NAMES.length)]!;
  const cost = MASTER_BASE_COST + Math.floor(rng() * 4) * 50; // 200-350
  const durationDays = 2 + Math.floor(rng() * 3); // 2-4
  const hidden = rng() < MASTER_HIDDEN_RATE ? HIDDEN_MASTERPIECES[shopType ?? 'jiulou'] ?? HIDDEN_MASTERPIECES.jiulou : undefined;
  return {
    ok: true,
    masterName,
    cost,
    durationDays,
    successRate: MASTER_SUCCESS_RATE,
    hiddenMasterpiece: hidden,
    content: `东家寻得${masterName}，束脩 ${cost} 两，约 ${durationDays} 日学成。${hidden ? `有缘习得绝技「${hidden.name}」！` : ''}`,
  };
}

/** 阿昭成长结果 */
export interface AzhaoGrowthResult {
  trait: 'xinsi' | 'sixin' | 'xiongmei' | null;
  traitName: string;
  description: string;
  /** 效果（注释接入：反噬-20% / 满意度下限 40 / 效率×1.5） */
  effects: { type: string; value: number };
}

/**
 * 阿昭成长（3.3 逐字）：好感 60→「心思细腻」（反噬-20%）/80→「死心塌地」（满意度下限 40）/
 * 赎妹妹剧情→「兄妹同心」（效率×1.5）。配置/注释占位（剧情未实装，函数可测）。
 */
export function azhaoGrowth(
  xiaoerFavor: number,
  opts: { rescuedSister?: boolean } = {}
): AzhaoGrowthResult {
  if (opts.rescuedSister) {
    return {
      trait: 'xiongmei',
      traitName: '兄妹同心',
      description: '你赎出阿昭的妹妹，她死心塌地，把铺子当自家（效率×1.5）。',
      effects: { type: 'efficiency', value: 1.5 },
    };
  }
  if (xiaoerFavor >= 80) {
    return {
      trait: 'sixin',
      traitName: '死心塌地',
      description: '阿昭对你死心塌地，再苦再累也不离不弃（满意度下限 40）。',
      effects: { type: 'satisfaction_floor', value: 40 },
    };
  }
  if (xiaoerFavor >= 60) {
    return {
      trait: 'xinsi',
      traitName: '心思细腻',
      description: '阿昭愈发心思细腻，通晓人心反噬减轻（反噬-20%）。',
      effects: { type: 'backlash_reduction', value: 0.2 },
    };
  }
  return { trait: null, traitName: '', description: '', effects: { type: 'none', value: 0 } };
}
