
'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Library } from 'lucide-react';
import GameCard from '@/components/game-card';
import type { SavedGame } from '@/lib/game-storage';
import { getSavedGames, deleteGame as deleteGameFromStorage } from '@/lib/game-storage';
import { useToast } from '@/hooks/use-toast';

export default function CreatedGamesPage() {
  const [savedGames, setSavedGames] = useState<SavedGame[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();
  const { toast } = useToast();

  useEffect(() => {
    // Ensure this runs only on the client
    if (typeof window !== 'undefined') {
      const games = getSavedGames();
      setSavedGames(games.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
      setIsLoading(false);
    }
  }, []);

  const handlePlayGame = (id: string) => {
    router.push(`/world?loadGameId=${id}`);
  };

  const handleDeleteGame = (id: string) => {
    if (confirm('Are you sure you want to delete this game? This action cannot be undone.')) {
      const success = deleteGameFromStorage(id);
      if (success) {
        setSavedGames(prevGames => prevGames.filter(game => game.id !== id));
        toast({ title: "Game Deleted", description: "The game has been removed." });
      } else {
        toast({ title: "Error", description: "Could not delete the game.", variant: "destructive" });
      }
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-background">
        <Library size={48} className="text-primary mb-4 animate-pulse" />
        <p className="text-xl text-foreground">Loading Saved Games...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-secondary/20">
      <header className="p-4 bg-background pixel-border-b border-border sticky top-0 z-10">
        <div className="container mx-auto flex items-center justify-between">
          <h1 className="text-2xl font-bold text-primary flex items-center gap-2">
            <Library size={24} /> Created Games
          </h1>
          <Link href="/" passHref>
            <Button className="btn-pixel-secondary">
              <ArrowLeft size={16} className="mr-2" /> Back to Creator
            </Button>
          </Link>
        </div>
      </header>

      <main className="flex-grow container mx-auto p-4 md:p-6">
        {savedGames.length === 0 ? (
          <div className="flex flex-col items-center justify-center text-center h-full mt-10">
            <Library size={64} className="text-muted-foreground mb-6" />
            <h2 className="text-2xl font-semibold text-foreground mb-2">No Games Saved Yet</h2>
            <p className="text-muted-foreground mb-6">
              Create a character and a world, then save your game to see it here.
            </p>
            <Link href="/" passHref>
              <Button className="btn-pixel-accent">
                Create New Game
              </Button>
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {savedGames.map(game => (
              <GameCard
                key={game.id}
                game={game}
                onPlay={handlePlayGame}
                onDelete={handleDeleteGame}
              />
            ))}
          </div>
        )}
      </main>
      <footer className="p-4 text-center text-sm text-muted-foreground bg-background pixel-border-t border-border">
        &copy; {new Date().getFullYear()} SpriteCraft Studio. Manage your pixel adventures.
      </footer>
    </div>
  );
}
