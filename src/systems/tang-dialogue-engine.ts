/**
 * 《我在唐朝当掌柜》接待对话引擎（模块二 2.1）
 * 状态机：greeting → player_response → guest_reply → recommend → guest_feedback → follow_up → resolution
 * 纯函数：不持有状态、不调用 store；rng 可注入。
 * 心情系统：愉悦 30% / 平淡 50% / 烦躁 15% / 挑剔 5%。
 */
import { GUEST_REPLIES, RESPONSE_STYLES, pickTemplate } from '@/config/tang-dialogue-templates';
import type {
  DialogueMessage,
  DialoguePhase,
  DialogueState,
  GuestMood,
  MoodConfig,
  ResponseEffect,
  ResponseStyle,
} from '@/types/tang-dialogue';
import type { Guest, ShopType } from '@/types/tang-manager';

/** 心情配置（权重千分比：愉悦 300 / 平淡 500 / 烦躁 150 / 挑剔 50） */
export const MOOD_CONFIGS: Record<GuestMood, MoodConfig> = {
  joyful: { id: 'joyful', label: '愉悦', icon: '😊', weight: 300, closeBonus: 10, patienceDecayMul: 0.8, satisfactionMul: 1, styleHint: '心情舒畅，容易成交，话里带笑' },
  calm: { id: 'calm', label: '平淡', icon: '😐', weight: 500, closeBonus: 0, patienceDecayMul: 1, satisfactionMul: 1, styleHint: '神色如常，不冷不热' },
  irritated: { id: 'irritated', label: '烦躁', icon: '😟', weight: 150, closeBonus: -10, patienceDecayMul: 1.5, satisfactionMul: 1, styleHint: '不耐烦，耐心下降快，容易不满' },
  picky: { id: 'picky', label: '挑剔', icon: '🤨', weight: 50, closeBonus: -5, patienceDecayMul: 1.2, satisfactionMul: 2, styleHint: '要求极高，成交后满意度翻倍' },
};

/** 心情列表（按权重生成用） */
const MOOD_IDS: GuestMood[] = ['joyful', 'calm', 'irritated', 'picky'];

/** 随机抽取心情（纯函数；按权重） */
export function pickGuestMood(rng: () => number = Math.random): GuestMood {
  const total = MOOD_IDS.reduce((s, m) => s + MOOD_CONFIGS[m].weight, 0);
  let roll = rng() * total;
  for (const m of MOOD_IDS) {
    roll -= MOOD_CONFIGS[m].weight;
    if (roll < 0) return m;
  }
  return 'calm';
}

/** 心情中文标签 */
export function moodLabel(mood: GuestMood): string {
  return MOOD_CONFIGS[mood].label;
}

/** 心情图标 */
export function moodIcon(mood: GuestMood): string {
  return MOOD_CONFIGS[mood].icon;
}

/** 合法阶段转移（纯函数；非法转移返回 false） */
export const DIALOGUE_TRANSITIONS: Readonly<Record<DialoguePhase, readonly DialoguePhase[]>> = {
  greeting: ['player_response'],
  player_response: ['guest_reply'],
  guest_reply: ['recommend'],
  recommend: ['guest_feedback'],
  guest_feedback: ['follow_up', 'resolution'],
  follow_up: ['resolution', 'guest_feedback'],
  resolution: [],
};

/** 是否允许从 from 转移到 to（纯函数） */
export function canTransition(from: DialoguePhase, to: DialoguePhase): boolean {
  return DIALOGUE_TRANSITIONS[from]?.includes(to) ?? false;
}

/** 开始一段对话（纯函数；初始心情随机） */
export function startDialogue(guest: Guest, shopType: ShopType, rng: () => number = Math.random): DialogueState {
  return {
    guestId: guest.id,
    guestName: guest.name,
    shopType,
    phase: 'greeting',
    mood: pickGuestMood(rng),
    favor: 50,
    trust: 50,
    turn: 0,
    history: [],
    preferenceRevealed: guest.preferenceRevealed ?? false,
  };
}

/** 追加消息（纯函数；返回新状态） */
export function pushDialogueMessage(state: DialogueState, msg: DialogueMessage): DialogueState {
  return { ...state, history: [...state.history, msg] };
}

/** 推进阶段（纯函数；自动校验合法转移，非法则停留在原阶段） */
export function advanceDialogue(state: DialogueState, to: DialoguePhase): DialogueState {
  if (!canTransition(state.phase, to)) return state;
  return { ...state, phase: to, turn: state.turn + 1 };
}

/** 应用玩家回应方式（2.1：好感/信任变动 + 实在报价标记） */
export function applyResponseStyle(state: DialogueState, style: ResponseStyle): DialogueState {
  const eff = RESPONSE_STYLES.find((e) => e.style === style);
  if (!eff) return state;
  return {
    ...state,
    favor: clamp(state.favor + eff.favorDelta, 0, 100),
    trust: clamp(state.trust + eff.trustDelta, 0, 100),
    priceSensitive: style === 'honest_price' ? true : state.priceSensitive,
  };
}

/** 玩家回应选项效果表（UI 渲染用） */
export function responseEffects(): ResponseEffect[] {
  return RESPONSE_STYLES.map((e) => ({
    style: e.style,
    label: e.label,
    hint: e.hint,
    favorDelta: e.favorDelta,
    trustDelta: e.trustDelta,
    closeBonus: e.closeBonus,
    profitCapPenalty: e.profitCapPenalty,
    suitedFor: e.style === 'warm' ? ['normal', 'observe'] : e.style === 'professional' ? ['big_order', 'special'] : ['normal', 'help'],
  }));
}

/** 客人回应模板插值（纯函数；按心情抽取） */
export function buildGuestReply(mood: GuestMood, guestName: string, rng: () => number = Math.random): string {
  const tpl = pickTemplate(GUEST_REPLIES[mood], rng);
  return tpl.split('{guestName}').join(guestName);
}

/** 心情对成交率的影响（百分点；纯函数） */
export function moodCloseBonus(mood: GuestMood): number {
  return MOOD_CONFIGS[mood].closeBonus;
}

/** 心情对满意度的影响（倍率；挑剔 ×2，纯函数） */
export function moodSatisfactionMul(mood: GuestMood): number {
  return MOOD_CONFIGS[mood].satisfactionMul;
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}
