/**
 * 《我在唐朝当掌柜》事件定义（Step 3 3.1；TANG-S3-002 甲方原文逐字落库）
 * - 纯数据：UI/系统/Store 共用同一份 EVENT_DEFINITIONS。
 * - 触发去重：eventLog.includes(id) 为权威（GameEvent.triggered 仅同步维护作展示参考）。
 * - description/label：甲方原文逐字保留；consequence 为自拟（任务允许）。
 * - type 字段（用户规格必填）：debt_collection / regular_customer / shen_tinglan / xie_qi；
 *   trigger 结构并存，作为 checkAndTriggerEvents 的条件数据。
 * - 债主选项 A 的扣款不写死 5：effect.special='pay_monthly_interest'，
 *   由 resolveEventChoice 读取 state.monthlyInterest 应用（需求：按当月月息扣）。
 */
import type { GameEvent } from '@/types/tang-manager';

export const EVENT_DEFINITIONS: readonly GameEvent[] = [
  {
    type: 'debt_collection',
    id: 'debtor',
    title: '债主上门',
    description:
      '债主赵员外派人上门，催讨本月利息。来的是两个膀大腰圆的汉子，往店门口一站，客人都不敢进来了。',
    trigger: { type: 'day_range', minDay: 7, maxDay: 10, minDebt: 1 },
    choices: [
      {
        id: 'pay',
        label: '老实还钱',
        consequence: '你奉上月息，债主验过银两，满意离去。',
        effect: { special: 'pay_monthly_interest' },
      },
      {
        id: 'defy',
        label: '让阿昭被带走抵债',
        consequence: '你无力偿还，眼睁睁看着阿昭被两个汉子带走。她回头看了你一眼，没有说话。',
        effect: { xiaoerFavor: 0, xiaoerSatisfaction: 0, special: 'xiaoer_gone' },
      },
      {
        id: 'ask_shen',
        label: '求助沈听澜',
        consequence: '你托人请沈听澜出面，他二话不说帮你垫了月息。你欠了他一个人情。',
        effect: { special: 'shen_debt' },
      },
    ],
  },
  {
    type: 'regular_customer',
    id: 'repeat-customer',
    title: '回头客出现',
    description:
      '一位面熟的老客掀帘进来，笑呵呵地跟你打招呼。上回他在你店里吃得满意，这次带了两个朋友一起来。',
    trigger: { type: 'score', minScore: 2.0 },
    choices: [
      {
        id: 'big_order',
        label: '亲自招待',
        consequence: '你亲自张罗席面，老客连声称谢。今日店里格外忙碌，累得腰酸背痛，却也值得。',
        effect: { energy: -5, special: 'add_big_order_guest' },
      },
      {
        id: 'stable',
        label: '让阿昭招呼',
        consequence: '阿昭手脚麻利，把客人招呼得妥妥帖帖。老客满意点头，说改日还来。',
        effect: { xiaoerSatisfaction: 3, special: 'add_normal_guest' },
      },
    ],
  },
  {
    type: 'shen_tinglan',
    id: 'shen-tinglan',
    title: '沈听澜登场',
    description:
      '一位锦衣公子带着随从踏入店门，环顾四周后微微点头。他自报家门——沈氏商号少东家，沈听澜。「掌柜的这店经营得不错，在下有个提议，不知可有兴趣一叙？」',
    trigger: { type: 'reputation', minReputation: 300 },
    choices: [
      {
        id: 'befriend',
        label: '接受合作',
        consequence: '沈听澜抚掌轻笑，说掌柜的爽快。两家分店互通有无，往后东市的动静，他会让人知会你一声。',
        effect: { shenTinglanFavor: 10, special: 'shen_partner' },
      },
      {
        id: 'decline',
        label: '婉拒',
        consequence: '你拱手谢绝，说小店本小利薄，不敢高攀。沈听澜也不恼，只道「掌柜的谨慎是好事」，带着随从离去。',
        effect: { shenTinglanFavor: -5 },
      },
    ],
  },
  {
    type: 'xie_qi',
    id: 'xie-qi-debt',
    title: '谢七登场',
    description:
      '一个穿着随意、嘴角带笑的年轻人不知什么时候溜进了店里，正趴在柜台上跟阿昭闲聊。见你过来，他咧嘴一笑：「掌柜的，听说你把债还清了？厉害啊。在下谢七，交个朋友？」',
    trigger: { type: 'debt_zero' },
    choices: [
      {
        id: 'take_info',
        label: '请他喝一杯',
        consequence: '你请谢七喝了一盅，他压低声音，把赌场的门道讲了个大概。',
        effect: { xieQiFavor: 5 },
      },
      {
        id: 'distance',
        label: '赶他出去',
        consequence: '你把谢七赶出店门。他耸耸肩，也不恼，只说改日还会再来。',
        effect: { xieQiFavor: -10 },
      },
    ],
  },
  // ============================================================
  // Step 5b 新增事件（货币与金融：通胀 / 钱庄优惠 / 地下钱庄 / 合作投资 / 信用告急）
  // ============================================================
  {
    type: 'random',
    id: 'harvest-omen',
    title: '年景与粮价',
    description:
      '粮行的掌柜晌午来串门，愁眉苦脸地跟你叹年景：今年的收成好坏，直接牵动着满城物价。「掌柜的，你可得心里有数。」',
    trigger: { type: 'day_range', minDay: 30, maxDay: 9999 },
    choices: [
      {
        id: 'bumper',
        label: '风调雨顺，屯粮备货',
        consequence: '今年五谷丰登，粮价回落，市面物价随之走低。',
        effect: { inflationModifier: -0.1 },
      },
      {
        id: 'famine',
        label: '天时不利，惜售观望',
        consequence: '今年天旱歉收，粮价飞涨，满城物价水涨船高。',
        effect: { inflationModifier: 0.15 },
      },
    ],
  },
  {
    type: 'random',
    id: 'bank-promotion',
    title: '钱庄让利',
    description:
      '东市钱庄的伙计送来一张红帖：本月钱庄让利，存款利息翻倍，存得越多赚得越多。「掌柜的若有闲钱，不妨存上一笔。」',
    trigger: { type: 'day_range', minDay: 45, maxDay: 9999 },
    choices: [
      {
        id: 'take',
        label: '去存一笔',
        consequence: '你趁让利把钱存进钱庄，七日之内利息翻倍。',
        effect: { depositRateBoostDays: 7 },
      },
      {
        id: 'skip',
        label: '再看行情',
        consequence: '你笑着谢过，说改日再看。',
        effect: {},
      },
    ],
  },
  {
    type: 'xie_qi',
    id: 'xieqi-underground',
    title: '谢七的地下门路',
    description:
      '谢七神神秘秘地凑过来，压低声音：「掌柜的，有笔快钱的门路，要走不走？」他说的地下钱庄利高，可水也深。',
    trigger: { type: 'xie_qi_favor', minFavor: 30 },
    choices: [
      {
        id: 'listen',
        label: '听他说说',
        consequence: '你听谢七讲了一盏茶的地下门道，心里有了底（好感 +3）。',
        effect: { xieQiFavor: 3 },
      },
      {
        id: 'decline',
        label: '敬而远之',
        consequence: '你摇摇头说本钱要紧，谢七也不勉强。',
        effect: {},
      },
    ],
  },
  {
    type: 'shen_tinglan',
    id: 'shen-invest',
    title: '沈听澜的合作提议',
    description:
      '沈听澜差人送来一封书函：他正筹措一桩大宗买卖，愿分一杯羹给信得过的掌柜。「若有意，本钱一二百两即可，四十五日见分晓。」',
    trigger: { type: 'shen_favor', minFavor: 40 },
    choices: [
      {
        id: 'accept',
        label: '答应合作',
        consequence: '你回帖应下这桩买卖，沈听澜抚掌而笑（好感 +5）。',
        effect: { shenTinglanFavor: 5 },
      },
      {
        id: 'think',
        label: '容我三思',
        consequence: '你回帖说容后再议，沈听澜也不催促。',
        effect: {},
      },
    ],
  },
  {
    type: 'random',
    id: 'credit-warning',
    title: '信用告急',
    description:
      '坊间的掌柜们见了你都躲着走，货栈也传话要你「现银结账」。你这才惊觉，自己在行市上的信用已经跌到了谷底。',
    trigger: { type: 'credit', maxCredit: 50, minDay: 20 },
    choices: [
      {
        id: 'discipline',
        label: '收紧开销，按时结账',
        consequence: '你暗下决心，先把赊欠的账目一一理清。',
        effect: {},
      },
      {
        id: 'ignore',
        label: '船到桥头自然直',
        consequence: '你嘴上说不急，可心里也打起鼓来（信用 -5）。',
        effect: { credit: -5 },
      },
    ],
  },
];

