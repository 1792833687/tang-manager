/**
 * 游戏错误边界（v1.1 稳定性修复）
 * 任一组件的运行时异常不导致整棵树白屏/无法进入——捕获后展示可恢复提示（刷新/重试）。
 * 全部 ANCIENT 令牌。
 */
'use client';
import { Component, type ErrorInfo, type ReactNode } from 'react';
import { ANCIENT } from '@/theme/tokens';

interface State {
  hasError: boolean;
  message: string;
}

export class GameErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { hasError: false, message: '' };

  static getDerivedStateFromError(error: unknown): State {
    return { hasError: true, message: error instanceof Error ? error.message : String(error) };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('[tang] 游戏运行时错误：', error, info);
  }

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-6" style={{ backgroundColor: ANCIENT.background, color: ANCIENT.text }}>
          <h1 className="text-xl font-bold tracking-[0.3em]" style={{ color: ANCIENT.accent }}>出了岔子</h1>
          <p className="max-w-md text-center text-sm leading-6" style={{ color: ANCIENT.secondary }}>
            游戏遇到了问题：{this.state.message}
            <br />请刷新页面重试；若持续出现，可告知掌柜具体操作。
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="rounded-lg px-8 py-2 text-sm font-bold tracking-[0.3em]"
            style={{ backgroundColor: ANCIENT.primary, color: '#FFFFFF' }}
          >
            重新进入
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
