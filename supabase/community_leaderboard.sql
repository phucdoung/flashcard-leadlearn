-- ====================================================================
-- LEAFLEARN COMMUNITY LEADERBOARD AGGREGATION FUNCTION (RPC)
-- ====================================================================
-- This SECURITY DEFINER function aggregates public learning statistics
-- for all registered users across flashcard_sets, flashcards, and quiz_results.
-- It bypasses row-level restrictions securely on the server-side to return
-- aggregated metrics (learned words, completed quizzes, average score, learning score)
-- without exposing private flashcards or private quiz responses to client JS.

CREATE OR REPLACE FUNCTION public.get_community_leaderboard()
RETURNS TABLE (
  id UUID,
  full_name TEXT,
  avatar_url TEXT,
  public_sets_count BIGINT,
  mastered_cards BIGINT,
  quiz_count BIGINT,
  avg_score_pct INT,
  learning_score INT
) AS $$
BEGIN
  RETURN QUERY
  WITH user_mastered AS (
    SELECT
      fs.user_id,
      COUNT(fc.id) AS total_mastered
    FROM public.flashcard_sets fs
    JOIN public.flashcards fc ON fc.set_id = fs.id
    WHERE fc.learning_status IN ('learned', 'mastered')
    GROUP BY fs.user_id
  ),
  user_quizzes AS (
    SELECT
      qr.user_id,
      COUNT(qr.id) AS total_quizzes,
      AVG(
        CASE
          WHEN qr.total_questions > 0 THEN (qr.score::FLOAT / qr.total_questions::FLOAT) * 100.0
          ELSE 0.0
        END
      ) AS avg_pct
    FROM public.quiz_results qr
    GROUP BY qr.user_id
  ),
  user_public_sets AS (
    SELECT
      fs.user_id,
      COUNT(fs.id) AS total_public_sets
    FROM public.flashcard_sets fs
    WHERE fs.visibility = 'public'
    GROUP BY fs.user_id
  )
  SELECT
    p.id,
    COALESCE(
      NULLIF(trim(p.full_name), ''),
      split_part(u.email, '@', 1),
      'Người học LeafLearn'
    ) AS full_name,
    p.avatar_url,
    COALESCE(ups.total_public_sets, 0) AS public_sets_count,
    COALESCE(um.total_mastered, 0) AS mastered_cards,
    COALESCE(uq.total_quizzes, 0) AS quiz_count,
    COALESCE(ROUND(uq.avg_pct)::INT, 0) AS avg_score_pct,
    ROUND(
      (COALESCE(um.total_mastered, 0) * 1.0) +
      (COALESCE(uq.total_quizzes, 0) * 5.0) +
      (COALESCE(uq.avg_pct, 0.0) * 0.5)
    )::INT AS learning_score
  FROM public.profiles p
  JOIN auth.users u ON u.id = p.id
  LEFT JOIN user_mastered um ON um.user_id = p.id
  LEFT JOIN user_quizzes uq ON uq.user_id = p.id
  LEFT JOIN user_public_sets ups ON ups.user_id = p.id
  ORDER BY
    learning_score DESC,
    mastered_cards DESC,
    quiz_count DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Grant execution permission to authenticated users
GRANT EXECUTE ON FUNCTION public.get_community_leaderboard() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_community_leaderboard() TO anon;
