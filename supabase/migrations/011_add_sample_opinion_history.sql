-- Add sample historical data for existing opinion posts
-- This simulates data collection every 3 hours over the past few days

-- First, let's get the opinion post IDs
DO $$
DECLARE
    ai_post_id UUID;
    remote_work_post_id UUID;
    social_media_post_id UUID;
BEGIN
    -- Get the post IDs
    SELECT id INTO ai_post_id FROM posts WHERE headline LIKE '%Should AI companies be required to disclose%' AND type = 'opinion';
    SELECT id INTO remote_work_post_id FROM posts WHERE headline LIKE '%Will remote work become%' AND type = 'opinion';
    SELECT id INTO social_media_post_id FROM posts WHERE headline LIKE '%Should social media platforms fact-check%' AND type = 'opinion';

    -- Sample historical data for "AI training data disclosure" (trending upward from 65% to 73%)
    IF ai_post_id IS NOT NULL THEN
        INSERT INTO opinion_history (post_id, yes_percentage, recorded_at) VALUES
        (ai_post_id, 65, NOW() - INTERVAL '3 days'),
        (ai_post_id, 66, NOW() - INTERVAL '3 days' + INTERVAL '3 hours'),
        (ai_post_id, 67, NOW() - INTERVAL '3 days' + INTERVAL '6 hours'),
        (ai_post_id, 68, NOW() - INTERVAL '3 days' + INTERVAL '9 hours'),
        (ai_post_id, 67, NOW() - INTERVAL '3 days' + INTERVAL '12 hours'),
        (ai_post_id, 69, NOW() - INTERVAL '3 days' + INTERVAL '15 hours'),
        (ai_post_id, 70, NOW() - INTERVAL '3 days' + INTERVAL '18 hours'),
        (ai_post_id, 71, NOW() - INTERVAL '3 days' + INTERVAL '21 hours'),
        (ai_post_id, 70, NOW() - INTERVAL '2 days'),
        (ai_post_id, 72, NOW() - INTERVAL '2 days' + INTERVAL '3 hours'),
        (ai_post_id, 73, NOW() - INTERVAL '2 days' + INTERVAL '6 hours'),
        (ai_post_id, 72, NOW() - INTERVAL '2 days' + INTERVAL '9 hours'),
        (ai_post_id, 74, NOW() - INTERVAL '2 days' + INTERVAL '12 hours'),
        (ai_post_id, 73, NOW() - INTERVAL '2 days' + INTERVAL '15 hours'),
        (ai_post_id, 75, NOW() - INTERVAL '2 days' + INTERVAL '18 hours'),
        (ai_post_id, 74, NOW() - INTERVAL '2 days' + INTERVAL '21 hours'),
        (ai_post_id, 73, NOW() - INTERVAL '1 day'),
        (ai_post_id, 74, NOW() - INTERVAL '1 day' + INTERVAL '3 hours'),
        (ai_post_id, 73, NOW() - INTERVAL '1 day' + INTERVAL '6 hours'),
        (ai_post_id, 75, NOW() - INTERVAL '1 day' + INTERVAL '9 hours'),
        (ai_post_id, 74, NOW() - INTERVAL '1 day' + INTERVAL '12 hours'),
        (ai_post_id, 73, NOW() - INTERVAL '1 day' + INTERVAL '15 hours'),
        (ai_post_id, 72, NOW() - INTERVAL '1 day' + INTERVAL '18 hours'),
        (ai_post_id, 73, NOW() - INTERVAL '1 day' + INTERVAL '21 hours'),
        (ai_post_id, 73, NOW() - INTERVAL '12 hours'),
        (ai_post_id, 72, NOW() - INTERVAL '9 hours'),
        (ai_post_id, 73, NOW() - INTERVAL '6 hours'),
        (ai_post_id, 73, NOW() - INTERVAL '3 hours'),
        (ai_post_id, 73, NOW());
    END IF;

    -- Sample historical data for "Remote work dominance" (slightly declining from 68% to 64%)
    IF remote_work_post_id IS NOT NULL THEN
        INSERT INTO opinion_history (post_id, yes_percentage, recorded_at) VALUES
        (remote_work_post_id, 68, NOW() - INTERVAL '3 days'),
        (remote_work_post_id, 67, NOW() - INTERVAL '3 days' + INTERVAL '3 hours'),
        (remote_work_post_id, 68, NOW() - INTERVAL '3 days' + INTERVAL '6 hours'),
        (remote_work_post_id, 67, NOW() - INTERVAL '3 days' + INTERVAL '9 hours'),
        (remote_work_post_id, 66, NOW() - INTERVAL '3 days' + INTERVAL '12 hours'),
        (remote_work_post_id, 67, NOW() - INTERVAL '3 days' + INTERVAL '15 hours'),
        (remote_work_post_id, 66, NOW() - INTERVAL '3 days' + INTERVAL '18 hours'),
        (remote_work_post_id, 65, NOW() - INTERVAL '3 days' + INTERVAL '21 hours'),
        (remote_work_post_id, 66, NOW() - INTERVAL '2 days'),
        (remote_work_post_id, 65, NOW() - INTERVAL '2 days' + INTERVAL '3 hours'),
        (remote_work_post_id, 64, NOW() - INTERVAL '2 days' + INTERVAL '6 hours'),
        (remote_work_post_id, 65, NOW() - INTERVAL '2 days' + INTERVAL '9 hours'),
        (remote_work_post_id, 64, NOW() - INTERVAL '2 days' + INTERVAL '12 hours'),
        (remote_work_post_id, 63, NOW() - INTERVAL '2 days' + INTERVAL '15 hours'),
        (remote_work_post_id, 64, NOW() - INTERVAL '2 days' + INTERVAL '18 hours'),
        (remote_work_post_id, 63, NOW() - INTERVAL '2 days' + INTERVAL '21 hours'),
        (remote_work_post_id, 64, NOW() - INTERVAL '1 day'),
        (remote_work_post_id, 63, NOW() - INTERVAL '1 day' + INTERVAL '3 hours'),
        (remote_work_post_id, 64, NOW() - INTERVAL '1 day' + INTERVAL '6 hours'),
        (remote_work_post_id, 63, NOW() - INTERVAL '1 day' + INTERVAL '9 hours'),
        (remote_work_post_id, 64, NOW() - INTERVAL '1 day' + INTERVAL '12 hours'),
        (remote_work_post_id, 65, NOW() - INTERVAL '1 day' + INTERVAL '15 hours'),
        (remote_work_post_id, 64, NOW() - INTERVAL '1 day' + INTERVAL '18 hours'),
        (remote_work_post_id, 63, NOW() - INTERVAL '1 day' + INTERVAL '21 hours'),
        (remote_work_post_id, 64, NOW() - INTERVAL '12 hours'),
        (remote_work_post_id, 65, NOW() - INTERVAL '9 hours'),
        (remote_work_post_id, 64, NOW() - INTERVAL '6 hours'),
        (remote_work_post_id, 63, NOW() - INTERVAL '3 hours'),
        (remote_work_post_id, 64, NOW());
    END IF;

    -- Sample historical data for "Social media fact-checking" (volatile, trending slightly down from 45% to 42%)
    IF social_media_post_id IS NOT NULL THEN
        INSERT INTO opinion_history (post_id, yes_percentage, recorded_at) VALUES
        (social_media_post_id, 45, NOW() - INTERVAL '3 days'),
        (social_media_post_id, 47, NOW() - INTERVAL '3 days' + INTERVAL '3 hours'),
        (social_media_post_id, 44, NOW() - INTERVAL '3 days' + INTERVAL '6 hours'),
        (social_media_post_id, 46, NOW() - INTERVAL '3 days' + INTERVAL '9 hours'),
        (social_media_post_id, 43, NOW() - INTERVAL '3 days' + INTERVAL '12 hours'),
        (social_media_post_id, 45, NOW() - INTERVAL '3 days' + INTERVAL '15 hours'),
        (social_media_post_id, 42, NOW() - INTERVAL '3 days' + INTERVAL '18 hours'),
        (social_media_post_id, 44, NOW() - INTERVAL '3 days' + INTERVAL '21 hours'),
        (social_media_post_id, 46, NOW() - INTERVAL '2 days'),
        (social_media_post_id, 43, NOW() - INTERVAL '2 days' + INTERVAL '3 hours'),
        (social_media_post_id, 45, NOW() - INTERVAL '2 days' + INTERVAL '6 hours'),
        (social_media_post_id, 42, NOW() - INTERVAL '2 days' + INTERVAL '9 hours'),
        (social_media_post_id, 44, NOW() - INTERVAL '2 days' + INTERVAL '12 hours'),
        (social_media_post_id, 41, NOW() - INTERVAL '2 days' + INTERVAL '15 hours'),
        (social_media_post_id, 43, NOW() - INTERVAL '2 days' + INTERVAL '18 hours'),
        (social_media_post_id, 45, NOW() - INTERVAL '2 days' + INTERVAL '21 hours'),
        (social_media_post_id, 42, NOW() - INTERVAL '1 day'),
        (social_media_post_id, 44, NOW() - INTERVAL '1 day' + INTERVAL '3 hours'),
        (social_media_post_id, 41, NOW() - INTERVAL '1 day' + INTERVAL '6 hours'),
        (social_media_post_id, 43, NOW() - INTERVAL '1 day' + INTERVAL '9 hours'),
        (social_media_post_id, 40, NOW() - INTERVAL '1 day' + INTERVAL '12 hours'),
        (social_media_post_id, 42, NOW() - INTERVAL '1 day' + INTERVAL '15 hours'),
        (social_media_post_id, 44, NOW() - INTERVAL '1 day' + INTERVAL '18 hours'),
        (social_media_post_id, 41, NOW() - INTERVAL '1 day' + INTERVAL '21 hours'),
        (social_media_post_id, 43, NOW() - INTERVAL '12 hours'),
        (social_media_post_id, 42, NOW() - INTERVAL '9 hours'),
        (social_media_post_id, 41, NOW() - INTERVAL '6 hours'),
        (social_media_post_id, 42, NOW() - INTERVAL '3 hours'),
        (social_media_post_id, 42, NOW());
    END IF;
END $$;