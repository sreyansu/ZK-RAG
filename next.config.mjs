/** @type {import('next').NextConfig} */
const nextConfig = {
  // Allow snarkjs and circomlibjs to run server-side without bundling issues
  serverExternalPackages: ['snarkjs', 'circomlibjs'],

  // Turbopack config (Next.js 16 default)
  turbopack: {},

  // Webpack config for fallback (used when --webpack flag is passed)
  webpack: (config, { isServer }) => {
    config.experiments = {
      ...config.experiments,
      asyncWebAssembly: true,
      layers: true,
    };

    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        path: false,
        crypto: false,
        stream: false,
        os: false,
        readline: false,
      };
    }

    config.module.rules.push({
      test: /\.wasm$/,
      type: 'asset/resource',
    });

    return config;
  },
};

export default nextConfig;
