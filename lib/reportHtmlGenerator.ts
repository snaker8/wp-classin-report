import { ReportData } from '@/components/report/ReportView';

export const generateReportHtml = (
    studentName: string,
    className: string,
    courseName: string,
    reportData: ReportData,
    base64Images: string[]
): string => {
    const tailwindScriptTag = '<script src="https://cdn.tailwindcss.com"><' + '/script>';

    return `
<!DOCTYPE html>
<html lang="ko">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>학습 리포트 - ${studentName}</title>
    ${tailwindScriptTag}
    <link href="https://fonts.googleapis.com/css2?family=Noto+Serif+KR:wght@400;700&family=Pretendard:wght@300;400;500;700&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.css" integrity="sha384-n8MVd4RsNIU0tAv4ct0nTaAbDJwPJzDEaqSD1odI+WdtXRGWt2kTvGFasHpSy3SV" crossorigin="anonymous">
    <script defer src="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.js" integrity="sha384-XjKyQNRlToSoW462lSSzOu3vozwEurozAfagCO4vwjW+5BzQAj9B/UZglWB5XibG" crossorigin="anonymous"></script>
    <script defer src="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/contrib/auto-render.min.js" integrity="sha384-+VBxd3r6XgURycqtZ117nYw44OOcIax56Z4dCRWbxyPt0Koah1uHoK0o4+/RRE05" crossorigin="anonymous" onload="renderMathInElement(document.body);"></script>
    <style>
        body { font-family: 'Pretendard', sans-serif; }
        .font-serif { font-family: 'Noto Serif KR', serif; }
        @media print { .no-print { display: none !important; } }
    </style>
</head>
<body class="bg-white text-slate-800 p-4 md:p-16 max-w-6xl mx-auto">
    <div class="border-b-2 border-slate-900 pb-6 mb-8 flex flex-col md:flex-row justify-between md:items-end gap-4">
        <div>
             <div class="flex flex-wrap gap-2 mb-2 text-xs font-bold tracking-wider text-slate-500 uppercase">
                ${className ? `<span class="bg-slate-100 px-2 py-1 rounded">${className}</span>` : ''}
                ${courseName ? `<span class="bg-amber-50 text-amber-700 px-2 py-1 rounded">${courseName}</span>` : ''}
            </div>
            <h2 class="text-3xl md:text-4xl font-serif font-bold text-slate-900 mb-1">${studentName}</h2>
            <p class="text-slate-500 font-medium tracking-wide uppercase text-xs">${reportData.report_info?.sub_title || ''}</p>
        </div>
        <div class="text-left md:text-right">
             <div class="flex items-center gap-2 mb-1 justify-start md:justify-end">
                <div class="w-1.5 h-1.5 bg-amber-500 rounded-full"></div>
                <span class="text-xs font-bold text-slate-900 uppercase tracking-widest">과사람 의대관</span>
            </div>
            <div class="text-amber-600 font-serif italic text-lg">${reportData.report_info?.topic || ''}</div>
        </div>
    </div>

    <div class="grid gap-10 mb-10">
        <section>
            <h3 class="text-lg font-serif font-bold text-slate-900 mb-4 flex items-center gap-2">
                <span class="w-1.5 h-1.5 bg-amber-500 rounded-full"></span> Learning Progress
            </h3>
            <p class="text-slate-700 leading-relaxed text-justify">${reportData.analysis_data?.learning_progress || ''}</p>
        </section>
        <section>
            <h3 class="text-lg font-serif font-bold text-slate-900 mb-4 flex items-center gap-2">
                <span class="w-1.5 h-1.5 bg-amber-500 rounded-full"></span> Key Strengths
            </h3>
            <div class="grid md:grid-cols-2 gap-4">
                ${(reportData.analysis_data?.growth_points || []).map(point => `
                    <div class="bg-gray-50 p-5 rounded-lg border-l-4 border-slate-900">
                        <div class="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Evidence</div>
                        <p class="text-slate-600 mb-3 font-mono text-xs break-keep">${point.evidence || ''}</p>
                        <div class="text-sm text-slate-900 font-bold font-serif break-keep">"${point.praise_comment || ''}"</div>
                    </div>
                `).join('')}
            </div>
        </section>
        <section class="bg-amber-50 p-6 rounded-lg border border-amber-100">
            <h3 class="text-lg font-serif font-bold text-slate-900 mb-3 flex items-center gap-2">Professional Advice</h3>
            <p class="text-slate-800 leading-relaxed text-sm font-medium">${reportData.analysis_data?.improvement_suggestions || ''}</p>
        </section>
    </div>

    <div class="pt-8 border-t border-slate-200 mb-10">
        <h4 class="text-base font-serif font-bold text-slate-900 mb-2">Message for Parents</h4>
        <p class="text-slate-600 text-sm mb-4 italic">"${reportData.parent_guide?.opening_ment || ''}"</p>
        <div class="bg-slate-50 p-4 rounded-lg inline-block w-full">
            <span class="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-2">Home Coaching Tips</span>
            <ul class="space-y-2">
                ${(reportData.parent_guide?.encouragement_tips || []).map(tip => `
                    <li class="text-sm text-slate-700 flex items-start gap-2">
                        <span class="w-1 h-1 bg-slate-400 rounded-full mt-2 flex-shrink-0"></span>
                        <span class="break-keep">${tip}</span>
                    </li>
                `).join('')}
            </ul>
        </div>
    </div>

    <!-- Board Analytics Section -->
    <section class="mt-12 pt-8 border-t border-slate-200 mb-12">
        <h3 class="text-lg font-serif font-bold text-slate-900 flex items-center gap-2 mb-4">
            <span class="w-1.5 h-1.5 bg-amber-500 rounded-full"></span> Board Analytics
        </h3>
        <div class="bg-slate-50 p-2 rounded-xl border border-slate-100">
            <div class="rounded-lg overflow-hidden border border-slate-200 bg-white shadow-sm space-y-4 p-4">
                ${base64Images.map(img => `
                    <div style="margin-bottom: 20px;">
                        <img src="${img}" alt="Board" style="width: 100%; height: auto; display: block; border-radius: 8px;" />
                    </div>
                `).join('')}
            </div>
        </div>
    </section>

    <div class="mt-12 text-center border-t border-slate-100 pt-6">
        <p class="text-xs text-slate-400 tracking-widest uppercase">과사람 의대관 | Premium Mathematics Education</p>
    </div>
</body>
</html>`;
};
