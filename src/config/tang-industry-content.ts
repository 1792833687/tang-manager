/**
 * 《我在唐朝当掌柜》产业系统内容配置（产业系统 模块一~三）
 * 三种产业 5 级升级路径、研发名称池、宴席类型定义、坐堂郎中/织工候选池、手札贺词。
 * 纯数据文件。
 */
import type {
  BanquetType,
  CustomOrderType,
  DishCategory,
  HerbRecipeCategory,
  IndustryLevelDef,
} from '@/types/tang-industry';

// ==================== 酒楼 ====================

/** 酒楼 5 级升级路径（1.3） */
export const TAVERN_LEVELS: IndustryLevelDef[] = [
  { level: 1, name: '街边小馆', desc: '基础菜单 5 道菜，最多承办 10 人宴席', require: { score: 0, count: 0, countLabel: '无' } },
  { level: 2, name: '坊间名店', desc: '可研发新菜，最多承办 20 人宴席', require: { score: 1.5, count: 2, countLabel: '累计宴席 2 次' } },
  { level: 3, name: '东市名楼', desc: '可设雅间，最多承办 50 人宴席，招牌菜上限 +1', require: { score: 2.5, count: 6, countLabel: '累计宴席 6 次' } },
  { level: 4, name: '长安名肆', desc: '宴席可吸引达官贵人，最多承办 100 人宴席', require: { score: 3.5, count: 12, countLabel: '累计宴席 12 次' } },
  { level: 5, name: '天下第一楼', desc: '所有菜品售价 +20%，宴席声望奖励翻倍', require: { score: 4.2, count: 20, countLabel: '累计宴席 20 次' } },
];

/** 研发方向 → 名称池 */
export const DISH_NAME_POOL: Record<DishCategory, string[]> = {
  荤菜: ['东坡焖肉', '金汤狮子头', '蜜汁火方', '葱烧海参', '糟熘鱼片'],
  素菜: ['翡翠白玉卷', '罗汉上素', '莲藕酿青', '玉笋香菇', '素烧鹅'],
  汤品: ['文思豆腐羹', '黄芪炖鸡汤', '鲜菌云腿汤', '银耳莲子羹', '酸辣乌鱼蛋汤'],
  点心: ['荷花酥', '蟹黄汤包', '桂花米糕', '枣泥山药糕', '豆沙青团'],
  酒品: ['桂花酿', '琥珀梅子酒', '竹叶青', '桑葚酒', '雪魄寒浆'],
};

/** 招牌菜机制（1.1） */
export const TAVERN_SIGNATURE_RULES = {
  /** 招牌菜点单概率加成 */
  orderChanceBonus: 0.5,
  /** 招牌菜售价上浮 */
  priceBonus: 0.3,
  /** 每道招牌菜评分贡献 */
  scoreBonus: 0.02,
  /** 招牌菜上限（Lv3 起 +1） */
  maxSignatures: 3,
};

/** 研发判定概率（1.1：大成功 10% / 成功 70% / 失败 20%） */
export const RESEARCH_OUTCOME = { grand: 0.1, success: 0.7, fail: 0.2 };

/** 研发成本基准（两）与周期（天） */
export const RESEARCH_COST_BASE = 20;
export const RESEARCH_DAYS_RANGE: readonly [number, number] = [1, 5];

/** 宴席类型定义（1.2） */
export interface BanquetTypeDef {
  type: BanquetType;
  name: string;
  /** 人均预算区间（两/人） */
  perHead: readonly [number, number];
  /** 规模区间（人） */
  scale: readonly [number, number];
  /** 基础声望奖励 */
  reputation: number;
  /** 筹备所需菜品数 */
  dishCount: readonly [number, number];
  /** 描述 */
  desc: string;
}

export const BANQUET_TYPES: BanquetTypeDef[] = [
  { type: 'shou_yan', name: '寿宴', perHead: [3, 6], scale: [10, 40], reputation: 3, dishCount: [6, 8], desc: '需备寿桃、长寿面、整鸡整鱼，客单价高但筹备复杂' },
  { type: 'hun_yan', name: '婚宴', perHead: [4, 8], scale: [20, 80], reputation: 4, dishCount: [7, 8], desc: '需备双份菜品（成双成对）、喜酒，规模大耗食材多' },
  { type: 'xi_chen', name: '洗尘宴', perHead: [2, 5], scale: [5, 20], reputation: 2, dishCount: [6, 7], desc: '接风洗尘，需备酒水和下酒菜，筹备较简单' },
  { type: 'jian_xing', name: '饯行宴', perHead: [2, 4], scale: [5, 15], reputation: 2, dishCount: [6, 6], desc: '送别宴，需备干粮和酒，客人会多给小费' },
  { type: 'shang_hui', name: '商会宴', perHead: [6, 12], scale: [10, 50], reputation: 6, dishCount: [7, 8], desc: '商界聚会，需备高档菜品和雅间，声望奖励高' },
];

