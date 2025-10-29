'use client';

import { NodeViewWrapper, type NodeViewProps } from '@tiptap/react';
import { X } from 'lucide-react';
import { usePrivy } from '@/hooks/usePrivyHooks';
import { useState } from 'react';

export function TiptapImageNode({ node, deleteNode, selected }: NodeViewProps) {
  const { getAccessToken } = usePrivy();
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    setIsDeleting(true);

    try {
      // Extract the file path from the URL
      // URL format: https://{supabase-url}/storage/v1/object/public/veritas-media/images/{user_id}/{filename}
      const url = (node.attrs as any).src;
      const match = url.match(/\/storage\/v1\/object\/public\/veritas-media\/(.+)$/);

      if (match && match[1]) {
        const filePath = match[1]; // e.g., "images/user123/12345-abc.jpg"

        // Delete from Supabase Storage
        const token = await getAccessToken();
        if (token) {
          try {
            await fetch('/api/media/delete', {
              method: 'DELETE',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
              },
              body: JSON.stringify({ path: filePath }),
            });
          } catch (error) {
            console.warn('Failed to delete from storage, but removing from editor:', error);
          }
        }
      }
    } catch (error) {
      console.error('Error during image deletion:', error);
    } finally {
      // Always remove from editor, even if backend deletion fails
      deleteNode();
      setIsDeleting(false);
    }
  };

  return (
    <NodeViewWrapper className="relative inline-block my-4 group">
      <img
        src={(node.attrs as any).src}
        alt={(node.attrs as any).alt || ''}
        title={(node.attrs as any).title || ''}
        className={`max-w-full h-auto rounded-lg transition-all ${
          selected ? 'ring-3 ring-blue-400 ring-offset-2 ring-offset-gray-900' : ''
        }`}
        draggable
      />

      {/* Delete button - shows on hover or when selected */}
      <button
        onClick={handleDelete}
        disabled={isDeleting}
        className={`absolute top-2 right-2 bg-gray-800 hover:bg-gray-700 text-white p-2 rounded-lg transition-all opacity-0 group-hover:opacity-100 ${
          selected ? 'opacity-100' : ''
        } disabled:opacity-50 disabled:cursor-default shadow-lg`}
        title="Delete image"
        type="button"
      >
        {isDeleting ? (
          <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
        ) : (
          <X className="w-5 h-5" />
        )}
      </button>
    </NodeViewWrapper>
  );
}
