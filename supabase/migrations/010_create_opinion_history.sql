-- Create opinion_history table to track yes/no percentage over time
CREATE TABLE opinion_history (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  yes_percentage INTEGER NOT NULL CHECK (yes_percentage >= 0 AND yes_percentage <= 100),
  recorded_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Create index for efficient querying by post_id and time
CREATE INDEX idx_opinion_history_post_time ON opinion_history(post_id, recorded_at DESC);

-- Create index for cleanup queries
CREATE INDEX idx_opinion_history_recorded_at ON opinion_history(recorded_at);

-- Enable Row Level Security
ALTER TABLE opinion_history ENABLE ROW LEVEL SECURITY;

-- Create policy for reading opinion history (public read access)
CREATE POLICY "Opinion history is publicly readable" ON opinion_history
  FOR SELECT USING (true);

-- Create policy for inserting opinion history (authenticated users only)
CREATE POLICY "Authenticated users can insert opinion history" ON opinion_history
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');