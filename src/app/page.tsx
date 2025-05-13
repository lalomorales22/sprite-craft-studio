
'use client';

import React, {useState} from 'react';
import {useRouter} from 'next/navigation';
import {SidebarProvider, Sidebar, SidebarInset, SidebarTrigger, SidebarHeader, SidebarContent, SidebarFooter, SidebarMenu, SidebarMenuItem, SidebarMenuButton} from '@/components/ui/sidebar';
import {Button} from '@/components/ui/button';
import {Input} from '@/components/ui/input';
import {Label} from '@/components/ui/label';
import {Textarea} from '@/components/ui/textarea';
import {Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter} from '@/components/ui/card';
import {useToast} from '@/hooks/use-toast';
import {generateSpriteSheet} from '@/ai/flows/generate-sprite-sheet';
import Image from 'next/image';
import {Upload, Paintbrush, Eraser, ZoomIn, ZoomOut, MoveLeft, MoveRight, Footprints, ArrowUp, ArrowDown, User, Armchair, Square, Globe, Sparkles, Library, Trash2 } from 'lucide-react';
import Link from 'next/link';
import SpriteEditor from '@/components/sprite-editor';
import { Skeleton } from '@/components/ui/skeleton';

// Define types for sprite states
type SpriteState = 'standing' | 'walkingLeft' | 'walkingRight' | 'running' | 'jumping' | 'crouching' | 'sitting';
export type SpriteSlots = {
  [key in SpriteState]: string | null; // Store data URI or null
};