/** 雅间布置成本与满意度（1.2） */
export const BANQUET_DECOR = {
  normal: { cost: 5, satisfaction: 0 },
  refined: { cost: 15, satisfaction: 10 },
  luxury: { cost: 30, satisfaction: 20 },
} as const;

/** 宴席结算：满意度档位 → 收入倍率 */
export const BANQUET_SATISFACTION = {
  delighted: 1.15,
  normal: 1.0,
  disappointed: 0.85,
} as const;

// ==================== 布庄 ====================

export const CLOTHIER_LEVELS: IndustryLevelDef[] = [
  { level: 1, name: '街边布摊', desc: '基础面料 3 种，最多合作 1 位织工', require: { score: 0, count: 0, countLabel: '无' } },
  { level: 2, name: '坊间布庄', desc: '可接定制订单，最多合作 2 位织工', require: { score: 1.5, count: 2, countLabel: '累计定制订单 2 单' } },
  { level: 3, name: '东市名坊', desc: '可接官服定制，最多合作 3 位织工', require: { score: 2.5, count: 5, countLabel: '累计定制订单 5 单' } },
  { level: 4, name: '长安名号', desc: '织工主动上门求合作，寄卖商品溢价 +20%', require: { score: 3.5, count: 10, countLabel: '累计定制订单 10 单' } },
  { level: 5, name: '天下第一坊', desc: '所有定制订单利润 +30%，织工抽成可降低 5%', require: { score: 4.2, count: 16, countLabel: '累计定制订单 16 单' } },
];

export const WEAVER_NAME_POOL = ['云娘', '柳三娘', '顾绣娘', '阿杼', '花锦', '陆娘子', '温四娘', '秦织女'];
export const WEAVER_GOODS_POOL = ['蜀锦披帛', '提花缎', '绣花襦裙', '月白纱衣', '百鸟朝凤帐', '缠枝莲布', '素绢', '织金锦'];

/** 定制订单类型定义（2.2） */
export interface CustomOrderTypeDef {
  type: CustomOrderType;
  name: string;
  /** 报酬区间（两） */
  reward: readonly [number, number];
  /** 工期区间（天） */
  days: readonly [number, number];
  /** 要求（匹配判定用关键词） */
  requirement: string;
  desc: string;
}

export const CUSTOM_ORDER_TYPES: CustomOrderTypeDef[] = [
  { type: 'bridal', name: '嫁衣', reward: [50, 120], days: [3, 7], requirement: '丝绸·刺绣', desc: '新娘礼服，需丝绸+刺绣，工期紧要求高但利润丰厚' },
  { type: 'official', name: '官服', reward: [80, 200], days: [5, 7], requirement: '锦缎·纹样', desc: '官员袍服，需锦缎+特定纹样，做得好可能带来官府订单' },
  { type: 'longevity', name: '寿衣', reward: [30, 80], days: [2, 5], requirement: '好料·吉祥', desc: '寿诞礼服，需好料+吉祥纹样，客人会给额外赏钱' },
  { type: 'daily', name: '常服定制', reward: [15, 40], days: [1, 4], requirement: '合身·时新', desc: '日常衣着，工期宽松，利润平稳' },
  { type: 'bulk', name: '批量工服', reward: [60, 150], days: [4, 7], requirement: '统一·耐穿', desc: '商号伙计的统一着装，量大利润高但耗时' },
];

/** 交货判定（2.2）：匹配 → 全额；瑕疵扣 20%；严重不符拒收 */
export const CUSTOM_ORDER_RULES = {
  perfect: { incomeMul: 1.2, satisfaction: 20 },
  basic: { incomeMul: 1.0, satisfaction: 5 },
  flawed: { incomeMul: 0.8, satisfaction: -10 },
  reject: { incomeMul: 0, satisfaction: -20 },
};

// ==================== 药铺 ====================

