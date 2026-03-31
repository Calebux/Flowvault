import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@mentoguard/shared"],
  serverExternalPackages: ["@walletconnect/universal-provider", "@walletconnect/ethereum-provider"],
  webpack: (config, { isServer }) => {
    if (isServer) {
      config.resolve.alias = {
        ...config.resolve.alias,
        "@walletconnect/universal-provider": false,
        "@walletconnect/ethereum-provider": false,
      };
    } else {
      // Stub out Node.js-only modules for the browser bundle
      config.resolve.alias = {
        ...config.resolve.alias,
        "@react-native-async-storage/async-storage": false,
        "pino-pretty": false,
        lokijs: false,
      };
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
      };
    }
    return config;
  },
};

export default nextConfig;
