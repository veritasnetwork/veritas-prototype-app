'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { 
  Sliders,
  ChevronRight,
  Menu,
  X,
  Edit,
  Sun,
  Moon,
  User
} from 'lucide-react';
import { useSafeTheme } from '@/hooks/useSafeTheme';
import { supabase } from '@/lib/supabase';

export function Sidebar() {
  const [showMobileSidebar, setShowMobileSidebar] = useState(false);
  const [showAlgorithmPanel, setShowAlgorithmPanel] = useState(false);
  const [showCreatePanel, setShowCreatePanel] = useState(false);
  const [beliefValue, setBeliefValue] = useState(50);
  const [metaBeliefValue, setMetaBeliefValue] = useState(50);
  const [postTitle, setPostTitle] = useState('');
  const [postContent, setPostContent] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [selectedUserInfo, setSelectedUserInfo] = useState<{username: string, display_name: string} | null>(null);
  const { mounted, theme, toggleTheme } = useSafeTheme();

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (showAlgorithmPanel && !(e.target as Element).closest('.algorithm-panel')) {
        setShowAlgorithmPanel(false);
      }
      if (showCreatePanel && !(e.target as Element).closest('.create-panel')) {
        setShowCreatePanel(false);
      }
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [showAlgorithmPanel, showCreatePanel]);

  // Load selected user info when create panel opens
  const loadSelectedUserInfo = async () => {
    const selectedUserId = localStorage.getItem('selectedUserId');
    
    if (selectedUserId) {
      try {
        const { data: userData, error } = await supabase
          .from('users')
          .select('username, display_name')
          .eq('id', selectedUserId)
          .single();

        if (!error && userData) {
          setSelectedUserInfo({
            username: userData.username,
            display_name: userData.display_name
          });
        } else {
          setSelectedUserInfo(null);
        }
      } catch (error) {
        console.error('Error loading user info:', error);
        setSelectedUserInfo(null);
      }
    } else {
      setSelectedUserInfo(null);
    }
  };

  // Load user info when create panel opens
  useEffect(() => {
    if (showCreatePanel) {
      loadSelectedUserInfo();
    }
  }, [showCreatePanel]);

  const createOpinionPost = async () => {
    // According to specs: title is required for opinion posts, content is optional
    if (!postTitle.trim()) {
      alert('Please provide a title for your opinion post');
      return;
    }
    
    // Get the currently selected user from the dashboard
    const selectedUserId = localStorage.getItem('selectedUserId');
    
    if (!selectedUserId) {
      alert('Please select a user in the dashboard first');
      return;
    }
    
    setIsCreating(true);
    
    try {
      const response = await fetch('http://127.0.0.1:54321/functions/v1/app-post-creation-with-opinion', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          user_id: selectedUserId,
          title: postTitle.trim(),
          content: postContent.trim(),
          initial_belief: beliefValue / 100, // Convert percentage to 0-1 range
          meta_prediction: metaBeliefValue / 100, // Convert percentage to 0-1 range
          duration_epochs: 5, // Default duration
          media_urls: []
        })
      });

      const data = await response.json();

      if (response.ok) {
        // Reset form and close panel
        setPostTitle('');
        setPostContent('');
        setBeliefValue(50);
        setMetaBeliefValue(50);
        setShowCreatePanel(false);
      } else {
        alert(`❌ Failed to create post: ${data.error || 'Unknown error'}`);
      }
    } catch (error) {
      alert('❌ Error creating post: ' + error);
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <>
      {/* Mobile menu button */}
      <button
        onClick={() => setShowMobileSidebar(!showMobileSidebar)}
        className="lg:hidden fixed top-4 left-4 z-50 p-2 bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg shadow-lg"
      >
        <Menu className="w-5 h-5" />
      </button>

      {/* Desktop Sidebar - Floating */}
      <aside className="hidden lg:flex flex-col fixed left-6 top-6 bottom-6 w-16 bg-white/95 dark:bg-neutral-800/95 backdrop-blur-ultra border border-neutral-200 dark:border-neutral-700 rounded-2xl shadow-lg dark:shadow-none">
        <div className="flex flex-col items-center p-3 h-full">
          {/* Logo */}
          <Link href="/" className="mb-6 hover:scale-110 transition-transform">
            <img 
              src="/icons/logo.png" 
              alt="Veritas" 
              className="h-10 w-10"
            />
          </Link>

          {/* Action buttons */}
          <div className="flex-1 flex flex-col items-center space-y-3">
            {/* Theme Toggle */}
            {mounted && (
              <button
                onClick={toggleTheme}
                className="p-2.5 text-neutral-600 dark:text-neutral-400 hover:text-black dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-neutral-700 rounded-xl transition-all"
              >
                {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
              </button>
            )}

            {/* Algorithm Selector */}
            <button 
              onClick={(e) => {
                e.stopPropagation();
                setShowAlgorithmPanel(!showAlgorithmPanel);
              }}
              className={`relative p-2.5 rounded-xl transition-all ${
                showAlgorithmPanel 
                  ? 'bg-veritas-light-blue/20 text-veritas-light-blue' 
                  : 'text-neutral-600 dark:text-neutral-400 hover:text-black dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-neutral-700'
              }`}
            >
              <Sliders className="w-5 h-5" />
              {/* Small indicator dot */}
              <span className="absolute top-1 right-1 w-2 h-2 bg-veritas-light-blue rounded-full"></span>
            </button>

            {/* Write button */}
            <button 
              onClick={(e) => {
                e.stopPropagation();
                setShowCreatePanel(!showCreatePanel);
              }}
              className="p-2.5 bg-veritas-light-blue rounded-full hover:bg-veritas-light-blue/90 transition-all"
            >
              <Edit className="w-5 h-5 text-veritas-dark-blue" />
            </button>
          </div>

          {/* User Profile at bottom */}
          <button className="mt-auto p-2.5 text-neutral-600 dark:text-neutral-400 hover:text-black dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-neutral-700 rounded-xl transition-all">
            <User className="w-5 h-5" />
          </button>
        </div>
      </aside>

      {/* Algorithm Panel - Floating */}
      {showAlgorithmPanel && (
        <div className="algorithm-panel hidden lg:block fixed left-28 top-20 w-72 bg-white/95 dark:bg-neutral-800/95 backdrop-blur-ultra border border-neutral-200 dark:border-neutral-700 rounded-2xl shadow-xl dark:shadow-none p-5 z-50">
          <h3 className="font-semibold text-lg text-black dark:text-white mb-4">Algorithm Settings</h3>
          
          <div className="space-y-4">
            <div className="p-3 bg-veritas-light-blue/10 border border-veritas-light-blue/30 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <span className="font-medium text-sm text-black dark:text-white">
                  Balanced Discovery
                </span>
                <ChevronRight className="w-4 h-4 text-veritas-light-blue" />
              </div>
              <span className="text-xs text-neutral-500 dark:text-neutral-400">
                4 active signals • Optimized for diverse content
              </span>
            </div>

            <div className="p-3 border border-neutral-200 dark:border-neutral-700 rounded-lg hover:border-veritas-light-blue/30 cursor-pointer transition-all">
              <div className="flex items-center justify-between mb-2">
                <span className="font-medium text-sm text-black dark:text-white">
                  Truth Seeking
                </span>
              </div>
              <span className="text-xs text-neutral-500 dark:text-neutral-400">
                Prioritize factual accuracy
              </span>
            </div>

            <div className="p-3 border border-neutral-200 dark:border-neutral-700 rounded-lg hover:border-veritas-light-blue/30 cursor-pointer transition-all">
              <div className="flex items-center justify-between mb-2">
                <span className="font-medium text-sm text-black dark:text-white">
                  Trending Now
                </span>
              </div>
              <span className="text-xs text-neutral-500 dark:text-neutral-400">
                Focus on viral content
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Create Post Panel - Floating */}
      {showCreatePanel && (
        <div className="create-panel hidden lg:block fixed left-28 top-20 w-96 bg-white/95 dark:bg-neutral-800/95 backdrop-blur-ultra border border-neutral-200 dark:border-neutral-700 rounded-2xl shadow-xl dark:shadow-none p-6 z-50 max-h-[90vh] overflow-y-auto">
          <h3 className="font-semibold text-lg text-black dark:text-white mb-2">Create Opinion Post</h3>
          
          {/* Selected User Indicator */}
          {selectedUserInfo ? (
            <div className="mb-4 p-2 bg-veritas-light-blue/10 border border-veritas-light-blue/30 rounded-lg">
              <p className="text-xs text-neutral-600 dark:text-neutral-400">
                Posting as: <span className="font-medium text-veritas-light-blue">{selectedUserInfo.display_name}</span> (@{selectedUserInfo.username})
              </p>
            </div>
          ) : (
            <div className="mb-4 p-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              <p className="text-xs text-red-600 dark:text-red-400">
                ⚠️ Please select a user in the dashboard first
              </p>
            </div>
          )}
          
          <div className="space-y-4">
            {/* Title */}
            <div>
              <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                Title
              </label>
              <input
                type="text"
                value={postTitle}
                onChange={(e) => setPostTitle(e.target.value)}
                placeholder="What question do you want to ask?"
                className="w-full p-3 border border-neutral-200 dark:border-neutral-700 rounded-lg bg-white dark:bg-neutral-800 text-black dark:text-white focus:outline-none focus:ring-2 focus:ring-veritas-light-blue focus:border-transparent"
              />
            </div>

            {/* Content */}
            <div>
              <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                Content
              </label>
              <textarea
                value={postContent}
                onChange={(e) => setPostContent(e.target.value)}
                placeholder="Provide context and details..."
                rows={3}
                className="w-full p-3 border border-neutral-200 dark:border-neutral-700 rounded-lg bg-white dark:bg-neutral-800 text-black dark:text-white focus:outline-none focus:ring-2 focus:ring-veritas-light-blue focus:border-transparent resize-none"
              />
            </div>

            {/* Your Belief */}
            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
                  Your belief
                </label>
                <span className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
                  {beliefValue}%
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                value={beliefValue}
                onChange={(e) => setBeliefValue(parseInt(e.target.value))}
                className="w-full h-2 bg-neutral-200 dark:bg-neutral-700 rounded-lg appearance-none cursor-pointer"
              />
              <div className="flex justify-between text-xs text-neutral-500 dark:text-neutral-400 mt-2">
                <span>Strongly disagree</span>
                <span>Strongly agree</span>
              </div>
            </div>

            {/* Meta Belief */}
            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
                  Meta prediction
                </label>
                <span className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
                  {metaBeliefValue}%
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                value={metaBeliefValue}
                onChange={(e) => setMetaBeliefValue(parseInt(e.target.value))}
                className="w-full h-2 bg-neutral-200 dark:bg-neutral-700 rounded-lg appearance-none cursor-pointer"
              />
              <div className="flex justify-between text-xs text-neutral-500 dark:text-neutral-400 mt-2">
                <span>Others will disagree</span>
                <span>Others will agree</span>
              </div>
              <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
                What % of people do you think will agree with your belief?
              </p>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3 pt-2">
              <button
                onClick={() => {
                  setShowCreatePanel(false);
                  setPostTitle('');
                  setPostContent('');
                  setBeliefValue(50);
                  setMetaBeliefValue(50);
                }}
                className="flex-1 px-4 py-2 border border-neutral-200 dark:border-neutral-700 rounded-lg text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-700 transition-colors"
                disabled={isCreating}
              >
                Cancel
              </button>
              <button
                onClick={createOpinionPost}
                disabled={isCreating || !postTitle.trim() || !selectedUserInfo}
                className="flex-1 px-4 py-2 bg-veritas-light-blue text-veritas-dark-blue rounded-lg font-medium hover:bg-veritas-light-blue/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isCreating ? 'Creating...' : 'Create Post'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Mobile Sidebar */}
      <div className={`lg:hidden fixed inset-0 z-40 transition-opacity ${showMobileSidebar ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
        <div className="absolute inset-0 bg-black/50" onClick={() => setShowMobileSidebar(false)} />
        <aside className={`absolute left-4 top-4 bottom-4 w-20 bg-white/95 dark:bg-neutral-800/95 backdrop-blur-ultra border border-neutral-200 dark:border-neutral-700 rounded-2xl shadow-xl transition-transform ${showMobileSidebar ? 'translate-x-0' : '-translate-x-[calc(100%+1rem)]'}`}>
          <div className="flex flex-col items-center p-3 h-full">
            {/* Close button */}
            <button onClick={() => setShowMobileSidebar(false)} className="mb-4 p-2 hover:bg-neutral-100 dark:hover:bg-neutral-700 rounded-lg transition-all">
              <X className="w-5 h-5" />
            </button>
            
            {/* Logo */}
            <Link href="/" className="mb-6" onClick={() => setShowMobileSidebar(false)}>
              <img 
                src="/icons/logo.png" 
                alt="Veritas" 
                className="h-10 w-10"
              />
            </Link>

            {/* Action buttons */}
            <div className="flex-1 flex flex-col items-center space-y-3">
              {/* Theme Toggle */}
              {mounted && (
                <button
                  onClick={toggleTheme}
                  className="p-2.5 text-neutral-600 dark:text-neutral-400 hover:text-black dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-neutral-700 rounded-xl transition-all"
                >
                  {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
                </button>
              )}

              {/* Algorithm Selector */}
              <button className="relative p-2.5 text-neutral-600 dark:text-neutral-400 hover:text-black dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-neutral-700 rounded-xl transition-all" onClick={() => setShowMobileSidebar(false)}>
                <Sliders className="w-5 h-5" />
                <span className="absolute top-1 right-1 w-2 h-2 bg-veritas-light-blue rounded-full"></span>
              </button>

              {/* Write button */}
              <button className="p-2.5 bg-veritas-light-blue rounded-full hover:bg-veritas-light-blue/90 transition-all" onClick={() => setShowMobileSidebar(false)}>
                <Edit className="w-5 h-5 text-veritas-dark-blue" />
              </button>
            </div>

            {/* User Profile at bottom */}
            <button className="mt-auto p-2.5 text-neutral-600 dark:text-neutral-400 hover:text-black dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-neutral-700 rounded-xl transition-all">
              <User className="w-5 h-5" />
            </button>
          </div>
        </aside>
      </div>
    </>
  );
}