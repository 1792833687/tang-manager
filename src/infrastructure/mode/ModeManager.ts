/**
 * v6.1.0 (M1 双模式): 模式状态机 — booting → online | offline | forced-offline | syncing
 *
 * plan-dual-mode.md §3：
 * - online：API 模式（心跳探测成功自动进入）
 * - offline：离线模式（navigator.onLine=false 或心跳连续失败）
 * - forced-offline：手动强制离线（省流量/隐私，最高优先级，不受心跳影响）
 * - syncing：回线同步中（瞬时，同步完成回 online）
 * - 保护：AI 请求进行中（busy）禁止切换；切入 offline 前强制 flush
 */
import { MODE_CONFIG } from './config';

export type GameMode = 'booting' | 'online' | 'offline' | 'forced-offline' | 'syncing';
export type ModeChangeReason = 'boot' | 'network-up' | 'network-down' | 'heartbeat-fail' | 'manual' | 'sync-done';

export interface ModeChangeEvent {
  mode: GameMode;
  reason: ModeChangeReason;
  /** 是否因断网/心跳失败自动进入（供横幅文案区分） */
  automatic: boolean;
}

type Listener = (e: ModeChangeEvent) => void;

export class ModeManager {
  private mode: GameMode = 'booting';
  private busy = false;
  private listeners: Listener[] = [];
  private flushAll: (() => Promise<void>) | null = null;

  get current(): GameMode { return this.mode; }
  get isBusy(): boolean { return this.busy; }
  get isOnline(): boolean { return this.mode === 'online' || this.mode === 'syncing'; }

  /** 注册 flush 回调（模式切换前强制写盘） */
  registerFlush(fn: () => Promise<void>): void {
    this.flushAll = fn;
  }

  private set(mode: GameMode, reason: ModeChangeReason, automatic = false): void {
    if (this.mode === mode) return;
    this.mode = mode;
    for (const l of this.listeners) {
      try { l({ mode, reason, automatic }); } catch { /* 监听器异常不影响状态机 */ }
    }
  }

  /** NetworkMonitor 上报网络状态 */
  reportNetwork(online: boolean): void {
    if (this.mode === 'forced-offline') return; // 手动优先级最高，不受心跳影响
    if (online && this.mode !== 'online') {
      // 回线 → syncing → (同步完成后 setSyncDone 回 online)
      this.set('syncing', 'network-up', false);
    } else if (!online && (this.mode === 'online' || this.mode === 'syncing' || this.mode === 'booting')) {
      this.set('offline', 'network-down', true);
    }
  }

  /** 心跳连续失败（NetworkMonitor 在 failThreshold 后调用） */
  reportHeartbeatFail(): void {
    if (this.mode === 'forced-offline') return;
    if (this.mode === 'online' || this.mode === 'syncing' || this.mode === 'booting') {
      this.set('offline', 'heartbeat-fail', true);
    }
  }

  /** 手动切换（设置页调用） */
  async setManual(forceOffline: boolean): Promise<void> {
    if (this.busy) {
      throw new Error('GM 正在构思，稍等片刻');
    }
    if (forceOffline) {
      await this.flushAll?.();
      this.set('forced-offline', 'manual', false);
    } else {
      // 退出 forced-offline → 心跳探测决定
      if (navigator.onLine === false) {
        this.set('offline', 'manual', false);
      } else {
        this.set('syncing', 'manual', false);
      }
    }
  }

  /** 同步完成回调（SyncManager 调） */
  setSyncDone(): void {
    if (this.mode === 'syncing') {
      this.set('online', 'sync-done', false);
    }
  }

  /** AI 请求申请锁 */
  async withBusy<T>(fn: () => Promise<T>): Promise<T> {
    this.busy = true;
    try { return await fn(); } finally { this.busy = false; }
  }

  subscribe(l: Listener): () => void {
    this.listeners.push(l);
    return () => {
      this.listeners = this.listeners.filter((x) => x !== l);
    };
  }

  /** 持久化偏好（设置随档） */
  toPreference(): 'auto' | 'forced-offline' {
    return this.mode === 'forced-offline' ? 'forced-offline' : 'auto';
  }

  /** 启动时按偏好恢复（booting → 偏好决定） */
  restorePreference(pref: 'auto' | 'forced-offline'): void {
    if (pref === 'forced-offline') {
      this.set('forced-offline', 'manual', false);
    } else {
      // auto → 等 NetworkMonitor 首次探测
      this.set('booting', 'boot', false);
    }
  }
}

/** 单例（应用级） */
export const modeManager = new ModeManager();

export { MODE_CONFIG };
