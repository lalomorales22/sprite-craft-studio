'use server';
/**
 * @fileOverview Removes the background from a provided image.
 *
 * - removeBackground - A function that handles the background removal process.
 * - RemoveBackgroundInput - The input type for the removeBackground function.
 * - RemoveBackgroundOutput - The return type for the removeBackground function.
 */

import {ai} from '@/ai/ai-instance';
import {z} from 'genkit';

const RemoveBackgroundInputSchema = z.object({
  photoDataUri: z
    .string()
    .describe(
      "A photo to remove the background from, as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'."
    ),
});
export type RemoveBackgroundInput = z.infer<typeof RemoveBackgroundInputSchema>;

const RemoveBackgroundOutputSchema = z.object({
  imageDataUri: z
    .string()
    .describe("The image with the background removed as a data URI."),
});
export type RemoveBackgroundOutput = z.infer<typeof RemoveBackgroundOutputSchema>;

export async function removeBackground(input: RemoveBackgroundInput): Promise<RemoveBackgroundOutput> {
  return removeBackgroundFlow(input);
}

// Note: Using definePrompt isn't strictly necessary here as we're directly calling ai.generate,
// but it helps structure the expected input/output for the underlying model interaction.
// The actual prompt text is constructed within the flow itself.

const removeBackgroundFlow = ai.defineFlow<
  typeof RemoveBackgroundInputSchema,
  typeof RemoveBackgroundOutputSchema
>(
  {
    name: 'removeBackgroundFlow',
    inputSchema: RemoveBackgroundInputSchema,
    outputSchema: RemoveBackgroundOutputSchema,
  },
  async input => {
    console.log("Starting background removal flow for image:", input.photoDataUri.substring(0, 50) + "...");
    try {
        const {media} = await ai.generate({
          // IMPORTANT: ONLY the googleai/gemini-2.0-flash-exp model is able to generate images.
          model: 'googleai/gemini-2.0-flash-exp',
          prompt: [
            {media: {url: input.photoDataUri}},
            {text: 'Remove the background from this image, keeping only the main subject. Output the result with a transparent background.'},
          ],
          config: {
            responseModalities: ['TEXT', 'IMAGE'], // MUST provide both TEXT and IMAGE
          },
        });

        if (!media || !media.url) {
             console.error("Background removal flow: No media returned from AI generate.");
             throw new Error('Background removal failed: No image returned from the model.');
        }

        console.log("Background removal successful. Result URI:", media.url.substring(0, 50) + "...");
        return {imageDataUri: media.url};

    } catch (error) {
         console.error("Error during background removal flow:", error);
         // Re-throw the error to be caught by the caller
         throw new Error(`Background removal failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
);
