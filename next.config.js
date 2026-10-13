/** @type {import('next').NextConfig} */
module.exports = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Keep an existing development server from overwriting production manifests.
  distDir: process.env.NODE_ENV === 'production' ? '.next-production' : '.next-dev',
};
