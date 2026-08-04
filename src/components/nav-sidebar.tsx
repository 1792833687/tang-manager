/**
 * 左侧竖排导航栏 — 十二项（v1.0 打磨 TANG-POLISH-001 导航重排）
 * 甲方铁律顺序：我→接待→货架→账本→伙计→钱庄→舆图→门路→镖队→巍明楼→手札录→成就（快捷键 1-12）。
 * 全部 12 项均为主内容区切面（onSelect），不再使用 portal overlay；
 * 门路（faction）/ 手札录（journal）/ 镖队（caravan）/ 巍明楼（politics）迁移至
 * tang-manager/page.tsx 主内容区渲染（NavPanelKey 保持 8 项不扩，scripts/page.tsx 零触碰）。
 * 体验优化（模块三导航紧凑化）：56px 仅图标；悬浮 title 显示面板名；
 * 选中项：竹青底 + 白图标；未选中：檀木色图标；项间云纹描金分割线；背景保留唐草纹纹理。
 */
'use client';
import { withBase } from '@/lib/utils/base-path';
import { useTangManagerStore } from '@/stores/tang-manager';
import { ANCIENT, ANCIENT_ASSETS } from '@/theme/tokens';
import { isFeatureUnlocked, getUnlockCondition } from '@/systems/tang-feature-unlock';
import { NavIcon, type NavIconKey } from './nav-icons';
import { useFeatureUnlockUi } from './feature-unlock-ui';
import { TutorialHighlight } from './tutorial-highlight';

/** 面板 key：8 项（与 scripts/page.tsx PANEL_CONTENT 严格一致，勿扩） */
export type NavPanelKey =
  | 'me'
  | 'ledger'
  | 'shelf'
  | 'staff'
  | 'reception'
  | 'achievement'
  | 'bank'
  | 'map';

/** 导航项 key：8 面板 + 门路/手札录/镖队/巍明楼（第 9-12 项；v1.0 全部主内容区切面） */
export type NavItemKey = NavPanelKey | 'faction' | 'journal' | 'politics' | 'caravan';

/** 导航项（甲方铁律顺序，与快捷键 1-12 严格对应）：label 全名（tooltip/底部短名 short） */
export const NAV_ITEMS: ReadonlyArray<{ key: NavItemKey; label: string; short: string; iconKey: NavIconKey }> = [
  { key: 'me', label: '我', short: '我', iconKey: 'me' },
  { key: 'reception', label: '接待', short: '接待', iconKey: 'reception' },
  { key: 'shelf', label: '货架', short: '货架', iconKey: 'shelf' },
  { key: 'ledger', label: '账本', short: '账本', iconKey: 'ledger' },
  { key: 'staff', label: '伙计', short: '伙计', iconKey: 'staff' },
  { key: 'bank', label: '钱庄', short: '钱庄', iconKey: 'bank' },
  { key: 'map', label: '长安舆图', short: '舆图', iconKey: 'map' },
  { key: 'faction', label: '门路', short: '门路', iconKey: 'faction' },
  { key: 'caravan', label: '镖队', short: '镖队', iconKey: 'caravan' },
  { key: 'politics', label: '巍明楼', short: '巍明', iconKey: 'politics' },
  { key: 'journal', label: '手札录', short: '手札', iconKey: 'journal' },
  { key: 'achievement', label: '成就', short: '成就', iconKey: 'achievement' },
];

/** 条件解锁所需状态子集（nav-sidebar / mobile-bottom-tab 复用） */
export interface NavUnlockState {
  reputation: number;
  stage: number;
  shopCount: number;
  unlockedLayers: readonly string[];
}

/** 条件解锁：巍明楼 声望≥700 且 阶段≥3；镖队 分店≥2 且 地图 L2；其余恒显示 */
export function isNavItemUnlocked(key: NavItemKey, s: NavUnlockState): boolean {
  switch (key) {
    case 'politics':
      return s.reputation >= 700 && s.stage >= 3;
    case 'caravan':
      return s.shopCount >= 2 && s.unlockedLayers.includes('east_west_market');
    default:
      return true;
  }
}

/** 新手引导（TANG-TUT-002）：导航图标描金微光标记（面板首次打开引导） */
const NAV_TUTORIAL: Partial<Record<NavItemKey, string>> = {
  shelf: 'FIRST_SHELF',
  staff: 'FIRST_STAFF',
  ledger: 'FIRST_LEDGER',
  bank: 'FIRST_BANK',
  map: 'FIRST_MAP',
  politics: 'FIRST_POLITICS',
  caravan: 'FIRST_CARAVAN',
};

