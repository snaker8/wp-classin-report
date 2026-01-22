'use client';

import { useState, useEffect } from 'react';
import { Icon } from '@/components/ui/Icon';
import { useAuth } from '@/contexts/AuthContext';
import { db, storage } from '@/lib/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { ref, uploadString, getDownloadURL } from 'firebase/storage';
import { ReportView, ReportData } from './ReportView';

const SYSTEM_PROMPT = `
# [SYSTEM ROLE]
당신은 대한민국 최상위권 학생들을 지도하는 '과사람 의대관'의 수석 수학 교육 연구원입니다. 
제공된 판서 이미지를 **있는 그대로 정밀하게 분석**하여 학부모에게 깊이 있는 통찰력을 제공해야 합니다.

**[절대 원칙 - 최우선 준수]**
1. **사실 기반 분석 (Evidence-Based Analysis):** **이미지에 보이지 않는 내용은 절대 창조하거나 추측하여 적지 마십시오.** 판서에 '점, 선, 면'에 대한 내용만 있다면 그것에 대해서만 분석하고, 없는 '삼각형의 합동'이나 '복잡한 계산'을 절대 언급하지 마십시오.
2. **보이는 그대로 읽기:** 학생이 실제로 쓴 식, 그린 도형, 필기 내용만을 근거로 삼으십시오. 만약 판서가 단순 개념 정리라면, '문제 풀이 능력'이 아니라 '개념 요약 능력'과 '정의 이해도'를 평가해야 합니다.
3. **할루시네이션(환각) 방지:** 이미지와 관련 없는 일반적인 수학 조언이나, 이 학생이 풀었을 것이라고 짐작되는 문제를 리포트에 포함하지 마십시오. 오직 이미지 속의 텍스트와 그림만 분석 대상입니다.

**[분석 원칙]**
1. **내용 유형 식별:** 판서가 '개념 정리'인지, '문제 풀이'인지, '오답 노트'인지 먼저 파악하십시오.
    - 개념 정리인 경우: 핵심 키워드 포함 여부, 구조화 능력 평가.
    - 문제 풀이인 경우: 논리적 전개, 계산 과정, 최종 답안 도출 과정 평가.
2. **수식 정밀 판독:** 손글씨가 흐리거나 악필이어도 문맥을 고려하여 보정하되, 없는 수식을 만들어내지는 마십시오.
3. **심층 평가:** 단순히 "잘했습니다"가 아닌, "이미지의 3번째 줄에 적힌 정의를 통해 학생이 시각적 직관을 잘 활용함을 알 수 있음"과 같이 구체적 증거를 대십시오.
4. **전문적인 어조:** 입시 전문가의 권위 있고 신뢰감 있는 어조를 사용하십시오.

# [OPERATIONAL PROCESS]
1. **이미지 스캔 & 팩트 체크:** 이미지 내의 모든 텍스트와 도형을 먼저 텍스트화하여 내부적으로 확인하고, 이 내용 범위를 벗어나는 주제는 배제합니다.
2. **사고 과정 추적:** 학생이 작성한 순서대로 내용을 따라가며 분석합니다.
3. **평가 및 제언:** 관찰된 사실에 기반하여 [학습 진행 상황], [강점], [보완점], [가정 지도법]을 도출합니다.

# [JSON OUTPUT SCHEMA]
출력은 반드시 아래 구조의 유효한 JSON 데이터여야 하며, 다른 설명 문구는 포함하지 마십시오.

{
  "report_info": {
    "report_title": "Mathematics Progress Report",
    "sub_title": "ClassIn 수업 정밀 분석 보고서",
    "topic": "판서에 나타난 실제 주제 (예: 점, 선, 면의 정의)"
  },
  "analysis_data": {
    "learning_progress": "오늘 판서에서 확인된 핵심 학습 내용과 학생의 성취 수준을 전문적인 용어로 요약 서술 (이미지 내용 기반)",
    "growth_points": [
      {
        "evidence": "판서에서 관찰된 구체적인 증거 (예: '두 점을 잇는 직선'이라고 정확히 필기함)",
        "praise_comment": "해당 증거를 통해 파악된 학생의 역량 (예: 기하학적 정의를 명확히 인지하고 있음)"
      }
    ],
    "improvement_suggestions": "판서 내용에 기반하여 더 발전시킬 수 있는 부분이나 실천적인 제언"
  },
  "parent_guide": {
    "opening_ment": "학부모님께 드리는 정중하고 신뢰감 있는 인사말 (학생 이름 포함)",
    "encouragement_tips": ["가정에서 실천할 수 있는 구체적인 지도 가이드 1", "가이드 2"],
    "image_guide": "판서 이미지 관전 포인트 (예: 상단에 정리된 용어 정의 부분은~)"
  }
}

# [CONSTRAINT & STYLE]
1. 어조: 매우 정중하고 전문적이며 고급스러운 어조.
2. 포맷: 가독성을 위해 불필요한 미사여구는 배제하고 핵심을 명확히 전달.
3. 불필요한 서두나 결어 없이 JSON 데이터만 출력할 것.
`;

