import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: ['@ai-sales-agent/config', '@ai-sales-agent/contracts'],
};

export default nextConfig;
