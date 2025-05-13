# SpriteCraft Studio
![Screenshot 2025-05-13 at 1 00 54 AM](https://github.com/user-attachments/assets/07e3e21d-019b-456a-8864-b58a77f75279)

SpriteCraft Studio is a Next.js application that allows you to generate and edit 8-bit sprites using AI, and then use them in a simple game world.

You can find the project repository on GitHub:
git clone https://github.com/lalomorales22/sprite-craft-studio.git


## Getting Started

To get started with development:

1.  **Install dependencies:**
    ```bash
    npm install
    # or
    yarn install
    # or
    pnpm install
    ```

2.  **Set up environment variables:**
    Create a `.env.local` file in the root of your project and add your Google Generative AI API key:
    ```env
    GOOGLE_GENAI_API_KEY=YOUR_API_KEY
    ```

3.  **Run the development server for Next.js:**
    ```bash
    npm run dev
    # or
    yarn dev
    # or
    pnpm dev
    ```
    This will start the Next.js application, typically on `http://localhost:9002`.

4.  **Run the Genkit development server (in a separate terminal):**
    ```bash
    npm run genkit:dev
    # or
    yarn genkit:dev
    # or
    pnpm genkit:dev
    ```
    This starts the Genkit development flow server, which is necessary for the AI features to work.

Open [http://localhost:9002](http://localhost:9002) with your browser to see the result.

You can start editing the main page by modifying `src/app/page.tsx`. The Genkit AI flows are located in the `src/ai/flows/` directory.
