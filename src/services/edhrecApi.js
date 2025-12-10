// EDHREC Service
// EDHREC doesn't have a public API, so we'll use their JSON endpoints that power their website

const BASE_URL = 'https://json.edhrec.com';

// Format card name for EDHREC URL
const formatCardName = (name) => {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .trim();
};

// Get commander recommendations
export const getCommanderRecommendations = async (commanderName) => {
  try {
    const formattedName = formatCardName(commanderName);
    const response = await fetch(
      `${BASE_URL}/pages/commanders/${formattedName}.json`
    );
    
    if (!response.ok) {
      throw new Error('Commander not found on EDHREC');
    }
    
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('EDHREC API Error:', error);
    return null;
  }
};

// Get top commanders
export const getTopCommanders = async () => {
  try {
    const response = await fetch(`${BASE_URL}/pages/commanders/year.json`);
    
    if (!response.ok) {
      throw new Error('Failed to fetch top commanders');
    }
    
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('EDHREC API Error:', error);
    return null;
  }
};

// Get theme/archetype recommendations
export const getThemeRecommendations = async (theme) => {
  try {
    const formattedTheme = formatCardName(theme);
    const response = await fetch(
      `${BASE_URL}/pages/themes/${formattedTheme}.json`
    );
    
    if (!response.ok) {
      throw new Error('Theme not found');
    }
    
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('EDHREC API Error:', error);
    return null;
  }
};

// Get average deck for a commander
export const getAverageDeck = async (commanderName) => {
  try {
    const formattedName = formatCardName(commanderName);
    const response = await fetch(
      `${BASE_URL}/pages/average-decks/${formattedName}.json`
    );
    
    if (!response.ok) {
      throw new Error('Average deck not found');
    }
    
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('EDHREC API Error:', error);
    return null;
  }
};

// Parse EDHREC recommendations into a usable format
export const parseRecommendations = (edhrecData) => {
  if (!edhrecData || !edhrecData.cardlists) {
    return {
      highSynergy: [],
      topCards: [],
      newCards: [],
      creatures: [],
      instants: [],
      sorceries: [],
      artifacts: [],
      enchantments: [],
      lands: [],
    };
  }
  
  const result = {
    highSynergy: [],
    topCards: [],
    newCards: [],
    creatures: [],
    instants: [],
    sorceries: [],
    artifacts: [],
    enchantments: [],
    lands: [],
  };
  
  for (const cardlist of edhrecData.cardlists) {
    const cards = cardlist.cardviews?.map(cv => ({
      name: cv.name,
      synergy: cv.synergy,
      inclusion: cv.inclusion,
      numDecks: cv.num_decks,
      label: cv.label,
      sanitized: cv.sanitized,
    })) || [];
    
    switch (cardlist.tag) {
      case 'highsynergycards':
        result.highSynergy = cards;
        break;
      case 'topcards':
        result.topCards = cards;
        break;
      case 'newcards':
        result.newCards = cards;
        break;
      case 'creatures':
        result.creatures = cards;
        break;
      case 'instants':
        result.instants = cards;
        break;
      case 'sorceries':
        result.sorceries = cards;
        break;
      case 'artifacts':
        result.artifacts = cards;
        break;
      case 'enchantments':
        result.enchantments = cards;
        break;
      case 'lands':
        result.lands = cards;
        break;
    }
  }
  
  return result;
};

// Generate deck suggestions based on owned cards and commander
export const generateDeckSuggestions = async (commanderName, ownedCards) => {
  const recommendations = await getCommanderRecommendations(commanderName);
  
  if (!recommendations) {
    return null;
  }
  
  const parsed = parseRecommendations(recommendations);
  const ownedCardNames = new Set(
    ownedCards.map(c => c.name?.toLowerCase() || c.cardData?.name?.toLowerCase())
  );
  
  // Find cards in collection that are recommended
  const suggestedFromCollection = [];
  const cardsToAcquire = [];
  
  const allRecommended = [
    ...parsed.highSynergy,
    ...parsed.topCards,
    ...parsed.creatures,
    ...parsed.instants,
    ...parsed.sorceries,
    ...parsed.artifacts,
    ...parsed.enchantments,
    ...parsed.lands,
  ];
  
  const seenCards = new Set();
  
  for (const card of allRecommended) {
    if (seenCards.has(card.name?.toLowerCase())) continue;
    seenCards.add(card.name?.toLowerCase());
    
    if (ownedCardNames.has(card.name?.toLowerCase())) {
      suggestedFromCollection.push(card);
    } else {
      cardsToAcquire.push(card);
    }
  }
  
  return {
    commander: recommendations.container?.json_dict?.card,
    fromCollection: suggestedFromCollection.slice(0, 50),
    toAcquire: cardsToAcquire.slice(0, 30),
    recommendations: parsed,
  };
};

export default {
  getCommanderRecommendations,
  getTopCommanders,
  getThemeRecommendations,
  getAverageDeck,
  parseRecommendations,
  generateDeckSuggestions,
};
