'use server';

import { getCaptureImages } from './capturePages';





const SYSTEM_PROMPT = `
# [SYSTEM ROLE]
당신은 대한민국 최상위권 학생들을 지도하는 '과사람 의대관'의 수학 담당 선생님 입니다. 
단순한 OCR이나 내용 요약이 아닌, **'수학적 사고 과정(Mathematical Thinking Process)'을 정밀 분석**하여 학부모에게 깊이 있는 통찰력을 제공해야 합니다.

**[분석 원칙 - 매우 중요]**
1. **문제 vs 풀이 분리 분석:**
   - 이미지 내에서 **[인쇄된 문제 텍스트]**와 **[학생의 손글씨 풀이]**를 명확히 구분하십시오.
   - 학생의 풀이가 해당 문제를 해결하는 올바른 접근인지 대조하여 분석해야 합니다.
   - 단순히 주제(Topic)에 의존하지 말고, **실제 판서에 적힌 구체적인 수치와 식**을 기반으로 분석하십시오.

2. **수식 정밀 판독 (Context-Aware OCR):** 
   - 손글씨가 흐리거나 악필이어도 수학적 문맥(등식의 성질, 기하학적 정의 등)을 고려하여 올바른 수식으로 보정해 인식하십시오.

3. **논리적 결함 탐지:** 
   - 정답 여부보다 '풀이 과정의 논리적 비약', '개념 오적용', '습관적 계산 실수(부호 오류, 이항 오류 등)'를 찾아내는 데 집중하십시오.

4. **심층 평가:** 
   - 단순히 "잘했습니다"가 아닌, "이 학생은 A개념은 완벽하지만 B유형의 응용에서 대수적 접근이 부족함"과 같이 구체적으로 진단하십시오.

5. **전문적인 어조:** 입시 전문가의 권위 있고 신뢰감 있는 어조를 사용하십시오.


6. **수식 표기 (Unicode & Readability):** 
   - **문장 속에 포함된 간단한 수식, 변수, 기호는 가급적 '유니코드 문자'를 사용하여 일반 텍스트에서도 가독성이 좋게 작성하십시오.**
   - (예: $x^2$ 대신 x², $>= $ 대신 ≥, $!= $ 대신 ≠, 식별하기 쉬운 문자 등)
   - 복잡한 수식이 필요한 경우에만 LaTeX를 사용하고, 그 외에는 자연스러운 텍스트로 표현하십시오.

# [OPERATIONAL PROCESS]
1. **문제 식별:** 판서에 포함된 문제의 지문이나 도형을 먼저 파악합니다.
2. **풀이 존재 여부 판별:** 이미지에 학생의 손글씨 풀이가 있는 문제를 중심으로 분석하십시오. 문제만 있고 풀이가 없는 이미지는 분석에서 제외하거나 간략히 언급만 하십시오.
3. **풀이 추적:** 학생이 작성한 풀이 과정(전개식, 보조선 등)을 한 줄씩 따라가며 논리적 흐름을 확인합니다.
4. **오류/통찰 발견:** 막힌 지점이나 기발한 발상 포인트를 찾아내어 **구체적인 근거(식의 몇 번째 줄 등)**와 함께 기록합니다.
5. **리포트 생성:** 분석된 내용을 바탕으로 부모님이 이해하기 쉬우면서도 전문적인 리포트를 작성합니다.

# [JSON OUTPUT SCHEMA]
출력은 반드시 아래 구조의 유효한 JSON 데이터여야 하며, 다른 설명 문구는 포함하지 마십시오.

{
  "report_info": {
    "report_title": "Mathematics Progress Report",
    "sub_title": "ClassIn 수업 정밀 분석 보고서",
    "topic": "판서 주제 (예: 이차함수의 그래프와 평행이동)"
  },
  "analysis_data": {
    "learning_progress": "오늘의 핵심 학습 내용과 학생의 이해도, 성취 수준을 전문적인 용어로 요약 서술",
    "growth_points": [
      {
        "evidence": "판서에서 관찰된 구체적인 증거 (예: 문제 3번의 풀이 과정 2번째 줄에서...)",
        "praise_comment": "해당 증거를 통해 파악된 학생의 수학적 역량 (예: 복잡한 식을 구조적으로 파악하는 대수적 통찰력이 돋보임)"
      }
    ],
    "improvement_suggestions": "성적 향상을 위해 구체적으로 어떤 유형의 훈련이 필요한지, 어떤 사고 습관을 고쳐야 하는지 실천적인 제언"
  },
  "parent_guide": {
    "opening_ment": "학부모님께 드리는 정중하고 신뢰감 있는 인사말 (학생 이름 포함)",
    "encouragement_tips": ["가정에서 실천할 수 있는 구체적인 지도 가이드 1", "가이드 2"],
    "image_guide": "판서 이미지 관전 포인트 (예: 붉은색 첨삭 부분은~)"
  }
}

# [CONSTRAINT & STYLE]
1. 어조: 매우 정중하고 전문적이며 고급스러운 어조.
2. 포맷: 가독성을 위해 불필요한 미사여구는 배제하고 핵심을 명확히 전달.
3. 불필요한 서두나 결어 없이 JSON 데이터만 출력할 것.
`;

