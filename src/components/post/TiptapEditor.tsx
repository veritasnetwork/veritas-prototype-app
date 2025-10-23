'use client';

import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import Link from '@tiptap/extension-link';
import Dropcursor from '@tiptap/extension-dropcursor';
import { CustomImage } from './CustomImageExtension';
import { useEffect, useState, useRef } from 'react';
import { Bold, Italic, List, ListOrdered, Quote, Undo, Redo, Heading1, Heading2, Heading3, Type, Image as ImageIcon } from 'lucide-react';
import { usePrivy } from '@/hooks/usePrivyHooks';
import type { TiptapDocument } from '@/types/post.types';

interface TiptapEditorProps {
  content: TiptapDocument | null;
  onChange: (content: TiptapDocument) => void;
  placeholder?: string;
  disabled?: boolean;
}

export function TiptapEditor({ content, onChange, placeholder, disabled }: TiptapEditorProps) {
  const { getAccessToken } = usePrivy();
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const imageInputRef = useRef<HTMLInputElement>(null);

  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({
        placeholder: placeholder || 'Start writing...',
      }),
      Link.configure({
        openOnClick: false,
        autolink: true, // Automatically detect URLs and make them links
        linkOnPaste: true, // Convert pasted URLs to links
        HTMLAttributes: {
          class: 'text-blue-400 underline hover:text-blue-500 cursor-pointer',
          target: '_blank',
          rel: 'noopener noreferrer nofollow',
        },
      }),
      CustomImage.configure({
        inline: false, // Block-level so it can be dragged
        allowBase64: false,
        HTMLAttributes: {
          class: 'max-w-full h-auto rounded-lg my-4',
          draggable: true,
        },
      }),
      Dropcursor.configure({
        color: '#60a5fa', // Blue cursor to show drop position
        width: 3,
      }),
    ],
    content: content || undefined,
    editable: !disabled,
    immediatelyRender: false, // Prevent SSR hydration mismatch
    onUpdate: ({ editor }) => {
      const json = editor.getJSON() as TiptapDocument;
      onChange(json);
    },
  });

  const handleImageUpload = async (file: File) => {
    if (!editor) return;

    setIsUploadingImage(true);
    try {
      const token = await getAccessToken();
      if (!token) {
        alert('Please log in to upload images');
        return;
      }

      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/media/upload-image', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to upload image');
      }

      // Insert image at cursor position
      editor.chain().focus().setImage({ src: data.url }).run();
    } catch (error) {
      console.error('Image upload error:', error);
      alert(error instanceof Error ? error.message : 'Failed to upload image');
    } finally {
      setIsUploadingImage(false);
    }
  };

  // Update editor content when prop changes externally
  useEffect(() => {
    if (editor && content && JSON.stringify(editor.getJSON()) !== JSON.stringify(content)) {
      editor.commands.setContent(content);
    }
  }, [content, editor]);

  // Update editable state when disabled prop changes
  useEffect(() => {
    if (editor) {
      editor.setEditable(!disabled);
    }
  }, [disabled, editor]);

  if (!editor) {
    return null;
  }

  return (
    <div className="border border-gray-700 rounded-lg overflow-hidden bg-[#0a0a0a] flex flex-col max-h-[600px]">
      {/* Toolbar - Sticky */}
      <div className="sticky top-0 z-10 flex items-center gap-1 px-3 py-2 border-b border-gray-700 bg-[#1a1a1a] flex-shrink-0">
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBold().run()}
          disabled={disabled || !editor.can().chain().focus().toggleBold().run()}
          className={`p-2 rounded hover:bg-gray-700 transition-colors ${
            editor.isActive('bold') ? 'bg-gray-700 text-blue-400' : 'text-gray-400'
          } disabled:opacity-50 disabled:cursor-not-allowed`}
          title="Bold"
        >
          <Bold className="w-4 h-4" />
        </button>

        <button
          type="button"
          onClick={() => editor.chain().focus().toggleItalic().run()}
          disabled={disabled || !editor.can().chain().focus().toggleItalic().run()}
          className={`p-2 rounded hover:bg-gray-700 transition-colors ${
            editor.isActive('italic') ? 'bg-gray-700 text-blue-400' : 'text-gray-400'
          } disabled:opacity-50 disabled:cursor-not-allowed`}
          title="Italic"
        >
          <Italic className="w-4 h-4" />
        </button>

        <div className="w-px h-6 bg-gray-700 mx-1" />

        <button
          type="button"
          onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
          className={`p-2 rounded hover:bg-gray-700 transition-colors ${
            editor.isActive('heading', { level: 1 }) ? 'bg-gray-700 text-blue-400' : 'text-gray-400'
          } disabled:opacity-50 disabled:cursor-not-allowed`}
          disabled={disabled}
          title="Heading 1"
        >
          <Heading1 className="w-4 h-4" />
        </button>

        <button
          type="button"
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          className={`p-2 rounded hover:bg-gray-700 transition-colors ${
            editor.isActive('heading', { level: 2 }) ? 'bg-gray-700 text-blue-400' : 'text-gray-400'
          } disabled:opacity-50 disabled:cursor-not-allowed`}
          disabled={disabled}
          title="Heading 2"
        >
          <Heading2 className="w-4 h-4" />
        </button>

        <button
          type="button"
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          className={`p-2 rounded hover:bg-gray-700 transition-colors ${
            editor.isActive('heading', { level: 3 }) ? 'bg-gray-700 text-blue-400' : 'text-gray-400'
          } disabled:opacity-50 disabled:cursor-not-allowed`}
          disabled={disabled}
          title="Heading 3"
        >
          <Heading3 className="w-4 h-4" />
        </button>

        <button
          type="button"
          onClick={() => editor.chain().focus().setParagraph().run()}
          className={`p-2 rounded hover:bg-gray-700 transition-colors ${
            editor.isActive('paragraph') ? 'bg-gray-700 text-blue-400' : 'text-gray-400'
          } disabled:opacity-50 disabled:cursor-not-allowed`}
          disabled={disabled}
          title="Normal Text"
        >
          <Type className="w-4 h-4" />
        </button>

        <div className="w-px h-6 bg-gray-700 mx-1" />

        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          disabled={disabled || !editor.can().chain().focus().toggleBulletList().run()}
          className={`p-2 rounded hover:bg-gray-700 transition-colors ${
            editor.isActive('bulletList') ? 'bg-gray-700 text-blue-400' : 'text-gray-400'
          } disabled:opacity-50 disabled:cursor-not-allowed`}
          title="Bullet List"
        >
          <List className="w-4 h-4" />
        </button>

        <button
          type="button"
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          disabled={disabled || !editor.can().chain().focus().toggleOrderedList().run()}
          className={`p-2 rounded hover:bg-gray-700 transition-colors ${
            editor.isActive('orderedList') ? 'bg-gray-700 text-blue-400' : 'text-gray-400'
          } disabled:opacity-50 disabled:cursor-not-allowed`}
          title="Numbered List"
        >
          <ListOrdered className="w-4 h-4" />
        </button>

        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          disabled={disabled || !editor.can().chain().focus().toggleBlockquote().run()}
          className={`p-2 rounded hover:bg-gray-700 transition-colors ${
            editor.isActive('blockquote') ? 'bg-gray-700 text-blue-400' : 'text-gray-400'
          } disabled:opacity-50 disabled:cursor-not-allowed`}
          title="Quote"
        >
          <Quote className="w-4 h-4" />
        </button>

        <div className="w-px h-6 bg-gray-700 mx-1" />

        {/* Image Button */}
        <button
          type="button"
          onClick={() => imageInputRef.current?.click()}
          disabled={disabled || isUploadingImage}
          className="p-2 rounded hover:bg-gray-700 transition-colors text-gray-400 disabled:opacity-50 disabled:cursor-not-allowed"
          title={isUploadingImage ? 'Uploading...' : 'Add Image'}
        >
          {isUploadingImage ? (
            <div className="w-4 h-4 border-2 border-gray-700 border-t-blue-400 rounded-full animate-spin" />
          ) : (
            <ImageIcon className="w-4 h-4" />
          )}
        </button>

        {/* Hidden file input */}
        <input
          ref={imageInputRef}
          type="file"
          accept="image/jpeg,image/png,image/gif,image/webp"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) {
              handleImageUpload(file);
            }
            // Reset input
            e.target.value = '';
          }}
          className="hidden"
        />

        <div className="w-px h-6 bg-gray-700 mx-1" />

        <button
          type="button"
          onClick={() => editor.chain().focus().undo().run()}
          disabled={disabled || !editor.can().chain().focus().undo().run()}
          className="p-2 rounded hover:bg-gray-700 transition-colors text-gray-400 disabled:opacity-50 disabled:cursor-not-allowed"
          title="Undo"
        >
          <Undo className="w-4 h-4" />
        </button>

        <button
          type="button"
          onClick={() => editor.chain().focus().redo().run()}
          disabled={disabled || !editor.can().chain().focus().redo().run()}
          className="p-2 rounded hover:bg-gray-700 transition-colors text-gray-400 disabled:opacity-50 disabled:cursor-not-allowed"
          title="Redo"
        >
          <Redo className="w-4 h-4" />
        </button>
      </div>

      {/* Editor Content - Scrollable */}
      <div className="flex-1 overflow-y-auto">
        <EditorContent
          editor={editor}
          className="prose prose-invert max-w-none p-4 min-h-[250px] focus:outline-none prose-a:text-blue-400 prose-a:no-underline hover:prose-a:underline prose-img:rounded-lg prose-img:my-4"
        />
      </div>
    </div>
  );
}
