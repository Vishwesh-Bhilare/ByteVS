// supabase/functions/create-room/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS
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

    // Get user from auth
    const {
      data: { user },
    } = await supabaseClient.auth.getUser();

    if (!user) {
      throw new Error('Not authenticated');
    }

    const { mode = 'quickplay', time_limit = 900, difficulty = 'easy' } = await req.json();

    // Generate unique room code
    const roomCode = generateRoomCode();

    // Create room
    const { data: room, error: roomError } = await supabaseClient
      .from('rooms')
      .insert({
        room_code: roomCode,
        created_by: user.id,
        player1_id: user.id,
        mode,
        time_limit,
        difficulty,
        status: 'waiting',
      })
      .select()
      .single();

    if (roomError) throw roomError;

    // If quickplay, try to match immediately
    if (mode === 'quickplay') {
      const { data: waitingRoom } = await supabaseClient
        .from('rooms')
        .select('id, room_code')
        .eq('status', 'waiting')
        .eq('mode', 'quickplay')
        .eq('difficulty', difficulty)
        .neq('created_by', user.id)
        .limit(1)
        .single();

      if (waitingRoom) {
        // Join the waiting room instead
        const { data: updatedRoom } = await supabaseClient
          .from('rooms')
          .update({
            player2_id: user.id,
            status: 'locked',
            locked_at: new Date().toISOString(),
          })
          .eq('id', waitingRoom.id)
          .select()
          .single();

        return new Response(
          JSON.stringify({
            room: updatedRoom,
            joined_existing: true,
          }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
          }
        );
      }
    }

    return new Response(
      JSON.stringify({
        room,
        joined_existing: false,
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

function generateRoomCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}