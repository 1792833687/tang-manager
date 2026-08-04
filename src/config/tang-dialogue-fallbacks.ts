/**
 * 《我在唐朝当掌柜》AI 对话决策兜底模板（2026-08-06 · 规格书模块一 1.5 / 模块五 5.2）
 * AI 不可用/超时/解析失败时，从本池随机抽取三选项（每店 5 套）。
 * 开场白/客人回应/成交与失败叙事复用既有 tang-dialogue-templates 池。
 */
import type { ShopType } from '@/types/tang-manager';

/** 客人到店小场景（AI 叙事兜底；每店 5 套；占位 {guestName}/{description} 由上层插值） */
export const ARRIVAL_TEMPLATES: Record<ShopType, string[]> = {
  jiulou: [
    '（{guestName}推门而入，风尘仆仆，目光在堂间一扫，径直寻了张干净桌子坐下。）{description}',
    '（{guestName}迈过门槛，袖口还沾着外头的风沙。店里的热气扑面，他眉眼舒展了几分。）{description}',
    '（{guestName}在门口驻足片刻，打量了堂间菜色与座次，才缓步进来。）{description}',
    '（{guestName}大踏步进来，嗓门洪亮，先招呼了句好，才落座点单。）{description}',
    '（{guestName}进门时正逢后厨飘香，他吸了吸鼻子，脸上浮起笑意。）{description}',
  ],
  buzhuang: [
    '（{guestName}掀帘而入，手里还攥着一匹从别处看过的料子样角，进门便往柜台前凑。）{description}',
    '（{guestName}站在门口，先打量了架上各色料子，才朝掌柜点了点头。）{description}',
    '（{guestName}进门时带着一身风霜，摩挲着衣料，似在盘算着什么。）{description}',
    '（{guestName}轻叩柜台，客客气气地问了声好，才道出来意。）{description}',
    '（{guestName}进门后先瞧了瞧时兴的花色，眼里有了计较，才开口。）{description}',
  ],
  yaopu: [
    '（{guestName}扶着门框进来，面色微白，说话声气也比寻常弱了几分。）{description}',
    '（{guestName}进门时轻轻咳了两声，在柜台前站定，似在斟酌如何开口。）{description}',
    '（{guestName}由人搀着进了店，袖中露出一截包扎过的旧伤。）{description}',
    '（{guestName}进门便往药柜方向看了一眼，神色间带着几分急切。）{description}',
    '（{guestName}在门口略站了站，嗅着满室的药香，才缓缓道明来意。）{description}',
  ],
};

/** 随机抽一条到店描述（纯函数；rng 可注入） */
export function pickArrivalTemplate(shopType: ShopType, rng: () => number = Math.random): string {
  const pool = ARRIVAL_TEMPLATES[shopType] ?? ARRIVAL_TEMPLATES.jiulou;
  const idx = Math.min(Math.floor(rng() * pool.length), pool.length - 1);
  return pool[idx]!;
}


export interface DialogueOptionTemplate {
  text: string;
  strategy: string;
  /** 预估成交价（两） */
  estimatedPrice: number;
  /** 预估成交率（0-100） */
  estimatedSuccessRate: number;
  risk: string;
}

export interface DialogueOptionSetTemplate {
  guestAnalysis: string;
  options: DialogueOptionTemplate[];
}

