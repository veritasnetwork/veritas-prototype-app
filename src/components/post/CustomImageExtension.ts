import Image from '@tiptap/extension-image';
import { ReactNodeViewRenderer } from '@tiptap/react';
import { TiptapImageNode } from './TiptapImageNode';

export const CustomImage = Image.extend({
  addNodeView() {
    return ReactNodeViewRenderer(TiptapImageNode);
  },

  addKeyboardShortcuts() {
    return {
      // Prevent backspace/delete from removing images
      Backspace: ({ editor }) => {
        const { $anchor } = editor.state.selection;
        const nodeBefore = $anchor.nodeBefore;

        // If the node before cursor is an image, don't delete it
        if (nodeBefore && nodeBefore.type.name === 'image') {
          return true; // Prevent default backspace behavior
        }

        return false; // Allow normal backspace
      },
      Delete: ({ editor }) => {
        const { $anchor } = editor.state.selection;
        const nodeAfter = $anchor.nodeAfter;

        // If the node after cursor is an image, don't delete it
        if (nodeAfter && nodeAfter.type.name === 'image') {
          return true; // Prevent default delete behavior
        }

        return false; // Allow normal delete
      },
    };
  },
});
