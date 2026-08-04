/**
 * 《我在唐朝当掌柜》接待对话预设模板池（模块二 2.3 / 模块五 5.1）
 * AI 不可用 / 未配置 / 离线 / 超时（>8s）时随机抽取兜底。
 * 数量基线：开场白每店 10 套、心情回应每类 5 套、成交叙事每店 8 套、
 * 失败叙事每店 5 套、客人评价（留言簿）每店 5 套。
 * 占位符 {xxx} 由各系统插值（客人称呼/菜品/面料/药材/症状/金额等）。
 */
import type { GuestMood, ResponseStyle } from '@/types/tang-dialogue';
import type { ShopType } from '@/types/tang-manager';

/** 客人开场白（每店 10 套；模块一各店预设示例 + 扩展） */
export const OPENING_LINES: Record<ShopType, string[]> = {
  jiulou: [
    '掌柜的，老夫今日做寿，要一桌体面的席面。',
    '赶了一天的路，有什么热乎的赶紧端上来！',
    '约了朋友谈生意，找个雅间，上几个拿手菜。',
    '家里娘子生了，买些滋补的炖品回去。',
    '今儿个嘴馋，就想喝口热乎的羊肉汤。',
    '几位跑商的老兄弟路过，给整治一桌下酒的。',
    '听说你家厨子有一手，特地来尝尝鲜。',
    '快些上菜，我这人最不耐烦等。',
    '随便来两个小菜，一壶酒，打发打发。',
    '给外乡来的亲戚接风，要体面些的。',
  ],
  buzhuang: [
    '天凉了，想做件夹袄，掌柜的有什么好料子推荐？',
    '女儿下月出嫁，要置办嫁妆——从里到外都得是新衣裳。',
    '我是粗人，不要花哨的，结实耐穿就行。',
    '听说长安最近时兴窄袖，给我做两件赶赶时髦。',
    '给家里的老人扯几尺棉布，做身舒服的。',
    '要出远门，扯几尺耐磨的料子做行装。',
    '东家请客，想做身体面的绸衫。',
    '这料子摸着不错，多少钱一尺？',
    '想给孩儿做几件新衣，耐脏些的。',
    '镇上有喜事，要裁件喜庆些的衣裳。',
  ],
  yaopu: [
    '大夫，最近总是失眠多梦，半夜盗汗，白天没精神。',
    '我家老母亲咳了半个月了，吃了好几副药都不见好。',
    '被马车撞了一下，腿肿了三天，走路都疼。',
    '就是来抓些补药——最近感觉身子虚，想调理调理。',
    '孩子夜里总惊醒，说是心慌，给瞧瞧。',
    '入秋了，抓副润肺的方子备着。',
    '跌打损伤的膏药有吗？胳膊肘子磕着了。',
    '大夫，我这老寒腿一到阴天就疼。',
    '抓副安神的药，这几日总是睡不踏实。',
    '掌柜的，给配些滋补的，孝敬家中长辈。',
  ],
};

/** 客人回应（每心情 5 套；player_response 后 / recommend 后通用） */
export const GUEST_REPLIES: Record<GuestMood, string[]> = {
  joyful: [
    '（{guestName}眉眼舒展）' + '掌柜的会说话，听着心里舒坦。',
    '（{guestName}笑着点头）' + '成，就冲你这句话，我信你。',
    '（{guestName}心情不错）' + '好说好说，你看着办便是。',
    '（{guestName}抚掌一笑）' + '痛快！就爱跟你这样的实诚人打交道。',
    '（{guestName}连连称好）' + '那就劳烦掌柜的多费心了。',
  ],
  calm: [
    '（{guestName}微微颔首）' + '嗯，你继续说。',
    '（{guestName}神色如常）' + '那便看看吧，合适再说。',
    '（{guestName}打量了你一眼）' + '价钱公道的话，倒也不是不行。',
    '（{guestName}不置可否）' + '先瞧瞧货色如何。',
    '（{guestName}慢条斯理）' + '不急，容我斟酌斟酌。',
  ],
  irritated: [
    '（{guestName}皱眉）' + '快些快些，别耽误工夫。',
    '（{guestName}不耐烦地挥手）' + '少说这些虚的，直接说价。',
    '（{guestName}脸色微沉）' + '再磨蹭我可去别家了。',
    '（{guestName}冷哼一声）' + '说得天花乱坠，谁知道货怎么样。',
    '（{guestName}语气生硬）' + '就这点事，还用想这么久？',
  ],
  picky: [
    '（{guestName}挑剔地看了看）' + '就这？可配不上我的眼光。',
    '（{guestName}眉头微蹙）' + '料子不趁手，样式也寻常了些。',
    '（{guestName}轻摇折扇）' + '本公子见过的世面，可不是这样的货色。',
    '（{guestName}掂量再三）' + '若是上品，价钱好说；若是滥竽充数，莫怪我翻脸。',
    '（{guestName}似笑非笑）' + '你且说说，这物件到底好在哪里？',
  ],
};

