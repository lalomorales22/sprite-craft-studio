
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
    .describe("The image with the background removed as a data URI, preferably with a transparent background."),
});
export type RemoveBackgroundOutput = z.infer<typeof RemoveBackgroundOutputSchema>;

export async function removeBackground(input: RemoveBackgroundInput): Promise<RemoveBackgroundOutput> {
  return removeBackgroundFlow(input);
}

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
             // Updated prompt for clarity and specificity
            {text: 'Identify the main subject(s) in this image. Remove everything else, making the background transparent (alpha channel). Preserve the subject(s) accurately. Output the resulting image.'},
          ],
          config: {
            responseModalities: ['TEXT', 'IMAGE'], // MUST provide both TEXT and IMAGE
          },
        });

        if (!media || !media.url) {
             console.error("Background removal flow: No media returned from AI generate.");
             throw new Error('Background removal failed: No image returned from the model.');
        }

         // Basic check if the output looks like a PNG data URI (suggests transparency support)
        if (media.url.startsWith('data:image/png;base64,')) {
             console.log("Background removal successful (PNG detected). Result URI:", media.url.substring(0, 50) + "...");
        } else {
             console.warn("Background removal result is not a PNG data URI. Transparency might not be present:", media.url.substring(0, 50) + "...");
        }

        return {imageDataUri: media.url};

    } catch (error) {
         console.error("Error during background removal flow:", error);
         const errorMessage = error instanceof Error ? error.message : String(error);
          if (errorMessage.includes('Generation blocked')) {
             throw new Error('Background removal failed due to safety settings. The image might be unsuitable.');
          }
         // Re-throw other errors
         throw new Error(`Background removal failed: ${errorMessage}`);
    }
  }
);
