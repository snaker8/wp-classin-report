export async function register() {
    if (process.env.NEXT_RUNTIME === 'nodejs') {
        // Skip license check on Firebase Cloud Functions / Google Cloud Run
        // These environments don't have stable hardware IDs
        const isCloudEnvironment =
            process.env.K_SERVICE || // Cloud Run
            process.env.FUNCTION_TARGET || // Cloud Functions
            process.env.GOOGLE_CLOUD_PROJECT || // GCP
            process.env.FIREBASE_CONFIG; // Firebase

        if (isCloudEnvironment) {
            console.log('☁️ Cloud environment detected - License check skipped');
            return;
        }

        const { verifyLicense } = await import('./lib/security');

        console.log('🔒 Verifying Security License...');
        const authorized = verifyLicense();

        if (!authorized) {
            console.error('YOUR APPLICATION IS NOT AUTHORIZED TO RUN ON THIS DEVICE.');
            console.error('Please contact the administrator for a valid license key.');
            process.exit(1);
        }
    }
}
