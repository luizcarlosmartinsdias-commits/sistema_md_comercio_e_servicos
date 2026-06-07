/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    outputFileTracingIncludes: {
      '/api/setup/migrate': [
        './prisma/schema.prisma',
        './prisma/migrations/**/*',
        './node_modules/prisma/**/*',
        './node_modules/@prisma/engines/**/*'
      ]
    }
  }
};
export default nextConfig;
