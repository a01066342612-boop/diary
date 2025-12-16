import { GoogleGenAI, Modality } from "@google/genai";

const apiKey = process.env.API_KEY || '';
const ai = new GoogleGenAI({ apiKey });

export const generateDiaryImage = async (diaryText: string, referenceImageBase64?: string): Promise<string> => {
  if (!apiKey) {
    throw new Error("API Key is missing.");
  }

  try {
    // Prompt engineering for a "Talented 1st grader's crayon drawing" style
    const systemPrompt = `
      STRICT INSTRUCTION: GENERATE AN IMAGE ONLY. NO TEXT ALLOWED.

      Create a high-quality crayon drawing on white paper that looks like it was drawn by a talented 7-year-old elementary school student.

      CRITICAL NEGATIVE CONSTRAINTS (MUST FOLLOW):
      - ABSOLUTELY NO TEXT, NO WORDS, NO LETTERS, NO NUMBERS, and NO SYMBOLS.
      - NO SPEECH BUBBLES or THOUGHT BUBBLES.
      - NO SIGNATURES or WATERMARKS.
      - If the context implies reading or writing (e.g., books, signs, screens), use squiggle lines or blank shapes to represent text. NEVER write legible characters.
      
      Visual Style:
      - Art Style: High-quality, colorful, and neat crayon art on white textured paper.
      - Technique: Vibrant primary colors, confident child-like strokes.
      - Mood: Cheerful, innocent, bright, and heartwarming.

      Subject Rules:
      1. Main Character: ALWAYS a human child (approx. 7 years old).
      2. If animals are mentioned, the child must be present interacting with them.
      3. Focus on the *scene* or *action* described.
    `;

    const parts: any[] = [];
    
    // If a reference image is provided, add it to the parts
    if (referenceImageBase64) {
      // Safer parsing of Data URI without using Regex on huge strings to avoid Maximum call stack size exceeded
      // Format is usually: data:image/png;base64,.....
      const commaIndex = referenceImageBase64.indexOf(',');
      
      let mimeType = 'image/jpeg';
      let data = referenceImageBase64;

      if (commaIndex !== -1) {
          const meta = referenceImageBase64.substring(0, commaIndex);
          data = referenceImageBase64.substring(commaIndex + 1);
          
          // Extract mime type from meta (e.g., "data:image/png;base64")
          const mimeMatch = meta.match(/:(.*?);/);
          if (mimeMatch) {
            mimeType = mimeMatch[1];
          }
      }

      parts.push({
        inlineData: {
          mimeType: mimeType,
          data: data
        }
      });
      
      // Instruction to use the reference image
      parts.push({
        text: systemPrompt + `\n\nINSTRUCTION: Transform the attached reference image into the crayon art style described above. Maintain the composition and main subjects of the reference image but render them as if drawn by a child with crayons.\n\nContext from diary: "${diaryText}"`
      });
    } else {
      // Text only prompt
      parts.push({
        text: systemPrompt + `\n\nScene Description to Draw: "${diaryText}"`
      });
    }

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: {
        parts: parts,
      },
      config: {
        imageConfig: {
          aspectRatio: "4:3",
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

export const streamDiarySpeech = async function* (text: string): AsyncGenerator<string, void, unknown> {
  if (!apiKey) {
    throw new Error("API Key is missing.");
  }

  const voiceName = 'Zephyr';

  try {
    const responseStream = await ai.models.generateContentStream({
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

    for await (const chunk of responseStream) {
      const data = chunk.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (data) {
        yield data;
      }
    }
  } catch (error) {
    console.error("Error streaming speech:", error);
    throw error;
  }
};