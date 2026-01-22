'use client';

import { Icon } from '@/components/ui/Icon';
import { useState } from 'react';

export interface ReportData {
    report_info: {
        report_title: string;
        sub_title: string;
        topic: string;
    };
    analysis_data: {
        learning_progress: string;
        growth_points: Array<{ evidence: string; praise_comment: string }>;
        improvement_suggestions: string;
    };
    parent_guide: {
        opening_ment: string;
        encouragement_tips: string[];
    };
}

interface ReportViewProps {
    studentName: string;
    className: string;
    courseName: string;
    reportData: ReportData;
    imagePreview: string | null;
    isEnhancedMode: boolean;
    setIsEnhancedMode: (v: boolean) => void;
    onReset?: () => void;
    reportId?: string | null;
}

export const ReportView = ({
    studentName, className, courseName, reportData, imagePreview,
    isEnhancedMode, setIsEnhancedMode, onReset, reportId
}: ReportViewProps) => {
    const [copied, setCopied] = useState(false);

    const handleCopyLink = () => {
        if (!reportId) return;
        const url = `${window.location.origin}/report/${reportId}`;
        navigator.clipboard.writeText(url);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const downloadHtmlReport = () => {
        if (!reportData) return;
        // ... (start of existing function)

        const tailwindScriptTag = '<script src="https://cdn.tailwindcss.com"><' + '/script>';
        // Note: In a real app we might want to generate this server side or use a template, 
        // but for porting we stick to the client-side blob generation.
        const htmlContent = `
<!DOCTYPE html>
<html lang="ko">
<head>
    <meta charset="UTF-8">
    <title>학습 리포트 - ${studentName}</title>
    ${tailwindScriptTag}
    <link href="https://fonts.googleapis.com/css2?family=Noto+Serif+KR:wght@400;700&family=Pretendard:wght@300;400;500;700&display=swap" rel="stylesheet">
    <style>
        body { font-family: 'Pretendard', sans-serif; }
        .font-serif { font-family: 'Noto Serif KR', serif; }
        @media print { .no-print { display: none !important; } }
    </style>
</head>
<body class="bg-white text-slate-800 p-8 md:p-16 max-w-4xl mx-auto">
    <!-- Content similar to the preview -->
    <div class="border-b-2 border-slate-900 pb-6 mb-8 flex flex-col md:flex-row justify-between md:items-end gap-4">
        <div>
             <div class="flex flex-wrap gap-2 mb-2 text-xs font-bold tracking-wider text-slate-500 uppercase">
                ${className ? `<span class="bg-slate-100 px-2 py-1 rounded">${className}</span>` : ''}
                ${courseName ? `<span class="bg-amber-50 text-amber-700 px-2 py-1 rounded">${courseName}</span>` : ''}
            </div>
            <h2 class="text-3xl md:text-4xl font-serif font-bold text-slate-900 mb-1">${studentName}</h2>
            <p class="text-slate-500 font-medium tracking-wide uppercase text-xs">${reportData.report_info.sub_title}</p>
        </div>
        <div class="text-left md:text-right">
             <div class="flex items-center gap-2 mb-1 justify-start md:justify-end">
                <div class="w-1.5 h-1.5 bg-amber-500 rounded-full"></div>
                <span class="text-xs font-bold text-slate-900 uppercase tracking-widest">과사람 의대관</span>
            </div>
            <div class="text-amber-600 font-serif italic text-lg">${reportData.report_info.topic}</div>
        </div>
    </div>

    <div class="grid gap-10 mb-10">
        <section>
            <h3 class="text-lg font-serif font-bold text-slate-900 mb-4 flex items-center gap-2">
                <span class="w-1.5 h-1.5 bg-amber-500 rounded-full"></span> Learning Progress
            </h3>
            <p class="text-slate-700 leading-relaxed text-justify">${reportData.analysis_data.learning_progress}</p>
        </section>
        <section>
            <h3 class="text-lg font-serif font-bold text-slate-900 mb-4 flex items-center gap-2">
                <span class="w-1.5 h-1.5 bg-amber-500 rounded-full"></span> Key Strengths
            </h3>
            <div class="grid md:grid-cols-2 gap-4">
                ${reportData.analysis_data.growth_points.map(point => `
                    <div class="bg-gray-50 p-5 rounded-lg border-l-4 border-slate-900">
                        <div class="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Evidence</div>
                        <p class="text-slate-600 mb-3 font-mono text-xs break-keep">${point.evidence}</p>
                        <div class="text-sm text-slate-900 font-bold font-serif break-keep">"${point.praise_comment}"</div>
                    </div>
                `).join('')}
            </div>
        </section>
        <section class="bg-amber-50 p-6 rounded-lg border border-amber-100">
            <h3 class="text-lg font-serif font-bold text-slate-900 mb-3 flex items-center gap-2">Professional Advice</h3>
            <p class="text-slate-800 leading-relaxed text-sm font-medium">${reportData.analysis_data.improvement_suggestions}</p>
        </section>
    </div>

    <div class="pt-8 border-t border-slate-200 mb-10">
        <h4 class="text-base font-serif font-bold text-slate-900 mb-2">Message for Parents</h4>
        <p class="text-slate-600 text-sm mb-4 italic">"${reportData.parent_guide.opening_ment}"</p>
        <div class="bg-slate-50 p-4 rounded-lg inline-block w-full">
            <span class="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-2">Home Coaching Tips</span>
            <ul class="space-y-2">
                ${reportData.parent_guide.encouragement_tips.map(tip => `
                    <li class="text-sm text-slate-700 flex items-start gap-2">
                        <span class="w-1 h-1 bg-slate-400 rounded-full mt-2 flex-shrink-0"></span>
                        <span class="break-keep">${tip}</span>
                    </li>
                `).join('')}
            </ul>
        </div>
    </div>

    <section class="mb-12">
        <h3 class="text-lg font-serif font-bold text-slate-900 flex items-center gap-2 mb-4">
            <span class="w-1.5 h-1.5 bg-amber-500 rounded-full"></span> Board Analytics
        </h3>
        <div class="bg-slate-50 p-2 rounded-xl border border-slate-100">
            <div class="rounded-lg overflow-hidden border border-slate-200 bg-white shadow-sm">
                <img src="${imagePreview}" alt="Board" class="w-full h-auto object-contain" />
            </div>
        </div>
    </section>

    <div class="mt-12 text-center border-t border-slate-100 pt-6">
        <p class="text-xs text-slate-400 tracking-widest uppercase">과사람 의대관 | Premium Mathematics Education</p>
    </div>
</body>
</html>`;

        const blob = new Blob([htmlContent], { type: 'text/html' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Report_${studentName}_${new Date().toISOString().slice(0, 10)}.html`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    return (
        <div className="animate-slide-up pb-12 w-full max-w-4xl mx-auto">
            <div className="flex justify-between items-center mb-6 print:hidden gap-2">
                <div className="flex gap-2">
                    {onReset && (
                        <button onClick={onReset} className="flex items-center gap-2 text-slate-500 hover:text-slate-900 transition-colors px-4 py-2 rounded-full hover:bg-white text-xs md:text-sm font-medium border border-transparent hover:border-slate-200">
                            <Icon name="RefreshCw" size={14} />
                            <span className="hidden sm:inline">다시 분석하기</span>
                            <span className="sm:hidden">Reset</span>
                        </button>
                    )}
                </div>
                <div className="flex gap-2">
                    {reportId && (
                        <button
                            onClick={handleCopyLink}
                            className={`flex items-center gap-2 px-5 py-2 rounded-full text-xs md:text-sm font-medium shadow-md transition-all ${copied
                                    ? 'bg-green-600 text-white hover:bg-green-700'
                                    : 'bg-slate-900 text-amber-500 hover:bg-slate-800'
                                }`}
                        >
                            <Icon name={copied ? "Check" : "Link"} size={14} />
                            {copied ? "복사됨" : "학부모 전송 링크"}
                        </button>
                    )}
                    <button onClick={downloadHtmlReport} className="flex items-center gap-2 bg-amber-600 text-white px-5 py-2 rounded-full text-xs md:text-sm font-medium hover:bg-amber-700 shadow-md transition-all">
                        <Icon name="Download" size={14} />
                        HTML 저장
                    </button>
                    <button onClick={() => window.print()} className="flex items-center gap-2 bg-slate-900 text-white px-5 py-2 rounded-full text-xs md:text-sm font-medium hover:bg-slate-800 shadow-md transition-all">
                        <Icon name="Printer" size={14} />
                        PDF / Print
                    </button>
                </div>
            </div>

            <div className="bg-white w-full max-w-[210mm] mx-auto min-h-[297mm] shadow-2xl overflow-hidden relative print:shadow-none print:w-full print:max-w-none">
                <div className="absolute top-0 left-0 w-1 md:w-2 h-full bg-amber-500/10 hidden sm:block"></div>

                <div className="p-5 sm:p-12 md:p-16">
                    {/* Header */}
                    <div className="border-b-2 border-slate-900 pb-6 mb-8 flex flex-col md:flex-row justify-between md:items-end gap-4">
                        <div>
                            <div className="flex flex-wrap gap-2 mb-2 text-xs font-bold tracking-wider text-slate-500 uppercase">
                                {className && <span className="bg-slate-100 px-2 py-1 rounded">{className}</span>}
                                {courseName && <span className="bg-amber-50 text-amber-700 px-2 py-1 rounded">{courseName}</span>}
                            </div>
                            <h2 className="text-3xl md:text-4xl font-serif font-bold text-slate-900 mb-1">{studentName}</h2>
                            <p className="text-slate-500 font-medium tracking-wide uppercase text-[10px] md:text-xs">
                                {reportData.report_info.sub_title}
                            </p>
                        </div>
                        <div className="text-left md:text-right">
                            <div className="flex items-center gap-2 mb-1 justify-start md:justify-end">
                                <div className="w-1.5 h-1.5 bg-amber-500 rounded-full"></div>
                                <span className="text-[10px] md:text-xs font-bold text-slate-900 uppercase tracking-widest">과사람 의대관</span>
                            </div>
                            <div className="text-amber-600 font-serif italic text-base md:text-lg">{reportData.report_info.topic}</div>
                        </div>
                    </div>

                    {/* Analysis Data */}
                    <div className="grid gap-8 md:gap-10">
                        <section>
                            <h3 className="text-base md:text-lg font-serif font-bold text-slate-900 mb-4 flex items-center gap-2">
                                <span className="w-1.5 h-1.5 bg-amber-500 rounded-full"></span> Learning Progress
                            </h3>
                            <p className="text-slate-700 leading-relaxed text-justify text-sm md:text-base">
                                {reportData.analysis_data.learning_progress}
                            </p>
                        </section>

                        <section>
                            <h3 className="text-base md:text-lg font-serif font-bold text-slate-900 mb-4 flex items-center gap-2">
                                <span className="w-1.5 h-1.5 bg-amber-500 rounded-full"></span> Key Strengths
                            </h3>
                            <div className="grid md:grid-cols-2 gap-4">
                                {reportData.analysis_data.growth_points.map((point, idx) => (
                                    <div key={idx} className="bg-[#F8F9FA] p-5 rounded-lg border-l-4 border-slate-900">
                                        <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Evidence</div>
                                        <p className="text-slate-600 mb-3 font-mono text-xs break-keep">{point.evidence}</p>
                                        <div className="text-sm text-slate-900 font-bold font-serif break-keep">&quot;{point.praise_comment}&quot;</div>
                                    </div>
                                ))}
                            </div>
                        </section>

                        <section className="bg-amber-50 p-6 rounded-lg border border-amber-100">
                            <h3 className="text-base md:text-lg font-serif font-bold text-slate-900 mb-3 flex items-center gap-2">
                                <Icon name="Award" size={18} className="text-amber-600" /> Professional Advice
                            </h3>
                            <p className="text-slate-800 leading-relaxed text-sm font-medium">
                                {reportData.analysis_data.improvement_suggestions}
                            </p>
                        </section>
                    </div>

                    {/* Footer / Parent Guide */}
                    <div className="mt-12 md:mt-16 pt-8 border-t border-slate-200">
                        <div className="flex flex-col md:flex-row items-start gap-4">
                            <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center flex-shrink-0 hidden md:flex">
                                <Icon name="MessageCircle" size={20} className="text-slate-400" />
                            </div>
                            <div>
                                <h4 className="text-base font-serif font-bold text-slate-900 mb-2">Message for Parents</h4>
                                <p className="text-slate-600 text-sm mb-4 italic">&quot;{reportData.parent_guide.opening_ment}&quot;</p>
                                <div className="bg-slate-50 p-4 rounded-lg inline-block w-full">
                                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-2">Home Coaching Tips</span>
                                    <ul className="space-y-2">
                                        {reportData.parent_guide.encouragement_tips.map((tip, idx) => (
                                            <li key={idx} className="text-sm text-slate-700 flex items-start gap-2">
                                                <span className="w-1 h-1 bg-slate-400 rounded-full mt-2 flex-shrink-0"></span>
                                                <span className="break-keep">{tip}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Image Section */}
                    <section className="mt-12 md:mt-16 pt-8 border-t border-slate-200">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-base md:text-lg font-serif font-bold text-slate-900 flex items-center gap-2">
                                <span className="w-1.5 h-1.5 bg-amber-500 rounded-full"></span> Board Analytics
                            </h3>
                            <button
                                onClick={() => setIsEnhancedMode(!isEnhancedMode)}
                                className="flex items-center gap-1.5 text-[10px] md:text-xs font-medium text-slate-500 hover:text-slate-900 bg-slate-100 px-3 py-1.5 rounded-full transition-colors print:hidden"
                            >
                                {isEnhancedMode ? <Icon name="EyeOff" size={12} /> : <Icon name="Eye" size={12} />}
                                <span className="hidden sm:inline">{isEnhancedMode ? '원본 색상' : '가독성 모드'}</span>
                            </button>
                        </div>
                        <div className="bg-slate-50 p-2 md:p-4 rounded-xl border border-slate-100">
                            <div className="rounded-lg overflow-hidden border border-slate-200 bg-white shadow-sm relative group cursor-pointer">
                                <img
                                    src={imagePreview || ''}
                                    alt="Board"
                                    className={`w-full h-auto object-contain transition-all duration-500 ${isEnhancedMode ? 'grayscale contrast-[1.2] brightness-105 saturate-0' : ''}`}
                                />
                            </div>
                        </div>
                    </section>
                </div>
            </div>
        </div >
    );
}
