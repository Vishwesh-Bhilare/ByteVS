// frontend/components/match-timer.tsx
'use client';

import { useState, useEffect } from 'react';
import { AlertCircle } from 'lucide-react';

interface MatchTimerProps {
  startTime: string;
  timeLimit: number; // in seconds
  onTimeUp: () => void;
}

export default function MatchTimer({ startTime, timeLimit, onTimeUp }: MatchTimerProps) {
  const [timeRemaining, setTimeRemaining] = useState<number>(0);
  const [isTimeUp, setIsTimeUp] = useState(false);

  useEffect(() => {
    const calculateTimeRemaining = () => {
      const start = new Date(startTime).getTime();
      const now = Date.now();
      const elapsed = Math.floor((now - start) / 1000);
      const remaining = timeLimit - elapsed;

      return Math.max(0, remaining);
    };

    setTimeRemaining(calculateTimeRemaining());

    const interval = setInterval(() => {
      const remaining = calculateTimeRemaining();
      setTimeRemaining(remaining);

      if (remaining === 0 && !isTimeUp) {
        setIsTimeUp(true);
        onTimeUp();
        clearInterval(interval);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [startTime, timeLimit, onTimeUp, isTimeUp]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const getTimeColor = () => {
    if (timeRemaining < 60) return 'text-red-500';
    if (timeRemaining < 180) return 'text-yellow-500';
    return 'text-green-500';
  };

  return (
    <div className="flex items-center space-x-2">
      {timeRemaining < 60 && <AlertCircle className="h-5 w-5 text-red-500 animate-pulse" />}
      <span className={`text-2xl font-bold ${getTimeColor()}`}>
        {formatTime(timeRemaining)}
      </span>
    </div>
  );
}