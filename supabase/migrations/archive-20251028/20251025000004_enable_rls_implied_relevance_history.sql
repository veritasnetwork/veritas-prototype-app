-- Enable RLS on implied_relevance_history table
ALTER TABLE public.implied_relevance_history ENABLE ROW LEVEL SECURITY;

-- Create policy to allow anyone to read implied relevance history
CREATE POLICY "Allow public read access to implied_relevance_history"
ON public.implied_relevance_history
FOR SELECT
USING (true);

-- Create policy to allow service role to insert/update
CREATE POLICY "Allow service role write access to implied_relevance_history"
ON public.implied_relevance_history
FOR ALL
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');