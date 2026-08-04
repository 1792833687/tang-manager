/**
 * 移动端底部导航栏（TANG-MOB-001 需求点 6「底部栏优化」+ v1.0 打磨 TANG-POLISH-001 导航重排）
 * 图标 + 2 字短文字，高度缩至 48px；safe-area 保留；超出窄屏 → overflow-x-auto 横滑。
 * 选中：竹青底白字圆角小胶囊；未选中：檀木色文字。
 * v1.0：全部 12 项均走 onSelect（主内容区切面），不再使用 portal overlay。
 * disabled 语义与 NavSidebar 一致（非 playing 阶段仅展示不可切）。
 */
'use client';
import { ANCIENT } from '@/theme/tokens';
import { useTangManagerStore } from '@/stores/tang-manager';
import { NavIcon } from './nav-icons';
import { NAV_ITEMS, isNavItemUnlocked, type NavItemKey } from './nav-sidebar';
import { useFeatureUnlockUi } from './feature-unlock-ui';

interface MobileBottomTabProps {
  active: NavItemKey;
  onSelect: (key: NavItemKey) => void;
  /** 非 playing 阶段禁用切换（选择阶段导航仅展示） */
  disabled?: boolean;
}

export function MobileBottomTab({
  active,
  onSelect,
  disabled = false,
}: MobileBottomTabProps): React.ReactElement {
  // 条件解锁（巍明楼/镖队）
  const unlockState = {
    reputation: useTangManagerStore((s) => s.reputation),
    stage: useTangManagerStore((s) => s.stage),
    shopCount: useTangManagerStore((s) => s.shopCount ?? 1),
    unlockedLayers: useTangManagerStore((s) => s.unlockedLayers),
  };
  const visibleItems = NAV_ITEMS.filter((item) => isNavItemUnlocked(item.key, unlockState));

  return (
    <nav
      aria-label="经营功能导航"
      className="fixed inset-x-0 bottom-0 z-50 md:hidden"
      style={{
        backgroundColor: ANCIENT.card,
        // 无 viewport-fit=cover 时 env() 恒为 0，回退 0 保证不报错；配 cover 后自动避让 home indicator
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        boxShadow: `0 -2px 12px rgba(60,40,20,0.12)`,
      }}
    >
      {/* 顶部描金细线 */}
      <div style={{ height: 1, backgroundColor: ANCIENT.gold, opacity: 0.55 }} />
      <div className="flex items-stretch overflow-x-auto" style={{ minHeight: 48, scrollbarWidth: 'none' }}>
        {visibleItems.map((item) => (
          <MobileTabItem key={item.key} item={item} active={active} disabled={disabled} onSelect={onSelect} />
        ))}
      </div>
    </nav>
  );
}

/** 单个底部导航项（v1.0 功能解锁：未解锁灰显 + title 条件提示 + 禁点） */
function MobileTabItem({
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
  const isActive = active === item.key;
  const effectiveDisabled = disabled || locked;
  const title = locked && reason ? `${item.label}（未解锁：${reason}）` : item.label;
  return (
    <button
      type="button"
      disabled={effectiveDisabled}
      onClick={() => onSelect(item.key)}
      title={title}
      className="flex min-w-[52px] flex-1 flex-col items-center justify-center gap-0.5 px-1 py-1 transition-transform active:scale-[0.97] disabled:cursor-not-allowed"
      style={{
        fontFamily: 'var(--font-ancient-serif)',
        // 功能未解锁：灰显 + 降透明度
        opacity: locked ? 0.4 : 1,
        filter: locked ? 'grayscale(0.8)' : 'none',
        transition: 'opacity 0.2s, filter 0.2s',
      }}
    >
      <NavIcon iconKey={item.iconKey} size={18} color={isActive ? '#FFFFFF' : ANCIENT.secondary} />
      <span
        className="rounded-full px-1.5 py-px text-[10px] leading-tight tracking-wider"
        style={{
          backgroundColor: isActive ? ANCIENT.primary : 'transparent',
          color: isActive ? '#FFFFFF' : ANCIENT.secondary,
        }}
      >
        {item.short}
      </span>
    </button>
  );
}
