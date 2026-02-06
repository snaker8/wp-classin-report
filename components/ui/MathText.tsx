'use client';

import 'katex/dist/katex.min.css';
import Latex from 'react-latex-next';

interface MathTextProps {
    text: string;
    className?: string;
}

export const MathText = ({ text, className = '' }: MathTextProps) => {
    if (!text) return null;

    // Helper to convert simple LaTeX to Unicode for better readability in text
    const prettifyMath = (input: string) => {
        // 1. Common LaTeX symbol replacements
        let processed = input
            .replace(/\\times/g, '×')
            .replace(/\\div/g, '÷')
            .replace(/\\ne/g, '≠')
            .replace(/\\neq/g, '≠')
            .replace(/\\ge/g, '≥')
            .replace(/\\le/g, '≤')
            .replace(/\\rightarrow/g, '→')
            .replace(/\\leftarrow/g, '←')
            .replace(/!=/g, '≠')
            .replace(/>=/g, '≥')
            .replace(/<=/g, '≤');

        // 2. Simple superscripts (x^2 -> x², x^3 -> x³)
        // Handle cases like "x^2" or "{x}^2" or "(x)^2" broadly
        processed = processed.replace(/\^2/g, '²').replace(/\^3/g, '³');

        // 3. Process segments inside $...$
        // If the content inside $...$ is "simple" (only alphanumeric + basic symbols), strip the $ delimiters
        // so it renders as plain text with our Unicode replacements.
        return processed.replace(/\$([^$]+)\$/g, (match, content) => {
            const trimmed = content.trim();
            // Check if it contains any remaining LaTeX commands (starting with \) or complex braces
            // We allow simple text, numbers, and our unicode symbols
            const isSimple = /^[\w\s+\-*/=<>.,()²³×÷≠≥≤→←]+$/.test(trimmed) && !trimmed.includes('\\');

            if (isSimple) {
                return trimmed; // Return content without $ delimiters -> plain text
            }
            return match; // Keep as LaTeX -> KaTeX renders it
        });
    };

    const displayText = prettifyMath(text);

    return (
        <span className={className}>
            <Latex>{displayText}</Latex>
        </span>
    );
};
