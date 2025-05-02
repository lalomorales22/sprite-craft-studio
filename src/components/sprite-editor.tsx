
'use client';

import React, { useRef, useState, useEffect, useCallback } from 'react';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { Eraser, Paintbrush, ZoomIn, ZoomOut, RotateCcw, Save } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

type SpriteState = 'standing' | 'walkingLeft' | 'walkingRight' | 'running' | 'jumping' | 'crouching' | 'sitting';
type SpriteSlots = { [key in SpriteState]: string | null };

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
  const [tool, setTool] = useState<'select' | 'erase' | 'draw'>('select');
  const [brushSize, setBrushSize] = useState(5);
  const [eraseColor] = useState('rgba(0,0,0,0)'); // Transparent for eraser
  const [drawColor, setDrawColor] = useState('#000000'); // Default draw color
  const [isDrawing, setIsDrawing] = useState(false);
  const [history, setHistory] = useState<ImageData[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [selectedSpriteState, setSelectedSpriteState] = useState<SpriteState>('standing');


  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d', { willReadFrequently: true }); // Opt-in for performance
    const img = imageRef.current;

    if (!canvas || !ctx || !img) return;

    // Ensure crisp pixels
    ctx.imageSmoothingEnabled = false;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Apply zoom and pan
    ctx.save();
    ctx.translate(offset.x, offset.y);
    ctx.scale(zoom, zoom);

    // Draw the image
    ctx.drawImage(img, 0, 0);

     // Draw selection rectangle if it exists
    if (selection) {
      ctx.strokeStyle = 'rgba(255, 105, 180, 0.8)'; // Accent Pink with transparency
      ctx.lineWidth = 2 / zoom; // Adjust line width based on zoom
      ctx.strokeRect(selection.x, selection.y, selection.width, selection.height);
    }

    ctx.restore();
  }, [zoom, offset, selection]);


  const saveToHistory = useCallback(() => {
     const canvas = canvasRef.current;
     const ctx = canvas?.getContext('2d');
     if (!canvas || !ctx) return;
     const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
     const newHistory = history.slice(0, historyIndex + 1);
     newHistory.push(imageData);
     setHistory(newHistory);
     setHistoryIndex(newHistory.length - 1);
  }, [history, historyIndex]);


  // Load image and initialize canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    const img = new window.Image();
    img.crossOrigin = "anonymous"; // Allow cross-origin drawing if applicable

    img.onload = () => {
      if (!canvas || !ctx) return;
      imageRef.current = img;
      // Set initial canvas size (can be adjusted)
      canvas.width = img.width;
      canvas.height = img.height;
       // Center the image initially
      setOffset({
          x: (canvas.offsetWidth - img.width * zoom) / 2,
          y: (canvas.offsetHeight - img.height * zoom) / 2,
      });

      draw();
      // Save initial state
       setTimeout(() => { // Ensure drawing happened
            const initialImageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            setHistory([initialImageData]);
            setHistoryIndex(0);
        }, 0);
    };
    img.onerror = (e) => {
      console.error("Error loading image:", e);
       // Handle image loading error (e.g., show a message)
    }
    img.src = imageUrl;


     // Cleanup function
    return () => {
      imageRef.current = null; // Clean up image ref
    };

  }, [imageUrl, draw]); // Rerun when imageUrl changes


   // Redraw when zoom or offset changes
  useEffect(() => {
    draw();
  }, [zoom, offset, draw]);

   // Update preview canvas when selection changes
  useEffect(() => {
    const canvas = canvasRef.current;
    const previewCanvas = previewCanvasRef.current;
    const ctx = canvas?.getContext('2d');
    const previewCtx = previewCanvas?.getContext('2d');
    const img = imageRef.current;

    if (!canvas || !previewCanvas || !ctx || !previewCtx || !selection || !img ) return;

     // Ensure crisp pixels
    previewCtx.imageSmoothingEnabled = false;


    const { x, y, width, height } = selection;

    // Ensure selection is within image bounds
    const sx = Math.max(0, Math.floor(x));
    const sy = Math.max(0, Math.floor(y));
    const sw = Math.max(1, Math.floor(width)); // Ensure minimum 1px width/height
    const sh = Math.max(1, Math.floor(height));

    // Get the ImageData for the selected area from the *original* image data in history
    // We use the history to get the un-zoomed/panned data
     if (historyIndex >= 0 && history[historyIndex]) {
      const sourceImageData = history[historyIndex];
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = sourceImageData.width;
      tempCanvas.height = sourceImageData.height;
      const tempCtx = tempCanvas.getContext('2d');
      if(tempCtx) {
          tempCtx.putImageData(sourceImageData, 0, 0);

          // Adjust coordinates relative to the original image data (not zoomed/panned)
           const originalX = (sx - offset.x / zoom);
           const originalY = (sy - offset.y / zoom);
           const originalW = sw / zoom;
           const originalH = sh / zoom;


           // Clamp coordinates to the original image dimensions
           const clampedX = Math.max(0, Math.floor(originalX));
           const clampedY = Math.max(0, Math.floor(originalY));
           const clampedW = Math.min(sourceImageData.width - clampedX, Math.max(1, Math.floor(originalW)));
           const clampedH = Math.min(sourceImageData.height - clampedY, Math.max(1, Math.floor(originalH)));


           if (clampedW > 0 && clampedH > 0) {
                // Clear preview canvas
                previewCanvas.width = clampedW; // Set preview size to selection size
                previewCanvas.height = clampedH;
                previewCtx.clearRect(0, 0, previewCanvas.width, previewCanvas.height);
                previewCtx.drawImage(tempCanvas, clampedX, clampedY, clampedW, clampedH, 0, 0, clampedW, clampedH);
           } else {
               // Clear if selection is invalid
                previewCtx.clearRect(0, 0, previewCanvas.width, previewCanvas.height);
           }
      }

     } else {
       // Fallback or initial draw from current canvas (less accurate if zoomed/panned)
        // Clear preview canvas
        previewCanvas.width = sw;
        previewCanvas.height = sh;
        previewCtx.clearRect(0, 0, previewCanvas.width, previewCanvas.height);
        try {
           previewCtx.drawImage(canvas, sx, sy, sw, sh, 0, 0, sw, sh);
        } catch (e) {
           console.error("Error drawing preview:", e);
           previewCtx.clearRect(0, 0, previewCanvas.width, previewCanvas.height);
        }
     }


  }, [selection, history, historyIndex, zoom, offset]);


  const getCanvasCoordinates = (clientX: number, clientY: number): { x: number; y: number } => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: (clientX - rect.left - offset.x) / zoom,
      y: (clientY - rect.top - offset.y) / zoom,
    };
  };


  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
     const coords = getCanvasCoordinates(e.clientX, e.clientY);

     if (tool === 'select') {
       setIsSelecting(true);
       setStartSelect(coords);
       setSelection(null); // Clear previous selection
     } else if (tool === 'erase' || tool === 'draw') {
        setIsDrawing(true);
        // Start drawing/erasing immediately
        applyTool(coords.x, coords.y);
     } else { // Pan tool (default)
       setIsDragging(true);
       setStartDrag({ x: e.clientX - offset.x, y: e.clientY - offset.y });
     }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const coords = getCanvasCoordinates(e.clientX, e.clientY);

    if (isSelecting) {
       const width = coords.x - startSelect.x;
       const height = coords.y - startSelect.y;
       setSelection({
         x: width > 0 ? startSelect.x : coords.x,
         y: height > 0 ? startSelect.y : coords.y,
         width: Math.abs(width),
         height: Math.abs(height),
       });
       draw(); // Redraw to show selection rectangle
    } else if (isDrawing && (tool === 'erase' || tool === 'draw')) {
       applyTool(coords.x, coords.y);
    } else if (isDragging) {
      setOffset({
        x: e.clientX - startDrag.x,
        y: e.clientY - startDrag.y,
      });
      // No need to call draw here, useEffect handles it
    }
  };

  const handleMouseUp = () => {
    if (isDrawing && (tool === 'erase' || tool === 'draw')) {
        saveToHistory(); // Save state after finishing a draw/erase stroke
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
     setIsSelecting(false);
     setIsDrawing(false);
     setIsDragging(false); // Stop dragging if mouse leaves canvas
   };

   const applyTool = (x: number, y: number) => {
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext('2d');
      if (!canvas || !ctx) return;

      ctx.save();
       // Apply canvas transform to draw in the correct place despite zoom/pan
       ctx.translate(offset.x, offset.y);
       ctx.scale(zoom, zoom);


      ctx.beginPath();
      // Adjust for brush size centering
      const correctedX = x - (brushSize / zoom / 2);
      const correctedY = y - (brushSize / zoom / 2);
      const size = brushSize / zoom;

       if (tool === 'erase') {
         ctx.clearRect(correctedX, correctedY, size, size);
       } else if (tool === 'draw') {
         ctx.fillStyle = drawColor;
         ctx.fillRect(correctedX, correctedY, size, size);
       }

       ctx.restore();

        // No need to call draw() here, modification is direct
        // But maybe call draw if underlying image needs redraw? Test this.
        // Let's try without first. If flicker/issues occur, add draw().
        // draw(); // Tentatively removed for performance
   };

    const handleUndo = () => {
      if (historyIndex > 0) {
         const newIndex = historyIndex - 1;
         setHistoryIndex(newIndex);
         restoreFromHistory(newIndex);
      }
   };

   const restoreFromHistory = (index: number) => {
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext('2d');
      if (!canvas || !ctx || !history[index]) return;
      ctx.putImageData(history[index], 0, 0);
      draw(); // Redraw with current zoom/pan after restoring
   };


  const handleZoomIn = () => setZoom(prev => Math.min(prev * 1.2, 10)); // Max zoom 10x
  const handleZoomOut = () => setZoom(prev => Math.max(prev / 1.2, 0.1)); // Min zoom 0.1x

  const handleSaveSelection = () => {
    const previewCanvas = previewCanvasRef.current;
    if (!previewCanvas || !selection) return;

    // Get data URL from the preview canvas (which shows the selection)
    const dataUrl = previewCanvas.toDataURL('image/png');
    onSaveSprite(selectedSpriteState, dataUrl);
    setSelection(null); // Clear selection after saving
    draw(); // Redraw to remove selection box
  };


  return (
    <div className="flex flex-col h-full">
       {/* Toolbar */}
       <div className="flex items-center gap-2 p-2 border-b pixel-border bg-muted/30 flex-wrap">
          <Button variant={tool === 'select' ? "secondary" : "ghost"} size="sm" onClick={() => setTool('select')} title="Select (S)">S</Button>
          <Button variant={tool === 'erase' ? "secondary" : "ghost"} size="icon" onClick={() => setTool('erase')} title="Eraser (E)">
             <Eraser size={16} />
          </Button>
          <Button variant={tool === 'draw' ? "secondary" : "ghost"} size="icon" onClick={() => setTool('draw')} title="Brush (B)">
             <Paintbrush size={16} />
          </Button>
          {(tool === 'erase' || tool === 'draw') && (
            <>
               <Slider
                   defaultValue={[brushSize]}
                   max={50}
                   min={1}
                   step={1}
                   className="w-24"
                   onValueChange={(value) => setBrushSize(value[0])}
                   aria-label="Brush Size"
               />
               <span className="text-xs w-6 text-right">{brushSize}px</span>
               {tool === 'draw' && (
                  <Input type="color" value={drawColor} onChange={(e) => setDrawColor(e.target.value)} className="w-10 h-8 p-1 input-pixel" title="Draw Color"/>
               )}
            </>
           )}
           <div className="flex items-center gap-1 ml-auto">
              <Button variant="ghost" size="icon" onClick={handleZoomIn} title="Zoom In (+)">
                <ZoomIn size={16} />
              </Button>
              <Button variant="ghost" size="icon" onClick={handleZoomOut} title="Zoom Out (-)">
                <ZoomOut size={16} />
              </Button>
               <Button variant="ghost" size="icon" onClick={handleUndo} disabled={historyIndex <= 0} title="Undo (Ctrl+Z)">
                <RotateCcw size={16} />
              </Button>
           </div>
       </div>

       {/* Canvas */}
       <div className="flex-grow overflow-hidden relative bg-gray-400 cursor-grab" style={{ cursor: isDragging ? 'grabbing' : (tool === 'select' ? 'crosshair' : (tool === 'erase' || tool === 'draw' ? 'crosshair' : 'grab')) }}>
         <canvas
           ref={canvasRef}
           onMouseDown={handleMouseDown}
           onMouseMove={handleMouseMove}
           onMouseUp={handleMouseUp}
           onMouseLeave={handleMouseLeave} // Stop drawing/dragging if mouse leaves
           className="absolute top-0 left-0" // Position canvas absolutely within the container
           style={{ imageRendering: 'pixelated', touchAction: 'none' }} // Prevent default touch actions like scrolling
         />
       </div>

        {/* Preview and Save Area */}
       {selection && (
           <div className="flex items-center gap-4 p-2 border-t pixel-border bg-muted/30">
              <div className="flex flex-col items-center">
                  <Label className="text-xs mb-1">Preview</Label>
                  <canvas ref={previewCanvasRef} className="pixel-border bg-white max-w-[64px] max-h-[64px]" style={{ imageRendering: 'pixelated' }} />
              </div>
             <div className="flex-grow space-y-2">
                 <Label htmlFor="sprite-state-select">Assign to Pose:</Label>
                 <Select value={selectedSpriteState} onValueChange={(value) => setSelectedSpriteState(value as SpriteState)}>
                    <SelectTrigger id="sprite-state-select" className="input-pixel w-full md:w-[180px]">
                      <SelectValue placeholder="Select Pose" />
                    </SelectTrigger>
                    <SelectContent className="bg-popover pixel-border">
                      {Object.keys(spriteSlots).map((state) => (
                        <SelectItem key={state} value={state} className="hover:bg-accent focus:bg-accent">
                          {state.charAt(0).toUpperCase() + state.slice(1)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
             </div>

             <Button onClick={handleSaveSelection} size="sm" className="btn-pixel-accent">
               <Save size={16} className="mr-2" /> Save Pose
             </Button>
           </div>
       )}
    </div>
  );
};

export default SpriteEditor;

    