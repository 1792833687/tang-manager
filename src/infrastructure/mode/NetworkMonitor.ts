/**
 * v6.1.0 (M1 双模式): 网络监测 — navigator.onLine + AI 端点心跳探测
 *
 * plan-dual-mode.md §4：
 * - navigator.onLine 不可靠（"浏览器有网" ≠ "DeepSeek 可达"）→ 心跳真请求 AI 端点
 * - 失败连续 failThreshold 次才判离线（防抖动）；成功 1 次即判在线（快回）
 * - 探测目标 = 当前模型 base URL（探对目标才有意义）
 */
import { MODE_CONFIG } from './config';

export class NetworkMonitor {
  private probeUrl: string;
  private failCount = 0;
  private timer: ReturnType<typeof setInterval> | null = null;
  private started = false;

  constructor(
    probeUrl: string,
    private onChange: (online: boolean) => void,
    private onHeartbeatFail: () => void,
    private intervalMs: number = MODE_CONFIG.heartbeat.intervalMs,
    private timeoutMs: number = MODE_CONFIG.heartbeat.timeoutMs,
    private failThreshold: number = MODE_CONFIG.heartbeat.failThreshold,
  ) {
    this.probeUrl = probeUrl;
  }

  /** 更新探测目标（模型切换时调用） */
  setProbeUrl(url: string): void {
    this.probeUrl = url;
  }

  start(): void {
    if (this.started) return;
    this.started = true;
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => { this.failCount = 0; this.onChange(true); });
      window.addEventListener('offline', () => this.onChange(false));
    }
    this.timer = setInterval(() => this.probe(), this.intervalMs);
    // 启动即探测一次（booting → 快速定态）
    void this.probe();
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    this.started = false;
  }

  /** 心跳：HEAD 请求 AI 端点（超时即不可达） */
  private async probe(): Promise<void> {
    if (!this.probeUrl) return;
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), this.timeoutMs);
      await fetch(this.probeUrl, { method: 'HEAD', signal: ctrl.signal });
      clearTimeout(timer);
      this.failCount = 0;
      this.onChange(true);
    } catch {
      this.failCount += 1;
      if (this.failCount >= this.failThreshold) {
        this.onHeartbeatFail();
      }
      // 未达阈值不切模式（防抖动），但不上报 online
    }
  }
}