export default function ReportGenerator() {
    const { user, userData } = useAuth();
    const [userApiKey, setUserApiKey] = useState('');
    const [saveApiKey, setSaveApiKey] = useState(false);
    const [studentName, setStudentName] = useState('');
    const [className, setClassName] = useState('');
    const [courseName, setCourseName] = useState('');
    const [selectedImage, setSelectedImage] = useState<File | null>(null);
    const [imagePreview, setImagePreview] = useState<string | null>(null);
    const [optimizedImage, setOptimizedImage] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [reportData, setReportData] = useState<ReportData | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [isEnhancedMode, setIsEnhancedMode] = useState(false);
    const [saving, setSaving] = useState(false);
    const [reportId, setReportId] = useState<string | null>(null);

    useEffect(() => {
        const savedKey = localStorage.getItem('gwasaram_gemini_api_key');
        if (savedKey) {
            setUserApiKey(savedKey);
            setSaveApiKey(true);
        }
    }, []);

    const optimizeImage = (file: File): Promise<string> => {
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                const img = new Image();
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    const MAX_WIDTH = 2048;
                    const MAX_HEIGHT = 2048;
                    let width = img.width;
                    let height = img.height;

                    if (width > height) {
                        if (width > MAX_WIDTH) {
                            height *= MAX_WIDTH / width;
                            width = MAX_WIDTH;
                        }
                    } else {
                        if (height > MAX_HEIGHT) {
                            width *= MAX_HEIGHT / height;
                            height = MAX_HEIGHT;
                        }
                    }

                    canvas.width = width;
                    canvas.height = height;
                    const ctx = canvas.getContext('2d');
                    ctx?.drawImage(img, 0, 0, width, height);
                    const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
                    resolve(dataUrl);
                };
                img.src = e.target?.result as string;
            };
            reader.readAsDataURL(file);
        });
    };

    const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setSelectedImage(file);
            const reader = new FileReader();
            reader.onloadend = () => setImagePreview(reader.result as string);
            reader.readAsDataURL(file);

            try {
                const optimized = await optimizeImage(file);
                setOptimizedImage(optimized);
            } catch (err) {
                console.error("Image optimization failed", err);
            }
            setReportData(null);
        }
    };

    const generateReport = async () => {
        if (!userApiKey) {
            setError('API Key를 입력해주세요.');
            return;
        }
        if (!studentName || !selectedImage) {
            setError('학생 이름과 판서 이미지는 필수 입력 사항입니다.');
            return;
        }

        setIsLoading(true);
        setError(null);

        if (saveApiKey) localStorage.setItem('gwasaram_gemini_api_key', userApiKey);
        else localStorage.removeItem('gwasaram_gemini_api_key');

        const imageToSend = optimizedImage || imagePreview;
        const base64Image = imageToSend?.split(',')[1];

        // 1. Generate Content
        try {
            const response = await fetch(
                `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${userApiKey}`,
                {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        contents: [{
                            parts: [
                                { text: `${SYSTEM_PROMPT}\n\n학생 이름: ${studentName}\n클래스: ${className}\n과정: ${courseName}\n이미지를 정밀 분석하여 리포트를 작성하십시오.` },
                                { inlineData: { mimeType: "image/jpeg", data: base64Image } },
                            ],
                        }],
                        generationConfig: { responseMimeType: "application/json", temperature: 0.1 },
                    }),
                }
            );

            if (!response.ok) throw new Error(`API Error: ${response.status}`);
            const result = await response.json();
            const generatedText = result.candidates?.[0]?.content?.parts?.[0]?.text;
            if (!generatedText) throw new Error("분석 결과가 비어있습니다.");

            let parsedData;
            try {
                parsedData = JSON.parse(generatedText);
            } catch (parseError) {
                const match = generatedText.match(/```json([\s\S]*?)```/);
                if (match) parsedData = JSON.parse(match[1]);
                else throw new Error("JSON Parsing Error");
            }

            setReportData(parsedData);

            // 2. Auto-Save to Firestore with Image Upload
            if (user) {
                setSaving(true);
                try {
                    let imageUrl = '';
                    if (base64Image) {
                        try {
                            const storageRef = ref(storage, `reports/${Date.now()}_${studentName}.jpg`);
                            await uploadString(storageRef, `data:image/jpeg;base64,${base64Image}`, 'data_url');
                            imageUrl = await getDownloadURL(storageRef);
                        } catch (uploadErr) {
                            console.error("Image upload failed:", uploadErr);
                        }
                    }

                    const docRef = await addDoc(collection(db, 'reports'), {
                        studentName,
                        className,
                        courseName,
                        reportData: parsedData,
                        imageUrl, // Save the persistent URL
                        teacherId: user.uid,
                        teacherName: userData?.displayName || user.displayName || 'Unknown',
                        centerName: userData?.centerName || 'Unknown',
                        department: userData?.department || 'Unknown',
                        createdAt: serverTimestamp(),
                        month: new Date().toISOString().slice(0, 7)
                    });
                    setReportId(docRef.id);
                    console.log("Report saved successfully with ID:", docRef.id);
                } catch (saveError) {
                    console.error("Failed to save report:", saveError);
                } finally {
                    setSaving(false);
                }
            }

        } catch (err: unknown) {
            console.error(err);
            const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
            setError(errorMessage);
        } finally {
            setIsLoading(false);
        }
    };

    const resetForm = () => {
        setStudentName('');
        setClassName('');
        setCourseName('');
        setSelectedImage(null);
        setImagePreview(null);
        setOptimizedImage(null);
        setReportData(null);
        setError(null);
        setIsEnhancedMode(false);
    };

    if (reportData) {
        return (
            <ReportView
                studentName={studentName}
                className={className}
                courseName={courseName}
                reportData={reportData}
                imagePreview={imagePreview}
                isEnhancedMode={isEnhancedMode}
                setIsEnhancedMode={setIsEnhancedMode}
                reportId={reportId}
                onReset={resetForm}
            />
        );
    }

    return (
        <div className="max-w-xl mx-auto space-y-6 md:space-y-8 animate-fade-in relative z-10">
            <div className="text-center space-y-3">
                <h2 className="text-2xl md:text-3xl font-serif font-bold text-slate-900">Start Analysis</h2>
                <p className="text-slate-500 font-light text-sm md:text-base">
                    <span className="font-bold text-slate-700">과사람 의대관</span>의 전문적인 분석 시스템입니다.<br />학생의 판서 이미지를 업로드해 주세요.
                </p>
            </div>

            <div className="bg-white p-6 md:p-8 rounded-xl shadow-xl border border-slate-100 relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-slate-900 via-amber-500 to-slate-900"></div>

                <div className="space-y-6">
                    {/* API Key Input */}
                    <div className="space-y-2 bg-slate-50 p-4 rounded-lg border border-slate-200">
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2">
                            <Icon name="Key" size={14} /> Gemini API Key <span className="text-red-500">*</span>
                        </label>
                        <input
                            type="password"
                            value={userApiKey}
                            onChange={(e) => setUserApiKey(e.target.value)}
                            placeholder="Google AI Studio Key"
                            className="w-full px-4 py-2 bg-white border border-slate-300 rounded focus:border-amber-600 outline-none text-sm"
                        />
                        <div className="flex items-center gap-2">
                            <input
                                type="checkbox"
                                id="saveKey"
                                checked={saveApiKey}
                                onChange={(e) => setSaveApiKey(e.target.checked)}
                                className="w-4 h-4 text-amber-600 bg-gray-100 border-gray-300 rounded focus:ring-amber-500"
                            />
                            <label htmlFor="saveKey" className="text-xs text-slate-600 cursor-pointer select-none font-medium">Save Key</label>
                        </div>
                    </div>

                    {/* Inputs */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Board Image <span className="text-red-500">*</span></label>
                        <div className={`group relative border border-slate-200 rounded-lg p-6 md:p-10 transition-all text-center cursor-pointer ${selectedImage ? 'bg-slate-50' : 'bg-white hover:bg-slate-50'}`}>
                            <input type="file" accept="image/*" onChange={handleImageChange} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" />
                            {imagePreview ? (
                                <div className="relative z-0">
                                    <img src={imagePreview} alt="Preview" className="max-h-48 md:max-h-56 mx-auto shadow-lg rounded-sm object-contain" />
                                    <div className="mt-4 inline-flex items-center gap-2 text-emerald-600 font-medium bg-emerald-50 px-3 py-1 rounded-full text-sm">
                                        <Icon name="Check" size={14} /> <span>이미지 업로드 완료</span>
                                    </div>
                                </div>
                            ) : (
                                <div className="space-y-4 py-4">
                                    <div className="w-14 h-14 bg-slate-100 text-slate-400 rounded-full flex items-center justify-center mx-auto group-hover:scale-110 transition-transform">
                                        <Icon name="Upload" size={24} />
                                    </div>
                                    <p className="text-slate-700 font-medium">판서 이미지 업로드</p>
                                </div>
                            )}
                        </div>
                    </div>

                    {error && (
                        <div className="p-4 bg-red-50 text-red-800 text-sm rounded border border-red-100 flex items-center gap-3">
                            <Icon name="X" size={16} /> {error}
                        </div>
                    )}

                    <button
                        onClick={generateReport}
                        disabled={isLoading || !studentName || !selectedImage || !userApiKey}
                        className={`w-full py-4 rounded-lg font-bold text-sm tracking-widest uppercase transition-all shadow-md flex items-center justify-center gap-3 ${isLoading || !studentName || !selectedImage || !userApiKey
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
