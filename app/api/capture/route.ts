import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import os from 'os';
import path from 'path';

const MIN_OVERLAY_SIZE = 2000;

function getCaptureDir(captureId: string) {
    return path.join(os.tmpdir(), 'captures', captureId);
}

function getStatusPath(captureId: string) {
    return path.join(getCaptureDir(captureId), '_status.json');
}

// GET /api/capture?id=xxx - check status
// POST /api/capture - start capture (long-running, streamed)
export async function GET(req: NextRequest) {
    const captureId = req.nextUrl.searchParams.get('id');
    if (!captureId) {
        return NextResponse.json({ status: 'error', error: 'Missing capture ID' });
    }

    const statusPath = getStatusPath(captureId);
    if (!fs.existsSync(statusPath)) {
        return NextResponse.json({ status: 'error', error: '캡처 세션을 찾을 수 없습니다.' });
    }

    const data = JSON.parse(fs.readFileSync(statusPath, 'utf-8'));
    return NextResponse.json(data);
}

export async function POST(req: NextRequest) {
    const { url } = await req.json();

    if (!url || !url.startsWith('http')) {
        return NextResponse.json({ error: '유효한 URL을 입력해주세요.' }, { status: 400 });
    }

    const captureId = `cap_${Date.now()}`;
    const captureDir = getCaptureDir(captureId);
    fs.mkdirSync(captureDir, { recursive: true });

    // Return captureId immediately via streaming, then continue capture
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
        async start(controller) {
            // Send captureId immediately
            controller.enqueue(encoder.encode(JSON.stringify({ captureId, status: 'started' }) + '\n'));

            try {
                await runCapture(captureId, url, captureDir, (progress: string) => {
                    // Write progress to status file
                    fs.writeFileSync(getStatusPath(captureId), JSON.stringify({
                        status: 'capturing', progress,
                    }));
                });
            } catch (err) {
                fs.writeFileSync(getStatusPath(captureId), JSON.stringify({
                    status: 'error',
                    error: err instanceof Error ? err.message : '캡처 실패',
                }));
            }

            controller.close();
        }
    });

    return new Response(stream, {
        headers: { 'Content-Type': 'application/x-ndjson' },
    });
}

async function runCapture(
    captureId: string,
    url: string,
    captureDir: string,
    onProgress: (msg: string) => void
) {
    const puppeteerCore = await import('puppeteer-core');
    const isServerless = process.env.K_SERVICE || process.env.FUNCTION_TARGET || process.env.GCLOUD_PROJECT;

    let browser;

    if (isServerless) {
        const chromium = await import('@sparticuz/chromium');
        const binDir = '/workspace/node_modules/@sparticuz/chromium/bin';
        const execPath = await chromium.default.executablePath(binDir);
        browser = await puppeteerCore.default.launch({
            args: chromium.default.args,
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

        onProgress('페이지 로딩 중...');
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
        let savedCount = 0;

        for (let i = 0; i < totalPages; i++) {
            onProgress(`캡처 중... ${i + 1}/${totalPages}`);
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

            const filePath = path.join(captureDir, `page_${String(i + 1).padStart(3, '0')}.jpg`);
            try {
                await containerHandle.screenshot({ path: filePath, type: 'jpeg', quality: 92 });
                savedCount++;
            } catch {
                try {
                    await page.screenshot({ path: filePath, type: 'jpeg', quality: 92, fullPage: false });
                    savedCount++;
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

        fs.writeFileSync(getStatusPath(captureId), JSON.stringify({
            status: 'done',
            result: {
                captureId,
                studentName: info.studentName,
                className: info.className,
                materialName: info.materialName,
                totalPages: savedCount,
                filteredCount: filteredFiles.length > 0 ? filteredFiles.length : savedCount,
            }
        }));

    } catch (err) {
        await browser.close();
        throw err;
    }
}
