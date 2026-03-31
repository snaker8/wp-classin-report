
/** @type {import('next').NextConfig} */
const nextConfig = {
    experimental: {
        instrumentationHook: true,
        serverActions: {
            bodySizeLimit: '100mb',
        },
    },
    serverActions: {
        bodySizeLimit: '100mb',
    },
    serverExternalPackages: ['puppeteer', 'puppeteer-core', '@sparticuz/chromium'],
    webpack: (config, { dev, isServer }) => {
        // Obfuscation removed due to build errors and deployment issues.
        return config;
    },
};


