// Storage Service using AsyncStorage
import AsyncStorage from '@react-native-async-storage/async-storage';

const COLLECTION_KEY = '@mtg_collection';
const DECKS_KEY = '@mtg_decks';
const SETTINGS_KEY = '@mtg_settings';

// Collection Storage
export const saveCollection = async (collection) => {
  try {
    const jsonValue = JSON.stringify(collection);
    await AsyncStorage.setItem(COLLECTION_KEY, jsonValue);
    return true;
  } catch (error) {
    console.error('Error saving collection:', error);
    return false;
  }
};

export const loadCollection = async () => {
  try {
    const jsonValue = await AsyncStorage.getItem(COLLECTION_KEY);
    return jsonValue != null ? JSON.parse(jsonValue) : [];
  } catch (error) {
    console.error('Error loading collection:', error);
    return [];
  }
};

export const addCardToCollection = async (card, quantity = 1) => {
  try {
    const collection = await loadCollection();
    
    // Check if card already exists
    const existingIndex = collection.findIndex(
      c => c.id === card.id || c.scryfallId === card.id
    );
    
    if (existingIndex >= 0) {
      collection[existingIndex].quantity += quantity;
    } else {
      collection.push({
        id: card.id,
        scryfallId: card.id,
        name: card.name,
        setCode: card.set,
        setName: card.set_name,
        collectorNumber: card.collector_number,
        rarity: card.rarity,
        colors: card.colors || [],
        colorIdentity: card.color_identity || [],
        manaCost: card.mana_cost,
        cmc: card.cmc,
        typeLine: card.type_line,
        oracleText: card.oracle_text,
        imageUrl: card.image_uris?.normal || card.card_faces?.[0]?.image_uris?.normal,
        imageUrlSmall: card.image_uris?.small || card.card_faces?.[0]?.image_uris?.small,
        prices: card.prices,
        legalities: card.legalities,
        quantity: quantity,
        addedAt: new Date().toISOString(),
        foil: false,
        condition: 'NM',
        notes: '',
      });
    }
    
    await saveCollection(collection);
    return collection;
  } catch (error) {
    console.error('Error adding card to collection:', error);
    return null;
  }
};

export const removeCardFromCollection = async (cardId, quantity = 1) => {
  try {
    const collection = await loadCollection();
    const existingIndex = collection.findIndex(
      c => c.id === cardId || c.scryfallId === cardId
    );
    
    if (existingIndex >= 0) {
      collection[existingIndex].quantity -= quantity;
      
      if (collection[existingIndex].quantity <= 0) {
        collection.splice(existingIndex, 1);
      }
    }
    
    await saveCollection(collection);
    return collection;
  } catch (error) {
    console.error('Error removing card from collection:', error);
    return null;
  }
};

export const updateCardInCollection = async (cardId, updates) => {
  try {
    const collection = await loadCollection();
    const existingIndex = collection.findIndex(
      c => c.id === cardId || c.scryfallId === cardId
    );
    
    if (existingIndex >= 0) {
      collection[existingIndex] = {
        ...collection[existingIndex],
        ...updates,
      };
    }
    
    await saveCollection(collection);
    return collection;
  } catch (error) {
    console.error('Error updating card in collection:', error);
    return null;
  }
};

// Decks Storage
export const saveDecks = async (decks) => {
  try {
    const jsonValue = JSON.stringify(decks);
    await AsyncStorage.setItem(DECKS_KEY, jsonValue);
    return true;
  } catch (error) {
    console.error('Error saving decks:', error);
    return false;
  }
};

export const loadDecks = async () => {
  try {
    const jsonValue = await AsyncStorage.getItem(DECKS_KEY);
    return jsonValue != null ? JSON.parse(jsonValue) : [];
  } catch (error) {
    console.error('Error loading decks:', error);
    return [];
  }
};

