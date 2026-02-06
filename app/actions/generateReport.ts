'use server';





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
2. **풀이 추적:** 학생이 작성한 풀이 과정(전개식, 보조선 등)을 한 줄씩 따라가며 논리적 흐름을 확인합니다.
3. **오류/통찰 발견:** 막힌 지점이나 기발한 발상 포인트를 찾아내어 **구체적인 근거(식의 몇 번째 줄 등)**와 함께 기록합니다.
4. **리포트 생성:** 분석된 내용을 바탕으로 부모님이 이해하기 쉬우면서도 전문적인 리포트를 작성합니다.

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
    model?: 'pro' | 'flash'
}) {
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
        throw new Error('Server API Key is not configured.');
    }

    const { studentName, className, courseName, attachments } = data;

    // Construct the prompt based on the model
    let parts: ({ text: string } | { inlineData: { mimeType: string, data: string } })[] = [];

    // Use the full SYSTEM_PROMPT for all models (including Flash) to match "ChaMath" quality
    // Removing the "Flash Mode" abbreviated instructions.
    parts = [
        {
            text: `${SYSTEM_PROMPT}\n\n학생 이름: ${studentName}\n클래스: ${className}\n과정: ${courseName}\n이미지를 정밀 분석하여 리포트를 작성하십시오.`
        }
    ];

    for (const attachment of attachments) {
        parts.push({
            inlineData: {
                mimeType: attachment.type === 'pdf' ? 'application/pdf' : 'image/jpeg',
                data: attachment.base64
            }
        });
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
