import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import {
  loadCollection,
  saveCollection,
  addCardToCollection as addCard,
  removeCardFromCollection as removeCard,
  updateCardInCollection as updateCard,
  loadDecks,
  saveDecks,
  createDeck,
  updateDeck,
  deleteDeck,
  addCardToDeck,
} from '../services/storageService';

const CollectionContext = createContext();

export const useCollection = () => {
  const context = useContext(CollectionContext);
  if (!context) {
    throw new Error('useCollection must be used within a CollectionProvider');
  }
  return context;
};

export const CollectionProvider = ({ children }) => {
  const [collection, setCollection] = useState([]);
  const [decks, setDecks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Load data on mount
  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [loadedCollection, loadedDecks] = await Promise.all([
        loadCollection(),
        loadDecks(),
      ]);
      setCollection(loadedCollection);
      setDecks(loadedDecks);
      setError(null);
    } catch (err) {
      setError('Failed to load collection data');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const addCardToCollection = useCallback(async (card, quantity = 1) => {
    try {
      const updatedCollection = await addCard(card, quantity);
      if (updatedCollection) {
        setCollection(updatedCollection);
        return true;
      }
      return false;
    } catch (err) {
      setError('Failed to add card');
      return false;
    }
  }, []);

  const removeCardFromCollection = useCallback(async (cardId, quantity = 1) => {
    try {
      const updatedCollection = await removeCard(cardId, quantity);
      if (updatedCollection) {
        setCollection(updatedCollection);
        return true;
      }
      return false;
    } catch (err) {
      setError('Failed to remove card');
      return false;
    }
  }, []);

  const updateCardInCollection = useCallback(async (cardId, updates) => {
    try {
      const updatedCollection = await updateCard(cardId, updates);
      if (updatedCollection) {
        setCollection(updatedCollection);
        return true;
      }
      return false;
    } catch (err) {
      setError('Failed to update card');
      return false;
    }
  }, []);

  const addCardsToCollection = useCallback(async (cards) => {
    try {
      let updatedCollection = [...collection];
      
      for (const { card, quantity } of cards) {
        const existingIndex = updatedCollection.findIndex(
          c => c.id === card.id || c.scryfallId === card.id
        );
        
        if (existingIndex >= 0) {
          updatedCollection[existingIndex].quantity += quantity;
        } else {
          updatedCollection.push({
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
      }
      
      await saveCollection(updatedCollection);
      setCollection(updatedCollection);
      return true;
    } catch (err) {
      setError('Failed to add cards');
      return false;
    }
  }, [collection]);

  const createNewDeck = useCallback(async (deckData) => {
    try {
      const newDeck = await createDeck(deckData);
      if (newDeck) {
        setDecks(prev => [...prev, newDeck]);
        return newDeck;
      }
      return null;
    } catch (err) {
      setError('Failed to create deck');
      return null;
    }
  }, []);

  const updateExistingDeck = useCallback(async (deckId, updates) => {
    try {
      const updatedDeck = await updateDeck(deckId, updates);
      if (updatedDeck) {
        setDecks(prev => prev.map(d => d.id === deckId ? updatedDeck : d));
        return updatedDeck;
      }
      return null;
    } catch (err) {
      setError('Failed to update deck');
      return null;
    }
  }, []);

  const deleteExistingDeck = useCallback(async (deckId) => {
    try {
      const success = await deleteDeck(deckId);
      if (success) {
        setDecks(prev => prev.filter(d => d.id !== deckId));
        return true;
      }
      return false;
    } catch (err) {
      setError('Failed to delete deck');
      return false;
    }
  }, []);

  const addCardToExistingDeck = useCallback(async (deckId, card, quantity = 1) => {
    try {
      const updatedDeck = await addCardToDeck(deckId, card, quantity);
      if (updatedDeck) {
        setDecks(prev => prev.map(d => d.id === deckId ? updatedDeck : d));
        return updatedDeck;
      }
      return null;
    } catch (err) {
      setError('Failed to add card to deck');
      return null;
    }
  }, []);

  const getCollectionStats = useCallback(() => {
    const totalCards = collection.reduce((sum, c) => sum + c.quantity, 0);
    const uniqueCards = collection.length;
    const totalValue = collection.reduce((sum, c) => {
      const price = parseFloat(c.prices?.usd || 0);
      return sum + (price * c.quantity);
    }, 0);
    
    const byColor = {};
    const byRarity = {};
    const bySet = {};
    
    for (const card of collection) {
      // By color
      const colors = card.colorIdentity || [];
      if (colors.length === 0) {
        byColor['Colorless'] = (byColor['Colorless'] || 0) + card.quantity;
      } else {
        for (const color of colors) {
          byColor[color] = (byColor[color] || 0) + card.quantity;
        }
      }
      
      // By rarity
      const rarity = card.rarity || 'unknown';
      byRarity[rarity] = (byRarity[rarity] || 0) + card.quantity;
      
      // By set
      const setName = card.setName || 'Unknown';
      bySet[setName] = (bySet[setName] || 0) + card.quantity;
    }
    
    return {
      totalCards,
      uniqueCards,
      totalValue: totalValue.toFixed(2),
      byColor,
      byRarity,
      bySet,
    };
  }, [collection]);

  const searchCollection = useCallback((query, filters = {}) => {
    let results = [...collection];
    
    // Text search
    if (query) {
      const lowerQuery = query.toLowerCase();
      results = results.filter(card => 
        card.name?.toLowerCase().includes(lowerQuery) ||
        card.typeLine?.toLowerCase().includes(lowerQuery) ||
        card.oracleText?.toLowerCase().includes(lowerQuery)
      );
    }
    
    // Filter by color
    if (filters.colors && filters.colors.length > 0) {
      results = results.filter(card => {
        const cardColors = card.colorIdentity || [];
        return filters.colors.some(c => cardColors.includes(c));
      });
    }
    
    // Filter by rarity
    if (filters.rarity) {
      results = results.filter(card => card.rarity === filters.rarity);
    }
    
    // Filter by set
    if (filters.setCode) {
      results = results.filter(card => card.setCode === filters.setCode);
    }
    
    // Filter by CMC
    if (filters.minCmc !== undefined) {
      results = results.filter(card => (card.cmc || 0) >= filters.minCmc);
    }
    if (filters.maxCmc !== undefined) {
      results = results.filter(card => (card.cmc || 0) <= filters.maxCmc);
    }
    
    return results;
  }, [collection]);

  const isCardInCollection = useCallback((cardId) => {
    return collection.some(c => c.id === cardId || c.scryfallId === cardId);
  }, [collection]);

  const getCardQuantity = useCallback((cardId) => {
    const card = collection.find(c => c.id === cardId || c.scryfallId === cardId);
    return card?.quantity || 0;
  }, [collection]);

  const value = {
    collection,
    decks,
    loading,
    error,
    refresh: loadData,
    addCardToCollection,
    removeCardFromCollection,
    updateCardInCollection,
    addCardsToCollection,
    createNewDeck,
    updateExistingDeck,
    deleteExistingDeck,
    addCardToExistingDeck,
    getCollectionStats,
    searchCollection,
    isCardInCollection,
    getCardQuantity,
  };

  return (
    <CollectionContext.Provider value={value}>
      {children}
    </CollectionContext.Provider>
  );
};

export default CollectionContext;
