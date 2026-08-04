/**
 * 六操作接待按钮条（TANG-RCP-001 模块五）
 * 正常接待 / 通晓人心 / 推荐 / 闲聊 / 小恩小惠 / 婉拒
 * - 通晓人心 = revealGuestPreference（揭示偏好，不处理客人，便于按偏好推荐/闲聊）；
 * - 推荐/小恩小惠：点击展开库房商品选择（在库才有货）；
 * - 婉拒：展开四法二级菜单（redirect 引荐 / excuse 托辞 / delegate 转交阿昭 / refuse 原逻辑）；
 * - 灰显条件：通晓人心 0 次、推荐/赠礼库房空。
 * 本组件只调用 store action 并展示结果文案，不持有游戏状态。
 */
'use client';
import { useState } from 'react';
import { useTangManagerStore } from '@/stores/tang-manager';
import { ANCIENT } from '@/theme/tokens';
import type { Guest, PoliteRejectMethod, ShopItem } from '@/types/tang-manager';

const REJECT_OPTIONS: { method: PoliteRejectMethod; label: string }[] = [
  { method: 'redirect', label: '引荐别家' },
  { method: 'excuse', label: '好言托辞' },
  { method: 'delegate', label: '转交阿昭' },
  { method: 'refuse', label: '婉言回绝' },
];

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
      className="min-h-10 flex-1 rounded-lg px-2 py-2 text-xs font-bold tracking-widest transition-transform active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-40"
      style={{ backgroundColor: color, color: '#FFFFFF' }}
    >
      {label}
    </button>
  );
}

export function OperationBar({ guest }: { guest: Guest }): React.ReactElement {
  const handleCurrentGuest = useTangManagerStore((s) => s.handleCurrentGuest);
  const revealGuestPreference = useTangManagerStore((s) => s.revealGuestPreference);
  const recommendItem = useTangManagerStore((s) => s.recommendItem);
  const chatWithGuest = useTangManagerStore((s) => s.chatWithGuest);
  const giveGift = useTangManagerStore((s) => s.giveGift);
  const rejectPolitely = useTangManagerStore((s) => s.rejectPolitely);
  const insightRemaining = useTangManagerStore((s) => s.insightRemaining);
  const energy = useTangManagerStore((s) => s.energy);
  const shopItems = useTangManagerStore((s) => s.shopItems);

  const [openPicker, setOpenPicker] = useState<'recommend' | 'gift' | null>(null);
  const [showReject, setShowReject] = useState(false);
  const [resultText, setResultText] = useState<string | null>(null);

  // 边缘场景（模块三）：精力不足 → 全部操作禁用 + 提示（保留婉拒——婉拒不耗精力）
  const energyExhausted = energy <= 0;

  // TANG-TRF-001：预购预留 reserved 部分不可售（可售 = stock - reserved）
  const inStock = shopItems.filter((it) => (it.stock ?? 0) - (it.reserved ?? 0) > 0);
  const inventoryEmpty = inStock.length === 0;

  const pickItem = (kind: 'recommend' | 'gift', item: ShopItem): void => {
    setOpenPicker(null);
    if (kind === 'recommend') {
      const r = recommendItem(guest.id, item.id);
      setResultText(r?.ok ? r.handledNote : r?.reason ?? '推荐失败');
    } else {
      const r = giveGift(guest.id, item.id);
      setResultText(r?.ok ? r.handledNote : r?.reason ?? '赠礼失败');
    }
  };

  const run = (label: string, fn: () => unknown): void => {
    const r = fn();
    if (typeof r === 'object' && r && 'handledNote' in (r as object)) {
      setResultText((r as { handledNote?: string }).handledNote ?? label);
    } else if (typeof r === 'object' && r && 'revealed' in (r as object) && (r as { revealed?: unknown }).revealed) {
      setResultText('已窥得客人偏好');
    } else {
      setResultText(label);
    }
  };

  return (
    <div className="flex flex-col gap-2">
      {/* 精力不足提示（边缘场景） */}
      {energyExhausted && (
        <p className="rounded px-2 py-1 text-[11px]" style={{ backgroundColor: ANCIENT.card, border: `1px solid ${ANCIENT.accent}`, color: ANCIENT.accent }}>
          ⚠ 精力耗尽，今日已无法再接待。可婉拒剩余客人或直接打烊。
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <Btn label="正常接待" color={ANCIENT.primary} disabled={energyExhausted} onClick={() => run('正常接待', () => handleCurrentGuest('normal'))} />
        <Btn
          label={`通晓人心（${insightRemaining}）`}
          color={ANCIENT.secondary}
          disabled={insightRemaining <= 0 || energyExhausted}
          onClick={() => run('通晓人心', () => revealGuestPreference(guest.id))}
        />
        <Btn label="推荐" color={ANCIENT.primary} disabled={inventoryEmpty || energyExhausted} onClick={() => { setShowReject(false); setOpenPicker(openPicker === 'recommend' ? null : 'recommend'); }} />
        <Btn label="闲聊" color={ANCIENT.secondary} disabled={energyExhausted} onClick={() => run('闲聊', () => chatWithGuest(guest.id))} />
        <Btn label="小恩小惠" color={ANCIENT.gold} disabled={inventoryEmpty || energyExhausted} onClick={() => { setShowReject(false); setOpenPicker(openPicker === 'gift' ? null : 'gift'); }} />
        <Btn label="婉拒" color={ANCIENT.accent} onClick={() => { setOpenPicker(null); setShowReject(!showReject); }} />
      </div>

      {/* 推荐/赠礼 库房商品选择（在库商品列表） */}
      {openPicker && (
        <div className="rounded-lg border p-2" style={{ borderColor: ANCIENT.border, backgroundColor: ANCIENT.card }}>
          <p className="mb-1 text-xs tracking-widest" style={{ color: ANCIENT.secondary }}>
            {openPicker === 'recommend' ? '荐何物予客人？' : '取何物相赠？'}
          </p>
          <div className="flex flex-wrap gap-1.5">
            {inStock.map((it) => (
              <button
                key={it.id}
                type="button"
                onClick={() => pickItem(openPicker, it)}
                className="rounded px-2 py-1 text-xs"
                style={{ backgroundColor: ANCIENT.background, color: ANCIENT.text, border: `1px solid ${ANCIENT.border}` }}
              >
                {it.name}（{it.stock}）
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 婉拒四法二级菜单 */}
      {showReject && (
        <div className="flex flex-wrap gap-1.5">
          {REJECT_OPTIONS.map((o) => (
            <button
              key={o.method}
              type="button"
              onClick={() => {
                setShowReject(false);
                run(o.label, () => rejectPolitely(guest.id, o.method));
              }}
              className="rounded px-2 py-1 text-xs tracking-widest"
              style={{ backgroundColor: ANCIENT.background, color: ANCIENT.accent, border: `1px solid ${ANCIENT.border}` }}
            >
              {o.label}
            </button>
          ))}
        </div>
      )}

      {resultText && (
        <p className="text-xs leading-relaxed tracking-wider" style={{ color: ANCIENT.secondary }}>
          {resultText}
        </p>
      )}
    </div>
  );
}
