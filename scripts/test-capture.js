const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

const TEST_URL = 'https://class.orzo.kr/public-reports/TXkhTktIoNQIz8tomJwPvhWj8Xw2/hZGAOHwlEkXbouzQ3Xds';

async function testCapture() {
    console.log('=== Puppeteer Capture v5 - Element Screenshot (Full) ===');

    const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    const page = await browser.newPage();
    // Very tall viewport so element screenshots don't clip
    await page.setViewport({ width: 1280, height: 5000 });

    await page.goto(TEST_URL, { waitUntil: 'networkidle2', timeout: 30000 });
    await new Promise(r => setTimeout(r, 4000));

    // Extract student info
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

    console.log('Student:', info.studentName);
    console.log('Class:', info.className);
    console.log('Material:', info.materialName);
    console.log('Total Pages:', info.pageTotal);

    const totalPages = info.pageTotal || 20;
    const outputDir = path.join(__dirname, 'test-output');
    if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

    const allImages = [];

    for (let i = 0; i < totalPages; i++) {
        console.log(`[Page ${i + 1}/${totalPages}]`);
        await new Promise(r => setTimeout(r, 1200));

        // Wait for images to load fully
        await page.evaluate(() => {
            return new Promise((resolve) => {
                const imgs = Array.from(document.querySelectorAll('img'));
                const largeImgs = imgs.filter(img => img.getBoundingClientRect().width > 300);
                const pending = largeImgs.filter(img => !img.complete);
                if (pending.length === 0) return resolve();
                let count = 0;
                pending.forEach(img => {
                    img.onload = () => { if (++count >= pending.length) resolve(); };
                });
                setTimeout(resolve, 5000);
            });
        });

        // Find the container/wrapper that holds both the problem image and the annotation overlay
        // Screenshot the PARENT container that composites both images together
        const containerHandle = await page.evaluateHandle(() => {
            const imgs = Array.from(document.querySelectorAll('img'));
            const largeImgs = imgs.filter(img => {
                const rect = img.getBoundingClientRect();
                return rect.width > 300 && rect.height > 200;
            });

            if (largeImgs.length === 0) return null;

            // Find the common parent container of all large images
            // This is the div that holds both the problem image and annotation overlay
            const firstLarge = largeImgs[0];
            let container = firstLarge.parentElement;

            // Walk up to find a container that holds all large images
            while (container && container !== document.body) {
                const containedImgs = container.querySelectorAll('img');
                const largeInContainer = Array.from(containedImgs).filter(img => {
                    const rect = img.getBoundingClientRect();
                    return rect.width > 300 && rect.height > 200;
                });
                if (largeInContainer.length >= largeImgs.length) break;
                container = container.parentElement;
            }

            // Scroll container into view
            if (container) {
                container.scrollIntoView({ block: 'start' });
            }

            return container || firstLarge;
        });

        await new Promise(r => setTimeout(r, 500));

        try {
            const screenshot = await containerHandle.screenshot({
                encoding: 'base64',
                type: 'jpeg',
                quality: 92,
            });
            const buffer = Buffer.from(screenshot, 'base64');
            fs.writeFileSync(path.join(outputDir, `page${i + 1}.jpg`), buffer);
            allImages.push(screenshot);
            console.log(`  Captured (${Math.round(buffer.length / 1024)}KB)`);
        } catch (e) {
            console.log(`  Container screenshot failed: ${e.message}`);
            // Fallback: screenshot the largest image element directly
            const imgHandle = await page.evaluateHandle(() => {
                const imgs = Array.from(document.querySelectorAll('img'));
                let best = null, maxArea = 0;
                for (const img of imgs) {
                    const r = img.getBoundingClientRect();
                    if (r.width * r.height > maxArea) { maxArea = r.width * r.height; best = img; }
                }
                if (best) best.scrollIntoView({ block: 'start' });
                return best;
            });
            await new Promise(r => setTimeout(r, 300));
            try {
                const ss = await imgHandle.screenshot({ encoding: 'base64', type: 'jpeg', quality: 92 });
                const buf = Buffer.from(ss, 'base64');
                fs.writeFileSync(path.join(outputDir, `page${i + 1}.jpg`), buf);
                allImages.push(ss);
                console.log(`  Fallback captured (${Math.round(buf.length / 1024)}KB)`);
            } catch (e2) {
                console.log(`  All capture failed: ${e2.message}`);
            }
        }

        // Navigate to next page
        if (i < totalPages - 1) {
            await page.evaluate(() => {
                const allBtns = document.querySelectorAll('button.p-button');
                if (allBtns.length > 0) {
                    const lastBtn = allBtns[allBtns.length - 1];
                    if (!lastBtn.classList.contains('p-disabled')) lastBtn.click();
                }
            });
            await new Promise(r => setTimeout(r, 1500));
        }
    }

    await browser.close();

    console.log(`\n=== Done: ${allImages.length} images ===`);

    // Save all base64 for later Gemini test
    fs.writeFileSync(path.join(outputDir, 'images.json'), JSON.stringify({
        studentName: info.studentName,
        className: info.className,
        materialName: info.materialName,
        totalPages: allImages.length,
        images: allImages.map((b64, i) => ({ page: i + 1, base64: b64 }))
    }));
    console.log('All images saved to test-output/images.json');
}

testCapture().catch(err => {
    console.error('Test failed:', err);
    process.exit(1);
});
