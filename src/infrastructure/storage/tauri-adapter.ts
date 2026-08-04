/**
 * v6.0.0 (P0-3 存储迁移): Tauri 存储适配器 — 实现 IStorageAdapter，走主进程 invoke
 *
 * 存档/设置落到本地文件（app_data_dir/frosthold/），不受 WebView2 localStorage 清理影响。
 * storage-router 检测到 `window.__TAURI__` 存在时自动选用。
 */
import type { IStorageAdapter } from './IStorageAdapter';

/** 全局 Tauri invoke（Tauri v2 注入 window.__TAURI__.core.invoke） */
function getInvoke(): ((cmd: string, args?: Record<string, unknown>) => Promise<unknown>) | null {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const w = window as any;
  const core = w?.__TAURI__?.core;
  if (core?.invoke) return core.invoke.bind(core);
  // Tauri v1 兼容
  if (w?.__TAURI_INVOKE__) return w.__TAURI_INVOKE__;
  return null;
}

export class TauriAdapter implements IStorageAdapter {
  readonly name = 'tauri';
  private invoke: NonNullable<ReturnType<typeof getInvoke>>;

  constructor() {
    const inv = getInvoke();
    if (!inv) throw new Error('Tauri invoke 不可用');
    this.invoke = inv;
  }

  async isAvailable(): Promise<boolean> {
    try {
      await this.invoke('storage_keys', {});
      return true;
    } catch { return false; }
  }

  async get<T>(key: string): Promise<T | null> {
    const val = await this.invoke('storage_read', { key }) as T | null;
    return val ?? null;
  }

  async set<T>(key: string, value: T): Promise<void> {
    await this.invoke('storage_write', { key, data: value as unknown });
  }

  async remove(key: string): Promise<void> {
    await this.invoke('storage_remove', { key });
  }

  async has(key: string): Promise<boolean> {
    const val = await this.invoke('storage_read', { key });
    return val !== null && val !== undefined;
  }

  async keys(): Promise<string[]> {
    return (await this.invoke('storage_keys', {})) as string[];
  }

  async clear(): Promise<void> {
    const ks = await this.keys();
    for (const k of ks) {
      await this.invoke('storage_remove', { key: k });
    }
  }

  async getUsageBytes(): Promise<number> {
    return -1; // 本地文件无配额概念
  }
}

/** 检测 Tauri 环境是否可用 */
export function isTauriEnv(): boolean {
  return typeof window !== 'undefined' && getInvoke() !== null;
}
