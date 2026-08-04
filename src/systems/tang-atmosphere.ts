/**
 * 《我在唐朝当掌柜》气氛与连锁系统（TANG-RCP-001 模块三 + 模块四留言簿触发）
 * 纯函数：updateAtmosphere / checkEmotionContagion / updatePatience / mergeGuests / checkGuestBookTrigger。
 * 规则摘要：
 * - updateAtmosphere（用户 3.1 逐字）：夸奖+10 / 投诉-15 / 当场离开-8 / 解决投诉+5；clamp 0-100。
 *   影响消费意愿：高气氛（≥70）消费+10%、低气氛（<30）消费-15%（settleDay 或 handleGuest 应用，注释）。
 * - checkEmotionContagion（用户 3.1）：当众投诉 30% 概率其他客人走掉（当日消费归零）；
 *   当众夸奖 其他客人消费意愿+10%；返回受影响客人列表。
 * - updatePatience（用户 3.1）：上一位接待每超 30s（或每轮操作）下一位-5；归零离开+差评；
 *   耐心<30 消费意愿-20%。
 * - mergeGuests（用户 3.4 逐字）：同类型+耐心都>50；一次接待两人效率翻倍、每人消费 8 折、
 *   精力×1.5；双命中偏好额外+10 气氛。
 * - checkGuestBookTrigger（模块四）：满意度≥80 且累计消费≥50（praise）/回头客第三次（story）/
 *   特殊事件客（event）；内容按类型与故事标签生成。
 * 可测性：rng 可选参数（默认 Math.random）。
 */
import { guestBookContentFor } from '@/config/tang-guest-book-content';
import { checkPreferenceMatch } from '@/systems/tang-guest-preference';
import type {
  AtmosphereEvent,
  AtmosphereResult,
  ContagionResult,
  Guest,
  GuestBookTriggerResult,
  MergeResult,
  PatienceResult,
  TangGameState,
} from '@/types/tang-manager';

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** 气氛事件增减表（用户 3.1 逐字） */
const ATMOSPHERE_DELTA: Record<AtmosphereEvent, number> = {
  praise: 10,
  complaint: -15,
  leave: -8,
  resolve_complaint: 5,
};

/** 气氛影响消费意愿阈值（工程定值，注释）：≥70 高气氛 +10% / <30 低气氛 -15% */
export const ATMOSPHERE_HIGH = 70;
export const ATMOSPHERE_LOW = 30;
export const ATMOSPHERE_HIGH_FACTOR = 1.1;
export const ATMOSPHERE_LOW_FACTOR = 0.85;

/**
 * 更新气氛（用户 3.1 逐字：夸奖+10/投诉-15/当场离开-8/解决投诉+5；clamp 0-100）。
 * 返回新气氛与变动量；store 负责持久化与结算应用（消费意愿因子见 settleDay）。
 */
export function updateAtmosphere(
  event: AtmosphereEvent,
  state: { shopAtmosphere?: number }
): AtmosphereResult {
  const delta = ATMOSPHERE_DELTA[event];
  const shopAtmosphere = clamp((state.shopAtmosphere ?? 50) + delta, 0, 100);
  return { shopAtmosphere, delta };
}

/**
 * 情绪传染（用户 3.1）：
 * - complaint 当众投诉：30% 概率其他客人走掉（walkOutIds；当日消费归零）；
 * - praise 当众夸奖：其他客人消费意愿 +10%（boostIds；consumptionModifier ×1.1）。
 */
export function checkEmotionContagion(
  guest: Guest,
  eventType: 'complaint' | 'praise',
  state: { guests: readonly Guest[] },
  rng: () => number = Math.random
): ContagionResult {
  const others = state.guests.filter((g) => g.id !== guest.id && !g.handled);
  if (eventType === 'complaint') {
    // 30% 概率其他客人（全部未接待）当场走掉
    if (rng() < 0.3) {
      return { eventType, walkOutIds: others.map((g) => g.id), boostIds: [] };
    }
    return { eventType, walkOutIds: [], boostIds: [] };
  }
  // 当众夸奖：其余客人消费意愿 +10%
  return { eventType, walkOutIds: [], boostIds: others.map((g) => g.id) };
}