export default function Home() {
  const [description, setDescription] = useState('');
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [generatedSpriteSheet, setGeneratedSpriteSheet] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [editorImage, setEditorImage] = useState<string | null>(null);
  const [spriteSlots, setSpriteSlots] = useState<SpriteSlots>({
    standing: null,
    walkingLeft: null,
    walkingRight: null,
    running: null,
    jumping: null,
    crouching: null,
    sitting: null,
  });
  const {toast} = useToast();
  const router = useRouter();

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setUploadedImage(reader.result as string);
        setGeneratedSpriteSheet(null); // Clear previous generated sheet if new one is uploaded
        setEditorImage(null); // Also clear editor
      };
      reader.readAsDataURL(file);
    }
  };

  const handleGenerateSprite = async () => {
    if (!uploadedImage || !description) {
      toast({
        title: 'Missing Information',
        description: 'Please upload an image and provide a description.',
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);
    setGeneratedSpriteSheet(null); 
    setEditorImage(null); 
    try {
      const result = await generateSpriteSheet({
        photoDataUri: uploadedImage,
        description: description,
      });
      console.log("Generated Sprite Sheet URI:", result.spriteSheetDataUri.substring(0, 100) + "..."); 
      setGeneratedSpriteSheet(result.spriteSheetDataUri);
      toast({
        title: 'Sprite Sheet Generated!',
        description: 'You can now send it to the editor.',
      });
    } catch (error) {
      console.error('Error generating sprite sheet:', error);
      const errorMessage = error instanceof Error ? error.message : 'Could not generate the sprite sheet. Please try again.';
       if (errorMessage.includes('Generation blocked')) { 
          toast({
            title: 'Generation Blocked',
            description: 'The image or description triggered safety filters. Please modify and try again.',
            variant: 'destructive',
            duration: 7000 
          });
       } else {
         toast({
            title: 'Generation Failed',
            description: errorMessage,
            variant: 'destructive',
            duration: 7000 
         });
       }
      setGeneratedSpriteSheet(null);
      setEditorImage(null);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendToEditor = () => {
    if (generatedSpriteSheet) {
      console.log("Sending generated sprite sheet to editor:", generatedSpriteSheet.substring(0, 100) + "...");
      setEditorImage(generatedSpriteSheet);
      toast({ title: "Generated sheet sent to editor" });
    } else if (uploadedImage) {
        console.log("Sending uploaded image to editor:", uploadedImage.substring(0, 100) + "...");
        setEditorImage(uploadedImage);
        toast({ title: "Uploaded image sent to editor" });
    }
     else {
         console.log("No image available to send to editor.");
       toast({ title: "No image available to send", variant: "destructive" });
    }
  }

  const handleSaveSprite = (state: SpriteState, imageDataUrl: string) => {
    setSpriteSlots(prev => ({ ...prev, [state]: imageDataUrl }));
    toast({ title: `${state.charAt(0).toUpperCase() + state.slice(1)} sprite saved!`});
  };

  const handleEnterWorld = () => {
     const allSlotsFilled = Object.values(spriteSlots).every(slot => slot !== null);
     if (allSlotsFilled) {
        try {
          const spriteDataString = JSON.stringify(spriteSlots);
          sessionStorage.setItem('spriteData', spriteDataString);
          console.log("Sprite data saved to sessionStorage:", spriteDataString.substring(0, 100) + "...");
          // Clear any game loading state before navigating to world for new character
          sessionStorage.removeItem('loadGameId'); 
          router.push('/world');
        } catch (error) {
           console.error("Error saving to sessionStorage or navigating:", error);
            if (error instanceof DOMException && error.name === 'QuotaExceededError') {
                 toast({ title: "Storage Error", description: "Could not save character data due to storage limits. Try clearing browser data.", variant: "destructive", duration: 7000 });
            } else {
                 toast({ title: "Error", description: "Could not save character data or navigate to the world.", variant: "destructive" });
            }
        }
     } else {
        toast({ title: "Missing Poses", description: "Please assign all character poses before entering the world.", variant: "destructive" });
     }
  };

  const allSlotsFilled = Object.values(spriteSlots).every(slot => slot !== null);

  return (
    <SidebarProvider>
      <Sidebar>
        <SidebarHeader className="p-4">
           <h1 className="text-2xl font-bold text-primary flex items-center gap-2">
             <Square size={24}/> SpriteCraft Studio
           </h1>
        </SidebarHeader>
        <SidebarContent>
          <SidebarMenu>
            <SidebarMenuItem>
               <SidebarMenuButton isActive={router.pathname === '/'} tooltip="Sprite Creator">
                 <Paintbrush />
                 <span>Sprite Creator</span>
               </SidebarMenuButton>
            </SidebarMenuItem>
             <SidebarMenuItem>
               <Link href="/world" passHref legacyBehavior>
                 <SidebarMenuButton
                    isActive={router.pathname === '/world'}
                    tooltip="Game World Preview"
                    onClick={(e) => {
                         const allFilled = Object.values(spriteSlots).every(slot => slot !== null);
                         if (!allFilled) {
                            e.preventDefault();
                            toast({ title: "Missing Poses", description: "Assign all poses on the Creator page first to preview.", variant: "destructive" });
                         } else {
                             try {
                                 sessionStorage.setItem('spriteData', JSON.stringify(spriteSlots));
                                 sessionStorage.removeItem('loadGameId'); // Ensure we're not trying to load a game
                             } catch (error) {
                                  e.preventDefault(); 
                                  console.error("Error saving to sessionStorage before navigation:", error);
                                   if (error instanceof DOMException && error.name === 'QuotaExceededError') {
                                         toast({ title: "Storage Error", description: "Could not save character data due to storage limits.", variant: "destructive", duration: 7000 });
                                    } else {
                                         toast({ title: "Storage Error", description: "Could not save character data.", variant: "destructive" });
                                    }
                             }
                         }
                    }}
                  >
                   <Globe size={16}/>
                   <span>Game World</span>
                 </SidebarMenuButton>
               </Link>
            </SidebarMenuItem>
            <SidebarMenuItem>
               <Link href="/created-games" passHref legacyBehavior>
                 <SidebarMenuButton isActive={router.pathname === '/created-games'} tooltip="Created Games">
                   <Library size={16}/>
                   <span>Created Games</span>
                 </SidebarMenuButton>
               </Link>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarContent>
         <SidebarFooter className="p-4">
           <p className="text-xs text-muted-foreground">&copy; {new Date().getFullYear()} SpriteCraft</p>
         </SidebarFooter>
      </Sidebar>
      <SidebarInset className="flex flex-col gap-4 p-4 bg-background"> {/* Changed to flex-col, removed md:flex-row and bg-secondary/20 */}
        <Card className="flex-1 card-pixel">
          <CardHeader>
             <SidebarTrigger className="md:hidden mb-2" />
            <CardTitle className="flex items-center gap-2"><Upload /> 1. Generate or Upload</CardTitle>
            <CardDescription>Upload an image and describe your character, or just upload a sprite sheet.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="image-upload" className="flex items-center gap-2 cursor-pointer btn-pixel-secondary justify-center">
                 <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-image-up"><path d="M10.3 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v10l-3.1-3.1a2 2 0 0 0-2.814.014L6 21"/><path d="m14 19.5 3-3 3 3"/><path d="M17 22v-5.5"/><circle cx="9" cy="9" r="2"/></svg>
                 Upload Image/Sprite Sheet
              </Label>
              <Input id="image-upload" type="file" accept="image/*" onChange={handleImageUpload} className="input-pixel sr-only" />
               {uploadedImage && (
                 <div className="mt-2 pixel-border p-1 inline-block bg-card-foreground/10">
                    <Image src={uploadedImage} alt="Uploaded preview" width={128} height={128} className="object-contain" style={{ imageRendering: 'pixelated' }} />
                 </div>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Character Description (for AI Generation)</Label>
              <Textarea
                id="description"
                placeholder="e.g., A brave knight with shiny armor, A mystical wizard with a long beard"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="input-pixel min-h-[80px]"
              />
            </div>
             {generatedSpriteSheet && (
               <div className="space-y-2">
                 <Label>Generated Sprite Sheet</Label>
                  <div className="mt-2 pixel-border p-1 bg-card-foreground/10 inline-block">
                     <Image src={generatedSpriteSheet} alt="Generated Sprite Sheet" width={256} height={256} className="object-contain" style={{ imageRendering: 'pixelated' }} data-ai-hint="sprite sheet character"/>
                  </div>
               </div>
            )}
             {isLoading && (
                <div className="space-y-2">
                    <Label>Generating Sprite Sheet...</Label>
                    <Skeleton className="w-[256px] h-[256px] bg-muted" />
                </div>
             )}
          </CardContent>
          <CardFooter className="flex flex-col sm:flex-row gap-2 flex-wrap">
            <Button onClick={handleGenerateSprite} disabled={isLoading || !uploadedImage || !description} className="btn-pixel flex-grow sm:flex-grow-0">
              {isLoading ? (
                <>
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Generating...
                </>
              ) : (
                 <> <Sparkles size={16} className="mr-2"/> Generate Sheet </>
              )}
            </Button>
            <Button onClick={handleSendToEditor} variant="secondary" className="btn-pixel-secondary flex-grow sm:flex-grow-0" disabled={(!generatedSpriteSheet && !uploadedImage) || isLoading}>
                Send to Editor
            </Button>
          </CardFooter>
        </Card>

        <Card className="flex-1 card-pixel flex flex-col">
           <CardHeader>
             <div className="flex justify-between items-center">
                 <CardTitle className="flex items-center gap-2"><Paintbrush /> 2. Edit &amp; Assign Poses</CardTitle>
             </div>
             <CardDescription>Select parts of your sheet, optionally remove the background, and save them for each character pose.</CardDescription>
           </CardHeader>
           <CardContent className="flex-grow flex flex-col md:flex-row gap-4">
              <div className="flex-grow relative pixel-border bg-muted/30 min-h-[300px] md:min-h-0 rounded-lg"> {/* Added rounding here */}
                {editorImage ? (
                  <SpriteEditor
                     imageUrl={editorImage}
                     onSaveSprite={handleSaveSprite}
                     spriteSlots={spriteSlots}
                     key={editorImage} 
                     onImageUpdate={(newUri) => {
                        setEditorImage(newUri);
                        // If the editor updates the image (e.g. bg removal), also update the generatedSpriteSheet if it was the source
                        if (generatedSpriteSheet === editorImage) {
                            setGeneratedSpriteSheet(newUri);
                        } else if (uploadedImage === editorImage) {
                            setUploadedImage(newUri);
                        }
                     }}
                  />
                 ) : (
                   <div className="absolute inset-0 flex items-center justify-center text-muted-foreground p-4 text-center">
                     <p>Generate or upload a sprite sheet and click 'Send to Editor' to start.</p>
                   </div>
                 )}
              </div>

             <div className="w-full md:w-1/3 space-y-2">
                <h3 className="font-semibold text-lg">Character Poses</h3>
                <p className="text-xs text-muted-foreground mb-2">Required poses for the game world.</p>
                {Object.keys(spriteSlots).map((key) => {
                    const state = key as SpriteState;
                    const iconMap: Record<SpriteState, React.ReactNode> = {
                      standing: <User size={16} />,
                      walkingLeft: <MoveLeft size={16} />,
                      walkingRight: <MoveRight size={16} />,
                      running: <Footprints size={16} />,
                      jumping: <ArrowUp size={16} />,
                      crouching: <ArrowDown size={16} />,
                      sitting: <Armchair size={16}/>,
                    };
                    return (
                      <div key={state} className={`flex items-center gap-2 p-2 pixel-border rounded-lg ${spriteSlots[state] ? 'pixel-border-primary bg-primary/10' : 'bg-muted/50'}`}>
                        <div className="flex-shrink-0 w-16 h-16 pixel-border bg-card-foreground/10 flex items-center justify-center overflow-hidden rounded-md"> {/* Rounded pose preview */}
                          {spriteSlots[state] ? (
                            <Image src={spriteSlots[state]!} alt={`${state} sprite`} width={64} height={64} style={{ imageRendering: 'pixelated', objectFit: 'contain' }} />
                          ) : (
                             <div className="w-full h-full bg-muted/30 flex items-center justify-center text-muted-foreground text-4xl rounded-md">?</div>
                          )}
                        </div>
                        <div className="flex items-center gap-1 text-sm font-medium">
                          {iconMap[state]}
                          <span>{state.charAt(0).toUpperCase() + state.slice(1)}</span>
                        </div>
                         {spriteSlots[state] && <span className="ml-auto text-green-400">✓</span>}
                      </div>
                    );
                  })}
              </div>
           </CardContent>
           <CardFooter className="justify-end">
              <Button
                onClick={handleEnterWorld}
                disabled={!allSlotsFilled || isLoading} 
                className="btn-pixel-accent"
                aria-disabled={!allSlotsFilled}
              >
                Enter World with Character
              </Button>
           </CardFooter>
        </Card>
      </SidebarInset>
    </SidebarProvider>
  );
}

export type { SpriteState };
