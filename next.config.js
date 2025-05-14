/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    fontLoaders: [
      { loader: '@next/font/google', options: { timeout: 20000 } }
    ],
  },
};

module.exports = nextConfig;