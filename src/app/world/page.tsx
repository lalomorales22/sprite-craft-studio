
'use client';

import React, { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation'; // Import useRouter
import Image from 'next/image';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast'; // Import useToast
import { ArrowLeft } from 'lucide-react';
import type { SpriteState, SpriteSlots } from '@/app/page'; // Import types from page.tsx

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
  const router = useRouter(); // Initialize useRouter
  const { toast } = useToast(); // Initialize useToast
  const [spriteSlots, setSpriteSlots] = useState<SpriteSlots | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const characterRef = useRef<HTMLDivElement>(null);
  const keysPressed = useRef<Record<string, boolean>>({});
  const gameLoopIntervalRef = useRef<NodeJS.Timeout | null>(null); // Ref for interval ID

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
    // This effect runs only once on mount to load data
    setIsLoading(true);
    setError(null); // Reset error on mount

    const spritesParam = sessionStorage.getItem('spriteData');
    // console.log("Raw spritesParam from sessionStorage:", spritesParam); // Debug log

    if (spritesParam) {
      try {
        const parsedSprites: SpriteSlots = JSON.parse(spritesParam);
        // console.log("Parsed Sprites:", parsedSprites); // Debug log

        const requiredStates: SpriteState[] = ['standing', 'walkingLeft', 'walkingRight', 'running', 'jumping', 'crouching', 'sitting'];
        const missingStates = requiredStates.filter(state => !parsedSprites[state] || typeof parsedSprites[state] !== 'string');

        if (missingStates.length === 0) {
          setSpriteSlots(parsedSprites);
          // console.log("Successfully set sprite slots."); // Debug log
        } else {
          const errorMessage = `Missing or invalid sprite images for: ${missingStates.join(', ')}. Please go back and complete character assembly.`;
          setError(errorMessage);
          console.error(errorMessage);
          toast({ title: "Sprite Data Incomplete", description: errorMessage, variant: "destructive", duration: 5000 });
          router.push('/'); // Redirect if data is invalid
        }
      } catch (e) {
        const errorMessage = 'Failed to parse sprite data. Please go back and try again.';
        console.error('Failed to parse sprites:', e);
        setError(errorMessage);
        toast({ title: "Data Error", description: errorMessage, variant: "destructive", duration: 5000 });
        router.push('/'); // Redirect on parsing error
      }
    } else {
      const errorMessage = 'No character data found. Please create a character first.';
      setError(errorMessage);
      console.error(errorMessage);
      toast({ title: "No Data", description: errorMessage, variant: "destructive", duration: 5000 });
      router.push('/'); // Redirect if no data found
    }
    setIsLoading(false);
  }, [router, toast]); // Add router and toast to dependencies

  // Keyboard event listeners
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
        // Ignore key events if input/textarea is focused
        if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) {
            return;
        }
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
       // Clear interval on unmount
       if (gameLoopIntervalRef.current) {
         clearInterval(gameLoopIntervalRef.current);
       }
       // Clear keys pressed on unmount
       keysPressed.current = {};
    };
  }, []); // Empty dependency array means this runs once on mount and cleanup on unmount

  // Game loop for movement and physics
  useEffect(() => {
    // Only start the game loop if sprites are loaded and there's no error
    if (!spriteSlots || error || isLoading) {
        // If there was a running loop, clear it
        if (gameLoopIntervalRef.current) {
            clearInterval(gameLoopIntervalRef.current);
            gameLoopIntervalRef.current = null;
        }
        return; // Exit if prerequisites not met
    }

    // Start the game loop only if it's not already running
    if (!gameLoopIntervalRef.current) {
        gameLoopIntervalRef.current = setInterval(() => {
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

            // Check if crouched - prevent horizontal movement if so
            isCrouching = (keysPressed.current['s'] || keysPressed.current['arrowdown']) && !isJumping;

            if (!isCrouching) {
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
            } else {
                vx = 0; // Force stop horizontal movement if crouching
            }


            // Handle Jumping (W or Space or Up Arrow)
            if ((keysPressed.current['w'] || keysPressed.current[' '] || keysPressed.current['arrowup']) && !isJumping && !isCrouching && y === GROUND_Y) { // Can only jump from ground if not crouching
                vy = -JUMP_POWER;
                isJumping = true;
                state = 'jumping';
            }

            // Handle Crouching (already determined above)
            if (isCrouching) {
                vx = 0; // Ensure stopped while crouching
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
    }


    // Cleanup function for this effect
    return () => {
        if (gameLoopIntervalRef.current) {
            clearInterval(gameLoopIntervalRef.current);
            gameLoopIntervalRef.current = null;
        }
    };
  }, [spriteSlots, error, isLoading]); // Re-run effect if spriteSlots, error, or isLoading change


  const getCurrentSprite = () => {
     if (!spriteSlots) return null;

     let stateToUse = character.state;
     let spriteUrl = spriteSlots[stateToUse];
     let shouldMirror = false;

      // Handle running left: Use 'running' sprite and mirror it
     if (stateToUse === 'running' && character.direction === 'left') {
         if (spriteSlots.running) {
             spriteUrl = spriteSlots.running;
             shouldMirror = true; // Mirror the running sprite for left movement
         } else {
             // Fallback if no running sprite: Use walkingLeft or standing
             spriteUrl = spriteSlots.walkingLeft || spriteSlots.standing;
             shouldMirror = false; // Don't mirror walkingLeft or standing
         }
     }
     // Handle running right: Use 'running' sprite (no mirror)
     else if (stateToUse === 'running' && character.direction === 'right') {
          if (spriteSlots.running) {
              spriteUrl = spriteSlots.running;
              shouldMirror = false;
          } else {
              // Fallback if no running sprite: Use walkingRight or standing
              spriteUrl = spriteSlots.walkingRight || spriteSlots.standing;
              shouldMirror = false; // Don't mirror walkingRight or standing
          }
      }
     // Handle walking right when only walking left exists
     else if (stateToUse === 'walkingRight' && !spriteSlots.walkingRight && spriteSlots.walkingLeft) {
         spriteUrl = spriteSlots.walkingLeft;
         shouldMirror = true;
     }
     // Handle walking left when only walking right exists
      else if (stateToUse === 'walkingLeft' && !spriteSlots.walkingLeft && spriteSlots.walkingRight) {
         spriteUrl = spriteSlots.walkingRight;
         shouldMirror = true;
      }


     // Ensure fallback to standing if the determined state's sprite is missing
     if (!spriteUrl) {
         console.warn(`Sprite for state "${stateToUse}" is missing. Falling back to "standing".`);
         spriteUrl = spriteSlots.standing;
         shouldMirror = false; // Don't mirror standing sprite typically
     }

     // Final check for standing sprite
     if (!spriteUrl) {
         console.error("Critical error: Standing sprite is missing!");
         return null; // Or some default placeholder
     }

     return { url: spriteUrl, mirror: shouldMirror };
   };


  if (isLoading) {
    return <div className="flex items-center justify-center h-screen"><p>Loading World...</p></div>;
  }

   // Display error message and back button if an error occurred during setup (and loading is finished)
   if (error && !spriteSlots && !isLoading) {
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

  // Safeguard check if spriteSlots are somehow still null after loading and no error
  if (!spriteSlots && !isLoading) {
     console.error("World loaded but sprite slots are still null without an error.");
     // Redirect or show a generic error
     if (!error) { // Avoid double toast/redirect if error already handled
       toast({ title: "Initialization Error", description: "Character data failed to load correctly.", variant: "destructive", duration: 5000 });
       router.push('/');
     }
     return <div className="flex items-center justify-center h-screen"><p>Failed to initialize character.</p></div>;
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
        className="relative border-4 border-black bg-blue-300 overflow-hidden" // Simple blue sky background, overflow hidden
        style={{ width: `${WORLD_WIDTH}px`, height: `${WORLD_HEIGHT}px`, imageRendering: 'pixelated' }}
        data-ai-hint="simple pixel game background ground grass sky" // AI Hint for world background
      >
        {/* Simple Ground */}
         <div
            className="absolute bottom-0 left-0 w-full bg-yellow-800 border-t-4 border-black" // Brown ground with black top border
            style={{ height: `${WORLD_HEIGHT - GROUND_Y}px` }} // Ground fills from GROUND_Y down
         />


        {/* Character */}
        {/* Ensure character is rendered only if sprite data is valid */}
        {currentSpriteData?.url && (
           <div
            ref={characterRef}
            className="absolute" // Using bottom/left for positioning
            style={{
              left: `${character.x}px`,
              bottom: `${WORLD_HEIGHT - character.y - 64}px`, // Position based on bottom edge of sprite (y=0 is top)
              width: '64px',
              height: '64px',
              transform: currentSpriteData.mirror ? 'scaleX(-1)' : 'scaleX(1)',
              transformOrigin: 'center center',
              transition: 'transform 0.05s linear', // Smooth mirroring transition
              willChange: 'transform, left, bottom', // Optimize rendering
            }}
          >
            <Image
              src={currentSpriteData.url}
              alt={`Character ${character.state}`}
              width={64}
              height={64}
              style={{ imageRendering: 'pixelated' }}
              unoptimized // Important for crisp pixel art without blurring
              priority // Prioritize loading character image
            />
          </div>
        )}

         {/* Instructions */}
         <div className="absolute top-2 right-2 bg-black/70 text-white p-2 text-xs pixel-border z-10 leading-tight">
            <p className='font-bold mb-1'>Controls:</p>
            <p>←/A | →/D: Move</p>
            <p>↑/W/Space: Jump</p>
            <p>Shift: Run</p>
            <p>↓/S: Crouch</p>
            <p>C | X: Sit/Stand</p>
         </div>
      </div>
    </div>
  );
}
