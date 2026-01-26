declare module 'react-katex' {
    import * as React from 'react';

    export interface KatexProps {
        math: string;
        block?: boolean;
        errorColor?: string;
        renderError?: (error: Error | TypeError) => React.ReactNode;
        settings?: any;
        as?: React.ElementType;
        children?: React.ReactNode;
        className?: string;
    }

    export const InlineMath: React.FC<KatexProps>;
    export const BlockMath: React.FC<KatexProps>;
}
