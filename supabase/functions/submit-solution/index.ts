// supabase/functions/submit-solution/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    const {
      data: { user },
    } = await supabaseClient.auth.getUser();

    if (!user) {
      throw new Error('Not authenticated');
    }

    const { match_id, code, language } = await req.json();

    // Verify match exists and is active
    const { data: match, error: matchError } = await supabaseClient
      .from('matches')
      .select(`
        *,
        rooms!inner (
          started_at,
          time_limit,
          status
        )
      `)
      .eq('id', match_id)
      .single();

    if (matchError || !match) {
      throw new Error('Match not found');
    }

    if (![match.player1_id, match.player2_id].includes(user.id)) {
      throw new Error('Not authorized to submit for this match');
    }

    // Check if match time has expired
    const matchStart = new Date(match.rooms.started_at);
    const timeLimit = match.rooms.time_limit * 1000; // Convert to milliseconds
    const now = new Date();
    const elapsed = now.getTime() - matchStart.getTime();
    const isLate = elapsed > timeLimit;

    // Count previous submissions for penalty
    const { count: previousSubmissions } = await supabaseClient
      .from('submissions')
      .select('id', { count: 'exact', head: true })
      .eq('match_id', match_id)
      .eq('user_id', user.id);

    const penalty = (previousSubmissions || 0) * 2;

    // Create initial submission record
    const { data: submission, error: subError } = await supabaseClient
      .from('submissions')
      .insert({
        match_id,
        user_id: user.id,
        problem_id: match.problem_id,
        code,
        language,
        penalty_points: penalty,
        is_late: isLate,
        submitted_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (subError) throw subError;

    // Call judge function asynchronously
    const judgeResponse = await fetch(
      `${Deno.env.get('SUPABASE_URL')}/functions/v1/judge-execution`,
      {
        method: 'POST',
        headers: {
          'Authorization': req.headers.get('Authorization')!,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          submission_id: submission.id,
          match_id,
          user_id: user.id,
          code,
          language,
          problem_id: match.problem_id,
        }),
      }
    );

    if (!judgeResponse.ok) {
      console.error('Judge execution failed:', await judgeResponse.text());
    }

    return new Response(
      JSON.stringify({
        submission_id: submission.id,
        is_late: isLate,
        penalty,
        message: 'Submission received and being evaluated',
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }
});