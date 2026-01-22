import WebpackObfuscator from 'webpack-javascript-obfuscator';

/** @type {import('next').NextConfig} */
const nextConfig = {
    experimental: {
        instrumentationHook: true,
    },
    webpack: (config, { dev, isServer }) => {
        // Only obfuscate in production and only for server-side code (to protect the license check)
        // or both if desired. Obfuscating client-side code can affect performance and debugging.
        // Here we focus on protecting the server logic including instrumentation.
        if (!dev && isServer) {
            config.plugins.push(
                new WebpackObfuscator(
                    {
                        rotateStringArray: true,
                        stringArray: true,
                        stringArrayEncoding: ['rc4'], // strong encoding
                        stringArrayThreshold: 0.75,
                        controlFlowFlattening: true,
                        controlFlowFlatteningThreshold: 0.75,
                        deadCodeInjection: true,
                        deadCodeInjectionThreshold: 0.4,
                        debugProtection: true,
                        disableConsoleOutput: false, // Keep true if you want to hide logs, but we have some allowed logs
                        identifierNamesGenerator: 'hexadecimal',
                        log: false,
                        renameGlobals: false,
                        selfDefending: true,
                        splitStrings: true,
                        splitStringsChunkLength: 10,
                    },
                    [] // Exclude files if necessary
                )
            );
        }
        return config;
    },
};

export default nextConfig;

