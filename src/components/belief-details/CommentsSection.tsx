'use client';

import { Belief } from '@/types/belief.types';
import { getCommentsByBeliefId, formatCommentTime, getSentimentColor, getSentimentIcon } from '@/lib/comments';
import { MessageCircle, ThumbsUp, Award, User } from 'lucide-react';

interface CommentsSectionProps {
  belief: Belief;
}

export const CommentsSection: React.FC<CommentsSectionProps> = ({ belief }) => {
  const comments = getCommentsByBeliefId(belief.id);

  if (comments.length === 0) {
    return (
      <div className="backdrop-blur-xl bg-white dark:bg-veritas-darker-blue/80 border border-slate-200 dark:border-veritas-eggshell/10 rounded-3xl p-6 md:p-8 shadow-2xl shadow-yellow-500/10">
        <div className="flex items-center space-x-3 mb-6">
          <div className="p-3 rounded-2xl bg-gradient-to-br from-[#FFB800]/20 to-[#1B365D]/10">
            <MessageCircle className="w-6 h-6 text-[#FFB800]" />
          </div>
          <div>
            <h3 className="text-xl font-bold text-veritas-primary dark:text-veritas-eggshell">
              Community Discussion
            </h3>
            <p className="text-sm text-veritas-primary/70 dark:text-veritas-eggshell/70">
              No comments yet - be the first to share your insight
            </p>
          </div>
        </div>
        
        <div className="text-center py-8">
          <div className="w-16 h-16 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto mb-4">
            <MessageCircle className="w-8 h-8 text-slate-400" />
          </div>
          <p className="text-veritas-primary/60 dark:text-veritas-eggshell/60">
            Share your analysis to help the community reach consensus
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="backdrop-blur-xl bg-white/10 dark:bg-white/5 border border-white/20 dark:border-white/10 rounded-3xl p-6 md:p-8 shadow-2xl shadow-yellow-500/10">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-3">
          <div className="p-3 rounded-2xl bg-gradient-to-br from-[#FFB800]/20 to-[#1B365D]/10">
            <MessageCircle className="w-6 h-6 text-[#FFB800]" />
          </div>
          <div>
            <h3 className="text-xl font-bold text-veritas-primary dark:text-veritas-eggshell">
              Community Discussion
            </h3>
            <p className="text-sm text-veritas-primary/70 dark:text-veritas-eggshell/70">
              {comments.length} {comments.length === 1 ? 'comment' : 'comments'} from the community
            </p>
          </div>
        </div>
        
        <div className="text-sm text-veritas-primary/60 dark:text-veritas-eggshell/60">
          {comments.filter(c => c.isExpert).length} expert{comments.filter(c => c.isExpert).length !== 1 ? 's' : ''}
        </div>
      </div>

      {/* Comments */}
      <div className="space-y-4">
        {comments.map((comment) => (
          <div
            key={comment.id}
            className="p-5 bg-slate-50 dark:bg-veritas-darker-blue/60 rounded-2xl hover:bg-slate-100 dark:hover:bg-veritas-eggshell/5 transition-all duration-300 hover:scale-[1.01]"
          >
            {/* Comment header */}
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#FFB800]/20 to-[#1B365D]/10 flex items-center justify-center">
                  {comment.isExpert ? (
                    <Award className="w-5 h-5 text-[#FFB800]" />
                  ) : (
                    <User className="w-5 h-5 text-veritas-primary/60 dark:text-veritas-eggshell/60" />
                  )}
                </div>
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="font-medium text-veritas-primary dark:text-veritas-eggshell">
                      {comment.author}
                    </span>
                    {comment.isExpert && (
                      <span className="px-2 py-1 text-xs font-medium rounded-full bg-[#FFB800]/20 text-[#FFB800] border border-[#FFB800]/30">
                        Expert
                      </span>
                    )}
                  </div>
                  <div className="flex items-center space-x-2 text-xs text-veritas-primary/60 dark:text-veritas-eggshell/60">
                    <span>{formatCommentTime(comment.timestamp)}</span>
                    <span>•</span>
                    <span className={`flex items-center space-x-1 ${getSentimentColor(comment.sentiment)}`}>
                      <span>{getSentimentIcon(comment.sentiment)}</span>
                      <span className="capitalize">{comment.sentiment}</span>
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Comment content */}
            <p className="text-veritas-primary/80 dark:text-veritas-eggshell/80 leading-relaxed mb-4">
              {comment.content}
            </p>

            {/* Comment footer */}
            <div className="flex items-center justify-between">
              <button className="flex items-center space-x-2 text-sm text-veritas-primary/60 dark:text-veritas-eggshell/60 hover:text-veritas-primary dark:hover:text-veritas-eggshell transition-colors">
                <ThumbsUp className="w-4 h-4" />
                <span>{comment.likes}</span>
              </button>
              
              <button className="text-sm text-veritas-primary/60 dark:text-veritas-eggshell/60 hover:text-[#FFB800] transition-colors">
                Reply
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Add comment section */}
      <div className="mt-6 p-4 bg-gradient-to-r from-slate-50 to-slate-100 dark:from-veritas-darker-blue/60 dark:to-veritas-darker-blue/80 rounded-2xl">
        <div className="text-center">
          <p className="text-sm text-veritas-primary/70 dark:text-veritas-eggshell/70 mb-3">
            Share your analysis to contribute to the collective intelligence
          </p>
          <button className="px-6 py-2 bg-gradient-to-r from-[#FFB800] to-[#F5A623] text-[#1B365D] font-medium rounded-xl hover:shadow-lg hover:scale-105 transition-all duration-300">
            Add Comment
          </button>
        </div>
      </div>
    </div>
  );
}; 