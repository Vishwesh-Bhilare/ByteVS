// frontend/hooks/use-match.ts
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { toast } from '@/components/ui/use-toast';

interface Match {
  id: string;
  room_id: string;
  problem_id: string;
  player1_id: string;
  player2_id: string;
  player1_score: number;
  player2_score: number;
  started_at: string;
}

interface Problem {
  id: string;
  title: string;
  description: string;
  starter_code_python: string;
  starter_code_cpp: string;
  difficulty: string;
  time_limit: number;
  memory_limit: number;
}

interface Room {
  id: string;
  status: string;
  started_at: string;
  time_limit: number;
}

export function useMatch(matchId: string) {
  const [match, setMatch] = useState<Match | null>(null);
  const [room, setRoom] = useState<Room | null>(null);
  const [problem, setProblem] = useState<Problem | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadMatchData();
  }, [matchId]);

  const loadMatchData = async () => {
    try {
      // Load match
      const { data: matchData, error: matchError } = await supabase
        .from('matches')
        .select('*')
        .eq('id', matchId)
        .single();

      if (matchError) throw matchError;
      setMatch(matchData);

      // Load room
      const { data: roomData, error: roomError } = await supabase
        .from('rooms')
        .select('*')
        .eq('id', matchData.room_id)
        .single();

      if (roomError) throw roomError;
      setRoom(roomData);

      // Load problem
      const { data: problemData, error: problemError } = await supabase
        .from('problems')
        .select('*')
        .eq('id', matchData.problem_id)
        .single();

      if (problemError) throw problemError;
      setProblem(problemData);
    } catch (error) {
      console.error('Error loading match:', error);
      toast({
        title: 'Error',
        description: 'Failed to load match data',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const submitSolution = async (code: string, language: string) => {
    try {
      const response = await fetch('/api/submit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          match_id: matchId,
          code,
          language,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error);
      }

      toast({
        title: 'Success',
        description: 'Solution submitted successfully',
      });

      return data;
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
      throw error;
    }
  };

  return {
    match,
    room,
    problem,
    isLoading,
    submitSolution,
  };
}