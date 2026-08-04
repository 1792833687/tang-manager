/**
 * 《我在唐朝当掌柜》各店员提醒池（店员互动提升 模块二）
 * 每位店员按性格/技能/当前场景触发提醒；条件为纯函数（ctx 缺数据时安全为 false）。
 * 同一阶段最多 2 条、按优先级排序（generateStaffReminders 在 systems/ 处理）。
 */
import type { ReminderContext, StaffReminder } from '@/types/tang-reminders';

/** 提醒定义（构建 content/suggestion；effect 常量） */
export interface ReminderDef {
  id: string;
  staffId: string;
  staffName: string;
  triggerPhase: string;
  priority: StaffReminder['priority'];
  condition: string;
  /** 条件判定（纯函数） */
  test: (ctx: ReminderContext) => boolean;
  /** 内容构建（含插值） */
  build: (ctx: ReminderContext) => string;
  suggestion: string;
  effect: StaffReminder['effectIfAccepted'];
}

/** 阿昭：活泼贴心，覆盖所有阶段 */
const A_ZHAO = 'a_zhao';

export const STAFF_REMINDER_POOL: ReminderDef[] = [
  // ---- 阿昭 · 清晨 ----
  {
    id: 'az-hexagram-kan', staffId: A_ZHAO, staffName: '阿昭', triggerPhase: 'morning', priority: 'high',
    condition: '今日卦象为坎（坎坷）',
    test: (ctx) => ctx.todayHexagram === 'kan',
    build: () => '掌柜的，今日卦象不太妙——要不今天就稳着点，少接大单？',
    suggestion: '保守经营',
    effect: { type: 'today_no_random_event', note: '今日客人数量-1 且无随机事件' },
  },
  {
    id: 'az-hexagram-li', staffId: A_ZHAO, staffName: '阿昭', triggerPhase: 'morning', priority: 'medium',
    condition: '今日卦象为离（火爆）',
    test: (ctx) => ctx.todayHexagram === 'li',
    build: () => '手札说今日宜待客——掌柜的，大单交给你，零散客人我来应付！',
    suggestion: '亲力亲为接大单',
    effect: { type: 'today_big_order_bonus', value: 10, note: '今日大单客人出现概率额外 +10%' },
  },
  {
    id: 'az-weekly-task', staffId: A_ZHAO, staffName: '阿昭', triggerPhase: 'morning', priority: 'low',
    condition: '周间要务未完成且只剩 2 天',
    test: (ctx) => ctx.weeklyTaskDueSoon === true,
    build: () => '掌柜的，那个周间要务还差一点——今天加把劲？',
    suggestion: '优先完成要务',
    effect: { type: 'none', note: '无直接数值效果，仅提醒' },
  },
  // ---- 阿昭 · 接待 ----
  {
    id: 'az-regular', staffId: A_ZHAO, staffName: '阿昭', triggerPhase: 'reception', priority: 'medium',
    condition: '客人是熟客（来访≥3 次）',
    test: (ctx) => (ctx.guests ?? []).some((g) => (g.visitCount ?? 1) >= 3),
    build: (ctx) => {
      const g = (ctx.guests ?? []).find((x) => (x.visitCount ?? 1) >= 3);
      return `哟，${g?.name ?? '熟客'}又来了！掌柜的，上次他夸过咱家的货——这次要不要再推一回？`;
    },
    suggestion: '按偏好推荐',
    effect: { type: 'recommend_hit_bonus', value: 20, note: '推荐命中率 +20%' },
  },
  {
    id: 'az-hesitate', staffId: A_ZHAO, staffName: '阿昭', triggerPhase: 'reception', priority: 'medium',
    condition: '客人犹豫不决（耐心偏低）',
    test: (ctx) => (ctx.guests ?? []).some((g) => (g.patience ?? 100) < 45),
    build: () => '掌柜的，这位客官看了好几回了——要不送碟小菜给他个台阶？',
    suggestion: '施以小恩小惠',
    effect: { type: 'gift_close_bonus', value: 15, note: '赠礼后成交率 +15%' },
  },
  {
    id: 'az-hot-short', staffId: A_ZHAO, staffName: '阿昭', triggerPhase: 'reception', priority: 'high',
    condition: '某热门商品库存 ≤3',
    test: (ctx) => (ctx.shopItems ?? []).some((i) => i.stock <= 3),
    build: (ctx) => {
      const i = (ctx.shopItems ?? []).find((x) => x.stock <= 3);
      return `（小声）掌柜的，${i?.name ?? '那货'}快见底了——这位客官要是要得多，咱得提前说好。`;
    },
    suggestion: '限量供应',
    effect: { type: 'no_stock_complaint', note: '客人不会因缺货不满' },
  },
  {
    id: 'az-bad-reviewer', staffId: A_ZHAO, staffName: '阿昭', triggerPhase: 'reception', priority: 'high',
    condition: '客人可能是差评师（观察型+可疑标签）',
    test: (ctx) => (ctx.guests ?? []).some((g) => g.type === 'observe' || g.isBadReviewer),
    build: () => '（凑近耳边）这人不对劲——眼睛老往咱库房方向瞟。要不我去叫个护卫来？',
    suggestion: '警惕对待',
    effect: { type: 'bad_reviewer_penalty', value: 30, note: '差评师成功率 -30%' },
  },
  // ---- 阿昭 · 午后 ----
  {
    id: 'az-patrol', staffId: A_ZHAO, staffName: '阿昭', triggerPhase: 'afternoon', priority: 'medium',
    condition: '连续 3 天未巡查',
    test: (ctx) => (ctx.daysSincePatrol ?? 0) >= 3,
    build: () => '掌柜的，好些天没巡店了——后院的墙根好像有点潮，要不要去看看？',
    suggestion: '午后巡查',
    effect: { type: 'patrol_find_bonus', value: 20, note: '巡查发现隐患概率 +20%' },
  },
  {
    id: 'az-visit-npc', staffId: A_ZHAO, staffName: '阿昭', triggerPhase: 'afternoon', priority: 'low',
    condition: '有可拜访 NPC 且好感 ≥40',
    test: (ctx) => !!ctx.visitableNpc,
    build: (ctx) => `掌柜的，好久没去看${ctx.visitableNpc}了——他上次还念叨你呢。`,
    suggestion: '前去拜访故交',
    effect: { type: 'npc_favor_bonus', value: 3, note: '该 NPC 好感额外 +3' },
  },
  // ---- 阿昭 · 打烊 ----
  {
    id: 'az-profit', staffId: A_ZHAO, staffName: '阿昭', triggerPhase: 'closing', priority: 'low',
    condition: '今日净收益 ≥50 两',
    test: (ctx) => (ctx.todayNetProfit ?? 0) >= 50,
    build: () => '（擦着桌子笑嘻嘻）今天进账不少啊掌柜的！照这个势头，下个月咱能再开一家店了。',
    suggestion: '无（纯叙事）',
    effect: { type: 'a_zhao_satisfaction', value: 1, note: '阿昭满意度 +1' },
  },
  {
    id: 'az-complaint', staffId: A_ZHAO, staffName: '阿昭', triggerPhase: 'closing', priority: 'high',
    condition: '今日有客人投诉',
    test: (ctx) => ctx.todayComplaint === true,
    build: () => '（小心翼翼）掌柜的，今天有位客官走的时候脸色不太好看——要不要记一笔，下次他来咱注意点？',
    suggestion: '记录客人偏好',
    effect: { type: 'note_guest', note: '该客人下次来时阿昭会提前提醒' },
  },
  {
    id: 'az-mindread', staffId: A_ZHAO, staffName: '阿昭', triggerPhase: 'closing', priority: 'low',
    condition: '今日使用了通晓人心',
    test: (ctx) => (ctx.todayMindReadUsed ?? 0) > 0,
    build: () => '掌柜的，你今儿用那本事的时候，我看你脸色有点白——没事吧？',
    suggestion: '无（纯关心）',
    effect: { type: 'a_zhao_favor', value: 2, note: '阿昭好感 +2' },
  },
  // ---- 阿昭 · 库存 ----
  {
    id: 'az-expiry', staffId: A_ZHAO, staffName: '阿昭', triggerPhase: 'inventory', priority: 'high',
    condition: '有商品即将陈损（保质期 ≤2 天）',
    test: (ctx) => (ctx.shopItems ?? []).some((i) => (i.expiry ?? 999) >= 0 && (i.expiry ?? 999) <= 2),
    build: (ctx) => {
      const i = (ctx.shopItems ?? []).find((x) => (x.expiry ?? 999) >= 0 && (x.expiry ?? 999) <= 2);
      return `掌柜的，灶房那批${i?.name ?? '货'}只剩两天了——要不做个特价赶紧出了？`;
    },
    suggestion: '打折促销',
    effect: { type: 'expiry_sale_bonus', value: 30, note: '该商品当日被购买概率 +30%' },
  },
  {
    id: 'az-storage', staffId: A_ZHAO, staffName: '阿昭', triggerPhase: 'inventory', priority: 'low',
    condition: '库房容量使用 ≥90%',
    test: (ctx) => (ctx.storageUsage ?? 0) >= 0.9,
    build: () => '掌柜的，库房快堆满了——再进货就得往床上堆了。',
    suggestion: '扩建库房或清仓',
    effect: { type: 'none', note: '无直接效果，仅提醒' },
  },
  // ---- 账房 ----
  {
    id: 'acc-loan', staffId: 'accountant', staffName: '账房先生', triggerPhase: 'morning', priority: 'high',
    condition: '距离还贷日 ≤3 天且现银不足',
    test: (ctx) => (ctx.loans ?? []).length > 0 && ctx.silver < 100,
    build: () => '东家，本月还贷在即——账上现银恐有不逮，需早做打算。',
    suggestion: '提前筹款',
    effect: { type: 'highlight_loan', note: '高亮显示即将到期的贷款' },
  },
  {
    id: 'acc-expense', staffId: 'accountant', staffName: '账房先生', triggerPhase: 'closing', priority: 'high',
    condition: '今日有一笔异常大额支出',
    test: (ctx) => (ctx.todayNetProfit ?? 0) < -50,
    build: () => '东家，今日这笔支出数目不小——比上月同日多了三成，是否需要追查？',
    suggestion: '核查账目',
    effect: { type: 'audit_find_theft', note: '如为员工偷钱，可提前发现' },
  },
  {
    id: 'acc-loss', staffId: 'accountant', staffName: '账房先生', triggerPhase: 'closing', priority: 'medium',
    condition: '本月净收益连续 3 天为负',
    test: (ctx) => (ctx.lossStreak ?? 0) >= 3,
    build: () => '东家，本月已连续三日亏空——长此以往恐有断链之虞。是否考虑调整经营策略？',
    suggestion: '薄利多销',
    effect: { type: 'none', note: '无直接效果，仅提醒' },
  },
  {
    id: 'acc-debt', staffId: 'accountant', staffName: '账房先生', triggerPhase: 'closing', priority: 'medium',
    condition: '赊账客人逾期未还',
    test: (ctx) => (ctx.credit ?? 0) > 0,
    build: () => '东家，有客官赊账已逾期——是否遣人催收？',
    suggestion: '催收欠款',
    effect: { type: 'collect_debt', note: '催收后 50% 追回，50% 客源流失' },
  },
  {
    id: 'acc-price', staffId: 'accountant', staffName: '账房先生', triggerPhase: 'inventory', priority: 'medium',
    condition: '某商品进货价明显高于市场均价',
    test: (ctx) => (ctx.shopItems ?? []).some((i) => i.cost !== undefined && i.price !== undefined && i.cost > i.price * 0.8),
    build: (ctx) => {
      const i = (ctx.shopItems ?? []).find((x) => x.cost !== undefined && x.price !== undefined && x.cost > x.price * 0.8);
      return `东家，${i?.name ?? '那货'}此次进价较上月贵了不少——是否需要换一家供货？`;
    },
    suggestion: '更换供货商',
    effect: { type: 'supplier_discount', value: 10, note: '下次该商品进货价 -10%' },
  },
  {
    id: 'acc-slow', staffId: 'accountant', staffName: '账房先生', triggerPhase: 'inventory', priority: 'low',
    condition: '库房存在滞销商品（库存>30 且近期未售）',
    test: (ctx) => !!ctx.slowMovingItem,
    build: (ctx) => `东家，${ctx.slowMovingItem}在库房积压已久——既占库容又压资金，不妨打折清仓？`,
    suggestion: '清仓处理',
    effect: { type: 'clearance_sale', value: 7, note: '该商品以七折挂牌，吸引价格敏感客人' },
  },
  {
    id: 'acc-idle', staffId: 'accountant', staffName: '账房先生', triggerPhase: 'finance', priority: 'low',
    condition: '有大额闲置现银（≥500 两）且无投资',
    test: (ctx) => ctx.idleSilver === true,
    build: () => '东家，账上闲银不少——存于钱庄可生息，或投于商会博取更高回报。',
    suggestion: '合理投资',
    effect: { type: 'none', note: '无直接效果，仅提醒' },
  },
  // ---- 厨师（酒楼） ----
  {
    id: 'chef-substitute', staffId: 'chef', staffName: '厨师', triggerPhase: 'reception', priority: 'medium',
    condition: '客人点菜但某食材库存不足',
    test: (ctx) => ctx.shopType === 'jiulou' && (ctx.shopItems ?? []).some((i) => i.stock <= 0),
    build: () => '掌柜的，这食材不多了——要不我换个做法，用别的也能做出差不多的味道？',
    suggestion: '替换食材',
    effect: { type: 'substitute_profit', value: -5, note: '客人不会察觉，但利润微降 5%' },
  },
  {
    id: 'chef-new-ingredient', staffId: 'chef', staffName: '厨师', triggerPhase: 'inventory', priority: 'medium',
    condition: '有新食材到货',
    test: (ctx) => ctx.shopType === 'jiulou' && !!ctx.newMaterial,
    build: (ctx) => `掌柜的，这${ctx.newMaterial}真不错——让我试试新菜式，没准能成招牌！`,
    suggestion: '研发新菜',
    effect: { type: 'recipe_develop', note: '消耗少量食材，3 天后可能产出新菜品' },
  },
  {
    id: 'chef-menu', staffId: 'chef', staffName: '厨师', triggerPhase: 'staff', priority: 'low',
    condition: '连续使用同一菜单 ≥30 天',
    test: (ctx) => ctx.shopType === 'jiulou' && (ctx.menuAgeDays ?? 0) >= 30,
    build: () => '掌柜的，咱家菜单好久没换过了——熟客都吃腻了。要不要加几道新菜？',
    suggestion: '更新菜单',
    effect: { type: 'traffic_bonus_7d', value: 10, note: '更新后客流量 +10% 持续 7 天' },
  },
  // ---- 裁缝（布庄） ----
  {
    id: 'tailor-measure', staffId: 'tailor', staffName: '裁缝', triggerPhase: 'reception', priority: 'medium',
    condition: '客人身材特殊（对话中暗示）',
    test: (ctx) => ctx.shopType === 'buzhuang' && (ctx.guests ?? []).length > 0,
    build: () => '掌柜的，这客官身量不一般——得量体裁衣，成衣怕是不合身。',
    suggestion: '建议量体定制',
    effect: { type: 'measure_price_bonus', value: 15, note: '成交价 +15%，客人满意度 +10' },
  },
  {
    id: 'tailor-fabric', staffId: 'tailor', staffName: '裁缝', triggerPhase: 'inventory', priority: 'medium',
    condition: '有新布料到货',
    test: (ctx) => ctx.shopType === 'buzhuang' && !!ctx.newMaterial,
    build: (ctx) => `掌柜的，这${ctx.newMaterial}花色是今年长安最时兴的——我赶两件样衣出来，肯定有人要。`,
    suggestion: '制作样衣',
    effect: { type: 'sample_sales_bonus', value: 30, note: '样衣展示后该布料销量 +30%' },
  },
  // ---- 药师（药铺） ----
  {
    id: 'herb-consult', staffId: 'pharmacist', staffName: '药师', triggerPhase: 'reception', priority: 'medium',
    condition: '客人症状模糊（对话中说不清楚）',
    test: (ctx) => ctx.shopType === 'yaopu' && (ctx.guests ?? []).length > 0,
    build: () => '掌柜的，这客官说得不清不楚——要不你给他把个脉，或者让我来问几句？',
    suggestion: '详细问诊',
    effect: { type: 'pulse_match_bonus', value: 30, note: '把脉后药方匹配率 +30%' },
  },
  {
    id: 'herb-clash', staffId: 'pharmacist', staffName: '药师', triggerPhase: 'inventory', priority: 'high',
    condition: '库房有相冲药材放在一起',
    test: (ctx) => ctx.shopType === 'yaopu' && !!ctx.clashingHerbs,
    build: (ctx) => `掌柜的，${ctx.clashingHerbs?.a ?? '一味药'}和${ctx.clashingHerbs?.b ?? '另一味药'}药性相冲——别放一起，万一串了味可就麻烦了。`,
    suggestion: '整理库房',
    effect: { type: 'avoid_loss', note: '避免潜在损耗' },
  },
  // ---- 护卫 ----
  {
    id: 'guard-observe', staffId: 'guard', staffName: '护卫', triggerPhase: 'reception', priority: 'high',
    condition: '观察类型客人到店',
    test: (ctx) => (ctx.guests ?? []).some((g) => g.type === 'observe'),
    build: () => '东家，这人脚步虚浮却眼神飘忽——不像是来买东西的。我盯着点。',
    suggestion: '加强戒备',
    effect: { type: 'guard_security', value: 50, note: '差评师/小偷成功率 -50%' },
  },
  {
    id: 'guard-lock', staffId: 'guard', staffName: '护卫', triggerPhase: 'closing', priority: 'low',
    condition: '夜晚打烊后（结算阶段随机触发）',
    test: (ctx) => ctx.phase === 'closing' && ctx.day % 3 === 0,
    build: () => '东家，最近坊里不太平——听说隔壁街有店铺夜里被撬了。咱要不要多加把锁？',
    suggestion: '加固防范',
    effect: { type: 'theft_reduce_7d', value: 30, note: '小偷事件概率 -30% 持续 7 天' },
  },
  {
    id: 'guard-caravan', staffId: 'guard', staffName: '护卫', triggerPhase: 'caravan', priority: 'medium',
    condition: '镖队出发',
    test: (ctx) => ctx.caravanDeparting === true,
    build: () => '东家，这条路线前段日子闹过劫匪——要不要多派两个人跟着？',
    suggestion: '增加护卫',
    effect: { type: 'caravan_safe', value: 20, note: '本次镖队被劫概率 -20%，但运费 +5 两' },
  },
];

/** 按阶段取提醒池（纯函数） */
export function poolForPhase(phase: string): ReminderDef[] {
  return STAFF_REMINDER_POOL.filter((d) => d.triggerPhase === phase || (phase === 'reception' && d.triggerPhase === 'reception'));
}

/** 全部员工姓名（含阿昭；UI/问候用） */
export const STAFF_DISPLAY_NAMES: Record<string, string> = {
  a_zhao: '阿昭',
  accountant: '账房先生',
  chef: '厨师',
  tailor: '裁缝',
  pharmacist: '药师',
  guard: '护卫',
};
