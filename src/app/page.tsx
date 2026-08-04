/**
 * 掌柜主页面（/scripts/tang-manager/）
 * 布局：左侧竖排导航 + 右侧主内容区。
 * 体验优化（双视图分离 + v1.0 面板统一化）：
 * - operations 日常经营：SceneBanner + 精简状态条（客人进度/精力/通晓人心）+ 事件/自由行动/经营操作；
 * - dashboard 经营看板：导航点任意面板 → 看板（DashboardContainer 固定高滚动只渲染当前面板）+
 *   底部「返回经营」；接待导航项直接回经营视图（接待属经营动作）；打烊（settleDay）天然在经营视图。
 * - v1.0：12 个一级面板全部走主内容区切面切换（key 用 NavItemKey 联合类型）：
 *   我/接待/货架/账本/伙计/钱庄/舆图/门路/镖队/巍明楼/手札录/成就；
 *   门路/手札录/镖队/巍明楼 由 portal overlay 迁移为主内容区面板（NavPanelKey 严禁扩展，
 *   scripts/page.tsx 并发保护文件零触碰）。
 * - 快捷键：数字 1-12 对应 12 面板顺序（甲方铁律：我→接待→货架→账本→伙计→钱庄→舆图→
 *   门路→镖队→巍明楼→手札录→成就；与 NAV_ITEMS 顺序一致，1-9 取第 idx 项，0 取第 10 项，
 *   '-'/'=' 取第 11/12 项——为避免歧义，仅 1-9、0 映射前 10 项，'['/']' 映射第 11/12 项。
 *   v1.0 简化：1-9 → 前 9 项；0 → 第 10 项；[- → 第 11 项；] → 第 12 项）。
 * - 面板切换时子组件卸载重挂 → 各面板内部 useState 天然清空。
 * - EndingOverlay 全局挂载（原挂 nav-sidebar 内，桌面 nav 隐藏时移动端会失效 → 迁移至主框架）。
 * SSR/hydration 安全：store 持久化为异步存储，首帧渲染初始态；mounted 门闩防止闪烁。
 */
'use client';
import { useEffect, useRef, useState } from 'react';
import { shopDisplayName } from '@/config/tang-shop-types';
import { TANG_FEATURES } from '@/config/tang-feature-ids';
import { getUnlockNarrative } from '@/systems/tang-feature-unlock';
import { AfternoonActions } from '@/components/afternoon-actions';
import { AchievementPanel } from '@/components/achievement-panel';
import { ActionFeedback } from '@/components/action-feedback';
import { ApiConfigModal } from '@/components/api-config-modal';
import { BankPanel } from '@/components/bank-panel';
import { BankruptPanel } from '@/components/bankrupt-panel';
import { CaravanPanel } from '@/components/caravan-panel';
import { DashboardContainer } from '@/components/dashboard-container';
import { DifficultyPanel } from '@/components/difficulty-panel';
import { EndingOverlay } from '@/components/ending-overlay';
import { StoryModal } from '@/components/tang-manager/story-modal';
import { StaffReminderHost } from '@/components/tang-manager/staff-reminder-host';
import { EventPanel } from '@/components/event-panel';
import { FactionPanel } from '@/components/faction-panel';
import { IdentityPanel } from '@/components/identity-panel';
import { InvestmentResult } from '@/components/investment-result';
import { JournalPanel } from '@/components/journal-panel';
import { LedgerPanel } from '@/components/ledger-panel';
import { LoadingScreen } from '@/components/loading-screen';
import { MapPanel } from '@/components/map-panel';
import { MePanel } from '@/components/me-panel';
import { MobileBottomTab } from '@/components/mobile-bottom-tab';
import { NAV_ITEMS, NavSidebar, type NavItemKey } from '@/components/nav-sidebar';
import { NotificationToast } from '@/components/notification-toast';
import { PlayingActions } from '@/components/playing-actions';
import { PoliticsPanel } from '@/components/politics-panel';
import { ReceptionPanel } from '@/components/reception-panel';
import { SceneBanner } from '@/components/scene-banner';
import { SeizedPanel } from '@/components/seized-panel';
import { ShelfPanel } from '@/components/shelf-panel';
import { ShopTypePanel } from '@/components/shop-type-panel';
import { StaffPanel } from '@/components/staff-panel';
import { useTangManagerStore } from '@/stores/tang-manager';
import { ANCIENT } from '@/theme/tokens';
import {
  evaluateTutorialTriggers,
  triggerTutorial,
  TUTORIAL_NAV_TRIGGER,
  type TutorialTriggerSnapshot,
} from '@/systems/tang-tutorial-triggers';
import { AZhaoReminder } from '@/components/a-zhao-reminder';
import { TutorialOverlay } from '@/components/tutorial-overlay';

