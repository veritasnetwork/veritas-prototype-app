-- Remove the opinion_question and opinion_total_votes columns
ALTER TABLE posts DROP COLUMN IF EXISTS opinion_total_votes;
ALTER TABLE posts DROP COLUMN IF EXISTS opinion_question;

-- Update the existing opinion posts to remove redundant question content
-- and make the headlines the actual questions

UPDATE posts SET 
  headline = 'Should AI companies be required to disclose their training data?',
  content = 'As AI models become more powerful and integrated into society, there is growing debate about transparency in AI development. This question explores whether mandatory disclosure would help identify biases and ensure ethical development.'
WHERE type = 'opinion' AND headline LIKE '%Should AI companies be required to disclose%';

UPDATE posts SET 
  headline = 'Will remote work become the dominant employment model by 2030?',
  content = 'The pandemic accelerated remote work adoption globally. As companies navigate between return-to-office policies and employee preferences for flexibility, this question examines the future landscape of work arrangements.'
WHERE type = 'opinion' AND headline LIKE '%Will remote work become%';

UPDATE posts SET 
  headline = 'Should social media platforms fact-check political content?',
  content = 'Social media companies face increasing pressure to moderate political content and misinformation. This question weighs the balance between preventing harmful falsehoods and preserving free speech principles.'
WHERE type = 'opinion' AND headline LIKE '%Should social media platforms fact-check%';