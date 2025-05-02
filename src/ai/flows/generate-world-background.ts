'use server';
/**
 * @fileOverview Generates an 8-bit pixel art game world background based on a user description.
 *
 * - generateWorldBackground - A function that handles the world background generation process.
 * - GenerateWorldBackgroundInput - The input type for the generateWorldBackground function.
 * - GenerateWorldBackgroundOutput - The return type for the generateWorldBackground function.
 */

import {ai} from '@/ai/ai-instance';
import {z} from 'genkit';

const GenerateWorldBackgroundInputSchema = z.object({
  description: z.string().describe('A description of the 8-bit game world to generate.'),
});
export type GenerateWorldBackgroundInput = z.infer<typeof GenerateWorldBackgroundInputSchema>;

const GenerateWorldBackgroundOutputSchema = z.object({
  worldImageDataUri: z
    .string()
    .describe("The generated 8-bit world background image as a data URI."),
});
export type GenerateWorldBackgroundOutput = z.infer<typeof GenerateWorldBackgroundOutputSchema>;

export async function generateWorldBackground(input: GenerateWorldBackgroundInput): Promise<GenerateWorldBackgroundOutput> {
  return generateWorldBackgroundFlow(input);
}

const generateWorldBackgroundFlow = ai.defineFlow<
  typeof GenerateWorldBackgroundInputSchema,
  typeof GenerateWorldBackgroundOutputSchema
>(
  {
    name: 'generateWorldBackgroundFlow',
    inputSchema: GenerateWorldBackgroundInputSchema,
    outputSchema: GenerateWorldBackgroundOutputSchema,
  },
  async input => {
     console.log("Starting world background generation flow for description:", input.description);
     try {
        const {media} = await ai.generate({
          // IMPORTANT: ONLY the googleai/gemini-2.0-flash-exp model is able to generate images.
          model: 'googleai/gemini-2.0-flash-exp',
          prompt: `Generate an 8-bit pixel art style game world background based on the following description: "${input.description}". Ensure it looks like a classic 8-bit game background. The image should primarily be a landscape or environment suitable for a side-scrolling game. Do not include any characters or specific interactive objects unless explicitly requested in the description. Focus on the overall scene and atmosphere. Output dimensions should be suitable for a game background (e.g., widescreen aspect ratio if possible, like 800x400).`,
          config: {
            responseModalities: ['TEXT', 'IMAGE'], // MUST provide both TEXT and IMAGE
          },
        });

         if (!media || !media.url) {
             console.error("World background generation flow: No media returned from AI generate.");
             throw new Error('World background generation failed: No image returned from the model.');
        }

         console.log("World background generation successful. Result URI:", media.url.substring(0, 50) + "...");
        return {worldImageDataUri: media.url};

     } catch (error) {
         console.error("Error during world background generation flow:", error);
         // Re-throw the error to be caught by the caller
         throw new Error(`World background generation failed: ${error instanceof Error ? error.message : String(error)}`);
     }
  }
);
