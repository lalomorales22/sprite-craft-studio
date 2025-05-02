
'use client';

import React, { useRef, useState, useEffect, useCallback } from 'react';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input'; // Import Input
import { Eraser, Paintbrush, ZoomIn, ZoomOut, RotateCcw, Save, MousePointer, Slice, CircleHelp } from 'lucide-react'; // Added Slice, CircleHelp
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
} from "@/components/ui/tooltip";
import {
   AlertDialog,
   AlertDialogAction,
   AlertDialogCancel,
   AlertDialogContent,
   AlertDialogDescription,
   AlertDialogFooter,
   AlertDialogHeader,
   AlertDialogTitle,
   AlertDialogTrigger,
 } from "@/components/ui/alert-dialog" // Import Alert Dialog
import type { SpriteState, SpriteSlots } from '@/app/page'; // Import types

type Tool = 'select' | 'erase' | 'draw' | 'pan';

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
  const [tool, setTool] = useState<Tool>('pan');
  const [brushSize, setBrushSize] = useState(5);
  const [drawColor, setDrawColor] = useState('#000000');
  const [isDrawing, setIsDrawing] = useState(false);
  const [history, setHistory] = useState<ImageData[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [selectedSpriteState, setSelectedSpriteState] = useState<SpriteState>('standing');


  // --- Drawing Logic ---
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d', { willReadFrequently: true });
    const img = imageRef.current;

    if (!canvas || !ctx ) return;
    ctx.imageSmoothingEnabled = false; // Ensure crisp pixels

    // Clear canvas & draw checkered background
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const patternSize = 10; // Checkered pattern size
    for (let i = 0; i < canvas.width; i += patternSize) {
        for (let j = 0; j < canvas.height; j += patternSize) {
            ctx.fillStyle = ((Math.floor(i / patternSize) + Math.floor(j / patternSize)) % 2 === 0) ? '#ccc' : '#fff';
            ctx.fillRect(i, j, patternSize, patternSize);
        }
    }

    // Apply zoom and pan
    ctx.save();
    ctx.translate(offset.x, offset.y);
    ctx.scale(zoom, zoom);

    // Draw the current state from history
     if (history[historyIndex]) {
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = history[historyIndex].width;
        tempCanvas.height = history[historyIndex].height;
        const tempCtx = tempCanvas.getContext('2d');
        if (tempCtx) {
            tempCtx.putImageData(history[historyIndex], 0, 0);
            ctx.drawImage(tempCanvas, 0, 0);
        }
     } else if (img) { // Fallback: Draw original image if history is empty
         console.log("Drawing fallback image as history is empty or invalid index.");
         // Check if the canvas is tainted before attempting to draw
         try {
            ctx.drawImage(img, 0, 0);
         } catch (e) {
             console.error("Error drawing fallback image (potentially tainted canvas):", e);
             // Display an error message on the canvas?
             ctx.restore(); // Restore before drawing error message
             ctx.fillStyle = 'red';
             ctx.font = '16px Pixelify Sans';
             ctx.textAlign = 'center';
             ctx.fillText('Error: Could not load image (CORS?)', canvas.width / 2, canvas.height / 2);
             return; // Stop further drawing
         }
     }

     // Draw selection rectangle
    if (selection && tool === 'select') {
      ctx.strokeStyle = 'rgba(255, 105, 180, 0.9)'; // Accent Pink
      ctx.lineWidth = 2 / zoom;
      ctx.setLineDash([4 / zoom, 2 / zoom]);
      ctx.strokeRect(selection.x, selection.y, selection.width, selection.height);
      ctx.setLineDash([]);
    }

    ctx.restore();
  }, [zoom, offset, selection, history, historyIndex, tool]);

  // --- History Management ---
  const saveToHistory = useCallback(() => {
     const canvas = canvasRef.current;
     const img = imageRef.current;
     if (!canvas || !img) return;

     // Need to capture the *current visual state* but at *original image resolution*
     // Create a temporary canvas with original image dimensions
     const tempCanvas = document.createElement('canvas');
     tempCanvas.width = img.width;
     tempCanvas.height = img.height;
     const tempCtx = tempCanvas.getContext('2d', { willReadFrequently: true });
     if (!tempCtx) return;

     tempCtx.imageSmoothingEnabled = false;

      // Draw the checkered background first (on the temp canvas)
     const patternSize = 10;
     for (let i = 0; i < tempCanvas.width; i += patternSize) {
        for (let j = 0; j < tempCanvas.height; j += patternSize) {
            tempCtx.fillStyle = ((Math.floor(i / patternSize) + Math.floor(j / patternSize)) % 2 === 0) ? '#ccc' : '#fff';
            tempCtx.fillRect(i, j, patternSize, patternSize);
        }
     }

      // Draw the current image data (from the last history state) onto the temp canvas
      if (history[historyIndex]) {
         const historyCanvas = document.createElement('canvas');
         historyCanvas.width = history[historyIndex].width;
         historyCanvas.height = history[historyIndex].height;
         historyCanvas.getContext('2d')?.putImageData(history[historyIndex], 0, 0);
         tempCtx.drawImage(historyCanvas, 0, 0);
      }


     // Get ImageData from the correctly scaled temporary canvas
      try {
        const imageData = tempCtx.getImageData(0, 0, tempCanvas.width, tempCanvas.height);
         const newHistory = history.slice(0, historyIndex + 1);
         // Avoid saving identical states
         if (historyIndex >= 0) {
             const lastData = history[historyIndex].data;
             const currentData = imageData.data;
             let same = true;
             for (let i = 0; i < lastData.length; i++) {
                 if (lastData[i] !== currentData[i]) {
                     same = false;
                     break;
                 }
             }
             if (same) {
                 console.log("Skipping save to history: state unchanged.");
                 return; // Don't save if identical to previous state
             }
         }

         newHistory.push(imageData);
         setHistory(newHistory);
         setHistoryIndex(newHistory.length - 1);
         console.log("Saved to history. Index:", newHistory.length - 1);
      } catch (e) {
          console.error("Error getting ImageData for history:", e);
          // Potentially tainted canvas issue
          if (e instanceof DOMException && e.name === 'SecurityError') {
             console.warn("SpriteEditor: Could not save history due to CORS. Edits might not be properly saved.");
             // Maybe show a toast?
          }
      }
  }, [history, historyIndex]);

  const handleUndo = useCallback(() => {
      if (historyIndex > 0) {
         const newIndex = historyIndex - 1;
         setHistoryIndex(newIndex);
         console.log("Undo. History index:", newIndex);
         // Draw is handled by useEffect dependency on historyIndex
      } else {
          console.log("Cannot undo further.");
      }
   }, [historyIndex]);

  // --- Image Loading & Initialization ---
  useEffect(() => {
    console.log("SpriteEditor: Image URL Changed:", imageUrl?.substring(0, 100) + "...");
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    const img = new window.Image();
    // IMPORTANT: Add crossOrigin attribute BEFORE setting src
    img.crossOrigin = "anonymous"; // Allow loading cross-origin images for canvas manipulation

    img.onload = () => {
       console.log("SpriteEditor: Image Loaded successfully:", img.width, img.height);
      if (!canvas || !ctx) {
          console.error("SpriteEditor: Canvas or context not available on image load.");
          return;
      }
      imageRef.current = img;

      // Set canvas actual drawing surface size to match image
       // Use CSS for display size, keep canvas resolution matching image
       canvas.width = img.width;
       canvas.height = img.height;

      // Reset state for new image
      setZoom(1);
      setSelection(null);
      setIsSelecting(false);
      setTool('pan');
      setHistory([]); // Clear history for new image
      setHistoryIndex(-1);

      // Center the image initially
       const container = canvas.parentElement; // Get the container div
       if (container) {
           const containerWidth = container.offsetWidth;
           const containerHeight = container.offsetHeight;
           // Fit image within container initially, but ensure canvas resolution matches image
           const initialZoomX = containerWidth / img.width;
           const initialZoomY = containerHeight / img.height;
           const initialZoom = Math.min(1, initialZoomX, initialZoomY); // Max 1x zoom

           // Canvas resolution stays img.width x img.height
           // Adjust CSS size for initial view
           canvas.style.width = `${img.width * initialZoom}px`;
           canvas.style.height = `${img.height * initialZoom}px`;


           const initialOffsetX = (containerWidth - img.width * initialZoom) / 2;
           const initialOffsetY = (containerHeight - img.height * initialZoom) / 2;
           setOffset({ x: initialOffsetX, y: initialOffsetY });
           setZoom(initialZoom); // Set the calculated initial zoom
           console.log("SpriteEditor: Initial zoom:", initialZoom, "Offset:", initialOffsetX, initialOffsetY, "Canvas Size (CSS):", canvas.style.width, canvas.style.height, "Resolution:", canvas.width, canvas.height);
       } else {
            console.warn("SpriteEditor: Could not find container element for initial centering.");
            setOffset({ x: 0, y: 0 }); // Fallback if no container
            setZoom(1);
            canvas.style.width = `${img.width}px`;
            canvas.style.height = `${img.height}px`;
       }

       // Draw initial image onto a temporary canvas to get ImageData for history
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = img.width;
        tempCanvas.height = img.height;
        const tempCtx = tempCanvas.getContext('2d', { willReadFrequently: true });
        if (tempCtx) {
            tempCtx.imageSmoothingEnabled = false;
            tempCtx.drawImage(img, 0, 0);
             try {
                 const initialImageData = tempCtx.getImageData(0, 0, tempCanvas.width, tempCanvas.height); // Use tempCanvas dimensions
                 setHistory([initialImageData]);
                 setHistoryIndex(0);
                 console.log("SpriteEditor: Initial history saved from loaded image.");
                  // Explicitly trigger draw after history is set
                  requestAnimationFrame(() => draw());
             } catch (e) {
                  console.error("SpriteEditor: Error getting initial ImageData:", e);
                  // Handle CORS or other errors
                  if (e instanceof DOMException && e.name === 'SecurityError') {
                     console.warn("SpriteEditor: Could not get ImageData due to CORS. Editing features may be limited.");
                     // Set history with a placeholder or redraw differently?
                     // For now, just clear history to avoid errors.
                     setHistory([]);
                     setHistoryIndex(-1);
                     // Force a draw call with the original image ref (may still fail if tainted)
                     requestAnimationFrame(() => draw());
                  }
             }
        } else {
             console.error("SpriteEditor: Could not get temp context for initial history save.");
             requestAnimationFrame(() => draw()); // Still try to draw the image ref
        }
    };
    img.onerror = (e) => {
      console.error("SpriteEditor: Error loading image:", e, "from URL:", imageUrl?.substring(0, 100) + "...");
      if (canvas && ctx) {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          // Optionally draw error message on canvas
          ctx.fillStyle = 'red';
          ctx.font = '16px Pixelify Sans';
          ctx.textAlign = 'center';
          ctx.fillText('Error loading image.', canvas.width / 2, canvas.height / 2);
      }
      imageRef.current = null; setHistory([]); setHistoryIndex(-1); setSelection(null);
    }

    // Set the src AFTER defining onload/onerror and setting crossOrigin
    if (imageUrl) {
        console.log("Setting image src:", imageUrl.substring(0, 100) + "...");
        img.src = imageUrl;
    } else {
        console.warn("SpriteEditor: Received null or empty imageUrl.");
        if (canvas && ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
        imageRef.current = null; setHistory([]); setHistoryIndex(-1); setSelection(null);
    }


    return () => {
        // Cleanup image reference
        if (imageRef.current) {
            imageRef.current.onload = null;
            imageRef.current.onerror = null;
        }
        imageRef.current = null;
        console.log("SpriteEditor: Image ref cleaned up.");
     };
  }, [imageUrl, draw]); // Include draw in dependencies now that it's stable

    // Redraw whenever relevant state changes
    useEffect(() => {
        console.log("SpriteEditor: Redrawing canvas due to state change.", { zoom, offset, selection: !!selection, historyIndex, tool });
        requestAnimationFrame(() => draw());
    }, [draw, zoom, offset, selection, historyIndex, tool]); // Added tool


   // Update preview canvas
  useEffect(() => {
    const previewCanvas = previewCanvasRef.current;
    const previewCtx = previewCanvas?.getContext('2d', { willReadFrequently: true });

    if (!previewCanvas || !previewCtx || !selection || !imageRef.current || selection.width < 1 || selection.height < 1) {
        if(previewCanvas && previewCtx) previewCtx.clearRect(0, 0, previewCanvas.width, previewCanvas.height);
        return;
    }
    previewCtx.imageSmoothingEnabled = false;

     const imgWidth = imageRef.current.width;
     const imgHeight = imageRef.current.height;
     const clampedX = Math.max(0, Math.floor(selection.x));
     const clampedY = Math.max(0, Math.floor(selection.y));
     const clampedW = Math.min(imgWidth - clampedX, Math.max(1, Math.floor(selection.width)));
     const clampedH = Math.min(imgHeight - clampedY, Math.max(1, Math.floor(selection.height)));

     if (clampedW > 0 && clampedH > 0 && historyIndex >= 0 && history[historyIndex]) {
         const sourceImageData = history[historyIndex];
         const tempCanvas = document.createElement('canvas');
         tempCanvas.width = sourceImageData.width; tempCanvas.height = sourceImageData.height;
         const tempCtx = tempCanvas.getContext('2d');
         if (tempCtx) {
             tempCtx.putImageData(sourceImageData, 0, 0);
             previewCanvas.width = clampedW; previewCanvas.height = clampedH;
             previewCtx.clearRect(0, 0, previewCanvas.width, previewCanvas.height);

             // Draw checkered background for preview transparency
             const patternSize = 5;
             for (let i = 0; i < previewCanvas.width; i += patternSize) {
                 for (let j = 0; j < previewCanvas.height; j += patternSize) {
                     previewCtx.fillStyle = ((Math.floor(i / patternSize) + Math.floor(j / patternSize)) % 2 === 0) ? '#ccc' : '#fff';
                     previewCtx.fillRect(i, j, patternSize, patternSize);
                 }
             }

             // Draw selected portion onto preview
             previewCtx.drawImage( tempCanvas, clampedX, clampedY, clampedW, clampedH, 0, 0, clampedW, clampedH );
         } else { previewCtx.clearRect(0, 0, previewCanvas.width, previewCanvas.height); }
     } else { previewCtx.clearRect(0, 0, previewCanvas.width, previewCanvas.height); }
  }, [selection, history, historyIndex]); // Removed zoom, offset as they don't affect preview content


  // --- Mouse Event Handling ---
  const getCanvasCoordinates = (clientX: number, clientY: number): { x: number; y: number } => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    // Calculate mouse position relative to the *displayed* canvas element
    const mouseX = clientX - rect.left;
    const mouseY = clientY - rect.top;

    // Convert mouse position to image coordinates based on current zoom and offset
    // Note: offset is applied *before* scaling in the draw function
    const imageX = (mouseX - offset.x) / zoom;
    const imageY = (mouseY - offset.y) / zoom;

    return { x: imageX, y: imageY };
};

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
     const coords = getCanvasCoordinates(e.clientX, e.clientY);
     console.log("Mouse Down - Canvas Coords:", coords); // Log coords
     if (tool === 'select') {
       setIsSelecting(true); setStartSelect(coords);
       setSelection({ x: coords.x, y: coords.y, width: 0, height: 0});
     } else if (tool === 'erase' || tool === 'draw') {
        setIsDrawing(true); applyTool(coords.x, coords.y);
     } else if (tool === 'pan') {
       setIsDragging(true); setStartDrag({ x: e.clientX - offset.x, y: e.clientY - offset.y });
     }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const coords = getCanvasCoordinates(e.clientX, e.clientY);
    const img = imageRef.current;
    if (!img) return;

    if (isSelecting && tool === 'select') {
       const currentX = Math.max(0, Math.min(coords.x, img.width));
       const currentY = Math.max(0, Math.min(coords.y, img.height));
       const width = currentX - startSelect.x; const height = currentY - startSelect.y;
       setSelection({ x: width > 0 ? startSelect.x : currentX, y: height > 0 ? startSelect.y : currentY,
         width: Math.abs(width), height: Math.abs(height), });
    } else if (isDrawing && (tool === 'erase' || tool === 'draw')) {
       applyTool(coords.x, coords.y);
    } else if (isDragging && tool === 'pan') {
       // Calculate the new offset based on mouse movement
       const newOffsetX = e.clientX - startDrag.x;
       const newOffsetY = e.clientY - startDrag.y;
       setOffset({ x: newOffsetX, y: newOffsetY });

       // Update canvas style immediately for panning feedback
       const canvas = canvasRef.current;
       if (canvas) {
           canvas.style.transform = `translate(${newOffsetX}px, ${newOffsetY}px) scale(${zoom})`;
       }
    }
  };

  const handleMouseUp = () => {
    if (isDrawing && (tool === 'erase' || tool === 'draw')) {
        saveToHistory();
    }
     if (isSelecting && tool === 'select' && selection && (selection.width < 1 || selection.height < 1)) {
        setSelection(null);
     }
     if (isDragging && tool === 'pan') {
         // Ensure final offset state is set (already done in mouseMove, but good practice)
         // Reset transform style if needed (or let draw handle it)
         const canvas = canvasRef.current;
         if (canvas) {
             // Let the main draw loop handle the final transform based on state
             canvas.style.transform = '';
             requestAnimationFrame(draw); // Trigger redraw with final state
         }
     }
    setIsSelecting(false); setIsDrawing(false); setIsDragging(false);
  };

   const handleMouseLeave = () => {
    if (isDrawing && (tool === 'erase' || tool === 'draw')) saveToHistory();
     if (isSelecting && selection && (selection.width < 1 || selection.height < 1)) setSelection(null);
      if (isDragging && tool === 'pan') {
         // Ensure final offset state is set and redraw
         const canvas = canvasRef.current;
          if (canvas) {
              canvas.style.transform = '';
              requestAnimationFrame(draw);
          }
      }
     setIsSelecting(false); setIsDrawing(false); setIsDragging(false);
   };

   // --- Wheel Event for Zoom ---
    const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
        e.preventDefault();
        const canvas = canvasRef.current;
        if (!canvas) return;

        const rect = canvas.getBoundingClientRect();
        // Mouse position relative to canvas top-left
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        // Calculate coordinates relative to the *image* before zoom
        const imageX = (mouseX - offset.x) / zoom;
        const imageY = (mouseY - offset.y) / zoom;

        // Determine zoom direction and factor
        const delta = e.deltaY > 0 ? 1 / 1.1 : 1.1; // Zoom out / Zoom in factor
        const newZoom = Math.max(0.1, Math.min(zoom * delta, 32)); // Clamp zoom level

        // Calculate new offset to keep the point under the mouse stationary
        const newOffsetX = mouseX - imageX * newZoom;
        const newOffsetY = mouseY - imageY * newZoom;

        setZoom(newZoom);
        setOffset({ x: newOffsetX, y: newOffsetY });

         // Update canvas style immediately for zoom feedback
         canvas.style.transform = `translate(${newOffsetX}px, ${newOffsetY}px) scale(${newZoom})`;
         canvas.style.width = `${canvas.width * newZoom}px`;
         canvas.style.height = `${canvas.height * newZoom}px`;

          // Let the main draw loop handle the final drawing at the new scale
         requestAnimationFrame(draw);
    };

    // --- Keyboard Shortcuts ---
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
             // Ignore if typing in an input field
             if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement) {
                return;
             }

             // Tool selection
             if (e.key.toLowerCase() === 'p') { setTool('pan'); e.preventDefault(); }
             else if (e.key.toLowerCase() === 's') { setTool('select'); e.preventDefault(); }
             else if (e.key.toLowerCase() === 'b') { setTool('draw'); e.preventDefault(); }
             else if (e.key.toLowerCase() === 'e') { setTool('erase'); e.preventDefault(); }
             // Zoom
             else if (e.key === '+' || e.key === '=') { handleZoomIn(); e.preventDefault(); }
             else if (e.key === '-' || e.key === '_') { handleZoomOut(); e.preventDefault(); }
             // Undo
             else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
                 handleUndo();
                 e.preventDefault();
             }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [handleUndo]); // Add handleUndo dependency


   // --- Tool Application Logic ---
   const applyTool = (imgX: number, imgY: number) => {
      const canvas = canvasRef.current;
      // Don't get context here, operate on ImageData
      const img = imageRef.current;
      if (!canvas || !img || historyIndex < 0 || !history[historyIndex]) {
          console.warn("Cannot apply tool: missing canvas, image, or history state.");
          return;
      }

      // Get the current ImageData from history
      const currentImageData = history[historyIndex];
      const data = currentImageData.data;
      const width = currentImageData.width;
      //const height = currentImageData.height; // Not needed for index calculation

      const correctedX = Math.floor(imgX);
      const correctedY = Math.floor(imgY);
      const size = Math.max(1, Math.floor(brushSize));
      const halfSize = Math.floor(size / 2);

      let colorR = 0, colorG = 0, colorB = 0;
      if (tool === 'draw') {
           const hex = drawColor.replace('#', '');
           colorR = parseInt(hex.substring(0, 2), 16);
           colorG = parseInt(hex.substring(2, 4), 16);
           colorB = parseInt(hex.substring(4, 6), 16);
      }

      // Iterate over the brush area
      for (let y = -halfSize; y < size - halfSize; y++) {
          for (let x = -halfSize; x < size - halfSize; x++) {
              const pixelX = correctedX + x;
              const pixelY = correctedY + y;

              // Bounds check
              if (pixelX >= 0 && pixelX < width && pixelY >= 0 && pixelY < currentImageData.height) {
                  const index = (pixelY * width + pixelX) * 4; // Calculate the index in the ImageData array

                   if (tool === 'erase') {
                       // Set RGBA to fully transparent (0, 0, 0, 0)
                       data[index] = 0;     // R
                       data[index + 1] = 0; // G
                       data[index + 2] = 0; // B
                       data[index + 3] = 0; // A
                   } else if (tool === 'draw') {
                       // Set RGB to drawColor and Alpha to fully opaque (255)
                       data[index] = colorR;
                       data[index + 1] = colorG;
                       data[index + 2] = colorB;
                       data[index + 3] = 255;
                   }
              }
          }
      }

      // --- IMPORTANT: Update the LATEST history entry directly with the modified ImageData ---
      const currentHistory = [...history];
      currentHistory[historyIndex] = new ImageData(data, width, currentImageData.height); // Create new ImageData object
      setHistory(currentHistory); // Update state to trigger redraw via useEffect

      // Don't call saveToHistory() here, only on mouseUp/mouseLeave
      // Trigger a redraw immediately for responsiveness
      requestAnimationFrame(draw);
   };


   // --- Zoom & Save ---
    const handleZoom = (factor: number) => {
         const canvas = canvasRef.current;
         if (!canvas) return;

         const newZoom = Math.max(0.1, Math.min(zoom * factor, 32)); // Clamp zoom level

         // Center zoom for simplicity
         const container = canvas.parentElement;
         if (container) {
             const containerWidth = container.offsetWidth;
             const containerHeight = container.offsetHeight;
             const imgWidth = canvas.width; // Use canvas resolution
             const imgHeight = canvas.height;

             // Calculate new offset to keep center point stable
             const currentCenterX = (containerWidth / 2 - offset.x) / zoom;
             const currentCenterY = (containerHeight / 2 - offset.y) / zoom;

             const newOffsetX = containerWidth / 2 - currentCenterX * newZoom;
             const newOffsetY = containerHeight / 2 - currentCenterY * newZoom;


              setZoom(newZoom);
              setOffset({ x: newOffsetX, y: newOffsetY });

             // Update canvas style immediately for zoom feedback
             canvas.style.transform = `translate(${newOffsetX}px, ${newOffsetY}px) scale(${newZoom})`;
             canvas.style.width = `${imgWidth * newZoom}px`;
             canvas.style.height = `${imgHeight * newZoom}px`;

              // Let the main draw loop handle the final drawing at the new scale
             requestAnimationFrame(draw);
         }
    };
    const handleZoomIn = () => handleZoom(1.2);
    const handleZoomOut = () => handleZoom(1 / 1.2);

    const handleSaveSelection = () => {
        const previewCanvas = previewCanvasRef.current;
        if (!previewCanvas || !selection || selection.width < 1 || selection.height < 1) {
            console.warn("Cannot save: Invalid selection."); return;
        };
        try {
            const dataUrl = previewCanvas.toDataURL('image/png');
            onSaveSprite(selectedSpriteState, dataUrl);
            setSelection(null); // Clear selection after saving
        } catch (e) { console.error("Error generating data URL:", e); }
    };

   // --- Cursor Style ---
   const getCursor = () => {
        switch (tool) {
            case 'pan': return isDragging ? 'grabbing' : 'grab';
            case 'select': return 'crosshair';
            case 'erase': case 'draw': return 'crosshair'; // TODO: Custom brush cursor?
            default: return 'default';
        }
    };


  return (
    <div className="flex flex-col h-full bg-muted/20">
       {/* Toolbar */}
       <TooltipProvider>
           <div className="flex items-center gap-1 p-1 border-b pixel-border bg-muted/50 flex-wrap">
              {/* Tools */}
              <Tooltip>
                  <TooltipTrigger asChild>
                     <Button variant={tool === 'pan' ? "secondary" : "ghost"} size="icon" onClick={() => setTool('pan')} className="h-8 w-8"> <MousePointer size={16} /> </Button>
                  </TooltipTrigger>
                  <TooltipContent><p>Pan (P)</p></TooltipContent>
               </Tooltip>
               <Tooltip>
                   <TooltipTrigger asChild>
                      <Button variant={tool === 'select' ? "secondary" : "ghost"} size="icon" onClick={() => setTool('select')} className="h-8 w-8"> <Slice size={16}/> </Button>
                   </TooltipTrigger>
                   <TooltipContent><p>Select (S)</p></TooltipContent>
               </Tooltip>
              <Tooltip>
                 <TooltipTrigger asChild>
                    <Button variant={tool === 'draw' ? "secondary" : "ghost"} size="icon" onClick={() => setTool('draw')} className="h-8 w-8"> <Paintbrush size={16} /> </Button>
                 </TooltipTrigger>
                 <TooltipContent><p>Brush (B)</p></TooltipContent>
              </Tooltip>
              <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant={tool === 'erase' ? "secondary" : "ghost"} size="icon" onClick={() => setTool('erase')} className="h-8 w-8"> <Eraser size={16} /> </Button>
                  </TooltipTrigger>
                  <TooltipContent><p>Eraser (E)</p></TooltipContent>
              </Tooltip>

              {/* Brush/Eraser Options */}
              {(tool === 'erase' || tool === 'draw') && (
                <div className="flex items-center mx-2">
                   <Label htmlFor="brush-size" className="sr-only">Size</Label>
                   <Slider id="brush-size" defaultValue={[brushSize]} max={50} min={1} step={1} className="w-20" onValueChange={(value) => setBrushSize(value[0])} aria-label="Brush Size"/>
                   <span className="text-xs w-6 text-right mr-2">{brushSize}px</span>
                   {tool === 'draw' && (
                      <Tooltip>
                           <TooltipTrigger asChild>
                               <Input aria-label="Draw color" type="color" value={drawColor} onChange={(e) => setDrawColor(e.target.value)} className="w-8 h-8 p-0.5 input-pixel" />
                           </TooltipTrigger>
                           <TooltipContent><p>Draw Color</p></TooltipContent>
                      </Tooltip>
                   )}
                </div>
               )}

               {/* Zoom & Undo */}
               <div className="flex items-center gap-1 ml-auto">
                   <Tooltip>
                      <TooltipTrigger asChild>
                          <Button variant="ghost" size="icon" onClick={handleZoomIn} className="h-8 w-8"> <ZoomIn size={16} /> </Button>
                      </TooltipTrigger>
                      <TooltipContent><p>Zoom In (+)</p></TooltipContent>
                   </Tooltip>
                   <Tooltip>
                      <TooltipTrigger asChild>
                          <Button variant="ghost" size="icon" onClick={handleZoomOut} className="h-8 w-8"> <ZoomOut size={16} /> </Button>
                      </TooltipTrigger>
                      <TooltipContent><p>Zoom Out (-)</p></TooltipContent>
                   </Tooltip>
                   <Tooltip>
                      <TooltipTrigger asChild>
                           <Button variant="ghost" size="icon" onClick={handleUndo} disabled={historyIndex <= 0} className="h-8 w-8"> <RotateCcw size={16} /> </Button>
                      </TooltipTrigger>
                       <TooltipContent><p>Undo (Ctrl+Z)</p></TooltipContent>
                   </Tooltip>
                     {/* Help Dialog Trigger */}
                   <AlertDialog>
                       <Tooltip>
                          <TooltipTrigger asChild>
                               <AlertDialogTrigger asChild>
                                 <Button variant="ghost" size="icon" className="h-8 w-8"> <CircleHelp size={16} /> </Button>
                               </AlertDialogTrigger>
                          </TooltipTrigger>
                          <TooltipContent><p>Help / Shortcuts</p></TooltipContent>
                       </Tooltip>
                       <AlertDialogContent className="pixel-border bg-card">
                         <AlertDialogHeader>
                           <AlertDialogTitle>Editor Shortcuts</AlertDialogTitle>
                           <AlertDialogDescription>
                             <ul className="list-disc list-inside space-y-1 text-sm">
                               <li><kbd className="px-1.5 py-0.5 border rounded bg-muted font-mono text-xs">P</kbd>: Pan Tool</li>
                               <li><kbd className="px-1.5 py-0.5 border rounded bg-muted font-mono text-xs">S</kbd>: Select Tool</li>
                               <li><kbd className="px-1.5 py-0.5 border rounded bg-muted font-mono text-xs">B</kbd>: Brush Tool</li>
                               <li><kbd className="px-1.5 py-0.5 border rounded bg-muted font-mono text-xs">E</kbd>: Eraser Tool</li>
                               <li><kbd className="px-1.5 py-0.5 border rounded bg-muted font-mono text-xs">+</kbd> / <kbd className="px-1.5 py-0.5 border rounded bg-muted font-mono text-xs">=</kbd>: Zoom In</li>
                               <li><kbd className="px-1.5 py-0.5 border rounded bg-muted font-mono text-xs">-</kbd> / <kbd className="px-1.5 py-0.5 border rounded bg-muted font-mono text-xs">_</kbd>: Zoom Out</li>
                               <li><kbd className="px-1.5 py-0.5 border rounded bg-muted font-mono text-xs">Ctrl</kbd>+<kbd className="px-1.5 py-0.5 border rounded bg-muted font-mono text-xs">Z</kbd> (or <kbd className="px-1.5 py-0.5 border rounded bg-muted font-mono text-xs">Cmd</kbd>+<kbd className="px-1.5 py-0.5 border rounded bg-muted font-mono text-xs">Z</kbd>): Undo</li>
                               <li><b>Mouse Wheel</b>: Zoom In/Out</li>
                             </ul>
                           </AlertDialogDescription>
                         </AlertDialogHeader>
                         <AlertDialogFooter>
                           <AlertDialogAction className="btn-pixel">Got it!</AlertDialogAction>
                         </AlertDialogFooter>
                       </AlertDialogContent>
                   </AlertDialog>
               </div>
           </div>
       </TooltipProvider>

        {/* Canvas Container - for centering and overflow */}
        <div className="flex-grow overflow-auto relative bg-gray-400 flex items-center justify-center" style={{ cursor: getCursor() }}>
          <canvas
            ref={canvasRef}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseLeave}
            onWheel={handleWheel} // Add wheel listener
            className="absolute" // Use absolute positioning within the centered container
            style={{
                imageRendering: 'pixelated',
                touchAction: 'none', // disable browser default touch actions like scroll/zoom
                transformOrigin: 'top left', // Ensure scaling originates correctly
                // Width/Height and Transform are set dynamically by useEffect/Wheel/Mouse handlers
             }}
         />
       </div>


        {/* Preview and Save Area */}
       {tool === 'select' && selection && selection.width >= 1 && selection.height >= 1 && (
           <div className="flex items-center gap-4 p-2 border-t pixel-border bg-muted/50">
              <div className="flex flex-col items-center">
                  <Label className="text-xs mb-1 font-semibold">Preview</Label>
                  <canvas ref={previewCanvasRef} className="pixel-border bg-white max-w-[64px] max-h-[64px]"
                    style={{ imageRendering: 'pixelated' }}
                    width={Math.max(1, Math.floor(selection.width))} height={Math.max(1, Math.floor(selection.height))} />
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
