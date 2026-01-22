import { machineIdSync } from 'node-machine-id';
import crypto from 'crypto';

const SALT = 'CLASSIN_REPORT_SECURE_SALT_2024'; // Internal secret salt

export function getMachineId(): string {
    try {
        // 1. Check for Firebase/GCP Project ID (Serverless Environment)
        // GCLOUD_PROJECT is automatically set in Firebase Functions / Cloud Run
        if (process.env.GCLOUD_PROJECT) {
            return process.env.GCLOUD_PROJECT;
        }

        // 2. Fallback to Hardware ID (Local/VM Environment)
        return machineIdSync();
    } catch (error) {
        console.error('Failed to get machine ID:', error);
        return 'UNKNOWN_MACHINE_ID';
    }
}

export function generateLicenseKey(id: string): string {
    // Simple HMAC-SHA256 signature of the machine ID
    return crypto.createHmac('sha256', SALT).update(id).digest('hex').toUpperCase();
}

export function verifyLicense(): boolean {
    const currentId = getMachineId();
    const expectedLicense = process.env.LICENSE_KEY;

    if (!expectedLicense) {
        console.error('Security Violation: No LICENSE_KEY provided.');
        return false;
    }

    const validLicense = generateLicenseKey(currentId);

    if (expectedLicense !== validLicense) {
        console.error(`Security Violation: Invalid license for machine ID: ${currentId}`);
        return false;
    }

    console.log('Secure License Verified.');
    return true;
}
