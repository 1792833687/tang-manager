/**
 * 掌柜通知弹条（v1.0 打磨 TANG-POLISH-001 模块四；notification-toast）
 * 右上角固定堆叠：3s 自动消失、可点击跳转、类型 5 种（info/success/warning/error/unlock）、
 * 最多 3 条排队；古风令牌配色。
 * 供功能解锁（unlock-toast）、高风险二次确认回执、账本分页提示等统一复用。
 * 不持有游戏状态；数据来自 tang-notification store。
 */
'use client';
import { useEffect } from 'react';
import { useTangNotificationStore, type TangNotificationType } from '@/stores/tang-notification';
import { ANCIENT } from '@/theme/tokens';

const TYPE_STYLE: Record<TangNotificationType, { label: string; color: string; bg: string }> = {
  info: { label: '讯', color: ANCIENT.primary, bg: ANCIENT.card },
  success: { label: '喜', color: ANCIENT.gold, bg: '#FBF4E6' },
  warning: { label: '警', color: '#C77B1E', bg: '#FBF0E0' },
  error: { label: '险', color: ANCIENT.accent, bg: '#FBEAE6' },
  unlock: { label: '启', color: ANCIENT.accent, bg: '#FBF4E6' },
};

/** 自动消失 3s（每个 toast 独立计时） */
function ToastCard({
  id,
  type,
  title,
  content,
  onClick,
}: {
  id: string;
  type: TangNotificationType;
  title: string;
  content?: string;
  onClick?: () => void;
}): React.ReactElement {
  const dismiss = useTangNotificationStore((s) => s.dismiss);
  useEffect(() => {
    const t = setTimeout(() => dismiss(id), 3000);
    return () => clearTimeout(t);
  }, [id, dismiss]);

  const style = TYPE_STYLE[type];

  return (
    <button
      type="button"
      onClick={() => {
        if (onClick) onClick();
        dismiss(id);
      }}
      className="pointer-events-auto flex w-64 items-start gap-2 rounded-lg px-3 py-2 text-left transition-opacity hover:opacity-90"
      style={{
        backgroundColor: style.bg,
        border: `1px solid ${style.color}`,
        boxShadow: `0 0 0 1px ${ANCIENT.gold} inset, 0 6px 16px rgba(60,40,20,0.18)`,
        animation: 'modal-slide-up 0.2s ease-out',
      }}
    >
      <span
        className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white"
        style={{ backgroundColor: style.color }}
      >
        {style.label}
      </span>
      <span className="min-w-0">
        <span className="block text-xs font-bold tracking-widest" style={{ color: ANCIENT.text }}>
          {title}
        </span>
        {content && (
          <span className="mt-0.5 block text-[11px] leading-snug" style={{ color: ANCIENT.secondary }}>
            {content}
          </span>
        )}
      </span>
    </button>
  );
}

export function NotificationToast(): React.ReactElement {
  const notifications = useTangNotificationStore((s) => s.notifications);
  if (notifications.length === 0) return <></>;
  return (
    <div className="pointer-events-none fixed right-3 top-3 z-[130] flex flex-col gap-2">
      {notifications.map((n) => (
        <ToastCard key={n.id} id={n.id} type={n.type} title={n.title} content={n.content} onClick={n.onClick} />
      ))}
    </div>
  );
}