/** 解锁浮现提示（v1.0 功能解锁 TANG-POLISH-001 模块二）：监听 unlockedFeatures 新增 → 手札风格 toast */
function FeatureUnlockToast(): React.ReactElement | null {
  const unlockedFeatures = useTangManagerStore((s) => s.unlockedFeatures ?? {});
  const [toast, setToast] = useState<{ id: string; name: string; narrative: string } | null>(null);
  const prevRef = useRef<Record<string, boolean>>({});

  useEffect(() => {
    const prev = prevRef.current;
    let timer: number | null = null;
    for (const id of Object.keys(unlockedFeatures)) {
      if (unlockedFeatures[id] && !prev[id]) {
        const def = TANG_FEATURES.find((f) => f.id === id);
        if (def) {
          setToast({ id, name: def.name, narrative: getUnlockNarrative(id) });
          // 多条目同时解锁：仅保留最后一条（注释说明）
          timer = window.setTimeout(() => setToast(null), 3200);
        }
      }
    }
    prevRef.current = { ...unlockedFeatures };
    return () => {
      if (timer !== null) window.clearTimeout(timer);
    };
  }, [unlockedFeatures]);

  if (!toast) return null;
  return (
    <div
      className="fixed left-1/2 top-16 z-[90] w-[min(92vw,360px)] -translate-x-1/2 rounded-xl px-4 py-3 text-center shadow-lg"
      style={{
        backgroundColor: ANCIENT.card,
        border: `2px solid ${ANCIENT.gold}`,
        boxShadow: `0 0 0 1px ${ANCIENT.primary} inset, 0 12px 28px rgba(60,40,20,0.35)`,
        animation: 'modal-slide-up 0.2s ease-out',
        fontFamily: 'var(--font-ancient-serif)',
      }}
    >
      <div className="text-xs tracking-[0.3em]" style={{ color: ANCIENT.gold }}>
        ✦ 新功能解锁 ✦
      </div>
      <div className="mt-1 text-base font-bold tracking-[0.2em]" style={{ color: ANCIENT.text }}>
        {toast.name}
      </div>
      <div className="mt-1 text-xs leading-relaxed" style={{ color: ANCIENT.secondary }}>
        {toast.narrative}
      </div>
    </div>
  );
}

/** 看板面板标题（dashboard 顶部；12 面板，key 用 NavItemKey） */
const PANEL_TITLES: Record<NavItemKey, string> = {
  me: '我',
  reception: '接待',
  shelf: '货架',
  ledger: '账本',
  staff: '伙计',
  bank: '钱庄',
  map: '长安舆图',
  faction: '门路',
  caravan: '镖队',
  politics: '巍明楼',
  journal: '手札录',
  achievement: '成就',
};

/** 面板内容表（dashboard 看板只渲染当前面板；12 面板全部主内容区切面） */
const PANEL_CONTENT: Record<NavItemKey, React.ReactElement> = {
  me: <MePanel />,
  reception: <ReceptionPanel />,
  shelf: <ShelfPanel />,
  ledger: <LedgerPanel />,
  staff: <StaffPanel />,
  bank: <BankPanel />,
  map: <MapPanel />,
  faction: <FactionPanel />,
  caravan: <CaravanPanel />,
  politics: <PoliticsPanel />,
  journal: <JournalPanel />,
  achievement: <AchievementPanel />,
};

