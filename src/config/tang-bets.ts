/**
 * 《我在唐朝当掌柜》谢七彩头配置（TANG-ADD-001 模块五）
 * 彩头："彩头：谢七好赌，常与人下彩头。输了认栽，赢了翻倍——但别让他摸清你的底。"
 * 4 赌约逐字：净利之赌 十两 净利>50 / 反噬之赌 五两 今日反噬 / 拒客之赌 十五两 拒客≥1 /
 * 贵客之赌 二十两 有特殊客+bonusOnLose 西市情报。
 * 纯数据，不依赖 store；触发/结算纯函数在 systems/tang-bets.ts。
 */
import type { TangBet } from '@/types/tang-manager';

/** 谢七彩头全量（checkBetOffer 随机抽 1 个；谢七登场+未触发+30% 概率出现） */
export const TANG_BETS: readonly TangBet[] = [
  {
    id: 'bet-net-profit',
    title: '净利之赌',
    proposal: '谢七叼着根草茎，眯眼一笑：「掌柜的，赌今日净利过五十两。输了，这十两归我；赢了，我双倍奉还。」',
    stake: 10,
    condition: { minNetProfit: 50 },
    win: { favorGain: 10, silverWin: 20 },
    loseMessage: '谢七嗤笑一声，把十两银子拢进袖里：「掌柜的，手气不行啊。」',
  },
  {
    id: 'bet-backlash',
    title: '反噬之赌',
    proposal: '谢七压低声音：「听说你会那门窥心的把戏？赌你今天用「通晓人心」撞一回霉头。五两银子，敢不敢？」',
    stake: 5,
    condition: { backlashToday: true },
    win: { favorGain: 10, silverWin: 10 },
    loseMessage: '谢七把五两银子在指尖转了转：「啧，没撞上？那算你走运，这钱归我了。」',
  },
  {
    id: 'bet-reject',
    title: '拒客之赌',
    proposal: '谢七拍拍你的肩：「掌柜的，做生意的哪有不应酬的？赌你今天拒了哪位客人。十五两，接不接？」',
    stake: 15,
    condition: { rejectedToday: true },
    win: { favorGain: 10, silverWin: 30 },
    loseMessage: '谢七摇摇头：「一个都没拒？你这也太好说话了。十五两，谢某笑纳。」',
  },
  {
    id: 'bet-noble',
    title: '贵客之赌',
    proposal: '谢七神秘兮兮：「今日有贵客登门。赌你店里来了一位稀客，二十两。」输了，他还附赠一条西市的情报。',
    stake: 20,
    condition: { specialGuestToday: true },
    win: { favorGain: 10, silverWin: 40 },
    loseMessage: '谢七收了银子，压低声音：「愿赌服输。不过——西市最近有批来路不明的货，你留意着点。」',
    bonusOnLose: '西市情报',
  },
];

/** id → 赌约 索引 */
export const TANG_BET_MAP: Readonly<Record<string, TangBet>> = Object.fromEntries(
  TANG_BETS.map((b) => [b.id, b])
);

/** 赌约查询（id → 定义；不存在返回 null） */
export function tangBetById(id: string): TangBet | null {
  return TANG_BET_MAP[id] ?? null;
}
