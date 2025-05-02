
'use client';

import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation'; // Import useRouter
import Image from 'next/image';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input'; // Import Input
import { Label } from '@/components/ui/label'; // Import Label
import { useToast } from '@/hooks/use-toast'; // Import useToast
import { ArrowLeft, Download, Image as ImageIcon, Sparkles, ArrowRight } from 'lucide-react'; // Added Download, ImageIcon, Sparkles, ArrowRight
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
const CHARACTER_WIDTH = 64; // Assuming character width is 64px
const TRANSITION_THRESHOLD = WORLD_WIDTH - CHARACTER_WIDTH; // Point where transition starts

export default function WorldPage() {
  const router = useRouter(); // Initialize useRouter
  const { toast } = useToast(); // Initialize useToast
  const [spriteSlots, setSpriteSlots] = useState<SpriteSlots | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const characterRef = useRef<HTMLDivElement>(null);
  const keysPressed = useRef<Record<string, boolean>>({});
  const gameLoopIntervalRef = useRef<NodeJS.Timeout | null>(null); // Ref for interval ID
  const isTransitioningRef = useRef(false); // Ref to prevent multiple transitions

  const [initialWorldDescription, setInitialWorldDescription] = useState(''); // For the input field
  const [currentWorldDescription, setCurrentWorldDescription] = useState(''); // For regeneration
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
         // Toggle sitting only if on the ground
         setCharacter(prev => (prev.y === GROUND_Y ? {...prev, isSitting: !prev.isSitting, isCrouching: false, vx: 0} : prev));
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


  // Function to generate world background, now using currentWorldDescription
  const handleGenerateWorld = useCallback(async (description: string) => {
    if (!description) {
      toast({ title: "Missing Description", description: "Cannot generate world without a description.", variant: "destructive" });
      return false; // Indicate failure
    }
    setIsGeneratingWorld(true);
    // Keep the old background while generating for smoother transition? Or clear it?
    // setGeneratedWorldBackground(null); // Option: Clear immediately
    try {
      const result = await generateWorldBackground({ description: description });
      setGeneratedWorldBackground(result.worldImageDataUri);
      setCurrentWorldDescription(description); // Update the current description used for regeneration
      if (!initialWorldDescription) { // Set initial only once
          setInitialWorldDescription(description);
      }
      toast({ title: "World Background Generated!", description: "The AI has created a background." });
      return true; // Indicate success
    } catch (error) {
      console.error("Error generating world background:", error);
      toast({ title: "Generation Failed", description: `Could not generate world background. ${error instanceof Error ? error.message : 'Try again.'}`, variant: "destructive" });
      return false; // Indicate failure
    } finally {
      setIsGeneratingWorld(false);
    }
  }, [toast, initialWorldDescription]); // Depend on toast and initial description state


  // Game loop for movement, physics, and transitions
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
            if (isTransitioningRef.current) return; // Skip updates during transition

            setCharacter(prev => {
                let { x, y, vx, vy, state, isJumping, isRunning, isCrouching, isSitting, direction } = prev;

                // --- Vertical Movement (Gravity & Jumping) ---
                vy += GRAVITY;
                y += vy;

                // Ground collision
                if (y >= GROUND_Y) {
                    y = GROUND_Y;
                    vy = 0;
                    if (isJumping) isJumping = false; // Landed
                }

                // --- Horizontal Movement & State ---
                isRunning = keysPressed.current['shift'] === true;
                const currentSpeed = isRunning ? RUN_SPEED : MOVE_SPEED;

                // Handle Sitting state (only on ground)
                if (isSitting && y !== GROUND_Y) {
                    isSitting = false; // Force stand up if not on ground
                }

                // Handle Crouching state (only on ground)
                isCrouching = (keysPressed.current['s'] || keysPressed.current['arrowdown']) && !isJumping && !isSitting && y === GROUND_Y;

                if (isSitting) {
                    vx = 0; // No movement while sitting
                    state = 'sitting';
                } else if (isCrouching) {
                    vx = 0; // No movement while crouching
                    state = 'crouching';
                } else {
                    // Horizontal input
                    if (keysPressed.current['a'] || keysPressed.current['arrowleft']) {
                        vx = -currentSpeed;
                        direction = 'left';
                    } else if (keysPressed.current['d'] || keysPressed.current['arrowright']) {
                        vx = currentSpeed;
                        direction = 'right';
                    } else {
                        vx = 0; // No horizontal input
                    }

                    // Jump input (only if on ground and not sitting/crouching)
                    if ((keysPressed.current['w'] || keysPressed.current[' '] || keysPressed.current['arrowup']) && !isJumping && y === GROUND_Y) {
                        vy = -JUMP_POWER;
                        isJumping = true;
                    }
                }

                // Apply horizontal movement
                x += vx;

                // --- World Boundaries & Transitions ---
                if (x < 0) {
                    x = 0; // Stop at left edge
                    vx = 0;
                } else if (x > TRANSITION_THRESHOLD) {
                    // Trigger Transition to next level
                    x = TRANSITION_THRESHOLD; // Temporarily stop at edge
                    vx = 0;
                    if (!isTransitioningRef.current && generatedWorldBackground && currentWorldDescription) {
                        isTransitioningRef.current = true; // Prevent multiple triggers
                        console.log("Transitioning to next level...");
                        toast({ title: "Moving to next area...", description: "Generating new background..." });

                        // Generate new world and handle reset in async way
                        handleGenerateWorld(currentWorldDescription + " continue the scene to the right, showing a connected area")
                            .then((success) => {
                                if (success) {
                                    console.log("New world generated, resetting character position.");
                                    // Reset character to the left side after new world is ready
                                    setCharacter(prevChar => ({
                                        ...prevChar,
                                        x: 10, // Start slightly in from the left edge
                                        y: GROUND_Y, // Ensure on ground
                                        vx: 0,
                                        vy: 0,
                                        isJumping: false,
                                        state: 'standing' // Reset state
                                    }));
                                } else {
                                    // Handle generation failure - maybe stay in current level?
                                    console.error("Failed to generate next level background.");
                                     setCharacter(prevChar => ({ ...prevChar, x: TRANSITION_THRESHOLD -1 })); // Move back slightly if failed
                                }
                            })
                            .finally(() => {
                                isTransitioningRef.current = false; // Allow updates and transitions again
                            });
                    }
                }

                // --- Determine final animation state ---
                if (isSitting) {
                    state = 'sitting';
                } else if (isJumping) {
                    state = 'jumping';
                } else if (isCrouching) {
                    state = 'crouching';
                } else if (vx !== 0) { // Moving horizontally
                    if (direction === 'left') {
                        state = (isRunning && spriteSlots.running) ? 'running' : 'walkingLeft';
                    } else { // direction === 'right'
                        state = (isRunning && spriteSlots.running) ? 'running' : 'walkingRight';
                    }
                } else { // Standing still
                    state = 'standing';
                }


                return { ...prev, x, y, vx, vy, state, isJumping, isRunning, isCrouching, isSitting, direction };
            });
        }, 1000 / 60); // 60 FPS
    }

    // Cleanup interval on unmount or when dependencies change
    return () => {
        if (gameLoopIntervalRef.current) {
            clearInterval(gameLoopIntervalRef.current);
            gameLoopIntervalRef.current = null;
            isTransitioningRef.current = false; // Reset transition lock on cleanup
        }
    };
  }, [spriteSlots, error, isLoading, handleGenerateWorld, currentWorldDescription, toast]); // Dependencies for game loop


  const getCurrentSprite = useCallback(() => {
     if (!spriteSlots) return null;

     let stateToUse = character.state;
     let spriteUrl = spriteSlots[stateToUse];
     let shouldMirror = false;

      // Handle running animation mirroring/fallback
      if (stateToUse === 'running') {
          if (spriteSlots.running) {
              spriteUrl = spriteSlots.running;
              shouldMirror = character.direction === 'left';
          } else {
              // Fallback to walking if running sprite doesn't exist
              spriteUrl = character.direction === 'left' ? spriteSlots.walkingLeft : spriteSlots.walkingRight;
              shouldMirror = false; // Walking sprites are directional
          }
      }
      // Handle walking mirroring/fallback if one direction is missing
      else if (stateToUse === 'walkingRight' && !spriteSlots.walkingRight && spriteSlots.walkingLeft) {
         spriteUrl = spriteSlots.walkingLeft;
         shouldMirror = true; // Mirror left-walk for right-walk
      }
      else if (stateToUse === 'walkingLeft' && !spriteSlots.walkingLeft && spriteSlots.walkingRight) {
         spriteUrl = spriteSlots.walkingRight;
         shouldMirror = true; // Mirror right-walk for left-walk
      }

     // Fallback for missing states (including walking if fallbacks failed)
     if (!spriteUrl) {
         console.warn(`Sprite for state "${stateToUse}" is missing. Falling back to "standing".`);
         spriteUrl = spriteSlots.standing;
         shouldMirror = false;
     }

     // Critical fallback if standing is also missing
     if (!spriteUrl) {
         console.error("Critical error: Standing sprite is missing!");
         return null;
     }

     return { url: spriteUrl, mirror: shouldMirror };
   }, [character.state, character.direction, spriteSlots]);


   // Handles the initial world generation from the input field
   const handleInitialGenerate = () => {
        handleGenerateWorld(initialWorldDescription);
   }


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
        initialWorldDescription: currentWorldDescription, // Export the description used for the *current* background
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

      toast({ title: "Game Data Exported!", description: "Your character and world data have been saved." });

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
       // Redirecting in useEffect now, but add a fallback message
        return <div className="flex items-center justify-center h-screen"><p>Failed to initialize character data. Redirecting...</p></div>;
     }
     // If there was an error recorded, the error screen above should render
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

        {/* World Generation Controls (Only for initial generation) */}
       {!generatedWorldBackground && (
            <div className="mb-4 p-4 pixel-border bg-card text-card-foreground w-full max-w-3xl flex flex-col sm:flex-row gap-2 items-center z-20">
                <Label htmlFor="world-description" className="flex-shrink-0 mr-2 font-semibold">World Prompt:</Label>
                <Input
                    id="world-description"
                    type="text"
                    value={initialWorldDescription}
                    onChange={(e) => setInitialWorldDescription(e.target.value)}
                    placeholder="e.g., magical forest, futuristic city ruins, lava cave"
                    className="input-pixel flex-grow"
                    disabled={isGeneratingWorld}
                />
                <Button
                    onClick={handleInitialGenerate}
                    disabled={isGeneratingWorld || !initialWorldDescription}
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
       )}


      {/* Game Area */}
      <div
        className="relative border-4 border-black overflow-hidden"
        style={{
            width: `${WORLD_WIDTH}px`,
            height: `${WORLD_HEIGHT}px`,
            imageRendering: 'pixelated',
            backgroundColor: 'hsl(var(--background))', // Fallback background
         }}
        data-ai-hint="simple pixel game background ground grass sky"
      >
         {/* Generated World Background */}
         {generatedWorldBackground ? (
              <Image
                src={generatedWorldBackground}
                alt="Generated World Background"
                layout="fill"
                objectFit="cover"
                style={{ imageRendering: 'pixelated', zIndex: 0 }}
                unoptimized
                priority // Load background first
              />
          ) : (
             <>
                 {/* Simple Fallback Ground/Sky if no background yet */}
                 <div className="absolute inset-0 bg-blue-300 z-0"></div>
                 <div
                    className="absolute bottom-0 left-0 w-full bg-yellow-800 border-t-4 border-black z-0"
                    style={{ height: `${WORLD_HEIGHT - GROUND_Y}px` }}
                 />
             </>
          )}

        {/* Exit Indicator */}
        {generatedWorldBackground && (
             <div className="absolute right-0 top-0 bottom-0 flex items-center justify-center w-10 z-10 pointer-events-none">
                 <div className="bg-black/50 text-white p-2 rounded-l-md animate-pulse">
                    <ArrowRight size={24} />
                 </div>
             </div>
        )}


        {/* Character */}
        {currentSpriteData?.url && (
           <div
            ref={characterRef}
            className="absolute z-10" // Character above background and exit indicator
            style={{
              left: `${character.x}px`,
              bottom: `${WORLD_HEIGHT - character.y - CHARACTER_WIDTH}px`, // Position based on bottom
              width: `${CHARACTER_WIDTH}px`,
              height: `${CHARACTER_WIDTH}px`,
              transform: currentSpriteData.mirror ? 'scaleX(-1)' : 'scaleX(1)',
              transformOrigin: 'center center',
              // transition: 'transform 0.05s linear', // Smooth mirror flip
              willChange: 'transform, left, bottom', // Optimize rendering
            }}
          >
            <Image
              src={currentSpriteData.url}
              alt={`Character ${character.state}`}
              width={CHARACTER_WIDTH}
              height={CHARACTER_WIDTH}
              style={{ imageRendering: 'pixelated', objectFit: 'contain' }}
              unoptimized
              priority // Load character quickly
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

         {/* Loading Indicator during transitions */}
         {isGeneratingWorld && isTransitioningRef.current && (
              <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-50">
                   <div className="text-white text-xl flex items-center gap-2">
                       <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                           <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                           <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                       </svg>
                       Loading Next Area...
                   </div>
              </div>
         )}
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
