
/** @type {import('next').NextConfig} */
const nextConfig = {
    experimental: {
        instrumentationHook: true,
        serverActions: {
            bodySizeLimit: '10mb',
        },
    },
    webpack: (config, { dev, isServer }) => {
        // Obfuscation removed due to build errors and deployment issues.
        return config;
    },
};


