
'use client';

import React, { useEffect, useState, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';

// Define types for sprite states and slots
type SpriteState = 'standing' | 'walkingLeft' | 'walkingRight' | 'running' | 'jumping' | 'crouching' | 'sitting';
type SpriteSlots = {
  [key in SpriteState]: string | null;
};

// Define character state
interface CharacterState {
  x: number;
  y: number;
  vx: number; // Velocity x
  vy: number; // Velocity y
  state: SpriteState;
  isJumping: boolean;
  isRunning: boolean;
  isCrouching: boolean;
  isSitting: boolean;
  direction: 'left' | 'right';
}

const GRAVITY = 0.5;
const MOVE_SPEED = 3;
const RUN_SPEED = 6;
const JUMP_POWER = 10;
const GROUND_Y = 300; // Adjust as needed based on world background
const WORLD_WIDTH = 800; // Example world width
const WORLD_HEIGHT = 400; // Example world height

export default function WorldPage() {
  const searchParams = useSearchParams();
  const [spriteSlots, setSpriteSlots] = useState<SpriteSlots | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const characterRef = useRef<HTMLDivElement>(null);
  const keysPressed = useRef<Record<string, boolean>>({});

  const [character, setCharacter] = useState<CharacterState>({
    x: WORLD_WIDTH / 2,
    y: GROUND_Y,
    vx: 0,
    vy: 0,
    state: 'standing',
    isJumping: false,
    isRunning: false,
    isCrouching: false,
    isSitting: false,
    direction: 'right',
  });

  useEffect(() => {
    const spritesParam = searchParams.get('sprites');
    if (spritesParam) {
      try {
        const parsedSprites: SpriteSlots = JSON.parse(spritesParam);
        // Validate if all required sprites are present
        const requiredStates: SpriteState[] = ['standing', 'walkingLeft', 'walkingRight', 'running', 'jumping', 'crouching', 'sitting'];
        const allPresent = requiredStates.every(state => parsedSprites[state]);

        if (allPresent) {
          setSpriteSlots(parsedSprites);
        } else {
          setError('Missing required sprite images. Please go back and complete character assembly.');
        }
      } catch (e) {
        console.error('Failed to parse sprites:', e);
        setError('Invalid sprite data received. Please go back and try again.');
      }
    } else {
      setError('No sprite data found. Please create a character first.');
    }
    setIsLoading(false);
  }, [searchParams]);

  // Keyboard event listeners
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      keysPressed.current[event.key.toLowerCase()] = true;

      // Handle sitting toggle with 'c' or 'x' (allow getting up)
      if (event.key.toLowerCase() === 'c' || event.key.toLowerCase() === 'x') {
         setCharacter(prev => ({...prev, isSitting: !prev.isSitting, isCrouching: false, vx: 0})); // Stop movement when sitting/unsitting
      }
    };
    const handleKeyUp = (event: KeyboardEvent) => {
      keysPressed.current[event.key.toLowerCase()] = false;
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  // Game loop for movement and physics
  useEffect(() => {
    if (!spriteSlots) return; // Don't run game loop if no sprites

    const gameLoop = setInterval(() => {
      setCharacter(prev => {
        let { x, y, vx, vy, state, isJumping, isRunning, isCrouching, isSitting, direction } = prev;

        // Reset velocity if sitting
        if (isSitting) {
          vx = 0;
          vy = 0; // No gravity while sitting
          state = 'sitting';
        } else {
          // Apply gravity
          vy += GRAVITY;

          // Handle horizontal movement (A/D or Left/Right Arrows)
          isRunning = keysPressed.current['shift'] === true;
          const currentSpeed = isRunning ? RUN_SPEED : MOVE_SPEED;

          if (keysPressed.current['a'] || keysPressed.current['arrowleft']) {
            vx = -currentSpeed;
            direction = 'left';
            state = isRunning ? 'running' : 'walkingLeft';
          } else if (keysPressed.current['d'] || keysPressed.current['arrowright']) {
            vx = currentSpeed;
            direction = 'right';
            state = isRunning ? 'running' : 'walkingRight'; // Use walkingRight for running right visually if no specific run right sprite
          } else {
            vx = 0;
            state = 'standing'; // Default to standing if no movement keys
          }

          // Handle Jumping (W or Space or Up Arrow)
          if ((keysPressed.current['w'] || keysPressed.current[' '] || keysPressed.current['arrowup']) && !isJumping) {
            vy = -JUMP_POWER;
            isJumping = true;
            state = 'jumping';
          }

          // Handle Crouching (S or Down Arrow) - only if not jumping
          isCrouching = (keysPressed.current['s'] || keysPressed.current['arrowdown']) && !isJumping;
           if (isCrouching) {
               vx = 0; // Stop horizontal movement while crouching
               state = 'crouching';
           }
        }

        // Update position
        x += vx;
        y += vy;

        // Collision detection (simple ground)
        if (y >= GROUND_Y) {
          y = GROUND_Y;
          vy = 0;
          if (isJumping) {
             isJumping = false;
             // If movement keys still held, resume walking/running state
             if (keysPressed.current['a'] || keysPressed.current['arrowleft']) {
                 state = isRunning ? 'running' : 'walkingLeft';
             } else if (keysPressed.current['d'] || keysPressed.current['arrowright']) {
                  state = isRunning ? 'running' : 'walkingRight';
             } else if (keysPressed.current['s'] || keysPressed.current['arrowdown']) {
                 state = 'crouching';
             } else if (isSitting) { // Check sitting state after landing
                 state = 'sitting';
             }
             else {
                  state = 'standing';
             }
          } else if (!isSitting && !isCrouching && vx === 0) { // Only go to standing if not moving, sitting or crouching
               state = 'standing';
          }
        }

         // World boundaries
         if (x < 0) x = 0;
         if (x > WORLD_WIDTH - 64) x = WORLD_WIDTH - 64; // Assuming character width is 64px


        // Final state determination based on priority
        if (isSitting) state = 'sitting';
        else if (isJumping) state = 'jumping';
        else if (isCrouching) state = 'crouching';
        else if (vx !== 0) {
            if(direction === 'left') state = isRunning ? 'running' : 'walkingLeft'; // Separate running left if available
            else state = isRunning ? 'running' : 'walkingRight';
            // If you add a specific 'runningLeft' sprite, adjust logic here
             if (isRunning && direction === 'left' && spriteSlots.running) { // Assuming 'running' slot covers both directions or just right
                state = 'running'; // If you have a specific running left, change here
             }
        }
        else state = 'standing';


        return { ...prev, x, y, vx, vy, state, isJumping, isRunning, isCrouching, isSitting, direction };
      });
    }, 1000 / 60); // ~60 FPS

    return () => clearInterval(gameLoop);
  }, [spriteSlots]); // Re-run effect if spriteSlots change

  const getCurrentSprite = () => {
    if (!spriteSlots) return null;

    let stateToUse = character.state;

    // Special handling for running left if separate sprite exists or needs mirroring
    if (stateToUse === 'running' && character.direction === 'left' && spriteSlots.walkingLeft) {
       // If no specific runningLeft sprite, maybe reuse walkingLeft or mirror running
       return spriteSlots.walkingLeft; // Using walkingLeft as a placeholder for running left
    }
    if(stateToUse === 'running' && spriteSlots.running) { // If running state is set, use the running sprite (assuming it's for right or general)
        return spriteSlots.running;
    }
    if(stateToUse === 'walkingLeft' && spriteSlots.walkingLeft) return spriteSlots.walkingLeft;
    if(stateToUse === 'walkingRight' && spriteSlots.walkingRight) return spriteSlots.walkingRight;


    return spriteSlots[stateToUse] || spriteSlots.standing; // Fallback to standing
  };


  if (isLoading) {
    return <div className="flex items-center justify-center h-screen"><p>Loading World...</p></div>;
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-screen text-center p-4">
        <h2 className="text-2xl font-bold text-destructive mb-4">Error</h2>
        <p className="mb-6">{error}</p>
        <Link href="/">
          <Button className="btn-pixel">
             <ArrowLeft className="mr-2 h-4 w-4" /> Go Back to Editor
          </Button>
        </Link>
      </div>
    );
  }

  if (!spriteSlots) {
    // This case should ideally be covered by the error state, but added for safety
     return (
      <div className="flex flex-col items-center justify-center h-screen text-center p-4">
        <h2 className="text-2xl font-bold text-destructive mb-4">Character Data Missing</h2>
        <p className="mb-6">Could not load character sprites.</p>
        <Link href="/">
          <Button className="btn-pixel">
             <ArrowLeft className="mr-2 h-4 w-4" /> Go Back to Editor
          </Button>
        </Link>
      </div>
    );
  }

  const currentSpriteUrl = getCurrentSprite();

  return (
    <div className="flex flex-col items-center justify-center h-screen bg-gray-700 relative overflow-hidden">
        <Link href="/" className="absolute top-4 left-4 z-20">
          <Button className="btn-pixel-secondary">
            <ArrowLeft className="mr-2 h-4 w-4" /> Back to Editor
          </Button>
        </Link>
      <div
        className="relative border-4 border-black bg-green-300" // Simple green background for the world
        style={{ width: `${WORLD_WIDTH}px`, height: `${WORLD_HEIGHT}px`, imageRendering: 'pixelated' }}
        data-ai-hint="simple pixel game background ground grass" // AI Hint for world background
      >
        {/* Add world elements here later, e.g., platforms, background details */}
         <div className="absolute bottom-0 left-0 w-full h-10 bg-yellow-800" /> {/* Simple ground */}

        {/* Character */}
        {currentSpriteUrl && (
           <div
            ref={characterRef}
            className="absolute bottom-0 transition-transform duration-75" // Position relative to bottom, adjust based on GROUND_Y
            style={{
              left: `${character.x}px`,
              bottom: `${WORLD_HEIGHT - character.y - 64}px`, // Adjust 64 based on sprite height
              width: '64px', // Set fixed size for container
              height: '64px',
              transform: character.state === 'running' && character.direction === 'left' ? 'scaleX(-1)' : 'scaleX(1)', // Mirror running sprite if needed and no walkingLeft available
            }}
          >
            <Image
              src={currentSpriteUrl}
              alt={`Character ${character.state}`}
              width={64}
              height={64}
              style={{ imageRendering: 'pixelated' }}
              unoptimized // Important for crisp pixel art without blurring
            />
          </div>
        )}

         {/* Instructions */}
         <div className="absolute top-2 right-2 bg-black/50 text-white p-2 text-xs pixel-border">
            <p>WASD/Arrows: Move</p>
            <p>Space/W/Up: Jump</p>
            <p>Shift: Run</p>
            <p>S/Down: Crouch</p>
            <p>C/X: Sit/Stand</p> {/* Changed 'Sit' to 'Armchair' conceptually */}
         </div>
      </div>
    </div>
  );
}
