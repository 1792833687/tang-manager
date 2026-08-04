/**
 * 《我在唐朝当掌柜》商业地图数据（Step 5b-2 模块一）
 * 三层舆图点位逐字 / 三势力影响圈 / 商路 / 解锁规则 / 动态事件池。
 * 坐标：0-100 百分比（viewBox 0 0 100 100 内联 SVG 渲染用），工程自定。
 * L2 东市西市：用户写 7 项含「各大商号总号(shop×3)」按 3 个点位展开 → 合计 9 点（工程按合理数量落，注释）。
 */
import type { InfluenceZone, MapEvent, MapLayer, MapNode, MapLayerUnlockRule, TradeRoute } from '@/types/tang-map';

// ============================================================
// 三层舆图点位
// ============================================================
export const MAP_NODES: readonly MapNode[] = [
  // ---- L1 永乐坊（6 点：开局解锁）----
  { id: 'luji-laodian', name: '陆记老店', layer: 'yongle', x: 50, y: 55, type: 'shop', unlocked: true, description: '你祖传的铺面，长安立足之本。', connectedTo: ['wangji-buzhuang', 'zhaoyao-pu', 'fangnei-shiji'] },
  { id: 'wangji-buzhuang', name: '王记布庄', layer: 'yongle', x: 30, y: 40, type: 'shop', unlocked: true, description: '对门布庄，针线往来最是热络。', connectedTo: ['luji-laodian', 'fangnei-shiji'] },
  { id: 'zhaoyao-pu', name: '赵记药铺', layer: 'yongle', x: 70, y: 40, type: 'shop', unlocked: true, description: '药香扑鼻的老药铺，坐堂郎中常年坐诊。', connectedTo: ['luji-laodian', 'fangnei-shiji'] },
  { id: 'fangnei-shiji', name: '坊内市集', layer: 'yongle', x: 50, y: 78, type: 'market', unlocked: true, description: '永乐坊坊门处的市集，日昃而聚，日暮而散。', connectedTo: ['luji-laodian', 'wangji-buzhuang', 'zhaoyao-pu', 'zhangpo-jia', 'liyuanwai-fu', 'dongshi-shanghui', 'xishi-shangtuan'] },
  { id: 'zhangpo-jia', name: '张婆家', layer: 'yongle', x: 22, y: 72, type: 'residence', unlocked: true, description: '张婆独居，坊间消息最灵通的老人家。', connectedTo: ['fangnei-shiji'] },
  { id: 'liyuanwai-fu', name: '李员外府', layer: 'yongle', x: 78, y: 72, type: 'residence', unlocked: true, description: '李员外府邸，深宅大院，朱门常闭。', connectedTo: ['fangnei-shiji'] },

  // ---- L2 东市西市（9 点：声望≥200 或 分店≥2 解锁）----
  { id: 'dongshi-shanghui', name: '东市商会', layer: 'east_west_market', x: 30, y: 35, type: 'npc', unlocked: false, description: '沈听澜坐镇之处，东市商贾的龙头。', connectedTo: ['fangnei-shiji', 'pingzhun-shu', 'bosidian', 'shanghao-jia'] },
  { id: 'pingzhun-shu', name: '平准署', layer: 'east_west_market', x: 50, y: 20, type: 'government', unlocked: false, description: '官署所在，市易务挂牌、平准物价皆出于此。', connectedTo: ['dongshi-shanghui', 'matou-cangku', 'jingzhao-fu'] },
  { id: 'bosidian', name: '波斯邸', layer: 'east_west_market', x: 16, y: 60, type: 'resource', unlocked: false, description: '胡商货栈，珠宝绸缎稀货多从此出。', connectedTo: ['dongshi-shanghui', 'xishi-shangtuan'] },
  { id: 'matou-cangku', name: '码头仓库', layer: 'east_west_market', x: 84, y: 60, type: 'resource', unlocked: false, description: '漕运码头仓库，南北货物集散之地。', connectedTo: ['pingzhun-shu', 'shanghao-yi', 'chengwai-chayuan', 'chengwai-yaotian'] },
  { id: 'shanghao-jia', name: '商号总号·甲', layer: 'east_west_market', x: 38, y: 50, type: 'shop', unlocked: false, description: '东市老牌商号总号，绸缎布匹大宗批发。', connectedTo: ['dongshi-shanghui', 'shanghao-yi'] },
  { id: 'shanghao-yi', name: '商号总号·乙', layer: 'east_west_market', x: 58, y: 50, type: 'shop', unlocked: false, description: '西市邻坊商号总号，货通南北。', connectedTo: ['shanghao-jia', 'shanghao-bing', 'matou-cangku'] },
  { id: 'shanghao-bing', name: '商号总号·丙', layer: 'east_west_market', x: 74, y: 34, type: 'shop', unlocked: false, description: '绸缎香料并营的总号，与西市商团往来密切。', connectedTo: ['shanghao-yi', 'xishi-shangtuan'] },
  { id: 'xishi-shangtuan', name: '西市商团', layer: 'east_west_market', x: 64, y: 76, type: 'npc', unlocked: false, description: '谢七掌舵的灰色商团，专走偏门路子。', connectedTo: ['fangnei-shiji', 'bosidian', 'shanghao-bing', 'jingzhao-fu', 'west_gambling_den'] },
  { id: 'jingzhao-fu', name: '京兆府衙门', layer: 'east_west_market', x: 44, y: 86, type: 'government', unlocked: false, description: '京兆府衙，官道政令、戒严放行的中枢。', connectedTo: ['pingzhun-shu', 'xishi-shangtuan', 'huanggong', 'chengwai-sangyuan'] },
  // ---- L2 东市西市（内容深化 TANG-CONT-D 模块四：西市赌坊；解锁条件=谢七登场，见 store）----
  { id: 'west_gambling_den', name: '西市赌坊', layer: 'east_west_market', x: 65, y: 55, type: 'market', unlocked: false, description: '西市赌坊，骰盅声昼夜不绝，三教九流皆在此聚散。', connectedTo: ['xishi-shangtuan', 'shanghao-yi'] },
  // ---- L2 东市西市（K10 修复 2026-08-06：平康坊补地图节点；苏大娘/阿萤常驻于此）----
  { id: 'pingkangfang', name: '平康坊 · 醉太平', layer: 'east_west_market', x: 22, y: 82, type: 'npc', unlocked: false, description: '平康坊风月场，醉太平酒肆的苏大娘把消息当买卖，长安城里没有她打听不到的。', connectedTo: ['dongshi-shanghui', 'xishi-shangtuan', 'wuyang-xiang'] },

  // ---- L3 长安京畿（6 点：声望≥700 且 阶段≥3 解锁）----
  { id: 'huanggong', name: '皇宫', layer: 'changan', x: 50, y: 14, type: 'government', unlocked: false, description: '大明宫阙，天家气象，寻常商贾难近。', connectedTo: ['jingzhao-fu', 'weiming-lou'] },
  { id: 'weiming-lou', name: '巍明楼', layer: 'changan', x: 42, y: 46, type: 'shop', unlocked: false, description: '长安第一酒楼，达官贵人宴饮之所。', connectedTo: ['huanggong', 'wuyang-xiang'] },
  { id: 'wuyang-xiang', name: '五洋巷', layer: 'changan', x: 70, y: 50, type: 'npc', unlocked: false, description: '贵人聚居的巷陌，夜夜笙歌。', connectedTo: ['weiming-lou', 'chengwai-chayuan'] },
  { id: 'chengwai-sangyuan', name: '城外桑园', layer: 'changan', x: 20, y: 70, type: 'resource', unlocked: false, description: '京郊桑园，新丝上市时节的好去处。', connectedTo: ['jingzhao-fu', 'chengwai-chayuan'] },
  { id: 'chengwai-chayuan', name: '城外茶园', layer: 'changan', x: 52, y: 76, type: 'resource', unlocked: false, description: '终南山下茶园，明前茶最为金贵。', connectedTo: ['matou-cangku', 'wuyang-xiang', 'chengwai-sangyuan', 'chengwai-yaotian'] },
  { id: 'chengwai-yaotian', name: '城外药田', layer: 'changan', x: 82, y: 70, type: 'resource', unlocked: false, description: '京郊药田，当归黄芪漫山遍野。', connectedTo: ['matou-cangku', 'chengwai-chayuan'] },
];

