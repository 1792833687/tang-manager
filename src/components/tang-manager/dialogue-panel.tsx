/**
 * 接待对话面板（模块二 2.2 / 模块一 三店特色接待 / 模块三 店员提醒）
 * 对话式布局：顶部客人（头像+姓名+类型+心情）→ 中部对话区（客人左气泡/玩家右按钮/历史滚动）
 * → 底部当前可用操作。阶段由对话引擎状态机驱动：
 *   greeting → player_response → guest_reply → recommend → guest_feedback → (follow_up) → resolution
 * 三店流程完全独立：酒楼宴席（菜品搭配+赠菜/评菜）/ 布庄量身（面料款式+量体/样衣/换料）
 * / 药铺问诊（主辅药配伍+把脉/服药建议）。AI 生成对话不可用时自动降级预设模板。
 * 全部 ANCIENT 令牌；不直接写 store 数值（resolution 经 store.completeDialogueReception 落账）。
 */
'use client';
import { useEffect, useMemo, useState } from 'react';
import { GUEST_TYPE_LABEL } from '@/config/tang-guest-content';
import { OPENING_LINES, pickTemplate } from '@/config/tang-dialogue-templates';
import {
  CLOTHIER_FABRICS,
  CLOTHIER_STYLES,
  HERB_OPTIONS,
  TAVERN_DISHES,
  matchSymptom,
} from '@/config/tang-reception-content';
import { useTangManagerStore } from '@/stores/tang-manager';
import { ANCIENT } from '@/theme/tokens';
import { OperationBar } from '@/components/operation-bar';
import {
  applyResponseStyle,
  buildGuestReply,
  moodIcon,
  moodLabel,
  pushDialogueMessage,
  responseEffects,
  startDialogue,
} from '@/systems/tang-dialogue-engine';
import { generateGuestGreeting, generateGuestReply } from '@/systems/tang-narrator';
import { handleClothierReception, type ClothierPlan } from '@/systems/tang-reception-clothier';
import { handleHerbalistReception, type HerbalistPlan } from '@/systems/tang-reception-herbalist';
import { handleTavernReception, type TavernPlan } from '@/systems/tang-reception-tavern';
import { checkStaffReminders } from '@/systems/tang-staff-reminders';
import type { DialogueMessage, DialogueState, ShopReceptionPlan, ShopReceptionResult, StaffReminder } from '@/types/tang-dialogue';
import type { Guest, ShopType } from '@/types/tang-manager';

/** 打字机逐字显示（30ms/字） */
function useTypewriter(text: string, speed = 30): string {
  const [out, setOut] = useState('');
  useEffect(() => {
    let idx = 0;
    setOut('');
    const timer = window.setInterval(() => {
      idx += 1;
      setOut(text.slice(0, idx));
      if (idx >= text.length) window.clearInterval(timer);
    }, speed);
    return () => window.clearInterval(timer);
  }, [text, speed]);
  return out;
}

const SHOP_ICON: Record<ShopType, string> = { jiulou: '🍶', buzhuang: '🧵', yaopu: '🌿' };

function Bubble({ role, content }: { role: DialogueMessage['role']; content: string }): React.ReactElement {
  const isGuest = role === 'guest';
  return (
    <div className={`flex ${isGuest ? 'justify-start' : 'justify-end'}`}>
      <div
        className="max-w-[80%] rounded-xl px-3 py-2 text-sm leading-6"
        style={{
          backgroundColor: isGuest ? ANCIENT.background : ANCIENT.primary,
          color: isGuest ? ANCIENT.text : '#FFFFFF',
          border: isGuest ? `1px solid ${ANCIENT.border}` : 'none',
        }}
      >
        {content}
      </div>
    </div>
  );
}

