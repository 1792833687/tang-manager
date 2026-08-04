/**
 * 新手引导（TANG-TUT-002 模块二）UI 组件验收测试
 *
 * 覆盖：
 * 1. TutorialHighlight：未读发光包裹 / 点击标记已读 / 已读直渲染 / disabled 不发光
 * 2. TutorialOverlay：手札弹窗渲染 + 「知道了」标记已读；
 *    重要引导遮罩不可点关闭；非重要可点遮罩关闭（dismiss 不标已读）；
 *    阿昭（azhao）不走手札弹窗（返回 null）
 * 3. AZhaoReminder：FIRST_EXPIRY 渲染气泡；点击 → 双标记已读
 */
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useTangManagerStore } from '@/stores/tang-manager';
import { TutorialHighlight } from '@/components/tutorial-highlight';
import { TutorialOverlay } from '@/components/tutorial-overlay';
import { AZhaoReminder } from '@/components/a-zhao-reminder';

// npc-portrait 为边界零触碰美术组件（不含 React 默认导入，vitest classic JSX 下不可渲染）；
// 阿昭气泡测试只关心气泡正文/双标记，此处 mock 立绘为空节点。
vi.mock('@/components/npc-portrait', () => ({
  NpcPortrait: function MockPortrait(): null {
    return null;
  },
}));