/** 抵押没收事件（合成：checkLoanOverdue 逾期 3 个月时由 store 生成入队；不参与 checkAndTriggerEvents 自动触发） */
export function buildSeizureEvent(collateral: 'shop' | 'deed' | 'goods', day: number): GameEvent {
  const desc =
    collateral === 'shop'
      ? '钱庄的人带着官差上门，说你抵押的铺面逾期未赎。你眼睁睁看着封条贴上梁柱，多年心血一朝查封。'
      : collateral === 'deed'
        ? '你抵押的地契逾期未赎，钱庄把地契收了去。名下的铺子没了根基，几家分店人心惶惶。'
        : '你抵押的货物逾期未赎，钱庄的伙计把库房清了个干净。';
  return {
    type: 'debt_collection',
    id: `mortgage-seized-${day}`,
    title: '抵押没收',
    description: desc,
    trigger: { type: 'day_range', minDay: 0, maxDay: 9999 },
    choices: [
      {
        id: 'accept',
        label: '认了',
        consequence:
          collateral === 'shop'
            ? '铺面被查封，你被扫地出门——只能想办法夺回老店。'
            : collateral === 'deed'
              ? '地契易主，分店难以为继。'
              : '货物清空，血本无归。',
        effect: {},
      },
    ],
  };
}

/** id → 事件 索引（系统/UI 查表用） */
export const EVENT_MAP: Readonly<Record<string, GameEvent>> = Object.fromEntries(
  EVENT_DEFINITIONS.map((e) => [e.id, e])
);
