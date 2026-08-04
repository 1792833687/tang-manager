/**
 * zustand persist → StorageRouter 桥接（新建文件，不修改现有 storage 文件）
 *
 * 作用：把 zustand persist 的 StateStorage 接口（getItem/setItem/removeItem）
 * 接到项目既有 StorageRouter 四级降级链（Tauri → IndexedDB → localStorage → Memory）。
 * StateStorage 支持异步方法（返回 Promise），与 IStorageAdapter 天然匹配。
 *
 * 说明：adapter.set 内部会 JSON.stringify，get 内部会 JSON.parse——
 * 这里存/取的是「已被 createJSONStorage 序列化的 JSON 字符串」，语义一致。
 */
import type { StateStorage } from 'zustand/middleware';
import { StorageRouter } from './storage-router';

let bridge: StateStorage | null = null;

/** 获取（并缓存）持久化桥接实例 */
export function createZustandPersistStorage(): StateStorage {
  if (bridge) {
    return bridge;
  }
  bridge = {
    getItem: async (name: string): Promise<string | null> => {
      try {
        const adapter = await StorageRouter.getAdapter();
        return await adapter.get<string>(name);
      } catch (err) {
        console.warn('[TangManager] persist getItem failed:', err);
        return null;
      }
    },
    setItem: async (name: string, value: string): Promise<void> => {
      try {
        const adapter = await StorageRouter.getAdapter();
        await adapter.set(name, value);
      } catch (err) {
        console.warn('[TangManager] persist setItem failed:', err);
      }
    },
    removeItem: async (name: string): Promise<void> => {
      try {
        const adapter = await StorageRouter.getAdapter();
        await adapter.remove(name);
      } catch (err) {
        console.warn('[TangManager] persist removeItem failed:', err);
      }
    },
  };
  return bridge;
}
