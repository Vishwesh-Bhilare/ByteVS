// frontend/app/page.tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/hooks/use-auth';
import { supabase } from '@/lib/supabase';
import { Loader2, Sword, Zap, Users, Trophy } from 'lucide-react';
import { toast } from '@/components/ui/use-toast';

export default function HomePage() {
  const router = useRouter();
  const { user, isLoading } = useAuth();
  const [isJoining, setIsJoining] = useState(false);

  const handleQuickPlay = async (difficulty: string) => {
    if (!user) {
      router.push('/auth');
      return;
    }

    setIsJoining(true);
    try {
      const response = await fetch('/api/matchmaking/join-quickplay', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ difficulty }),
      });

      const data = await response.json();

      if (data.room) {
        router.push(`/room/${data.room.id}`);
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to join quick play',
        variant: 'destructive',
      });
    } finally {
      setIsJoining(false);
    }
  };

  const handleCreateRoom = async () => {
    if (!user) {
      router.push('/auth');
      return;
    }

    try {
      const response = await fetch('/api/rooms/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ mode: 'custom' }),
      });

      const data = await response.json();

      if (data.room) {
        router.push(`/room/${data.room.id}`);
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to create room',
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

  return (
    <div className="space-y-8">
      {/* Hero Section */}
      <div className="text-center space-y-4">
        <h1 className="text-5xl font-bold bg-gradient-to-r from-blue-500 to-purple-600 bg-clip-text text-transparent">
          CodeDuel
        </h1>
        <p className="text-xl text-gray-300 max-w-2xl mx-auto">
          Real-time 1v1 coding battles. Prove your skills against developers worldwide.
        </p>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-gray-800/50 border-gray-700">
          <CardHeader className="flex flex-row items-center space-x-2">
            <Zap className="h-5 w-5 text-yellow-500" />
            <CardTitle className="text-lg">Instant Matchmaking</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-400">Find opponents in seconds</p>
          </CardContent>
        </Card>

        <Card className="bg-gray-800/50 border-gray-700">
          <CardHeader className="flex flex-row items-center space-x-2">
            <Trophy className="h-5 w-5 text-yellow-500" />
            <CardTitle className="text-lg">Live Scoring</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-400">Real-time performance metrics</p>
          </CardContent>
        </Card>

        <Card className="bg-gray-800/50 border-gray-700">
          <CardHeader className="flex flex-row items-center space-x-2">
            <Users className="h-5 w-5 text-yellow-500" />
            <CardTitle className="text-lg">1v1 Battles</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-400">Direct competition, no teams</p>
          </CardContent>
        </Card>
      </div>

      {/* Game Modes */}
      <Tabs defaultValue="quickplay" className="max-w-4xl mx-auto">
        <TabsList className="grid grid-cols-2 mb-8">
          <TabsTrigger value="quickplay">Quick Play</TabsTrigger>
          <TabsTrigger value="custom">Custom Room</TabsTrigger>
        </TabsList>

        <TabsContent value="quickplay">
          <Card className="bg-gray-800/50 border-gray-700">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Zap className="h-6 w-6" />
                <span>Quick Play</span>
              </CardTitle>
              <CardDescription>
                Jump into a match instantly. 15-minute time limit.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Button
                  onClick={() => handleQuickPlay('easy')}
                  disabled={isJoining}
                  className="h-24 flex-col space-y-2 bg-green-900/20 hover:bg-green-800/30 border-green-700"
                >
                  <Sword className="h-8 w-8" />
                  <span className="text-lg">Easy</span>
                  <span className="text-sm text-gray-400">Great for beginners</span>
                </Button>

                <Button
                  onClick={() => handleQuickPlay('medium')}
                  disabled={isJoining}
                  className="h-24 flex-col space-y-2 bg-yellow-900/20 hover:bg-yellow-800/30 border-yellow-700"
                >
                  <Sword className="h-8 w-8" />
                  <span className="text-lg">Medium</span>
                  <span className="text-sm text-gray-400">Balanced challenge</span>
                </Button>

                <Button
                  onClick={() => handleQuickPlay('hard')}
                  disabled={isJoining}
                  className="h-24 flex-col space-y-2 bg-red-900/20 hover:bg-red-800/30 border-red-700"
                >
                  <Sword className="h-8 w-8" />
                  <span className="text-lg">Hard</span>
                  <span className="text-sm text-gray-400">For experts only</span>
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="custom">
          <Card className="bg-gray-800/50 border-gray-700">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Users className="h-6 w-6" />
                <span>Custom Room</span>
              </CardTitle>
              <CardDescription>
                Create a private room and invite friends. Customize rules.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <Button
                  onClick={handleCreateRoom}
                  className="w-full h-20 text-lg bg-blue-900/20 hover:bg-blue-800/30 border-blue-700"
                >
                  Create Private Room
                </Button>
                <div className="text-center text-gray-400">
                  Share the room code with your friend to start
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* How It Works */}
      <Card className="bg-gray-800/50 border-gray-700 max-w-4xl mx-auto">
        <CardHeader>
          <CardTitle>How It Works</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="text-center space-y-2">
              <div className="w-12 h-12 rounded-full bg-blue-900/30 flex items-center justify-center mx-auto">
                <span className="text-xl font-bold">1</span>
              </div>
              <h3 className="font-semibold">Matchmake</h3>
              <p className="text-sm text-gray-400">Find an opponent instantly</p>
            </div>

            <div className="text-center space-y-2">
              <div className="w-12 h-12 rounded-full bg-purple-900/30 flex items-center justify-center mx-auto">
                <span className="text-xl font-bold">2</span>
              </div>
              <h3 className="font-semibold">Code</h3>
              <p className="text-sm text-gray-400">Solve the same problem</p>
            </div>

            <div className="text-center space-y-2">
              <div className="w-12 h-12 rounded-full bg-green-900/30 flex items-center justify-center mx-auto">
                <span className="text-xl font-bold">3</span>
              </div>
              <h3 className="font-semibold">Submit</h3>
              <p className="text-sm text-gray-400">Race against time</p>
            </div>

            <div className="text-center space-y-2">
              <div className="w-12 h-12 rounded-full bg-yellow-900/30 flex items-center justify-center mx-auto">
                <span className="text-xl font-bold">4</span>
              </div>
              <h3 className="font-semibold">Compare</h3>
              <p className="text-sm text-gray-400">See detailed results</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}