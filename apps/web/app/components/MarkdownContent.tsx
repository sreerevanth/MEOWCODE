"use client";

import * as React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Copy, Check, Eye, Code } from "lucide-react";
import { Button } from "@meowcode/ui";

function CodeBlock({ className, children }: { className?: string; children: React.ReactNode }): React.ReactElement {
  const [copied, setCopied] = React.useState(false);
  const [isPreview, setIsPreview] = React.useState(false);
  const text = String(children).replace(/\n$/, "");
  const language = className?.replace("language-", "") ?? "text";
  
  const canPreview = language === "html" || language === "svg";

  const copy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="group relative my-3 overflow-hidden rounded-md border border-zinc-200 shadow-sm dark:border-zinc-800">
      <div className="flex items-center justify-between border-b border-zinc-200 bg-zinc-100/50 px-3 py-1.5 text-[11px] text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">
        <span className="font-medium uppercase tracking-wider">{language}</span>
        <div className="flex items-center gap-1">
          {canPreview && (
            <Button variant="ghost" className="h-6 gap-1 px-2 text-[10px]" onClick={() => setIsPreview(!isPreview)}>
              {isPreview ? <Code size={12} /> : <Eye size={12} />}
              {isPreview ? "View Code" : "Live Preview"}
            </Button>
          )}
          <Button variant="ghost" className="h-6 gap-1 px-2 text-[10px]" onClick={() => void copy()}>
            {copied ? <Check size={12} /> : <Copy size={12} />}
            {copied ? "Copied" : "Copy"}
          </Button>
        </div>
      </div>
      {isPreview ? (
        <div className="w-full bg-white transition-all">
          <iframe 
            srcDoc={text} 
            className="w-full min-h-[400px] border-none" 
            sandbox="allow-scripts allow-forms allow-same-origin allow-popups"
            title="Artifact Preview"
          />
        </div>
      ) : (
        <pre className="overflow-x-auto bg-zinc-950 p-4 text-[13px] leading-6 text-zinc-100">
          <code className={className}>{children}</code>
        </pre>
      )}
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
        blockquote({ children }) {
          const extractText = (node: any): string => {
            if (typeof node === "string") return node;
            if (Array.isArray(node)) return node.map(extractText).join(" ");
            if (React.isValidElement(node) && node.props && (node.props as any).children) {
              return extractText((node.props as any).children);
            }
            return "";
          };
          const text = extractText(children);
          const isToolLog = text.includes("🤖") || text.includes("✅") || text.includes("❌");
          
          if (isToolLog) {
            const isError = text.includes("❌");
            const isSuccess = text.includes("✅");
            
            return (
              <div className={`my-2 flex items-center gap-2 rounded-md border px-3 py-2 text-[12px] font-mono shadow-sm transition-all
                ${isError ? "border-red-500/50 bg-red-500/10 text-red-500 dark:bg-red-500/10" : 
                  isSuccess ? "border-green-500/50 bg-green-500/10 text-green-600 dark:bg-green-500/10 dark:text-green-400" : 
                  "border-cyan-500/50 bg-cyan-500/10 text-cyan-700 dark:bg-cyan-500/10 dark:text-cyan-400 animate-pulse"}`}>
                {children}
              </div>
            );
          }
          
          return (
            <blockquote className="border-l-2 border-zinc-300 pl-4 italic text-zinc-600 dark:border-zinc-700 dark:text-zinc-400">
              {children}
            </blockquote>
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
