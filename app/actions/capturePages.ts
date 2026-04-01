'use server';

import fs from 'fs';
import os from 'os';
import path from 'path';

export interface CaptureResult {
    captureId: string;
    studentName: string;
    className: string;
    materialName: string;
    totalPages: number;
    filteredCount: number;
    error?: string;
}

export interface CaptureStatus {
    status: 'capturing' | 'done' | 'error';
    progress?: string;
    result?: CaptureResult;
    error?: string;
}

function getCaptureDir(captureId: string) {
    return path.join(os.tmpdir(), 'captures', captureId);
}

function getStatusPath(captureId: string) {
    return path.join(getCaptureDir(captureId), '_status.json');
}

// Step 1: Create capture session and trigger via internal fetch (keeps Cloud Run alive)
export async function startCapture(url: string): Promise<{ captureId: string; error?: string }> {
    if (!url || !url.startsWith('http')) {
        return { captureId: '', error: '유효한 URL을 입력해주세요.' };
    }

    const captureId = `cap_${Date.now()}`;
    const captureDir = getCaptureDir(captureId);
    fs.mkdirSync(captureDir, { recursive: true });
    fs.writeFileSync(getStatusPath(captureId), JSON.stringify({ status: 'capturing', progress: '시작 중...' }));

    // Trigger capture via internal API route call (non-blocking from client perspective)
    // The API route runs in the same Cloud Run instance and keeps it alive
    const baseUrl = process.env.VERCEL_URL || process.env.FUNCTION_TARGET
        ? `https://${process.env.K_SERVICE ? `${process.env.K_SERVICE}-rsrf2sf2jq-du.a.run.app` : 'localhost:3000'}`
        : 'http://localhost:3000';

    // Fire and forget - this fetch keeps the Cloud Run instance busy
    fetch(`${baseUrl}/api/capture`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, captureId }),
    }).catch(err => console.error('Internal capture trigger failed:', err));

    return { captureId };
}

// Step 2: Poll status
export async function checkCapture(captureId: string): Promise<CaptureStatus> {
    const statusPath = getStatusPath(captureId);
    if (!fs.existsSync(statusPath)) {
        return { status: 'error', error: '캡처 세션을 찾을 수 없습니다.' };
    }
    const data = fs.readFileSync(statusPath, 'utf-8');
    return JSON.parse(data) as CaptureStatus;
}

// Read captured images from /tmp as base64 (used by generateReport)
export async function getCaptureImages(captureId: string): Promise<string[]> {
    const captureDir = getCaptureDir(captureId);
    if (!fs.existsSync(captureDir)) return [];

    const files = fs.readdirSync(captureDir).filter(f => f.endsWith('.jpg')).sort();
    return files.map(f => {
        const buffer = fs.readFileSync(path.join(captureDir, f));
        return buffer.toString('base64');
    });
}
