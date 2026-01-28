// supabase/functions/start-match/index.ts
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

    const { room_id } = await req.json();

    // Verify room exists and user is in it
    const { data: room, error: roomError } = await supabaseClient
      .from('rooms')
      .select('*')
      .eq('id', room_id)
      .in('status', ['locked', 'waiting'])
      .single();

    if (roomError || !room) {
      throw new Error('Room not found or already started');
    }

    if (![room.player1_id, room.player2_id].includes(user.id)) {
      throw new Error('Not authorized to start this match');
    }

    if (room.status === 'waiting' && room.player2_id) {
      // Auto-lock if second player joined
      await supabaseClient
        .from('rooms')
        .update({
          status: 'locked',
          locked_at: new Date().toISOString(),
        })
        .eq('id', room_id);
    }

    // Select random problem based on difficulty
    const { data: problems, error: probError } = await supabaseClient
      .from('problems')
      .select('id')
      .eq('difficulty', room.difficulty)
      .eq('is_active', true);

    if (probError || !problems || problems.length === 0) {
      throw new Error('No problems available');
    }

    const randomProblem = problems[Math.floor(Math.random() * problems.length)];

    // Get problem details
    const { data: problem, error: problemError } = await supabaseClient
      .from('problems')
      .select('*')
      .eq('id', randomProblem.id)
      .single();

    if (problemError) throw problemError;

    // Create match record
    const { data: match, error: matchError } = await supabaseClient
      .from('matches')
      .insert({
        room_id: room.id,
        problem_id: problem.id,
        player1_id: room.player1_id!,
        player2_id: room.player2_id!,
        started_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (matchError) throw matchError;

    // Create match player records
    await supabaseClient.from('match_players').insert([
      {
        match_id: match.id,
        user_id: room.player1_id!,
        role: 'player1',
      },
      {
        match_id: match.id,
        user_id: room.player2_id!,
        role: 'player2',
      },
    ]);

    // Update room status
    const { data: updatedRoom } = await supabaseClient
      .from('rooms')
      .update({
        status: 'active',
        started_at: new Date().toISOString(),
      })
      .eq('id', room_id)
      .select()
      .single();

    // Remove problem solution from response
    const { editorial_solution, ...problemWithoutSolution } = problem;

    return new Response(
      JSON.stringify({
        match,
        room: updatedRoom,
        problem: problemWithoutSolution,
        start_time: new Date().toISOString(),
        time_limit: room.time_limit,
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