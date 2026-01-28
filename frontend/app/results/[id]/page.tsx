// frontend/app/results/[id]/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/lib/supabase';
import { Loader2, Trophy, Clock, Cpu, CheckCircle, XCircle, Code, Users } from 'lucide-react';
import { toast } from '@/components/ui/use-toast';

interface Submission {
  id: string;
  user_id: string;
  code: string;
  language: string;
  score: number;
  runtime_ms: number;
  memory_mb: number;
  passed_tests: number;
  total_tests: number;
  test_results: any[];
  is_late: boolean;
}

interface MatchData {
  id: string;
  player1_id: string;
  player2_id: string;
  player1_score: number;
  player2_score: number;
  winner_id: string;
  problem: {
    title: string;
    description: string;
    editorial_solution: string;
  };
  submissions: Submission[];
  player1: { username: string };
  player2: { username: string };
}

export default function ResultsPage() {
  const params = useParams();
  const router = useRouter();
  const matchId = params.id as string;

  const [matchData, setMatchData] = useState<MatchData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    loadMatchData();
  }, [matchId]);

  const loadMatchData = async () => {
    try {
      const { data: match, error: matchError } = await supabase
        .from('matches')
        .select(`
          *,
          problem:problems (
            title,
            description,
            editorial_solution
          ),
          player1:users!player1_id (username),
          player2:users!player2_id (username)
        `)
        .eq('id', matchId)
        .single();

      if (matchError) throw matchError;

      const { data: submissions } = await supabase
        .from('submissions')
        .select('*')
        .eq('match_id', matchId)
        .order('submitted_at', { ascending: false });

      setMatchData({
        ...match,
        submissions: submissions || [],
      } as MatchData);
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to load match results',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleRematch = async () => {
    try {
      const { data: room } = await supabase
        .from('rooms')
        .select('*')
        .eq('id', matchData?.room_id)
        .single();

      if (room) {
        // Create new room with same settings
        const response = await fetch('/api/rooms/create', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            mode: room.mode,
            difficulty: room.difficulty,
            time_limit: room.time_limit,
          }),
        });

        const data = await response.json();
        if (data.room) {
          router.push(`/room/${data.room.id}`);
        }
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to create rematch',
        variant: 'destructive',
      });
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!matchData) {
    return (
      <div className="text-center">
        <h2 className="text-2xl font-bold mb-4">Results not found</h2>
        <Button onClick={() => router.push('/')}>Return Home</Button>
      </div>
    );
  }

  const player1Sub = matchData.submissions.find(s => s.user_id === matchData.player1_id);
  const player2Sub = matchData.submissions.find(s => s.user_id === matchData.player2_id);
  const isDraw = matchData.player1_score === matchData.player2_score;

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Winner Banner */}
      <Card className={`border-2 ${
        isDraw ? 'border-yellow-700 bg-yellow-900/20' :
        matchData.winner_id ? 'border-green-700 bg-green-900/20' :
        'border-gray-700 bg-gray-800/50'
      }`}>
        <CardContent className="pt-6">
          <div className="text-center space-y-4">
            <div className="flex items-center justify-center space-x-3">
              <Trophy className="h-8 w-8 text-yellow-500" />
              <h1 className="text-3xl font-bold">
                {isDraw ? 'Draw!' : `${matchData.winner_id === matchData.player1_id ? matchData.player1?.username : matchData.player2?.username} Wins!`}
              </h1>
            </div>
            <div className="grid grid-cols-2 gap-8 max-w-md mx-auto">
              <div className="text-center">
                <div className="text-2xl font-bold">{matchData.player1_score}</div>
                <div className="text-gray-400">{matchData.player1?.username}</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold">{matchData.player2_score}</div>
                <div className="text-gray-400">{matchData.player2?.username}</div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid grid-cols-3">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="solutions">Solutions</TabsTrigger>
          <TabsTrigger value="editorial">Editorial</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          {/* Performance Comparison */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Player 1 Stats */}
            <Card className="bg-gray-800/50 border-gray-700">
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Users className="h-5 w-5" />
                  <span>{matchData.player1?.username}</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {player1Sub ? (
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-gray-400">Score</span>
                      <span className="font-bold">{player1Sub.score}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Runtime</span>
                      <span className="font-mono">{player1Sub.runtime_ms}ms</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Memory</span>
                      <span className="font-mono">{player1Sub.memory_mb}MB</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Tests Passed</span>
                      <span>
                        <span className="font-bold">{player1Sub.passed_tests}</span>
                        <span className="text-gray-400">/{player1Sub.total_tests}</span>
                      </span>
                    </div>
                    {player1Sub.is_late && (
                      <div className="text-red-400 text-sm">Late Submission</div>
                    )}
                  </div>
                ) : (
                  <div className="text-gray-400">No submission</div>
                )}
              </CardContent>
            </Card>

            {/* Player 2 Stats */}
            <Card className="bg-gray-800/50 border-gray-700">
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Users className="h-5 w-5" />
                  <span>{matchData.player2?.username}</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {player2Sub ? (
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-gray-400">Score</span>
                      <span className="font-bold">{player2Sub.score}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Runtime</span>
                      <span className="font-mono">{player2Sub.runtime_ms}ms</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Memory</span>
                      <span className="font-mono">{player2Sub.memory_mb}MB</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Tests Passed</span>
                      <span>
                        <span className="font-bold">{player2Sub.passed_tests}</span>
                        <span className="text-gray-400">/{player2Sub.total_tests}</span>
                      </span>
                    </div>
                    {player2Sub.is_late && (
                      <div className="text-red-400 text-sm">Late Submission</div>
                    )}
                  </div>
                ) : (
                  <div className="text-gray-400">No submission</div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Test Results */}
          {player1Sub?.test_results && (
            <Card className="bg-gray-800/50 border-gray-700">
              <CardHeader>
                <CardTitle>Test Results</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {player1Sub.test_results.map((result, index) => (
                    <div
                      key={index}
                      className={`flex items-center justify-between p-3 rounded ${
                        result.status === 'Accepted'
                          ? 'bg-green-900/20'
                          : 'bg-red-900/20'
                      }`}
                    >
                      <div className="flex items-center space-x-3">
                        {result.status === 'Accepted' ? (
                          <CheckCircle className="h-5 w-5 text-green-500" />
                        ) : (
                          <XCircle className="h-5 w-5 text-red-500" />
                        )}
                        <div>
                          <div className="font-medium">Test Case {index + 1}</div>
                          <div className="text-sm text-gray-400">
                            {result.is_hidden ? 'Hidden Test' : 'Public Test'}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-mono text-sm">{result.runtime}ms</div>
                        <div className="text-xs text-gray-400">
                          {Math.round(result.memory / 1024)}MB
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="solutions" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Player 1 Solution */}
            <Card className="bg-gray-800/50 border-gray-700">
              <CardHeader>
                <CardTitle>{matchData.player1?.username}'s Solution</CardTitle>
              </CardHeader>
              <CardContent>
                {player1Sub ? (
                  <pre className="bg-gray-900 p-4 rounded overflow-x-auto text-sm">
                    <code>{player1Sub.code}</code>
                  </pre>
                ) : (
                  <div className="text-gray-400">No solution submitted</div>
                )}
              </CardContent>
            </Card>

            {/* Player 2 Solution */}
            <Card className="bg-gray-800/50 border-gray-700">
              <CardHeader>
                <CardTitle>{matchData.player2?.username}'s Solution</CardTitle>
              </CardHeader>
              <CardContent>
                {player2Sub ? (
                  <pre className="bg-gray-900 p-4 rounded overflow-x-auto text-sm">
                    <code>{player2Sub.code}</code>
                  </pre>
                ) : (
                  <div className="text-gray-400">No solution submitted</div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="editorial">
          <Card className="bg-gray-800/50 border-gray-700">
            <CardHeader>
              <CardTitle>Optimal Solution</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="prose prose-invert max-w-none">
                <div dangerouslySetInnerHTML={{ 
                  __html: matchData.problem.editorial_solution 
                }} />
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Actions */}
      <div className="flex justify-center space-x-4 pt-4">
        <Button
          onClick={handleRematch}
          className="bg-blue-600 hover:bg-blue-700"
        >
          Request Rematch
        </Button>
        <Button
          onClick={() => router.push('/')}
          variant="outline"
        >
          Back to Home
        </Button>
      </div>
    </div>
  );
}