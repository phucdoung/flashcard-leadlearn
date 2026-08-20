import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    console.log('[delete-account] Incoming account deletion request');

    // 1. Read Authorization header
    const authHeader = req.headers.get('Authorization') || req.headers.get('authorization')
    if (!authHeader) {
      console.error('[delete-account] Error: Missing Authorization header');
      return new Response(
        JSON.stringify({ error: 'Missing Authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

    if (!supabaseUrl || !supabaseServiceRoleKey) {
      console.error('[delete-account] Error: Server environment variables missing');
      return new Response(
        JSON.stringify({ error: 'Supabase server environment variables missing' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 2. Extract raw JWT token string
    const jwtToken = authHeader.replace(/^Bearer\s+/i, '').trim()

    // 3. Authenticate user JWT explicitly
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    })

    const { data: { user }, error: userError } = await userClient.auth.getUser(jwtToken)

    if (userError || !user) {
      console.error('[delete-account] Error: Failed to authenticate user JWT token:', userError?.message || userError);
      return new Response(
        JSON.stringify({ error: 'Unauthorized user token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const userId = user.id
    console.log(`[delete-account] authenticated: ${userId}`);

    // 4. Create Admin Client using Service Role Key for hard delete & data cleanup
    const adminClient = createClient(supabaseUrl, supabaseServiceRoleKey)

    // Step A: Storage Cleanup
    console.log('[delete-account] cleaning storage');
    try {
      // List and delete avatar objects in 'avatars' bucket under `${userId}` directory
      const { data: files, error: listErr } = await adminClient.storage.from('avatars').list(userId)
      if (listErr) {
        console.error('[delete-account] storage list warning:', listErr.message || listErr)
      } else if (files && files.length > 0) {
        const paths = files.map((f) => `${userId}/${f.name}`)
        const { error: removeErr } = await adminClient.storage.from('avatars').remove(paths)
        if (removeErr) {
          console.error('[delete-account] storage remove warning:', removeErr.message || removeErr)
        } else {
          console.log(`[delete-account] removed ${paths.length} avatar storage files`);
        }
      }
    } catch (storageErr) {
      console.error('[delete-account] storage cleanup exception:', storageErr)
    }

    // Step B: Database Cleanup for tables with Foreign Keys referencing auth.users(id)
    console.log('[delete-account] cleaning database');
    try {
      // 1. Delete messages sent by user
      const { error: msgErr } = await adminClient.from('messages').delete().eq('sender_id', userId)
      if (msgErr) console.error('[delete-account] messages cleanup warning:', msgErr.message || msgErr);

      // 2. Delete conversation memberships of user
      const { error: cmErr } = await adminClient.from('conversation_members').delete().eq('user_id', userId)
      if (cmErr) console.error('[delete-account] conversation_members cleanup warning:', cmErr.message || cmErr);

      // 3. Delete quiz results of user
      const { error: resErr } = await adminClient.from('quiz_results').delete().eq('user_id', userId)
      if (resErr) console.error('[delete-account] quiz_results cleanup warning:', resErr.message || resErr);

      // 4. Delete quizzes created by user
      const { error: quizErr } = await adminClient.from('quizzes').delete().eq('user_id', userId)
      if (quizErr) console.error('[delete-account] quizzes cleanup warning:', quizErr.message || quizErr);

      // 5. Find and delete user flashcard sets & cards
      const { data: userSets, error: setsFetchErr } = await adminClient.from('flashcard_sets').select('id').eq('user_id', userId)
      if (setsFetchErr) {
        console.error('[delete-account] flashcard_sets fetch warning:', setsFetchErr.message || setsFetchErr);
      } else if (userSets && userSets.length > 0) {
        const setIds = userSets.map((s) => s.id)
        const { error: cardsErr } = await adminClient.from('flashcards').delete().in('set_id', setIds)
        if (cardsErr) console.error('[delete-account] flashcards cleanup warning:', cardsErr.message || cardsErr);

        const { error: setDeleteErr } = await adminClient.from('flashcard_sets').delete().eq('user_id', userId)
        if (setDeleteErr) console.error('[delete-account] flashcard_sets cleanup warning:', setDeleteErr.message || setDeleteErr);
      }

      // 6. Delete user profile record
      const { error: profileErr } = await adminClient.from('profiles').delete().eq('id', userId)
      if (profileErr) console.error('[delete-account] profiles cleanup warning:', profileErr.message || profileErr);

    } catch (dbErr) {
      console.error('[delete-account] database cleanup exception:', dbErr)
    }

    // Step C: Delete Auth User via Admin API (Hard Delete)
    console.log('[delete-account] deleting auth user');
    const { error: deleteUserError } = await adminClient.auth.admin.deleteUser(userId, false)

    if (deleteUserError) {
      console.error('[delete-account] failed deleting auth user:', deleteUserError.message || deleteUserError)
      return new Response(
        JSON.stringify({ error: `Failed deleting auth user: ${deleteUserError.message || deleteUserError}` }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('[delete-account] auth user deleted successfully');
    console.log('[delete-account] success');

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    console.error('[delete-account] internal exception:', err)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
