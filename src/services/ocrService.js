// OCR Service using Tesseract.js
import Tesseract from 'tesseract.js';

// Configuration for card name recognition
const TESSERACT_CONFIG = {
  lang: 'eng',
  oem: 1, // LSTM only
  psm: 7, // Single line of text
};

/**
 * Preprocesses recognized text to improve card name matching
 */
const preprocessText = (text) => {
  return text
    .replace(/[^a-zA-Z0-9\s',\-]/g, '') // Remove special characters except common ones
    .replace(/\s+/g, ' ') // Normalize whitespace
    .trim();
};

/**
 * Extracts potential card names from OCR result
 * Card names are usually in the top portion of the card
 */
const extractCardNames = (text) => {
  const lines = text.split('\n')
    .map(line => preprocessText(line))
    .filter(line => line.length > 2 && line.length < 50); // Card names are typically short
  
  // Return the first few lines as potential card names
  return lines.slice(0, 3);
};

/**
 * Performs OCR on an image and returns potential card names
 * @param {string} imageUri - URI of the image to process
 * @param {function} onProgress - Progress callback (0-100)
 * @returns {Promise<{success: boolean, cardNames: string[], rawText: string, confidence: number}>}
 */
export const recognizeCardFromImage = async (imageUri, onProgress = () => {}) => {
  try {
    onProgress(10);
    
    const result = await Tesseract.recognize(
      imageUri,
      'eng',
      {
        logger: (m) => {
          if (m.status === 'recognizing text') {
            onProgress(10 + Math.round(m.progress * 80));
          }
        },
      }
    );
    
    onProgress(95);
    
    const rawText = result.data.text;
    const confidence = result.data.confidence;
    const cardNames = extractCardNames(rawText);
    
    onProgress(100);
    
    return {
      success: cardNames.length > 0,
      cardNames,
      rawText,
      confidence,
      bestGuess: cardNames[0] || null,
    };
  } catch (error) {
    console.error('OCR Error:', error);
    return {
      success: false,
      cardNames: [],
      rawText: '',
      confidence: 0,
      error: error.message,
    };
  }
};

/**
 * Recognizes text from a specific region of an image
 * Useful for focusing on the card name area (top of the card)
 */
export const recognizeCardNameRegion = async (imageUri, onProgress = () => {}) => {
  // For now, we process the full image
  // In a more advanced version, we could crop to the top 20% where the name is
  return recognizeCardFromImage(imageUri, onProgress);
};

/**
 * Batch process multiple images
 */
export const recognizeMultipleCards = async (imageUris, onProgress = () => {}) => {
  const results = [];
  const total = imageUris.length;
  
  for (let i = 0; i < total; i++) {
    const result = await recognizeCardFromImage(
      imageUris[i],
      (p) => onProgress(((i + p / 100) / total) * 100)
    );
    results.push(result);
  }
  
  return results;
};

/**
 * Clean up Tesseract workers when done
 */
export const terminateWorker = async () => {
  // Tesseract.js handles worker cleanup automatically in newer versions
  // This is here for potential future use
};

export default {
  recognizeCardFromImage,
  recognizeCardNameRegion,
  recognizeMultipleCards,
  terminateWorker,
};
