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

const MIN_OVERLAY_SIZE = 2000;

export async function capturePages(url: string): Promise<CaptureResult> {
    const empty: CaptureResult = {
        captureId: '', studentName: '', className: '', materialName: '',
        totalPages: 0, filteredCount: 0,
    };

    if (!url || !url.startsWith('http')) {
        return { ...empty, error: '유효한 URL을 입력해주세요.' };
    }

    // Use /tmp for serverless, os.tmpdir() for local
    const captureId = `cap_${Date.now()}`;
    const captureDir = path.join(os.tmpdir(), 'captures', captureId);
    fs.mkdirSync(captureDir, { recursive: true });

    let browser;
    try {
        // Dynamic import to handle different environments
        let puppeteer: typeof import('puppeteer-core');
        let executablePath: string;
        let args: string[];

        try {
            // Try serverless chromium first (Firebase/Cloud Run)
            const chromium = await import('@sparticuz/chromium');
            puppeteer = await import('puppeteer-core');
            executablePath = await chromium.default.executablePath() || '';
            args = chromium.default.args;
        } catch {
            // Fallback: try regular puppeteer (local dev)
            try {
                const pup = await import('puppeteer');
                const launched = await pup.default.launch({
                    headless: true,
                    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
                });
                browser = launched;
                puppeteer = null as never; // skip the launch below
                executablePath = '';
                args = [];
            } catch {
                // Last resort: puppeteer-core with system Chrome
                puppeteer = await import('puppeteer-core');
                executablePath = process.env.CHROME_PATH ||
                    (process.platform === 'win32'
                        ? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
                        : '/usr/bin/google-chrome');
                args = ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu'];
            }
        }

        if (!browser) {
            browser = await puppeteer.default.launch({
                args,
                defaultViewport: null,
                executablePath,
                headless: true,
            });
        }

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
        const overlayLengths: number[] = [];
        let savedCount = 0;

        for (let i = 0; i < totalPages; i++) {
            await new Promise(r => setTimeout(r, 1200));

            // Wait for images to load
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

            const filePath = path.join(captureDir, `page_${i + 1}.jpg`);

            try {
                await containerHandle.screenshot({ path: filePath, type: 'jpeg', quality: 92 });
                savedCount++;
            } catch {
                try {
                    await page.screenshot({ path: filePath, type: 'jpeg', quality: 92, fullPage: false });
                    savedCount++;
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

        // Filter: only keep pages with student handwriting
        const allFiles = fs.readdirSync(captureDir).sort();
        const filteredFiles: string[] = [];
        for (let i = 0; i < allFiles.length; i++) {
            if (overlayLengths[i] >= MIN_OVERLAY_SIZE) {
                filteredFiles.push(allFiles[i]);
            }
        }
        // Remove non-filtered files, keep filtered ones
        const keepFiles = filteredFiles.length > 0 ? filteredFiles : allFiles;
        for (const f of allFiles) {
            if (!keepFiles.includes(f)) {
                fs.unlinkSync(path.join(captureDir, f));
            }
        }

        console.log(`Capture done: ${savedCount} total, ${filteredFiles.length} with student work, saved to ${captureDir}`);

        return {
            captureId,
            studentName: info.studentName,
            className: info.className,
            materialName: info.materialName,
            totalPages: savedCount,
            filteredCount: filteredFiles.length > 0 ? filteredFiles.length : savedCount,
        };

    } catch (err) {
        if (browser) await browser.close();
        console.error('Capture error:', err);
        return { ...empty, error: err instanceof Error ? `${err.message}` : '페이지 캡처 중 오류가 발생했습니다.' };
    }
}

// Read captured images from /tmp as base64 (used by generateReport)
export async function getCaptureImages(captureId: string): Promise<string[]> {
    const captureDir = path.join(os.tmpdir(), 'captures', captureId);
    if (!fs.existsSync(captureDir)) return [];

    const files = fs.readdirSync(captureDir).filter(f => f.endsWith('.jpg')).sort();
    return files.map(f => {
        const buffer = fs.readFileSync(path.join(captureDir, f));
        return buffer.toString('base64');
    });
}
