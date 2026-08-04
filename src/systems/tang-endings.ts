/**
 * 《我在唐朝当掌柜》多结局系统（Step 5b-5 模块五）
 * 归途："归途：商海浮沉终有尽头。或富甲一方，或权倾朝野，或归隐田园——你的选择，决定你的归途。"
 * 纯函数：checkEndingConditions(state) 每日打烊检测 8 结局（条件逐字）；
 * 触发后由 store triggerEnding 设置 endingTriggered + 暂停/弹窗。
 * 结局分类（用户 5.3 逐字）：一代商圣/皇商之路/商界教父 可继续；
 * 家道中落/权倾朝野/归隐田园 强制结束（另 无人问津 强制、执棋者 可继续，工程定注释）。
 * 铁律：古风措辞；不持有游戏状态。
 */
import type { Clue } from '@/types/tang-clues';
import type { PoliticalSubFactionId } from '@/config/tang-politics';

/** 结局定义 */
export interface EndingDefinition {
  id: string;
  title: string;
  subtitle: string;
  /** 旁白描述 2-3 段 */
  paragraphs: string[];
  category: 'glory' | 'wealth' | 'seclusion' | 'mentor' | 'downfall' | 'power' | 'obscurity' | 'hidden';
  /** true = 强制结束（只能再开一局）；false = 可继续经营 */
  forceEnd: boolean;
  /** 隐藏结局（执棋者；线索全解析才可见） */
  hidden?: boolean;
}

/** 8 结局定义（条件见 checkEndingConditions；标题/旁白古风） */
export const ENDING_DEFINITIONS: readonly EndingDefinition[] = [
  {
    id: 'shang-sheng',
    title: '一代商圣',
    subtitle: '富甲天下，货通四海',
    paragraphs: [
      '长安城的灯火，有一半是因你而亮。三间铺面、五十万两家底、九百分声望，商贾们提起「陆记」，都要先拱手为礼。',
      '东市的商贩说，你一句话能定一条街的价；西市的胡商说，你的名帖比官府的文书还灵。',
      '百年之后，长安的《货殖传》上，你的名字排在最前头。',
    ],
    category: 'glory',
    forceEnd: false,
  },
  {
    id: 'huangshang',
    title: '皇商之路',
    subtitle: '御笔亲点，供奉天家',
    paragraphs: [
      '皇商招标的朱批落下的那一刻，你的商号便与天家绑在了一处。',
      '宫中采买、御膳供应、百官年礼——你的货，进了大明宫的门。',
      '你终于明白，所谓皇商，是荣耀，也是枷锁。',
    ],
    category: 'wealth',
    forceEnd: false,
  },
  {
    id: 'guiyin',
    title: '归隐田园',
    subtitle: '卸下荣华，南山种豆',
    paragraphs: [
      '你把铺面一一盘出，遣散了伙计，只留一册手札、一壶清酒。',
      '终南山下的宅子不大，院里有株老槐。春来煮茶，秋来收豆，日子慢得像长安城的更漏。',
      '偶尔有旧日的客商寻来，你只笑说：陆记掌柜，早就归隐了。',
    ],
    category: 'seclusion',
    forceEnd: true,
  },
  {
    id: 'shangjie-jiaofu',
    title: '商界教父',
    subtitle: '桃李满城，衣钵相传',
    paragraphs: [
      '你的徒弟们散落长安，各自撑起一方天地。',
      '你退居幕后三十日，看着他们把「陆记」的招牌，一盏一盏点亮了长安的街巷。',
      '商海浮沉，你不再亲自下场，却到处都是你的影子。',
    ],
    category: 'mentor',
    forceEnd: false,
  },
  {
    id: 'jiadao-zhongluo',
    title: '家道中落',
    subtitle: '债台高筑，门庭冷落',
    paragraphs: [
      '五百两的旧债压弯了脊梁，库房空空，账上再无分文。',
      '债主上门时，你连一壶待客的茶都拿不出来。',
      '那本家传手札的最后一页，只写了一个字：悔。',
    ],
    category: 'downfall',
    forceEnd: true,
  },
  {
    id: 'quanqing-chaoye',
    title: '权倾朝野',
    subtitle: '庙堂之上，一言九鼎',
    paragraphs: [
      '你踏进巍明楼的那一日，长安的商贾都改了称呼——不再是掌柜，是「大人」。',
      '朝堂党争、派系倾轧，你步步为营，终成一方擎天柱。',
      '只是夜深人静时，你偶尔会想起当年东市那盏为客人留的灯。',
    ],
    category: 'power',
    forceEnd: true,
  },
  {
    id: 'wuren-wenjin',
    title: '无人问津',
    subtitle: '寒来暑往，门前冷落',
    paragraphs: [
      '一年又一年，铺子还在，客人却越来越少。',
      '你守着那间老店，像守着一盏将灭的灯。',
      '长安城的繁华，终究与你无关了。',
    ],
    category: 'obscurity',
    forceEnd: true,
  },
  {
    id: 'zhiqizhe',
    title: '执棋者',
    subtitle: '长安暗流，尽在掌中',
    paragraphs: [
      '五方势力的暗线在你手中交织，蛛丝马迹连成了一张网。',
      '你不入任何一方，却让每一方都离不开你。',
      '棋盘之上，你才是执子之人。',
    ],
    category: 'hidden',
    forceEnd: false,
    hidden: true,
  },
];

