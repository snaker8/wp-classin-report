
/** @type {import('next').NextConfig} */
const nextConfig = {
    experimental: {
        instrumentationHook: true,
        serverActions: {
            bodySizeLimit: '100mb',
        },
        serverComponentsExternalPackages: ['puppeteer-core', '@sparticuz/chromium'],
    },
    serverActions: {
        bodySizeLimit: '100mb',
    },
    serverExternalPackages: ['puppeteer-core', '@sparticuz/chromium'],
    webpack: (config, { isServer }) => {
        if (isServer) {
            config.externals = config.externals || [];
            config.externals.push({
                'puppeteer-core': 'commonjs puppeteer-core',
                '@sparticuz/chromium': 'commonjs @sparticuz/chromium',
            });
        }
        return config;
    },
};


