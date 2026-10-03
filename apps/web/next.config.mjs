/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@whiteboard/shared'],
  experimental: {
    serverActions: {
      bodySizeLimit: '10mb',
    },
  },
  webpack: (config) => {
    config.resolve.alias.canvas = false;
    return config;
  },
};

export default nextConfig;
