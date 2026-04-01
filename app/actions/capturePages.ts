'use server';

import { db } from '@/lib/firebase';
import { doc, setDoc, getDoc, collection, getDocs, query, orderBy } from 'firebase/firestore';

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

// Step 1: Create capture session and trigger API route
export async function startCapture(url: string): Promise<{ captureId: string; error?: string }> {
    if (!url || !url.startsWith('http')) {
        return { captureId: '', error: '유효한 URL을 입력해주세요.' };
    }

    const captureId = `cap_${Date.now()}`;

    // Write initial status to Firestore
    await setDoc(doc(db, 'captures', captureId), {
        status: 'capturing',
        progress: '시작 중...',
        url,
        createdAt: new Date().toISOString(),
    });

    // Trigger capture via internal API route (fire-and-forget)
    const selfUrl = process.env.K_SERVICE
        ? `https://ssrwpclassinreport-rsrf2sf2jq-du.a.run.app`
        : 'http://localhost:3001';

    fetch(`${selfUrl}/api/capture`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, captureId }),
    }).catch(err => console.error('Capture trigger failed:', err));

    return { captureId };
}

// Step 2: Poll status from Firestore (works across any instance)
export async function checkCapture(captureId: string): Promise<CaptureStatus> {
    try {
        const snap = await getDoc(doc(db, 'captures', captureId));
        if (!snap.exists()) {
            return { status: 'error', error: '캡처 세션을 찾을 수 없습니다.' };
        }
        return snap.data() as CaptureStatus;
    } catch (err) {
        return { status: 'error', error: '상태 확인 실패' };
    }
}

// Read captured images from Firestore sub-collection (used by generateReport)
export async function getCaptureImages(captureId: string): Promise<string[]> {
    try {
        const imagesRef = collection(db, 'captures', captureId, 'images');
        const q = query(imagesRef, orderBy('page'));
        const snap = await getDocs(q);
        return snap.docs.map(d => d.data().base64 as string);
    } catch {
        return [];
    }
}
