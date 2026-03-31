"use client";

import { useEffect } from "react";

export default function SecurityProvider({
    children,
}: {
    children: React.ReactNode;
}) {
    useEffect(() => {
        const preventDefault = (e: Event) => {
            const target = e.target as HTMLElement;
            if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA")) {
                return;
            }
            e.preventDefault();
        };

        const handleKeydown = (e: KeyboardEvent) => {
            const target = e.target as HTMLElement;
            const isInput = target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA");

            // Prevent F12, Ctrl+Shift+I, Ctrl+Shift+J, Ctrl+U
            if (
                e.key === "F12" ||
                (e.ctrlKey && e.shiftKey && (e.key.toLowerCase() === "i" || e.key.toLowerCase() === "j")) ||
                (e.ctrlKey && e.key.toLowerCase() === "u")
            ) {
                e.preventDefault();
            }
            // Prevent Ctrl+C, Ctrl+X, Ctrl+V, Ctrl+A (Unless typing in input)
            if (
                !isInput &&
                e.ctrlKey &&
                (e.key.toLowerCase() === "c" || e.key.toLowerCase() === "x" || e.key.toLowerCase() === "v" || e.key.toLowerCase() === "a")
            ) {
                e.preventDefault();
            }
        };

        document.addEventListener("contextmenu", preventDefault);
        document.addEventListener("copy", preventDefault);
        document.addEventListener("cut", preventDefault);
        document.addEventListener("paste", preventDefault);
        document.addEventListener("keydown", handleKeydown);
        document.addEventListener("dragstart", preventDefault);

        return () => {
            document.removeEventListener("contextmenu", preventDefault);
            document.removeEventListener("copy", preventDefault);
            document.removeEventListener("cut", preventDefault);
            document.removeEventListener("paste", preventDefault);
            document.removeEventListener("keydown", handleKeydown);
            document.removeEventListener("dragstart", preventDefault);
        };
    }, []);

    return <>{children}</>;
}
