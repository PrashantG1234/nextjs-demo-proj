"use client";

import { useState } from "react";
import ReactMarkdown from "react-markdown";
import { Check, Copy } from "lucide-react";
import { cn } from "@/lib/utils";

interface MarkdownRendererProps {
  content: string;
  className?: string;
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button
      onClick={handleCopy}
      className="absolute top-2 right-2 p-1.5 rounded-md bg-neutral-700 hover:bg-neutral-600 text-neutral-300 hover:text-white transition-all opacity-0 group-hover:opacity-100"
      title="Copy code"
    >
      {copied ? <Check className="h-3.5 w-3.5 text-green-400" /> : <Copy className="h-3.5 w-3.5" />}
    </button>
  );
}

export function MarkdownRenderer({
  content,
  className,
}: MarkdownRendererProps) {
  return (
    <div className={cn("prose leading-tight max-w-none", className)}>
      <ReactMarkdown
        components={{
          pre: ({ children, ...props }) => (
            <div className="relative group not-prose">
              <pre
                className="overflow-x-auto rounded-lg bg-neutral-800 text-neutral-100 p-4 text-sm font-mono"
                {...props}
              >
                {children}
              </pre>
              <CopyButton text={
                // extract text from nested code element
                typeof children === 'object' && children !== null && 'props' in (children as React.ReactElement)
                  ? String((children as React.ReactElement).props?.children ?? '')
                  : String(children ?? '')
              } />
            </div>
          ),
          code: ({ children, className, ...props }) => {
            const match = /language-(\w+)/.exec(className || "");
            const isInline = !match;

            if (isInline) {
              return (
                <code
                  className="not-prose text-sm px-1 py-0.5 rounded-sm bg-neutral-100 text-neutral-900 font-mono"
                  {...props}
                >
                  {children}
                </code>
              );
            }
            return (
              <code className={cn("", className)} {...props}>
                {children}
              </code>
            );
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
