
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
  const containerRef = useRef<HTMLDivElement>(null); // Ref for the canvas container
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const previewCanvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false); // For panning
  const [startDrag, setStartDrag] = useState({ x: 0, y: 0 }); // For panning calculation
  const [selection, setSelection] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  const [isSelecting, setIsSelecting] = useState(false);
  const [startSelect, setStartSelect] = useState({ x: 0, y: 0 }); // For selection calculation
  const [tool, setTool] = useState<Tool>('pan');
  const [brushSize, setBrushSize] = useState(5);
  const [drawColor, setDrawColor] = useState('#000000');
  const [isDrawing, setIsDrawing] = useState(false); // For draw/erase
  const [history, setHistory] = useState<ImageData[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [selectedSpriteState, setSelectedSpriteState] = useState<SpriteState>('standing');
  const [imageDimensions, setImageDimensions] = useState({ width: 0, height: 0 }); // Store original image dimensions

  // --- Drawing Logic ---
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d', { willReadFrequently: true });

    if (!canvas || !ctx || imageDimensions.width === 0 || imageDimensions.height === 0) return;

    ctx.imageSmoothingEnabled = false; // Ensure crisp pixels

    // Clear canvas (drawing surface)
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Apply zoom and pan *relative to the canvas center* for stability
    ctx.save();
    ctx.translate(canvas.width / 2 + offset.x, canvas.height / 2 + offset.y); // Move origin to center + offset
    ctx.scale(zoom, zoom);
    ctx.translate(-imageDimensions.width / 2, -imageDimensions.height / 2); // Move origin to top-left of scaled image

    // Draw checkered background covering the image area
    const patternSize = 10 / zoom; // Make pattern smaller when zoomed in
    for (let i = 0; i < imageDimensions.width; i += patternSize) {
      for (let j = 0; j < imageDimensions.height; j += patternSize) {
        ctx.fillStyle = ((Math.floor(i / patternSize) + Math.floor(j / patternSize)) % 2 === 0) ? '#ccc' : '#fff';
        ctx.fillRect(i, j, patternSize, patternSize);
      }
    }

    // Draw the current state from history
    if (history[historyIndex]) {
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = history[historyIndex].width;
      tempCanvas.height = history[historyIndex].height;
      const tempCtx = tempCanvas.getContext('2d');
      if (tempCtx) {
        tempCtx.putImageData(history[historyIndex], 0, 0);
        // Ensure drawing happens at the correct (0,0) relative to the scaled/translated context
        ctx.drawImage(tempCanvas, 0, 0, imageDimensions.width, imageDimensions.height);
      } else {
          console.error("SpriteEditor: Could not get temp context for drawing history.");
      }
    } else {
        console.warn("SpriteEditor: No valid history state to draw.");
         // Optionally draw a placeholder or error message if history is empty when expected
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
  }, [zoom, offset, selection, history, historyIndex, tool, imageDimensions]);


  // --- History Management ---
   const saveToHistory = useCallback(() => {
     const canvas = canvasRef.current;
     const img = imageRef.current; // Use imageRef for dimensions
     if (!canvas || !img || imageDimensions.width === 0 || imageDimensions.height === 0) {
        console.warn("Cannot save history: Canvas or image dimensions not ready.");
        return;
     }

     // Need to capture the *current visual state* but at *original image resolution*
     // Create a temporary canvas with original image dimensions
     const tempCanvas = document.createElement('canvas');
     tempCanvas.width = imageDimensions.width; // Use stored original dimensions
     tempCanvas.height = imageDimensions.height;
     const tempCtx = tempCanvas.getContext('2d', { willReadFrequently: true });
     if (!tempCtx) {
        console.error("Could not create temporary canvas context for history.");
        return;
     }

     tempCtx.imageSmoothingEnabled = false;

      // Draw the checkered background first (on the temp canvas) - Optional, depends if you want it in history
     // const patternSize = 10;
     // for (let i = 0; i < tempCanvas.width; i += patternSize) {
     //    for (let j = 0; j < tempCanvas.height; j += patternSize) {
     //        tempCtx.fillStyle = ((Math.floor(i / patternSize) + Math.floor(j / patternSize)) % 2 === 0) ? '#ccc' : '#fff';
     //        tempCtx.fillRect(i, j, patternSize, patternSize);
     //    }
     // }

      // Draw the current image data (from the last history state) onto the temp canvas
      if (historyIndex >= 0 && history[historyIndex]) {
         // Create a canvas from the ImageData in history
         const historyCanvas = document.createElement('canvas');
         historyCanvas.width = history[historyIndex].width;
         historyCanvas.height = history[historyIndex].height;
         const historyCtx = historyCanvas.getContext('2d');
         if (historyCtx) {
            historyCtx.putImageData(history[historyIndex], 0, 0);
            // Draw the history canvas onto the temp canvas
            tempCtx.drawImage(historyCanvas, 0, 0, tempCanvas.width, tempCanvas.height);
         } else {
             console.error("Could not get context for history canvas.");
             return; // Abort if context fails
         }
      } else {
          console.warn("No valid history state to save from.");
          // Draw the original image if history is empty? This might be needed on first edit.
          if(img) {
              try {
                tempCtx.drawImage(img, 0, 0, tempCanvas.width, tempCanvas.height);
              } catch (e) {
                 console.error("Error drawing original image to history temp canvas:", e);
                 return; // Abort on error
              }
          } else {
              return; // Abort if no history and no original image ref
          }
      }


     // Get ImageData from the correctly scaled temporary canvas
      try {
        const imageData = tempCtx.getImageData(0, 0, tempCanvas.width, tempCanvas.height);
         const newHistory = history.slice(0, historyIndex + 1);

         // Avoid saving identical states (optional optimization)
         if (historyIndex >= 0 && history[historyIndex]) {
             const lastData = history[historyIndex].data;
             const currentData = imageData.data;
             let same = true;
             if (lastData.length !== currentData.length) {
                 same = false;
             } else {
                 for (let i = 0; i < lastData.length; i++) {
                     if (lastData[i] !== currentData[i]) {
                         same = false;
                         break;
                     }
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
  }, [history, historyIndex, imageDimensions]);

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
    const container = containerRef.current; // Use container ref
    const ctx = canvas?.getContext('2d');
    const img = new window.Image();
    // IMPORTANT: Add crossOrigin attribute BEFORE setting src
    img.crossOrigin = "anonymous"; // Allow loading cross-origin images for canvas manipulation

    img.onload = () => {
      console.log("SpriteEditor: Image Loaded successfully:", img.width, img.height);
      if (!canvas || !ctx || !container) {
        console.error("SpriteEditor: Canvas, context, or container not available on image load.");
        return;
      }
      imageRef.current = img;
      setImageDimensions({ width: img.width, height: img.height }); // Store original dimensions

      // Set canvas *drawing surface* size based on container for responsiveness
      // We'll scale the image drawing within this surface
      const containerWidth = container.offsetWidth;
      const containerHeight = container.offsetHeight;
      canvas.width = containerWidth;
      canvas.height = containerHeight;

      // Calculate initial zoom to fit image within container
      const zoomX = containerWidth / img.width;
      const zoomY = containerHeight / img.height;
      const initialZoom = Math.min(1, zoomX, zoomY); // Fit while respecting max 1x zoom

      // Reset state for new image
      setZoom(initialZoom);
      setOffset({ x: 0, y: 0 }); // Center the image using translate in draw()
      setSelection(null);
      setIsSelecting(false);
      setTool('pan'); // Default tool
      setHistory([]); // Clear history for new image
      setHistoryIndex(-1);

      console.log("SpriteEditor: Initial setup - Container:", containerWidth, "x", containerHeight, "Image:", img.width, "x", img.height, "Initial Zoom:", initialZoom);

      // Draw initial image onto a temporary canvas to get ImageData for history
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = img.width;
      tempCanvas.height = img.height;
      const tempCtx = tempCanvas.getContext('2d', { willReadFrequently: true });
      if (tempCtx) {
        tempCtx.imageSmoothingEnabled = false;
        try {
          tempCtx.drawImage(img, 0, 0);
          const initialImageData = tempCtx.getImageData(0, 0, tempCanvas.width, tempCanvas.height);
          setHistory([initialImageData]);
          setHistoryIndex(0);
          console.log("SpriteEditor: Initial history saved from loaded image.");
          // Explicitly trigger draw after history is set and state updates are likely processed
          requestAnimationFrame(() => draw());
        } catch (e) {
          console.error("SpriteEditor: Error getting initial ImageData:", e);
          if (e instanceof DOMException && e.name === 'SecurityError') {
            console.warn("SpriteEditor: Could not get ImageData due to CORS. Editing features may be limited.");
            setHistory([]);
            setHistoryIndex(-1);
            requestAnimationFrame(() => draw()); // Try drawing placeholder/error
          }
        }
      } else {
        console.error("SpriteEditor: Could not get temp context for initial history save.");
        requestAnimationFrame(() => draw()); // Still try to draw
      }
    };
    img.onerror = (e) => {
      console.error("SpriteEditor: Error loading image:", e, "from URL:", imageUrl?.substring(0, 100) + "...");
      if (canvas && ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = 'red';
        ctx.font = '16px Pixelify Sans';
        ctx.textAlign = 'center';
        ctx.fillText('Error loading image.', canvas.width / 2, canvas.height / 2);
      }
      imageRef.current = null;
      setImageDimensions({ width: 0, height: 0 });
      setHistory([]);
      setHistoryIndex(-1);
      setSelection(null);
      setOffset({ x: 0, y: 0 });
      setZoom(1);
    }

    // Set the src AFTER defining onload/onerror and setting crossOrigin
    if (imageUrl) {
      console.log("Setting image src:", imageUrl.substring(0, 100) + "...");
      img.src = imageUrl;
    } else {
      console.warn("SpriteEditor: Received null or empty imageUrl.");
      if (canvas && ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
      imageRef.current = null;
      setImageDimensions({ width: 0, height: 0 });
      setHistory([]);
      setHistoryIndex(-1);
      setSelection(null);
      setOffset({ x: 0, y: 0 });
      setZoom(1);
    }

    // Resize observer for container
    const resizeObserver = new ResizeObserver(entries => {
        if (!entries || entries.length === 0) return;
        const { width, height } = entries[0].contentRect;
        if (canvas && (canvas.width !== width || canvas.height !== height)) {
            canvas.width = width;
            canvas.height = height;
            console.log("Resized canvas to:", width, height);
            // Recalculate zoom/offset if needed, or just redraw
            requestAnimationFrame(draw);
        }
    });

    if (container) {
        resizeObserver.observe(container);
    }


    return () => {
        // Cleanup image reference and observer
        if (imageRef.current) {
            imageRef.current.onload = null;
            imageRef.current.onerror = null;
        }
        imageRef.current = null;
        if (container) {
            resizeObserver.unobserve(container);
        }
        console.log("SpriteEditor: Image ref and observer cleaned up.");
     };
  }, [imageUrl]); // Rerun only when imageUrl changes


    // Redraw whenever relevant state changes
    useEffect(() => {
        //console.log("SpriteEditor: Redrawing canvas due to state change.", { zoom, offset, selection: !!selection, historyIndex, tool });
        requestAnimationFrame(() => draw());
    }, [draw, zoom, offset, selection, historyIndex, tool]); // Include all relevant state


   // Update preview canvas
   useEffect(() => {
       const previewCanvas = previewCanvasRef.current;
       const previewCtx = previewCanvas?.getContext('2d', { willReadFrequently: true });

       if (!previewCanvas || !previewCtx || !selection || selection.width < 1 || selection.height < 1) {
           if (previewCanvas && previewCtx) previewCtx.clearRect(0, 0, previewCanvas.width, previewCanvas.height);
           return;
       }
       previewCtx.imageSmoothingEnabled = false;

       const sourceImageData = history[historyIndex];
       if (!sourceImageData || imageDimensions.width === 0 || imageDimensions.height === 0) {
           previewCtx.clearRect(0, 0, previewCanvas.width, previewCanvas.height);
           return; // Ensure we have source data and dimensions
       }

       // Clamp selection to image bounds
       const clampedX = Math.max(0, Math.floor(selection.x));
       const clampedY = Math.max(0, Math.floor(selection.y));
       const clampedW = Math.min(imageDimensions.width - clampedX, Math.max(1, Math.floor(selection.width)));
       const clampedH = Math.min(imageDimensions.height - clampedY, Math.max(1, Math.floor(selection.height)));

       if (clampedW > 0 && clampedH > 0) {
           // Create a temporary canvas from the *full* history ImageData
           const tempCanvas = document.createElement('canvas');
           tempCanvas.width = sourceImageData.width;
           tempCanvas.height = sourceImageData.height;
           const tempCtx = tempCanvas.getContext('2d');

           if (tempCtx) {
               tempCtx.putImageData(sourceImageData, 0, 0);

               // Set preview canvas size to match the *selection* dimensions
               previewCanvas.width = clampedW;
               previewCanvas.height = clampedH;
               previewCtx.clearRect(0, 0, previewCanvas.width, previewCanvas.height);

               // Draw checkered background for preview transparency
               const patternSize = 5;
               for (let i = 0; i < previewCanvas.width; i += patternSize) {
                   for (let j = 0; j < previewCanvas.height; j += patternSize) {
                       previewCtx.fillStyle = ((Math.floor(i / patternSize) + Math.floor(j / patternSize)) % 2 === 0) ? '#ccc' : '#fff';
                       previewCtx.fillRect(i, j, patternSize, patternSize);
                   }
               }

               // Draw the selected portion from the temporary canvas onto the preview canvas
               previewCtx.drawImage(
                   tempCanvas,
                   clampedX, clampedY, // Source rectangle (x, y, w, h) from the full history image
                   clampedW, clampedH,
                   0, 0,           // Destination rectangle (x, y, w, h) on the preview canvas
                   clampedW, clampedH
               );
           } else {
               console.error("Could not get context for temp history canvas in preview.");
               previewCtx.clearRect(0, 0, previewCanvas.width, previewCanvas.height);
           }
       } else {
           previewCtx.clearRect(0, 0, previewCanvas.width, previewCanvas.height);
       }
   }, [selection, history, historyIndex, imageDimensions]); // Depend on imageDimensions


   // --- Mouse Event Handling ---
   const getCanvasCoordinates = useCallback((clientX: number, clientY: number): { x: number; y: number } => {
       const canvas = canvasRef.current;
       if (!canvas || imageDimensions.width === 0 || imageDimensions.height === 0) return { x: 0, y: 0 };
       const rect = canvas.getBoundingClientRect();

       // Mouse position relative to the canvas element's top-left
       const mouseX = clientX - rect.left;
       const mouseY = clientY - rect.top;

       // Convert mouse coordinates to image coordinates
       // 1. Translate mouse relative to canvas center
       const mouseRelativeToCenterX = mouseX - canvas.width / 2;
       const mouseRelativeToCenterY = mouseY - canvas.height / 2;

       // 2. Account for pan offset
       const mouseRelativeToPanX = mouseRelativeToCenterX - offset.x;
       const mouseRelativeToPanY = mouseRelativeToCenterY - offset.y;

       // 3. Account for zoom
       const mouseRelativeToZoomX = mouseRelativeToPanX / zoom;
       const mouseRelativeToZoomY = mouseRelativeToPanY / zoom;

       // 4. Translate relative to image top-left
       const imageX = mouseRelativeToZoomX + imageDimensions.width / 2;
       const imageY = mouseRelativeToZoomY + imageDimensions.height / 2;

       return { x: imageX, y: imageY };
   }, [zoom, offset, imageDimensions]);


   const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
       const coords = getCanvasCoordinates(e.clientX, e.clientY);
       //console.log("Mouse Down - Image Coords:", coords);

       if (tool === 'select') {
           setIsSelecting(true);
           setStartSelect(coords);
           // Initialize selection, clamp start coords to image bounds
           const startX = Math.max(0, Math.min(coords.x, imageDimensions.width));
           const startY = Math.max(0, Math.min(coords.y, imageDimensions.height));
           setSelection({ x: startX, y: startY, width: 0, height: 0 });
       } else if (tool === 'erase' || tool === 'draw') {
           setIsDrawing(true);
           // Apply tool immediately on click
           applyTool(coords.x, coords.y);
       } else if (tool === 'pan') {
           setIsDragging(true);
           // Store starting mouse position and current offset
           setStartDrag({ x: e.clientX, y: e.clientY });
       }
   };

   const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
       const coords = getCanvasCoordinates(e.clientX, e.clientY);

       if (isSelecting && tool === 'select' && imageDimensions.width > 0 && imageDimensions.height > 0) {
           // Clamp current coords to image bounds
           const currentX = Math.max(0, Math.min(coords.x, imageDimensions.width));
           const currentY = Math.max(0, Math.min(coords.y, imageDimensions.height));

           const width = currentX - startSelect.x;
           const height = currentY - startSelect.y;

           // Update selection based on direction
           setSelection({
               x: width >= 0 ? startSelect.x : currentX,
               y: height >= 0 ? startSelect.y : currentY,
               width: Math.abs(width),
               height: Math.abs(height),
           });
       } else if (isDrawing && (tool === 'erase' || tool === 'draw')) {
           applyTool(coords.x, coords.y); // Apply tool continuously while drawing
       } else if (isDragging && tool === 'pan') {
           const dx = e.clientX - startDrag.x;
           const dy = e.clientY - startDrag.y;
           // Update offset based on mouse movement delta
           setOffset(prevOffset => ({ x: prevOffset.x + dx, y: prevOffset.y + dy }));
           // Update startDrag for the next move calculation
           setStartDrag({ x: e.clientX, y: e.clientY });
       }
   };


   const handleMouseUp = () => {
       if (isDrawing && (tool === 'erase' || tool === 'draw')) {
           // Save the state after finishing a draw/erase stroke
           saveToHistory();
       }
       if (isSelecting && tool === 'select' && selection && (selection.width < 1 || selection.height < 1)) {
           // Clear selection if it's effectively zero-sized
           setSelection(null);
       }
       setIsSelecting(false);
       setIsDrawing(false);
       setIsDragging(false);
   };

   const handleMouseLeave = () => {
       // Treat leaving the canvas like mouse up
       if (isDrawing && (tool === 'erase' || tool === 'draw')) {
           saveToHistory();
       }
       if (isSelecting && selection && (selection.width < 1 || selection.height < 1)) {
           setSelection(null);
       }
       setIsSelecting(false);
       setIsDrawing(false);
       setIsDragging(false);
   };

    // --- Wheel Event for Zoom ---
    const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
        e.preventDefault();
        const canvas = canvasRef.current;
        if (!canvas) return;

        const rect = canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left; // Mouse X relative to canvas element
        const mouseY = e.clientY - rect.top;  // Mouse Y relative to canvas element

        // Calculate image coordinates under the mouse *before* zoom
        const imageCoordsBeforeZoom = getCanvasCoordinates(e.clientX, e.clientY);

        // Determine zoom factor
        const delta = e.deltaY > 0 ? 1 / 1.1 : 1.1; // Zoom out / Zoom in factor
        const newZoom = Math.max(0.1, Math.min(zoom * delta, 32)); // Clamp zoom level

        // Calculate the new offset to keep the point under the mouse stationary
        // The position of the image coordinate (imageX, imageY) relative to the canvas center should remain the same after zoom.
        // Let (cx, cy) be the canvas center (canvas.width/2, canvas.height/2)
        // Let (ix, iy) be the image coordinates under the mouse
        // Let (imgW, imgH) be the image dimensions
        // Before zoom: mouseX = cx + offset.x + (ix - imgW/2) * zoom
        //              mouseY = cy + offset.y + (iy - imgH/2) * zoom
        // After zoom: mouseX = cx + newOffset.x + (ix - imgW/2) * newZoom
        //             mouseY = cy + newOffset.y + (iy - imgH/2) * newZoom
        // Solving for newOffset:
        // newOffset.x = mouseX - cx - (ix - imgW/2) * newZoom
        // newOffset.y = mouseY - cy - (iy - imgH/2) * newZoom

        const newOffsetX = mouseX - canvas.width / 2 - (imageCoordsBeforeZoom.x - imageDimensions.width / 2) * newZoom;
        const newOffsetY = mouseY - canvas.height / 2 - (imageCoordsBeforeZoom.y - imageDimensions.height / 2) * newZoom;

        setZoom(newZoom);
        setOffset({ x: newOffsetX, y: newOffsetY });

         // Let the main draw loop handle the drawing at the new scale/offset
        // requestAnimationFrame(draw); // Draw is triggered by useEffect on zoom/offset change
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
      // Operate directly on ImageData from history
      if (historyIndex < 0 || !history[historyIndex] || imageDimensions.width === 0 || imageDimensions.height === 0) {
          console.warn("Cannot apply tool: missing history state or image dimensions.");
          return;
      }

      // Get the current ImageData from history
      const currentImageData = history[historyIndex];
      // Important: Clone the data array to avoid modifying the history state directly during the operation
      const data = new Uint8ClampedArray(currentImageData.data);
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

      let modified = false; // Track if any pixel actually changed

      // Iterate over the brush area
      for (let yOffset = -halfSize; yOffset < size - halfSize; yOffset++) {
          for (let xOffset = -halfSize; xOffset < size - halfSize; xOffset++) {
              const pixelX = correctedX + xOffset;
              const pixelY = correctedY + yOffset;

              // Bounds check against image dimensions
              if (pixelX >= 0 && pixelX < width && pixelY >= 0 && pixelY < currentImageData.height) {
                  const index = (pixelY * width + pixelX) * 4; // Calculate the index in the ImageData array

                   if (tool === 'erase') {
                       // Set RGBA to fully transparent (0, 0, 0, 0) only if not already transparent
                       if (data[index + 3] !== 0) {
                           data[index] = 0;     // R
                           data[index + 1] = 0; // G
                           data[index + 2] = 0; // B
                           data[index + 3] = 0; // A
                           modified = true;
                       }
                   } else if (tool === 'draw') {
                       // Set RGB to drawColor and Alpha to fully opaque (255) only if different
                       if (data[index] !== colorR || data[index + 1] !== colorG || data[index + 2] !== colorB || data[index + 3] !== 255) {
                           data[index] = colorR;
                           data[index + 1] = colorG;
                           data[index + 2] = colorB;
                           data[index + 3] = 255;
                           modified = true;
                       }
                   }
              }
          }
      }

      // --- IMPORTANT: Update the LATEST history entry directly with the *new* modified ImageData ---
      if (modified) {
          const newImageData = new ImageData(data, width, currentImageData.height); // Create new ImageData object from modified data
          // Replace the current history state
          const currentHistory = [...history];
          currentHistory[historyIndex] = newImageData;
          setHistory(currentHistory); // Update state to trigger redraw via useEffect
          //console.log("Applied tool, updated history index", historyIndex);
      }


      // Don't call saveToHistory() here, only on mouseUp/mouseLeave
      // Trigger a redraw immediately for responsiveness (already happens via useEffect)
      // requestAnimationFrame(draw);
   };


   // --- Zoom & Save ---
    const handleZoom = (factor: number) => {
         const canvas = canvasRef.current;
         const container = containerRef.current;
         if (!canvas || !container || imageDimensions.width === 0 || imageDimensions.height === 0) return;

         const newZoom = Math.max(0.1, Math.min(zoom * factor, 32)); // Clamp zoom level

         // Zoom towards the center of the container view
         const containerCenterX = container.offsetWidth / 2;
         const containerCenterY = container.offsetHeight / 2;

         // Get image coordinates of the center point before zoom
         const centerCoordsBeforeZoom = getCanvasCoordinates(
             canvas.getBoundingClientRect().left + containerCenterX,
             canvas.getBoundingClientRect().top + containerCenterY
         );

         // Calculate new offset to keep the center point stable
         const newOffsetX = containerCenterX - canvas.width / 2 - (centerCoordsBeforeZoom.x - imageDimensions.width / 2) * newZoom;
         const newOffsetY = containerCenterY - canvas.height / 2 - (centerCoordsBeforeZoom.y - imageDimensions.height / 2) * newZoom;

         setZoom(newZoom);
         setOffset({ x: newOffsetX, y: newOffsetY });

         // Draw is triggered by useEffect
    };
    const handleZoomIn = () => handleZoom(1.2);
    const handleZoomOut = () => handleZoom(1 / 1.2);

    const handleSaveSelection = () => {
        const previewCanvas = previewCanvasRef.current;
        if (!previewCanvas || !selection || selection.width < 1 || selection.height < 1) {
            console.warn("Cannot save: Invalid selection or preview canvas."); return;
        };
        try {
            const dataUrl = previewCanvas.toDataURL('image/png');
            onSaveSprite(selectedSpriteState, dataUrl);
            setSelection(null); // Clear selection after saving
        } catch (e) {
             console.error("Error generating data URL from preview canvas:", e);
             if (e instanceof DOMException && e.name === 'SecurityError') {
                 console.error("Canvas seems to be tainted, likely due to CORS issues with the source image.");
                 // Consider showing a user-friendly error message here
             }
         }
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
        <div
             ref={containerRef} // Add ref to the container
             className="flex-grow overflow-hidden relative bg-gray-400" // Use hidden overflow
             style={{ cursor: getCursor() }} // Apply cursor style
        >
          <canvas
            ref={canvasRef}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseLeave}
            onWheel={handleWheel} // Add wheel listener
            // className="absolute top-0 left-0" // Use absolute positioning within the container
            className="block" // Ensure canvas takes up space
            style={{
                imageRendering: 'pixelated', // For crisp pixel art
                touchAction: 'none', // Disable browser default touch actions
                // width and height are set based on container size in useEffect
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
                    // Width and height are set dynamically in the useEffect hook for preview
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

      
