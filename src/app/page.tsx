'use client';

import React, {useState} from 'react';
import {SidebarProvider, Sidebar, SidebarInset, SidebarTrigger, SidebarHeader, SidebarContent, SidebarFooter, SidebarMenu, SidebarMenuItem, SidebarMenuButton} from '@/components/ui/sidebar';
import {Button} from '@/components/ui/button';
import {Input} from '@/components/ui/input';
import {Label} from '@/components/ui/label';
import {Textarea} from '@/components/ui/textarea';
import {Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter} from '@/components/ui/card';
import {useToast} from '@/hooks/use-toast';
import {generateSpriteSheet} from '@/ai/flows/generate-sprite-sheet';
import Image from 'next/image';
import {Upload, Paintbrush, Eraser, ZoomIn, ZoomOut, MoveLeft, MoveRight, Footprints, ArrowUp, ArrowDown, User, Sit, Square} from 'lucide-react';
import Link from 'next/link';
import SpriteEditor from '@/components/sprite-editor'; // Import the new SpriteEditor component

// Define types for sprite states
type SpriteState = 'standing' | 'walkingLeft' | 'walkingRight' | 'running' | 'jumping' | 'crouching' | 'sitting';
type SpriteSlots = {
  [key in SpriteState]: string | null; // Store data URI or null
};

