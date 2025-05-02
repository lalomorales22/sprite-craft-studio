
'use client';

import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation'; // Import useRouter
import Image from 'next/image';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input'; // Import Input
import { Label } from '@/components/ui/label'; // Import Label
import { useToast } from '@/hooks/use-toast'; // Import useToast
import { ArrowLeft, Download, Image as ImageIcon, Sparkles } from 'lucide-react'; // Added Download, ImageIcon, Sparkles
import { generateWorldBackground } from '@/ai/flows/generate-world-background'; // Import the new flow
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

  const [worldDescription, setWorldDescription] = useState('');
  const [generatedWorldBackground, setGeneratedWorldBackground] = useState<string | null>(null);
  const [isGeneratingWorld, setIsGeneratingWorld] = useState(false);

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

  // Load sprite data from sessionStorage
  useEffect(() => {
    // This effect runs only once on mount to load data
    setIsLoading(true);
    setError(null); // Reset error on mount

    const spritesParam = sessionStorage.getItem('spriteData');

    if (spritesParam) {
      try {
        const parsedSprites: SpriteSlots = JSON.parse(spritesParam);
        const requiredStates: SpriteState[] = ['standing', 'walkingLeft', 'walkingRight', 'running', 'jumping', 'crouching', 'sitting'];
        const missingStates = requiredStates.filter(state => !parsedSprites[state] || typeof parsedSprites[state] !== 'string');

        if (missingStates.length === 0) {
          setSpriteSlots(parsedSprites);
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
        if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) {
            return;
        }
      keysPressed.current[event.key.toLowerCase()] = true;
      if (event.key.toLowerCase() === 'c' || event.key.toLowerCase() === 'x') {
         setCharacter(prev => ({...prev, isSitting: !prev.isSitting, isCrouching: false, vx: 0}));
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
       if (gameLoopIntervalRef.current) {
         clearInterval(gameLoopIntervalRef.current);
       }
       keysPressed.current = {};
    };
  }, []);

  // Game loop for movement and physics
  useEffect(() => {
    if (!spriteSlots || error || isLoading) {
        if (gameLoopIntervalRef.current) {
            clearInterval(gameLoopIntervalRef.current);
            gameLoopIntervalRef.current = null;
        }
        return;
    }

    if (!gameLoopIntervalRef.current) {
        gameLoopIntervalRef.current = setInterval(() => {
            setCharacter(prev => {
            let { x, y, vx, vy, state, isJumping, isRunning, isCrouching, isSitting, direction } = prev;

            if (isSitting) {
                vx = 0;
                vy = 0;
                state = 'sitting';
            } else {
                vy += GRAVITY;
                isRunning = keysPressed.current['shift'] === true;
                const currentSpeed = isRunning ? RUN_SPEED : MOVE_SPEED;
                isCrouching = (keysPressed.current['s'] || keysPressed.current['arrowdown']) && !isJumping;

                if (!isCrouching) {
                    if (keysPressed.current['a'] || keysPressed.current['arrowleft']) {
                        vx = -currentSpeed;
                        direction = 'left';
                        state = isRunning ? 'running' : 'walkingLeft';
                    } else if (keysPressed.current['d'] || keysPressed.current['arrowright']) {
                        vx = currentSpeed;
                        direction = 'right';
                        state = isRunning ? 'running' : 'walkingRight';
                    } else {
                        vx = 0;
                    }
                } else {
                    vx = 0;
                }

                if ((keysPressed.current['w'] || keysPressed.current[' '] || keysPressed.current['arrowup']) && !isJumping && !isCrouching && y === GROUND_Y) {
                    vy = -JUMP_POWER;
                    isJumping = true;
                    state = 'jumping';
                }

                if (isCrouching) {
                    vx = 0;
                }
            }

            x += vx;
            y += vy;

            if (y >= GROUND_Y) {
                y = GROUND_Y;
                vy = 0;
                isJumping = false;
            }

            if (x < 0) x = 0;
            if (x > WORLD_WIDTH - 64) x = WORLD_WIDTH - 64;

            if (isSitting) {
                state = 'sitting';
            } else if (isJumping) {
                state = 'jumping';
            } else if (isCrouching) {
                state = 'crouching';
                vx = 0;
            } else if (vx !== 0) {
                if (direction === 'left') {
                    state = isRunning ? (spriteSlots.running ? 'running' : 'walkingLeft') : 'walkingLeft';
                } else {
                    state = isRunning ? (spriteSlots.running ? 'running' : 'walkingRight') : 'walkingRight';
                }
            } else {
                state = 'standing';
            }

            return { ...prev, x, y, vx, vy, state, isJumping, isRunning, isCrouching, isSitting, direction };
            });
        }, 1000 / 60);
    }

    return () => {
        if (gameLoopIntervalRef.current) {
            clearInterval(gameLoopIntervalRef.current);
            gameLoopIntervalRef.current = null;
        }
    };
  }, [spriteSlots, error, isLoading]);

  const getCurrentSprite = useCallback(() => {
     if (!spriteSlots) return null;

     let stateToUse = character.state;
     let spriteUrl = spriteSlots[stateToUse];
     let shouldMirror = false;

      if (stateToUse === 'running' && character.direction === 'left') {
         if (spriteSlots.running) {
             spriteUrl = spriteSlots.running;
             shouldMirror = true;
         } else {
             spriteUrl = spriteSlots.walkingLeft || spriteSlots.standing;
             shouldMirror = false;
         }
     }
     else if (stateToUse === 'running' && character.direction === 'right') {
          if (spriteSlots.running) {
              spriteUrl = spriteSlots.running;
              shouldMirror = false;
          } else {
              spriteUrl = spriteSlots.walkingRight || spriteSlots.standing;
              shouldMirror = false;
          }
      }
     else if (stateToUse === 'walkingRight' && !spriteSlots.walkingRight && spriteSlots.walkingLeft) {
         spriteUrl = spriteSlots.walkingLeft;
         shouldMirror = true;
     }
      else if (stateToUse === 'walkingLeft' && !spriteSlots.walkingLeft && spriteSlots.walkingRight) {
         spriteUrl = spriteSlots.walkingRight;
         shouldMirror = true;
      }

     if (!spriteUrl) {
         console.warn(`Sprite for state "${stateToUse}" is missing. Falling back to "standing".`);
         spriteUrl = spriteSlots.standing;
         shouldMirror = false;
     }

     if (!spriteUrl) {
         console.error("Critical error: Standing sprite is missing!");
         return null;
     }

     return { url: spriteUrl, mirror: shouldMirror };
   }, [character.state, character.direction, spriteSlots]);

  const handleGenerateWorld = async () => {
    if (!worldDescription) {
        toast({title: "Missing Description", description: "Please describe the world you want to create.", variant: "destructive"});
        return;
    }
    setIsGeneratingWorld(true);
    setGeneratedWorldBackground(null);
    try {
        const result = await generateWorldBackground({description: worldDescription});
        setGeneratedWorldBackground(result.worldImageDataUri);
        toast({title: "World Background Generated!", description: "The AI has created a background for your world."});
    } catch (error) {
        console.error("Error generating world background:", error);
        toast({title: "Generation Failed", description: `Could not generate the world background. ${error instanceof Error ? error.message : 'Please try again.'}`, variant: "destructive"});
    } finally {
        setIsGeneratingWorld(false);
    }
  };

   // Function to handle game export
  const handleExportGame = () => {
    if (!spriteSlots || !generatedWorldBackground) {
      toast({ title: "Missing Assets", description: "Ensure you have character poses and a generated world background.", variant: "destructive" });
      return;
    }

    try {
      // 1. Combine data into a single object
      const gameData = {
        sprites: spriteSlots,
        worldBackground: generatedWorldBackground,
        // Add other relevant game state if needed (e.g., initial character position)
      };

      // 2. Create a Blob from the JSON data
      const gameDataString = JSON.stringify(gameData, null, 2); // Pretty print JSON
      const blob = new Blob([gameDataString], { type: 'application/json' });

      // 3. Create a downloadable link
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'spritecraft_game_data.json'; // Filename for the download
      document.body.appendChild(link);
      link.click();

      // 4. Clean up
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast({ title: "Game Data Exported!", description: "Your character and world data have been saved to a JSON file." });

    } catch (error) {
      console.error("Error exporting game data:", error);
      toast({ title: "Export Failed", description: "Could not export game data.", variant: "destructive" });
    }
  };


  if (isLoading) {
    return <div className="flex items-center justify-center h-screen"><p>Loading World...</p></div>;
  }

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

  if (!spriteSlots && !isLoading) {
     console.error("World loaded but sprite slots are still null without an error.");
     if (!error) {
       toast({ title: "Initialization Error", description: "Character data failed to load correctly.", variant: "destructive", duration: 5000 });
       router.push('/');
     }
     return <div className="flex items-center justify-center h-screen"><p>Failed to initialize character.</p></div>;
   }


  const currentSpriteData = getCurrentSprite();

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-800 p-4 relative">
        {/* Back Button */}
        <Link href="/" className="absolute top-4 left-4 z-30">
          <Button className="btn-pixel-secondary">
            <ArrowLeft className="mr-2 h-4 w-4" /> Back to Editor
          </Button>
        </Link>

        {/* World Generation Controls */}
        <div className="mb-4 p-4 pixel-border bg-card text-card-foreground w-full max-w-3xl flex flex-col sm:flex-row gap-2 items-center z-20">
            <Label htmlFor="world-description" className="flex-shrink-0 mr-2 font-semibold">World Prompt:</Label>
            <Input
                id="world-description"
                type="text"
                value={worldDescription}
                onChange={(e) => setWorldDescription(e.target.value)}
                placeholder="e.g., magical forest, futuristic city ruins, lava cave"
                className="input-pixel flex-grow"
                disabled={isGeneratingWorld}
            />
            <Button
                onClick={handleGenerateWorld}
                disabled={isGeneratingWorld || !worldDescription}
                className="btn-pixel flex-shrink-0"
            >
                 {isGeneratingWorld ? (
                 <>
                   <svg className="animate-spin -ml-1 mr-3 h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                     <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                     <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                   </svg>
                   Generating...
                 </>
               ) : (
                 <>
                   <Sparkles size={16} className="mr-1"/>
                   Generate World
                 </>
               )}
            </Button>
        </div>


      {/* Game Area */}
      <div
        className="relative border-4 border-black overflow-hidden"
        style={{
            width: `${WORLD_WIDTH}px`,
            height: `${WORLD_HEIGHT}px`,
            imageRendering: 'pixelated',
            // Default background in case image fails or isn't generated yet
            backgroundColor: 'hsl(var(--background))', // Use theme background
         }}
        data-ai-hint="simple pixel game background ground grass sky"
      >
         {/* Generated World Background */}
         {generatedWorldBackground ? (
              <Image
                src={generatedWorldBackground}
                alt="Generated World Background"
                layout="fill" // Fill the container
                objectFit="cover" // Cover the area, might crop
                style={{ imageRendering: 'pixelated', zIndex: 0 }}
                unoptimized
                priority
              />
          ) : (
             <>
                 {/* Simple Fallback Ground/Sky */}
                 <div className="absolute inset-0 bg-blue-300 z-0"></div>
                 <div
                    className="absolute bottom-0 left-0 w-full bg-yellow-800 border-t-4 border-black z-0"
                    style={{ height: `${WORLD_HEIGHT - GROUND_Y}px` }}
                 />
             </>
          )}


        {/* Character */}
        {currentSpriteData?.url && (
           <div
            ref={characterRef}
            className="absolute z-10" // Character above background
            style={{
              left: `${character.x}px`,
              bottom: `${WORLD_HEIGHT - character.y - 64}px`,
              width: '64px',
              height: '64px',
              transform: currentSpriteData.mirror ? 'scaleX(-1)' : 'scaleX(1)',
              transformOrigin: 'center center',
              transition: 'transform 0.05s linear',
              willChange: 'transform, left, bottom',
            }}
          >
            <Image
              src={currentSpriteData.url}
              alt={`Character ${character.state}`}
              width={64}
              height={64}
              style={{ imageRendering: 'pixelated' }}
              unoptimized
              priority
            />
          </div>
        )}

         {/* Instructions */}
         <div className="absolute top-2 right-2 bg-black/70 text-white p-2 text-xs pixel-border z-20 leading-tight">
            <p className='font-bold mb-1'>Controls:</p>
            <p>←/A | →/D: Move</p>
            <p>↑/W/Space: Jump</p>
            <p>Shift: Run</p>
            <p>↓/S: Crouch</p>
            <p>C | X: Sit/Stand</p>
         </div>
      </div>

       {/* Export Button */}
        <div className="mt-4 z-20">
          <Button
            onClick={handleExportGame}
            disabled={!spriteSlots || !generatedWorldBackground}
            className="btn-pixel-accent"
            aria-disabled={!spriteSlots || !generatedWorldBackground}
          >
            <Download size={16} className="mr-2" />
            Export Game Data
          </Button>
        </div>
    </div>
  );
}
