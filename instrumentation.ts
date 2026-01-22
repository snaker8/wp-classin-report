export async function register() {
    if (process.env.NEXT_RUNTIME === 'nodejs') {
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
