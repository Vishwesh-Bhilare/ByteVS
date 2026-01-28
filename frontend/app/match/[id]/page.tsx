// frontend/app/match/[id]/page.tsx
'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/hooks/use-auth';
import { supabase } from '@/lib/supabase';
import { useMatch } from '@/hooks/use-match';
import { Loader2, Code, CheckCircle, Clock, AlertCircle, Send } from 'lucide-react';
import { toast } from '@/components/ui/use-toast';
import MatchTimer from '@/components/match-timer';
import TestResults from '@/components/test-results';

const MonacoEditor = dynamic(() => import('@/components/monaco-editor'), {
  ssr: false,
});

export default function MatchPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const matchId = params.id as string;

  const { match, room, problem, isLoading, submitSolution } = useMatch(matchId);
  const [code, setCode] = useState('');
  const [language, setLanguage] = useState('python');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [opponentSubmitted, setOpponentSubmitted] = useState(false);

  // Load saved draft
  useEffect(() => {
    if (!user || !matchId) return;

    const loadDraft = async () => {
      const { data: draft } = await supabase
        .from('submission_drafts')
        .select('code, language')
        .eq('user_id', user.id)
        .eq('match_id', matchId)
        .single();

      if (draft) {
        setCode(draft.code);
        setLanguage(draft.language);
      } else if (problem) {
        setCode(
          language === 'python'
            ? problem.starter_code_python
            : problem.starter_code_cpp
        );
      }
    };

    loadDraft();
  }, [user, matchId, problem, language]);

  // Auto-save draft
  useEffect(() => {
    if (!user || !matchId || !code) return;

    const saveTimeout = setTimeout(async () => {
      await supabase
        .from('submission_drafts')
        .upsert({
          user_id: user.id,
          match_id: matchId,
          code,
          language,
          last_saved_at: new Date().toISOString(),
        });
    }, 5000);

    return () => clearTimeout(saveTimeout);
  }, [code, language, user, matchId]);

  // Listen for opponent submissions
  useEffect(() => {
    if (!matchId || !user) return;

    const channel = supabase
      .channel(`match:${matchId}:submissions`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'submissions',
          filter: `match_id=eq.${matchId}`,
        },
        async (payload) => {
          const submission = payload.new;
          if (submission.user_id !== user.id) {
            setOpponentSubmitted(true);
            toast({
              title: 'Opponent Submitted!',
              description: 'Your opponent has submitted their solution.',
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [matchId, user]);

  // Listen for match end
  useEffect(() => {
    if (!room?.id) return;

    const channel = supabase
      .channel(`room:${room.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'rooms',
          filter: `id=eq.${room.id}`,
        },
        (payload) => {
          if (payload.new.status === 'completed') {
            router.push(`/results/${matchId}`);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [room?.id, matchId, router]);

  const handleSubmit = async () => {
    if (!code.trim()) {
      toast({
        title: 'Empty Code',
        description: 'Please write some code before submitting',
        variant: 'destructive',
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await submitSolution(code, language);
      if (result.success) {
        toast({
          title: 'Submitted!',
          description: 'Your solution is being evaluated.',
        });
      }
    } catch (error) {
      toast({
        title: 'Submission Failed',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading || !match || !room || !problem) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  const isPlayer = [match.player1_id, match.player2_id].includes(user?.id || '');
  if (!isPlayer) {
    return (
      <div className="text-center">
        <h2 className="text-2xl font-bold mb-4">Not Authorized</h2>
        <Button onClick={() => router.push('/')}>Return Home</Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Match Header */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-gray-800/50 border-gray-700">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <Clock className="h-5 w-5 text-blue-500" />
                <div>
                  <p className="text-sm text-gray-400">Time Remaining</p>
                  <MatchTimer
                    startTime={room.started_at}
                    timeLimit={room.time_limit}
                    onTimeUp={() => {
                      toast({
                        title: 'Time\'s Up!',
                        description: 'Match has ended',
                      });
                    }}
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gray-800/50 border-gray-700">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <Code className="h-5 w-5 text-green-500" />
                <div>
                  <p className="text-sm text-gray-400">Problem</p>
                  <p className="font-semibold">{problem.title}</p>
                </div>
              </div>
              <span className={`px-2 py-1 rounded text-xs font-semibold ${
                problem.difficulty === 'easy' ? 'bg-green-900/30 text-green-400' :
                problem.difficulty === 'medium' ? 'bg-yellow-900/30 text-yellow-400' :
                'bg-red-900/30 text-red-400'
              }`}>
                {problem.difficulty.toUpperCase()}
              </span>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gray-800/50 border-gray-700">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                {opponentSubmitted ? (
                  <CheckCircle className="h-5 w-5 text-red-500" />
                ) : (
                  <AlertCircle className="h-5 w-5 text-yellow-500" />
                )}
                <div>
                  <p className="text-sm text-gray-400">Opponent Status</p>
                  <p className="font-semibold">
                    {opponentSubmitted ? 'Submitted' : 'Still Coding'}
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Problem Description */}
        <Card className="bg-gray-800/50 border-gray-700 h-[calc(100vh-200px)] overflow-hidden">
          <CardHeader>
            <CardTitle>Problem Description</CardTitle>
          </CardHeader>
          <CardContent className="overflow-y-auto h-[calc(100%-80px)]">
            <div className="prose prose-invert max-w-none">
              <div className="space-y-4">
                <h2 className="text-xl font-bold">{problem.title}</h2>
                <div className="whitespace-pre-wrap text-gray-300">
                  {problem.description}
                </div>
                
                <div className="space-y-2">
                  <h3 className="font-semibold">Constraints:</h3>
                  <ul className="list-disc pl-5 text-gray-400">
                    <li>Time Limit: {problem.time_limit} seconds</li>
                    <li>Memory Limit: {problem.memory_limit} MB</li>
                  </ul>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Code Editor */}
        <div className="space-y-4">
          <Card className="bg-gray-800/50 border-gray-700">
            <CardHeader className="pb-3">
              <div className="flex justify-between items-center">
                <CardTitle>Code Editor</CardTitle>
                <div className="flex items-center space-x-2">
                  <select
                    value={language}
                    onChange={(e) => {
                      setLanguage(e.target.value);
                      setCode(
                        e.target.value === 'python'
                          ? problem.starter_code_python
                          : problem.starter_code_cpp
                      );
                    }}
                    className="bg-gray-900 border border-gray-700 rounded px-3 py-1 text-sm"
                  >
                    <option value="python">Python 3</option>
                    <option value="cpp">C++ 17</option>
                  </select>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="h-[500px]">
                <MonacoEditor
                  language={language}
                  value={code}
                  onChange={setCode}
                  theme="vs-dark"
                />
              </div>
            </CardContent>
          </Card>

          {/* Submit Button */}
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="w-full h-12 text-lg bg-green-600 hover:bg-green-700"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin mr-2" />
                Submitting...
              </>
            ) : (
              <>
                <Send className="h-5 w-5 mr-2" />
                Submit Solution
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}