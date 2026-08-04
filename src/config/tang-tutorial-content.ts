/**
 * 《我在唐朝当掌柜》新手引导（TANG-TUT-001 模块一）手札文案内容
 * 25 条文案：以「家传手札」为载体的祖辈家书，亲切但有长辈分寸，不用现代词汇；
 * 仅 first_expiry 一条不走手札弹窗——以阿昭气泡呈现（kind='azhao'），其余全部
 * kind='handbook'（家传手札弹窗，title 统一「家传手札」）。
 * 纯数据，不依赖 store；触发时机与接线由 systems/store 侧实现（T2 起）。
 */
import { TANG_TUTORIAL_IDS, type TangTutorialId } from '@/config/tang-tutorial-ids';

/** 呈现方式：handbook 家传手札弹窗（默认）/ azhao 阿昭气泡（不占手札弹窗） */
export type TangTutorialKind = 'handbook' | 'azhao';

/** 单条引导内容定义 */
export interface TangTutorialContent {
  /** 引导 id（与 tang-tutorial-ids 一致） */
  id: TangTutorialId;
  /** 展示标题（手札正文统一「家传手札」；阿昭气泡为「阿昭」） */
  title: string;
  /** 正文文案（家书口吻；first_expiry 为阿昭口吻） */
  body: string;
  /** 呈现方式 */
  kind: TangTutorialKind;
}