/** 每店 5 套三选项模板（规格书 1.5） */
export const DIALOGUE_OPTION_TEMPLATES: Record<ShopType, readonly DialogueOptionSetTemplate[]> = {
  jiulou: [
    {
      guestAnalysis: '这位客官重体面、要排场，银子不是问题，只怕怠慢。',
      options: [
        { text: '客官放心，小店备着上好的席面，招牌菜一应俱全，包您有面子。', strategy: '以质取胜', estimatedPrice: 12, estimatedSuccessRate: 55, risk: '价高，若客人节俭易谈崩。' },
        { text: '既是要紧事，给您实惠又体面的配法，荤素得当，绝不虚报。', strategy: '以实相待', estimatedPrice: 8, estimatedSuccessRate: 80, risk: '利润偏薄。' },
        { text: '听闻客官喜好，小店恰有一道私房菜，别处吃不着，值得一试。', strategy: '投其所好', estimatedPrice: 10, estimatedSuccessRate: 65, risk: '口味不合则适得其反。' },
      ],
    },
    {
      guestAnalysis: '这位客官风尘仆仆，只想快些吃上热乎的，对价格敏感。',
      options: [
        { text: '热汤热饭这就来，先上碗羊肉汤暖暖身子。', strategy: '以质取胜', estimatedPrice: 5, estimatedSuccessRate: 70, risk: '客单价低。' },
        { text: '给您配份饱腹又便宜的快餐，一壶酒两个菜，实惠。', strategy: '以实相待', estimatedPrice: 3, estimatedSuccessRate: 90, risk: '几乎无利。' },
        { text: '客官赶路辛苦，小店送您一碟小菜，交个朋友。', strategy: '投其所好', estimatedPrice: 4, estimatedSuccessRate: 75, risk: '赠菜损耗成本。' },
      ],
    },
    {
      guestAnalysis: '这位是谈生意的商人，讲究排场也精于算账，两者都要兼顾。',
      options: [
        { text: '雅间已备好，招牌宴席走起，谈生意最讲究个气派。', strategy: '以质取胜', estimatedPrice: 15, estimatedSuccessRate: 60, risk: '预算可能超客人预期。' },
        { text: '给您按人头配菜，多退少补，账目清楚，绝不让您多花一文。', strategy: '以实相待', estimatedPrice: 10, estimatedSuccessRate: 78, risk: '需临时备菜。' },
        { text: '听说您与东市有生意往来？小店恰有上好的宴请菜色，正合您用。', strategy: '投其所好', estimatedPrice: 12, estimatedSuccessRate: 68, risk: '被看穿套近乎反生警惕。' },
      ],
    },
    {
      guestAnalysis: '这是位本地老饕，嘴刁，最怕敷衍，认准招牌与火候。',
      options: [
        { text: '老客官有眼光，小店今日的招牌菜火候正到，给您留着呢。', strategy: '以质取胜', estimatedPrice: 9, estimatedSuccessRate: 72, risk: '招牌菜备料有限。' },
        { text: '按老规矩给您配，都是拿手菜，价码还是从前那个。', strategy: '以实相待', estimatedPrice: 6, estimatedSuccessRate: 85, risk: '回头客利润薄。' },
        { text: '新到一批南边的时鲜，给您尝个鲜，只收个成本价。', strategy: '投其所好', estimatedPrice: 8, estimatedSuccessRate: 70, risk: '时鲜不鲜则砸招牌。' },
      ],
    },
    {
      guestAnalysis: '这位客官赶着给家眷带吃食，要快、要体面、还要不太贵。',
      options: [
        { text: '给您打包一份滋补炖品，用料足、火候到，带回去正是时候。', strategy: '以质取胜', estimatedPrice: 7, estimatedSuccessRate: 68, risk: '炖品时间略长。' },
        { text: '几个拿手菜打包，荤素都有，够一家子吃，价也公道。', strategy: '以实相待', estimatedPrice: 5, estimatedSuccessRate: 82, risk: '打包盒成本。' },
        { text: '听说府上添丁？小店备了份寓意好的菜，讨个彩头。', strategy: '投其所好', estimatedPrice: 6, estimatedSuccessRate: 74, risk: '说错话反惹不快。' },
      ],
    },
  ],
  buzhuang: [
    {
      guestAnalysis: '这位客官要做体面衣裳，看重料子与手工，讲究身份。',
      options: [
        { text: '客官气度不凡，正配这匹上好的锦缎，穿出去谁不高看一眼。', strategy: '以质取胜', estimatedPrice: 18, estimatedSuccessRate: 58, risk: '价高，客人或嫌贵。' },
        { text: '给您挑匹耐穿又体面的棉绸，做工精细，价也实在。', strategy: '以实相待', estimatedPrice: 10, estimatedSuccessRate: 80, risk: '利润偏薄。' },
        { text: '听闻客官与官场有往来，这匹暗纹锦正合时宜，低调又贵重。', strategy: '投其所好', estimatedPrice: 15, estimatedSuccessRate: 66, risk: '猜错身份则尴尬。' },
      ],
    },
    {
      guestAnalysis: '这是位粗人，要结实耐穿的，不喜花哨，最忌华而不实。',
      options: [
        { text: '这匹粗布结实得能穿十年，工钱也公道，包您满意。', strategy: '以质取胜', estimatedPrice: 6, estimatedSuccessRate: 75, risk: '客单价低。' },
        { text: '给您按最划算的配：料子厚实、针脚密实，少花钱多办事。', strategy: '以实相待', estimatedPrice: 4, estimatedSuccessRate: 90, risk: '几乎无利。' },
        { text: '看您是个爽利人，再送您一副护腕，结实耐磨。', strategy: '投其所好', estimatedPrice: 5, estimatedSuccessRate: 78, risk: '赠品成本。' },
      ],
    },
    {
      guestAnalysis: '这位要给女儿办嫁妆，里外都要新的，重喜庆也重面子。',
      options: [
        { text: '嫁妆是大事，给您配一整套上好绸缎，喜庆体面，姑娘穿出去有光。', strategy: '以质取胜', estimatedPrice: 22, estimatedSuccessRate: 62, risk: '总价高，需分次付。' },
        { text: '按嫁妆的规矩给您列个单子，里外齐全，价码实在。', strategy: '以实相待', estimatedPrice: 14, estimatedSuccessRate: 82, risk: '需较多库存。' },
        { text: '恭喜令爱出阁！小店恰有新到的喜字纹样锦缎，正应景。', strategy: '投其所好', estimatedPrice: 18, estimatedSuccessRate: 70, risk: '纹样不合心意。' },
      ],
    },
    {
      guestAnalysis: '这位要赶时兴，听说长安流行窄袖，想追新潮但预算有限。',
      options: [
        { text: '时兴窄袖我们做得最地道，料子用上乘的，穿出去最是惹眼。', strategy: '以质取胜', estimatedPrice: 11, estimatedSuccessRate: 65, risk: '潮流易过时。' },
        { text: '按时兴的样子做，料子用实惠的，花小钱赶时髦。', strategy: '以实相待', estimatedPrice: 7, estimatedSuccessRate: 84, risk: '回头客少。' },
        { text: '您来得巧，这批窄袖料子刚染好，颜色正合今春。', strategy: '投其所好', estimatedPrice: 9, estimatedSuccessRate: 72, risk: '染色或有偏差。' },
      ],
    },
    {
      guestAnalysis: '这位要出远门，做行装，要耐磨、方便、还不太贵。',
      options: [
        { text: '行装马虎不得，给您用厚实的料子，针脚加固，走南闯北都经穿。', strategy: '以质取胜', estimatedPrice: 9, estimatedSuccessRate: 70, risk: '工期略长。' },
        { text: '耐磨的料子给您按行装专门做，省料也省工钱。', strategy: '以实相待', estimatedPrice: 6, estimatedSuccessRate: 85, risk: '款式朴素。' },
        { text: '出远门最怕风沙，给您搭条头巾，挡风挡沙正合用。', strategy: '投其所好', estimatedPrice: 7, estimatedSuccessRate: 76, risk: '客人未必用得上。' },
      ],
    },
  ],
  yaopu: [
    {
      guestAnalysis: '这位客官病势不重但绵延日久，图个对症与稳妥。',
      options: [
        { text: '您这症候我瞧着有七八分把握，按方抓药，三剂见分晓。', strategy: '以质取胜', estimatedPrice: 6, estimatedSuccessRate: 66, risk: '久病多疑，恐不信。' },
        { text: '先抓两剂稳妥的方子，见效再续，药钱不多，您也安心。', strategy: '以实相待', estimatedPrice: 4, estimatedSuccessRate: 82, risk: '疗程拉长。' },
        { text: '您这病我见过不少，另有一味引子，加进去事半功倍。', strategy: '投其所好', estimatedPrice: 5, estimatedSuccessRate: 72, risk: '引子不对症反误事。' },
      ],
    },
    {
      guestAnalysis: '这是位急症客，疼得厉害，要快、要灵验，价钱好商量。',
      options: [
        { text: '先给您用上好的金疮药止血定痛，火候料都是店里最好的。', strategy: '以质取胜', estimatedPrice: 8, estimatedSuccessRate: 70, risk: '好药成本高。' },
        { text: '应急的方子先顶上，药到痛减，后面再慢慢调理。', strategy: '以实相待', estimatedPrice: 5, estimatedSuccessRate: 85, risk: '治标不治本。' },
        { text: '您这伤我认得，有一味特效药，店后头还收着一份好的。', strategy: '投其所好', estimatedPrice: 7, estimatedSuccessRate: 74, risk: '药效因人而异。' },
      ],
    },
    {
      guestAnalysis: '这位是替家中长辈抓补药，重口碑、重药材成色。',
      options: [
        { text: '孝敬长辈是正理，给您配最上乘的滋补药材，成色您亲眼过目。', strategy: '以质取胜', estimatedPrice: 12, estimatedSuccessRate: 64, risk: '价高。' },
        { text: '按实惠的配法，药材成色也不差，够补又省银钱。', strategy: '以实相待', estimatedPrice: 7, estimatedSuccessRate: 83, risk: '利润薄。' },
        { text: '听说府上老人畏寒？这批老山参正合用，给您留一份。', strategy: '投其所好', estimatedPrice: 10, estimatedSuccessRate: 70, risk: '留货占库。' },
      ],
    },
    {
      guestAnalysis: '这位是来调理身子的，不急不躁，讲究细水长流。',
      options: [
        { text: '调理贵在坚持，给您开副温补的方子，吃满一月自见成效。', strategy: '以质取胜', estimatedPrice: 9, estimatedSuccessRate: 68, risk: '需复诊跟进。' },
        { text: '先试一旬的方子，花费不多，有效再续。', strategy: '以实相待', estimatedPrice: 5, estimatedSuccessRate: 84, risk: '见效慢。' },
        { text: '您这体质我瞧着有门道，配个引子，调理事半功倍。', strategy: '投其所好', estimatedPrice: 7, estimatedSuccessRate: 73, risk: '玄乎反招疑。' },
      ],
    },
    {
      guestAnalysis: '这是位老病号，看过不少大夫，最怕被糊弄，认准实在。',
      options: [
        { text: '您这病根我给您细细捋，用最对症的药，不糊弄人。', strategy: '以质取胜', estimatedPrice: 8, estimatedSuccessRate: 70, risk: '诊断费时。' },
        { text: '按老方子抓，价码实在，药也不掺假，您放心。', strategy: '以实相待', estimatedPrice: 5, estimatedSuccessRate: 86, risk: '利润薄。' },
        { text: '您从前吃的那副方子我见过，有处可改，改后疗效更佳。', strategy: '投其所好', estimatedPrice: 6, estimatedSuccessRate: 74, risk: '改方有风险。' },
      ],
    },
  ],
};

/** 随机抽一套三选项（纯函数；rng 可注入） */
export function pickDialogueOptionSet(shopType: ShopType, rng: () => number = Math.random): DialogueOptionSetTemplate {
  const pool = DIALOGUE_OPTION_TEMPLATES[shopType] ?? DIALOGUE_OPTION_TEMPLATES.jiulou;
  const idx = Math.min(Math.floor(rng() * pool.length), pool.length - 1);
  return pool[idx]!;
}