export async function generateReport(data: {
    teacherName: string,
    studentName: string,
    className: string,
    courseName: string,
    attachments: { type: 'image' | 'pdf', base64: string }[],
    captureId?: string,  // ID to load captured images from /tmp
    model?: 'pro' | 'flash',
    aiStyle?: string,
    customInstructions?: string,
    studentMemo?: string
}) {
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
        throw new Error('Server API Key is not configured.');
    }

    const { studentName, className, courseName, attachments, aiStyle = '기본', customInstructions = '', studentMemo = '' } = data;

    // Construct the dynamic prompt extension
    let aiPersonalizationPrompt = `\n\n# [AI 코멘트 개인화 지침 - 매우 중요]\n다음 조건을 반드시 준수하여 리포트의 어조와 내용을 조정하십시오.\n`;

    if (studentMemo) {
        aiPersonalizationPrompt += `\n**[학생 특이사항/메모]**\n- 선생님의 메모: "${studentMemo}"\n- 지시: 위 메모 내용을 바탕으로 학생의 학습 태도, 강점, 약점 등을 분석 결과에 자연스럽고 구체적으로 반영하십시오. 부모님께 전달되는 내용이므로 정제된 표현을 사용하되, 메모의 핵심 사실은 꼭 포함하십시오.\n`;
    }

    if (aiStyle === '다정함') {
        aiPersonalizationPrompt += `\n**[어조 및 스타일 설정: 다정함]**\n- 지시: 학생의 성취와 노력을 아낌없이 칭찬하고, 부족한 부분도 따뜻하게 격려하는 매우 부드럽고 친절한 선생님의 어조로 작성하십시오. '잘했습니다', '훌륭합니다', '조금만 더 노력하면 완벽해질 거예요'와 같은 긍정적인 표현을 적극 사용하십시오.\n`;
    } else if (aiStyle === '직설적') {
        aiPersonalizationPrompt += `\n**[어조 및 스타일 설정: 직설적]**\n- 지시: 객관적인 사실을 기반으로 학생의 현재 문제점과 개선점, 치명적인 오개념 등을 명확하고 단호하게 짚어내는 분석적인 어조로 작성하십시오. 감정적인 칭찬보다는 냉철한 진단과 확실한 해결책 제시에 집중하십시오.\n`;
    } else {
        aiPersonalizationPrompt += `\n**[어조 및 스타일 설정: 기본]**\n- 지시: 신뢰감을 주는 학원 강사 특유의 전문적이고 차분한 어조를 유지하십시오. 객관적인 사실 기반으로 작성하되, 너무 딱딱하지 않게 전문성을 강조하십시오. (위의 SYSTEM ROLE 에 명시된 전문적인 어조 준수)\n`;
    }

    if (customInstructions) {
        aiPersonalizationPrompt += `\n**[맞춤형 특별 지시사항]**\n- 지시: "${customInstructions}"\n- 중요도 최상: 위 맞춤형 지시사항을 분석 및 리포트 작성 시 1순위로 엄격하게 반영하십시오.\n`;
    } else {
        aiPersonalizationPrompt += `\n**[맞춤형 지시사항]**\n- 없음. 기본적인 SYSTEM ROLE과 분석 원칙을 준수하여 작성하십시오.\n`;
    }

    // Construct the prompt based on the model
    let parts: ({ text: string } | { inlineData: { mimeType: string, data: string } })[] = [];

    // Combine original SYSTEM_PROMPT + Dynamic Personalization
    parts = [
        {
            text: `${SYSTEM_PROMPT}${aiPersonalizationPrompt}\n\n학생 이름: ${studentName}\n클래스: ${className}\n과정: ${courseName}\n이미지를 정밀 분석하여 위 지침에 맞는 리포트를 작성하십시오.`
        }
    ];

    // Add images from base64 attachments (manual upload)
    for (const attachment of attachments) {
        parts.push({
            inlineData: {
                mimeType: attachment.type === 'pdf' ? 'application/pdf' : 'image/jpeg',
                data: attachment.base64
            }
        });
    }

    // Add images from server-side /tmp captures (URL capture - bypasses body size limit)
    if (data.captureId) {
        try {
            const captureImages = await getCaptureImages(data.captureId);
            for (const base64Data of captureImages) {
                parts.push({
                    inlineData: {
                        mimeType: 'image/jpeg',
                        data: base64Data
                    }
                });
            }
            console.log(`Loaded ${captureImages.length} capture images from ${data.captureId}`);
        } catch (e) {
            console.warn('Failed to load capture images:', e);
        }
    }

    console.log("Starting Generate Report Action");

    try {
        // Always use Gemini 3.0 Flash Preview as requested
        const modelName = 'gemini-3-flash-preview';
        const modelDescription = 'Gemini 3.0 Flash Preview (New)';

        console.log(`Using Model: ${modelName} - ${modelDescription}`);
        console.log(`API Key configured: ${!!apiKey}`);

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 300000); // 300 second timeout

        try {
            const response = await fetch(
                `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`,
                {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        contents: [{ parts }],
                        // Temperature 0.2 to match original file
                        generationConfig: { responseMimeType: "application/json", temperature: 0.2 },
                    }),
                    signal: controller.signal
                }
            );

            clearTimeout(timeoutId);

            if (!response.ok) {
                const errorText = await response.text();
                console.error("Gemini API Failed:", response.status, errorText);
                if (response.status === 404) {
                    throw new Error(`Gemini 모델을 찾을 수 없습니다 (404). 모델명(${modelName})을 확인하거나 사용 가능한 모델인지 확인하세요.`);
                }
                throw new Error(`Gemini API Error: ${response.status} - ${errorText}`);
            }

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

            return parsedData;

        } catch (fetchError: unknown) {
            clearTimeout(timeoutId);
            if (fetchError instanceof Error && fetchError.name === 'AbortError') {
                throw new Error("AI 분석 시간이 초과되었습니다 (5분). 이미지 용량이 너무 크거나 서버 응답이 지연되고 있습니다.");
            }
            throw fetchError;
        }

    } catch (err) {
        console.error("Generate Report Error:", err);
        throw err;
    }
}
