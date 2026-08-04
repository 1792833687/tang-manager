/**
 * 《我在唐朝当掌柜》行为/库存/人际触发事件定义（地图与事件深化 模块四 4.1）
 * 与 checkBehaviorTriggers 返回的事件 id 一一对应；经 store.checkBehaviorEvents 每日清晨接入。
 * 选项遵循「A 短期成本长期回报 / B 平稳 / C 短期利己长期代价」。
 */
import type { GameEvent } from '@/types/tang-manager';

export const BEHAVIOR_EVENTS: Record<string, GameEvent> = {
  'event-overwork': {
    type: 'random', id: 'event-overwork', title: '过度劳累',
    description: '你已连续数日亲自接待所有客人——阿昭看着你眼底的青黑，欲言又止。',
    trigger: { type: 'day_range', minDay: 1, maxDay: 9999 },
    choices: [
      { id: 'a', label: '今日歇半日（委托阿昭）', consequence: '精神恢复，明日更有精神。', effect: { energy: 20, reputation: 1 } },
      { id: 'b', label: '照常开门', consequence: '你咬牙坚持，但身体在抗议。', effect: { energy: -10 } },
      { id: 'c', label: '只接熟客，早早打烊', consequence: '偷得半日闲，落得清静。', effect: { energy: 10, reputation: -1 } },
    ],
  },
  'event-rusty-insight': {
    type: 'random', id: 'event-rusty-insight', title: '能力生疏',
    description: '许久未用通晓人心，你再看人时，总觉得隔了一层。',
    trigger: { type: 'day_range', minDay: 1, maxDay: 9999 },
    choices: [
      { id: 'a', label: '对着镜子练一练', consequence: '找回几分手感。', effect: { energy: 5, reputation: 1 } },
      { id: 'b', label: '请教阿昭', consequence: '阿昭虽不懂，却认真听你说完。', effect: { xiaoerFavor: 3 } },
      { id: 'c', label: '顺其自然', consequence: '能力暂时下降。', effect: { score: -0.02 } },
    ],
  },
  'event-versatile-boss': {
    type: 'random', id: 'event-versatile-boss', title: '全才掌柜',
    description: '一次接待中你用尽了五种手法，客人叹为观止——这名声传了出去。',
    trigger: { type: 'day_range', minDay: 1, maxDay: 9999 },
    choices: [
      { id: 'a', label: '谦逊回礼', consequence: '虚怀若谷，更得人敬重。', effect: { reputation: 10 } },
      { id: 'b', label: '顺势揽客', consequence: '名声是生意最好的招牌。', effect: { reputation: 5, gold: 5 } },
      { id: 'c', label: '不置可否', consequence: '你笑笑不语，心里记下这一笔。', effect: { reputation: 2 } },
    ],
  },
  'event-thief-watch': {
    type: 'random', id: 'event-thief-watch', title: '富甲一方',
    description: '库房总值首次破千两——夜里，巷口似乎多了几道游移的目光。',
    trigger: { type: 'day_range', minDay: 1, maxDay: 9999 },
    choices: [
      { id: 'a', label: '加固门窗（花 10 两）', consequence: '有备无患，夜里睡得安稳。', effect: { gold: -10 } },
      { id: 'b', label: '雇护卫守夜', consequence: '多一双眼睛，多一分安心。', effect: { gold: -15, reputation: 1 } },
      { id: 'c', label: '不以为意', consequence: '你料想宵小不敢来——却不知有人盯上了。', effect: { gold: -20 } },
    ],
  },
  'event-hoarding-inquiry': {
    type: 'random', id: 'event-hoarding-inquiry', title: '囤积居奇',
    description: '你库房某样货囤得太多——市易务来查你是否哄抬物价。',
    trigger: { type: 'day_range', minDay: 1, maxDay: 9999 },
    choices: [
      { id: 'a', label: '如实上报库存', consequence: '坦荡行事，官署放心。', effect: { reputation: 6 } },
      { id: 'b', label: '平价放出一批', consequence: '既消了疑心，又赚了人气。', effect: { reputation: 4, gold: 5 } },
      { id: 'c', label: '藏着不报', consequence: '瞒得一时，风声更紧。', effect: { reputation: -4 } },
    ],
  },
  'event-warehouse-praise': {
    type: 'random', id: 'event-warehouse-praise', title: '库房有方',
    description: '连续七日无陈损——阿昭夸你细心，货架整齐得能照见人影。',
    trigger: { type: 'day_range', minDay: 1, maxDay: 9999 },
    choices: [
      { id: 'a', label: '给伙计们加个菜', consequence: '人心暖了，干活更有劲。', effect: { gold: -5, xiaoerSatisfaction: 5 } },
      { id: 'b', label: '保持就好', consequence: '不骄不躁，方是长久。', effect: { reputation: 3 } },
      { id: 'c', label: '趁机多进点货', consequence: '货架满满，心里踏实。', effect: { gold: -20 } },
    ],
  },
  'event-favor-50': {
    type: 'random', id: 'event-favor-50', title: '主仆情谊',
    description: '阿昭跟着你越久，越把你当自家人——这份情，值多少银子都换不来。',
    trigger: { type: 'day_range', minDay: 1, maxDay: 9999 },
    choices: [
      { id: 'a', label: '给阿昭添身新衣', consequence: '阿昭笑得眼眶发红。', effect: { gold: -10, xiaoerFavor: 10 } },
      { id: 'b', label: '嘴上夸两句', consequence: '阿昭嘴上说不用，干活却更卖力。', effect: { xiaoerSatisfaction: 5 } },
      { id: 'c', label: '装作没看见', consequence: '有些情分，不说也懂——可也要人说。', effect: { xiaoerFavor: -3 } },
    ],
  },
  'event-favor-70': {
    type: 'random', id: 'event-favor-70', title: '知心掌柜',
    description: '阿昭已把你视作知心人——连家里的事也愿意同你商量。',
    trigger: { type: 'day_range', minDay: 1, maxDay: 9999 },
    choices: [
      { id: 'a', label: '认真听他说完', consequence: '他心里的石头落了地。', effect: { xiaoerFavor: 8 } },
      { id: 'b', label: '帮他出个主意', consequence: '你这主意，他记在了心里。', effect: { xiaoerSatisfaction: 8, reputation: 2 } },
      { id: 'c', label: '随口应付', consequence: '他欲言又止，从此少说半句。', effect: { xiaoerFavor: -5 } },
    ],
  },
  'event-favor-90': {
    type: 'random', id: 'event-favor-90', title: '生死之交',
    description: '阿昭说：这辈子就跟定你了。这份情义，长安城里难找第二份。',
    trigger: { type: 'day_range', minDay: 1, maxDay: 9999 },
    choices: [
      { id: 'a', label: '拜个把子', consequence: '从此不是主仆，是兄弟。', effect: { xiaoerFavor: 12, reputation: 5 } },
      { id: 'b', label: '给他涨月钱', consequence: '阿昭推辞不过，收了却更卖力。', effect: { gold: -10, xiaoerSatisfaction: 10 } },
      { id: 'c', label: '一如往常', consequence: '平平淡淡才是真。', effect: { xiaoerFavor: 2 } },
    ],
  },
  'event-best-friends': {
    type: 'random', id: 'event-best-friends', title: '莫逆之交',
    description: '两位伙计连续半月和睦共事，配合默契得像是同一双手。',
    trigger: { type: 'day_range', minDay: 1, maxDay: 9999 },
    choices: [
      { id: 'a', label: '记一功，各赏 5 两', consequence: '有赏有罚，人心归附。', effect: { gold: -10, xiaoerSatisfaction: 8 } },
      { id: 'b', label: '当众夸赞', consequence: '士为知己者死。', effect: { xiaoerSatisfaction: 6, reputation: 2 } },
      { id: 'c', label: '习以为常', consequence: '功劳不说，会凉了人心。', effect: { xiaoerSatisfaction: -3 } },
    ],
  },
  'event-open-conflict': {
    type: 'random', id: 'event-open-conflict', title: '水火不容',
    description: '两位伙计矛盾已深，在店里当着客人就吵了起来——再不管，怕是要走一个。',
    trigger: { type: 'day_range', minDay: 1, maxDay: 9999 },
    choices: [
      { id: 'a', label: '分别谈心', consequence: '你各给台阶，二人勉强消了气。', effect: { xiaoerSatisfaction: 4 } },
      { id: 'b', label: '各打五十大板', consequence: '都罚了，谁也没占到便宜。', effect: { xiaoerSatisfaction: -3 } },
      { id: 'c', label: '劝退闹得凶的那个', consequence: '长痛不如短痛，但损失一人手。', effect: { gold: -15, reputation: -3 } },
    ],
  },
};
