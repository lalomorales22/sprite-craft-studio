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

const prompt = ai.definePrompt({
  name: 'generateSpriteSheetPrompt',
  input: {
    schema: z.object({
      photoDataUri: z
        .string()
        .describe(
          "A photo to use as a reference for generating the sprite sheet, as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'."
        ),
      description: z.string().describe('A description of the character to create in the sprite sheet.'),
    }),
  },
  output: {
    schema: z.object({
      spriteSheetDataUri: z
        .string()
        .describe("The generated 8-bit sprite sheet as a data URI."),
    }),
  },
  prompt: `You are an expert in creating 8-bit sprite sheets for games. Based on the provided image and description, generate an 8-bit sprite sheet.

Description: {{{description}}}
Image: {{media url=photoDataUri}}

Create a sprite sheet that captures the essence of the character described, ensuring it is in an 8-bit style. The output MUST be a data URI representing the sprite sheet. Focus on the 8 bit look and feel. Do not include transparency.
`,
});

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
    const {media} = await ai.generate({
      model: 'googleai/gemini-2.0-flash-exp',
      prompt: [
        {media: {url: input.photoDataUri}},
        {text: `Create an 8-bit sprite sheet based on this character. ${input.description}`},
      ],
      config: {
        responseModalities: ['TEXT', 'IMAGE'],
      },
    });

    return {spriteSheetDataUri: media.url!};
  }
);
