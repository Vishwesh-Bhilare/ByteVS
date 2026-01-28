// supabase/functions/judge-execution/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const JUDGE0_API_KEY = Deno.env.get('JUDGE0_API_KEY') || '';
const JUDGE0_URL = 'https://judge0-ce.p.rapidapi.com';

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
      submission_id,
      match_id,
      user_id,
      code,
      language,
      problem_id,
    } = await req.json();

    // Get problem test cases
    const { data: testCases, error: testError } = await supabaseClient
      .from('test_cases')
      .select('*')
      .eq('problem_id', problem_id)
      .order('order_index');

    if (testError) throw testError;

    if (!testCases || testCases.length === 0) {
      throw new Error('No test cases found');
    }

    // Get problem details for limits
    const { data: problem, error: probError } = await supabaseClient
      .from('problems')
      .select('time_limit, memory_limit')
      .eq('id', problem_id)
      .single();

    if (probError) throw probError;

    // Prepare submissions for Judge0
    const submissions = testCases.map((testCase, index) => ({
      source_code: code,
      language_id: language === 'python' ? 71 : 54, // 71: Python, 54: C++
      stdin: testCase.input,
      expected_output: testCase.expected_output,
      cpu_time_limit: problem.time_limit,
      memory_limit: problem.memory_limit * 1024, // Convert MB to KB
    }));

    // Submit to Judge0
    const judge0Response = await fetch(`${JUDGE0_URL}/submissions/batch`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-RapidAPI-Key': JUDGE0_API_KEY,
        'X-RapidAPI-Host': 'judge0-ce.p.rapidapi.com',
      },
      body: JSON.stringify({
        submissions,
      }),
    });

    if (!judge0Response.ok) {
      throw new Error(`Judge0 API error: ${await judge0Response.text()}`);
    }

    const { tokens } = await judge0Response.json();

    // Poll for results
    let allCompleted = false;
    let results = [];

    while (!allCompleted) {
      await new Promise(resolve => setTimeout(resolve, 1000));

      const tokensParam = tokens.map(t => t.token).join(',');
      const statusResponse = await fetch(
        `${JUDGE0_URL}/submissions/batch?tokens=${tokensParam}&base64_encoded=false`,
        {
          headers: {
            'X-RapidAPI-Key': JUDGE0_API_KEY,
            'X-RapidAPI-Host': 'judge0-ce.p.rapidapi.com',
          },
        }
      );

      const statusData = await statusResponse.json();
      results = statusData.submissions;

      allCompleted = results.every(result => 
        result.status.id > 2 // Status 3 and above are completed
      );
    }

    // Calculate score
    const testResults = results.map((result, index) => ({
      test_case_id: testCases[index].id,
      status: getStatusDescription(result.status.id),
      runtime: result.time,
      memory: result.memory,
      stdout: result.stdout,
      stderr: result.stderr,
      message: result.message,
      is_hidden: testCases[index].is_hidden,
    }));

    const passedTests = testResults.filter(r => 
      r.status === 'Accepted'
    ).length;
    const totalTests = testResults.length;

    // Get existing submission to check if late
    const { data: submission } = await supabaseClient
      .from('submissions')
      .select('is_late, penalty_points')
      .eq('id', submission_id)
      .single();

    // Calculate scores based on formula
    const correctness = (passedTests / totalTests) * 70;
    const efficiency = calculateEfficiencyScore(testResults);
    const speed = calculateSpeedScore(match_id, user_id);
    
    let score = correctness + efficiency + speed - (submission?.penalty_points || 0);
    
    if (submission?.is_late) {
      score = 0;
    }

    // Update submission with results
    await supabaseClient
      .from('submissions')
      .update({
        score: Math.round(score),
        passed_tests: passedTests,
        total_tests: totalTests,
        test_results: testResults,
        runtime_ms: Math.round(testResults.reduce((sum, r) => sum + (r.runtime || 0), 0) / testResults.length),
        memory_mb: Math.round(testResults.reduce((sum, r) => sum + (r.memory || 0), 0) / testResults.length / 1024),
        evaluated_at: new Date().toISOString(),
      })
      .eq('id', submission_id);

    // Update match scores
    await updateMatchScores(supabaseClient, match_id, user_id, Math.round(score));

    return new Response(
      JSON.stringify({
        success: true,
        score: Math.round(score),
        passed_tests: passedTests,
        total_tests: totalTests,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('Judge execution error:', error);
    
    // Update submission with error
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
    );

    try {
      const { submission_id } = await req.json();
      await supabaseClient
        .from('submissions')
        .update({
          score: 0,
          test_results: [{ error: error.message }],
          evaluated_at: new Date().toISOString(),
        })
        .eq('id', submission_id);
    } catch (e) {
      console.error('Failed to update submission:', e);
    }

    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }
});

