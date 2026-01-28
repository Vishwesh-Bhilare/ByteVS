// frontend/app/room/[id]/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/hooks/use-auth';
import { supabase } from '@/lib/supabase';
import { useRoom } from '@/hooks/use-room';
import { Loader2, Users, Clock, Sword, Copy } from 'lucide-react';
import { toast } from '@/components/ui/use-toast';

export default function RoomPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const roomId = params.id as string;
  
  const { room, isLoading, startMatch } = useRoom(roomId);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!room) return;

    // Subscribe to room updates
    const channel = supabase
      .channel(`room:${roomId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'rooms',
          filter: `id=eq.${roomId}`,
        },
        (payload) => {
          const updatedRoom = payload.new;
          
          if (updatedRoom.status === 'active') {
            router.push(`/match/${updatedRoom.id}`);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [roomId, room, router]);

  const copyRoomCode = () => {
    if (room?.room_code) {
      navigator.clipboard.writeText(room.room_code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast({
        title: 'Copied!',
        description: 'Room code copied to clipboard',
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

  if (!room) {
    return (
      <div className="text-center">
        <h2 className="text-2xl font-bold mb-4">Room not found</h2>
        <Button onClick={() => router.push('/')}>Return Home</Button>
      </div>
    );
  }

  const isRoomCreator = room.created_by === user?.id;
  const isPlayer = [room.player1_id, room.player2_id].includes(user?.id || '');
  const isFull = room.player1_id && room.player2_id;
  const canStart = isRoomCreator && isFull && room.status === 'locked';

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Room Header */}
      <Card className="bg-gray-800/50 border-gray-700">
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle className="flex items-center space-x-2">
                <Users className="h-6 w-6" />
                <span>Room: {room.room_code}</span>
              </CardTitle>
              <CardDescription>
                {room.mode === 'quickplay' ? 'Quick Play' : 'Custom Room'} • {room.difficulty}
              </CardDescription>
            </div>
            <Button
              variant="outline"
              onClick={copyRoomCode}
              className="flex items-center space-x-2"
            >
              <Copy className="h-4 w-4" />
              <span>{copied ? 'Copied!' : 'Copy Code'}</span>
            </Button>
          </div>
        </CardHeader>
      </Card>

      {/* Room Status */}
      <Card className="bg-gray-800/50 border-gray-700">
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Player 1 */}
            <div className={`p-4 rounded-lg ${room.player1_id ? 'bg-blue-900/20 border border-blue-700' : 'bg-gray-800/30 border border-gray-700'}`}>
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-full bg-blue-900/50 flex items-center justify-center">
                  <Sword className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-semibold">Player 1</h3>
                  <p className="text-sm text-gray-400">
                    {room.player1_id ? (room.player1_id === user?.id ? 'You' : 'Opponent') : 'Waiting...'}
                  </p>
                </div>
              </div>
            </div>

            {/* Player 2 */}
            <div className={`p-4 rounded-lg ${room.player2_id ? 'bg-purple-900/20 border border-purple-700' : 'bg-gray-800/30 border border-gray-700'}`}>
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-full bg-purple-900/50 flex items-center justify-center">
                  <Sword className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-semibold">Player 2</h3>
                  <p className="text-sm text-gray-400">
                    {room.player2_id ? (room.player2_id === user?.id ? 'You' : 'Opponent') : 'Waiting...'}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Room Info */}
      <Card className="bg-gray-800/50 border-gray-700">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Clock className="h-6 w-6" />
            <span>Match Settings</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="space-y-1">
              <p className="text-sm text-gray-400">Mode</p>
              <p className="font-semibold capitalize">{room.mode}</p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-gray-400">Difficulty</p>
              <p className="font-semibold capitalize">{room.difficulty}</p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-gray-400">Time Limit</p>
              <p className="font-semibold">{room.time_limit / 60} minutes</p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-gray-400">Status</p>
              <p className="font-semibold capitalize">{room.status}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex justify-center space-x-4">
        {!isPlayer && room.status === 'waiting' && (
          <Button
            onClick={async () => {
              try {
                const response = await fetch('/api/rooms/join', {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                  },
                  body: JSON.stringify({ room_id: roomId }),
                });
                const data = await response.json();
                if (data.success) {
                  toast({
                    title: 'Joined room!',
                    description: 'Waiting for match to start...',
                  });
                }
              } catch (error) {
                toast({
                  title: 'Error',
                  description: 'Failed to join room',
                  variant: 'destructive',
                });
              }
            }}
            className="px-8"
          >
            Join Room
          </Button>
        )}

        {canStart && (
          <Button
            onClick={startMatch}
            className="px-8 bg-green-600 hover:bg-green-700"
          >
            Start Match
          </Button>
        )}

        {isPlayer && room.status === 'locked' && !isRoomCreator && (
          <div className="text-center py-4">
            <p className="text-gray-400">Waiting for host to start the match...</p>
          </div>
        )}
      </div>

      {/* Instructions */}
      {room.status === 'waiting' && (
        <Card className="bg-gray-800/30 border-gray-700">
          <CardContent className="pt-6">
            <div className="text-center space-y-2">
              <h3 className="font-semibold">Waiting for opponent...</h3>
              <p className="text-gray-400">
                Share the room code <code className="bg-gray-700 px-2 py-1 rounded">{room.room_code}</code> with a friend
              </p>
              <p className="text-sm text-gray-500">
                Or wait for someone to join via Quick Play
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}