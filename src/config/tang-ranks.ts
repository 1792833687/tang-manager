/**
 * 《我在唐朝当掌柜》商阶配置（TANG-ADD-001 模块八）
 * 商阶："商阶：长安商界的辈分。从白丁到商圣，非一日之功——手札会根据你的成就自动评定。"
 * 7 段位逐字：白丁 0 / 学徒 30日 / 行商 评等3.0 / 掌柜 分店2 / 大贾 资产10万 /
 * 巨擘 复合900 / 商圣 结局。
 * 纯数据，不依赖 store；评定纯函数在 systems/tang-ranks.ts。
 */
import type { MerchantRank } from '@/types/tang-manager';

/** 商阶全量（顺序即评定阈值由高到低遍历） */
export const MERCHANT_RANKS: readonly MerchantRank[] = [
  { id: 'shang-sheng', name: '商圣', threshold: 0, type: 'ending', description: '名动天下，货通四海。' },
  { id: 'ju-bo', name: '巨擘', threshold: 900, type: 'composite', description: '长安商界，只手遮天。' },
  { id: 'da-jia', name: '大贾', threshold: 100000, type: 'asset', description: '家资十万，富甲一方。' },
  { id: 'zhang-gui', name: '掌柜', threshold: 2, type: 'shop', description: '分店两家，字号初成。' },
  { id: 'xing-shang', name: '行商', threshold: 3.0, type: 'score', description: '口碑渐起，街坊称道。' },
  { id: 'xue-tu', name: '学徒', threshold: 30, type: 'day', description: '经营三十日，初窥门径。' },
  { id: 'bai-ding', name: '白丁', threshold: 0, type: 'day', description: '初入商海，白身无字。' },
];

/** id → 段位 索引 */
export const MERCHANT_RANK_MAP: Readonly<Record<string, MerchantRank>> = Object.fromEntries(
  MERCHANT_RANKS.map((r) => [r.id, r])
);

/** 段位查询（id → 定义；不存在返回 null） */
export function merchantRankById(id: string): MerchantRank | null {
  return MERCHANT_RANK_MAP[id] ?? null;
}
