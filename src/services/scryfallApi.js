// Scryfall API Service
// Documentation: https://scryfall.com/docs/api

const BASE_URL = 'https://api.scryfall.com';

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

// Search cards by name
export const searchCardsByName = async (query, page = 1) => {
  const encodedQuery = encodeURIComponent(query);
  const data = await rateLimitedFetch(
    `${BASE_URL}/cards/search?q=${encodedQuery}&page=${page}`
  );
  return data;
};

// Get card by exact name
export const getCardByExactName = async (name) => {
  const encodedName = encodeURIComponent(name);
  const data = await rateLimitedFetch(
    `${BASE_URL}/cards/named?exact=${encodedName}`
  );
  return data;
};

// Get card by fuzzy name (for scanner results)
export const getCardByFuzzyName = async (name) => {
  const encodedName = encodeURIComponent(name);
  const data = await rateLimitedFetch(
    `${BASE_URL}/cards/named?fuzzy=${encodedName}`
  );
  return data;
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
export const parseDeckList = async (decklistText) => {
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
    return cards.map(card => {
      const data = cardData.find(
        d => d.name.toLowerCase() === card.name.toLowerCase()
      );
      return {
        ...card,
        cardData: data || null,
        found: !!data,
      };
    });
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

export default {
  searchCardsByName,
  getCardByExactName,
  getCardByFuzzyName,
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
};
