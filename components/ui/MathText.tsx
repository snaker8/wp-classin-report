'use client';

import 'katex/dist/katex.min.css';
import { InlineMath } from 'react-katex';

interface MathTextProps {
    text: string;
    className?: string;
}

export const MathText = ({ text, className = '' }: MathTextProps) => {
    if (!text) return null;

    // Split text by standard LaTeX delimiters: 
    // $...$ (inline), $$...$$ (block), \[...\] (block), \(...\) (inline)

    // Simple parser for $...$
    // Note: This is a basic parser. For advanced nested structures, a library like react-latex-next is better,
    // but we want to minimize deps. This handles single $ delimiters well.
    const parts = text.split(/(\$[^$]+\$)/g);

    return (
        <span className={className}>
            {parts.map((part, index) => {
                if (part.startsWith('$') && part.endsWith('$')) {
                    // Remove $ and render math
                    const math = part.slice(1, -1);
                    return <InlineMath key={index} math={math} />;
                }
                return part;
            })}
        </span>
    );
};
