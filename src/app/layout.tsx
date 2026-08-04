/**
 * 根布局 — 《我在唐朝当掌柜》独立项目
 *
 * 由源仓库 src/app/scripts/layout.tsx（剧本模块嵌套布局）演进而来：
 * 独立项目无凛冬要塞，剧本模块布局直接升为根布局，全站统一古风主题
 * （宣纸底 / 墨色文字 / 古风字体族声明栈）。
 *
 * 字体决策（沿用源 scripts/layout.tsx 结论）：
 * 采用「Google Fonts 家族名优先 + 系统字体回退」声明栈（ANCIENT_FONT），
 * 经 CSS 变量注入 :root；运行时零外网请求，与项目离线优先策略一致。
 */
import type { Metadata } from 'next';
import './globals.css';
import { ANCIENT, ANCIENT_FONT, ANCIENT_FONT_VAR } from '@/theme/tokens';

export const metadata: Metadata = {
  title: '我在唐朝当掌柜',
  description: '长安东市，一间铺面，一本手札。商海浮沉，从陆记起步。',
};

/** CSS 变量注入串（古风字体族） */
const ANCIENT_VARS = `:root{${ANCIENT_FONT_VAR.serif}:${ANCIENT_FONT.serif};${ANCIENT_FONT_VAR.sans}:${ANCIENT_FONT.sans};}`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>): React.ReactElement {
  return (
    <html lang="zh-CN">
      <body
        className="antialiased"
        style={{
          backgroundColor: ANCIENT.background,
          color: ANCIENT.text,
          fontFamily: `var(${ANCIENT_FONT_VAR.serif})`,
        }}
      >
        <style dangerouslySetInnerHTML={{ __html: ANCIENT_VARS }} />
        {children}
        {/* PWA：注册 service worker — 离线缓存 + 可安装 APP（network-first） */}
        <script
          dangerouslySetInnerHTML={{
            __html: `if ('serviceWorker' in navigator && location.protocol === 'https:') { window.addEventListener('load', function () { var base = ${JSON.stringify(process.env.NEXT_PUBLIC_BASE_PATH || '')}; navigator.serviceWorker.register((base || '') + '/sw.js').catch(function () {}); }); }`,
          }}
        />
      </body>
    </html>
  );
}
