// Scryfall API Service
// Documentation: https://scryfall.com/docs/api

const BASE_URL = 'https://api.scryfall.com';

// Supported languages
export const LANGUAGES = {
  en: { code: 'en', name: 'English', flag: '🇬🇧' },
  fr: { code: 'fr', name: 'Français', flag: '🇫🇷' },
  de: { code: 'de', name: 'Deutsch', flag: '🇩🇪' },
  es: { code: 'es', name: 'Español', flag: '🇪🇸' },
  it: { code: 'it', name: 'Italiano', flag: '🇮🇹' },
  pt: { code: 'pt', name: 'Português', flag: '🇵🇹' },
  ja: { code: 'ja', name: '日本語', flag: '🇯🇵' },
};

// Rate limiting: 50-100ms between requests
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

let lastRequestTime = 0;

const rateLimitedFetch = async (url, options = {}) => {
  const now = Date.now();
  const timeSinceLastRequest = now - lastRequestTime;
  if (timeSinceLastRequest < 100) {
    await delay(100 - timeSinceLastRequest);
  }
  lastRequestTime = Date.now();
  
  const response = await fetch(url, {
    ...options,
    headers: {
      'User-Agent': 'MTGCollectionApp/1.0',
      'Accept': 'application/json',
      ...options.headers,
    },
  });
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.details || `API Error: ${response.status}`);
  }
  
  return response.json();
};

// Search cards by name with language support
export const searchCardsByName = async (query, page = 1, lang = null) => {
  const encodedQuery = encodeURIComponent(query);
  let url = `${BASE_URL}/cards/search?q=${encodedQuery}&page=${page}`;
  
  // Add language filter if specified and not English
  if (lang && lang !== 'en') {
    url = `${BASE_URL}/cards/search?q=${encodedQuery}+lang:${lang}&page=${page}`;
  }
  
  const data = await rateLimitedFetch(url);
  return data;
};

// Search cards in any language (useful for French card names)
export const searchCardsByNameAnyLang = async (query, page = 1) => {
  const encodedQuery = encodeURIComponent(query);
  // lang:any searches in all languages
  const url = `${BASE_URL}/cards/search?q=${encodedQuery}+lang:any&page=${page}&unique=prints`;
  
  const data = await rateLimitedFetch(url);
  return data;
};

// Get card by exact name
export const getCardByExactName = async (name, lang = null) => {
  const encodedName = encodeURIComponent(name);
  let url = `${BASE_URL}/cards/named?exact=${encodedName}`;
  
  if (lang && lang !== 'en') {
    // For non-English, we need to search differently
    url = `${BASE_URL}/cards/search?q=!"${encodedName}"+lang:${lang}`;
    const data = await rateLimitedFetch(url);
    if (data.data && data.data.length > 0) {
      return data.data[0];
    }
    throw new Error('Card not found');
  }
  
  const data = await rateLimitedFetch(url);
  return data;
};

// Get card by fuzzy name (for scanner results) with language support
export const getCardByFuzzyName = async (name, lang = null) => {
  const encodedName = encodeURIComponent(name);
  
  // First try the standard fuzzy search
  try {
    const url = `${BASE_URL}/cards/named?fuzzy=${encodedName}`;
    const data = await rateLimitedFetch(url);
    return data;
  } catch (error) {
    // If standard search fails and we have a language, try searching in that language
    if (lang && lang !== 'en') {
      return searchCardInLanguage(name, lang);
    }
    // Try searching in any language as fallback
    return searchCardInAnyLanguage(name);
  }
};

// Search for a card specifically in a given language
export const searchCardInLanguage = async (name, lang) => {
  const encodedName = encodeURIComponent(name);
  const url = `${BASE_URL}/cards/search?q=${encodedName}+lang:${lang}`;
  
  const data = await rateLimitedFetch(url);
  if (data.data && data.data.length > 0) {
    return data.data[0];
  }
  throw new Error('Card not found in specified language');
};

// Search for a card in any language (useful for French names)
export const searchCardInAnyLanguage = async (name) => {
  const encodedName = encodeURIComponent(name);
  // lang:any searches across all languages
  const url = `${BASE_URL}/cards/search?q=${encodedName}+lang:any`;
  
  const data = await rateLimitedFetch(url);
  if (data.data && data.data.length > 0) {
    return data.data[0];
  }
  throw new Error('Card not found');
};

// Get card in a specific language by its English name or ID
export const getCardInLanguage = async (cardNameOrId, lang) => {
  // First get the card in English to get its oracle_id
  let card;
  try {
    card = await getCardByFuzzyName(cardNameOrId);
  } catch {
    // Try direct ID lookup
    card = await getCardById(cardNameOrId);
  }
  
  if (!card || !card.oracle_id) {
    throw new Error('Card not found');
  }
  
  // Now search for the specific language version
  const url = `${BASE_URL}/cards/search?q=oracleid:${card.oracle_id}+lang:${lang}`;
  
  try {
    const data = await rateLimitedFetch(url);
    if (data.data && data.data.length > 0) {
      return data.data[0];
    }
  } catch {
    // Language version not found, return English version
    return card;
  }
  
  return card;
};

