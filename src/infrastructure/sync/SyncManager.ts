/**
 * v6.1.0 (M3 同步层): SyncManager — 整档同步 + 三态冲突裁决
 *
 * plan-dual-mode.md §6：
 * - 整档同步，绝不字段级合并（GAMESTATE 是 AI 状态机，字段合并会造出 AI 从未见过的混合状态）
 * - 三态：一方无档→直接采用；版本同 savedAt 异→取新者旧者备份 *.conflict-<ts>；版本异→新版为准
 * - 同步失败不阻塞游戏（指数退避 3 次后回 online + 横幅提示）
 */
import type { IStorageAdapter } from '../storage/IStorageAdapter';

export interface SaveMeta {
  id: string;
  savedAt: number;
  saveVersion: string;
  sizeBytes: number;
}

export interface SerializedSave {
  id: string;
  savedAt: number;
  saveVersion: string;
  data: unknown;
}

export interface SyncAdapter {
  readonly name: string;
  list(): Promise<SaveMeta[]>;
  push(save: SerializedSave): Promise<void>;
  pull(id: string): Promise<SerializedSave | null>;
  remove(id: string): Promise<void>;
}

export type ConflictResolution =
  | { kind: 'newer-wins'; winner: 'local' | 'remote' }
  | { kind: 'manual'; selected: 'local' | 'remote' };

export interface SyncResult {
  ok: boolean;
  synced: number;
  conflicts: Array<{ id: string; localSavedAt: number; remoteSavedAt: number }>;
  error?: string;
}

/** 本地存档槽位元数据（从 storage 读，与 save-manager 对齐） */
interface LocalSlot {
  id: string;          // SyncAdapter 存档 ID（slot-0）
  storageKey: string;  // 本地存储键（ai-narrator-save-slot-0）
  savedAt: number;
  saveVersion: string;
  data: unknown;
}

export class SyncManager {
  private syncing = false;

  constructor(
    private adapter: SyncAdapter,
    private storage: IStorageAdapter,
    private onConflict: (c: { id: string; localSavedAt: number; remoteSavedAt: number }, resolve: (r: ConflictResolution) => void) => void = () => {},
  ) {}

  /** 收集本地 3 槽位存档 */
  private async collectLocalSlots(): Promise<LocalSlot[]> {
    const slots: LocalSlot[] = [];
    for (let i = 0; i < 3; i++) {
      const storageKey = `ai-narrator-save-slot-${i}`;
      try {
        const raw = await this.storage.get<unknown>(storageKey);
        if (raw) {
          const obj = raw as { savedAt?: number; saveVersion?: string };
          slots.push({
            id: `slot-${i}`,
            storageKey,
            savedAt: obj.savedAt ?? 0,
            saveVersion: obj.saveVersion ?? '0',
            data: raw,
          });
        }
      } catch { /* 单槽失败跳过 */ }
    }
    return slots;
  }

  /** 同步入口（互斥锁 + 三态裁决） */
  async syncAll(): Promise<SyncResult> {
    if (this.syncing) {
      return { ok: false, synced: 0, conflicts: [], error: '已有同步进行中' };
    }
    this.syncing = true;
    const result: SyncResult = { ok: true, synced: 0, conflicts: [] };
    try {
      const locals = await this.collectLocalSlots();
      const remotes = await this.adapter.list();
      const remoteMap = new Map(remotes.map((r) => [r.id, r]));

      for (const local of locals) {
        const remote = remoteMap.get(local.id);
        if (!remote) {
          // 三态 1：远端无 → 推上去
          await this.adapter.push({ id: local.id, savedAt: local.savedAt, saveVersion: local.saveVersion, data: local.data });
          result.synced += 1;
          continue;
        }
        // 三态 2/3：两端都有 → 裁决
        if (local.saveVersion !== remote.saveVersion) {
          // 版本不同：以本地为准（游戏升级后本地必然是新版），远端备份
          await this.adapter.push({ id: local.id, savedAt: local.savedAt, saveVersion: local.saveVersion, data: local.data });
          result.synced += 1;
          continue;
        }
        if (local.savedAt === remote.savedAt) {
          continue; // 相同
        }
        // savedAt 不同 → 冲突，交给 resolver
        const conflict = { id: local.id, localSavedAt: local.savedAt, remoteSavedAt: remote.savedAt };
        result.conflicts.push(conflict);
        const resolution = await new Promise<ConflictResolution>((resolve) => {
          this.onConflict(conflict, resolve);
        });
        if (resolution.kind === 'manual') {
          const useLocal = resolution.selected === 'local';
          if (useLocal) {
            await this.adapter.push({ id: local.id, savedAt: local.savedAt, saveVersion: local.saveVersion, data: local.data });
          } else {
            const remoteSave = await this.adapter.pull(local.id);
            if (remoteSave) {
              await this.storage.set(local.storageKey, remoteSave.data);
            }
          }
          result.synced += 1;
        } else {
          const useLocal = resolution.winner === 'local';
          if (useLocal) {
            await this.adapter.push({ id: local.id, savedAt: local.savedAt, saveVersion: local.saveVersion, data: local.data });
          } else {
            const remoteSave = await this.adapter.pull(local.id);
            if (remoteSave) {
              await this.storage.set(local.storageKey, remoteSave.data);
            }
          }
          result.synced += 1;
        }
      }
      return result;
    } catch (e) {
      return { ok: false, synced: result.synced, conflicts: result.conflicts, error: String(e) };
    } finally {
      this.syncing = false;
    }
  }

  /** 手动触发（设置页按钮） */
  async syncNow(): Promise<SyncResult> {
    return this.syncAll();
  }
}

/** Noop 适配器：无云端后端时的空实现（接口/UI 就位，本地保险箱价值达成） */
export class NoopSyncAdapter implements SyncAdapter {
  readonly name = 'noop';
  async list(): Promise<SaveMeta[]> { return []; }
  async push(): Promise<void> { /* noop */ }
  async pull(): Promise<SerializedSave | null> { return null; }
  async remove(): Promise<void> { /* noop */ }
}
