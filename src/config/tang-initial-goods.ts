/**
 * 《我在唐朝当掌柜》初始商品（Step 2 需求 2.8 / 2.6；Step 5b-1.5 库存压力系统）
 * 数据按用户 2.6 规格逐字：售价/库存为用户指定值；
 * 成本未给出，按售价 50-70% 自定（注释说明，货架「库存估值」按成本估算）。
 * initByDifficulty 进入 playing 时按店型加载；startNewDay 不重置 shopItems。
 *
 * Step 5b-1.5 新增字段（工程定合理值，注释）：
 * - volume：占库容量单位（羊肉3/米酒1/酱牛肉3/时蔬1、粗布2/丝绸1/棉布2/锦缎1、
 *   人参0.5/当归1/黄连1/枸杞0.5/草药1）
 * - expiry：保质期剩余天数（生鲜 7-14、布匹 90、药材 180；-1 永不过期）
 * - status：初始均 'normal'
 * - 药铺新增「草药」：炮制配方（成药/风寒药囊）所需原料，故补入初始商品（工程决策，注释）。
 */
import type { ShopItem, ShopType } from '@/types/tang-manager';

export const INITIAL_GOODS: Record<ShopType, readonly ShopItem[]> = {
  jiulou: [
    { id: 'jiulou-yangrou', name: '羊肉', price: 3, cost: 1.8, stock: 20, category: '食材', volume: 3, expiry: 10, status: 'normal' },
    { id: 'jiulou-mijiu', name: '米酒', price: 1, cost: 0.6, stock: 50, category: '食材', volume: 1, expiry: 90, status: 'normal' },
    { id: 'jiulou-jiangniurou', name: '酱牛肉', price: 5, cost: 3, stock: 10, category: '食材', volume: 3, expiry: 14, status: 'normal' },
    { id: 'jiulou-shicai', name: '时蔬', price: 0.5, cost: 0.3, stock: 30, category: '食材', volume: 1, expiry: 7, status: 'normal' },
  ],
  buzhuang: [
    { id: 'buzhuang-cubu', name: '粗布', price: 2, cost: 1.2, stock: 30, category: '布匹', volume: 2, expiry: 90, status: 'normal' },
    { id: 'buzhuang-sichou', name: '丝绸', price: 8, cost: 5, stock: 15, category: '布匹', volume: 1, expiry: 180, status: 'normal' },
    { id: 'buzhuang-mianbu', name: '棉布', price: 4, cost: 2.4, stock: 25, category: '布匹', volume: 2, expiry: 120, status: 'normal' },
    { id: 'buzhuang-jinduan', name: '锦缎', price: 15, cost: 10, stock: 5, category: '布匹', volume: 1, expiry: 240, status: 'normal' },
  ],
  yaopu: [
    { id: 'yaopu-renshen', name: '人参', price: 6, cost: 4, stock: 8, category: '药材', volume: 0.5, expiry: 180, status: 'normal' },
    { id: 'yaopu-danggui', name: '当归', price: 3, cost: 1.8, stock: 20, category: '药材', volume: 1, expiry: 180, status: 'normal' },
    { id: 'yaopu-huanglian', name: '黄连', price: 2, cost: 1.2, stock: 15, category: '药材', volume: 1, expiry: 180, status: 'normal' },
    { id: 'yaopu-gouqi', name: '枸杞', price: 1, cost: 0.6, stock: 40, category: '药材', volume: 0.5, expiry: 180, status: 'normal' },
    { id: 'yaopu-caoyao', name: '草药', price: 1.5, cost: 0.9, stock: 20, category: '药材', volume: 1, expiry: 180, status: 'normal' },
  ],
};
