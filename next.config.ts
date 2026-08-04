import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: 'export',
  compress: true,
  productionBrowserSourceMaps: false,
  images: { unoptimized: true },

  // GitHub Pages 项目站点部署在 /tang-manager/ 子路径：basePath 由构建环境注入
  // （NEXT_PUBLIC_BASE_PATH=/tang-manager → basePath 同值，HTML 资源引用自动加前缀；
  //  本地/EdgeOne 时为空 → 根路径部署不变）。
  // 注意：源 next.config 有 `typescript: { ignoreBuildErrors: true }`（凛冬要塞 store 层
  // 遗留问题），独立项目已移除 —— 新项目必须真实 tsc 通过（typecheck 验收零错误）。
  basePath: process.env.NEXT_PUBLIC_BASE_PATH || '',

  // `output: 'export'`（纯静态导出）不支持 headers/rewrites/redirects。
  // CSP 等安全头需在托管平台（EdgeOne Pages / CDN）配置。

  webpack(config) {
    config.resolve.fallback = {
      fs: false,
      path: false,
      crypto: false,
      net: false,
      tls: false,
    };
    return config;
  },
};

export default nextConfig;