interface NavSidebarProps {
  active: NavItemKey;
  onSelect: (key: NavItemKey) => void;
  /** 非 playing 阶段禁用切换（选择阶段导航仅展示） */
  disabled?: boolean;
}

/** 单个导航项（v1.0 功能解锁：未解锁灰显 + title 条件提示 + 禁点） */
function NavSidebarItem({
  item,
  active,
  disabled,
  onSelect,
}: {
  item: (typeof NAV_ITEMS)[number];
  active: NavItemKey;
  disabled: boolean;
  onSelect: (key: NavItemKey) => void;
}): React.ReactElement {
  const { locked, reason } = useFeatureUnlockUi(item.key);
  const effectiveDisabled = disabled || locked;
  const title = locked && reason ? `${item.label}（未解锁：${reason}）` : item.label;
  return (
    <button
      type="button"
      disabled={effectiveDisabled}
      onClick={() => onSelect(item.key)}
      title={title}
      className="flex w-full flex-col items-center justify-center py-2.5 transition-colors disabled:cursor-not-allowed"
      style={{
        backgroundColor: active === item.key ? ANCIENT.primary : 'transparent',
        // 功能未解锁：灰显 + 降透明度（保留图标轮廓，hover 由 title 提示）
        opacity: locked ? 0.4 : 1,
        filter: locked ? 'grayscale(0.8)' : 'none',
        transition: 'opacity 0.2s, filter 0.2s',
      }}
    >
      <NavIcon iconKey={item.iconKey} size={22} color={active === item.key ? '#FFFFFF' : ANCIENT.secondary} />
    </button>
  );
}

/** 单个导航项插槽：面板首次打开引导 → 描金微光包裹（已读/禁用时不发光） */
function NavSidebarSlot({
  item,
  active,
  disabled,
  onSelect,
  idx,
}: {
  item: (typeof NAV_ITEMS)[number];
  active: NavItemKey;
  disabled: boolean;
  onSelect: (key: NavItemKey) => void;
  idx: number;
}): React.ReactElement {
  const guideId = NAV_TUTORIAL[item.key];
  const inner = (
    <>
      {idx > 0 && (
        // 云纹描金分割线（手绘风格；56px 窄栏缩为 14px 高）
        <div
          className="mx-2"
          style={{
            height: 14,
            backgroundImage: `url(${withBase(ANCIENT_ASSETS.divider)})`,
            backgroundSize: '100% 100%',
            backgroundRepeat: 'no-repeat',
            backgroundPosition: 'center',
            opacity: 0.7,
          }}
        />
      )}
      <NavSidebarItem item={item} active={active} disabled={disabled} onSelect={onSelect} />
    </>
  );
  if (!guideId) return <>{inner}</>;
  return (
    <TutorialHighlight guideId={guideId} disabled={disabled}>
      {inner}
    </TutorialHighlight>
  );
}

export function NavSidebar({
  active,
  onSelect,
  disabled = false,
}: NavSidebarProps): React.ReactElement {
  // 条件解锁（巍明楼/镖队）
  const unlockState: NavUnlockState = {
    reputation: useTangManagerStore((s) => s.reputation),
    stage: useTangManagerStore((s) => s.stage),
    shopCount: useTangManagerStore((s) => s.shopCount ?? 1),
    unlockedLayers: useTangManagerStore((s) => s.unlockedLayers),
  };

  const visibleItems = NAV_ITEMS.filter((item) => isNavItemUnlocked(item.key, unlockState));

  return (
    <nav
      className="hidden w-[56px] shrink-0 flex-col rounded-r-xl py-4 md:flex"
      style={{
        backgroundColor: ANCIENT.card,
        // 唐草纹背景纹理（覆盖在米白底上）
        backgroundImage: `url(${withBase(ANCIENT_ASSETS.navBg)})`,
        backgroundSize: 'cover',
        borderRight: `2px solid ${ANCIENT.border}`,
      }}
    >
      {visibleItems.map((item, idx) => (
        <NavSidebarSlot
          key={item.key}
          item={item}
          active={active}
          disabled={disabled}
          onSelect={onSelect}
          idx={idx}
        />
      ))}
    </nav>
  );
}