/** 精简状态条（operations 视图顶部）：当前客人进度 + 精力 + 通晓人心剩余 + 天机阁入口 */
function OperationsStatusStrip(): React.ReactElement {  const guests = useTangManagerStore((s) => s.guests);
  const currentGuestIndex = useTangManagerStore((s) => s.currentGuestIndex);
  const energy = useTangManagerStore((s) => s.energy);
  const insightRemaining = useTangManagerStore((s) => s.insightRemaining);
  const [tianjiOpen, setTianjiOpen] = useState(false);
  const handledCount = guests.filter((g) => g.handled).length;
  const allHandled = guests.length > 0 && handledCount === guests.length;
  const guestLabel = allHandled
    ? '今日已毕，可打烊'
    : `客至 ${Math.min(currentGuestIndex + 1, guests.length)} / ${guests.length}`;
  return (
    <>
      <div className="grid grid-cols-4 gap-2 text-center text-xs md:text-sm">
        <div className="rounded-lg px-2 py-1.5" style={{ backgroundColor: ANCIENT.card, border: `1px solid ${allHandled ? ANCIENT.gold : ANCIENT.border}`, color: allHandled ? ANCIENT.accent : ANCIENT.text }}>
          今日 · {guestLabel}
        </div>
        <div className="rounded-lg px-2 py-1.5" style={{ backgroundColor: ANCIENT.card, border: `1px solid ${ANCIENT.border}`, color: ANCIENT.text }}>
          精力 {energy}%
        </div>
        <div className="rounded-lg px-2 py-1.5" style={{ backgroundColor: ANCIENT.card, border: `1px solid ${ANCIENT.border}`, color: ANCIENT.text }}>
          通晓人心 ×{insightRemaining}
        </div>
        {/* 天机阁入口：点击配置 AI 叙事 API Key（默认经营视图即可打开） */}
        <button
          type="button"
          onClick={() => setTianjiOpen(true)}
          className="rounded-lg px-2 py-1.5 transition-opacity hover:opacity-80"
          style={{ backgroundColor: ANCIENT.card, border: `1px solid ${ANCIENT.gold}`, color: ANCIENT.primary }}
        >
          天机 ⚙
        </button>
      </div>
      <ApiConfigModal open={tianjiOpen} onClose={() => setTianjiOpen(false)} />
    </>
  );
}

/** 新手引导（TANG-TUT-002）：状态型触发点快照提取（含 prev* 过渡值） */
function collectTutorialSnapshot(prev: TutorialTriggerSnapshot | null): TutorialTriggerSnapshot {
  const s = useTangManagerStore.getState();
  return {
    phase: s.phase,
    day: s.day,
    currentGuestIndex: s.currentGuestIndex,
    energy: s.energy,
    score: s.score,
    reputation: s.reputation,
    legacyDebt: s.legacyDebt,
    tutorialFlags: s.tutorialFlags ?? {},
    // 陈损预警：库房有临期/过期货（expiry 0~1，与货架「陈损预警」口径一致）
    hasNearExpiry: (s.shopItems ?? []).some((it) => (it.expiry ?? -1) >= 0 && (it.expiry ?? -1) <= 1),
    hasWeeklyTasks: (s.weeklyTasks ?? []).length > 0,
    hasEmployeeEvent: (s.eventLog ?? []).some((e) => e.startsWith('emp-ev:') || e.startsWith('emp-social:')),
    prevEnergy: prev?.energy,
    prevScore: prev?.score,
    prevReputation: prev?.reputation,
    prevLegacyDebt: prev?.legacyDebt,
  };
}

