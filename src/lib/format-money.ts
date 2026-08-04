/**
 * 金钱展示取整（内容深化模块九；format-money）
 * 铁律：store 金额字段保持小数精度（裁决/存档不受影响），仅展示层统一取整。
 * - formatMoney(value)    → 整数 + "两"后缀（"50两"；负数 "-50两"；0 "0两"）
 * - formatMoneyRaw(value) → 取整后的数字（供计算/汇总展示，如比例、合计）
 * 纯函数、无副作用；非有限值兜底为 0，避免 UI 出现 "NaN两"。
 */
export function formatMoney(value: number): string {
  const n = Math.round(Number.isFinite(value) ? value : 0);
  return `${n}两`;
}

/** 取整后的数字（与 formatMoney 同一口径，供需要数字的展示计算使用） */
export function formatMoneyRaw(value: number): number {
  return Math.round(Number.isFinite(value) ? value : 0);
}
