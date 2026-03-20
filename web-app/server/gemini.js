import { GoogleGenAI } from '@google/genai';

function parseExtractionResponse(content) {
  if (!content || typeof content !== 'string') return { textBlocks: [], fullText: '' };
  const trimmed = content.trim();
  let jsonStr = trimmed;
  const codeBlock = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeBlock) jsonStr = codeBlock[1].trim();
  try {
    const data = JSON.parse(jsonStr);
    return {
      textBlocks: Array.isArray(data.textBlocks) ? data.textBlocks : [],
      fullText: typeof data.fullText === 'string' ? data.fullText : '',
    };
  } catch {
    return { textBlocks: [], fullText: trimmed };
  }
}

const EXTRACTION_PROMPT = `You are analyzing an image of labels on small boxes. Your task is to extract ONLY the visible printed text from the labels. Ignore completely: QR codes, barcodes, datamatrix codes, and any other non-text graphics.

For each distinct text block (a line or group of lines that appear together on a label), provide:
1. The exact text as it appears, preserving all spaces, line breaks, punctuation, and gaps. Do not correct or normalize the text.
2. A bounding box as [x_min, y_min, x_max, y_max] in NORMALIZED coordinates from 0 to 1:
   - (0, 0) = top-left corner of the image, (1, 1) = bottom-right.
   - x_min = left edge of the text (0 = left side of image), x_max = right edge.
   - y_min = top edge of the text (0 = top of image), y_max = bottom edge.
   - The box must tightly enclose only that text block. Use the full image width and height as reference for 0-1.

Respond with a single valid JSON object (no markdown, no code fence) in this exact format:
{"textBlocks":[{"text":"exact text here","bbox":[x_min,y_min,x_max,y_max]}],"fullText":"all extracted text with line breaks preserved exactly as in the image"}

Example: {"textBlocks":[{"text":"H 103/21\\n1","bbox":[0.1,0.05,0.4,0.12]}],"fullText":"H 103/21\\n1\\nH 112/21\\n(H) 1\\n..."}`;

export async function analyzeWithGemini(buffer, mimeType, apiKey) {
  const ai = new GoogleGenAI({ apiKey });
  const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
  const base64 = buffer.toString('base64');
  const contents = [
    { inlineData: { mimeType: mimeType || 'image/png', data: base64 } },
    { text: EXTRACTION_PROMPT },
  ];
  const response = await ai.models.generateContent({
    model,
    contents,
  });
  const text = response?.text ?? '';
  return parseExtractionResponse(text);
}
