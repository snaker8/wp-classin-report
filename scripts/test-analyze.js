const fs = require('fs');
const path = require('path');

const GEMINI_API_KEY = 'AIzaSyBbu0hq6wJDJcC8yUa65K8ErIuP1BF_7ZQ';

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
   - (예: x², ≥, ≠ 등)
   - 복잡한 수식이 필요한 경우에만 LaTeX를 사용하고, 그 외에는 자연스러운 텍스트로 표현하십시오.

# [JSON OUTPUT SCHEMA]
출력은 반드시 아래 구조의 유효한 JSON 데이터여야 하며, 다른 설명 문구는 포함하지 마십시오.

{
  "report_info": {
    "report_title": "Mathematics Progress Report",
    "sub_title": "ClassIn 수업 정밀 분석 보고서",
    "topic": "판서 주제"
  },
  "analysis_data": {
    "learning_progress": "오늘의 핵심 학습 내용과 학생의 이해도, 성취 수준을 전문적인 용어로 요약 서술",
    "growth_points": [
      {
        "evidence": "판서에서 관찰된 구체적인 증거",
        "praise_comment": "해당 증거를 통해 파악된 학생의 수학적 역량"
      }
    ],
    "improvement_suggestions": "성적 향상을 위해 구체적으로 어떤 유형의 훈련이 필요한지 실천적인 제언"
  },
  "parent_guide": {
    "opening_ment": "학부모님께 드리는 인사말 (학생 이름 포함)",
    "encouragement_tips": ["가정에서 실천할 수 있는 구체적인 지도 가이드 1", "가이드 2"],
    "image_guide": "판서 이미지 관전 포인트"
  }
}
`;

async function testAnalyze() {
    console.log('=== Gemini AI Analysis Test ===\n');

    const dataPath = path.join(__dirname, 'test-output', 'images.json');
    if (!fs.existsSync(dataPath)) {
        console.error('images.json not found! Run test-capture.js first.');
        return;
    }

    const data = JSON.parse(fs.readFileSync(dataPath, 'utf-8'));
    console.log(`Student: ${data.studentName}`);
    console.log(`Class: ${data.className}`);
    console.log(`Material: ${data.materialName}`);
    console.log(`Images: ${data.images.length}`);

    // Build the prompt parts
    const parts = [
        {
            text: `${SYSTEM_PROMPT}

# [AI 코멘트 개인화 지침]
**[어조 및 스타일 설정: 다정함]**
- 학생의 성취와 노력을 아낌없이 칭찬하고, 부족한 부분도 따뜻하게 격려하는 매우 부드럽고 친절한 선생님의 어조로 작성하십시오.

학생 이름: ${data.studentName}
클래스: ${data.className}
과정: ${data.materialName}
이미지를 정밀 분석하여 위 지침에 맞는 리포트를 작성하십시오.`
        }
    ];

    // Add images (use all 20, or limit if too large)
    const maxImages = 20;
    const imagesToUse = data.images.slice(0, maxImages);

    for (const img of imagesToUse) {
        parts.push({
            inlineData: {
                mimeType: 'image/jpeg',
                data: img.base64
            }
        });
    }

    console.log(`\nSending ${imagesToUse.length} images to Gemini...\n`);

    const startTime = Date.now();

    try {
        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${GEMINI_API_KEY}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts }],
                    generationConfig: { responseMimeType: 'application/json', temperature: 0.2 },
                }),
            }
        );

        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

        if (!response.ok) {
            const errorText = await response.text();
            console.error(`API Error (${response.status}):`, errorText);
            return;
        }

        const result = await response.json();
        const generatedText = result.candidates?.[0]?.content?.parts?.[0]?.text;

        if (!generatedText) {
            console.error('Empty response from Gemini');
            console.log(JSON.stringify(result, null, 2));
            return;
        }

        const reportData = JSON.parse(generatedText);

        console.log(`=== AI Analysis Complete (${elapsed}s) ===\n`);
        console.log('--- Report Info ---');
        console.log(`Title: ${reportData.report_info.report_title}`);
        console.log(`Subtitle: ${reportData.report_info.sub_title}`);
        console.log(`Topic: ${reportData.report_info.topic}`);

        console.log('\n--- Learning Progress ---');
        console.log(reportData.analysis_data.learning_progress);

        console.log('\n--- Growth Points ---');
        reportData.analysis_data.growth_points.forEach((gp, i) => {
            console.log(`\n  [${i + 1}] Evidence: ${gp.evidence}`);
            console.log(`      Praise: ${gp.praise_comment}`);
        });

        console.log('\n--- Improvement Suggestions ---');
        console.log(reportData.analysis_data.improvement_suggestions);

        console.log('\n--- Parent Guide ---');
        console.log(`Opening: ${reportData.parent_guide.opening_ment}`);
        console.log(`\nTips:`);
        reportData.parent_guide.encouragement_tips.forEach((tip, i) => {
            console.log(`  ${i + 1}. ${tip}`);
        });
        console.log(`\nImage Guide: ${reportData.parent_guide.image_guide}`);

        // Save full report
        fs.writeFileSync(
            path.join(__dirname, 'test-output', 'report.json'),
            JSON.stringify(reportData, null, 2)
        );
        console.log('\n\nFull report saved to test-output/report.json');

    } catch (err) {
        console.error('Analysis failed:', err);
    }
}

testAnalyze().catch(console.error);
