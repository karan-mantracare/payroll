/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  basePath: "/payroll",
  serverExternalPackages: ["puppeteer", "@libsql/client", "libsql"],
  outputFileTracingIncludes: {
    "/**": ["./node_modules/@libsql/linux-x64-musl/**/*"],
  },
  reactStrictMode: true,
  poweredByHeader: false,
  async redirects() {
    return [
      {
        source: "/",
        destination: "/payroll/login",
        basePath: false,
        permanent: false,
      },
      {
        source: "/payroll",
        destination: "/payroll/login",
        basePath: false,
        permanent: false,
      },
    ];
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "X-Frame-Options",
            value: "SAMEORIGIN",
          },
          {
            key: "Content-Security-Policy",
            value:
              "frame-ancestors 'self' https://web.mantracare.com https://*.mantracare.com;",
          },
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
        ],
      },
    ];
  },
};

module.exports = nextConfig;

