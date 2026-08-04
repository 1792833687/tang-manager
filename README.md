# 《我在唐朝当掌柜》（Tang Manager）

长安东市，一间铺面，一本手札。商海浮沉，从陆记起步。

纯前端文字经营游戏 · 独立项目（自 watchparty 仓库提取，与凛冬要塞解耦）。

## 技术栈
- Next.js 15（静态导出 `output: export`）+ TypeScript（strict）
- Zustand v5（persist v16）+ Tailwind CSS 3
- Vitest（73 测试文件 / 1000 用例）+ Zod + idb + uuid

## 常用命令
| 命令 | 说明 |
|---|---|
| `npm run dev` | 本地开发 |
| `npm run typecheck` | tsc 零错误验收 |
| `npm run test:unit` | 全量单测 |
| `npm run build` | 静态导出到 `out/` |
| `npm run validate:data` | 数值校验（开局容量/30 天不破产） |

## 部署
- GitHub Pages：`push main` → Actions（`.github/workflows/deploy.yml`）构建并推 `gh-pages`
- 线上：<https://1792833687.github.io/tang-manager/>

## 目录速览
- `src/systems/` 62 个领域系统纯函数（经营/库存/金融/地图/NPC/结局等）
- `src/stores/tang-manager.ts` 主 store（persist v16）
- `src/config/` 35 个配置（古风文案/数值/事件池）
- `src/theme/tokens.ts` ANCIENT 设计令牌（唯一事实源）
- `public/images/` 155 美术资源
