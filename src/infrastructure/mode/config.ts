/**
 * v6.1.0 (M1 双模式): 模式配置 — 全部 [PLACEHOLDER] 附验证路径
 *
 * plan-dual-mode.md §8：
 * 验证路径：每项数值在 playtest 中按「断网→操作→回线」脚本实测，
 * 记录感知延迟与丢操作数，再定标。
 */
export const MODE_CONFIG = {
  heartbeat: {
    intervalMs: 30_000,   // [PLACEHOLDER] 心跳间隔；验证：移动端省电 vs 断网感知延迟
    timeoutMs: 5_000,     // [PLACEHOLDER] 单次探测超时；验证：弱网实测
    failThreshold: 2,     // 连续失败判定阈值（定值，勿调）
  },
  offline: {
    pendingQueueCap: 20,  // 离线队列上限；验证：超限丢弃是否造成困惑
    mergeDuplicates: true,// 重放合并重复意图（§5.1）
  },
  sync: {
    autoOnReconnect: true,// 回线自动同步
    retryMax: 3,          // 指数退避重试上限
    retryBaseMs: 2_000,   // [PLACEHOLDER]
  },
} as const;
