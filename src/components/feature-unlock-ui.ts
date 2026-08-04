/**
 * 功能解锁 UI 辅助（v1.0 打磨 TANG-POLISH-001 模块二；feature-unlock-ui）
 * 导航侧栏/移动底部栏共用：读取 store.unlockedFeatures 并判定「未解锁 + 原因提示」。
 * 纯展示辅助：不写 store、不裁决数值（裁决在 systems/tang-feature-unlock.ts）。
 * 未解锁 → 灰显（opacity 0.4 + grayscale）+ title/hover 提示条件；解锁动画由调用方 class 控制。
 */
import { useTangManagerStore } from '@/stores/tang-manager';
import { getUnlockCondition } from '@/systems/tang-feature-unlock';

/** 功能解锁 UI 状态：feature 是否已解锁 / 未解锁原因（null=已解锁或无该功能） */
export interface FeatureUnlockUiState {
  locked: boolean;
  reason: string | null;
}

/** 读取某导航项的解锁展示状态（day/reputation/employees/stage/achievements 取自 store 实时值） */
export function useFeatureUnlockUi(featureId: string): FeatureUnlockUiState {
  const unlockedFeatures = useTangManagerStore((s) => s.unlockedFeatures ?? {});
  const day = useTangManagerStore((s) => s.day);
  const reputation = useTangManagerStore((s) => s.reputation);
  const employeesCount = useTangManagerStore((s) => s.employees?.length ?? 0);
  const stage = useTangManagerStore((s) => s.stage);
  const unlockedAchievementsCount = useTangManagerStore((s) => s.unlockedAchievements?.length ?? 0);

  // 已解锁（unlockedFeatures 记录）→ 正常显示
  if (unlockedFeatures[featureId]) {
    return { locked: false, reason: null };
  }
  const reason = getUnlockCondition(featureId, unlockedFeatures, {
    day,
    reputation,
    employeesCount,
    stage,
    unlockedAchievementsCount,
  });
  return { locked: reason !== null, reason };
}
