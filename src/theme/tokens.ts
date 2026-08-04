/**
 * 《我在唐朝当掌柜》古风设计令牌 — 独立项目主题令牌
 *
 * 来源：源仓库 src/theme/ancient/tokens.ts（提取时按任务书 @/theme/ → @/theme/ 迁移）。
 * 用途：全站所有 UI 统一引用此处，消除散落硬编码。
 * 说明：以下 8 个主色为需求方指定色值，不得改动。
 * 提取说明：删除源文件中 FROST（凛冬要塞剧本卡片冷灰调），独立项目无凛冬要塞。
 * @module theme/tokens
 */

// ---- 古风主色（需求方指定，精确值，不得改动）----
export const ANCIENT = {
  // 主色
  primary: '#4A7C59',    // 竹青
  secondary: '#8B6F47',  // 檀木
  background: '#F5F0E8', // 宣纸
  accent: '#C0392B',     // 朱砂
  text: '#2C2C2C',       // 墨色
  card: '#FDF6F0',       // 米白
  border: '#8B5E3C',     // 深檀
  gold: '#D4A843',       // 描金
} as const;

export type AncientColor = keyof typeof ANCIENT;

// ---- 古风字体族 ----
// 字体决策（详见 scripts/layout.tsx 与回传报告）：
// 本仓库 Next.js 版本内置 font-data 中，Noto Serif SC / Noto Sans SC 仅有
// latin/cyrillic/latin-ext/vietnamese 子集，无法自托管中文字形；
// 故采用「Google Fonts 家族名优先 + 系统字体回退」声明栈，运行时零外网请求。
export const ANCIENT_FONT = {
  serif: `'Noto Serif SC','Songti SC','STSong','SimSun',serif`,
  sans: `'Noto Sans SC','PingFang SC','Microsoft YaHei','Hiragino Sans GB',sans-serif`,
} as const;

/** 供 CSS 变量注入使用的变量名（scripts 布局注入 :root） */
export const ANCIENT_FONT_VAR = {
  serif: '--font-ancient-serif',
  sans: '--font-ancient-sans',
} as const;

// ---- 美术资源统一登记（public/images 下；引用时用 withBase() 拼接以兼容子路径部署）----
export const ANCIENT_ASSETS = {
  /** 导航栏唐草纹背景（200×800，纵向重复） */
  navBg: '/images/ui/nav-bg.svg',
  /** 描金如意纹面板边框（9-slice，配合 border-image 使用） */
  panelBorder: '/images/ui/panel-border.svg',
  /** 云纹描金分割线 */
  divider: '/images/ui/divider.svg',
  /** 竹青丝绸按钮纹理（叠加在竹青主色按钮上） */
  btnBg: '/images/ui/btn-bg.svg',
} as const;