/** 玩家回应方式（2.1 三选；供对话引擎与 UI 使用） */
export const RESPONSE_STYLES: Array<{
  style: ResponseStyle;
  label: string;
  hint: string;
  favorDelta: number;
  trustDelta: number;
  closeBonus: number;
  profitCapPenalty: number;
}> = [
  { style: 'warm', label: '热情寒暄', hint: '拉拉家常，让客人如沐春风。好感 +5，信任 -2', favorDelta: 5, trustDelta: -2, closeBonus: 0, profitCapPenalty: 0 },
  { style: 'professional', label: '专业分析', hint: '细细讲解，以理服人。信任 +5，好感 -2', favorDelta: -2, trustDelta: 5, closeBonus: 0, profitCapPenalty: 0 },
  { style: 'honest_price', label: '实在报价', hint: '直说底价，不玩虚的。成交率 +10%，利润上限 -20%', favorDelta: 0, trustDelta: 3, closeBonus: 10, profitCapPenalty: 20 },
];

/** 成交叙事（每店 8 套；{guestName}/{dishName}/{fabricName}/{styleName}/{herbName}/{income} 插值） */
export const SUCCESS_NARRATIVES: Record<ShopType, string[]> = {
  jiulou: [
    '（{guestName}夹了一筷子{dishName}，眼睛一亮。' + "'这道菜——绝了。'阿昭在旁边偷偷冲你竖了个拇指。这一桌席面，宾主尽欢。）",
    '（酒过三巡，{guestName}红光满面，拍着桌子说这顿吃得值。阿昭麻利地添酒布菜，堂里热气腾腾。）',
    '（{guestName}吃得尽兴，临走还问了两句招牌菜的做法。你笑着说是店里的不传之秘。）',
    '（满堂菜香里，{guestName}拱手道谢：' + "'掌柜的，好手艺！下回还来。'）",
    '（{guestName}夹起{dishName}细细品尝，眉眼间尽是满足。这一单，入账{income}两。）',
    '（热菜上桌，香气扑鼻。{guestName}招呼同来的友人：' + "'我说这家的菜地道吧！'）",
    '（{guestName}吃得酣畅，结账时多赏了几个铜板，说是给厨上的辛苦钱。）',
    '（一席终了，{guestName}抚着肚皮满意而去。阿昭收拾碗碟，说这位客官下回准还来。）',
  ],
  buzhuang: [
    '（{guestName}摸了摸{fabricName}的料子，又在身上比了比{styleName}的样式。' + "'掌柜的眼光不错——就照这个来吧。'阿昭赶紧拿来尺子，给客人量起了尺寸。）",
    '（{guestName}细细端详布匹，终于点了头。这一匹{fabricName}裁成{styleName}的样式，正合心意。）',
    '（量体裁衣，{guestName}对着镜子左看右看，满意地付了定钱。）',
    '（{guestName}夸你眼力好，挑的料子衬人。这一单成了，还约了下回再来看新货。）',
    '（布匹展开，光泽温润。{guestName}当下拍板：' + "'就它了，劳烦掌柜的用心做。'）",
    '（{guestName}比划着样式，越看越欢喜，连声说改日介绍亲友来。）',
    '（成衣交到手上，{guestName}眉开眼笑，直说针脚细密、样式时新。）',
    '（这一单{fabricName}{styleName}的衣裳定下，{guestName}满意离去，入账{income}两。）',
  ],
  yaopu: [
    '（你抓了{herbName}，配上辅药，嘱咐了几句煎服的法子。{guestName}接过药包，连连道谢：' + "'大夫费心了，若有起色改日再来谢您。'）",
    '（{guestName}闻了闻药包，眉头舒展，说这方子闻着就安心。）',
    '（你把药方细细写下，{guestName}郑重收好，说改日定来复诊。）',
    '（对症下药，{guestName}神色缓和许多，付了药钱连声道谢。）',
    '（{guestName}捧着药包，感慨道：' + "'走遍半条街，还是您这儿实在。'）",
    '（你叮嘱了几句忌口，{guestName}一一记下，说回去就照着煎。）',
    '（药配得妥帖，{guestName}心里的石头落了地，说要给家中老小都配一副。）',
    '（这一剂{herbName}的方子配好，{guestName}千恩万谢地走了，入账{income}两。）',
  ],
};