beforeEach(() => {
  useTangManagerStore.getState().resetGame();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('TANG-TUT-002 · TutorialHighlight 描金微光', () => {
  it('未读 → 用 .tutorial-glow 包裹 children', () => {
    render(
      <TutorialHighlight guideId="FIRST_SHELF">
        <button type="button">货架</button>
      </TutorialHighlight>
    );
    const glow = document.querySelector('.tutorial-glow');
    expect(glow).not.toBeNull();
    expect(screen.getByText('货架')).toBeTruthy();
  });

  it('子元素点击 → 自动 markTutorialRead（发光消失）', () => {
    render(
      <TutorialHighlight guideId="FIRST_SHELF">
        <button type="button">货架</button>
      </TutorialHighlight>
    );
    fireEvent.click(screen.getByText('货架'));
    expect(useTangManagerStore.getState().tutorialFlags['FIRST_SHELF']).toBe(true);
    // 已读后重渲染 → 无 glow
    cleanup();
    render(
      <TutorialHighlight guideId="FIRST_SHELF">
        <button type="button">货架</button>
      </TutorialHighlight>
    );
    expect(document.querySelector('.tutorial-glow')).toBeNull();
  });

  it('已读 → 直接渲染 children（无 glow）', () => {
    useTangManagerStore.getState().markTutorialRead('FIRST_BANK');
    render(
      <TutorialHighlight guideId="FIRST_BANK">
        <button type="button">钱庄</button>
      </TutorialHighlight>
    );
    expect(document.querySelector('.tutorial-glow')).toBeNull();
    expect(screen.getByText('钱庄')).toBeTruthy();
  });

  it('disabled → 不发光也不标记', () => {
    render(
      <TutorialHighlight guideId="FIRST_MAP" disabled>
        <button type="button">舆图</button>
      </TutorialHighlight>
    );
    expect(document.querySelector('.tutorial-glow')).toBeNull();
    fireEvent.click(screen.getByText('舆图'));
    expect(useTangManagerStore.getState().tutorialFlags['FIRST_MAP']).toBeUndefined();
  });
});

describe('TANG-TUT-002 · TutorialOverlay 家传手札弹窗', () => {
  it('currentTutorial 为 handbook → 渲染手札卡（标题/正文/知道了）', () => {
    useTangManagerStore.getState().showTutorial('FIRST_SETTLE');
    render(<TutorialOverlay />);
    expect(screen.getByText('家传手札')).toBeTruthy();
    expect(screen.getByText('——先祖手书')).toBeTruthy();
    expect(screen.getByText('知道了')).toBeTruthy();
  });

  it('「知道了」→ markTutorialRead + 关闭当前引导（200ms 后）', () => {
    vi.useFakeTimers();
    useTangManagerStore.getState().showTutorial('FIRST_SETTLE');
    render(<TutorialOverlay />);
    fireEvent.click(screen.getByText('知道了'));
    // 动画播放中（closing），尚未标记
    expect(useTangManagerStore.getState().tutorialFlags['FIRST_SETTLE']).toBeUndefined();
    vi.advanceTimersByTime(250);
    expect(useTangManagerStore.getState().tutorialFlags['FIRST_SETTLE']).toBe(true);
    expect(useTangManagerStore.getState().currentTutorial).toBeNull();
  });

  it('重要引导（welcome）→ 遮罩点击不可关闭', () => {
    useTangManagerStore.getState().showTutorial('WELCOME');
    render(<TutorialOverlay />);
    const overlay = document.querySelector('.fixed.inset-0');
    expect(overlay).not.toBeNull();
    fireEvent.click(overlay as Element);
    expect(useTangManagerStore.getState().currentTutorial).toBe('WELCOME');
    expect(useTangManagerStore.getState().tutorialFlags['WELCOME']).toBeUndefined();
  });

  it('非重要引导（first_settle）→ 遮罩点击 = dismiss（不标已读，200ms 后）', () => {
    vi.useFakeTimers();
    useTangManagerStore.getState().showTutorial('FIRST_SETTLE');
    render(<TutorialOverlay />);
    const overlay = document.querySelector('.fixed.inset-0');
    fireEvent.click(overlay as Element);
    expect(useTangManagerStore.getState().currentTutorial).toBe('FIRST_SETTLE'); // 动画中未关
    vi.advanceTimersByTime(250);
    expect(useTangManagerStore.getState().currentTutorial).toBeNull();
    expect(useTangManagerStore.getState().tutorialFlags['FIRST_SETTLE']).toBeUndefined();
  });

  it('阿昭（azhao）→ 不走手札弹窗（返回 null）', () => {
    useTangManagerStore.getState().showTutorial('FIRST_EXPIRY');
    const { container } = render(<TutorialOverlay />);
    expect(container.firstChild).toBeNull();
  });

  it('无当前引导 → 返回 null', () => {
    const { container } = render(<TutorialOverlay />);
    expect(container.firstChild).toBeNull();
  });
});

describe('TANG-TUT-002 · AZhaoReminder 阿昭气泡', () => {
  it('currentTutorial=FIRST_EXPIRY → 渲染气泡正文', () => {
    useTangManagerStore.getState().showTutorial('FIRST_EXPIRY');
    render(<AZhaoReminder />);
    // 阿昭文案（T1 已存）逐字片段
    expect(screen.getByText(/货架上有几样货放得久了/)).toBeTruthy();
    expect(screen.getByText(/折价出了/)).toBeTruthy();
  });

  it('点击气泡 → 双标记已读（FIRST_EXPIRY + FIRST_SHELF）并关闭', () => {
    vi.useFakeTimers();
    useTangManagerStore.getState().showTutorial('FIRST_EXPIRY');
    render(<AZhaoReminder />);
    const bubble = screen.getByRole('button', { name: '阿昭提醒' });
    fireEvent.click(bubble);
    // 离场动画 200ms 后标记
    vi.advanceTimersByTime(250);
    const s = useTangManagerStore.getState();
    expect(s.tutorialFlags['FIRST_EXPIRY']).toBe(true);
    expect(s.tutorialFlags['FIRST_SHELF']).toBe(true);
    expect(s.currentTutorial).toBeNull();
  });

  it('非 azhao 引导 → 不渲染', () => {
    useTangManagerStore.getState().showTutorial('FIRST_GUEST');
    const { container } = render(<AZhaoReminder />);
    expect(container.firstChild).toBeNull();
  });
});