/** 点位查询（id → MapNode） */
export const MAP_NODE_MAP: Readonly<Record<string, MapNode>> = Object.fromEntries(
  MAP_NODES.map((n) => [n.id, n])
) as Record<string, MapNode>;

// ============================================================
// 三势力影响圈
// ============================================================
export const INFLUENCE_ZONES: readonly InfluenceZone[] = [
  { id: 'east-guild', name: '东市商会', color: '#4A7C59', nodes: ['dongshi-shanghui', 'pingzhun-shu', 'bosidian', 'shanghao-jia'], relationship: 30 },
  { id: 'west-guild', name: '西市商团', color: '#2E6FB7', nodes: ['xishi-shangtuan', 'shanghao-yi', 'shanghao-bing', 'matou-cangku'], relationship: 0 },
  { id: 'gov', name: '京兆府', color: '#C0392B', nodes: ['jingzhao-fu', 'pingzhun-shu', 'huanggong'], relationship: 20 },
];

// ============================================================
// 商路（跑商物流）
// ============================================================
export const TRADE_ROUTES: readonly TradeRoute[] = [
  // ---- L1 坊内（绿色通道：官道类）----
  { id: 'r-luji-wangji', from: 'luji-laodian', to: 'wangji-buzhuang', distance: 2, baseTime: 1, risk: 0.05, greenChannel: false },
  { id: 'r-luji-zhaoyao', from: 'luji-laodian', to: 'zhaoyao-pu', distance: 2, baseTime: 1, risk: 0.05, greenChannel: false },
  { id: 'r-luji-shiji', from: 'luji-laodian', to: 'fangnei-shiji', distance: 2, baseTime: 1, risk: 0.03, greenChannel: false },
  { id: 'r-wangji-shiji', from: 'wangji-buzhuang', to: 'fangnei-shiji', distance: 2, baseTime: 1, risk: 0.03, greenChannel: false },
  { id: 'r-zhaoyao-shiji', from: 'zhaoyao-pu', to: 'fangnei-shiji', distance: 2, baseTime: 1, risk: 0.03, greenChannel: false },
  { id: 'r-zhangpo-shiji', from: 'zhangpo-jia', to: 'fangnei-shiji', distance: 2, baseTime: 1, risk: 0.02, greenChannel: false },
  { id: 'r-liyuan-shiji', from: 'liyuanwai-fu', to: 'fangnei-shiji', distance: 2, baseTime: 1, risk: 0.02, greenChannel: false },
  // ---- L1→L2 坊门 ----
  { id: 'r-shiji-dongshi', from: 'fangnei-shiji', to: 'dongshi-shanghui', distance: 6, baseTime: 2, risk: 0.1, greenChannel: false },
  { id: 'r-shiji-xishi', from: 'fangnei-shiji', to: 'xishi-shangtuan', distance: 6, baseTime: 2, risk: 0.12, greenChannel: false },
  // ---- L2 东市西市 ----
  { id: 'r-dongshi-pingzhun', from: 'dongshi-shanghui', to: 'pingzhun-shu', distance: 3, baseTime: 1, risk: 0.05, greenChannel: true },
  { id: 'r-dongshi-bosidian', from: 'dongshi-shanghui', to: 'bosidian', distance: 3, baseTime: 1, risk: 0.08, greenChannel: false },
  { id: 'r-dongshi-shanghao-jia', from: 'dongshi-shanghui', to: 'shanghao-jia', distance: 2, baseTime: 1, risk: 0.03, greenChannel: false },
  { id: 'r-shanghao-jia-yi', from: 'shanghao-jia', to: 'shanghao-yi', distance: 3, baseTime: 1, risk: 0.03, greenChannel: false },
  { id: 'r-shanghao-yi-bing', from: 'shanghao-yi', to: 'shanghao-bing', distance: 2, baseTime: 1, risk: 0.03, greenChannel: false },
  { id: 'r-shanghao-yi-matou', from: 'shanghao-yi', to: 'matou-cangku', distance: 4, baseTime: 1, risk: 0.06, greenChannel: false },
  { id: 'r-pingzhun-matou', from: 'pingzhun-shu', to: 'matou-cangku', distance: 4, baseTime: 1, risk: 0.06, greenChannel: false },
  { id: 'r-bosidian-xishi', from: 'bosidian', to: 'xishi-shangtuan', distance: 5, baseTime: 1, risk: 0.1, greenChannel: false },
  { id: 'r-xishi-shanghao-bing', from: 'xishi-shangtuan', to: 'shanghao-bing', distance: 3, baseTime: 1, risk: 0.06, greenChannel: false },
  { id: 'r-xishi-jingzhao', from: 'xishi-shangtuan', to: 'jingzhao-fu', distance: 3, baseTime: 1, risk: 0.05, greenChannel: false },
  { id: 'r-xishi-gambling', from: 'xishi-shangtuan', to: 'west_gambling_den', distance: 2, baseTime: 1, risk: 0.08, greenChannel: false },
  { id: 'r-shanghao-yi-gambling', from: 'shanghao-yi', to: 'west_gambling_den', distance: 3, baseTime: 1, risk: 0.08, greenChannel: false },
  { id: 'r-jingzhao-pingzhun', from: 'jingzhao-fu', to: 'pingzhun-shu', distance: 3, baseTime: 1, risk: 0.04, greenChannel: true },
  // ---- L2→L3 城门 ----
  { id: 'r-jingzhao-huanggong', from: 'jingzhao-fu', to: 'huanggong', distance: 8, baseTime: 2, risk: 0.15, greenChannel: true },
  { id: 'r-matou-chayuan', from: 'matou-cangku', to: 'chengwai-chayuan', distance: 8, baseTime: 2, risk: 0.1, greenChannel: false },
  { id: 'r-matou-yaotian', from: 'matou-cangku', to: 'chengwai-yaotian', distance: 8, baseTime: 2, risk: 0.1, greenChannel: false },
  { id: 'r-jingzhao-sangyuan', from: 'jingzhao-fu', to: 'chengwai-sangyuan', distance: 7, baseTime: 2, risk: 0.12, greenChannel: false },
  // ---- L3 京畿 ----
  { id: 'r-huanggong-weiming', from: 'huanggong', to: 'weiming-lou', distance: 4, baseTime: 1, risk: 0.1, greenChannel: false },
  { id: 'r-weiming-wuyang', from: 'weiming-lou', to: 'wuyang-xiang', distance: 2, baseTime: 1, risk: 0.05, greenChannel: false },
  { id: 'r-wuyang-chayuan', from: 'wuyang-xiang', to: 'chengwai-chayuan', distance: 5, baseTime: 1, risk: 0.06, greenChannel: false },
  { id: 'r-sangyuan-chayuan', from: 'chengwai-sangyuan', to: 'chengwai-chayuan', distance: 5, baseTime: 1, risk: 0.05, greenChannel: false },
  { id: 'r-chayuan-yaotian', from: 'chengwai-chayuan', to: 'chengwai-yaotian', distance: 5, baseTime: 1, risk: 0.05, greenChannel: false },
];

