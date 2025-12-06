import { GoogleGenAI, Modality } from "@google/genai";

const apiKey = process.env.API_KEY || '';
const ai = new GoogleGenAI({ apiKey });

export const generateDiaryImage = async (diaryText: string): Promise<string> => {
  if (!apiKey) {
    throw new Error("API Key is missing.");
  }

  try {
    // Prompt engineering for a "Talented 1st grader's crayon drawing" style
    // Strongly enforcing human protagonist and NO TEXT
    const prompt = `
      Create a high-quality crayon drawing on white paper that looks like it was drawn by a talented 7-year-old elementary school student.

      CRITICAL NEGATIVE CONSTRAINTS:
      - ABSOLUTELY NO TEXT, NO WORDS, NO LETTERS, NO NUMBERS, and NO SPEECH BUBBLES.
      - The drawing must be purely visual representation.

      MANDATORY RULES FOR SUBJECT:
      1. The MAIN CHARACTER must ALWAYS be a human child (a 7-year-old boy or girl).
      2. NEVER draw an animal as the main protagonist. If the text mentions an animal (e.g., "My dog ran"), draw the CHILD playing with or watching the dog.
      3. The child should be central to the scene.

      Style details:
      - Art Style: High-quality, colorful, and neat crayon art. Not messy scribbles, but a "masterpiece" by a gifted child.
      - Technique: Use vibrant colors (primary colors), confident strokes, and fully filled-in coloring. 
      - Mood: Cheerful, innocent, and bright.
      - Background: Clean white drawing paper.

      Diary Content to Visualize: "${diaryText}"
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: {
        parts: [
          {
            text: prompt,
          },
        ],
      },
      config: {
        imageConfig: {
          aspectRatio: "4:3", // Typical picture diary aspect ratio
        }
      }
    });

    // Extract image from response
    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) {
        const base64EncodeString = part.inlineData.data;
        return `data:image/png;base64,${base64EncodeString}`;
      }
    }

    throw new Error("No image data found in response");

  } catch (error) {
    console.error("Error generating image:", error);
    throw error;
  }
};

export const generateDiarySpeech = async (text: string): Promise<string | undefined> => {
  if (!apiKey) {
    throw new Error("API Key is missing.");
  }
  
  // Changed to 'Zephyr' for a calm, soft, teacher-like female voice
  const voiceName = 'Zephyr';

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: [{ parts: [{ text: text }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: voiceName },
            },
        },
      },
    });

    return response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
  } catch (error) {
    console.error("Error generating speech:", error);
    throw error;
  }
};