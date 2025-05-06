
'use client';

import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Download, Image as ImageIcon, Sparkles, ArrowRight, Key } from 'lucide-react'; // Removed PenguinIcon, added Key
import { generateWorldBackground } from '@/ai/flows/generate-world-background';
import type { SpriteState, SpriteSlots } from '@/app/page';

// --- Constants ---
const GRAVITY = 0.5;
const MOVE_SPEED = 3;
const RUN_SPEED = 6;
const JUMP_POWER = 10;
const GROUND_Y = 300;
const WORLD_WIDTH = 800;
const WORLD_HEIGHT = 400;
const CHARACTER_WIDTH = 64;
const CHARACTER_HEIGHT = 64; // Add character height
const ITEM_WIDTH = 32; // Penguin/Key size
const ITEM_HEIGHT = 32;
const DOOR_WIDTH = 50;
const DOOR_HEIGHT = 80;
const TRANSITION_THRESHOLD = WORLD_WIDTH - CHARACTER_WIDTH - DOOR_WIDTH; // Point where transition starts (before door)
const INTERACTION_DISTANCE = 20; // How close character needs to be to interact

// --- Inline Penguin SVG ---
const PenguinIcon = (props: React.SVGProps<SVGSVGElement>) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
        <path d="M12 20c-1.7 0-3-1.3-3-3v-7h6v7c0 1.7-1.3 3-3 3z"/>
        <path d="M10 10V8c0-1.1.9-2 2-2s2 .9 2 2v2"/>
        <path d="M5 17v-5h2v5H5z"/>
        <path d="M17 17v-5h2v5h-2z"/>
        <circle cx="12" cy="6" r="1"/>
    </svg>
);

// --- Component: Door ---
const Door = React.memo(({ locked }: { locked: boolean }) => (
  <div
    className={`absolute bottom-0 right-0 w-[${DOOR_WIDTH}px] h-[${DOOR_HEIGHT}px] bg-yellow-900 border-4 border-black flex items-center justify-center z-10`}
    style={{ bottom: `${WORLD_HEIGHT - GROUND_Y}px` }}
  >
    {locked ? (
      <Key size={24} className="text-red-500" />
    ) : (
      <div className="w-4 h-8 bg-green-500 rounded" /> // Simple unlocked indicator
    )}
  </div>
));
Door.displayName = 'Door';

// --- Interfaces ---
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

interface CollectibleState {
  x: number;
  y: number;
  collected: boolean;
}