/** 商路查询（id → TradeRoute） */
export const TRADE_ROUTE_MAP: Readonly<Record<string, TradeRoute>> = Object.fromEntries(
  TRADE_ROUTES.map((r) => [r.id, r])
) as Record<string, TradeRoute>;

// ============================================================
// 地图层解锁规则
// ============================================================
export const MAP_LAYER_UNLOCK_RULES: readonly MapLayerUnlockRule[] = [
  {
    layer: 'yongle',
    label: '永乐坊',
    hint: '开局已解锁',
    isUnlocked: () => true,
  },
  {
    layer: 'east_west_market',
    label: '东市西市',
    hint: '声望 ≥ 200 或 分店 ≥ 2',
    isUnlocked: (ctx) => ctx.reputation >= 200 || ctx.shopCount >= 2,
  },
  {
    layer: 'changan',
    label: '长安京畿',
    hint: '声望 ≥ 700 且 阶段 ≥ 3',
    isUnlocked: (ctx) => ctx.reputation >= 700 && ctx.stage >= 3,
  },
];

/** 查层解锁规则 */
export function getLayerUnlockRule(layer: MapLayer): MapLayerUnlockRule {
  return MAP_LAYER_UNLOCK_RULES.find((r) => r.layer === layer) ?? MAP_LAYER_UNLOCK_RULES[0]!;
}

