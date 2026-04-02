import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { doc, updateDoc, setDoc } from 'firebase/firestore';
import os from 'os';
import fs from 'fs';
import path from 'path';

export const maxDuration = 300;
export const dynamic = 'force-dynamic';

// Overlay = student handwriting layer (data:image PNG on transparent background)
// Empty overlay (no writing) is still ~200-500 chars of base64 header
// Any actual writing makes it 1000+ chars, so threshold 500 catches all real work
const MIN_OVERLAY_SIZE = 500;

async function updateStatus(captureId: string, data: Record<string, unknown>) {
    await updateDoc(doc(db, 'captures', captureId), data);
}

export async function POST(req: NextRequest) {
    const { url, captureId } = await req.json();

    if (!url || !captureId) {
        return NextResponse.json({ error: 'Missing url or captureId' }, { status: 400 });
    }

    const captureDir = path.join(os.tmpdir(), 'captures', captureId);
    fs.mkdirSync(captureDir, { recursive: true });

    try {
        await updateStatus(captureId, { status: 'capturing', progress: '브라우저 시작 중...' });

        const puppeteerCore = await import('puppeteer-core');
        const isServerless = process.env.K_SERVICE || process.env.FUNCTION_TARGET || process.env.GCLOUD_PROJECT;

        let browser;
        if (isServerless) {
            const chromium = await import('@sparticuz/chromium');
            const binDir = '/workspace/node_modules/@sparticuz/chromium/bin';
            const execPath = await chromium.default.executablePath(binDir);
            browser = await puppeteerCore.default.launch({
                args: [
                    ...chromium.default.args,
                    '--disable-features=AudioServiceOutOfProcess',
                    '--disable-dev-shm-usage',
                    '--disable-gpu',
                    '--single-process',
                    '--no-zygote',
                ],
                executablePath: execPath,
                headless: true,
            });
        } else {
            const localChrome = process.platform === 'win32'
                ? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
                : '/usr/bin/google-chrome';
            browser = await puppeteerCore.default.launch({
                executablePath: process.env.CHROME_PATH || localChrome,
                headless: true,
                args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
            });
        }

        try {
            const page = await browser.newPage();
            await page.setViewport({ width: 1280, height: 5000 });

            await updateStatus(captureId, { status: 'capturing', progress: '페이지 로딩 중...' });
            await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
            await page.waitForSelector('img', { timeout: 30000 }).catch(() => {});
            await new Promise(r => setTimeout(r, 2000));

            const info = await page.evaluate(() => {
                const lines = document.body.innerText.split('\n').map(l => l.trim()).filter(Boolean);
                const studentName = lines[0] || '';
                let className = '', materialName = '';
                for (let i = 0; i < lines.length; i++) {
                    if (lines[i] === '클래스' && lines[i + 1]) className = lines[i + 1];
                    if (lines[i] === '학습 자료' && lines[i + 1]) materialName = lines[i + 1];
                }
                const spans = Array.from(document.querySelectorAll('span, div, p'));
                let pageTotal = 0;
                for (const el of spans) {
                    const text = el.textContent.trim();
                    const match = text.match(/^(\d+)\s*\/\s*(\d+)$/);
                    if (match) { pageTotal = parseInt(match[2]); break; }
                }
                return { studentName, className, materialName, pageTotal };
            });

            const totalPages = info.pageTotal || 30;
            const overlayLengths: number[] = [];
            const capturedBase64: string[] = [];

            for (let i = 0; i < totalPages; i++) {
                await updateStatus(captureId, { status: 'capturing', progress: `캡처 중... ${i + 1}/${totalPages}` });
                await new Promise(r => setTimeout(r, 500));

                await page.evaluate(() => {
                    return new Promise<void>((resolve) => {
                        const imgs = Array.from(document.querySelectorAll('img'));
                        const large = imgs.filter(img => img.getBoundingClientRect().width > 300);
                        const pending = large.filter(img => !img.complete);
                        if (pending.length === 0) return resolve();
                        let count = 0;
                        pending.forEach(img => {
                            img.onload = () => { if (++count >= pending.length) resolve(); };
                        });
                        setTimeout(resolve, 3000);
                    });
                });

                const overlayLen = await page.evaluate(() => {
                    const imgs = Array.from(document.querySelectorAll('img'));
                    const large = imgs.filter(img => img.getBoundingClientRect().width > 300 && img.getBoundingClientRect().height > 200);
                    for (const img of large) {
                        if (img.src.startsWith('data:image')) return img.src.length;
                    }
                    return 0;
                });
                overlayLengths.push(overlayLen);

                const containerHandle = await page.evaluateHandle(() => {
                    const imgs = Array.from(document.querySelectorAll('img'));
                    const large = imgs.filter(img => {
                        const r = img.getBoundingClientRect();
                        return r.width > 300 && r.height > 200;
                    });
                    if (large.length === 0) return document.body;
                    let container = large[0].parentElement;
                    while (container && container !== document.body) {
                        const contained = Array.from(container.querySelectorAll('img')).filter(img => {
                            const r = img.getBoundingClientRect();
                            return r.width > 300 && r.height > 200;
                        });
                        if (contained.length >= large.length) break;
                        container = container.parentElement;
                    }
                    if (container) container.scrollIntoView({ block: 'start' });
                    return container || large[0];
                });

                await new Promise(r => setTimeout(r, 200));

                try {
                    const screenshot = await containerHandle.screenshot({ encoding: 'base64', type: 'jpeg', quality: 85 });
                    capturedBase64.push(screenshot as string);
                } catch {
                    try {
                        const ss = await page.screenshot({ encoding: 'base64', type: 'jpeg', quality: 85, fullPage: false });
                        capturedBase64.push(ss as string);
                    } catch { /* skip */ }
                }

                if (i < totalPages - 1) {
                    const hasNext = await page.evaluate(() => {
                        const allBtns = document.querySelectorAll('button.p-button');
                        if (allBtns.length > 0) {
                            const lastBtn = allBtns[allBtns.length - 1];
                            if (!lastBtn.classList.contains('p-disabled')) {
                                (lastBtn as HTMLElement).click();
                                return true;
                            }
                        }
                        return false;
                    });
                    if (!hasNext) break;
                    await new Promise(r => setTimeout(r, 1000));
                }
            }

            await browser.close();

            // Filter: only keep pages with student handwriting
            const filteredImages: string[] = [];
            for (let i = 0; i < capturedBase64.length; i++) {
                if (overlayLengths[i] >= MIN_OVERLAY_SIZE) {
                    filteredImages.push(capturedBase64[i]);
                }
            }
            const finalImages = filteredImages.length > 0 ? filteredImages : capturedBase64;

            console.log(`Capture done: ${capturedBase64.length} total, ${filteredImages.length} with student work`);

            // Store images in sub-collection (each image as separate doc to avoid 1MB limit)
            for (let i = 0; i < finalImages.length; i++) {
                await setDoc(doc(db, 'captures', captureId, 'images', String(i)), {
                    base64: finalImages[i],
                    page: i + 1,
                });
            }

            await updateStatus(captureId, {
                status: 'done',
                progress: '완료',
                imageCount: finalImages.length,
                result: {
                    captureId,
                    studentName: info.studentName,
                    className: info.className,
                    materialName: info.materialName,
                    totalPages: capturedBase64.length,
                    filteredCount: filteredImages.length > 0 ? filteredImages.length : capturedBase64.length,
                }
            });

        } catch (err) {
            await browser.close();
            throw err;
        }

    } catch (err) {
        console.error('Capture error:', err);
        await updateStatus(captureId, {
            status: 'error',
            error: err instanceof Error ? err.message : '캡처 실패',
        });
    }

    return NextResponse.json({ ok: true });
}
