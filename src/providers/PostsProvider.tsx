'use client';

import { createContext, useContext, ReactNode } from 'react';

interface PostsContextValue {
  refreshPosts: () => void;
}

const PostsContext = createContext<PostsContextValue | null>(null);

export function usePostsContext() {
  const context = useContext(PostsContext);
  if (!context) {
    throw new Error('usePostsContext must be used within a PostsProvider');
  }
  return context;
}

interface PostsProviderProps {
  children: ReactNode;
  refreshPosts: () => void;
}

export function PostsProvider({ children, refreshPosts }: PostsProviderProps) {
  return (
    <PostsContext.Provider value={{ refreshPosts }}>
      {children}
    </PostsContext.Provider>
  );
}