'use server';

import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';

export interface CaptureResult {
    imagePaths: string[];   // public URL paths to captured images (filtered)
    studentName: string;
    className: string;
    materialName: string;
    totalPages: number;
    filteredCount: number;
    captureId: string;
    error?: string;
}

const MIN_OVERLAY_SIZE = 2000;

export async function capturePages(url: string): Promise<CaptureResult> {
    const empty: CaptureResult = {
        imagePaths: [], studentName: '', className: '', materialName: '',
        totalPages: 0, filteredCount: 0, captureId: '',
    };

    if (!url || !url.startsWith('http')) {
        return { ...empty, error: '유효한 URL을 입력해주세요.' };
    }

    // Create temp directory in public for serving images
    const captureId = `cap_${Date.now()}`;
    const captureDir = path.join(process.cwd(), 'public', 'tmp-captures', captureId);
    fs.mkdirSync(captureDir, { recursive: true });

    let browser;
    try {
        browser = await puppeteer.launch({
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
        });

        const page = await browser.newPage();
        await page.setViewport({ width: 1280, height: 5000 });

        await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
        await new Promise(r => setTimeout(r, 4000));

        // Extract student info & total page count
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
        const allFilePaths: string[] = [];
        const overlayLengths: number[] = [];

        for (let i = 0; i < totalPages; i++) {
            await new Promise(r => setTimeout(r, 1200));

            // Wait for images to fully load
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
                    setTimeout(resolve, 5000);
                });
            });

            // Get overlay data length (detect student handwriting)
            const overlayLen = await page.evaluate(() => {
                const imgs = Array.from(document.querySelectorAll('img'));
                const large = imgs.filter(img => img.getBoundingClientRect().width > 300 && img.getBoundingClientRect().height > 200);
                for (const img of large) {
                    if (img.src.startsWith('data:image')) return img.src.length;
                }
                return 0;
            });
            overlayLengths.push(overlayLen);

            // Screenshot the container
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

            await new Promise(r => setTimeout(r, 500));

            const fileName = `page_${i + 1}.jpg`;
            const filePath = path.join(captureDir, fileName);
            const publicPath = `/tmp-captures/${captureId}/${fileName}`;

            try {
                await containerHandle.screenshot({
                    path: filePath, type: 'jpeg', quality: 92,
                });
                allFilePaths.push(publicPath);
            } catch {
                // Fallback: viewport screenshot
                await page.evaluate(() => {
                    const imgs = Array.from(document.querySelectorAll('img'));
                    let best: Element | null = null, maxA = 0;
                    for (const img of imgs) {
                        const r = img.getBoundingClientRect();
                        if (r.width * r.height > maxA) { maxA = r.width * r.height; best = img; }
                    }
                    if (best) best.scrollIntoView({ block: 'start' });
                });
                await new Promise(r => setTimeout(r, 300));
                try {
                    await page.screenshot({ path: filePath, type: 'jpeg', quality: 92, fullPage: false });
                    allFilePaths.push(publicPath);
                } catch {
                    // skip
                }
            }

            // Navigate to next page
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
                await new Promise(r => setTimeout(r, 1500));
            }
        }

        await browser.close();

        // Filter: only pages with student handwriting
        const filteredPaths: string[] = [];
        for (let i = 0; i < allFilePaths.length; i++) {
            if (overlayLengths[i] >= MIN_OVERLAY_SIZE) {
                filteredPaths.push(allFilePaths[i]);
            }
        }

        const imagePaths = filteredPaths.length > 0 ? filteredPaths : allFilePaths;

        console.log(`Capture done: ${allFilePaths.length} total, ${filteredPaths.length} with student work`);

        return {
            imagePaths,
            studentName: info.studentName,
            className: info.className,
            materialName: info.materialName,
            totalPages: allFilePaths.length,
            filteredCount: filteredPaths.length,
            captureId,
        };

    } catch (err) {
        if (browser) await browser.close();
        console.error('Capture error:', err);
        return { ...empty, error: err instanceof Error ? err.message : '페이지 캡처 중 오류가 발생했습니다.' };
    }
}

// Cleanup old capture directories (call periodically)
export async function cleanupCaptures() {
    const capturesDir = path.join(process.cwd(), 'public', 'tmp-captures');
    if (!fs.existsSync(capturesDir)) return;

    const oneHourAgo = Date.now() - 60 * 60 * 1000;
    const entries = fs.readdirSync(capturesDir);
    for (const entry of entries) {
        const match = entry.match(/^cap_(\d+)$/);
        if (match && parseInt(match[1]) < oneHourAgo) {
            fs.rmSync(path.join(capturesDir, entry), { recursive: true, force: true });
        }
    }
}
