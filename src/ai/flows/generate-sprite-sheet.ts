
'use server';
/**
 * @fileOverview Generates an 8-bit sprite sheet based on a user-provided image and text description.
 *
 * - generateSpriteSheet - A function that handles the sprite sheet generation process.
 * - GenerateSpriteSheetInput - The input type for the generateSpriteSheet function.
 * - GenerateSpriteSheetOutput - The return type for the generateSpriteSheet function.
 */

import {ai} from '@/ai/ai-instance';
import {z} from 'genkit';

const GenerateSpriteSheetInputSchema = z.object({
  photoDataUri: z
    .string()
    .describe(
      "A photo to use as a reference for generating the sprite sheet, as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'."
    ),
  description: z.string().describe('A description of the character to create in the sprite sheet.'),
});
export type GenerateSpriteSheetInput = z.infer<typeof GenerateSpriteSheetInputSchema>;

const GenerateSpriteSheetOutputSchema = z.object({
  spriteSheetDataUri: z
    .string()
    .describe("The generated 8-bit sprite sheet as a data URI."),
});
export type GenerateSpriteSheetOutput = z.infer<typeof GenerateSpriteSheetOutputSchema>;

export async function generateSpriteSheet(input: GenerateSpriteSheetInput): Promise<GenerateSpriteSheetOutput> {
  return generateSpriteSheetFlow(input);
}

// Note: definePrompt is not used here because we need multimodal input (image + text)
// directly in ai.generate with the experimental image generation model.

const generateSpriteSheetFlow = ai.defineFlow<
  typeof GenerateSpriteSheetInputSchema,
  typeof GenerateSpriteSheetOutputSchema
>(
  {
    name: 'generateSpriteSheetFlow',
    inputSchema: GenerateSpriteSheetInputSchema,
    outputSchema: GenerateSpriteSheetOutputSchema,
  },
  async input => {
     console.log("Starting sprite sheet generation flow.");
     console.log("Input description:", input.description);
     console.log("Input photoDataUri (start):", input.photoDataUri.substring(0, 50) + "...");

     try {
        const {media} = await ai.generate({
          // IMPORTANT: ONLY the googleai/gemini-2.0-flash-exp model is able to generate images.
          model: 'googleai/gemini-2.0-flash-exp',
          prompt: [
            {media: {url: input.photoDataUri}},
            {text: `Create an 8-bit sprite sheet based on this character. ${input.description}. The output MUST be an image containing multiple poses or frames suitable for a game sprite sheet. Use an 8-bit pixel art style. Do not include transparency unless absolutely necessary for the character's design.`},
          ],
          config: {
            responseModalities: ['TEXT', 'IMAGE'], // MUST provide both TEXT and IMAGE
          },
        });

         if (!media || !media.url) {
             console.error("Sprite sheet generation flow: No media returned from AI generate.");
             throw new Error('Sprite sheet generation failed: No image returned from the model.');
         }

         console.log("Sprite sheet generation successful. Result URI:", media.url.substring(0, 50) + "...");
        return {spriteSheetDataUri: media.url};

     } catch (error) {
         console.error("Error during sprite sheet generation flow:", error);

         // Check if it's a known GenkitError related to safety settings
         if (error instanceof Error && error.message.includes('Generation blocked')) {
            throw new Error('Generation failed due to safety settings. Please try a different image or description.');
         }

         // Re-throw other errors
         throw new Error(`Sprite sheet generation failed: ${error instanceof Error ? error.message : String(error)}`);
     }
  }
);
