
'use client';

import type { SavedGame } from '@/lib/game-storage';
import Image from 'next/image';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Play, Trash2 } from 'lucide-react';

interface GameCardProps {
  game: SavedGame;
  onPlay: (id: string) => void;
  onDelete: (id: string) => void;
}

export default function GameCard({ game, onPlay, onDelete }: GameCardProps) {
  const standingSprite = game.spriteSlots.standing;

  return (
    <Card className="card-pixel flex flex-col">
      <CardHeader>
        <CardTitle className="truncate text-lg">{game.name}</CardTitle>
        <CardDescription className="text-xs">
          Created: {new Date(game.createdAt).toLocaleDateString()}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex-grow space-y-3">
        <div className="flex gap-3 items-start">
          {standingSprite && (
            <div className="w-16 h-16 pixel-border bg-white flex items-center justify-center overflow-hidden flex-shrink-0">
              <Image
                src={standingSprite}
                alt="Character standing"
                width={64}
                height={64}
                style={{ imageRendering: 'pixelated', objectFit: 'contain' }}
              />
            </div>
          )}
          <div className="w-24 h-16 pixel-border bg-white overflow-hidden flex-shrink-0 relative" data-ai-hint="game world preview">
             <Image
                src={game.worldBackgroundDataUri}
                alt="World preview"
                layout="fill"
                objectFit="cover"
                style={{ imageRendering: 'pixelated' }}
             />
          </div>
        </div>
        <div>
          <p className="text-xs text-muted-foreground mt-1 truncate" title={game.initialWorldDescription}>
            World: {game.initialWorldDescription}
          </p>
        </div>
      </CardContent>
      <CardFooter className="flex justify-between gap-2">
        <Button onClick={() => onPlay(game.id)} className="btn-pixel-primary flex-1">
          <Play size={16} className="mr-2" /> Play
        </Button>
        <Button onClick={() => onDelete(game.id)} variant="destructive" size="icon" className="btn-pixel flex-shrink-0 w-10 h-10">
          <Trash2 size={16} />
          <span className="sr-only">Delete</span>
        </Button>
      </CardFooter>
    </Card>
  );
}
