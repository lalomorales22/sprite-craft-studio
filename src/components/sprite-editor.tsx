
'use client';

import React, { useRef, useState, useEffect, useCallback } from 'react';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Eraser, Paintbrush, ZoomIn, ZoomOut, RotateCcw, Save, MousePointer, Slice, CircleHelp, Sparkles as RemoveBgIcon } from 'lucide-react'; // Renamed Sparkles to RemoveBgIcon
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
 } from "@/components/ui/alert-dialog"
import type { SpriteState, SpriteSlots } from '@/app/page';
import { useToast } from '@/hooks/use-toast'; // Import useToast
import { Skeleton } from '@/components/ui/skeleton'; // Import Skeleton for loading state

type Tool = 'select' | 'erase' | 'draw' | 'pan';

interface SpriteEditorProps {
  imageUrl: string;
  onSaveSprite: (state: SpriteState, imageDataUrl: string) => void;
  spriteSlots: SpriteSlots;
  onImageUpdate?: (newImageUrl: string) => void; // Callback for when image data changes (e.g., after BG removal)
}

const SpriteEditor: React.FC<SpriteEditorProps> = ({ imageUrl, onSaveSprite, spriteSlots, onImageUpdate }) => {
  const containerRef = useRef<HTMLDivElement>(null);
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
  const [imageDimensions, setImageDimensions] = useState({ width: 0, height: 0 });
  const [isLoadingImage, setIsLoadingImage] = useState(true); // State for initial image loading
  const [isRemovingBackground, setIsRemovingBackground] = useState(false); // State for background removal loading
  const { toast } = useToast(); // Initialize toast

  // --- Drawing Logic ---
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d', { willReadFrequently: true });

    if (!canvas || !ctx) return; // No need to check imageDimensions here, draw can happen without image (e.g., error state)

    ctx.imageSmoothingEnabled = false;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Only proceed with drawing image if dimensions are set and history exists
    if (imageDimensions.width > 0 && imageDimensions.height > 0 && history[historyIndex]) {
        ctx.save();
        ctx.translate(canvas.width / 2 + offset.x, canvas.height / 2 + offset.y);
        ctx.scale(zoom, zoom);
        ctx.translate(-imageDimensions.width / 2, -imageDimensions.height / 2);

        // Draw checkered background
        const patternSize = 10 / zoom;
        for (let i = 0; i < imageDimensions.width; i += patternSize) {
          for (let j = 0; j < imageDimensions.height; j += patternSize) {
            ctx.fillStyle = ((Math.floor(i / patternSize) + Math.floor(j / patternSize)) % 2 === 0) ? '#ccc' : '#fff';
            ctx.fillRect(i, j, patternSize, patternSize);
          }
        }

        // Draw the current state from history
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = history[historyIndex].width;
        tempCanvas.height = history[historyIndex].height;
        const tempCtx = tempCanvas.getContext('2d');
        if (tempCtx) {
            tempCtx.putImageData(history[historyIndex], 0, 0);
            ctx.drawImage(tempCanvas, 0, 0, imageDimensions.width, imageDimensions.height);
        } else {
            console.error("SpriteEditor: Could not get temp context for drawing history.");
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
    } else if (isLoadingImage) {
         // Optional: Draw loading state directly on canvas if needed, though skeleton is preferred
         // ctx.fillStyle = 'rgba(0,0,0,0.5)';
         // ctx.fillRect(0, 0, canvas.width, canvas.height);
         // ctx.fillStyle = 'white';
         // ctx.textAlign = 'center';
         // ctx.fillText("Loading Image...", canvas.width / 2, canvas.height / 2);
    } else if (!imageUrl) {
        // Draw placeholder if no image URL provided
        ctx.fillStyle = 'hsl(var(--muted-foreground))';
        ctx.textAlign = 'center';
        ctx.font = '14px Pixelify Sans';
        ctx.fillText("No image loaded.", canvas.width / 2, canvas.height / 2);
    } else if (imageDimensions.width === 0) {
         // Draw error state if image failed to load
         ctx.fillStyle = 'red';
         ctx.textAlign = 'center';
         ctx.font = '16px Pixelify Sans';
         ctx.fillText("Error loading image.", canvas.width / 2, canvas.height / 2);
    }

  }, [zoom, offset, selection, history, historyIndex, tool, imageDimensions, isLoadingImage, imageUrl]);


  // --- History Management ---
   const saveToHistory = useCallback((newData?: ImageData) => {
     const canvas = canvasRef.current;
     if (!canvas || imageDimensions.width === 0 || imageDimensions.height === 0) {
        console.warn("Cannot save history: Canvas or image dimensions not ready.");
        return;
     }

     const imageDataToSave = newData || history[historyIndex]; // Use new data if provided (e.g., from BG removal)

     if (!imageDataToSave) {
         console.warn("Cannot save history: No ImageData available.");
         return;
     }

     // Ensure the ImageData has the correct dimensions
     if(imageDataToSave.width !== imageDimensions.width || imageDataToSave.height !== imageDimensions.height) {
         console.warn("History save aborted: ImageData dimensions mismatch.", imageDataToSave.width, "x", imageDataToSave.height, "vs", imageDimensions.width, "x", imageDimensions.height);
         // Optional: Try to create a new ImageData with correct dimensions and draw the mismatching one onto it?
         // This might be complex and depends on the cause of the mismatch.
         return;
     }


      try {
         const newHistory = history.slice(0, historyIndex + 1);

         // Avoid saving identical states
         if (historyIndex >= 0 && history[historyIndex]) {
             const lastData = history[historyIndex].data;
             const currentData = imageDataToSave.data;
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
                 //console.log("Skipping save to history: state unchanged.");
                 return; // Don't save if identical to previous state
             }
         }

         newHistory.push(imageDataToSave);
         setHistory(newHistory);
         setHistoryIndex(newHistory.length - 1);
         //console.log("Saved to history. Index:", newHistory.length - 1);
      } catch (e) {
          console.error("Error saving to history:", e);
          if (e instanceof DOMException && e.name === 'SecurityError') {
             console.warn("SpriteEditor: Could not save history due to CORS. Edits might not be properly saved.");
          }
      }
  }, [history, historyIndex, imageDimensions]);

  const handleUndo = useCallback(() => {
      if (historyIndex > 0) {
         const newIndex = historyIndex - 1;
         setHistoryIndex(newIndex);
         console.log("Undo. History index:", newIndex);
         // Update parent image if onImageUpdate exists (history change means image data changed)
          if (onImageUpdate && history[newIndex]) {
              const tempCanvas = document.createElement('canvas');
              tempCanvas.width = history[newIndex].width;
              tempCanvas.height = history[newIndex].height;
              const tempCtx = tempCanvas.getContext('2d');
              if (tempCtx) {
                  tempCtx.putImageData(history[newIndex], 0, 0);
                  onImageUpdate(tempCanvas.toDataURL());
              }
          }
      } else {
          console.log("Cannot undo further.");
      }
   }, [historyIndex, history, onImageUpdate]);

  // --- Image Loading & Initialization ---
  useEffect(() => {
    console.log("SpriteEditor: Image URL Changed:", imageUrl?.substring(0, 100) + "...");
    setIsLoadingImage(true); // Start loading
    const canvas = canvasRef.current;
    const container = containerRef.current;
    const ctx = canvas?.getContext('2d', { willReadFrequently: true }); // Ensure willReadFrequently
    const img = new window.Image();
    img.crossOrigin = "anonymous";

    img.onload = () => {
      console.log("SpriteEditor: Image Loaded successfully:", img.width, img.height);
      if (!canvas || !ctx || !container) {
        console.error("SpriteEditor: Canvas, context, or container not available on image load.");
        setIsLoadingImage(false);
        setImageDimensions({ width: 0, height: 0 }); // Indicate error
        return;
      }
      imageRef.current = img;
      setImageDimensions({ width: img.width, height: img.height });

      const containerWidth = container.offsetWidth;
      const containerHeight = container.offsetHeight;
      canvas.width = containerWidth;
      canvas.height = containerHeight;

      const zoomX = containerWidth / img.width;
      const zoomY = containerHeight / img.height;
      const initialZoom = Math.min(0.9, zoomX, zoomY); // Fit but ensure slight padding initially

      setZoom(initialZoom);
      setOffset({ x: 0, y: 0 });
      setSelection(null);
      setIsSelecting(false);
      setTool('pan');
      setHistory([]);
      setHistoryIndex(-1);

      console.log("SpriteEditor: Initial setup - Container:", containerWidth, "x", containerHeight, "Image:", img.width, "x", img.height, "Initial Zoom:", initialZoom);

      // Create initial history state
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = img.width;
      tempCanvas.height = img.height;
      const tempCtx = tempCanvas.getContext('2d', { willReadFrequently: true }); // willReadFrequently
      if (tempCtx) {
        tempCtx.imageSmoothingEnabled = false;
        try {
          tempCtx.drawImage(img, 0, 0);
          const initialImageData = tempCtx.getImageData(0, 0, tempCanvas.width, tempCanvas.height);
          setHistory([initialImageData]);
          setHistoryIndex(0);
          console.log("SpriteEditor: Initial history saved.");
          setIsLoadingImage(false); // Finish loading
          requestAnimationFrame(draw);
        } catch (e) {
          console.error("SpriteEditor: Error getting initial ImageData:", e);
          if (e instanceof DOMException && e.name === 'SecurityError') {
            toast({ title: "CORS Error", description: "Cannot edit image due to cross-origin restrictions.", variant: "destructive", duration: 7000});
          }
          setHistory([]); setHistoryIndex(-1); setIsLoadingImage(false); setImageDimensions({ width: 0, height: 0 }); requestAnimationFrame(draw);
        }
      } else {
        console.error("SpriteEditor: Could not get temp context for initial history.");
        setHistory([]); setHistoryIndex(-1); setIsLoadingImage(false); setImageDimensions({ width: 0, height: 0 }); requestAnimationFrame(draw);
      }
    };
    img.onerror = (e) => {
      console.error("SpriteEditor: Error loading image:", e, "from URL:", imageUrl?.substring(0, 100) + "...");
      toast({ title: "Image Load Error", description: "Could not load the image for editing.", variant: "destructive"});
      imageRef.current = null; setImageDimensions({ width: 0, height: 0 }); setHistory([]); setHistoryIndex(-1); setIsLoadingImage(false); setSelection(null); setOffset({ x: 0, y: 0 }); setZoom(1); requestAnimationFrame(draw);
    }

    if (imageUrl) {
      console.log("Setting image src:", imageUrl.substring(0, 100) + "...");
      img.src = imageUrl;
    } else {
      console.warn("SpriteEditor: Received null or empty imageUrl.");
      imageRef.current = null; setImageDimensions({ width: 0, height: 0 }); setHistory([]); setHistoryIndex(-1); setIsLoadingImage(false); setSelection(null); setOffset({ x: 0, y: 0 }); setZoom(1); requestAnimationFrame(draw);
    }

    const resizeObserver = new ResizeObserver(entries => {
        if (!entries || entries.length === 0) return;
        const { width, height } = entries[0].contentRect;
        if (canvas && (canvas.width !== width || canvas.height !== height)) {
            canvas.width = width; canvas.height = height;
            requestAnimationFrame(draw);
        }
    });
    if (container) resizeObserver.observe(container);

    return () => {
        if (imageRef.current) { imageRef.current.onload = null; imageRef.current.onerror = null; }
        imageRef.current = null;
        if (container) resizeObserver.unobserve(container);
        console.log("SpriteEditor: Image ref and observer cleaned up.");
     };
  }, [imageUrl, toast]); // Add toast dependency

    // Redraw whenever relevant state changes
    useEffect(() => {
        requestAnimationFrame(() => draw());
    }, [draw, zoom, offset, selection, historyIndex, tool]);


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
           return;
       }

       const clampedX = Math.max(0, Math.floor(selection.x));
       const clampedY = Math.max(0, Math.floor(selection.y));
       const clampedW = Math.min(imageDimensions.width - clampedX, Math.max(1, Math.floor(selection.width)));
       const clampedH = Math.min(imageDimensions.height - clampedY, Math.max(1, Math.floor(selection.height)));

       if (clampedW > 0 && clampedH > 0) {
           const tempCanvas = document.createElement('canvas');
           tempCanvas.width = sourceImageData.width;
           tempCanvas.height = sourceImageData.height;
           const tempCtx = tempCanvas.getContext('2d');

           if (tempCtx) {
               tempCtx.putImageData(sourceImageData, 0, 0);
               previewCanvas.width = clampedW;
               previewCanvas.height = clampedH;
               previewCtx.clearRect(0, 0, previewCanvas.width, previewCanvas.height);

               const patternSize = 5;
               for (let i = 0; i < previewCanvas.width; i += patternSize) {
                   for (let j = 0; j < previewCanvas.height; j += patternSize) {
                       previewCtx.fillStyle = ((Math.floor(i / patternSize) + Math.floor(j / patternSize)) % 2 === 0) ? '#ccc' : '#fff';
                       previewCtx.fillRect(i, j, patternSize, patternSize);
                   }
               }

               previewCtx.drawImage(
                   tempCanvas,
                   clampedX, clampedY, clampedW, clampedH,
                   0, 0, clampedW, clampedH
               );
           } else {
               console.error("Could not get context for temp history canvas in preview.");
               previewCtx.clearRect(0, 0, previewCanvas.width, previewCanvas.height);
           }
       } else {
           previewCtx.clearRect(0, 0, previewCanvas.width, previewCanvas.height);
       }
   }, [selection, history, historyIndex, imageDimensions]);


   // --- Mouse Event Handling ---
   const getCanvasCoordinates = useCallback((clientX: number, clientY: number): { x: number; y: number } => {
       const canvas = canvasRef.current;
       if (!canvas || imageDimensions.width === 0 || imageDimensions.height === 0) return { x: 0, y: 0 };
       const rect = canvas.getBoundingClientRect();
       const mouseX = clientX - rect.left;
       const mouseY = clientY - rect.top;
       const mouseRelativeToCenterX = mouseX - canvas.width / 2;
       const mouseRelativeToCenterY = mouseY - canvas.height / 2;
       const mouseRelativeToPanX = mouseRelativeToCenterX - offset.x;
       const mouseRelativeToPanY = mouseRelativeToCenterY - offset.y;
       const mouseRelativeToZoomX = mouseRelativeToPanX / zoom;
       const mouseRelativeToZoomY = mouseRelativeToPanY / zoom;
       const imageX = mouseRelativeToZoomX + imageDimensions.width / 2;
       const imageY = mouseRelativeToZoomY + imageDimensions.height / 2;
       return { x: imageX, y: imageY };
   }, [zoom, offset, imageDimensions]);


   const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
       if (isLoadingImage || isRemovingBackground) return; // Prevent actions while loading
       const coords = getCanvasCoordinates(e.clientX, e.clientY);
       if (tool === 'select') {
           setIsSelecting(true);
           setStartSelect(coords);
           const startX = Math.max(0, Math.min(coords.x, imageDimensions.width));
           const startY = Math.max(0, Math.min(coords.y, imageDimensions.height));
           setSelection({ x: startX, y: startY, width: 0, height: 0 });
       } else if (tool === 'erase' || tool === 'draw') {
           if (historyIndex < 0) { console.warn("Cannot draw/erase: History not initialized."); return; }
           setIsDrawing(true);
           applyTool(coords.x, coords.y);
       } else if (tool === 'pan') {
           setIsDragging(true);
           setStartDrag({ x: e.clientX, y: e.clientY });
       }
   };

   const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
        if (isLoadingImage || isRemovingBackground) return;
        const coords = getCanvasCoordinates(e.clientX, e.clientY);
       if (isSelecting && tool === 'select' && imageDimensions.width > 0 && imageDimensions.height > 0) {
           const currentX = Math.max(0, Math.min(coords.x, imageDimensions.width));
           const currentY = Math.max(0, Math.min(coords.y, imageDimensions.height));
           const width = currentX - startSelect.x;
           const height = currentY - startSelect.y;
           setSelection({ x: width >= 0 ? startSelect.x : currentX, y: height >= 0 ? startSelect.y : currentY, width: Math.abs(width), height: Math.abs(height), });
       } else if (isDrawing && (tool === 'erase' || tool === 'draw')) {
           if (historyIndex < 0) return;
           applyTool(coords.x, coords.y);
       } else if (isDragging && tool === 'pan') {
           const dx = e.clientX - startDrag.x;
           const dy = e.clientY - startDrag.y;
           setOffset(prevOffset => ({ x: prevOffset.x + dx, y: prevOffset.y + dy }));
           setStartDrag({ x: e.clientX, y: e.clientY });
       }
   };


   const handleMouseUp = () => {
       if (isLoadingImage || isRemovingBackground) return;
       if (isDrawing && (tool === 'erase' || tool === 'draw')) {
           // Check if the state actually changed before saving
           // This check is now implicitly handled inside saveToHistory
           saveToHistory();
       }
       if (isSelecting && tool === 'select' && selection && (selection.width < 1 || selection.height < 1)) {
           setSelection(null);
       }
       setIsSelecting(false);
       setIsDrawing(false);
       setIsDragging(false);
   };

   const handleMouseLeave = () => {
       if (isLoadingImage || isRemovingBackground) return;
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
        if (isLoadingImage || isRemovingBackground) return;
        e.preventDefault();
        const canvas = canvasRef.current;
        if (!canvas || imageDimensions.width === 0 || imageDimensions.height === 0) return;
        const rect = canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        const imageCoordsBeforeZoom = getCanvasCoordinates(e.clientX, e.clientY);
        const delta = e.deltaY > 0 ? 1 / 1.1 : 1.1;
        const newZoom = Math.max(0.1, Math.min(zoom * delta, 32));
        const newOffsetX = mouseX - canvas.width / 2 - (imageCoordsBeforeZoom.x - imageDimensions.width / 2) * newZoom;
        const newOffsetY = mouseY - canvas.height / 2 - (imageCoordsBeforeZoom.y - imageDimensions.height / 2) * newZoom;
        setZoom(newZoom);
        setOffset({ x: newOffsetX, y: newOffsetY });
    };


    // --- Keyboard Shortcuts ---
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
             if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement) return;
             if (isLoadingImage || isRemovingBackground) return; // Prevent shortcuts during loading

             if (e.key.toLowerCase() === 'p') { setTool('pan'); e.preventDefault(); }
             else if (e.key.toLowerCase() === 's') { setTool('select'); e.preventDefault(); }
             else if (e.key.toLowerCase() === 'b') { setTool('draw'); e.preventDefault(); }
             else if (e.key.toLowerCase() === 'e') { setTool('erase'); e.preventDefault(); }
             else if (e.key === '+' || e.key === '=') { handleZoomIn(); e.preventDefault(); }
             else if (e.key === '-' || e.key === '_') { handleZoomOut(); e.preventDefault(); }
             else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { handleUndo(); e.preventDefault(); }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [handleUndo, isLoadingImage, isRemovingBackground]); // Add loading states to dependencies


   // --- Tool Application Logic ---
   const applyTool = (imgX: number, imgY: number) => {
      if (historyIndex < 0 || !history[historyIndex] || imageDimensions.width === 0 || imageDimensions.height === 0) return;
      const currentImageData = history[historyIndex];
      const data = new Uint8ClampedArray(currentImageData.data);
      const width = currentImageData.width;
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
      let modified = false;
      for (let yOffset = -halfSize; yOffset < size - halfSize; yOffset++) {
          for (let xOffset = -halfSize; xOffset < size - halfSize; xOffset++) {
              const pixelX = correctedX + xOffset;
              const pixelY = correctedY + yOffset;
              if (pixelX >= 0 && pixelX < width && pixelY >= 0 && pixelY < currentImageData.height) {
                  const index = (pixelY * width + pixelX) * 4;
                   if (tool === 'erase') {
                       if (data[index + 3] !== 0) { data[index] = 0; data[index + 1] = 0; data[index + 2] = 0; data[index + 3] = 0; modified = true; }
                   } else if (tool === 'draw') {
                       if (data[index] !== colorR || data[index + 1] !== colorG || data[index + 2] !== colorB || data[index + 3] !== 255) { data[index] = colorR; data[index + 1] = colorG; data[index + 2] = colorB; data[index + 3] = 255; modified = true; }
                   }
              }
          }
      }
      if (modified) {
          const newImageData = new ImageData(data, width, currentImageData.height);
          const currentHistory = [...history];
          currentHistory[historyIndex] = newImageData;
          setHistory(currentHistory);
      }
   };


   // --- Zoom & Save ---
    const handleZoom = (factor: number) => {
         if (isLoadingImage || isRemovingBackground) return;
         const canvas = canvasRef.current; const container = containerRef.current;
         if (!canvas || !container || imageDimensions.width === 0 || imageDimensions.height === 0) return;
         const newZoom = Math.max(0.1, Math.min(zoom * factor, 32));
         const containerCenterX = container.offsetWidth / 2; const containerCenterY = container.offsetHeight / 2;
         const centerCoordsBeforeZoom = getCanvasCoordinates( canvas.getBoundingClientRect().left + containerCenterX, canvas.getBoundingClientRect().top + containerCenterY );
         const newOffsetX = containerCenterX - canvas.width / 2 - (centerCoordsBeforeZoom.x - imageDimensions.width / 2) * newZoom;
         const newOffsetY = containerCenterY - canvas.height / 2 - (centerCoordsBeforeZoom.y - imageDimensions.height / 2) * newZoom;
         setZoom(newZoom); setOffset({ x: newOffsetX, y: newOffsetY });
    };
    const handleZoomIn = () => handleZoom(1.2);
    const handleZoomOut = () => handleZoom(1 / 1.2);

    const handleSaveSelection = () => {
        if (isLoadingImage || isRemovingBackground) return;
        const previewCanvas = previewCanvasRef.current;
        if (!previewCanvas || !selection || selection.width < 1 || selection.height < 1) { console.warn("Cannot save: Invalid selection or preview canvas."); return; };
        try {
            const dataUrl = previewCanvas.toDataURL('image/png');
            onSaveSprite(selectedSpriteState, dataUrl);
            setSelection(null);
        } catch (e) {
             console.error("Error generating data URL from preview canvas:", e);
             if (e instanceof DOMException && e.name === 'SecurityError') {
                 toast({ title: "CORS Error", description: "Cannot save sprite due to cross-origin issues.", variant: "destructive"});
             } else {
                 toast({ title: "Save Error", description: "Could not save the selected sprite.", variant: "destructive"});
             }
         }
    };

    // --- Background Removal (Client-Side) ---
    const handleRemoveBackground = useCallback(async () => {
        if (historyIndex < 0 || !history[historyIndex] || imageDimensions.width === 0 || imageDimensions.height === 0) {
            toast({ title: "Error", description: "No image data available to remove background from.", variant: "destructive" });
            return;
        }
        setIsRemovingBackground(true);
        toast({ title: "Processing", description: "Removing background..." });

        try {
            const currentImageData = history[historyIndex];
            const width = currentImageData.width;
            const height = currentImageData.height;
            const data = new Uint8ClampedArray(currentImageData.data); // Clone data

            // Simple background removal: Assume top-left pixel color is background
            // More sophisticated methods (flood fill, color distance) could be added here.
            const bgR = data[0];
            const bgG = data[1];
            const bgB = data[2];
            const bgA = data[3]; // Consider transparent backgrounds too?

            const tolerance = 30; // Tolerance for color matching (adjust as needed)

             // Worker would be ideal for performance, but keep it simple for now
             await new Promise(resolve => setTimeout(resolve, 10)); // Allow UI update

            for (let i = 0; i < data.length; i += 4) {
                const r = data[i];
                const g = data[i + 1];
                const b = data[i + 2];
                // Simple distance check (can be improved)
                const distance = Math.sqrt(
                    Math.pow(r - bgR, 2) +
                    Math.pow(g - bgG, 2) +
                    Math.pow(b - bgB, 2)
                );

                if (distance <= tolerance) {
                    data[i + 3] = 0; // Make transparent
                }
                 // Add a check for progress update if needed for long operations
                 // if (i % (width * 100 * 4) === 0) { // Example: update every 100 rows
                 //     await new Promise(resolve => setTimeout(resolve, 0)); // Yield to event loop
                 //     console.log(`BG Removal Progress: ${Math.round((i / data.length) * 100)}%`);
                 // }
            }

            const newImageData = new ImageData(data, width, height);

            // Save the result to history
            saveToHistory(newImageData);

             // Update the parent component's image state if callback exists
             if (onImageUpdate) {
                 const tempCanvas = document.createElement('canvas');
                 tempCanvas.width = width;
                 tempCanvas.height = height;
                 const tempCtx = tempCanvas.getContext('2d');
                 if (tempCtx) {
                     tempCtx.putImageData(newImageData, 0, 0);
                     onImageUpdate(tempCanvas.toDataURL());
                 }
             }

            toast({ title: "Success", description: "Background removed. You can undo if needed." });

        } catch (error) {
            console.error("Error removing background:", error);
            toast({ title: "Error", description: "Failed to remove background.", variant: "destructive" });
        } finally {
            setIsRemovingBackground(false);
        }
    }, [history, historyIndex, imageDimensions, toast, saveToHistory, onImageUpdate]); // Added dependencies


   // --- Cursor Style ---
   const getCursor = () => {
        if (isLoadingImage || isRemovingBackground) return 'wait';
        switch (tool) {
            case 'pan': return isDragging ? 'grabbing' : 'grab';
            case 'select': return 'crosshair';
            case 'erase': case 'draw': return 'crosshair';
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
                     <Button variant={tool === 'pan' ? "secondary" : "ghost"} size="icon" onClick={() => setTool('pan')} className="h-8 w-8" disabled={isLoadingImage || isRemovingBackground}> <MousePointer size={16} /> </Button>
                  </TooltipTrigger>
                  <TooltipContent><p>Pan (P)</p></TooltipContent>
               </Tooltip>
               <Tooltip>
                   <TooltipTrigger asChild>
                      <Button variant={tool === 'select' ? "secondary" : "ghost"} size="icon" onClick={() => setTool('select')} className="h-8 w-8" disabled={isLoadingImage || isRemovingBackground}> <Slice size={16}/> </Button>
                   </TooltipTrigger>
                   <TooltipContent><p>Select (S)</p></TooltipContent>
               </Tooltip>
              <Tooltip>
                 <TooltipTrigger asChild>
                    <Button variant={tool === 'draw' ? "secondary" : "ghost"} size="icon" onClick={() => setTool('draw')} className="h-8 w-8" disabled={isLoadingImage || isRemovingBackground || historyIndex < 0}> <Paintbrush size={16} /> </Button>
                 </TooltipTrigger>
                 <TooltipContent><p>Brush (B)</p></TooltipContent>
              </Tooltip>
              <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant={tool === 'erase' ? "secondary" : "ghost"} size="icon" onClick={() => setTool('erase')} className="h-8 w-8" disabled={isLoadingImage || isRemovingBackground || historyIndex < 0}> <Eraser size={16} /> </Button>
                  </TooltipTrigger>
                  <TooltipContent><p>Eraser (E)</p></TooltipContent>
              </Tooltip>

              {/* Brush/Eraser Options */}
              {(tool === 'erase' || tool === 'draw') && (
                <div className="flex items-center mx-2">
                   <Label htmlFor="brush-size" className="sr-only">Size</Label>
                   <Slider id="brush-size" defaultValue={[brushSize]} max={50} min={1} step={1} className="w-20" onValueChange={(value) => setBrushSize(value[0])} aria-label="Brush Size" disabled={isLoadingImage || isRemovingBackground || historyIndex < 0}/>
                   <span className="text-xs w-6 text-right mr-2">{brushSize}px</span>
                   {tool === 'draw' && (
                      <Tooltip>
                           <TooltipTrigger asChild>
                               <Input aria-label="Draw color" type="color" value={drawColor} onChange={(e) => setDrawColor(e.target.value)} className="w-8 h-8 p-0.5 input-pixel" disabled={isLoadingImage || isRemovingBackground || historyIndex < 0} />
                           </TooltipTrigger>
                           <TooltipContent><p>Draw Color</p></TooltipContent>
                      </Tooltip>
                   )}
                </div>
               )}

               {/* BG Removal, Zoom & Undo */}
               <div className="flex items-center gap-1 ml-auto">
                  <Tooltip>
                     <TooltipTrigger asChild>
                        <Button variant="ghost" size="icon" onClick={handleRemoveBackground} disabled={isLoadingImage || isRemovingBackground || historyIndex < 0} className="h-8 w-8">
                          {isRemovingBackground ? (
                            <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"> <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle> <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path> </svg>
                           ) : (
                             <RemoveBgIcon size={16} />
                           )}
                        </Button>
                     </TooltipTrigger>
                     <TooltipContent><p>Remove Background (Basic)</p></TooltipContent>
                  </Tooltip>
                   <Tooltip>
                      <TooltipTrigger asChild>
                          <Button variant="ghost" size="icon" onClick={handleZoomIn} className="h-8 w-8" disabled={isLoadingImage || isRemovingBackground || imageDimensions.width === 0}> <ZoomIn size={16} /> </Button>
                      </TooltipTrigger>
                      <TooltipContent><p>Zoom In (+)</p></TooltipContent>
                   </Tooltip>
                   <Tooltip>
                      <TooltipTrigger asChild>
                          <Button variant="ghost" size="icon" onClick={handleZoomOut} className="h-8 w-8" disabled={isLoadingImage || isRemovingBackground || imageDimensions.width === 0}> <ZoomOut size={16} /> </Button>
                      </TooltipTrigger>
                      <TooltipContent><p>Zoom Out (-)</p></TooltipContent>
                   </Tooltip>
                   <Tooltip>
                      <TooltipTrigger asChild>
                           <Button variant="ghost" size="icon" onClick={handleUndo} disabled={historyIndex <= 0 || isLoadingImage || isRemovingBackground} className="h-8 w-8"> <RotateCcw size={16} /> </Button>
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

        {/* Canvas Container */}
        <div
             ref={containerRef}
             className="flex-grow overflow-hidden relative bg-gray-400"
             style={{ cursor: getCursor() }}
        >
         {(isLoadingImage || isRemovingBackground) && (
             <div className="absolute inset-0 flex items-center justify-center bg-background/80 z-20">
                 <div className="flex flex-col items-center gap-2">
                      <svg className="animate-spin h-8 w-8 text-primary" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                           <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                           <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                       </svg>
                       <p className="text-sm text-foreground">{isRemovingBackground ? 'Removing Background...' : 'Loading Image...'}</p>
                 </div>
             </div>
         )}
          <canvas
            ref={canvasRef}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseLeave}
            onWheel={handleWheel}
            className="block" // Canvas itself takes block display
            style={{
                imageRendering: 'pixelated',
                touchAction: 'none',
                opacity: (isLoadingImage || isRemovingBackground) ? 0.5 : 1, // Dim canvas when loading
                transition: 'opacity 0.2s ease-in-out',
                // width and height set by container resize observer
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
                    />
              </div>
             <div className="flex-grow space-y-1">
                 <Label htmlFor="sprite-state-select" className="text-xs font-semibold">Assign to Pose:</Label>
                 <Select value={selectedSpriteState} onValueChange={(value) => setSelectedSpriteState(value as SpriteState)} disabled={isLoadingImage || isRemovingBackground}>
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
             <Button onClick={handleSaveSelection} size="sm" className="btn-pixel-accent h-9 self-end" disabled={isLoadingImage || isRemovingBackground}>
               <Save size={14} className="mr-1" /> Save Pose
             </Button>
           </div>
       )}
    </div>
  );
};

export default SpriteEditor;