/** 失败叙事（每店 5 套；客人拒绝/离开） */
export const FAIL_NARRATIVES: Record<ShopType, string[]> = {
  jiulou: [
    '（{guestName}看了看桌上的菜色，皱了皱眉，放下筷子：' + "'不对胃口，结账吧。'这一桌，算是白忙了。）",
    '（菜上得慢了，{guestName}等得不耐烦，起身就走，只留下一句：' + "'下回不来了。'）",
    '（{guestName}嫌菜色寡淡，价钱又贵，摇着头出了门。）',
    '（同来的友人嫌雅间太吵，{guestName}面子上挂不住，一行人悻悻离去。）',
    '（{guestName}尝了一口，撇撇嘴：' + "'火候不对。'钱也没付，拂袖而去。）",
  ],
  buzhuang: [
    '（{guestName}摸了摸料子，摇了摇头：' + "'不够称心。'转身便走了。）",
    '（{guestName}嫌样式老气，价钱又高，没有成交。）',
    '（量到一半，{guestName}说家里有事，改日再来——这单八成是黄了。）',
    '（{guestName}嫌{fabricName}不趁手，去了隔壁布庄。）',
    '（{guestName}犹豫再三，终究没下定钱，说再想想。）',
  ],
  yaopu: [
    '（{guestName}看了看方子，将信将疑：' + "'这药真管用？'到底没买，走了。）",
    '（{guestName}嫌药价贵，嘀咕着去别家抓药了。）',
    '（你开的方子，{guestName}听着不对症，摇了摇头没接。）',
    '（{guestName}急着赶路，等不得抓药，匆匆走了。）',
    '（{guestName}对药效存疑，说还是回去问问别家大夫。）',
  ],
};

/** 客人评价（留言簿；每店 5 套；{guestName} 插值） */
export const GUEST_REVIEWS: Record<ShopType, string[]> = {
  jiulou: [
    '（{guestName}在留言簿上写道：好一桌席面，味正量足，下回还来！）',
    '（{guestName}留言：掌柜的会做生意，菜也地道。）',
    '（{guestName}留言：酒香菜美，宾主尽欢。）',
    '（{guestName}留言：羊肉羹一绝，回味无穷。）',
    '（{guestName}留言：待客热络，菜色新鲜，好！）',
  ],
  buzhuang: [
    '（{guestName}在留言簿上写道：料子好，针脚细，穿着体面。）',
    '（{guestName}留言：掌柜的眼力准，挑的料子正合心意。）',
    '（{guestName}留言：成衣做得利落，样式时新。）',
    '（{guestName}留言：价钱公道，做工实在。）',
    '（{guestName}留言：量体裁衣，处处妥帖。）',
  ],
  yaopu: [
    '（{guestName}在留言簿上写道：药到病除，大夫仁心。）',
    '（{guestName}留言：方子对症，抓药实在。）',
    '（{guestName}留言：掌柜的懂医理，嘱咐得仔细。）',
    '（{guestName}留言：药好人善，改日再来谢。）',
    '（{guestName}留言：滋补的方子管用，气色好多了。）',
  ],
};

/** 通用随机抽取（纯函数；rng 可注入） */
export function pickTemplate<T>(pool: readonly T[], rng: () => number = Math.random): T {
  const idx = Math.floor(rng() * pool.length);
  return pool[Math.min(idx, pool.length - 1)]!;
}