/**
 * 排队耐心（用户 3.1）：上一位接待每超 30s（或每轮操作）下一位-5；
 * 归零 → zeroed=true（离开 + 差评，评分-0.02 由 settlement 按 review 汇总）；
 * 耐心<30 → lowPatience=true，消费意愿 -20%（consumptionModifier 0.8）。
 */
export function updatePatience(
  guest: Guest,
  waitTime: number,
  rng: () => number = Math.random
): PatienceResult {
  const rounds = Math.max(1, Math.ceil((waitTime > 0 ? waitTime : 1) / 30));
  const patience = clamp((guest.patience ?? 100) - 5 * rounds, 0, 100);
  const zeroed = patience <= 0;
  const lowPatience = !zeroed && patience < 30;
  const consumptionModifier = zeroed ? 0 : lowPatience ? 0.8 : 1;
  return { patience, zeroed, lowPatience, consumptionModifier };
}

/**
 * 拼桌并单（用户 3.4 逐字：同类型+耐心都>50；一次接待两人效率翻倍、每人消费 8 折、
 * 精力×1.5；双命中偏好额外+10 气氛）。income = (A.base + B.base) × 0.8。
 */
export function mergeGuests(guestA: Guest, guestB: Guest): MergeResult {
  if (guestA.type !== guestB.type) {
    return { ok: false, reason: '两位客人性情不同，不便拼桌', income: 0, energyConsumed: 0, doubleHit: false, atmosphereBonus: 0, content: '' };
  }
  if ((guestA.patience ?? 100) <= 50 || (guestB.patience ?? 100) <= 50) {
    return { ok: false, reason: '客人久候不耐，不愿拼桌', income: 0, energyConsumed: 0, doubleHit: false, atmosphereBonus: 0, content: '' };
  }
  const doubleHit =
    checkPreferenceMatch(guestA, 'normal').matched === true &&
    checkPreferenceMatch(guestB, 'normal').matched === true;
  return {
    ok: true,
    income: round1((guestA.baseConsumption + guestB.baseConsumption) * 0.8),
    energyConsumed: 7.5, // 正常接待精力 5 × 1.5
    doubleHit,
    atmosphereBonus: doubleHit ? 10 : 0,
    content: `两位${guestA.type === 'big_order' ? '大主顾' : '客人'}相谈甚欢，索性拼作一桌，一次伺候了个痛快。`,
  };
}

/**
 * 留言簿触发（模块四；用户 4.1 逐字）：
 * - praise：满意度≥80 且累计消费≥50；
 * - story：回头客第三次（visitCount≥3）；
 * - event：特殊事件客（胡商/进士/赵管家，SPECIAL_GUEST_NAMES）。
 * 内容按类型与故事标签生成（config/tang-guest-book-content.ts）。
 */
export function checkGuestBookTrigger(
  guest: Guest,
  _state: Pick<TangGameState, 'guestBook'>
): GuestBookTriggerResult {
  const satisfaction = guest.satisfaction ?? 50;
  const totalSpent = guest.totalSpent ?? 0;
  if (satisfaction >= 80 && totalSpent >= 50) {
    return { type: 'praise', content: guestBookContentFor(guest, 'praise') };
  }
  if ((guest.visitCount ?? 1) >= 3) {
    return { type: 'story', content: guestBookContentFor(guest, 'story') };
  }
  if (guest.name === '胡商' || guest.name === '进士' || guest.name === '赵管家') {
    return { type: 'event', content: guestBookContentFor(guest, 'event') };
  }
  return { type: null, content: '' };
}
