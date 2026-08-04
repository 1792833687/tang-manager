/**
 * 成就面板（Step 2 需求 2.6；体验优化模块四紧凑化）
 * 双列网格、图标 32×32；已解锁绿色显示 + 说明；未解锁「？？？🔒」灰显 + 解锁条件文案。
 * 配置见 src/config/tang-achievements.ts（ACHIEVEMENTS 全量表）。
 */
'use client';
import { withBase } from '@/lib/utils/base-path';
import { ACHIEVEMENTS, ACHIEVEMENT_REWARDS } from '@/config/tang-achievements';
import { useTangManagerStore } from '@/stores/tang-manager';
import { ANCIENT } from '@/theme/tokens';
import { AncientCard } from './ancient-card';

export function AchievementPanel(): React.ReactElement {
  const unlocked = useTangManagerStore((s) => s.unlockedAchievements);

  return (
    <AncientCard title="成就 · 功业录">
      {/* 印章装饰条 */}
      <div className="mb-2 flex items-center gap-2">
        <img src={withBase('/images/icons/achievement-badge.svg')} alt="" aria-hidden className="h-5 w-5" />
        <span className="text-[11px] tracking-[0.3em]" style={{ color: ANCIENT.secondary }}>印记为凭 · 功业入册</span>
      </div>
      <div className="grid grid-cols-2 gap-1.5">
        {ACHIEVEMENTS.map((a) => {
          const isUnlocked = unlocked.includes(a.id);
          return (
            <div
              key={a.id}
              className="rounded-md px-2 py-1.5"
              style={{
                backgroundColor: isUnlocked ? ANCIENT.background : ANCIENT.card,
                border: `1px solid ${isUnlocked ? ANCIENT.primary : ANCIENT.border}`,
                opacity: isUnlocked ? 1 : 0.55,
              }}
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold" style={{ color: isUnlocked ? ANCIENT.primary : ANCIENT.text }}>
                  {isUnlocked ? a.name : '？？？'}
                </span>
                {/* 图标 32×32：已解锁青铜觚；未解锁锁形占位 */}
                {isUnlocked ? (
                  <img src={withBase('/images/icons/achievement.svg')} alt="" aria-hidden className="h-8 w-8" />
                ) : (
                  <span aria-hidden className="text-base">🔒</span>
                )}
              </div>
              <p className="mt-0.5 text-[11px] leading-relaxed" style={{ color: isUnlocked ? ANCIENT.secondary : ANCIENT.border }}>
                {isUnlocked ? a.description : a.conditionText}
              </p>
              {/* 成就奖励（内容深化 TANG-CONT-B 模块六·2）：已解锁展示奖励内容 */}
              {isUnlocked && ACHIEVEMENT_REWARDS[a.id] && (
                <p className="mt-0.5 text-[10px] tracking-wider" style={{ color: ANCIENT.accent }}>
                  奖励：{ACHIEVEMENT_REWARDS[a.id]!.desc}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </AncientCard>
  );
}
