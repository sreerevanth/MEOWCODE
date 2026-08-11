import { jsx as _jsx } from "react/jsx-runtime";
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";
export function cn(...inputs) {
    return twMerge(clsx(inputs));
}
export function Button({ className, variant = "primary", ...props }) {
    const variants = {
        primary: "bg-zinc-950 text-white hover:bg-zinc-800 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-200",
        secondary: "bg-zinc-100 text-zinc-950 hover:bg-zinc-200 dark:bg-zinc-850 dark:text-zinc-50 dark:hover:bg-zinc-800",
        ghost: "bg-transparent text-zinc-700 hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-zinc-850"
    };
    return (_jsx("button", { className: cn("inline-flex h-9 items-center justify-center rounded-md px-3 text-sm font-medium transition focus:outline-none focus:ring-2 focus:ring-cyan-500 disabled:cursor-not-allowed disabled:opacity-50", variants[variant], className), ...props }));
}
export function StatusPill({ children }) {
    return (_jsx("span", { className: "inline-flex items-center rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:text-emerald-300", children: children }));
}