export const HERBALIST_LEVELS: IndustryLevelDef[] = [
  { level: 1, name: '街边药摊', desc: '基础药材 10 种，最多聘请 1 位郎中', require: { score: 0, count: 0, countLabel: '无' } },
  { level: 2, name: '坊间药铺', desc: '可研发药方，最多聘请 1 位郎中', require: { score: 1.5, count: 3, countLabel: '累计治愈 3 人' } },
  { level: 3, name: '东市名堂', desc: '可设独家秘方，最多聘请 2 位郎中', require: { score: 2.5, count: 8, countLabel: '累计治愈 8 人' } },
  { level: 4, name: '长安名号', desc: '病人慕名而来，客流量 +30%', require: { score: 3.5, count: 15, countLabel: '累计治愈 15 人' } },
  { level: 5, name: '天下第一堂', desc: '所有药材售价 +20%，郎中带来的病人翻倍', require: { score: 4.2, count: 25, countLabel: '累计治愈 25 人' } },
];

export const PHYSICIAN_NAME_POOL = ['孙大夫', '华郎中', '钱半仙', '李国手', '郑妙手', '葛先生', '韩大夫', '许太医'];
export const PHYSICIAN_SPECIALTIES = ['内科', '外科', '妇科', '儿科', '针灸'];

/** 药方名称池（3.2） */
export const HERB_RECIPE_NAME_POOL: Record<HerbRecipeCategory, string[]> = {
  汤剂: ['安神定志汤', '四时感冒汤', '温中健脾汤', '清肺止咳汤'],
  丸剂: ['养荣丸', '续骨活络丸', '安胎保产丸', '消食导滞丸'],
  散剂: ['金疮止血散', '跌打损伤散', '冰硼散', '金黄散'],
  膏剂: ['十全大补膏', '益寿延年膏', '润肺雪梨膏', '乌发养颜膏'],
};

/** 药方研发判定（3.2：成功/改良/失败） */
export const HERB_RESEARCH_OUTCOME = { success: 0.6, improve: 0.25, fail: 0.15 };

/** 独家秘方机制（3.2） */
export const HERB_PATENT_RULES = {
  /** 品质 ≥4 可设秘方 */
  minQuality: 4,
  /** 秘方售价上浮 */
  priceBonus: 0.5,
  /** 主治病症药材销量加成 */
  symptomSalesBonus: 0.5,
  /** 郎中离职可能带走秘方概率 */
  leakChance: 0.2,
};

// ==================== 手札贺词（4.1 升级） ====================

export const INDUSTRY_BLESSINGS: Record<string, string[]> = {
  tavern: [
    '（手札浮现：吾孙之酒楼渐有声名，一饮一啄皆见功夫——好生经营。）',
    '（手札浮现：庖厨之道，贵在钻研。吾孙既已入此门，当精益求精。）',
    '（手札浮现：宴开百席，宾主尽欢，乃大本事。吾孙有乃祖之风。）',
    '（手札浮现：名满长安之日，莫忘灶下烟火。吾孙切记。）',
    '（手札浮现：天下第一楼——吾孙当得起这四个字。先祖欣慰。）',
  ],
  clothier: [
    '（手札浮现：量体裁衣，是与人相处的分寸。吾孙有耐心。）',
    '（手札浮现：一针一线皆情分。吾孙的布庄，当以诚待人。）',
    '（手札浮现：长安衣冠，尽出吾门。吾孙好样的。）',
    '（手札浮现：衣锦还乡日，莫负手中针。吾孙切记。）',
    '（手札浮现：天下第一坊——吾孙的手艺，先祖放心。）',
  ],
  herbalist: [
    '（手札浮现：医者仁心，药到病除。吾孙当以济世为念。）',
    '（手札浮现：尝百草而知药性，吾孙有古医之风。）',
    '（手札浮现：坐堂施诊，悬壶济世。吾孙不负所学。）',
    '（手札浮现：长安病患皆得所医，吾孙功德无量。）',
    '（手札浮现：天下第一堂——吾孙妙手回春，先祖含笑。）',
  ],
};

/** 取某产业等级定义（越界取最高级） */
export function industryLevel(kind: 'tavern' | 'clothier' | 'herbalist', level: number): IndustryLevelDef {
  const list = kind === 'tavern' ? TAVERN_LEVELS : kind === 'clothier' ? CLOTHIER_LEVELS : HERBALIST_LEVELS;
  return list[Math.min(level - 1, list.length - 1)]!;
}

/** 产业中文名（按店型） */
export function industryName(kind: 'tavern' | 'clothier' | 'herbalist'): string {
  if (kind === 'tavern') return '酒楼·庖厨之道';
  if (kind === 'clothier') return '布庄·织造之道';
  return '药铺·悬壶之道';
}
