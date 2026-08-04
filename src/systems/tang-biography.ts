/**
 * 《我在唐朝当掌柜》伙计小传系统（TANG-ADD-001 模块七）
 * 小传："小传：手札录中为每位伙计专辟一页，随相处渐深，其过往自会浮现于纸上。"
 * 纯函数：
 * - generateBiography(employeeType)：入职生成 4 阶段框架（stage/title/content/unlockCondition/unlocked=false）。
 * - checkBiographyUnlock(employee, state)：清晨逐阶段解锁——
 *   1 出身（入职满 15 日）/ 2 为何来（满意度≥80）/ 3 隐藏暴露（好感≥70，以 xiaoerFavor 近似）/
 *   4 真故事（专属事件后，以 specialEmployeeStoryCompleted 近似）。
 * - biographyMasterUnlocked(employee)：4 阶段全解锁 → 获专属技能（BIOGRAPHY_MASTER_SKILL）。
 * 铁律：古风措辞；不持有游戏状态。
 */
import { BIOGRAPHY_MASTER_SKILL, BIOGRAPHY_TEMPLATES } from '@/config/tang-biography';
import type { BiographyEntry, Employee, EmployeeType } from '@/types/tang-manager';

/** 判定所需状态子集 */
export interface BiographyUnlockState {
  day: number;
  /** 阿昭好感/满意度（伙计好感近似；缺省 0） */
  xiaoerFavor: number;
  /** 特殊员工完整剧情（背景揭露事件） */
  specialEmployeeStoryCompleted: boolean;
}

/** 入职生成 4 阶段框架（全部未解锁；按员工 type 差异化模板） */
export function generateBiography(employeeType: EmployeeType): BiographyEntry[] {
  const templates = BIOGRAPHY_TEMPLATES[employeeType] ?? BIOGRAPHY_TEMPLATES.waiter;
  return templates.map((t, i) => ({
    stage: i + 1,
    title: t.title,
    content: t.content,
    unlockCondition: t.unlockCondition,
    unlocked: false,
  }));
}

/** 单阶段解锁判定（stage 1-4） */
export function biographyStageMet(stage: number, employee: Employee, state: BiographyUnlockState): boolean {
  switch (stage) {
    case 1:
      return state.day - employee.hireDay >= 15;
    case 2:
      return employee.satisfaction >= 80;
    case 3:
      return state.xiaoerFavor >= 70;
    case 4:
      return state.specialEmployeeStoryCompleted;
    default:
      return false;
  }
}

/**
 * 清晨逐阶段解锁：返回本次新解锁的条目（由 store 更新 employee.biography + biographyStage）。
 * 说明：若 employee 尚无 biography（旧档），先生成框架再判定。
 */
export function checkBiographyUnlock(
  employee: Employee,
  state: BiographyUnlockState
): { employee: Employee; newlyUnlocked: BiographyEntry[] } {
  const framework = employee.biography ?? generateBiography(employee.type);
  const newlyUnlocked: BiographyEntry[] = [];
  const next = framework.map((entry) => {
    if (entry.unlocked) return entry;
    if (biographyStageMet(entry.stage, employee, state)) {
      newlyUnlocked.push({ ...entry, unlocked: true });
      return { ...entry, unlocked: true };
    }
    return entry;
  });
  const unlockedCount = next.filter((e) => e.unlocked).length;
  return {
    employee: { ...employee, biography: next, biographyStage: Math.min(4, unlockedCount) },
    newlyUnlocked,
  };
}

/** 4 阶段全解锁 → 获专属技能（返回技能名；未全解锁返回 null） */
export function biographyMasterSkill(employee: Employee): { name: string; description: string } | null {
  const count = (employee.biography ?? []).filter((e) => e.unlocked).length;
  if (count < 4) return null;
  return BIOGRAPHY_MASTER_SKILL[employee.type] ?? null;
}