function getStatusDescription(statusId: number): string {
  const statusMap: Record<number, string> = {
    3: 'Accepted',
    4: 'Wrong Answer',
    5: 'Time Limit Exceeded',
    6: 'Compilation Error',
    7: 'Runtime Error',
    8: 'Memory Limit Exceeded',
  };
  return statusMap[statusId] || 'Unknown';
}

function calculateEfficiencyScore(testResults: any[]): number {
  const avgRuntime = testResults.reduce((sum, r) => sum + (r.runtime || 0), 0) / testResults.length;
  const avgMemory = testResults.reduce((sum, r) => sum + (r.memory || 0), 0) / testResults.length;
  
  // Normalize scores (lower is better)
  const runtimeScore = Math.max(0, 20 - (avgRuntime / 100)); // 20 points max for speed
  const memoryScore = Math.max(0, 20 - (avgMemory / (1024 * 10))); // 20 points max for memory
  
  return (runtimeScore + memoryScore) / 2; // Average to 20 max
}

async function calculateSpeedScore(matchId: string, userId: string): Promise<number> {
  const supabaseClient = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_ANON_KEY') ?? '',
  );

  // Get match start time and submissions
  const { data: match } = await supabaseClient
    .from('matches')
    .select('started_at, rooms(time_limit)')
    .eq('id', matchId)
    .single();

  const { data: submissions } = await supabaseClient
    .from('submissions')
    .select('submitted_at')
    .eq('match_id', matchId)
    .eq('user_id', userId)
    .order('submitted_at', { ascending: true })
    .limit(1);

  if (!submissions || submissions.length === 0) return 0;

  const startTime = new Date(match.started_at);
  const submitTime = new Date(submissions[0].submitted_at);
  const timeLimit = match.rooms.time_limit * 1000; // Convert to ms
  
  const elapsed = submitTime.getTime() - startTime.getTime();
  const percentage = Math.max(0, 100 - (elapsed / timeLimit) * 100);
  
  return percentage * 0.1; // Convert to 10 points max
}

async function updateMatchScores(
  supabaseClient: any,
  matchId: string,
  userId: string,
  score: number
): Promise<void> {
  // Get match to determine player role
  const { data: match } = await supabaseClient
    .from('matches')
    .select('player1_id, player2_id')
    .eq('id', matchId)
    .single();

  const isPlayer1 = match.player1_id === userId;
  
  // Update match score
  if (isPlayer1) {
    await supabaseClient
      .from('matches')
      .update({ player1_score: score })
      .eq('id', matchId);
  } else {
    await supabaseClient
      .from('matches')
      .update({ player2_score: score })
      .eq('id', matchId);
  }

  // Check if both players have submitted
  const { data: submissions } = await supabaseClient
    .from('submissions')
    .select('user_id')
    .eq('match_id', matchId)
    .not('evaluated_at', 'is', null);

  const submittedUsers = new Set(submissions?.map(s => s.user_id) || []);
  
  if (submittedUsers.has(match.player1_id) && submittedUsers.has(match.player2_id)) {
    // Both players have submitted, end match
    await supabaseClient
      .from('rooms')
      .update({
        status: 'completed',
        ended_at: new Date().toISOString(),
      })
      .eq('id', (await supabaseClient
        .from('matches')
        .select('room_id')
        .eq('id', matchId)
        .single()
      ).data.room_id);
  }
}