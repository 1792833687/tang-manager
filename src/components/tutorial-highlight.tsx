/**
 * 描金微光标记（TANG-TUT-002 模块二；tutorial-highlight）
 * 甲方规格：
 * - props { guideId, children, disabled }；
 * - tutorialFlags[guideId]=false 且 !disabled → 用 .tutorial-glow 包裹 children
 *   （描金边框呼吸微光，提示可点处）；
 * - 已读 → 直接渲染 children（不发光）；
 * - 子元素点击自动 markTutorialRead(guideId)（点击即视为已阅，发光消失）。
 * 13 处标记场景由各面板/导航用本组件包裹对应按钮（见回传报告接线清单）。
 */
'use client';
import React, { type ReactNode } from 'react';
import { useTangManagerStore } from '@/stores/tang-manager';

interface TutorialHighlightProps {
  /** 引导 id（tutorialFlags[guideId] 判已读） */
  guideId: string;
  children: ReactNode;
  /** 禁用标记（如面板未解锁/非 playing 阶段）；disabled 时不发光也不标记 */
  disabled?: boolean;
}

export function TutorialHighlight({
  guideId,
  children,
  disabled = false,
}: TutorialHighlightProps): React.ReactElement {
  const tutorialFlags = useTangManagerStore((s) => s.tutorialFlags ?? {});
  const markTutorialRead = useTangManagerStore((s) => s.markTutorialRead);

  const unread = !disabled && !tutorialFlags[guideId];
  if (!unread) return <>{children}</>;

  return (
    <div className="tutorial-glow" onClick={() => markTutorialRead(guideId)}>
      {children}
    </div>
  );
}
