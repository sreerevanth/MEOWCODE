"use client";

import * as React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Copy, Check } from "lucide-react";
import { Button } from "@meowcode/ui";

function CodeBlock({ className, children }: { className?: string; children: React.ReactNode }): React.ReactElement {
  const [copied, setCopied] = React.useState(false);
  const text = String(children).replace(/\n$/, "");
  const language = className?.replace("language-", "") ?? "text";

  const copy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="group relative my-3 overflow-hidden rounded-md border border-zinc-200 dark:border-zinc-800">
      <div className="flex items-center justify-between border-b border-zinc-200 bg-zinc-100 px-3 py-1.5 text-[11px] text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">
        <span>{language}</span>
        <Button variant="ghost" className="h-6 gap-1 px-2 text-[10px]" onClick={() => void copy()}>
          {copied ? <Check size={12} /> : <Copy size={12} />}
          {copied ? "Copied" : "Copy"}
        </Button>
      </div>
      <pre className="overflow-x-auto bg-zinc-950 p-4 text-[13px] leading-6 text-zinc-100">
        <code className={className}>{children}</code>
      </pre>
    </div>
  );
}

export function MarkdownContent({ content }: { content: string }): React.ReactElement {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        pre({ children }) {
          return <>{children}</>;
        },
        code({ className, children, ...props }) {
          const inline = !className;
          if (inline) {
            return (
              <code className="rounded bg-zinc-100 px-1 py-0.5 font-mono text-[0.85em] dark:bg-zinc-800" {...props}>
                {children}
              </code>
            );
          }
          return <CodeBlock className={className}>{children}</CodeBlock>;
        },
        a({ href, children }) {
          return (
            <a href={href} target="_blank" rel="noreferrer" className="text-cyan-600 underline dark:text-cyan-400">
              {children}
            </a>
          );
        },
        table({ children }) {
          return (
            <div className="my-3 overflow-x-auto">
              <table className="min-w-full border-collapse text-sm">{children}</table>
            </div>
          );
        },
        th({ children }) {
          return <th className="border border-zinc-200 bg-zinc-50 px-3 py-2 text-left dark:border-zinc-700 dark:bg-zinc-900">{children}</th>;
        },
        td({ children }) {
          return <td className="border border-zinc-200 px-3 py-2 dark:border-zinc-700">{children}</td>;
        }
      }}
    >
      {content}
    </ReactMarkdown>
  );
}
