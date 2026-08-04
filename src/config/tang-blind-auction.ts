/**
 * 《我在唐朝当掌柜》市易务暗标配置（TANG-ADD-001 模块六）
 * 暗标："暗标：市易务偶有不明货物挂牌，不知具体何物，仅标品类。起价极低，价高者得——开标方知赚赔。"
 * 3 暗标逐字：西域珍货 起价50 5结果 10/20/30/25/15% / 抄没物资 30 4结果 /
 * 废弃仓库 20 4结果 含稀有配方5%。
 * 纯数据，不依赖 store；初一挂标/出价/开标纯函数在 systems/tang-blind-auction.ts。
 */
import type { BlindAuction } from '@/types/tang-manager';

/** 市易务暗标全量（每月初一随机挂 1 个） */
export const BLIND_AUCTIONS: readonly BlindAuction[] = [
  {
    id: 'auction-west-goods',
    category: '西域珍货',
    description: '市易务差人送来一口封死的樟木箱，说是西域珍货，起价五十两。',
    startPrice: 50,
    possibleOutcomes: [
      { label: '上等香料', chance: 0.1, silver: 200 },
      { label: '和田美玉', chance: 0.2, silver: 120 },
      { label: '西域宝石', chance: 0.3, silver: 80 },
      { label: '寻常毛皮', chance: 0.25, silver: 40 },
      { label: '霉变药材', chance: 0.15, silver: -30 },
    ],
  },
  {
    id: 'auction-seized',
    category: '抄没物资',
    description: '京兆府抄没了一批来路不明的货物，封条未揭，起价三十两。',
    startPrice: 30,
    possibleOutcomes: [
      { label: '上好绸缎', chance: 0.2, silver: 150 },
      { label: '铜钱几贯', chance: 0.3, silver: 60 },
      { label: '杂物一箱', chance: 0.3, silver: 25 },
      { label: '官契一叠', chance: 0.2, silver: -20 },
    ],
  },
  {
    id: 'auction-warehouse',
    category: '废弃仓库',
    description: '东市一座废弃仓库要清货，不知里面还剩些什么，起价二十两。',
    startPrice: 20,
    possibleOutcomes: [
      { label: '陈年佳酿', chance: 0.25, silver: 100 },
      { label: '旧家具', chance: 0.3, silver: 45 },
      { label: '破铜烂铁', chance: 0.25, silver: 10 },
      { label: '一箱旧纸', chance: 0.15, silver: -15 },
      { label: '稀有配方', chance: 0.05, recipe: 'rare-recipe' },
    ],
  },
];

/** id → 暗标 索引 */
export const BLIND_AUCTION_MAP: Readonly<Record<string, BlindAuction>> = Object.fromEntries(
  BLIND_AUCTIONS.map((a) => [a.id, a])
);

/** 暗标查询（id → 定义；不存在返回 null） */
export function blindAuctionById(id: string): BlindAuction | null {
  return BLIND_AUCTION_MAP[id] ?? null;
}
