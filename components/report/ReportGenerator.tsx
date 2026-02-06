'use client';

import { useState, useEffect } from 'react';
import { Icon } from '@/components/ui/Icon';
import { useAuth } from '@/contexts/AuthContext';
import { db, storage } from '@/lib/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { ref, getDownloadURL } from 'firebase/storage';
import { ReportView, ReportData } from './ReportView';
import { generateReport } from '@/app/actions/generateReport';

interface Attachment {
    id: string;
    file: File;
    type: 'image' | 'pdf';
    preview: string; // DataURL for preview
    objectUrl?: string; // Object URL for efficient display
    optimized?: string;
}

export default function ReportGenerator() {
    const { user, userData } = useAuth();

    // Form States
    const [teacherName, setTeacherName] = useState('');
    const [studentName, setStudentName] = useState('');
    const [className, setClassName] = useState('');
    const [courseName, setCourseName] = useState('');

    // File States
    const [attachments, setAttachments] = useState<Attachment[]>([]);

    // Process States
    const [isLoading, setIsLoading] = useState(false);
    const [reportData, setReportData] = useState<ReportData | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [isEnhancedMode, setIsEnhancedMode] = useState(false);

    // Save States
    const [saving, setSaving] = useState(false);
    const [saveError, setSaveError] = useState<string | null>(null);
    const [reportId, setReportId] = useState<string | null>(null);

    // Set Teacher Name from User Data
    useEffect(() => {
        if (userData?.displayName) {
            setTeacherName(userData.displayName);
        } else if (user?.displayName) {
            setTeacherName(user.displayName);
        } else {
            setTeacherName('');
        }
    }, [userData, user]);

    const handleFilesChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            const newFiles = Array.from(e.target.files);
            const newAttachments: Attachment[] = [];

            for (const file of newFiles) {
                const id = Math.random().toString(36).substring(7);
                const isPdf = file.type === 'application/pdf';

                // Read preview
                const preview = await new Promise<string>((resolve) => {
                    const reader = new FileReader();
                    reader.onloadend = () => resolve(reader.result as string);
                    reader.readAsDataURL(file);
                });

                newAttachments.push({
                    id,
                    file,
                    type: isPdf ? 'pdf' : 'image',
                    preview,
                    objectUrl: isPdf ? undefined : URL.createObjectURL(file),
                    optimized: undefined
                });
            }

            setAttachments(prev => [...prev, ...newAttachments]);
            setReportData(null);
        }
    };

    const removeAttachment = (id: string) => {
        setAttachments(prev => prev.filter(a => a.id !== id));
    };

    // Compress image for AI analysis
    const compressImageForAI = async (file: File): Promise<Blob> => {
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                const img = new Image();
                img.onload = () => {
                    // Increased from 1200 to 4096 to support long vertical images (pan-seo)
                    // Gemini 1.5 Flash supports fairly high res input
                    const MAX_DIMENSION = 4096;
                    let width = img.width;
                    let height = img.height;

                    // Only resize if significantly larger than MAX_DIMENSION
                    if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
                        const ratio = Math.min(MAX_DIMENSION / width, MAX_DIMENSION / height);
                        width = Math.round(width * ratio);
                        height = Math.round(height * ratio);
                    }

                    const canvas = document.createElement('canvas');
                    canvas.width = width;
                    canvas.height = height;
                    const ctx = canvas.getContext('2d');

                    if (ctx) {
                        ctx.imageSmoothingEnabled = true;
                        ctx.imageSmoothingQuality = 'high'; // improved quality
                        ctx.drawImage(img, 0, 0, width, height);
                    }

                    // Use slightly higher quality JPEG
                    canvas.toBlob(
                        (blob) => resolve(blob || file),
                        'image/jpeg',
                        0.85
                    );
                };
                img.src = e.target?.result as string;
            };
            reader.readAsDataURL(file);
        });
    };



    const handleGenerateReport = async () => {
        if (!studentName || attachments.length === 0) {
            setError('학생 이름과 최소 하나의 자료(이미지/PDF)가 필요합니다.');
            return;
        }

        setIsLoading(true);
        setError(null);

        try {
            const processedAttachments = await Promise.all(attachments.map(async (attachment) => {
                let base64Data: string;

                if (attachment.type === 'pdf') {
                    base64Data = attachment.preview.split(',')[1];
                } else {
                    // Check if image is extremely tall (likely a captured long-scroll)
                    // If so, we might want to be less aggressive with resizing, or just pass it through if it's not insane
                    // But Gemni Flash has limits.
                    // Let's bump MAX_SIZE significantly to 3072 (3x previous) to allow for legible text in long captures.
                    // And/Or we could check aspect ratio in compressImageForAI
                    const compressedBlob = await compressImageForAI(attachment.file);
                    base64Data = await new Promise((resolve) => {
                        const reader = new FileReader();
                        reader.onloadend = () => {
                            const result = reader.result as string;
                            resolve(result.split(',')[1]);
                        };
                        reader.readAsDataURL(compressedBlob);
                    });
                }

                return {
                    type: attachment.type,
                    base64: base64Data
                };
            }));

            // Force Flash model
            const aiPromise = generateReport({
                teacherName,
                studentName,
                className,
                courseName,
                attachments: processedAttachments,
                model: 'flash'
            });

            const parsedData = await aiPromise;
            setReportData(parsedData);

            if (user) {
                setSaving(true);
                try {
                    const base64Images = await Promise.all(attachments.map(async (attachment) => {
                        // Use original file for maximum fidelity (no canvas re-compression)
                        // This ensures the HTML report has the exact same quality as the uploaded file
                        return await new Promise<string>((resolve) => {
                            const reader = new FileReader();
                            reader.onloadend = () => resolve(reader.result as string);
                            reader.readAsDataURL(attachment.file);
                        });
                    }));

                    const { generateReportHtml } = await import('@/lib/reportHtmlGenerator');
                    const htmlContent = generateReportHtml(
                        studentName,
                        className,
                        courseName,
                        parsedData,
                        base64Images
                    );

                    const htmlBlob = new Blob([htmlContent], { type: 'text/html' });

                    // Construct Hierarchical Path: Center / Dept / Grade / StudentName
                    const sanitize = (s: string) => s.replace(/[\/\\]/g, '_').trim();
                    const center = sanitize(userData?.centerName || '기타센터');
                    const dept = sanitize(userData?.department || '기타부서');

                    // Extract Grade from ClassName (e.g., "중3A" -> "중3", "고1" -> "고1")
                    // If no match, use '기타학년'
                    // Extract Grade from ClassName or CourseName
                    const gradeRegex = /(초|중|고)\s*\d+/;
                    let gradeMatch = className.match(gradeRegex);
                    if (!gradeMatch && courseName) {
                        gradeMatch = courseName.match(gradeRegex);
                    }

                    let grade = '기타학년';

                    if (gradeMatch) {
                        grade = sanitize(gradeMatch[0]);
                    } else {
                        // Check for Middle/High school indicators (M/H)
                        const upperClass = className.toUpperCase();
                        const upperCourse = courseName.toUpperCase();

                        if (upperClass.includes('M') || upperCourse.includes('M')) {
                            grade = '중등';
                        } else if (upperClass.includes('H') || upperCourse.includes('H')) {
                            grade = '고등';
                        }
                    }
                    const student = sanitize(studentName);

                    const fileName = `reports/${center}/${dept}/${grade}/${student}/${Date.now()}_${student}.html`;

                    // Dynamic import for storage functions
                    const { uploadBytes } = await import('firebase/storage');
                    const storageRef = ref(storage, fileName);

                    await uploadBytes(storageRef, htmlBlob);
                    const htmlUrl = await getDownloadURL(storageRef);
                    console.log("HTML Report uploaded:", htmlUrl);

                    const docRef = await addDoc(collection(db, 'reports'), {
                        studentName,
                        className,
                        courseName,
                        reportData: parsedData,
                        htmlReportUrl: htmlUrl,
                        imageUrl: '',
                        teacherId: user.uid,
                        teacherName: teacherName || userData?.displayName || user.displayName || 'Unknown',
                        centerName: userData?.centerName || 'Unknown',
                        department: userData?.department || 'Unknown',
                        createdAt: serverTimestamp(),
                        month: new Date().toISOString().slice(0, 7)
                    });
                    setReportId(docRef.id);
                    console.log("Report saved successfully with ID:", docRef.id);

                } catch (saveError) {
                    console.error("Failed to save report:", saveError);
                    setSaveError(saveError instanceof Error
                        ? `⚠️ 저장 실패: ${saveError.message}`
                        : "⚠️ 자동 저장 실패 (네트워크/권한 확인)");
                }
            }
        } catch (err: unknown) {
            console.error(err);
            const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
            setError(errorMessage);
        } finally {
            setSaving(false);
            setIsLoading(false);
        }
    };

    const resetForm = () => {
        setStudentName('');
        setClassName('');
        setCourseName('');
        setAttachments([]);
        setReportData(null);
        setError(null);
        setIsEnhancedMode(false);
        setReportId(null);
    };

    const viewImages = attachments
        .filter(a => a.type === 'image')
        .map(a => a.objectUrl || a.preview);

    if (reportData) {
        return (
            <ReportView
                studentName={studentName}
                className={className}
                courseName={courseName}
                reportData={reportData}
                images={viewImages}
                isEnhancedMode={isEnhancedMode}
                setIsEnhancedMode={setIsEnhancedMode}
                reportId={reportId}
                onReset={resetForm}
                saving={saving}
                saveError={saveError}
            />
        );
    }

    return (
        <div className="max-w-xl mx-auto space-y-6 md:space-y-8 animate-fade-in relative z-10">
            <div className="text-center space-y-3">
                <h2 className="text-2xl md:text-3xl font-serif font-bold text-slate-900">Start Analysis</h2>
                <p className="text-slate-500 font-light text-sm md:text-base">
                    <span className="font-bold text-slate-700">과사람 의대관</span>의 전문적인 분석 시스템입니다.<br />
                    학생의 판서 이미지 또는 PDF 자료를 업로드해 주세요.
                </p>
            </div>

            <div className="bg-white p-6 md:p-8 rounded-xl shadow-xl border border-slate-100 relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-slate-900 via-amber-500 to-slate-900"></div>

                <div className="space-y-6">
                    {/* Inputs */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2 col-span-1 md:col-span-2">
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Teacher Name (작성자)</label>
                            <input
                                type="text"
                                value={teacherName}
                                onChange={(e) => setTeacherName(e.target.value)}
                                placeholder="작성자 이름"
                                className="w-full px-4 py-2 bg-slate-50 border-b-2 border-slate-200 focus:border-amber-600 outline-none"
                            />
                        </div>

                        <div className="space-y-2 col-span-1 md:col-span-2">
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Student Name <span className="text-red-500">*</span></label>
                            <input
                                type="text"
                                value={studentName}
                                onChange={(e) => setStudentName(e.target.value)}
                                placeholder="이름 (예: 김철수)"
                                className="w-full px-4 py-3 bg-slate-50 border-b-2 border-slate-200 focus:border-amber-600 outline-none text-lg font-serif"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Class Name</label>
                            <input
                                type="text"
                                value={className}
                                onChange={(e) => setClassName(e.target.value)}
                                placeholder="클래스명"
                                className="w-full px-4 py-2 bg-slate-50 border-b-2 border-slate-200 focus:border-amber-600 outline-none"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Course / Subject</label>
                            <input
                                type="text"
                                value={courseName}
                                onChange={(e) => setCourseName(e.target.value)}
                                placeholder="과정명"
                                className="w-full px-4 py-2 bg-slate-50 border-b-2 border-slate-200 focus:border-amber-600 outline-none"
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Board Images & PDF <span className="text-red-500">*</span></label>
                        <div className={`group relative border-2 border-dashed border-slate-200 rounded-lg p-6 md:p-8 transition-all text-center cursor-pointer hover:border-amber-400 bg-slate-50/50 hover:bg-white`}>
                            <input
                                type="file"
                                accept="image/*,application/pdf"
                                multiple
                                onChange={handleFilesChange}
                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                            />
                            <div className="space-y-4 pointer-events-none">
                                <div className="w-14 h-14 bg-slate-100 text-slate-400 rounded-full flex items-center justify-center mx-auto group-hover:scale-110 transition-transform">
                                    <Icon name="Upload" size={24} />
                                </div>
                                <div className="text-slate-500">
                                    <p className="font-bold text-slate-700">Click to upload files</p>
                                    <p className="text-xs mt-1">Images (JPG, PNG) or PDF</p>
                                </div>
                            </div>
                        </div>

                        {/* File Previews */}
                        {attachments.length > 0 && (
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mt-4">
                                {attachments.map((file) => (
                                    <div key={file.id} className="relative group rounded-lg overflow-hidden border border-slate-200 bg-white shadow-sm aspect-square flex items-center justify-center">
                                        {file.type === 'pdf' ? (
                                            <div className="flex flex-col items-center justify-center text-slate-500 p-2 text-center">
                                                <Icon name="FileText" size={32} className="mb-2 text-amber-600" />
                                                <span className="text-xs truncate w-full px-2">{file.file.name}</span>
                                            </div>
                                        ) : (
                                            <img
                                                src={file.preview}
                                                alt="Preview"
                                                className="w-full h-full object-contain bg-slate-50"
                                            />
                                        )}

                                        <button
                                            onClick={() => removeAttachment(file.id)}
                                            className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                                        >
                                            <Icon name="X" size={14} />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {error && (
                        <div className="p-4 bg-red-50 text-red-800 text-sm rounded border border-red-100 flex items-center gap-3">
                            <Icon name="X" size={16} /> {error}
                        </div>
                    )}

                    <button
                        onClick={handleGenerateReport}
                        disabled={isLoading || !studentName || attachments.length === 0}
                        className={`w-full py-4 rounded-lg font-bold text-sm tracking-widest uppercase transition-all shadow-md flex items-center justify-center gap-3 ${isLoading || !studentName || attachments.length === 0
                            ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                            : 'bg-slate-900 text-amber-500 hover:bg-slate-800 hover:shadow-lg'
                            }`}
                    >
                        {isLoading ? (
                            <>
                                <Icon name="Loader2" size={18} className="animate-spin" />
                                <span>Generating... {saving && "(Saving...)"}</span>
                            </>
                        ) : (
                            <>
                                <span>Generate Report</span>
                                <Icon name="ChevronRight" size={16} />
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}