/** 店员提醒气泡（模块三 3.2：头像 + 气泡 + 采纳/忽略） */
function StaffReminderBubble({
  reminder,
  onAdopt,
  onIgnore,
}: {
  reminder: StaffReminder;
  onAdopt: () => void;
  onIgnore: () => void;
}): React.ReactElement {
  return (
    <div className="flex items-start gap-2 rounded-xl px-3 py-2" style={{ backgroundColor: '#F0E6D2', border: `1px solid ${ANCIENT.gold}` }}>
      <span className="text-xl">🗣️</span>
      <div className="min-w-0 flex-1">
        <div className="text-xs font-bold tracking-widest" style={{ color: ANCIENT.border }}>
          {reminder.staff}提醒
        </div>
        <p className="mt-1 text-xs leading-5" style={{ color: ANCIENT.text }}>{reminder.message}</p>
        <div className="mt-1.5 flex gap-2">
          <button
            type="button"
            onClick={onAdopt}
            className="rounded px-3 py-1 text-xs font-bold tracking-widest"
            style={{ backgroundColor: ANCIENT.primary, color: '#FFFFFF' }}
          >
            采纳
          </button>
          <button
            type="button"
            onClick={onIgnore}
            className="rounded px-3 py-1 text-xs tracking-widest"
            style={{ backgroundColor: 'transparent', color: ANCIENT.secondary, border: `1px solid ${ANCIENT.border}` }}
          >
            忽略
          </button>
        </div>
      </div>
    </div>
  );
}

/** 通用小按钮 */
function Btn({
  label,
  onClick,
  disabled = false,
  color = ANCIENT.primary,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  color?: string;
}): React.ReactElement {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="min-h-10 rounded-lg px-3 py-2 text-xs font-bold tracking-widest transition-transform active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-40"
      style={{ backgroundColor: color, color: '#FFFFFF' }}
    >
      {label}
    </button>
  );
}

