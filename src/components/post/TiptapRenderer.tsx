'use client';

import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import Image from '@tiptap/extension-image';
import Mathematics from '@tiptap/extension-mathematics';
import type { TiptapDocument } from '@/types/post.types';
import 'katex/dist/katex.min.css';

interface TiptapRendererProps {
  content: TiptapDocument;
  className?: string;
}

export function TiptapRenderer({ content, className }: TiptapRendererProps) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Link.configure({
        openOnClick: true, // Allow clicking links in read mode
        HTMLAttributes: {
          class: 'text-blue-400 underline hover:text-blue-500 cursor-pointer',
          target: '_blank',
          rel: 'noopener noreferrer nofollow',
        },
      }),
      Image.configure({
        inline: false, // Match editor configuration
        HTMLAttributes: {
          class: 'max-w-full h-auto rounded-lg my-4',
        },
      }),
      Mathematics.configure({
        katexOptions: {
          throwOnError: false,
        },
      } as any),
    ],
    content: content,
    editable: false, // Read-only mode
    immediatelyRender: false,
  });

  if (!editor) {
    return null;
  }

  return (
    <div className="md:px-0 px-6">
      <EditorContent
        editor={editor}
        className={`prose prose-invert max-w-none prose-a:text-blue-400 prose-a:no-underline hover:prose-a:underline prose-img:rounded-lg prose-img:my-4 ${className || ''}`}
      />
    </div>
  );
}