/**
 * 新手引导（TANG-TUT-002）：状态型触发点 watcher
 * 订阅 store 每次变化 → 提取快照 → evaluateTutorialTriggers → 逐个 triggerTutorial
 * （优先级/排队/防重由 triggerTutorial 内部判定；currentTutorial 清空后自动补发队首）。
 * 事件型触发点（通晓人心/接预购/籴粜契/加工/组合/切策略/面板打开）在各组件内直接调用。
 */
function useTutorialWatcher(): void {
  const prevRef = useRef<TutorialTriggerSnapshot | null>(null);
  useEffect(() => {
    const check = (): void => {
      const snapshot = collectTutorialSnapshot(prevRef.current);
      for (const id of evaluateTutorialTriggers(snapshot)) {
        triggerTutorial(id);
      }
      prevRef.current = snapshot;
    };
    // 初始判定（如加载存档已处于 playing）
    check();
    const unsubscribe = useTangManagerStore.subscribe(check);
    return () => unsubscribe();
  }, []);
}

export default function TangManagerPage(): React.ReactElement {
  const phase = useTangManagerStore((s) => s.phase);
  const pendingCount = useTangManagerStore((s) => s.pendingEvents.length);
  const viewMode = useTangManagerStore((s) => s.viewMode ?? 'operations');
  const setViewMode = useTangManagerStore((s) => s.setViewMode);
  const shopType = useTangManagerStore((s) => s.shopType);
  const [activePanel, setActivePanel] = useState<NavItemKey>('me');
  // mounted 门闩：服务端与客户端首帧均渲染古风骨架，挂载后再渲染真实内容，防 hydration mismatch
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  /** 新手引导（TANG-TUT-002）：状态型触发点 watcher（进入 playing 弹 WELCOME 等） */
  useTutorialWatcher();

  /** 导航选择：接待属经营动作 → 直接回经营视图；其余面板 → 经营看板 */
  const handleSelect = (key: NavItemKey): void => {
    setActivePanel(key);
    setViewMode(key === 'reception' ? 'operations' : 'dashboard');
    // 新手引导（TANG-TUT-002）：面板首次打开 → 对应引导（防重/排队在 triggerTutorial 内）
    const guideId = TUTORIAL_NAV_TRIGGER[key];
    if (guideId) triggerTutorial(guideId);
  };

  // TANG-MIST-003 M3 · 2.6：面板跳转请求（路线规划「组建镖队走此路线」→ 镖队面板；消费后清空）
  const requestedNavPanel = useTangManagerStore((s) => s.requestedNavPanel ?? null);
  const requestNavPanel = useTangManagerStore((s) => s.requestNavPanel);
  useEffect(() => {
    if (!requestedNavPanel) return;
    handleSelect(requestedNavPanel as NavItemKey);
    requestNavPanel(null);
  }, [requestedNavPanel, requestNavPanel]);

  // v1.0 功能解锁（TANG-POLISH-001 模块二）：未解锁面板拦截（导航已灰显禁点，此处兜底拦截快捷键）
  const unlockedFeatures = useTangManagerStore((s) => s.unlockedFeatures ?? {});
  const selectWithUnlockGuard = (key: NavItemKey): void => {
    if (!unlockedFeatures[key]) return; // 未解锁：拦截（导航灰显禁点；快捷键同样被拦）
    handleSelect(key);
  };

  // 快捷键 1-12（与 NAV_ITEMS 顺序一致；全局监听仅 playing 生效）
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (phase !== 'playing') return;
      const idx =
        e.key >= '1' && e.key <= '9'
          ? Number(e.key) - 1
          : e.key === '0'
            ? 9
            : e.key === '['
              ? 10
              : e.key === ']'
                ? 11
                : -1;
      if (idx < 0 || idx >= NAV_ITEMS.length) return;
      const item = NAV_ITEMS[idx];
      if (item) selectWithUnlockGuard(item.key);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  const shopName = shopType !== null ? shopDisplayName(shopType) : '陆记';

  return (
    <>
      {/* 初始加载画面：未挂载显示（visible=true），挂载后自动淡出 1s 卸载（false）
          注意 visible 语义：true=显示加载中 / false=淡出——与 mounted 取反 */}
      <LoadingScreen visible={!mounted} />
      {/* 兜底按钮：浮于 loading（z-100）之上，点击强制进入；正常路径 useEffect 也会自动进入 */}
      {!mounted && (
        <button
          type="button"
          onClick={() => setMounted(true)}
          className="fixed left-1/2 z-[200] -translate-x-1/2 rounded-lg px-10 py-3 text-base font-bold tracking-[0.5em] transition-opacity hover:opacity-90"
          style={{
            bottom: '18%',
            backgroundColor: ANCIENT.primary,
            color: '#FFFFFF',
            border: `2px solid ${ANCIENT.border}`,
            boxShadow: `0 0 0 1px ${ANCIENT.gold} inset`,
          }}
        >
          推 门 而 入
        </button>
      )}
      {mounted && (
        <div
          className="tang-root flex min-h-screen flex-col"
          style={{ backgroundColor: ANCIENT.background, color: ANCIENT.text }}
        >
          <div className="flex flex-1">
            <NavSidebar active={activePanel} onSelect={handleSelect} disabled={phase !== 'playing'} />
            {/* pb-20 为移动端底部 Tab 预留留白；md+ 桌面侧栏布局恢复 pb-4 */}
            <main className="flex flex-1 flex-col gap-4 p-4 pb-20 md:pb-4">
      <StaffReminderHost />
              <SceneBanner />
              {phase === 'identity' && <IdentityPanel />}
              {phase === 'shop-type' && <ShopTypePanel />}
              {phase === 'difficulty' && <DifficultyPanel />}
              {phase === 'playing' &&
                (viewMode === 'dashboard' ? (
                  /* 经营看板：固定高滚动区只渲染当前面板，不渲染接待/结算/叙事 */
                  <DashboardContainer title={`${PANEL_TITLES[activePanel]} · ${shopName}`} onBack={() => setViewMode('operations')}>
                    {PANEL_CONTENT[activePanel]}
                  </DashboardContainer>
                ) : (
                  /* 日常经营：精简状态条 + 事件/自由行动/经营操作；
                     接待导航 → 富接待面板（队列/耐心/六操作/留言簿/打烊），其余面板走看板 */
                  <>
                    <OperationsStatusStrip />
                    {pendingCount > 0 ? (
                      <EventPanel />
                    ) : activePanel === 'reception' ? (
                      <ReceptionPanel />
                    ) : (
                      <>
                        {/* Step 5a：接待完且剩余自由行动>0 → 打烊前自由行动阶段（与 PlayingActions 并存） */}
                        <AfternoonActions />
                        <PlayingActions />
                      </>
                    )}
                  </>
                ))}
              {phase === 'bankrupt' && <BankruptPanel />}
              {phase === 'seized' && <SeizedPanel />}
            </main>
          </div>
          {/* 移动端底部导航（md:hidden，仅窄屏显示） */}
          <MobileBottomTab active={activePanel} onSelect={handleSelect} disabled={phase !== 'playing'} />
          {/* 投资到期弹窗（全屏 overlay；无结果时返回 null） */}
          <InvestmentResult />
          {/* 多结局全屏弹窗（v1.0 由 nav-sidebar 迁移至主框架，移动端/桌面端均可见） */}
          <EndingOverlay />
      <StoryModal />
          {/* 功能解锁浮现提示（v1.0 模块二；无新解锁时返回 null） */}
          <FeatureUnlockToast />
          {/* 通知弹条（v1.0 模块四；右上角 3s；无通知时返回空） */}
          <NotificationToast />
          {/* 操作结果浮层（内容深化模块三；非弹窗，操作区上方居中 1.5s 淡出） */}
          <ActionFeedback />
          {/* 新手引导（TANG-TUT-002 模块二）：家传手札弹窗 + 阿昭提醒气泡（无当前引导时返回空） */}
          <TutorialOverlay />
          <AZhaoReminder />
        </div>
      )}
    </>
  );
}