/** 结局查询（id → 定义；不存在返回 null） */
export function endingById(id: string): EndingDefinition | null {
  return ENDING_DEFINITIONS.find((e) => e.id === id) ?? null;
}

/** 结局检测上下文（由 store 从 TangGameState 投影） */
export interface EndingCheckContext {
  shopCount: number;
  silver: number;
  reputation: number;
  score: number;
  day: number;
  legacyDebt: number;
  credit: number;
  /** 朝廷合作（皇商之路） */
  courtCooperation: boolean;
  /** 皇商中标次数（皇商之路 ≥3） */
  imperialBidCount: number;
  /** 主动卖店（归隐田园） */
  soldShops: boolean;
  /** 徒弟独立开店（商界教父） */
  apprenticeOpenedShop: boolean;
  /** 退居天数（商界教父 ≥30） */
  retiredDays: number;
  /** 从商转政（权倾朝野） */
  politicalLine: boolean;
  /** 支持派系值（权倾朝野 ≥90） */
  politicalAlignment: number;
  /** 政治终局（权倾朝野） */
  politicalEndgame: boolean;
  /** 五势力关系（执棋者 全部 ≥70） */
  factions: readonly { id: string; relationship: number }[];
  /** 全部线索（执棋者 全解析） */
  clues: readonly Clue[];
  /** 已加入朝廷派系（执棋者 未加入） */
  joinedCourt: boolean;
}

/**
 * 每日打烊检测 8 结局（条件逐字）：
 * 一代商圣 3 店+50 万+声望 900 / 皇商之路 朝廷合作+信用 900+皇商 3 次 /
 * 归隐田园 10 万+主动卖店 / 商界教父 徒弟独立 1 店评分 4.0+退居 30 天 /
 * 家道中落 负债 500+资金 0+评分<2 / 权倾朝野 转政+派系 90+政治终局 /
 * 无人问津 365 天+<1000 两+评分<3 未触发其他 / 执棋者 五势力≥70+线索全解锁+未加入（隐藏）。
 * 判定顺序：家道中落（立即失败）→ 荣耀/财富/归隐/教父/权倾 → 无人问津（兜底）→ 执棋者（隐藏）。
 */
export function checkEndingConditions(ctx: EndingCheckContext): string | null {
  // 1. 家道中落：负债 500+ 资金 0 + 评分<2（立即终结，优先）
  if (ctx.legacyDebt >= 500 && ctx.silver <= 0 && ctx.score < 2) {
    return 'jiadao-zhongluo';
  }
  // 2. 一代商圣：3 店 + 50 万 + 声望 900
  if (ctx.shopCount >= 3 && ctx.silver >= 500000 && ctx.reputation >= 900) {
    return 'shang-sheng';
  }
  // 3. 皇商之路：朝廷合作 + 信用 900 + 皇商 3 次
  if (ctx.courtCooperation && ctx.credit >= 900 && ctx.imperialBidCount >= 3) {
    return 'huangshang';
  }
  // 4. 归隐田园：10 万 + 主动卖店
  if (ctx.silver >= 100000 && ctx.soldShops) {
    return 'guiyin';
  }
  // 5. 商界教父：徒弟独立 1 店 + 评分 4.0 + 退居 30 天
  if (ctx.apprenticeOpenedShop && ctx.score >= 4.0 && ctx.retiredDays >= 30) {
    return 'shangjie-jiaofu';
  }
  // 6. 权倾朝野：转政 + 派系 90 + 政治终局
  if (ctx.politicalLine && ctx.politicalAlignment >= 90 && ctx.politicalEndgame) {
    return 'quanqing-chaoye';
  }
  // 7. 无人问津：365 天 + <1000 两 + 评分<3（未触发其他；兜底）
  if (ctx.day >= 365 && ctx.silver < 1000 && ctx.score < 3) {
    return 'wuren-wenjin';
  }
  // 8. 执棋者（隐藏）：五势力≥70 + 线索全解锁（全部 resolved）+ 未加入朝廷
  const factionsAllHigh = ctx.factions.length > 0 && ctx.factions.every((f) => f.relationship >= 70);
  const cluesAllResolved =
    ctx.clues.length > 0 && ctx.clues.every((c) => c.resolved);
  if (factionsAllHigh && cluesAllResolved && !ctx.joinedCourt) {
    return 'zhiqizhe';
  }
  return null;
}

/** 便捷：由派系数组投影五势力关系（执棋者判定用；store 接线复用） */
export function factionRelationships(
  factions: readonly { id: string; relationship: number }[]
): { id: string; relationship: number }[] {
  return factions.map((f) => ({ id: f.id, relationship: f.relationship }));
}

/** 便捷：三子派 id 常量（store 对齐用） */
export const POLITICAL_SUB_ID: Record<PoliticalSubFactionId, PoliticalSubFactionId> = {
  conservative: 'conservative',
  reformist: 'reformist',
  eunuch: 'eunuch',
};
