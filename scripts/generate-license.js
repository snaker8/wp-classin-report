const { machineIdSync } = require('node-machine-id');
const crypto = require('crypto');

const SALT = 'CLASSIN_REPORT_SECURE_SALT_2024';

function getMachineId() {
    try {
        return machineIdSync();
    } catch (error) {
        console.error('Failed to get machine ID:', error);
        return 'UNKNOWN_MACHINE_ID';
    }
}

function generateLicenseKey(id) {
    return crypto.createHmac('sha256', SALT).update(id).digest('hex').toUpperCase();
}

const args = process.argv.slice(2);
const customId = args[0];

const id = customId || getMachineId();
const key = generateLicenseKey(id);

console.log('------------------------------------------------');
if (customId) {
    console.log(' Using Custom ID (e.g., Firebase Project ID)');
} else {
    console.log(' Using Local Hardware ID');
}
console.log(' ID         : ', id);
console.log(' LICENSE KEY: ', key);
console.log('------------------------------------------------');
console.log('Add this to your .env.local file:');
console.log(`LICENSE_KEY=${key}`);