export function DialoguePanel({ guest }: { guest: Guest }): React.ReactElement {
  const shopType = useTangManagerStore((s) => s.shopType ?? 'jiulou');
  const shopItems = useTangManagerStore((s) => s.shopItems);
  const setGuestMood = useTangManagerStore((s) => s.setGuestMood);
  const appendDialogue = useTangManagerStore((s) => s.appendDialogue);
  const clearDialogue = useTangManagerStore((s) => s.clearDialogue);
  const completeDialogueReception = useTangManagerStore((s) => s.completeDialogueReception);

  const [state, setState] = useState<DialogueState | null>(null);
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);
  const [reminder, setReminder] = useState<StaffReminder | null>(null);
  const [legacy, setLegacy] = useState(false);
  const [result, setResult] = useState<ShopReceptionResult | null>(null);
  const [retries, setRetries] = useState(0);

  // 三店计划选择
  const [dishIds, setDishIds] = useState<string[]>([]);
  const [giftDishId, setGiftDishId] = useState<string | undefined>(undefined);
  const [judge, setJudge] = useState(false);
  const [fabricId, setFabricId] = useState<string>('cotton');
  const [styleId, setStyleId] = useState<string>('plain');
  const [extraOp, setExtraOp] = useState<ClothierPlan['extraOp']>(undefined);
  const [mainHerbId, setMainHerbId] = useState<string>('renshen');
  const [adjuvantIds, setAdjuvantIds] = useState<string[]>([]);
  const [guideId, setGuideId] = useState<string | undefined>(undefined);
  const [pulse, setPulse] = useState(false);
  const [advice, setAdvice] = useState(false);

  const mood = state?.mood ?? 'calm';
  const typedOut = useTypewriter(typed);
  const typingDone = typedOut.length >= typed.length && typed.length > 0;

  /** 状态机推进（push 消息 + 换阶段） */
  const transition = (next: DialogueState, text?: string): void => {
    setState(next);
    if (text !== undefined) setTyped(text);
  };

  /** 开始对话：随机心情 + 生成开场白（AI 或模板） */
  useEffect(() => {
    let cancelled = false;
    clearDialogue();
    const d = startDialogue(guest, shopType);
    setGuestMood(guest.id, d.mood);
    setState(d);
    const fallback = pickTemplate(OPENING_LINES[shopType]);
    setTyped(fallback);
    generateGuestGreeting(guest, shopType)
      .then((text) => {
        if (cancelled || !text || text === fallback) return;
        setTyped(text);
        setState((prev) => (prev ? pushDialogueMessage({ ...prev, history: prev.history.filter((m) => !(m.phase === 'greeting' && m.role === 'guest')) }, { role: 'guest', content: text, source: 'ai', phase: 'greeting' }) : prev));
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [guest.id, shopType]);

  /** 记录消息到 store.dialogueHistory（AI 上下文；模块六） */
  const record = (role: DialogueMessage['role'], content: string): void => {
    appendDialogue(role, content);
  };

  const handleResponse = (style: 'warm' | 'professional' | 'honest_price'): void => {
    if (!state || busy) return;
    setBusy(true);
    const eff = responseEffects().find((e) => e.style === style);
    const next = applyResponseStyle(state, style);
    const playerMsg: DialogueMessage = { role: 'player', content: eff?.label ?? style, source: 'template', phase: 'player_response' };
    record('player', playerMsg.content);
    const afterPlayer = pushDialogueMessage(next, playerMsg);
    const fallbackReply = buildGuestReply(mood, guest.name);
    setTyped(fallbackReply);
    generateGuestReply(guest, mood, playerMsg.content)
      .then((text) => {
        const content = text && text !== fallbackReply ? text : fallbackReply;
        const finalState = pushDialogueMessage(afterPlayer, { role: 'guest', content, source: text && text !== fallbackReply ? 'ai' : 'template', phase: 'guest_reply' });
        record('guest', content);
        transition({ ...finalState, phase: 'guest_reply' }, content);
      })
      .catch(() => {
        const finalState = pushDialogueMessage(afterPlayer, { role: 'guest', content: fallbackReply, source: 'template', phase: 'guest_reply' });
        record('guest', fallbackReply);
        transition({ ...finalState, phase: 'guest_reply' }, fallbackReply);
      })
      .finally(() => setBusy(false));
  };

  const goRecommend = (): void => {
    if (!state) return;
    const next = { ...state, phase: 'recommend' as const };
    setState(next);
    // 店员提醒（recommend 阶段）
    const ctx = {
      shopType,
      guestType: guest.type,
      storyTag: guest.storyTag,
      description: guest.description,
      preferenceRevealed: guest.preferenceRevealed ?? false,
      baseConsumption: guest.baseConsumption,
      hasStock: (shopItems ?? []).length > 0,
      isBadReviewer: !!guest.isBadReviewer,
      hasAccountant: false,
      hasGuard: false,
      patience: guest.patience ?? 100,
    };
    const reminders = checkStaffReminders(ctx, 'recommend');
    setReminder(reminders[0] ?? null);
  };

  /** 提交方案 → 计算店型结果 → guest_feedback */
  const submitPlan = (): void => {
    if (!state || busy) return;
    setBusy(true);
    let res: ShopReceptionResult;
    if (shopType === 'jiulou') {
      const plan: TavernPlan = { shop: 'jiulou', dishIds, giftDishId, judgeRequested: judge };
      res = handleTavernReception(guest, plan, { baseConsumption: guest.baseConsumption, guestType: guest.type, shopItems }, Math.random);
    } else if (shopType === 'buzhuang') {
      const plan: ClothierPlan = { shop: 'buzhuang', fabricId, styleId, extraOp };
      res = handleClothierReception(guest, plan, { baseConsumption: guest.baseConsumption, guestType: guest.type }, Math.random);
    } else {
      const plan: HerbalistPlan = { shop: 'yaopu', mainHerbId, adjuvantIds, guideId, pulseUsed: pulse, adviceGiven: advice };
      res = handleHerbalistReception(guest, plan, { baseConsumption: guest.baseConsumption, guestType: guest.type }, Math.random);
    }
    res.guestId = guest.id;
    setResult(res);
    setState((prev) => (prev ? { ...prev, phase: 'guest_feedback' } : prev));
    setBusy(false);
  };

  /** 追加挽回（follow_up）：仅一次——布庄量体 / 酒楼赠菜 / 药铺把脉 */
  const retry = (): void => {
    if (!state || retries >= 1) return;
    setRetries(1);
    let res: ShopReceptionResult;
    if (shopType === 'jiulou') {
      const plan: TavernPlan = { shop: 'jiulou', dishIds, giftDishId: giftDishId ?? (dishIds.length ? undefined : undefined), judgeRequested: judge || true };
      res = handleTavernReception(guest, plan, { baseConsumption: guest.baseConsumption, guestType: guest.type, shopItems }, Math.random);
    } else if (shopType === 'buzhuang') {
      const plan: ClothierPlan = { shop: 'buzhuang', fabricId, styleId, extraOp: extraOp ?? 'measure' };
      res = handleClothierReception(guest, plan, { baseConsumption: guest.baseConsumption, guestType: guest.type }, Math.random);
    } else {
      const plan: HerbalistPlan = { shop: 'yaopu', mainHerbId, adjuvantIds, guideId, pulseUsed: true, adviceGiven: advice };
      res = handleHerbalistReception(guest, plan, { baseConsumption: guest.baseConsumption, guestType: guest.type }, Math.random);
    }
    res.guestId = guest.id;
    setResult(res);
    setState((prev) => (prev ? { ...prev, phase: 'guest_feedback' } : prev));
  };

  /** 完结：落账 + 故事弹窗 */
  const finish = (): void => {
    if (result) completeDialogueReception(result, Math.random);
  };

  const adoptReminder = (): void => {
    if (!reminder) return;
    const msg: DialogueMessage = { role: 'staff', content: `（采纳：${reminder.effect}）`, source: 'template', phase: state?.phase ?? 'recommend' };
    setState((prev) => (prev ? pushDialogueMessage(prev, msg) : prev));
    setReminder(null);
  };

  const symptom = useMemo(() => matchSymptom(guest.description), [guest.description]);

  if (legacy) {
    return (
      <div className="flex flex-col gap-2">
        <OperationBar guest={guest} />
        <button type="button" onClick={() => setLegacy(false)} className="self-start rounded px-2 py-1 text-xs" style={{ color: ANCIENT.secondary, border: `1px solid ${ANCIENT.border}` }}>
          返回对话接待
        </button>
      </div>
    );
  }

  const history = state?.history ?? [];
  const phase = state?.phase ?? 'greeting';

  return (
    <div className="flex flex-col gap-3">
      {/* 顶部：客人头像 + 姓名 + 类型 + 心情 */}
      <div className="flex items-center gap-3 rounded-xl px-3 py-2" style={{ backgroundColor: ANCIENT.card, border: `1px solid ${ANCIENT.border}` }}>
        <div
          className="flex h-11 w-11 items-center justify-center rounded-full text-2xl"
          style={{ backgroundColor: ANCIENT.background, border: `2px solid ${ANCIENT.gold}` }}
        >
          {SHOP_ICON[shopType]}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate text-sm font-bold tracking-widest" style={{ color: ANCIENT.text }}>{guest.name}</span>
            <span className="rounded px-1.5 py-0.5 text-[10px] font-bold" style={{ color: '#FFF', backgroundColor: ANCIENT.primary }}>
              {GUEST_TYPE_LABEL[guest.type]}
            </span>
            <span className="text-xs" style={{ color: ANCIENT.secondary }}>
              {moodIcon(mood)} 心情·{moodLabel(mood)}
            </span>
          </div>
          <p className="mt-0.5 truncate text-xs" style={{ color: ANCIENT.secondary }}>{guest.description}</p>
        </div>
        <button
          type="button"
          onClick={() => setLegacy(true)}
          className="shrink-0 rounded px-2 py-1 text-xs"
          style={{ color: ANCIENT.secondary, border: `1px solid ${ANCIENT.border}` }}
        >
          传统操作
        </button>
      </div>

      {/* 中部对话区 */}
      <div className="max-h-64 space-y-2 overflow-y-auto rounded-xl p-3" style={{ backgroundColor: ANCIENT.card, border: `1px solid ${ANCIENT.border}` }}>
        {history.map((m, i) => (
          <Bubble key={i} role={m.role} content={m.content} />
        ))}
        {phase === 'greeting' && typed && (
          <Bubble role="guest" content={typingDone ? typed : typedOut} />
        )}
        {phase === 'guest_reply' && typed && (
          <Bubble role="guest" content={typingDone ? typed : typedOut} />
        )}
        {busy && <div className="text-xs" style={{ color: ANCIENT.secondary }}>（客人正在斟酌……）</div>}
      </div>

      {/* 店员提醒 */}
      {reminder && (
        <StaffReminderBubble reminder={reminder} onAdopt={adoptReminder} onIgnore={() => setReminder(null)} />
      )}

      {/* 底部操作区（按阶段） */}
      <div className="flex flex-col gap-2">
        {phase === 'greeting' && typingDone && (
          <Btn label="热络接话 →" onClick={() => setState((prev) => (prev ? { ...prev, phase: 'player_response' } : prev))} />
        )}

        {phase === 'player_response' && (
          <div className="flex flex-col gap-2">
            {responseEffects().map((e) => (
              <Btn key={e.style} label={`${e.label}（${e.hint}）`} onClick={() => handleResponse(e.style)} disabled={busy} />
            ))}
          </div>
        )}

        {phase === 'guest_reply' && typingDone && (
          <Btn label="推荐货品 →" onClick={goRecommend} />
        )}

        {phase === 'recommend' && (
          <div className="flex flex-col gap-2">
            {shopType === 'jiulou' && (
              <TavernPlanBuilder
                dishIds={dishIds}
                setDishIds={setDishIds}
                giftDishId={giftDishId}
                setGiftDishId={setGiftDishId}
                judge={judge}
                setJudge={setJudge}
              />
            )}
            {shopType === 'buzhuang' && (
              <ClothierPlanBuilder fabricId={fabricId} setFabricId={setFabricId} styleId={styleId} setStyleId={setStyleId} extraOp={extraOp} setExtraOp={setExtraOp} />
            )}
            {shopType === 'yaopu' && (
              <HerbalistPlanBuilder
                symptomLabel={symptom.label}
                mainHerbId={mainHerbId}
                setMainHerbId={setMainHerbId}
                adjuvantIds={adjuvantIds}
                setAdjuvantIds={setAdjuvantIds}
                guideId={guideId}
                setGuideId={setGuideId}
                pulse={pulse}
                setPulse={setPulse}
                advice={advice}
                setAdvice={setAdvice}
              />
            )}
            <Btn label="呈上方案" onClick={submitPlan} disabled={busy || (shopType === 'jiulou' && dishIds.length === 0)} />
          </div>
        )}

        {phase === 'guest_feedback' && result && (
          <div className="flex flex-col gap-2">
            <div className="rounded-xl px-3 py-2 text-sm leading-6" style={{ backgroundColor: ANCIENT.background, border: `1px solid ${ANCIENT.border}`, color: ANCIENT.text }}>
              {result.narrative}
            </div>
            <div className="flex flex-wrap gap-2">
              {result.summary.map((s, i) => (
                <span key={i} className="rounded px-2 py-1 text-xs" style={{ backgroundColor: ANCIENT.card, color: ANCIENT.secondary, border: `1px solid ${ANCIENT.border}` }}>
                  {s}
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              {!result.ok && retries < 1 && <Btn label="追加挽回（仅一次）" onClick={retry} />}
              <Btn label={result.ok ? '成交 · 完结此单' : '完结此单'} onClick={finish} color={result.ok ? ANCIENT.primary : ANCIENT.border} />
            </div>
          </div>
        )}

        {phase === 'resolution' && <div className="text-xs" style={{ color: ANCIENT.secondary }}>本单已接待完毕。</div>}
      </div>
    </div>
  );
}

/* ---------------- 三店方案构建器（模块一） ---------------- */

function TavernPlanBuilder({
  dishIds,
  setDishIds,
  giftDishId,
  setGiftDishId,
  judge,
  setJudge,
}: {
  dishIds: string[];
  setDishIds: (ids: string[]) => void;
  giftDishId?: string;
  setGiftDishId: (id?: string) => void;
  judge: boolean;
  setJudge: (v: boolean) => void;
}): React.ReactElement {
  const categories = ['冷盘', '热菜', '汤品', '酒水', '甜点'] as const;
  const toggleDish = (id: string): void => {
    if (dishIds.includes(id)) setDishIds(dishIds.filter((d) => d !== id));
    else if (dishIds.length < 6) setDishIds([...dishIds, id]);
  };
  return (
    <div className="flex flex-col gap-2 rounded-xl p-3" style={{ backgroundColor: ANCIENT.background, border: `1px solid ${ANCIENT.border}` }}>
      <div className="text-xs font-bold tracking-widest" style={{ color: ANCIENT.secondary }}>搭配宴席（每类选 1-2 样）</div>
      {categories.map((cat) => (
        <div key={cat} className="flex flex-wrap items-center gap-2">
          <span className="w-10 text-xs" style={{ color: ANCIENT.secondary }}>{cat}</span>
          {TAVERN_DISHES.filter((d) => d.category === cat).map((d) => (
            <button
              key={d.id}
              type="button"
              onClick={() => toggleDish(d.id)}
              className="rounded px-2 py-1 text-xs font-bold"
              style={{
                backgroundColor: dishIds.includes(d.id) ? ANCIENT.primary : 'transparent',
                color: dishIds.includes(d.id) ? '#FFF' : ANCIENT.text,
                border: `1px solid ${dishIds.includes(d.id) ? ANCIENT.primary : ANCIENT.border}`,
              }}
            >
              {d.name}{d.signature ? '★' : ''}
            </button>
          ))}
        </div>
      ))}
      <div className="flex flex-wrap items-center gap-3">
        <label className="text-xs" style={{ color: ANCIENT.secondary }}>赠菜（招牌）：</label>
        <select
          value={giftDishId ?? ''}
          onChange={(e) => setGiftDishId(e.target.value || undefined)}
          className="rounded px-2 py-1 text-xs"
          style={{ backgroundColor: ANCIENT.card, color: ANCIENT.text, border: `1px solid ${ANCIENT.border}` }}
        >
          <option value="">不赠</option>
          {TAVERN_DISHES.filter((d) => d.signature).map((d) => (
            <option key={d.id} value={d.id}>{d.name}</option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => setJudge(!judge)}
          className="rounded px-2 py-1 text-xs font-bold"
          style={{ backgroundColor: judge ? ANCIENT.gold : 'transparent', color: judge ? '#FFF' : ANCIENT.text, border: `1px solid ${ANCIENT.gold}` }}
        >
          请评菜（精力-5）
        </button>
      </div>
    </div>
  );
}

function ClothierPlanBuilder({
  fabricId,
  setFabricId,
  styleId,
  setStyleId,
  extraOp,
  setExtraOp,
}: {
  fabricId: string;
  setFabricId: (id: string) => void;
  styleId: string;
  setStyleId: (id: string) => void;
  extraOp?: ClothierPlan['extraOp'];
  setExtraOp: (op?: ClothierPlan['extraOp']) => void;
}): React.ReactElement {
  return (
    <div className="flex flex-col gap-2 rounded-xl p-3" style={{ backgroundColor: ANCIENT.background, border: `1px solid ${ANCIENT.border}` }}>
      <div className="text-xs font-bold tracking-widest" style={{ color: ANCIENT.secondary }}>推荐面料</div>
      <div className="flex flex-wrap gap-2">
        {CLOTHIER_FABRICS.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => setFabricId(f.id)}
            className="rounded px-2 py-1 text-xs font-bold"
            style={{ backgroundColor: fabricId === f.id ? ANCIENT.secondary : 'transparent', color: fabricId === f.id ? '#FFF' : ANCIENT.text, border: `1px solid ${ANCIENT.secondary}` }}
          >
            {f.name}
          </button>
        ))}
      </div>
      <div className="text-xs font-bold tracking-widest" style={{ color: ANCIENT.secondary }}>款式</div>
      <div className="flex flex-wrap gap-2">
        {CLOTHIER_STYLES.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => setStyleId(s.id)}
            className="rounded px-2 py-1 text-xs font-bold"
            style={{ backgroundColor: styleId === s.id ? ANCIENT.secondary : 'transparent', color: styleId === s.id ? '#FFF' : ANCIENT.text, border: `1px solid ${ANCIENT.secondary}` }}
          >
            {s.name}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs" style={{ color: ANCIENT.secondary }}>追加：</span>
        <button type="button" onClick={() => setExtraOp(extraOp === 'measure' ? undefined : 'measure')} className="rounded px-2 py-1 text-xs font-bold" style={{ backgroundColor: extraOp === 'measure' ? ANCIENT.gold : 'transparent', color: extraOp === 'measure' ? '#FFF' : ANCIENT.text, border: `1px solid ${ANCIENT.gold}` }}>
          量体（精力-3）
        </button>
        <button type="button" onClick={() => setExtraOp(extraOp === 'sample' ? undefined : 'sample')} className="rounded px-2 py-1 text-xs font-bold" style={{ backgroundColor: extraOp === 'sample' ? ANCIENT.gold : 'transparent', color: extraOp === 'sample' ? '#FFF' : ANCIENT.text, border: `1px solid ${ANCIENT.gold}` }}>
          展示样衣
        </button>
        <button type="button" onClick={() => setExtraOp(extraOp === 'swap_fabric' ? undefined : 'swap_fabric')} className="rounded px-2 py-1 text-xs font-bold" style={{ backgroundColor: extraOp === 'swap_fabric' ? ANCIENT.gold : 'transparent', color: extraOp === 'swap_fabric' ? '#FFF' : ANCIENT.text, border: `1px solid ${ANCIENT.gold}` }}>
          换料推荐
        </button>
      </div>
    </div>
  );
}

function HerbalistPlanBuilder({
  symptomLabel,
  mainHerbId,
  setMainHerbId,
  adjuvantIds,
  setAdjuvantIds,
  guideId,
  setGuideId,
  pulse,
  setPulse,
  advice,
  setAdvice,
}: {
  symptomLabel: string;
  mainHerbId: string;
  setMainHerbId: (id: string) => void;
  adjuvantIds: string[];
  setAdjuvantIds: (ids: string[]) => void;
  guideId?: string;
  setGuideId: (id?: string) => void;
  pulse: boolean;
  setPulse: (v: boolean) => void;
  advice: boolean;
  setAdvice: (v: boolean) => void;
}): React.ReactElement {
  const mainHerbs = HERB_OPTIONS.filter((h) => h.slot === 'main');
  const adjuvants = HERB_OPTIONS.filter((h) => h.slot === 'adjuvant');
  const guides = HERB_OPTIONS.filter((h) => h.slot === 'guide');
  const toggleAdj = (id: string): void => {
    if (adjuvantIds.includes(id)) setAdjuvantIds(adjuvantIds.filter((a) => a !== id));
    else if (adjuvantIds.length < 2) setAdjuvantIds([...adjuvantIds, id]);
  };
  return (
    <div className="flex flex-col gap-2 rounded-xl p-3" style={{ backgroundColor: ANCIENT.background, border: `1px solid ${ANCIENT.border}` }}>
      <div className="text-xs font-bold tracking-widest" style={{ color: ANCIENT.secondary }}>问诊：{symptomLabel}</div>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs" style={{ color: ANCIENT.secondary }}>主药（必选）：</span>
        {mainHerbs.map((h) => (
          <button key={h.id} type="button" onClick={() => setMainHerbId(h.id)} className="rounded px-2 py-1 text-xs font-bold" style={{ backgroundColor: mainHerbId === h.id ? ANCIENT.accent : 'transparent', color: mainHerbId === h.id ? '#FFF' : ANCIENT.text, border: `1px solid ${ANCIENT.accent}` }}>
            {h.name}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs" style={{ color: ANCIENT.secondary }}>辅药（1-2 味）：</span>
        {adjuvants.map((h) => (
          <button key={h.id} type="button" onClick={() => toggleAdj(h.id)} className="rounded px-2 py-1 text-xs font-bold" style={{ backgroundColor: adjuvantIds.includes(h.id) ? ANCIENT.accent : 'transparent', color: adjuvantIds.includes(h.id) ? '#FFF' : ANCIENT.text, border: `1px solid ${ANCIENT.accent}` }}>
            {h.name}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs" style={{ color: ANCIENT.secondary }}>药引：</span>
        <select value={guideId ?? ''} onChange={(e) => setGuideId(e.target.value || undefined)} className="rounded px-2 py-1 text-xs" style={{ backgroundColor: ANCIENT.card, color: ANCIENT.text, border: `1px solid ${ANCIENT.border}` }}>
          <option value="">不用</option>
          {guides.map((h) => (
            <option key={h.id} value={h.id}>{h.name}</option>
          ))}
        </select>
      </div>
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => setPulse(!pulse)} className="rounded px-2 py-1 text-xs font-bold" style={{ backgroundColor: pulse ? ANCIENT.gold : 'transparent', color: pulse ? '#FFF' : ANCIENT.text, border: `1px solid ${ANCIENT.gold}` }}>
          把脉（精力-5）
        </button>
        <button type="button" onClick={() => setAdvice(!advice)} className="rounded px-2 py-1 text-xs font-bold" style={{ backgroundColor: advice ? ANCIENT.gold : 'transparent', color: advice ? '#FFF' : ANCIENT.text, border: `1px solid ${ANCIENT.gold}` }}>
          送服药建议
        </button>
      </div>
    </div>
  );
}
