/**
 * v6.1.0 (M2 离线拦截): OfflineGate — 挂在 dispatchAction 前，拦截 AI 类操作
 *
 * plan-dual-mode.md §5：
 * - online/syncing → 放行
 * - 浏览类操作（browse）→ 放行（离线也能查配方/看世界书）
 * - 离线 AI 类操作 → 拦截 + 入 pending 队列（持久化），回线后按序重放
 * - 重放合并：重复意图合并为 1 条（离线世界没推进，3 次"前往市场"是 1 个意图）
 * - 队列上限 cap 条，超出丢弃最旧
 */
import { MODE_CONFIG } from './config';
import type { ModeManager } from './ModeManager';

export type ActionKind = 'ai' | 'browse';

export interface PendingAction {
  id: string;
  kind: ActionKind;
  text: string;       // 指令文本（发送给 AI）
  day: number;        // 发起时天数（合并判断用）
  ts: number;
}

export type GateDecision =
  | { allow: true }
  | { allow: false; pending: PendingAction };

export class OfflineGate {
  private pending: PendingAction[] = [];
  private cap = MODE_CONFIG.offline.pendingQueueCap;

  constructor(private mode: ModeManager) {}

  /** 恢复持久化队列（读档/启动时） */
  restore(queue: PendingAction[]): void {
    this.pending = queue.slice(0, this.cap);
  }

  /** 当前 pending 快照（持久化用） */
  snapshot(): PendingAction[] {
    return [...this.pending];
  }

  /**
   * dispatchAction 入口第一行调用。
   * @param kind ai=需要 AI 响应（对话/战斗/检定/低语）；browse=本地面板浏览
   * @param text 指令文本（ai 类必填）
   */
  intercept(kind: ActionKind, text: string, day: number): GateDecision {
    const m = this.mode.current;
    if (m === 'online' || m === 'syncing') return { allow: true };
    if (kind === 'browse') return { allow: true }; // 浏览放行

    // 离线 → 拦截入队
    const pending: PendingAction = {
      id: `pend-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
      kind,
      text,
      day,
      ts: Date.now(),
    };
    this.pending.push(pending);
    if (this.pending.length > this.cap) {
      this.pending.shift(); // 丢弃最旧
    }
    return { allow: false, pending };
  }

  /** 回线后取重放指令（合并重复意图，一次取一条供串行执行） */
  nextReplay(): { text: string; merged: number } | null {
    if (this.pending.length === 0) return null;
    const first = this.pending[0]!;
    this.pending = this.pending.slice(1);
    if (!MODE_CONFIG.offline.mergeDuplicates) {
      return { text: first.text, merged: 0 };
    }
    // 合并相同文本的后续项
    let merged = 0;
    const kept: PendingAction[] = [];
    for (const p of this.pending) {
      if (p.text === first.text) {
        merged += 1;
      } else {
        kept.push(p);
      }
    }
    this.pending = kept;
    return { text: first.text, merged };
  }

  /** 剩余 pending 数 */
  get length(): number {
    return this.pending.length;
  }

  /** 清空（玩家选择丢弃） */
  clear(): void {
    this.pending = [];
  }
}