// Get autocomplete suggestions
export const getAutocomplete = async (query) => {
  if (!query || query.length < 2) return { data: [] };
  const encodedQuery = encodeURIComponent(query);
  const data = await rateLimitedFetch(
    `${BASE_URL}/cards/autocomplete?q=${encodedQuery}`
  );
  return data;
};

// Get card by ID
export const getCardById = async (id) => {
  const data = await rateLimitedFetch(`${BASE_URL}/cards/${id}`);
  return data;
};

// Get multiple cards by identifiers
export const getCardCollection = async (identifiers) => {
  // Maximum 75 cards per request
  const chunks = [];
  for (let i = 0; i < identifiers.length; i += 75) {
    chunks.push(identifiers.slice(i, i + 75));
  }
  
  const results = [];
  for (const chunk of chunks) {
    const data = await rateLimitedFetch(`${BASE_URL}/cards/collection`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ identifiers: chunk }),
    });
    results.push(...(data.data || []));
  }
  
  return results;
};

// Get all sets
export const getAllSets = async () => {
  const data = await rateLimitedFetch(`${BASE_URL}/sets`);
  return data.data;
};

// Get cards from a specific set
export const getCardsFromSet = async (setCode, page = 1) => {
  const data = await rateLimitedFetch(
    `${BASE_URL}/cards/search?q=set:${setCode}&page=${page}&order=set`
  );
  return data;
};

// Get random card
export const getRandomCard = async () => {
  const data = await rateLimitedFetch(`${BASE_URL}/cards/random`);
  return data;
};

// Parse a decklist text and return card information
export const parseDeckList = async (decklistText, lang = null) => {
  const lines = decklistText.split('\n').filter(line => line.trim());
  const cards = [];
  
  for (const line of lines) {
    // Parse formats like "4 Lightning Bolt" or "4x Lightning Bolt" or just "Lightning Bolt"
    const match = line.match(/^(\d+)?x?\s*(.+)$/i);
    if (match) {
      const quantity = parseInt(match[1]) || 1;
      const cardName = match[2].trim();
      
      // Skip empty names or section headers
      if (!cardName || cardName.startsWith('//') || cardName.startsWith('#')) {
        continue;
      }
      
      cards.push({
        name: cardName,
        quantity,
      });
    }
  }
  
  // Fetch card data from Scryfall
  const identifiers = cards.map(c => ({ name: c.name }));
  
  try {
    const cardData = await getCardCollection(identifiers);
    
    // Match fetched data with quantities
    const results = cards.map(card => {
      const data = cardData.find(
        d => d.name.toLowerCase() === card.name.toLowerCase()
      );
      return {
        ...card,
        cardData: data || null,
        found: !!data,
      };
    });
    
    // For cards not found, try searching in specified language or any language
    for (let i = 0; i < results.length; i++) {
      if (!results[i].found) {
        try {
          const searchLang = lang || 'any';
          const foundCard = searchLang === 'any' 
            ? await searchCardInAnyLanguage(results[i].name)
            : await searchCardInLanguage(results[i].name, searchLang);
          
          if (foundCard) {
            results[i].cardData = foundCard;
            results[i].found = true;
          }
        } catch {
          // Card still not found
        }
      }
    }
    
    return results;
  } catch (error) {
    console.error('Error fetching card collection:', error);
    return cards.map(card => ({
      ...card,
      cardData: null,
      found: false,
    }));
  }
};

// Get card image URL
export const getCardImageUrl = (card, size = 'normal') => {
  if (!card) return null;
  
  // Handle double-faced cards
  if (card.card_faces && card.card_faces[0].image_uris) {
    return card.card_faces[0].image_uris[size];
  }
  
  return card.image_uris?.[size] || null;
};

// Extract card color identity
export const getColorIdentity = (card) => {
  return card.color_identity || [];
};

// Check if a card is legal in a format
export const isLegalInFormat = (card, format) => {
  return card.legalities?.[format] === 'legal' || card.legalities?.[format] === 'restricted';
};

// Get the printed name (in the card's language)
export const getPrintedName = (card) => {
  return card.printed_name || card.name;
};

// Get card info including foreign name if available
export const getCardDisplayInfo = (card) => {
  return {
    name: card.name,
    printedName: card.printed_name || card.name,
    lang: card.lang || 'en',
    isEnglish: card.lang === 'en' || !card.lang,
  };
};

export default {
  LANGUAGES,
  searchCardsByName,
  searchCardsByNameAnyLang,
  getCardByExactName,
  getCardByFuzzyName,
  searchCardInLanguage,
  searchCardInAnyLanguage,
  getCardInLanguage,
  getAutocomplete,
  getCardById,
  getCardCollection,
  getAllSets,
  getCardsFromSet,
  getRandomCard,
  parseDeckList,
  getCardImageUrl,
  getColorIdentity,
  isLegalInFormat,
  getPrintedName,
  getCardDisplayInfo,
};