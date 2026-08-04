/**
 * 阿昭提醒气泡（TANG-TUT-002 模块二；a-zhao-reminder）
 * 甲方规格：
 * - 阿昭小头像 40×40 圆形 + 对话气泡（宣纸色右下三角尖）；出现在页面顶部状态栏下方。
 * - 淡入 opacity 0→1 + translateY -5px→0 500ms；3 秒自动淡出；
 *   点击气泡 =「知道了」立即消失并标记已读。
 * - 仅 FIRST_EXPIRY 使用（kind='azhao'），文案 T1 已存；确认时自动
 *   markTutorialRead('FIRST_EXPIRY') + markTutorialRead('FIRST_SHELF')。
 * 实现：跟随 currentTutorial；阿昭气泡只在 currentTutorial 为 azhao 且未读时展示；
 * 3s 自动淡出或点击气泡 → acknowledgeAzhaoTutorial()（双标记）。
 */
'use client';
import React, { useEffect, useRef, useState } from 'react';
import { tangTutorialById } from '@/config/tang-tutorial-content';
import { useTangManagerStore } from '@/stores/tang-manager';
import { acknowledgeAzhaoTutorial } from '@/systems/tang-tutorial-triggers';
import { ANCIENT } from '@/theme/tokens';
import { NpcPortrait } from './npc-portrait';

/** 自动淡出时长（3 秒） */
const AUTO_DISMISS_MS = 3000;
/** 离场动画时长（azhao-out 200ms） */
const LEAVE_MS = 200;

export function AZhaoReminder(): React.ReactElement | null {
  const currentTutorial = useTangManagerStore((s) => s.currentTutorial);
  const playerGender = useTangManagerStore((s) => s.player?.gender ?? 'male');

  const [visible, setVisible] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const autoTimerRef = useRef<number | null>(null);
  const leaveTimerRef = useRef<number | null>(null);

  const content = currentTutorial ? tangTutorialById(currentTutorial) : null;
  const isAzhao = content?.kind === 'azhao';

  // 进入 azhao → 淡入；3s 后自动淡出并双标记；非 azhao → 隐藏
  useEffect(() => {
    if (isAzhao && currentTutorial) {
      setVisible(true);
      setLeaving(false);
      autoTimerRef.current = window.setTimeout(() => {
        setLeaving(true);
        leaveTimerRef.current = window.setTimeout(() => {
          acknowledgeAzhaoTutorial();
          setVisible(false);
        }, LEAVE_MS);
      }, AUTO_DISMISS_MS);
    } else {
      setVisible(false);
    }
    return () => {
      if (autoTimerRef.current !== null) window.clearTimeout(autoTimerRef.current);
      if (leaveTimerRef.current !== null) window.clearTimeout(leaveTimerRef.current);
    };
  }, [isAzhao, currentTutorial]);

  if (!isAzhao || !content || !visible) return null;

  /** 点击气泡 = 知道了：立即离场 + 双标记 */
  const handleClick = (): void => {
    if (leaving) return;
    if (autoTimerRef.current !== null) window.clearTimeout(autoTimerRef.current);
    setLeaving(true);
    leaveTimerRef.current = window.setTimeout(() => {
      acknowledgeAzhaoTutorial();
      setVisible(false);
    }, LEAVE_MS);
  };

  return (
    <div
      className="fixed left-1/2 z-[110] -translate-x-1/2"
      style={{
        top: 96, // 状态栏下方
        animation: leaving ? 'azhao-out 0.2s ease-in forwards' : 'azhao-in 0.5s ease-out',
        cursor: 'pointer',
      }}
      onClick={handleClick}
      role="button"
      aria-label="阿昭提醒"
    >
      <div className="flex items-start gap-2">
        {/* 阿昭小头像 40×40 圆形 */}
        <NpcPortrait
          npc="a-zhao"
          playerGender={playerGender}
          className="h-10 w-10 shrink-0 rounded-full object-cover"
        />
        {/* 对话气泡：宣纸色 + 右下三角尖（::after 三角朝下右） */}
        <div
          className="relative max-w-[min(76vw,320px)] rounded-lg px-3 py-2 text-xs leading-relaxed tracking-wide"
          style={{ backgroundColor: ANCIENT.card, border: `1px solid ${ANCIENT.primary}`, color: ANCIENT.text }}
        >
          {content.body}
          <span
            aria-hidden
            className="absolute -bottom-[7px] right-3 h-0 w-0"
            style={{
              borderLeft: '7px solid transparent',
              borderRight: '7px solid transparent',
              borderTop: `8px solid ${ANCIENT.card}`,
              filter: 'drop-shadow(0 1px 0 #4A7C59)',
            }}
          />
        </div>
      </div>
    </div>
  );
}
