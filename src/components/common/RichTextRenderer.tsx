/**
 * RichTextRenderer Component
 * Renders Tiptap JSON content as HTML with proper styling
 */

'use client';

import React from 'react';
import type { TiptapDocument } from '@/types/post.types';

interface RichTextRendererProps {
  content: TiptapDocument;
}

export function RichTextRenderer({ content }: RichTextRendererProps) {
  // Convert Tiptap JSON to HTML-like JSX
  const renderNode = (node: any): React.ReactNode => {
    if (!node) return null;

    // Handle text nodes
    if (node.text !== undefined) {
      let text: React.ReactNode = node.text;

      // Apply marks (bold, italic, etc.)
      if (node.marks) {
        node.marks.forEach((mark: any) => {
          switch (mark.type) {
            case 'bold':
              text = <strong>{text}</strong>;
              break;
            case 'italic':
              text = <em>{text}</em>;
              break;
            case 'code':
              text = <code className="px-1 py-0.5 bg-gray-800 rounded">{text}</code>;
              break;
            case 'link':
              text = <a href={mark.attrs?.href} className="text-blue-400 hover:underline" target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}>{text}</a>;
              break;
          }
        });
      }

      return text;
    }

    // Handle element nodes
    switch (node.type) {
      case 'doc':
        return (
          <div className="prose prose-invert prose-lg max-w-none">
            {node.content?.map((child: any, index: number) => (
              <div key={index}>{renderNode(child)}</div>
            ))}
          </div>
        );

      case 'paragraph':
        return (
          <p className="text-gray-300 leading-relaxed mb-4">
            {node.content?.map((child: any, index: number) => (
              <span key={index}>{renderNode(child)}</span>
            )) || <br />}
          </p>
        );

      case 'heading':
        const level = node.attrs?.level || 1;
        const HeadingTag = `h${level}` as keyof React.JSX.IntrinsicElements;
        const headingClasses: Record<number, string> = {
          1: 'text-3xl font-bold text-white mb-4',
          2: 'text-2xl font-bold text-white mb-3',
          3: 'text-xl font-bold text-white mb-2',
          4: 'text-lg font-bold text-white mb-2',
          5: 'text-base font-bold text-white mb-2',
          6: 'text-sm font-bold text-white mb-2',
        };
        const headingClass = headingClasses[level] || 'text-xl font-bold text-white mb-2';

        return (
          <HeadingTag className={headingClass}>
            {node.content?.map((child: any, index: number) => (
              <span key={index}>{renderNode(child)}</span>
            ))}
          </HeadingTag>
        );

      case 'bulletList':
        return (
          <ul className="list-disc list-inside text-gray-300 mb-4 space-y-1">
            {node.content?.map((child: any, index: number) => (
              <span key={index}>{renderNode(child)}</span>
            ))}
          </ul>
        );

      case 'orderedList':
        return (
          <ol className="list-decimal list-inside text-gray-300 mb-4 space-y-1">
            {node.content?.map((child: any, index: number) => (
              <span key={index}>{renderNode(child)}</span>
            ))}
          </ol>
        );

      case 'listItem':
        return (
          <li>
            {node.content?.map((child: any, index: number) => (
              <span key={index}>{renderNode(child)}</span>
            ))}
          </li>
        );

      case 'blockquote':
        return (
          <blockquote className="border-l-4 border-gray-600 pl-4 text-gray-400 italic mb-4">
            {node.content?.map((child: any, index: number) => (
              <span key={index}>{renderNode(child)}</span>
            ))}
          </blockquote>
        );

      case 'codeBlock':
        return (
          <pre className="bg-gray-900 rounded-lg p-4 overflow-x-auto mb-4">
            <code className="text-gray-300 text-sm">
              {node.content?.map((child: any, index: number) => (
                <span key={index}>{renderNode(child)}</span>
              ))}
            </code>
          </pre>
        );

      case 'horizontalRule':
        return <hr className="border-gray-700 my-6" />;

      case 'hardBreak':
        return <br />;

      case 'image':
        return (
          <img
            src={node.attrs?.src}
            alt={node.attrs?.alt || ''}
            title={node.attrs?.title || ''}
            className="rounded-lg max-w-full h-auto my-4"
          />
        );

      default:
        // Fallback for unknown node types
        return node.content?.map((child: any, index: number) => (
          <span key={index}>{renderNode(child)}</span>
        )) || null;
    }
  };

  return <>{renderNode(content)}</>;
}