export const createDeck = async (deckData) => {
  try {
    const decks = await loadDecks();
    const newDeck = {
      id: Date.now().toString(),
      name: deckData.name || 'New Deck',
      format: deckData.format || 'commander',
      commander: deckData.commander || null,
      cards: deckData.cards || [],
      description: deckData.description || '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    
    decks.push(newDeck);
    await saveDecks(decks);
    return newDeck;
  } catch (error) {
    console.error('Error creating deck:', error);
    return null;
  }
};

export const updateDeck = async (deckId, updates) => {
  try {
    const decks = await loadDecks();
    const index = decks.findIndex(d => d.id === deckId);
    
    if (index >= 0) {
      decks[index] = {
        ...decks[index],
        ...updates,
        updatedAt: new Date().toISOString(),
      };
      await saveDecks(decks);
      return decks[index];
    }
    
    return null;
  } catch (error) {
    console.error('Error updating deck:', error);
    return null;
  }
};

export const deleteDeck = async (deckId) => {
  try {
    const decks = await loadDecks();
    const filteredDecks = decks.filter(d => d.id !== deckId);
    await saveDecks(filteredDecks);
    return true;
  } catch (error) {
    console.error('Error deleting deck:', error);
    return false;
  }
};

export const addCardToDeck = async (deckId, card, quantity = 1) => {
  try {
    const decks = await loadDecks();
    const deckIndex = decks.findIndex(d => d.id === deckId);
    
    if (deckIndex < 0) return null;
    
    const existingCardIndex = decks[deckIndex].cards.findIndex(
      c => c.id === card.id || c.scryfallId === card.id || c.name === card.name
    );
    
    if (existingCardIndex >= 0) {
      decks[deckIndex].cards[existingCardIndex].quantity += quantity;
    } else {
      decks[deckIndex].cards.push({
        id: card.id || card.scryfallId,
        scryfallId: card.id || card.scryfallId,
        name: card.name,
        imageUrl: card.imageUrl || card.image_uris?.small,
        manaCost: card.manaCost || card.mana_cost,
        typeLine: card.typeLine || card.type_line,
        quantity: quantity,
      });
    }
    
    decks[deckIndex].updatedAt = new Date().toISOString();
    await saveDecks(decks);
    return decks[deckIndex];
  } catch (error) {
    console.error('Error adding card to deck:', error);
    return null;
  }
};

// Settings Storage
export const saveSettings = async (settings) => {
  try {
    const jsonValue = JSON.stringify(settings);
    await AsyncStorage.setItem(SETTINGS_KEY, jsonValue);
    return true;
  } catch (error) {
    console.error('Error saving settings:', error);
    return false;
  }
};

export const loadSettings = async () => {
  try {
    const jsonValue = await AsyncStorage.getItem(SETTINGS_KEY);
    return jsonValue != null ? JSON.parse(jsonValue) : {
      currency: 'usd',
      showPrices: true,
      defaultFormat: 'commander',
      theme: 'dark',
      searchLanguage: 'fr', // Default to French
    };
  } catch (error) {
    console.error('Error loading settings:', error);
    return {
      currency: 'usd',
      showPrices: true,
      defaultFormat: 'commander',
      theme: 'dark',
      searchLanguage: 'fr',
    };
  }
};

// Export/Import Functions
export const exportCollectionToJSON = async () => {
  try {
    const collection = await loadCollection();
    const decks = await loadDecks();
    
    const exportData = {
      version: '1.0',
      exportDate: new Date().toISOString(),
      collection,
      decks,
    };
    
    return JSON.stringify(exportData, null, 2);
  } catch (error) {
    console.error('Error exporting collection:', error);
    return null;
  }
};

export const exportCollectionToCSV = async () => {
  try {
    const collection = await loadCollection();
    
    const headers = [
      'Card Name',
      'Quantity',
      'Set',
      'Set Code',
      'Collector Number',
      'Rarity',
      'Condition',
      'Foil',
      'Price USD',
      'Notes',
    ];
    
    const rows = collection.map(card => [
      `"${card.name || ''}"`,
      card.quantity || 1,
      `"${card.setName || ''}"`,
      card.setCode || '',
      card.collectorNumber || '',
      card.rarity || '',
      card.condition || 'NM',
      card.foil ? 'Yes' : 'No',
      card.prices?.usd || '',
      `"${card.notes || ''}"`,
    ]);
    
    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    return csv;
  } catch (error) {
    console.error('Error exporting to CSV:', error);
    return null;
  }
};

// Export collection to decklist format (MTGO/Arena compatible)
export const exportCollectionToDecklist = async () => {
  try {
    const collection = await loadCollection();
    
    // Sort by name
    const sorted = [...collection].sort((a, b) => 
      (a.name || '').localeCompare(b.name || '')
    );
    
    const lines = sorted.map(card => 
      `${card.quantity || 1} ${card.name}`
    );
    
    return lines.join('\n');
  } catch (error) {
    console.error('Error exporting to decklist:', error);
    return null;
  }
};

// Export a specific deck to decklist format
export const exportDeckToDecklist = async (deckId) => {
  try {
    const decks = await loadDecks();
    const deck = decks.find(d => d.id === deckId);
    
    if (!deck) return null;
    
    const lines = [];
    
    // Add deck name as comment
    lines.push(`// ${deck.name}`);
    if (deck.format) {
      lines.push(`// Format: ${deck.format}`);
    }
    lines.push('');
    
    // Commander section
    if (deck.commander) {
      lines.push('// Commander');
      lines.push(`1 ${deck.commander.name}`);
      lines.push('');
    }
    
    // Main deck
    if (deck.cards && deck.cards.length > 0) {
      lines.push('// Deck');
      const sortedCards = [...deck.cards].sort((a, b) => 
        (a.name || '').localeCompare(b.name || '')
      );
      
      for (const card of sortedCards) {
        // Skip commander in main list
        if (deck.commander && card.name === deck.commander.name) continue;
        lines.push(`${card.quantity || 1} ${card.name}`);
      }
    }
    
    // Sideboard if exists
    if (deck.sideboard && deck.sideboard.length > 0) {
      lines.push('');
      lines.push('// Sideboard');
      for (const card of deck.sideboard) {
        lines.push(`${card.quantity || 1} ${card.name}`);
      }
    }
    
    return lines.join('\n');
  } catch (error) {
    console.error('Error exporting deck to decklist:', error);
    return null;
  }
};

export const importCollectionFromJSON = async (jsonString) => {
  try {
    const data = JSON.parse(jsonString);
    
    if (data.collection) {
      await saveCollection(data.collection);
    }
    
    if (data.decks) {
      await saveDecks(data.decks);
    }
    
    return {
      success: true,
      cardsImported: data.collection?.length || 0,
      decksImported: data.decks?.length || 0,
    };
  } catch (error) {
    console.error('Error importing collection:', error);
    return { success: false, error: error.message };
  }
};

// Get potential commanders from collection (legendary creatures)
export const getCommandersFromCollection = async () => {
  try {
    const collection = await loadCollection();
    
    const commanders = collection.filter(card => {
      const typeLine = (card.typeLine || '').toLowerCase();
      // Legendary Creature or Legendary Planeswalker that can be commander
      return typeLine.includes('legendary') && 
             (typeLine.includes('creature') || 
              (typeLine.includes('planeswalker') && 
               (card.oracleText || '').toLowerCase().includes('can be your commander')));
    });
    
    // Sort by name
    commanders.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    
    return commanders;
  } catch (error) {
    console.error('Error getting commanders:', error);
    return [];
  }
};

// Add cards from decklist to collection
export const addDecklistToCollection = async (parsedCards) => {
  try {
    const collection = await loadCollection();
    
    for (const item of parsedCards) {
      if (!item.found || !item.cardData) continue;
      
      const card = item.cardData;
      const existingIndex = collection.findIndex(
        c => c.id === card.id || c.scryfallId === card.id || c.name === card.name
      );
      
      if (existingIndex >= 0) {
        collection[existingIndex].quantity += item.quantity;
      } else {
        collection.push({
          id: card.id,
          scryfallId: card.id,
          name: card.name,
          setCode: card.set,
          setName: card.set_name,
          collectorNumber: card.collector_number,
          rarity: card.rarity,
          colors: card.colors || [],
          colorIdentity: card.color_identity || [],
          manaCost: card.mana_cost,
          cmc: card.cmc,
          typeLine: card.type_line,
          oracleText: card.oracle_text,
          imageUrl: card.image_uris?.normal || card.card_faces?.[0]?.image_uris?.normal,
          imageUrlSmall: card.image_uris?.small || card.card_faces?.[0]?.image_uris?.small,
          prices: card.prices,
          legalities: card.legalities,
          quantity: item.quantity,
          addedAt: new Date().toISOString(),
          foil: false,
          condition: 'NM',
          notes: '',
        });
      }
    }
    
    await saveCollection(collection);
    return collection;
  } catch (error) {
    console.error('Error adding decklist to collection:', error);
    return null;
  }
};

// Create deck from parsed decklist
export const createDeckFromDecklist = async (deckName, format, parsedCards, commander = null) => {
  try {
    const cards = parsedCards
      .filter(item => item.found && item.cardData)
      .map(item => ({
        id: item.cardData.id,
        scryfallId: item.cardData.id,
        name: item.cardData.name,
        imageUrl: item.cardData.image_uris?.small || item.cardData.card_faces?.[0]?.image_uris?.small,
        manaCost: item.cardData.mana_cost,
        typeLine: item.cardData.type_line,
        cmc: item.cardData.cmc,
        colorIdentity: item.cardData.color_identity || [],
        quantity: item.quantity,
      }));
    
    const newDeck = await createDeck({
      name: deckName,
      format: format,
      commander: commander,
      cards: cards,
    });
    
    return newDeck;
  } catch (error) {
    console.error('Error creating deck from decklist:', error);
    return null;
  }
};

// Remove card from deck
export const removeCardFromDeck = async (deckId, cardId, quantity = 1) => {
  try {
    const decks = await loadDecks();
    const deckIndex = decks.findIndex(d => d.id === deckId);
    
    if (deckIndex < 0) return null;
    
    const cardIndex = decks[deckIndex].cards.findIndex(
      c => c.id === cardId || c.scryfallId === cardId
    );
    
    if (cardIndex >= 0) {
      decks[deckIndex].cards[cardIndex].quantity -= quantity;
      
      if (decks[deckIndex].cards[cardIndex].quantity <= 0) {
        decks[deckIndex].cards.splice(cardIndex, 1);
      }
    }
    
    decks[deckIndex].updatedAt = new Date().toISOString();
    await saveDecks(decks);
    return decks[deckIndex];
  } catch (error) {
    console.error('Error removing card from deck:', error);
    return null;
  }
};

// Update card quantity in deck
export const updateCardInDeck = async (deckId, cardId, quantity) => {
  try {
    const decks = await loadDecks();
    const deckIndex = decks.findIndex(d => d.id === deckId);
    
    if (deckIndex < 0) return null;
    
    const cardIndex = decks[deckIndex].cards.findIndex(
      c => c.id === cardId || c.scryfallId === cardId
    );
    
    if (cardIndex >= 0) {
      if (quantity <= 0) {
        decks[deckIndex].cards.splice(cardIndex, 1);
      } else {
        decks[deckIndex].cards[cardIndex].quantity = quantity;
      }
    }
    
    decks[deckIndex].updatedAt = new Date().toISOString();
    await saveDecks(decks);
    return decks[deckIndex];
  } catch (error) {
    console.error('Error updating card in deck:', error);
    return null;
  }
};

// Clear all data
export const clearAllData = async () => {
  try {
    await AsyncStorage.multiRemove([COLLECTION_KEY, DECKS_KEY, SETTINGS_KEY]);
    return true;
  } catch (error) {
    console.error('Error clearing data:', error);
    return false;
  }
};

export default {
  saveCollection,
  loadCollection,
  addCardToCollection,
  removeCardFromCollection,
  updateCardInCollection,
  saveDecks,
  loadDecks,
  createDeck,
  updateDeck,
  deleteDeck,
  addCardToDeck,
  removeCardFromDeck,
  updateCardInDeck,
  saveSettings,
  loadSettings,
  exportCollectionToJSON,
  exportCollectionToCSV,
  exportCollectionToDecklist,
  exportDeckToDecklist,
  importCollectionFromJSON,
  getCommandersFromCollection,
  addDecklistToCollection,
  createDeckFromDecklist,
  clearAllData,
};
