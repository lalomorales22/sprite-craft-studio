'use client';

import React, { useEffect, useState, useRef } from 'react';
import { useSearchParams, useRouter } from 'next/navigation'; // Import useRouter
import Image from 'next/image';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast'; // Import useToast
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
  const router = useRouter(); // Initialize useRouter
  const { toast } = useToast(); // Initialize useToast
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
    // console.log("Raw spritesParam from URL:", spritesParam); // Debug log

    if (spritesParam) {
      try {
        const parsedSprites: SpriteSlots = JSON.parse(spritesParam);
        // console.log("Parsed Sprites:", parsedSprites); // Debug log

        // Validate if all required sprites are present and are strings (data URIs)
        const requiredStates: SpriteState[] = ['standing', 'walkingLeft', 'walkingRight', 'running', 'jumping', 'crouching', 'sitting'];
        const missingStates = requiredStates.filter(state => !parsedSprites[state] || typeof parsedSprites[state] !== 'string');

        if (missingStates.length === 0) {
          setSpriteSlots(parsedSprites);
          // console.log("Successfully set sprite slots."); // Debug log
        } else {
          const errorMessage = `Missing or invalid sprite images for: ${missingStates.join(', ')}. Please go back and complete character assembly.`;
          setError(errorMessage);
          console.error(errorMessage); // Log error
          // Optionally redirect back immediately or show error message
           toast({ title: "Sprite Data Incomplete", description: errorMessage, variant: "destructive"});
           router.push('/'); // Redirect if data is invalid
        }
      } catch (e) {
        const errorMessage = 'Failed to parse sprite data. Please go back and try again.';
        console.error('Failed to parse sprites:', e);
        setError(errorMessage);
         toast({ title: "Data Error", description: errorMessage, variant: "destructive"});
         router.push('/'); // Redirect on parsing error
      }
    } else {
      const errorMessage = 'No sprite data found. Please create a character first.';
      setError(errorMessage);
      console.error(errorMessage); // Log error
       toast({ title: "No Data", description: errorMessage, variant: "destructive"});
       router.push('/'); // Redirect if no data found
    }
    setIsLoading(false);
  }, [searchParams, router, toast]); // Add router and toast to dependencies

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
    if (!spriteSlots || error) return; // Don't run game loop if no sprites or if there's an error

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
            // Don't reset state to standing here immediately, handle below based on priority
          }

          // Handle Jumping (W or Space or Up Arrow)
          if ((keysPressed.current['w'] || keysPressed.current[' '] || keysPressed.current['arrowup']) && !isJumping && y === GROUND_Y) { // Can only jump from ground
            vy = -JUMP_POWER;
            isJumping = true;
            state = 'jumping';
          }

          // Handle Crouching (S or Down Arrow) - only if not jumping
          isCrouching = (keysPressed.current['s'] || keysPressed.current['arrowdown']) && !isJumping;
           if (isCrouching) {
               vx = 0; // Stop horizontal movement while crouching
               // Don't set state here, handle below
           }
        }

        // Update position
        x += vx;
        y += vy;

        // Collision detection (simple ground)
        if (y >= GROUND_Y) {
          y = GROUND_Y;
          vy = 0;
          isJumping = false; // Landed
        }

         // World boundaries
         if (x < 0) x = 0;
         if (x > WORLD_WIDTH - 64) x = WORLD_WIDTH - 64; // Assuming character width is 64px


        // Determine final state based on priority (highest first)
        if (isSitting) {
            state = 'sitting';
        } else if (isJumping) {
            state = 'jumping';
        } else if (isCrouching) {
            state = 'crouching';
            vx = 0; // Ensure stopped while crouching
        } else if (vx !== 0) { // Moving horizontally
            if (direction === 'left') {
                state = isRunning ? (spriteSlots.running ? 'running' : 'walkingLeft') : 'walkingLeft'; // Use running if available, else walk
            } else { // direction === 'right'
                 state = isRunning ? (spriteSlots.running ? 'running' : 'walkingRight') : 'walkingRight'; // Use running if available, else walk
            }
        } else { // Not moving, not jumping, not crouching, not sitting
            state = 'standing';
        }


        return { ...prev, x, y, vx, vy, state, isJumping, isRunning, isCrouching, isSitting, direction };
      });
    }, 1000 / 60); // ~60 FPS

    return () => clearInterval(gameLoop);
  }, [spriteSlots, error]); // Re-run effect if spriteSlots change or error occurs


  const getCurrentSprite = () => {
     if (!spriteSlots) return null;

     let stateToUse = character.state;
     let spriteUrl = spriteSlots[stateToUse];
     let shouldMirror = false;

     // Handle running left: Use 'running' sprite and mirror it if no 'walkingLeft' exists for fallback
     if (stateToUse === 'running' && character.direction === 'left') {
         if (spriteSlots.running) { // Check if a generic running sprite exists
             spriteUrl = spriteSlots.running;
             shouldMirror = true; // Mirror the running sprite for left movement
         } else if (spriteSlots.walkingLeft) {
              spriteUrl = spriteSlots.walkingLeft; // Fallback to walking left if no running sprite
         } else {
              spriteUrl = spriteSlots.standing; // Ultimate fallback
         }
     } else if (stateToUse === 'walkingRight' && !spriteSlots.walkingRight && spriteSlots.walkingLeft) {
         // If walking right but no sprite, use walking left and mirror
         spriteUrl = spriteSlots.walkingLeft;
         shouldMirror = true;
     } else if (stateToUse === 'walkingLeft' && !spriteSlots.walkingLeft && spriteSlots.walkingRight) {
        // If walking left but no sprite, use walking right and mirror
        spriteUrl = spriteSlots.walkingRight;
        shouldMirror = true;
     }


     // Ensure fallback to standing if the determined state's sprite is missing
     if (!spriteUrl) {
         spriteUrl = spriteSlots.standing;
         shouldMirror = false; // Don't mirror standing sprite typically
     }

     return { url: spriteUrl, mirror: shouldMirror };
   };


  if (isLoading) {
    return <div className="flex items-center justify-center h-screen"><p>Loading World...</p></div>;
  }

   // Display error message and back button if an error occurred during setup
   if (error && !spriteSlots) {
     return (
       <div className="flex flex-col items-center justify-center h-screen text-center p-4">
         <h2 className="text-2xl font-bold text-destructive mb-4">Error Loading World</h2>
         <p className="mb-6">{error}</p>
         <Link href="/">
           <Button className="btn-pixel">
              <ArrowLeft className="mr-2 h-4 w-4" /> Go Back to Editor
           </Button>
         </Link>
       </div>
     );
   }

  // This state should ideally not be reached if redirection works, but acts as a safeguard
  if (!spriteSlots) {
     return <div className="flex items-center justify-center h-screen"><p>Initializing character...</p></div>;
   }


  const currentSpriteData = getCurrentSprite();

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
        data-ai-hint="simple pixel game background ground grass sky" // AI Hint for world background
      >
        {/* Simple Ground */}
         <div className="absolute bottom-0 left-0 w-full h-10 bg-yellow-800" style={{bottom: `${WORLD_HEIGHT - GROUND_Y - 40}px`}}/> {/* Adjust ground position visually */}
         {/* Simple Sky */}
         <div className="absolute top-0 left-0 w-full h-[calc(100%-40px)] bg-blue-300" style={{height: `${WORLD_HEIGHT - (WORLD_HEIGHT - GROUND_Y)}px`}}/>


        {/* Character */}
        {currentSpriteData?.url && (
           <div
            ref={characterRef}
            className="absolute transition-transform duration-75" // Simplified positioning logic slightly
            style={{
              left: `${character.x}px`,
              bottom: `${WORLD_HEIGHT - character.y - 64}px`, // Position based on bottom edge of sprite
              width: '64px',
              height: '64px',
              transform: currentSpriteData.mirror ? 'scaleX(-1)' : 'scaleX(1)', // Apply mirroring based on logic
              transformOrigin: 'center center',
            }}
          >
            <Image
              src={currentSpriteData.url}
              alt={`Character ${character.state}`}
              width={64}
              height={64}
              style={{ imageRendering: 'pixelated' }}
              unoptimized // Important for crisp pixel art without blurring
            />
          </div>
        )}

         {/* Instructions */}
         <div className="absolute top-2 right-2 bg-black/50 text-white p-2 text-xs pixel-border z-10">
            <p>Arrows/A/D: Move</p>
            <p>Space/W/Up: Jump</p>
            <p>Shift: Run</p>
            <p>S/Down: Crouch</p>
            <p>C/X: Sit/Stand</p>
         </div>
      </div>
    </div>
  );
}
