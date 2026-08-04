/**
 * 《我在唐朝当掌柜》药铺·坐堂医系统（产业系统 模块三 3.1）
 * 独立于酒楼/布庄产业逻辑：寻访郎中（午后方）→ 聘请 → 郎中坐堂每日自动接待病人 →
 * 病人拿方抓药（不占用玩家精力）→ 需库存匹配；常缺药则满意度降、可能离职。
 * 纯函数：rng 可注入。
 */
import { PHYSICIAN_NAME_POOL, PHYSICIAN_SPECIALTIES, industryLevel } from '@/config/tang-industry-content';
import type { Physician } from '@/types/tang-industry';

function pick<T>(arr: readonly T[], rng: () => number): T {
  const idx = Math.floor(rng() * arr.length);
  return arr[Math.min(idx, arr.length - 1)]!;
}

/** 生成坐堂郎中（纯函数）：医术越高月薪越高、病人越多 */
export function generatePhysician(rng: () => number = Math.random): Physician {
  const skill = 1 + Math.floor(rng() * 5); // 1-5
  return {
    id: `ph-${Date.now().toString(36)}-${Math.floor(rng() * 1000)}`,
    name: pick(PHYSICIAN_NAME_POOL, rng),
    specialty: pick(PHYSICIAN_SPECIALTIES, rng),
    skill,
    salary: 20 + skill * 15,
    reputation: skill * 15 + Math.floor(rng() * 20),
    patientsPerDay: skill, // 医术越高病人越多
    satisfaction: 60,
    status: 'active',
    personality: rng() < 0.5 ? '沉稳寡言' : '热忱健谈',
  };
}

/** 郎中每日问诊病人数（纯函数）：Lv5 翻倍 */
export function physicianDailyPatients(physician: Physician, herbalistLevel: number): number {
  const base = physician.patientsPerDay;
  return herbalistLevel >= 5 ? base * 2 : base;
}

/** 郎中开方所需药材（纯函数）：按专长取 1-2 味 */
export function physicianPrescription(physician: Physician, rng: () => number = Math.random): string[] {
  const pool: Record<string, string[]> = {
    内科: ['人参', '枸杞', '甘草'],
    外科: ['当归', '黄连'],
    妇科: ['当归', '枸杞'],
    儿科: ['甘草', '黄连'],
    针灸: ['当归', '人参'],
  };
  const herbs = pool[physician.specialty] ?? ['甘草'];
  const count = 1 + Math.floor(rng() * 2);
  return herbs.slice(0, Math.min(count, herbs.length));
}

/** 库存匹配判定（纯函数）：所需药材是否都有货 */
export function stockMatchesPrescription(prescription: string[], stock: Record<string, number>): boolean {
  return prescription.every((h) => (stock[h] ?? 0) > 0);
}

/** 郎中满意度变化（纯函数）：常缺药下降；加薪/赠礼上升 */
export function physicianSatisfactionChange(physician: Physician, missingDays: number, boosted: boolean): number {
  let delta = 0;
  if (missingDays >= 2) delta -= 5;
  if (missingDays >= 4) delta -= 8;
  if (boosted) delta += 10;
  return delta;
}

/** 郎中是否离职（纯函数）：满意度 <30 或 长期缺药 */
export function physicianLeaves(physician: Physician, missingDays: number): boolean {
  return physician.satisfaction < 30 || missingDays >= 6;
}

/** 低医术误诊（纯函数）：skill<3 有 5% 触发医疗纠纷 */
export function physicianMistake(physician: Physician, rng: () => number = Math.random): boolean {
  return physician.skill < 3 && rng() < 0.05;
}

/** 升级条件（3.3）：评分 + 累计治愈病人数 */
export function checkHerbalistLevelUp(level: number, score: number, curedCount: number): boolean {
  const next = industryLevel('herbalist', level + 1);
  if (next.level <= level) return false;
  return score >= next.require.score && curedCount >= next.require.count;
}

/** 郎中最多名额（按等级） */
export function maxPhysicians(herbalistLevel: number): number {
  return herbalistLevel >= 3 ? 2 : 1;
}

/** Lv4 客流量 +30%（纯函数；病患客源加成） */
export function herbalistTrafficBonus(herbalistLevel: number, base: number): number {
  return Math.round(base * (herbalistLevel >= 4 ? 1.3 : 1) * 10) / 10;
}

/** Lv5 药材售价 +20%（纯函数） */
export function herbalistPriceBonus(herbalistLevel: number, base: number): number {
  return Math.round(base * (herbalistLevel >= 5 ? 1.2 : 1) * 10) / 10;
}