// --- World Page Component ---
export default function WorldPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [spriteSlots, setSpriteSlots] = useState<SpriteSlots | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const characterRef = useRef<HTMLDivElement>(null);
  const keysPressed = useRef<Record<string, boolean>>({});
  const gameLoopIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const isTransitioningRef = useRef(false);

  const [initialWorldDescription, setInitialWorldDescription] = useState('');
  const [currentWorldDescription, setCurrentWorldDescription] = useState('');
  const [generatedWorldBackground, setGeneratedWorldBackground] = useState<string | null>(null);
  const [isGeneratingWorld, setIsGeneratingWorld] = useState(false);

  // --- Game State ---
  const [character, setCharacter] = useState<CharacterState>({
    x: WORLD_WIDTH / 2,
    y: GROUND_Y,
    vx: 0, vy: 0, state: 'standing', isJumping: false, isRunning: false,
    isCrouching: false, isSitting: false, direction: 'right',
  });
  const [penguin, setPenguin] = useState<CollectibleState | null>(null);
  const [hasKey, setHasKey] = useState(false); // Player inventory
  const [level, setLevel] = useState(1); // Track level number

  // --- Callbacks & Functions --- Moved Up ---

  const handleGenerateWorld = useCallback(async (description: string) => {
    if (!description) { toast({ title: "Missing Description", variant: "destructive" }); return false; }
    setIsGeneratingWorld(true);
    try {
      const result = await generateWorldBackground({ description: description });
      setGeneratedWorldBackground(result.worldImageDataUri);
      setCurrentWorldDescription(description);
      if (!initialWorldDescription) setInitialWorldDescription(description);
      toast({ title: "World Background Generated!" });
      return true;
    } catch (error) {
      console.error("World gen error:", error);
      const msg = `World generation failed. ${error instanceof Error ? error.message : 'Try again.'}`;
      toast({ title: "Generation Failed", description: msg, variant: "destructive" });
      return false;
    } finally {
      setIsGeneratingWorld(false);
    }
  }, [toast, initialWorldDescription]); // Removed handleGenerateWorld from its own deps

  const getCurrentSprite = useCallback(() => {
     if (!spriteSlots) return null;
     let stateToUse = character.state; let spriteUrl = spriteSlots[stateToUse]; let shouldMirror = false;
      if (stateToUse === 'running') {
          if (spriteSlots.running) { spriteUrl = spriteSlots.running; shouldMirror = character.direction === 'left'; }
          else { spriteUrl = character.direction === 'left' ? spriteSlots.walkingLeft : spriteSlots.walkingRight; shouldMirror = false; }
      } else if (stateToUse === 'walkingRight' && !spriteSlots.walkingRight && spriteSlots.walkingLeft) { spriteUrl = spriteSlots.walkingLeft; shouldMirror = true; }
      else if (stateToUse === 'walkingLeft' && !spriteSlots.walkingLeft && spriteSlots.walkingRight) { spriteUrl = spriteSlots.walkingRight; shouldMirror = true; }
      if (!spriteUrl) { console.warn(`Sprite missing: "${stateToUse}". Fallback to "standing".`); spriteUrl = spriteSlots.standing; shouldMirror = false; }
      if (!spriteUrl) { console.error("CRITICAL: Standing sprite missing!"); return null; }
     return { url: spriteUrl, mirror: shouldMirror };
   }, [character.state, character.direction, spriteSlots]);

   const handleInitialGenerate = () => { handleGenerateWorld(initialWorldDescription); };

   const handleExportGame = () => {
    if (!spriteSlots || !generatedWorldBackground) { toast({ title: "Missing Assets", variant: "destructive" }); return; }
    try {
      const gameData = { sprites: spriteSlots, worldBackground: generatedWorldBackground, initialWorldDescription: currentWorldDescription, };
      const gameDataString = JSON.stringify(gameData, null, 2);
      const blob = new Blob([gameDataString], { type: 'application/json' });
      const url = URL.createObjectURL(blob); const link = document.createElement('a');
      link.href = url; link.download = 'spritecraft_game_data.json';
      document.body.appendChild(link); link.click();
      document.body.removeChild(link); URL.revokeObjectURL(url);
      toast({ title: "Game Data Exported!" });
    } catch (error) {
      console.error("Export error:", error); toast({ title: "Export Failed", variant: "destructive" });
    }
  };

  // --- Effects ---

  // Load sprite data
  useEffect(() => {
    setIsLoading(true);
    setError(null);
    const spritesParam = sessionStorage.getItem('spriteData');
    if (spritesParam) {
      try {
        const parsedSprites: SpriteSlots = JSON.parse(spritesParam);
        const requiredStates: SpriteState[] = ['standing', 'walkingLeft', 'walkingRight', 'running', 'jumping', 'crouching', 'sitting'];
        const missingStates = requiredStates.filter(state => !parsedSprites[state] || typeof parsedSprites[state] !== 'string');
        if (missingStates.length === 0) {
          setSpriteSlots(parsedSprites);
        } else {
          const msg = `Missing sprites: ${missingStates.join(', ')}. Go back to fix.`;
          setError(msg); console.error(msg); toast({ title: "Sprites Missing", description: msg, variant: "destructive", duration: 5000 }); router.push('/');
        }
      } catch (e) {
        const msg = 'Failed to parse sprite data. Go back and retry.';
        console.error('Parse error:', e); setError(msg); toast({ title: "Data Error", description: msg, variant: "destructive", duration: 5000 }); router.push('/');
      }
    } else {
      const msg = 'No character data. Create a character first.';
      setError(msg); console.error(msg); toast({ title: "No Data", description: msg, variant: "destructive", duration: 5000 }); router.push('/');
    }
    setIsLoading(false);
  }, [router, toast]);

  // Keyboard listeners
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
        if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return;
        keysPressed.current[event.key.toLowerCase()] = true;
        if (event.key.toLowerCase() === 'c' || event.key.toLowerCase() === 'x') {
            setCharacter(prev => (prev.y === GROUND_Y ? {...prev, isSitting: !prev.isSitting, isCrouching: false, vx: 0} : prev));
        }
    };
    const handleKeyUp = (event: KeyboardEvent) => { keysPressed.current[event.key.toLowerCase()] = false; };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
        window.removeEventListener('keydown', handleKeyDown);
        window.removeEventListener('keyup', handleKeyUp);
        if (gameLoopIntervalRef.current) clearInterval(gameLoopIntervalRef.current);
        keysPressed.current = {};
    };
  }, []);

  // Place penguin on new level/background generation
  useEffect(() => {
     if (generatedWorldBackground) {
        // Place penguin randomly, but not too close to edges or door
        const safePadding = 50;
        const randomX = Math.floor(Math.random() * (WORLD_WIDTH - ITEM_WIDTH - safePadding * 2 - DOOR_WIDTH)) + safePadding;
        setPenguin({ x: randomX, y: GROUND_Y, collected: false });
        setHasKey(false); // Reset key inventory for new level
        console.log(`Level ${level}: Penguin placed at x=${randomX}`);
     } else {
        setPenguin(null); // Clear penguin if no background
     }
  }, [generatedWorldBackground, level]); // Depend on background and level

  // Game loop
  useEffect(() => {
    if (!spriteSlots || error || isLoading) {
      if (gameLoopIntervalRef.current) { clearInterval(gameLoopIntervalRef.current); gameLoopIntervalRef.current = null; }
      return;
    }

    if (!gameLoopIntervalRef.current) {
      gameLoopIntervalRef.current = setInterval(() => {
        if (isTransitioningRef.current) return;

        setCharacter(prev => {
          let { x, y, vx, vy, state, isJumping, isRunning, isCrouching, isSitting, direction } = prev;

          // Vertical Movement (Gravity & Jumping)
          vy += GRAVITY; y += vy;
          if (y >= GROUND_Y) { y = GROUND_Y; vy = 0; isJumping = false; }

          // Horizontal Movement & State Logic
          isRunning = keysPressed.current['shift'] === true;
          const currentSpeed = isRunning ? RUN_SPEED : MOVE_SPEED;
          if (isSitting && y !== GROUND_Y) isSitting = false;
          isCrouching = (keysPressed.current['s'] || keysPressed.current['arrowdown']) && !isJumping && !isSitting && y === GROUND_Y;

          if (isSitting) { vx = 0; state = 'sitting'; }
          else if (isCrouching) { vx = 0; state = 'crouching'; }
          else {
            if (keysPressed.current['a'] || keysPressed.current['arrowleft']) { vx = -currentSpeed; direction = 'left'; }
            else if (keysPressed.current['d'] || keysPressed.current['arrowright']) { vx = currentSpeed; direction = 'right'; }
            else { vx = 0; }
            if ((keysPressed.current['w'] || keysPressed.current[' '] || keysPressed.current['arrowup']) && !isJumping && y === GROUND_Y) { vy = -JUMP_POWER; isJumping = true; }
          }
          x += vx;

          // --- Penguin Interaction ---
          if (penguin && !penguin.collected) {
              const charCenterX = x + CHARACTER_WIDTH / 2;
              const penguinCenterX = penguin.x + ITEM_WIDTH / 2;
              const dist = Math.abs(charCenterX - penguinCenterX);
              if (dist < (CHARACTER_WIDTH / 2 + ITEM_WIDTH / 2) - INTERACTION_DISTANCE && y === GROUND_Y) { // Check horizontal overlap and ground proximity
                  console.log("Collected Penguin!");
                  toast({ title: "Penguin Found!", description: "You got the key!", duration: 2000 });
                  setPenguin(p => p ? { ...p, collected: true } : null);
                  setHasKey(true); // Grant the key
              }
          }

          // --- World Boundaries & Transitions ---
          if (x < 0) { x = 0; vx = 0; }
          else if (x > TRANSITION_THRESHOLD) {
              // Near the door
              if (hasKey) {
                  // Door is unlocked, allow transition
                  x = TRANSITION_THRESHOLD; vx = 0; // Stop at threshold
                  if (!isTransitioningRef.current && generatedWorldBackground && currentWorldDescription) {
                      isTransitioningRef.current = true;
                      console.log("Transitioning to next level...");
                      toast({ title: "Moving to next area...", description: "Generating new background..." });
                      const nextLevel = level + 1; // Calculate next level here
                      setLevel(nextLevel); // Increment level counter

                      // Pass the calculated next level to the prompt
                      handleGenerateWorld(currentWorldDescription + ` continue the ${direction} scene, level ${nextLevel}`)
                        .then((success) => {
                            if (success) {
                                console.log("New world generated, resetting character.");
                                setCharacter(prevChar => ({
                                    ...prevChar, x: 10, y: GROUND_Y, vx: 0, vy: 0, isJumping: false, state: 'standing'
                                }));
                            } else {
                                console.error("Failed to generate next level background.");
                                setCharacter(prevChar => ({ ...prevChar, x: TRANSITION_THRESHOLD - 1 })); // Move back slightly
                            }
                        })
                        .finally(() => { isTransitioningRef.current = false; });
                  }
              } else {
                   // Door is locked, stop character
                   x = TRANSITION_THRESHOLD;
                   vx = 0;
                   // Optionally show a "Locked" toast, but might be annoying
                   // if (!toast.isActive('door-locked')) { // Prevent spamming
                   //   toast({id: 'door-locked', title: "Door Locked", description: "Find the penguin to get the key!", variant: "destructive", duration: 2000 });
                   // }
              }
          }


          // Determine final animation state
          if (isSitting) state = 'sitting';
          else if (isJumping) state = 'jumping';
          else if (isCrouching) state = 'crouching';
          else if (vx !== 0) {
            if (direction === 'left') state = (isRunning && spriteSlots.running) ? 'running' : 'walkingLeft';
            else state = (isRunning && spriteSlots.running) ? 'running' : 'walkingRight';
          } else state = 'standing';

          return { ...prev, x, y, vx, vy, state, isJumping, isRunning, isCrouching, isSitting, direction };
        });
      }, 1000 / 60);
    }

    return () => {
      if (gameLoopIntervalRef.current) { clearInterval(gameLoopIntervalRef.current); gameLoopIntervalRef.current = null; }
      isTransitioningRef.current = false;
    };
  }, [spriteSlots, error, isLoading, handleGenerateWorld, currentWorldDescription, toast, penguin, hasKey, level]); // Add penguin, hasKey, level


  // --- Render Logic ---

  if (isLoading) return <div className="flex items-center justify-center h-screen"><p>Loading World...</p></div>;
   if (error && !spriteSlots && !isLoading) {
     return ( <div className="flex flex-col items-center justify-center h-screen text-center p-4">
         <h2 className="text-2xl font-bold text-destructive mb-4">Error Loading World</h2> <p className="mb-6">{error}</p>
         <Link href="/"><Button className="btn-pixel"><ArrowLeft className="mr-2 h-4 w-4" /> Go Back</Button></Link>
       </div> );
   }
  if (!spriteSlots && !isLoading && !error) {
     console.error("World loaded but sprite slots null without error.");
     return <div className="flex items-center justify-center h-screen"><p>Failed to init character. Redirecting...</p></div>;
   }

  const currentSpriteData = getCurrentSprite();

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-800 p-4 relative">
        <Link href="/" className="absolute top-4 left-4 z-30">
          <Button className="btn-pixel-secondary"><ArrowLeft className="mr-2 h-4 w-4" /> Back</Button>
        </Link>

        {/* World Generation Controls (Initial) */}
       {!generatedWorldBackground && (
            <div className="mb-4 p-4 pixel-border bg-card text-card-foreground w-full max-w-3xl flex flex-col sm:flex-row gap-2 items-center z-20">
                <Label htmlFor="world-description" className="flex-shrink-0 mr-2 font-semibold">World Prompt:</Label>
                <Input id="world-description" type="text" value={initialWorldDescription} onChange={(e) => setInitialWorldDescription(e.target.value)}
                    placeholder="e.g., magical forest, futuristic city ruins" className="input-pixel flex-grow" disabled={isGeneratingWorld} />
                <Button onClick={handleInitialGenerate} disabled={isGeneratingWorld || !initialWorldDescription} className="btn-pixel flex-shrink-0">
                    {isGeneratingWorld ? <><svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-primary-foreground" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>Generating...</> : <><Sparkles size={16} className="mr-1"/>Generate</>}
                </Button>
            </div>
       )}

      {/* Game Area */}
      <div className="relative border-4 border-black overflow-hidden" style={{ width: `${WORLD_WIDTH}px`, height: `${WORLD_HEIGHT}px`, imageRendering: 'pixelated', backgroundColor: 'hsl(var(--background))' }}
        data-ai-hint="simple pixel game background ground grass sky">
         {/* Background */}
         {generatedWorldBackground ? (
              <Image src={generatedWorldBackground} alt="Generated World Background" layout="fill" objectFit="cover" style={{ imageRendering: 'pixelated', zIndex: 0 }} unoptimized priority />
          ) : ( <> {/* Fallback BG */}
                 <div className="absolute inset-0 bg-blue-300 z-0"></div>
                 <div className="absolute bottom-0 left-0 w-full bg-yellow-800 border-t-4 border-black z-0" style={{ height: `${WORLD_HEIGHT - GROUND_Y}px` }}/>
             </> )}

        {/* Door */}
        {generatedWorldBackground && <Door locked={!hasKey} />}

        {/* Penguin */}
        {penguin && !penguin.collected && generatedWorldBackground && (
           <div className="absolute z-10" style={{ left: `${penguin.x}px`, bottom: `${WORLD_HEIGHT - penguin.y - ITEM_HEIGHT}px`, width: `${ITEM_WIDTH}px`, height: `${ITEM_HEIGHT}px` }}>
                <PenguinIcon className="w-full h-full text-black bg-white rounded p-1 pixel-border" />
           </div>
        )}

        {/* Key Indicator in UI (Top Right) */}
        {generatedWorldBackground && (
            <div className={`absolute top-14 right-2 z-20 p-1 pixel-border ${hasKey ? 'bg-green-300 pixel-border-primary' : 'bg-red-300 pixel-border'}`}>
                <Key size={20} className={hasKey ? 'text-green-800' : 'text-red-800'} />
            </div>
        )}


        {/* Character */}
        {currentSpriteData?.url && (
           <div ref={characterRef} className="absolute z-10" style={{
              left: `${character.x}px`, bottom: `${WORLD_HEIGHT - character.y - CHARACTER_HEIGHT}px`,
              width: `${CHARACTER_WIDTH}px`, height: `${CHARACTER_HEIGHT}px`,
              transform: currentSpriteData.mirror ? 'scaleX(-1)' : 'scaleX(1)', transformOrigin: 'center center',
              willChange: 'transform, left, bottom', }}>
            <Image src={currentSpriteData.url} alt={`Character ${character.state}`} width={CHARACTER_WIDTH} height={CHARACTER_HEIGHT} style={{ imageRendering: 'pixelated', objectFit: 'contain' }} unoptimized priority />
          </div>
        )}

         {/* Instructions */}
         <div className="absolute top-2 right-2 bg-black/70 text-white p-2 text-xs pixel-border z-20 leading-tight">
            <p className='font-bold mb-1'>Level: {level} | Controls:</p>
            <p>←/A | →/D: Move | Shift: Run</p>
            <p>↑/W/Spc: Jump | ↓/S: Crouch</p>
            <p>C | X: Sit/Stand</p>
            <p className="mt-1">Goal: Find Penguin (<PenguinIcon size={10} className="inline-block -mt-1"/>) to get key (<Key size={10} className="inline-block -mt-1"/>) &amp; exit right.</p>
         </div>

         {/* Loading Indicator during transitions */}
         {isGeneratingWorld && isTransitioningRef.current && (
              <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-50">
                   <div className="text-white text-xl flex items-center gap-2">
                       <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg> Loading Next Area...
                   </div>
              </div>
         )}
      </div>

       {/* Export Button */}
        <div className="mt-4 z-20">
          <Button onClick={handleExportGame} disabled={!spriteSlots || !generatedWorldBackground} className="btn-pixel-accent" aria-disabled={!spriteSlots || !generatedWorldBackground}>
            <Download size={16} className="mr-2" /> Export Game Data
          </Button>
        </div>
    </div>
  );
}
