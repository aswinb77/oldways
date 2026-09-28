-- ==============================================================================
-- Reset all player stats & clear inflated records on Supabase Database
-- ==============================================================================

-- 1. Reset all profiles to 0 points, 0 wins, 0 losses, 0 streak, Novice badge
UPDATE profiles
SET points = 0,
    wins = 0,
    losses = 0,
    streak = 0,
    badge = 'Novice',
    updated_at = NOW();

-- 2. Clear any past match claims
TRUNCATE TABLE match_claims;