/** 25 条手札文案全量（key=引导 id；Record 保证 25 键齐全，缺一条即编译报错） */
export const TANG_TUTORIAL_CONTENT: Record<TangTutorialId, TangTutorialContent> = {
  WELCOME: {
    id: 'WELCOME',
    title: '家传手札',
    kind: 'handbook',
    body:
      '吾孙承业，此札既开，便是陆家一脉相承。店内十二件家什——我、接待、货架、账本、伙计、钱庄、长安舆图、门路、镖队、巍明楼、手札录、成就——皆自下栏点入，各有其用。清晨有卦象占候，打烊有今日要务，须记在心。客流时多时少，本属常事；待客之策有亲力亲为、择要接待、全托伙计三档，随势而变，莫要一根筋到底。',
  },
  FIRST_STRATEGY: {
    id: 'FIRST_STRATEGY',
    title: '家传手札',
    kind: 'handbook',
    body:
      '待客之策有三。亲力亲为：一客一客地接，银钱最稳，然最耗心神；择要接待：拣那值钱的、识货的先待，其余交由旁人，省力而所得不减；全托伙计：诸事交与手下，你只坐镇中堂，省心，却要防伙计懈怠。精力不足二十，便是身子乏了，莫要硬撑——且歇一歇，让伙计顶上。',
  },
  FIRST_GUEST: {
    id: 'FIRST_GUEST',
    title: '家传手札',
    kind: 'handbook',
    body:
      '第一位客人既至，莫慌。待客之道有六：正常接待，中规中矩，最是稳当；通晓人心，可窥其所想，然用之过勤，恐有反噬；推荐货品，投其所好，所得更丰；闲聊几句，或得长安城里的消息；赠些小礼，客人心喜，下回还来；遇上难缠的，婉言谢绝亦是本事。六样轮转着用，店里的气氛便活了。',
  },
  FIRST_MIND_READ: {
    id: 'FIRST_MIND_READ',
    title: '家传手札',
    kind: 'handbook',
    body:
      '通晓人心，是陆家祖传的看家本事，能教你看穿客人心里想买什么。只是天下没有白得的便宜——用多了，心神耗得厉害，偶有反噬，看岔了人心，反惹客怨。故此技当省着使，一日之内，用到紧要处便收手。',
  },
  FIRST_PREORDER: {
    id: 'FIRST_PREORDER',
    title: '家传手札',
    kind: 'handbook',
    body:
      '接了预购单子，便是一诺千金。定金既收，须早早备货，将货架上的东西为这单子预留出来，莫要再卖与旁人。货齐了便交货，尾款入账，声望见长。若是误了期限，不仅定金要退，还要赔上名声——陆家的招牌，从不在「失信」二字上折损。',
  },
  FIRST_SETTLE: {
    id: 'FIRST_SETTLE',
    title: '家传手札',
    kind: 'handbook',
    body:
      '打烊结账，是每日的头等大事。账目分四块：基础收益、五单消费、当日支出、净收益，一一核对，方知今日盈亏。莫嫌麻烦——账目清了，心里才亮堂；心亮了，路才走得远。',
  },
  FIRST_SHELF: {
    id: 'FIRST_SHELF',
    title: '家传手札',
    kind: 'handbook',
    body:
      '货架是铺子的脸面。货会陈，久了便损，须常翻看，将陈货早出手；量大时可有批量折扣，薄利多销亦是门道。籴粜契是与人订期货，先收定金，到期交货；加工则是庖制、染织、炮制，把粗货变成细货，价高一筹。库房不够，还可扩建，只是要花钱花时日。货架上的学问，够你琢磨半辈子。',
  },
  FIRST_STAFF: {
    id: 'FIRST_STAFF',
    title: '家传手札',
    kind: 'handbook',
    body:
      '伙计是铺子的手脚，须善待。轮值排班，劳逸有度，莫让一人连轴转——过劳了，人是要垮的。闲时多走动，与伙计说说家常，交情深了，做事也尽心。若真有不中用的，遣散也是常理；只阿昭不同——那是你祖上就跟着陆家的老人，任谁来，都动不得他。',
  },
  FIRST_LEDGER: {
    id: 'FIRST_LEDGER',
    title: '家传手札',
    kind: 'handbook',
    body:
      '账本记着铺子的一文一厘，是商家的命根子。收支明细、今日盈亏、四栏账目、负债多寡，皆在此处。负债不是洪水猛兽，只要心里有数，按月还清，便伤不得根基。怕只怕糊里糊涂，账目不清，到月底连亏了都不知——那才是要命的事。',
  },
  FIRST_BANK: {
    id: 'FIRST_BANK',
    title: '家传手札',
    kind: 'handbook',
    body:
      '钱庄是长安城里通财的地方。现银随身，飞钱可寄，出了远门也不怕露财；信用是商家的脸面，存借皆有规矩。手头紧时，可借可贷，月息几分要算清；每月初一，还有暗标可投，价高者得，是财大气粗之人玩的把戏。钱庄里走一遭，便知银钱流转的门道。',
  },
  FIRST_MAP: {
    id: 'FIRST_MAP',
    title: '家传手札',
    kind: 'handbook',
    body:
      '长安舆图分三层，由内而外，一坊一市皆在图上。跑商买卖，须得先探明道路，看准价差；未探明之处，罩着迷雾，要亲自走一遭才散得开。舆图在手，天下在胸——莫困于一坊一店，长安大得很。',
  },
  FIRST_FORWARD_CONTRACT: {
    id: 'FIRST_FORWARD_CONTRACT',
    title: '家传手札',
    kind: 'handbook',
    body:
      '籴粜契，是与人立约买期货。签契要先付三成定金，到期按约定交货；价钱是定死的，市价涨了跌了，都与你无关。这本是稳当的买卖，只是定金一付，便不可反悔——故须量力而签，莫要把身家全押在一张契上。',
  },
  FIRST_PROCESSING: {
    id: 'FIRST_PROCESSING',
    title: '家传手札',
    kind: 'handbook',
    body:
      '光卖粗货，利薄；把粗货变成细货，利便厚了。庖制、染织、炮制，是给货物添手艺；食盒、锦匣、药囊，是把几样货并成一样卖。加工要费时日、费银两，但成品的价钱，往往翻上几番。手艺人到哪都是香的，陆家当年便是靠这一手起家的。',
  },
  FIRST_EXPIRY: {
    id: 'FIRST_EXPIRY',
    title: '阿昭',
    kind: 'azhao',
    body:
      '掌柜的，货架上有几样货放得久了，已经走了味、落了灰——再不处置，怕是要砸在手里。老话说，货卖当时，过了时候，再好的东西也成了陈货。您看是折价出了，还是尽早用了它？',
  },
  FIRST_REGULAR: {
    id: 'FIRST_REGULAR',
    title: '家传手札',
    kind: 'handbook',
    body:
      '店里评了二分，虽说不高，却是头一遭有人认可。长安城里，回头客最是金贵——他们认你的店，认你的人，往后自会常来。客人的口碑，比金银更实在；把每一位客人都当熟客待，店里的名声便立起来了。',
  },
  FIRST_WEEKLY_TASK: {
    id: 'FIRST_WEEKLY_TASK',
    title: '家传手札',
    kind: 'handbook',
    body:
      '手札上新添了周间要务——七日为期，一旬一换。要务列的是这一周该办的事，办成了有赏，办不成也不罚，只当是给自个儿立的章程。心里有个念想，日子便有了奔头；七日之期，眨眼便过，莫要蹉跎。',
  },
  DEBT_CLEARED: {
    id: 'DEBT_CLEARED',
    title: '家传手札',
    kind: 'handbook',
    body:
      '债清之日，便是新局之时。祖上留下的那笔旧债，你竟一朝还清了——陆家的门楣，从此又亮堂了几分。无债一身轻，往后赚的每一文，都是自己的。只是记着：今日的清债之喜，莫要化作明日的挥霍之由。',
  },
  FIRST_EMPLOYEE_EVENT: {
    id: 'FIRST_EMPLOYEE_EVENT',
    title: '家传手札',
    kind: 'handbook',
    body:
      '伙计多了，便有人情世故。有伙计生了嫌隙，有伙计生了病，有伙计想另谋高就——都在常理之中。掌柜的与伙计相处，要有分寸：赏罚分明，恩威并施；亲近而不失体统，宽厚而不失原则。人心换人心，你待伙计三分好，伙计便还你七分力。',
  },
  FIRST_SHEN_HINT: {
    id: 'FIRST_SHEN_HINT',
    title: '家传手札',
    kind: 'handbook',
    body:
      '你的名声已传出了坊间，进了长安城里大人物的耳朵。沈家——那是长安城里手眼通天的人家，与陆家祖上曾有旧谊。如今声望既起，想来用不了多久，沈家的人便会登门。届时如何应对，你须心里有数。',
  },
  FIRST_POLITICS: {
    id: 'FIRST_POLITICS',
    title: '家传手札',
    kind: 'handbook',
    body:
      '巍明楼是长安城里议政论事的地方，寻常商家轻易进不得。楼中每月有政令颁布，六派系各怀心思，明争暗斗不断。上官家的公子在楼中颇有分量，若得其青眼，铺子的前程便不可限量。只是朝堂水深，站队须慎——陆家世代经商，从不轻押一注。',
  },
  FIRST_CARAVAN: {
    id: 'FIRST_CARAVAN',
    title: '家传手札',
    kind: 'handbook',
    body:
      '镖队一成，货物便可走远路，不再困守一坊。行前须定路线——哪条道近，哪条道稳，各有讲究；道上的绿通关卡，打点好了，一路通畅。骡车虽慢，胜在稳当；马队虽快，却招眼。头一趟，宁可慢些，也别折了本钱。',
  },
  FIRST_DEPOSIT: {
    id: 'FIRST_DEPOSIT',
    title: '家传手札',
    kind: 'handbook',
    body:
      '银钱放在手边，终是不稳。钱庄可存可贷——存款月息半厘，聊胜于无；急用银子时，抵押借贷、高利贷也能救急，只是利钱不轻。手头宽裕时存上一笔，也算给家业添个底。',
  },
  FIRST_TRADE: {
    id: 'FIRST_TRADE',
    title: '家传手札',
    kind: 'handbook',
    body:
      '跑商一道，贱买贵卖，赚的是路程与眼力。选好买点、卖点与货色，看准商路与绿通，骡马驮着货走一遭，回来自有进账。头一趟不必贪多，探探路数要紧。',
  },
  FIRST_SCHEDULE: {
    id: 'FIRST_SCHEDULE',
    title: '家传手札',
    kind: 'handbook',
    body:
      '伙计轮值，早班晚班各有其宜。排班得当，店里昼夜都有人手；安排不周，过劳的伙计迟早要闹脾气。莫让一人连轴转，休沐之日该休则休。',
  },
  FIRST_HIRE: {
    id: 'FIRST_HIRE',
    title: '家传手札',
    kind: 'handbook',
    body:
      '阿昭一人终究分身乏术。雇上一位称手的伙计，货架有人理、灶上有人忙，接待客人也从容些。月钱虽是一笔开销，可人手齐了，生意才做得开。',
  },
};

/** 25 条文案列表（严格按 TANG_TUTORIAL_IDS 顺序；遍历/渲染共用，保证与 id 顺序一致） */
export const TANG_TUTORIAL_CONTENT_LIST: readonly TangTutorialContent[] = TANG_TUTORIAL_IDS.map(
  (id) => TANG_TUTORIAL_CONTENT[id]
);

/** 按 id 查文案（不存在返回 null；UI 层先判空再渲染） */
export function tangTutorialById(id: string): TangTutorialContent | null {
  return TANG_TUTORIAL_CONTENT[id as TangTutorialId] ?? null;
}
