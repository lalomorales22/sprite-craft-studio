
'use client';

import React, { useRef, useState, useEffect, useCallback } from 'react';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input'; // Import Input
import { Eraser, Paintbrush, ZoomIn, ZoomOut, RotateCcw, Save, MousePointer, Slice } from 'lucide-react'; // Added Slice for Select
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"; // Import Tooltip components
import type { SpriteState, SpriteSlots } from '@/app/page'; // Import types

interface SpriteEditorProps {
  imageUrl: string;
  onSaveSprite: (state: SpriteState, imageDataUrl: string) => void;
  spriteSlots: SpriteSlots;
}

const SpriteEditor: React.FC<SpriteEditorProps> = ({ imageUrl, onSaveSprite, spriteSlots }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const previewCanvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [startDrag, setStartDrag] = useState({ x: 0, y: 0 });
  const [selection, setSelection] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  const [isSelecting, setIsSelecting] = useState(false);
  const [startSelect, setStartSelect] = useState({ x: 0, y: 0 });
  const [tool, setTool] = useState<'select' | 'erase' | 'draw' | 'pan'>('pan'); // Added 'pan', default to 'pan'
  const [brushSize, setBrushSize] = useState(5);
  const [drawColor, setDrawColor] = useState('#000000'); // Default draw color
  const [isDrawing, setIsDrawing] = useState(false);
  const [history, setHistory] = useState<ImageData[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [selectedSpriteState, setSelectedSpriteState] = useState<SpriteState>('standing');


  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d', { willReadFrequently: true }); // Opt-in for performance
    const img = imageRef.current;

    if (!canvas || !ctx ) return;

     // Ensure crisp pixels
    ctx.imageSmoothingEnabled = false;
    ctx.webkitImageSmoothingEnabled = false; // for Safari
    // @ts-ignore moz specific property
    ctx.mozImageSmoothingEnabled = false;    // for Firefox
    // @ts-ignore ms specific property
    ctx.msImageSmoothingEnabled = false;     // for IE

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

     // Optionally draw checkered background for transparency visualization
    const patternSize = 10;
    ctx.fillStyle = '#ccc'; // Light gray
    for (let i = 0; i < canvas.width; i += patternSize) {
        for (let j = 0; j < canvas.height; j += patternSize) {
            if ((Math.floor(i / patternSize) + Math.floor(j / patternSize)) % 2 === 0) {
                ctx.fillRect(i, j, patternSize, patternSize);
            }
        }
    }
    ctx.fillStyle = '#fff'; // White
     for (let i = 0; i < canvas.width; i += patternSize) {
        for (let j = 0; j < canvas.height; j += patternSize) {
            if ((Math.floor(i / patternSize) + Math.floor(j / patternSize)) % 2 !== 0) {
                ctx.fillRect(i, j, patternSize, patternSize);
            }
        }
    }


    // Apply zoom and pan
    ctx.save();
    ctx.translate(offset.x, offset.y);
    ctx.scale(zoom, zoom);

    // Draw the current state from history
     if (history[historyIndex]) {
        // Create a temporary canvas to draw the ImageData
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = history[historyIndex].width;
        tempCanvas.height = history[historyIndex].height;
        const tempCtx = tempCanvas.getContext('2d');
        if (tempCtx) {
            tempCtx.putImageData(history[historyIndex], 0, 0);
            // Now draw the temp canvas onto the main canvas
            ctx.drawImage(tempCanvas, 0, 0);
        }
     }
     // Fallback: Draw original image if history is somehow empty (shouldn't happen after load)
     else if (img) {
         ctx.drawImage(img, 0, 0);
     }


     // Draw selection rectangle if it exists
    if (selection && tool === 'select') { // Only show selection for select tool
      ctx.strokeStyle = 'rgba(255, 105, 180, 0.9)'; // Accent Pink with more opacity
      ctx.lineWidth = 2 / zoom; // Adjust line width based on zoom
      ctx.setLineDash([4 / zoom, 2 / zoom]); // Dashed line for selection
      ctx.strokeRect(selection.x, selection.y, selection.width, selection.height);
      ctx.setLineDash([]); // Reset line dash
    }

    ctx.restore();
  }, [zoom, offset, selection, history, historyIndex, tool]);


  const saveToHistory = useCallback(() => {
     const canvas = canvasRef.current;
     const img = imageRef.current; // Need the original image dimensions
     if (!canvas || !img) return;

     // Get context of the *original size* canvas in memory used for history
     const tempCanvas = document.createElement('canvas');
     tempCanvas.width = img.width;
     tempCanvas.height = img.height;
     const tempCtx = tempCanvas.getContext('2d', { willReadFrequently: true });
     if (!tempCtx) return;

      // Draw the *current visual state* (zoomed/panned) from the display canvas
      // onto the temp canvas *at original scale*
      tempCtx.imageSmoothingEnabled = false;
      tempCtx.drawImage(canvas, 0, 0); // This might need adjustment if canvas itself isn't original size


      // Get ImageData from the correctly scaled temporary canvas
      try {
        const imageData = tempCtx.getImageData(0, 0, tempCanvas.width, tempCanvas.height);
         const newHistory = history.slice(0, historyIndex + 1);
         newHistory.push(imageData);
         setHistory(newHistory);
         setHistoryIndex(newHistory.length - 1);
      } catch (e) {
          console.error("Error getting ImageData for history:", e);
      }


  }, [history, historyIndex, canvasRef, imageRef]);


  // Load image and initialize canvas
  useEffect(() => {
    console.log("Image URL Changed:", imageUrl);
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    const img = new window.Image();
    img.crossOrigin = "anonymous";

    img.onload = () => {
       console.log("Image Loaded:", img.width, img.height);
      if (!canvas || !ctx) return;
      imageRef.current = img;

      // Set canvas display size (CSS)
      // canvas.style.width = `${img.width}px`;
      // canvas.style.height = `${img.height}px`;

      // Set canvas actual drawing surface size
      canvas.width = img.width;
      canvas.height = img.height;

      // Reset state for new image
      setZoom(1);
      setSelection(null);
      setIsSelecting(false);
      setTool('pan'); // Reset tool to pan


      // Calculate initial offset to center the image
       const initialZoom = 1; // Start at 1x zoom
       const initialOffsetX = (canvas.offsetWidth - img.width * initialZoom) / 2;
       const initialOffsetY = (canvas.offsetHeight - img.height * initialZoom) / 2;
       setOffset({ x: initialOffsetX, y: initialOffsetY });
       setZoom(initialZoom); // Explicitly set zoom


       // Draw the initial image onto the canvas
        ctx.imageSmoothingEnabled = false;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0);
        console.log("Initial draw complete");

      // Save initial state to history
       try {
           const initialImageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
           setHistory([initialImageData]);
           setHistoryIndex(0);
           console.log("Initial history saved");
       } catch (e) {
            console.error("Error getting initial ImageData:", e);
            setHistory([]);
            setHistoryIndex(-1);
       }
       // Trigger redraw explicitly after state updates
       // requestAnimationFrame(() => draw()); // Use rAF for smoother updates
    };
    img.onerror = (e) => {
      console.error("Error loading image:", e);
      // Clear canvas and history on error
       if (canvas && ctx) {
           ctx.clearRect(0, 0, canvas.width, canvas.height);
       }
       imageRef.current = null;
       setHistory([]);
       setHistoryIndex(-1);
       setSelection(null);
    }
    img.src = imageUrl;


     // Cleanup function
    return () => {
      console.log("Cleaning up SpriteEditor effect");
      imageRef.current = null; // Clean up image ref
    };

  }, [imageUrl]); // Rerun ONLY when imageUrl changes

    // Separate effect for drawing whenever relevant state changes
    useEffect(() => {
        requestAnimationFrame(() => draw());
    }, [draw, zoom, offset, selection, historyIndex]); // Depend on draw and its dependencies


   // Update preview canvas when selection changes
  useEffect(() => {
    const canvas = canvasRef.current;
    const previewCanvas = previewCanvasRef.current;
    const previewCtx = previewCanvas?.getContext('2d', { willReadFrequently: true });

    if (!canvas || !previewCanvas || !previewCtx || !selection || !imageRef.current) {
        // Clear preview if no selection or image
        if(previewCanvas && previewCtx) {
            previewCtx.clearRect(0, 0, previewCanvas.width, previewCanvas.height);
        }
        return;
    }

     // Ensure crisp pixels
    previewCtx.imageSmoothingEnabled = false;
    previewCtx.webkitImageSmoothingEnabled = false;
    // @ts-ignore
    previewCtx.mozImageSmoothingEnabled = false;
    // @ts-ignore
    previewCtx.msImageSmoothingEnabled = false;


    // Get selection dimensions relative to the original image (not zoomed/panned)
     const imgWidth = imageRef.current.width;
     const imgHeight = imageRef.current.height;

     // Calculate selection bounds in the original image coordinate space
     const originalX = (selection.x);
     const originalY = (selection.y);
     const originalW = (selection.width);
     const originalH = (selection.height);

     // Clamp coordinates and dimensions to the original image bounds
     const clampedX = Math.max(0, Math.floor(originalX));
     const clampedY = Math.max(0, Math.floor(originalY));
     const clampedW = Math.min(imgWidth - clampedX, Math.max(1, Math.floor(originalW)));
     const clampedH = Math.min(imgHeight - clampedY, Math.max(1, Math.floor(originalH)));


     if (clampedW > 0 && clampedH > 0 && historyIndex >= 0 && history[historyIndex]) {
         // Use the current state from history
         const sourceImageData = history[historyIndex];

         // Create a temporary canvas to hold the full current state
         const tempCanvas = document.createElement('canvas');
         tempCanvas.width = sourceImageData.width;
         tempCanvas.height = sourceImageData.height;
         const tempCtx = tempCanvas.getContext('2d');

         if (tempCtx) {
             tempCtx.putImageData(sourceImageData, 0, 0);

             // Clear preview canvas and set its size
             previewCanvas.width = clampedW;
             previewCanvas.height = clampedH;
             previewCtx.clearRect(0, 0, previewCanvas.width, previewCanvas.height);

             // Draw the selected portion from the temp canvas to the preview canvas
             previewCtx.drawImage(
                 tempCanvas,
                 clampedX, clampedY, clampedW, clampedH, // Source rect (from original image coords)
                 0, 0, clampedW, clampedH              // Destination rect (in preview canvas)
             );
         } else {
             // Clear preview if context fails
             previewCtx.clearRect(0, 0, previewCanvas.width, previewCanvas.height);
         }
     } else {
         // Clear preview if selection is invalid or history is not ready
         previewCtx.clearRect(0, 0, previewCanvas.width, previewCanvas.height);
     }


  }, [selection, history, historyIndex, zoom, offset]);


  const getCanvasCoordinates = (clientX: number, clientY: number): { x: number; y: number } => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    // Calculate coordinates relative to the un-zoomed, un-panned image
    const canvasX = (clientX - rect.left - offset.x) / zoom;
    const canvasY = (clientY - rect.top - offset.y) / zoom;
    return { x: canvasX, y: canvasY };
  };


  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
     const coords = getCanvasCoordinates(e.clientX, e.clientY);

     if (tool === 'select') {
       setIsSelecting(true);
       setStartSelect(coords);
       setSelection({ x: coords.x, y: coords.y, width: 0, height: 0}); // Start selection rect
     } else if (tool === 'erase' || tool === 'draw') {
        setIsDrawing(true);
        // Start drawing/erasing immediately
        applyTool(coords.x, coords.y); // Pass original image coords
     } else if (tool === 'pan') {
       setIsDragging(true);
       setStartDrag({ x: e.clientX - offset.x, y: e.clientY - offset.y });
     }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const coords = getCanvasCoordinates(e.clientX, e.clientY);
    const img = imageRef.current;
    if (!img) return;

    if (isSelecting && tool === 'select') {
       const currentX = Math.max(0, Math.min(coords.x, img.width)); // Clamp to image bounds
       const currentY = Math.max(0, Math.min(coords.y, img.height)); // Clamp to image bounds
       const width = currentX - startSelect.x;
       const height = currentY - startSelect.y;
       setSelection({
         x: width > 0 ? startSelect.x : currentX,
         y: height > 0 ? startSelect.y : currentY,
         width: Math.abs(width),
         height: Math.abs(height),
       });
       // No draw() needed here, useEffect handles it
    } else if (isDrawing && (tool === 'erase' || tool === 'draw')) {
       applyTool(coords.x, coords.y); // Pass original image coords
    } else if (isDragging && tool === 'pan') {
      setOffset({
        x: e.clientX - startDrag.x,
        y: e.clientY - startDrag.y,
      });
      // No draw() needed here, useEffect handles it
    }
  };

  const handleMouseUp = () => {
    if (isDrawing && (tool === 'erase' || tool === 'draw')) {
        saveToHistory(); // Save state after finishing a draw/erase stroke
    }
    // Finalize selection
     if (isSelecting && tool === 'select' && selection && (selection.width < 1 || selection.height < 1)) {
        setSelection(null); // Discard tiny selections
     }
    setIsSelecting(false);
    setIsDrawing(false);
    setIsDragging(false);
  };

   const handleMouseLeave = () => {
    // Only save history if actively drawing when leaving canvas
    if (isDrawing && (tool === 'erase' || tool === 'draw')) {
        saveToHistory();
    }
     if (isSelecting) {
        // If selecting and mouse leaves, finalize selection if valid
         if (selection && (selection.width < 1 || selection.height < 1)) {
            setSelection(null);
         }
        setIsSelecting(false);
     }
     setIsDrawing(false);
     setIsDragging(false); // Stop dragging if mouse leaves canvas
   };

   const applyTool = (imgX: number, imgY: number) => {
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext('2d');
      const img = imageRef.current;
      if (!canvas || !ctx || !img || historyIndex < 0) return;

      // Get the current state ImageData from history
      const currentStateData = history[historyIndex];
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = currentStateData.width;
      tempCanvas.height = currentStateData.height;
      const tempCtx = tempCanvas.getContext('2d');
      if (!tempCtx) return;
      tempCtx.putImageData(currentStateData, 0, 0);

      // Apply the tool operation on the temporary canvas (original image coordinates)
      tempCtx.beginPath();
      // Adjust for brush size centering
      const correctedX = Math.floor(imgX - brushSize / 2);
      const correctedY = Math.floor(imgY - brushSize / 2);
      const size = Math.max(1, Math.floor(brushSize)); // Ensure size is at least 1

       if (tool === 'erase') {
           tempCtx.clearRect(correctedX, correctedY, size, size);
       } else if (tool === 'draw') {
           tempCtx.fillStyle = drawColor;
           tempCtx.fillRect(correctedX, correctedY, size, size);
       }

      // Get the modified ImageData from the temporary canvas
      try {
         const modifiedImageData = tempCtx.getImageData(0, 0, tempCanvas.width, tempCanvas.height);

         // Update the main canvas immediately (this modification won't be saved to history until mouseUp)
         ctx.save();
         ctx.imageSmoothingEnabled = false;
         ctx.clearRect(0, 0, canvas.width, canvas.height); // Clear display canvas
         ctx.putImageData(modifiedImageData, 0, 0); // Put modified data directly (at 0,0)
         ctx.restore();

          // Trigger a redraw to apply zoom/pan correctly to the modified canvas data
          requestAnimationFrame(() => draw());

      } catch(e) {
        console.error("Error applying tool:", e)
      }

   };

    const handleUndo = () => {
      if (historyIndex > 0) {
         const newIndex = historyIndex - 1;
         setHistoryIndex(newIndex);
         // Restore is handled by the draw function via useEffect dependency on historyIndex
      }
   };


  const handleZoomIn = () => setZoom(prev => Math.min(prev * 1.2, 16)); // Max zoom 16x
  const handleZoomOut = () => setZoom(prev => Math.max(prev / 1.2, 0.25)); // Min zoom 0.25x

  const handleSaveSelection = () => {
    const previewCanvas = previewCanvasRef.current;
    if (!previewCanvas || !selection || selection.width < 1 || selection.height < 1) {
        console.warn("Cannot save: Invalid selection or preview canvas.");
        return;
    };


    // Get data URL from the preview canvas (which shows the correctly sized selection)
    try {
        const dataUrl = previewCanvas.toDataURL('image/png');
        onSaveSprite(selectedSpriteState, dataUrl);
        setSelection(null); // Clear selection after saving
        // Draw is handled by useEffect
    } catch (e) {
        console.error("Error generating data URL:", e);
         // Maybe show an error toast to the user
    }

  };

   const getCursor = () => {
        switch (tool) {
            case 'pan':
                return isDragging ? 'grabbing' : 'grab';
            case 'select':
                return 'crosshair';
            case 'erase':
            case 'draw':
                // Ideally, show a custom cursor representing brush size/shape
                return 'crosshair'; // Fallback
            default:
                return 'default';
        }
    };


  return (
    <div className="flex flex-col h-full bg-muted/20">
       {/* Toolbar */}
       <TooltipProvider>
           <div className="flex items-center gap-1 p-1 border-b pixel-border bg-muted/50 flex-wrap">
              <Tooltip>
                  <TooltipTrigger asChild>
                     <Button variant={tool === 'pan' ? "secondary" : "ghost"} size="icon" onClick={() => setTool('pan')} className="h-8 w-8">
                       <MousePointer size={16} />
                     </Button>
                  </TooltipTrigger>
                  <TooltipContent><p>Pan (P)</p></TooltipContent>
               </Tooltip>
               <Tooltip>
                   <TooltipTrigger asChild>
                      <Button variant={tool === 'select' ? "secondary" : "ghost"} size="icon" onClick={() => setTool('select')} className="h-8 w-8">
                        <Slice size={16}/>
                      </Button>
                   </TooltipTrigger>
                   <TooltipContent><p>Select (S)</p></TooltipContent>
               </Tooltip>
              <Tooltip>
                 <TooltipTrigger asChild>
                    <Button variant={tool === 'draw' ? "secondary" : "ghost"} size="icon" onClick={() => setTool('draw')} className="h-8 w-8">
                       <Paintbrush size={16} />
                    </Button>
                 </TooltipTrigger>
                 <TooltipContent><p>Brush (B)</p></TooltipContent>
              </Tooltip>
              <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant={tool === 'erase' ? "secondary" : "ghost"} size="icon" onClick={() => setTool('erase')} className="h-8 w-8">
                       <Eraser size={16} />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent><p>Eraser (E)</p></TooltipContent>
              </Tooltip>

              {(tool === 'erase' || tool === 'draw') && (
                <>
                   <Label htmlFor="brush-size" className="sr-only">Brush Size</Label>
                   <Slider
                       id="brush-size"
                       defaultValue={[brushSize]}
                       max={50}
                       min={1}
                       step={1}
                       className="w-20 mx-2"
                       onValueChange={(value) => setBrushSize(value[0])}
                       aria-label="Brush Size"
                   />
                   <span className="text-xs w-6 text-right mr-2">{brushSize}px</span>
                   {tool === 'draw' && (
                      <Tooltip>
                           <TooltipTrigger asChild>
                               <Input aria-label="Draw color" type="color" value={drawColor} onChange={(e) => setDrawColor(e.target.value)} className="w-8 h-8 p-0.5 input-pixel" />
                           </TooltipTrigger>
                           <TooltipContent><p>Draw Color</p></TooltipContent>
                      </Tooltip>
                   )}
                </>
               )}
               <div className="flex items-center gap-1 ml-auto">
                   <Tooltip>
                      <TooltipTrigger asChild>
                          <Button variant="ghost" size="icon" onClick={handleZoomIn} className="h-8 w-8">
                            <ZoomIn size={16} />
                          </Button>
                      </TooltipTrigger>
                      <TooltipContent><p>Zoom In (+)</p></TooltipContent>
                   </Tooltip>
                   <Tooltip>
                      <TooltipTrigger asChild>
                          <Button variant="ghost" size="icon" onClick={handleZoomOut} className="h-8 w-8">
                            <ZoomOut size={16} />
                          </Button>
                      </TooltipTrigger>
                      <TooltipContent><p>Zoom Out (-)</p></TooltipContent>
                   </Tooltip>
                   <Tooltip>
                      <TooltipTrigger asChild>
                           <Button variant="ghost" size="icon" onClick={handleUndo} disabled={historyIndex <= 0} className="h-8 w-8">
                            <RotateCcw size={16} />
                          </Button>
                      </TooltipTrigger>
                       <TooltipContent><p>Undo (Ctrl+Z)</p></TooltipContent>
                   </Tooltip>
               </div>
           </div>
       </TooltipProvider>

       {/* Canvas */}
       <div className="flex-grow overflow-hidden relative bg-gray-400" style={{ cursor: getCursor() }}>
         <canvas
           ref={canvasRef}
           onMouseDown={handleMouseDown}
           onMouseMove={handleMouseMove}
           onMouseUp={handleMouseUp}
           onMouseLeave={handleMouseLeave}
           className="absolute top-0 left-0" // Position canvas absolutely
           // DO NOT set width/height style here, use attributes instead
           style={{ imageRendering: 'pixelated', touchAction: 'none' }}
         />
       </div>

        {/* Preview and Save Area */}
       {tool === 'select' && selection && selection.width >= 1 && selection.height >= 1 && ( // Only show if selection tool is active and selection is valid
           <div className="flex items-center gap-4 p-2 border-t pixel-border bg-muted/50">
              <div className="flex flex-col items-center">
                  <Label className="text-xs mb-1 font-semibold">Preview</Label>
                  <canvas
                    ref={previewCanvasRef}
                    className="pixel-border bg-white max-w-[64px] max-h-[64px]"
                    style={{ imageRendering: 'pixelated' }}
                    width={Math.max(1, Math.floor(selection.width))} // Set canvas attribute size
                    height={Math.max(1, Math.floor(selection.height))}
                   />
              </div>
             <div className="flex-grow space-y-1">
                 <Label htmlFor="sprite-state-select" className="text-xs font-semibold">Assign to Pose:</Label>
                 <Select value={selectedSpriteState} onValueChange={(value) => setSelectedSpriteState(value as SpriteState)}>
                    <SelectTrigger id="sprite-state-select" className="input-pixel w-full md:w-[180px] h-9 text-xs">
                      <SelectValue placeholder="Select Pose" />
                    </SelectTrigger>
                    <SelectContent className="bg-popover pixel-border">
                      {Object.keys(spriteSlots).map((state) => (
                        <SelectItem key={state} value={state} className="hover:bg-accent focus:bg-accent text-xs">
                          {state.charAt(0).toUpperCase() + state.slice(1)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
             </div>

             <Button onClick={handleSaveSelection} size="sm" className="btn-pixel-accent h-9 self-end">
               <Save size={14} className="mr-1" /> Save Pose
             </Button>
           </div>
       )}
    </div>
  );
};

export default SpriteEditor;
