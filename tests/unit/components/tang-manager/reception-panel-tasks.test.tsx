/**
 * 今日要务 UI 渲染测试（2026-08-06 补 UI）
 * 直接渲染 ReceptionPanel（mock 重子组件），注入 todayTasks 断言「今日要务」卡片出现。
 */
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { useTangManagerStore } from '@/stores/tang-manager';
// reception-panel 未默认导入 React（Next 自动运行时）；vitest classic JSX 需全局 React
(globalThis as unknown as { React: unknown }).React = React;
import { ReceptionPanel } from '@/components/reception-panel';

vi.mock('@/components/tang-manager/dialogue-panel', () => ({ DialoguePanel: () => <div /> }));
vi.mock('./guest-book-panel', () => ({ GuestBookPanel: () => <div /> }));
vi.mock('./preorder-panel', () => ({ PreorderPanel: () => <div /> }));
vi.mock('./complaint-card', () => ({ ComplaintCard: () => null }));
vi.mock('./strategy-selector', () => ({ StrategySelector: () => <div /> }));
vi.mock('./tutorial-highlight', () => ({ TutorialHighlight: ({ children }: { children: React.ReactNode }) => <>{children}</> }));

beforeEach(() => {
  useTangManagerStore.getState().resetGame();
});

afterEach(() => {
  cleanup();
});

describe('今日要务 · ReceptionPanel 渲染', () => {
  it('todayTasks 非空 → 显示「今日要务」与任务标题/未了标记', () => {
    useTangManagerStore.setState({
      phase: 'playing',
      todayTasks: [
        { id: 't1', title: '接待三位客人', description: 'x', condition: {}, reward: {}, stampText: '了' },
        { id: 't2', title: '市集捡漏', description: 'x', condition: {}, reward: {}, stampText: '了' },
      ] as never,
      todayTasksCompleted: ['t1'],
    });
    render(<ReceptionPanel />);
    expect(screen.getByText('今日要务')).toBeTruthy();
    expect(screen.getByText('接待三位客人')).toBeTruthy();
    expect(screen.getByText('市集捡漏')).toBeTruthy();
    expect(screen.getByText('了')).toBeTruthy(); // t1 已完成盖「了」
    expect(screen.getByText('未了')).toBeTruthy(); // t2 未完成
  });

  it('todayTasks 为空 → 不渲染今日要务卡', () => {
    useTangManagerStore.setState({ phase: 'playing', todayTasks: [] as never, todayTasksCompleted: [] });
    render(<ReceptionPanel />);
    expect(screen.queryByText('今日要务')).toBeNull();
  });
});
