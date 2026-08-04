import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: 'export',
  compress: true,
  productionBrowserSourceMaps: false,
  images: { unoptimized: true },

  // 独立项目：不做子路径部署（basePath 空），如需 GitHub Pages 子路径由构建环境注入。
  // 注意：源 next.config 有 `typescript: { ignoreBuildErrors: true }`（凛冬要塞 store 层
  // 遗留问题），独立项目已移除 —— 新项目必须真实 tsc 通过（typecheck 验收零错误）。
  basePath: '',

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
