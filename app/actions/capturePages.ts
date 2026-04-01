'use server';

import puppeteerCore from 'puppeteer-core';
import chromium from '@sparticuz/chromium';
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
}

const MIN_OVERLAY_SIZE = 2000;

function getCaptureDir(captureId: string) {
    return path.join(os.tmpdir(), 'captures', captureId);
}

function getStatusPath(captureId: string) {
    return path.join(getCaptureDir(captureId), '_status.json');
}

function writeStatus(captureId: string, status: CaptureStatus) {
    const statusPath = getStatusPath(captureId);
    fs.writeFileSync(statusPath, JSON.stringify(status));
}

async function launchBrowser() {
    const isServerless = process.env.K_SERVICE || process.env.FUNCTION_TARGET || process.env.GCLOUD_PROJECT;

    if (isServerless) {
        const binDir = '/workspace/node_modules/@sparticuz/chromium/bin';
        const execPath = await chromium.executablePath(binDir);
        return await puppeteerCore.launch({
            args: chromium.args,
            executablePath: execPath,
            headless: true,
        });
    }

    const localChrome = process.platform === 'win32'
        ? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
        : '/usr/bin/google-chrome';

    return await puppeteerCore.launch({
        executablePath: process.env.CHROME_PATH || localChrome,
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
    });
}

// Step 1: Start capture - returns captureId immediately, runs capture in background
export async function startCapture(url: string): Promise<{ captureId: string; error?: string }> {
    if (!url || !url.startsWith('http')) {
        return { captureId: '', error: '유효한 URL을 입력해주세요.' };
    }

    const captureId = `cap_${Date.now()}`;
    const captureDir = getCaptureDir(captureId);
    fs.mkdirSync(captureDir, { recursive: true });

    // Write initial status
    writeStatus(captureId, { status: 'capturing', progress: '페이지 접속 중...' });

    // Run capture in background (don't await)
    runCapture(captureId, url, captureDir).catch(err => {
        console.error('Background capture error:', err);
        writeStatus(captureId, {
            status: 'error',
            result: {
                captureId, studentName: '', className: '', materialName: '',
                totalPages: 0, filteredCount: 0,
                error: err instanceof Error ? err.message : '캡처 실패',
            }
        });
    });

    return { captureId };
}

// Step 2: Check capture status - client polls this
export async function checkCapture(captureId: string): Promise<CaptureStatus> {
    const statusPath = getStatusPath(captureId);
    if (!fs.existsSync(statusPath)) {
        return { status: 'error', result: {
            captureId, studentName: '', className: '', materialName: '',
            totalPages: 0, filteredCount: 0, error: '캡처 세션을 찾을 수 없습니다.',
        }};
    }
    const data = fs.readFileSync(statusPath, 'utf-8');
    return JSON.parse(data) as CaptureStatus;
}

// Background capture logic
async function runCapture(captureId: string, url: string, captureDir: string) {
    let browser;
    try {
        writeStatus(captureId, { status: 'capturing', progress: '브라우저 시작 중...' });
        browser = await launchBrowser();

        const page = await browser.newPage();
        await page.setViewport({ width: 1280, height: 5000 });

        writeStatus(captureId, { status: 'capturing', progress: '페이지 로딩 중...' });
        await page.goto(url, { waitUntil: 'networkidle0', timeout: 90000 });
        await new Promise(r => setTimeout(r, 2000));

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
            writeStatus(captureId, { status: 'capturing', progress: `캡처 중... ${i + 1}/${totalPages}` });

            await new Promise(r => setTimeout(r, 500));

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
                    setTimeout(resolve, 3000);
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

            await new Promise(r => setTimeout(r, 200));

            const filePath = path.join(captureDir, `page_${String(i + 1).padStart(3, '0')}.jpg`);

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
                await new Promise(r => setTimeout(r, 1000));
            }
        }

        await browser.close();

        // Filter: only keep pages with student handwriting
        const allFiles = fs.readdirSync(captureDir).filter(f => f.endsWith('.jpg')).sort();
        const filteredFiles: string[] = [];
        for (let i = 0; i < allFiles.length; i++) {
            if (overlayLengths[i] >= MIN_OVERLAY_SIZE) {
                filteredFiles.push(allFiles[i]);
            }
        }
        const keepFiles = filteredFiles.length > 0 ? filteredFiles : allFiles;
        for (const f of allFiles) {
            if (!keepFiles.includes(f)) {
                fs.unlinkSync(path.join(captureDir, f));
            }
        }

        console.log(`Capture done: ${savedCount} total, ${filteredFiles.length} with student work`);

        writeStatus(captureId, {
            status: 'done',
            result: {
                captureId,
                studentName: info.studentName,
                className: info.className,
                materialName: info.materialName,
                totalPages: savedCount,
                filteredCount: filteredFiles.length > 0 ? filteredFiles.length : savedCount,
            }
        });

    } catch (err) {
        if (browser) await browser.close();
        console.error('Capture error:', err);
        writeStatus(captureId, {
            status: 'error',
            result: {
                captureId, studentName: '', className: '', materialName: '',
                totalPages: 0, filteredCount: 0,
                error: err instanceof Error ? err.message : '캡처 실패',
            }
        });
    }
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
