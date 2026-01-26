
/** @type {import('next').NextConfig} */
const nextConfig = {
    experimental: {
        instrumentationHook: true,
        serverActions: {
            bodySizeLimit: '10mb',
        },
    },
    webpack: (config, { dev, isServer }) => {
        // Only obfuscate in production and only for server-side code (to protect the license check)
        // or both if desired. Obfuscating client-side code can affect performance and debugging.
        // Here we focus on protecting the server logic including instrumentation.
        if (!dev && isServer) {
            // Obfuscation is currently causing build errors with Firebase/Next.js.
            // Disabling it for now to ensure deployment succeeds. The License Check is still active.
            /*
            config.plugins.push(
                new WebpackObfuscator(
                    {
                        rotateStringArray: true,
                         // ... options ...
                    },
                    [] 
                )
            );
            */
        }
        return config;
    },
};

export default nextConfig;