// ============================================================
// 动态事件池（模块三：商机 5 + 威胁 5，用户逐字）
// 模板不含 spawnDay/expireDay/status——generateMapEvents 按 duration 落地。
// ============================================================
export interface MapEventTemplate {
  id: string;
  type: 'opportunity' | 'threat';
  title: string;
  description: string;
  nodeId: string;
  /** 持续天数（2-5；用户逐字部分 1 天/当日按原文） */
  duration: number;
  /** respond 正向效果（含代价：energyCost/goldChange<0/needGuard） */
  effects: MapEvent['effects'];
  /** active 期间持续效果（打烊结算应用；priceChange 实时读取） */
  passiveEffects: MapEvent['passiveEffects'];
  /** ignore/自然过期一次性负面 */
  ignoredEffects: MapEvent['ignoredEffects'];
}

export const MAP_EVENT_POOL: readonly MapEventTemplate[] = [
  // ---- 商机 5 ----
  {
    id: 'ev-hu-shang-qingcang', type: 'opportunity', title: '胡商清仓', nodeId: 'bosidian', duration: 2,
    description: '波斯胡商行将归国，波斯邸绸缎珠宝贱价抛售。',
    effects: [{ energyCost: 5, goldChange: 8 }],
    passiveEffects: [{ priceChange: { itemCategory: '布匹', multiplier: 0.7, nodeId: 'bosidian' } }],
    ignoredEffects: [],
  },
  {
    id: 'ev-caoyun-daohuo', type: 'opportunity', title: '漕运到货', nodeId: 'matou-cangku', duration: 1,
    description: '漕船抵岸，码头仓库新布成衣压仓待售。',
    effects: [{ energyCost: 5, goldChange: 6 }],
    passiveEffects: [{ priceChange: { itemCategory: '布匹', multiplier: 0.8, nodeId: 'matou-cangku' } }],
    ignoredEffects: [],
  },
  {
    id: 'ev-guiren-yanqing', type: 'opportunity', title: '贵人宴请', nodeId: 'wuyang-xiang', duration: 1,
    description: '五洋巷贵人设宴，今日酒楼大单概率翻倍。',
    effects: [{ goldChange: 20, reputationChange: 5 }],
    passiveEffects: [{ goldChange: 10 }],
    ignoredEffects: [],
  },
  {
    id: 'ev-shiyiwu-fanghuo', type: 'opportunity', title: '市易务放货', nodeId: 'pingzhun-shu', duration: 1,
    description: '平准署官仓放货，随机商品特价一日。',
    effects: [{ energyCost: 5, goldChange: 6 }],
    passiveEffects: [{ priceChange: { itemCategory: '食材', multiplier: 0.8, nodeId: 'pingzhun-shu' } }],
    ignoredEffects: [],
  },
  {
    id: 'ev-xiyu-shangdui', type: 'opportunity', title: '西域商队抵达', nodeId: 'bosidian', duration: 2,
    description: '西域商队携稀有限供而至，五洋巷贵人闻讯而来。',
    effects: [{ goldChange: 15, unlockNode: 'wuyang-xiang' }],
    passiveEffects: [{ goldChange: 8 }],
    ignoredEffects: [],
  },
  // ---- 威胁 5 ----
  {
    id: 'ev-hunhun-naoshi', type: 'threat', title: '混混闹事', nodeId: 'luji-laodian', duration: 2,
    description: '市井无赖在坊间滋事，客流减半，须护卫弹压。',
    effects: [{ reputationChange: 5, energyCost: 10, needGuard: true }],
    passiveEffects: [{ goldChange: -3 }],
    ignoredEffects: [{ reputationChange: -5, goldChange: -5 }],
  },
  {
    id: 'ev-guanfu-jieyan', type: 'threat', title: '官府戒严', nodeId: 'jingzhao-fu', duration: 1,
    description: '京兆府下令戒严，今日运输延迟一日。',
    effects: [{ reputationChange: 5 }],
    passiveEffects: [{ goldChange: -2 }],
    ignoredEffects: [{ goldChange: -8 }],
  },
  {
    id: 'ev-yiqing-baofa', type: 'threat', title: '疫情爆发', nodeId: 'zhaoyao-pu', duration: 3,
    description: '坊间疫气流行，药铺爆满，伙计恐染疾，须亲往坐镇。',
    effects: [{ reputationChange: 8, energyCost: 15 }],
    passiveEffects: [{ goldChange: -3, reputationChange: -1 }],
    ignoredEffects: [{ goldChange: -10, reputationChange: -3 }],
  },
  {
    id: 'ev-jingzheng-wajiao', type: 'threat', title: '竞争对手挖角', nodeId: 'wangji-buzhuang', duration: 2,
    description: '对门店铺重金挖角，伙计人心浮动，须挽留安抚。',
    effects: [{ goldChange: -5, reputationChange: 3 }],
    passiveEffects: [{ goldChange: -2 }],
    ignoredEffects: [{ goldChange: -8, reputationChange: -2 }],
  },
  {
    id: 'ev-caoyun-duse', type: 'threat', title: '漕运堵塞', nodeId: 'matou-cangku', duration: 3,
    description: '河道淤塞，码头进货价腾贵三成。',
    effects: [{ reputationChange: 3, energyCost: 10 }],
    passiveEffects: [{ priceChange: { itemCategory: '食材', multiplier: 1.3, nodeId: 'matou-cangku' } }],
    ignoredEffects: [{ goldChange: -6 }],
  },
];

/** 事件模板查询（id → MapEventTemplate） */
export const MAP_EVENT_TEMPLATE_MAP: Readonly<Record<string, MapEventTemplate>> = Object.fromEntries(
  MAP_EVENT_POOL.map((e) => [e.id, e])
) as Record<string, MapEventTemplate>;
