"use client";

import { useEffect } from "react";

export default function SecurityProvider({
    children,
}: {
    children: React.ReactNode;
}) {
    useEffect(() => {
        const preventDefault = (e: Event) => {
            e.preventDefault();
        };

        const handleKeydown = (e: KeyboardEvent) => {
            // Prevent F12, Ctrl+Shift+I, Ctrl+Shift+J, Ctrl+U
            if (
                e.key === "F12" ||
                (e.ctrlKey && e.shiftKey && (e.key === "I" || e.key === "J")) ||
                (e.ctrlKey && e.key === "u")
            ) {
                e.preventDefault();
            }
            // Prevent Ctrl+C, Ctrl+X, Ctrl+V, Ctrl+A
            if (
                e.ctrlKey &&
                (e.key === "c" || e.key === "x" || e.key === "v" || e.key === "a")
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