export default function Home() {
  const [description, setDescription] = useState('');
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [generatedSpriteSheet, setGeneratedSpriteSheet] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [editorImage, setEditorImage] = useState<string | null>(null); // Image sent to editor
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

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setUploadedImage(reader.result as string);
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
    try {
      const result = await generateSpriteSheet({
        photoDataUri: uploadedImage,
        description: description,
      });
      setGeneratedSpriteSheet(result.spriteSheetDataUri);
      setEditorImage(result.spriteSheetDataUri); // Send generated image to editor
      toast({
        title: 'Sprite Sheet Generated!',
        description: 'You can now edit the sprite sheet.',
      });
    } catch (error) {
      console.error('Error generating sprite sheet:', error);
      toast({
        title: 'Generation Failed',
        description: 'Could not generate the sprite sheet. Please try again.',
        variant: 'destructive',
      });
      // Clear generated image on failure
      setGeneratedSpriteSheet(null);
      setEditorImage(null);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendToEditor = () => {
    if (generatedSpriteSheet) {
      setEditorImage(generatedSpriteSheet);
      toast({ title: "Image sent to editor" });
    } else {
       toast({ title: "No image generated yet", variant: "destructive" });
    }
  }

  const handleSaveSprite = (state: SpriteState, imageDataUrl: string) => {
    setSpriteSlots(prev => ({ ...prev, [state]: imageDataUrl }));
    toast({ title: `${state.charAt(0).toUpperCase() + state.slice(1)} sprite saved!`});
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
               <SidebarMenuButton isActive={true} tooltip="Sprite Creator">
                 <Paintbrush />
                 <span>Sprite Creator</span>
               </SidebarMenuButton>
            </SidebarMenuItem>
             <SidebarMenuItem>
               <Link href="/world">
                 <SidebarMenuButton tooltip="Game World">
                   <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-globe"><circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/></svg>
                   <span>Game World</span>
                 </SidebarMenuButton>
               </Link>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarContent>
         <SidebarFooter className="p-4">
           <p className="text-xs text-muted-foreground">&copy; 2024 SpriteCraft</p>
         </SidebarFooter>
      </Sidebar>
      <SidebarInset className="flex flex-col md:flex-row gap-4 p-4 bg-secondary/20">
         {/* Left Side: Generation */}
        <Card className="flex-1 card-pixel">
          <CardHeader>
             <SidebarTrigger className="md:hidden mb-2" />
            <CardTitle className="flex items-center gap-2"><Upload /> Generate Sprite Sheet</CardTitle>
            <CardDescription>Upload an image and describe your character.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="image-upload" className="flex items-center gap-2 cursor-pointer">
                 <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-image-up"><path d="M10.3 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v10l-3.1-3.1a2 2 0 0 0-2.814.014L6 21"/><path d="m14 19.5 3-3 3 3"/><path d="M17 22v-5.5"/><circle cx="9" cy="9" r="2"/></svg>
                 Upload Image
              </Label>
              <Input id="image-upload" type="file" accept="image/*" onChange={handleImageUpload} className="input-pixel sr-only" />
               {uploadedImage && (
                 <div className="mt-2 pixel-border p-1 inline-block">
                    <Image src={uploadedImage} alt="Uploaded preview" width={128} height={128} className="object-contain" style={{ imageRendering: 'pixelated' }} />
                 </div>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Character Description</Label>
              <Textarea
                id="description"
                placeholder="e.g., A brave knight with shiny armor, A mystical wizard with a long beard"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="input-pixel min-h-[100px]"
              />
            </div>
             {generatedSpriteSheet && (
               <div className="space-y-2">
                 <Label>Generated Sprite Sheet</Label>
                  <div className="mt-2 pixel-border p-1 bg-white inline-block">
                     <Image src={generatedSpriteSheet} alt="Generated Sprite Sheet" width={256} height={256} className="object-contain" style={{ imageRendering: 'pixelated' }} data-ai-hint="sprite sheet character"/>
                  </div>
               </div>
            )}
          </CardContent>
          <CardFooter>
            <Button onClick={handleGenerateSprite} disabled={isLoading} className="btn-pixel w-full">
              {isLoading ? (
                <>
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Generating...
                </>
              ) : (
                'Generate Sprite Sheet'
              )}
            </Button>
             {generatedSpriteSheet && (
                 <Button onClick={handleSendToEditor} variant="secondary" className="btn-pixel-secondary ml-2">
                   Send to Editor
                 </Button>
             )}
          </CardFooter>
        </Card>

         {/* Right Side: Editor and Assembly */}
        <Card className="flex-1 card-pixel flex flex-col">
           <CardHeader>
             <CardTitle className="flex items-center gap-2"><Paintbrush /> Sprite Editor & Assembly</CardTitle>
             <CardDescription>Edit your sprite sheet and assign poses.</CardDescription>
           </CardHeader>
           <CardContent className="flex-grow flex flex-col md:flex-row gap-4">
              {/* Editor Canvas Area */}
              <div className="flex-grow relative pixel-border bg-white min-h-[300px] md:min-h-0">
                {editorImage ? (
                  <SpriteEditor
                     imageUrl={editorImage}
                     onSaveSprite={handleSaveSprite}
                     spriteSlots={spriteSlots}
                  />
                 ) : (
                   <div className="absolute inset-0 flex items-center justify-center text-muted-foreground">
                     <p>Generate or upload a sprite sheet to start editing.</p>
                   </div>
                 )}
              </div>

              {/* Sprite Slots Area */}
             <div className="w-full md:w-1/3 space-y-2">
                <h3 className="font-semibold">Assign Character Poses</h3>
                <p className="text-xs text-muted-foreground mb-2">Drag edited sprites here.</p>
                {Object.keys(spriteSlots).map((key) => {
                    const state = key as SpriteState;
                    const iconMap: Record<SpriteState, React.ReactNode> = {
                      standing: <User size={16} />,
                      walkingLeft: <MoveLeft size={16} />,
                      walkingRight: <MoveRight size={16} />,
                      running: <Footprints size={16} />,
                      jumping: <ArrowUp size={16} />,
                      crouching: <ArrowDown size={16} />,
                      sitting: <Sit size={16}/>,
                    };
                    return (
                      <div key={state} className="flex items-center gap-2 p-2 pixel-border bg-muted/50">
                        <div className="flex-shrink-0 w-16 h-16 pixel-border bg-white flex items-center justify-center">
                          {spriteSlots[state] ? (
                            <Image src={spriteSlots[state]!} alt={`${state} sprite`} width={64} height={64} style={{ imageRendering: 'pixelated' }} />
                          ) : (
                             <div className="w-full h-full bg-gray-300"/> // Placeholder square
                          )}
                        </div>
                        <div className="flex items-center gap-1 text-sm font-medium">
                          {iconMap[state]}
                          <span>{state.charAt(0).toUpperCase() + state.slice(1)}</span>
                        </div>
                      </div>
                    );
                  })}
              </div>
           </CardContent>
           <CardFooter className="justify-end">
               <Link href={{ pathname: '/world', query: { sprites: JSON.stringify(spriteSlots) } }} passHref>
                 <Button
                   disabled={!allSlotsFilled}
                   className="btn-pixel-accent"
                   aria-disabled={!allSlotsFilled} // Add aria-disabled for accessibility
                  >
                    Generate Character & Enter World
                 </Button>
               </Link>
           </CardFooter>
        </Card>
      </SidebarInset>
    </SidebarProvider>
  );
}
