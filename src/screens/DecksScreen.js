import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Modal,
  TextInput,
  ScrollView,
  Image,
  Share,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import {
  loadDecks,
  createDeck,
  updateDeck,
  deleteDeck,
  addCardToDeck,
  removeCardFromDeck,
  updateCardInDeck,
  exportDeckToDecklist,
  getCommandersFromCollection,
} from '../services/storageService';
import { getCommanderSuggestions } from '../services/edhrecApi';

const FORMATS = [
  { id: 'commander', name: 'Commander / EDH', maxCards: 100, singleton: true },
  { id: 'standard', name: 'Standard', maxCards: 60, singleton: false },
  { id: 'modern', name: 'Modern', maxCards: 60, singleton: false },
  { id: 'legacy', name: 'Legacy', maxCards: 60, singleton: false },
  { id: 'pioneer', name: 'Pioneer', maxCards: 60, singleton: false },
  { id: 'pauper', name: 'Pauper', maxCards: 60, singleton: false },
  { id: 'vintage', name: 'Vintage', maxCards: 60, singleton: false },
  { id: 'brawl', name: 'Brawl', maxCards: 60, singleton: true },
  { id: 'other', name: 'Autre', maxCards: null, singleton: false },
];

const DecksScreen = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const [decks, setDecks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showNewDeckModal, setShowNewDeckModal] = useState(false);
  const [showCommanderModal, setShowCommanderModal] = useState(false);
  const [showDeckDetailModal, setShowDeckDetailModal] = useState(false);
  const [showEditCardModal, setShowEditCardModal] = useState(false);
  const [selectedDeck, setSelectedDeck] = useState(null);
  const [selectedCard, setSelectedCard] = useState(null);
  
  // New deck form
  const [newDeckName, setNewDeckName] = useState('');
  const [newDeckFormat, setNewDeckFormat] = useState('commander');
  
  // Commanders from collection
  const [commanders, setCommanders] = useState([]);
  const [loadingCommanders, setLoadingCommanders] = useState(false);
  const [commanderSuggestions, setCommanderSuggestions] = useState([]);

  const loadData = async () => {
    setLoading(true);
    try {
      const loadedDecks = await loadDecks();
      setDecks(loadedDecks);
    } catch (error) {
      console.error('Error loading decks:', error);
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [])
  );

  // Load commanders when modal opens
  const loadCommanders = async () => {
    setLoadingCommanders(true);
    try {
      const cmds = await getCommandersFromCollection();
      setCommanders(cmds);
    } catch (error) {
      console.error('Error loading commanders:', error);
    } finally {
      setLoadingCommanders(false);
    }
  };

  const handleCreateDeck = async (commander = null) => {
    if (!newDeckName.trim()) {
      Alert.alert('Erreur', 'Veuillez entrer un nom pour le deck');
      return;
    }

    try {
      const newDeck = await createDeck({
        name: newDeckName.trim(),
        format: newDeckFormat,
        commander: commander ? {
          id: commander.id,
          name: commander.name,
          imageUrl: commander.imageUrl || commander.imageUrlSmall,
          colorIdentity: commander.colorIdentity,
          typeLine: commander.typeLine,
        } : null,
        cards: commander ? [{
          id: commander.id,
          scryfallId: commander.id,
          name: commander.name,
          imageUrl: commander.imageUrl || commander.imageUrlSmall,
          manaCost: commander.manaCost,
          typeLine: commander.typeLine,
          quantity: 1,
        }] : [],
      });

      if (newDeck) {
        setDecks(prev => [...prev, newDeck]);
        setShowNewDeckModal(false);
        setShowCommanderModal(false);
        setNewDeckName('');
        setNewDeckFormat('commander');
        Alert.alert('Succès', `Deck "${newDeck.name}" créé !`);
      }
    } catch (error) {
      Alert.alert('Erreur', 'Impossible de créer le deck');
    }
  };

  const handleDeleteDeck = (deck) => {
    Alert.alert(
      'Supprimer le deck',
      `Êtes-vous sûr de vouloir supprimer "${deck.name}" ?`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: async () => {
            const success = await deleteDeck(deck.id);
            if (success) {
              setDecks(prev => prev.filter(d => d.id !== deck.id));
              setShowDeckDetailModal(false);
              setSelectedDeck(null);
            }
          },
        },
      ]
    );
  };

  const handleExportDeck = async (deck) => {
    try {
      const decklist = await exportDeckToDecklist(deck.id);
      if (decklist) {
        await Share.share({
          message: decklist,
          title: `${deck.name} - Decklist`,
        });
      }
    } catch (error) {
      Alert.alert('Erreur', 'Impossible d\'exporter le deck');
    }
  };

  const handleUpdateCardQuantity = async (card, newQuantity) => {
    if (!selectedDeck) return;
    
    const updatedDeck = await updateCardInDeck(selectedDeck.id, card.id, newQuantity);
    if (updatedDeck) {
      setSelectedDeck(updatedDeck);
      setDecks(prev => prev.map(d => d.id === updatedDeck.id ? updatedDeck : d));
    }
    setShowEditCardModal(false);
    setSelectedCard(null);
  };

  const handleRemoveCard = async (card) => {
    if (!selectedDeck) return;
    
    Alert.alert(
      'Retirer la carte',
      `Retirer "${card.name}" du deck ?`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Retirer',
          style: 'destructive',
          onPress: async () => {
            const updatedDeck = await removeCardFromDeck(selectedDeck.id, card.id, card.quantity);
            if (updatedDeck) {
              setSelectedDeck(updatedDeck);
              setDecks(prev => prev.map(d => d.id === updatedDeck.id ? updatedDeck : d));
            }
          },
        },
      ]
    );
  };

  const openDeckDetail = (deck) => {
    setSelectedDeck(deck);
    setShowDeckDetailModal(true);
  };

  const openNewDeckModal = () => {
    setNewDeckName('');
    setNewDeckFormat('commander');
    setShowNewDeckModal(true);
  };

  const proceedToCommanderSelection = () => {
    if (!newDeckName.trim()) {
      Alert.alert('Erreur', 'Veuillez entrer un nom pour le deck');
      return;
    }
    
    if (newDeckFormat === 'commander' || newDeckFormat === 'brawl') {
      loadCommanders();
      setShowNewDeckModal(false);
      setShowCommanderModal(true);
    } else {
      handleCreateDeck(null);
    }
  };

  const getTotalCards = (deck) => {
    return (deck.cards || []).reduce((sum, c) => sum + (c.quantity || 1), 0);
  };

  const getColorIdentityDisplay = (colors) => {
    if (!colors || colors.length === 0) return '⚪';
    const colorMap = { W: '⚪', U: '🔵', B: '⚫', R: '🔴', G: '🟢' };
    return colors.map(c => colorMap[c] || c).join('');
  };

  const renderDeckItem = ({ item }) => {
    const totalCards = getTotalCards(item);
    const formatInfo = FORMATS.find(f => f.id === item.format) || FORMATS[0];
    
    return (
      <TouchableOpacity 
        style={styles.deckItem}
        onPress={() => openDeckDetail(item)}
      >
        <View style={styles.deckImageContainer}>
          {item.commander?.imageUrl ? (
            <Image source={{ uri: item.commander.imageUrl }} style={styles.deckImage} />
          ) : (
            <View style={styles.deckImagePlaceholder}>
              <Ionicons name="layers" size={32} color="#666" />
            </View>
          )}
        </View>
        
        <View style={styles.deckInfo}>
          <Text style={styles.deckName} numberOfLines={1}>{item.name}</Text>
          {item.commander && (
            <Text style={styles.deckCommander} numberOfLines={1}>
              {getColorIdentityDisplay(item.commander.colorIdentity)} {item.commander.name}
            </Text>
          )}
          <View style={styles.deckMeta}>
            <Text style={styles.deckFormat}>{formatInfo.name}</Text>
            <Text style={styles.deckCount}>
              {totalCards}{formatInfo.maxCards ? `/${formatInfo.maxCards}` : ''} cartes
            </Text>
          </View>
        </View>
        
        <Ionicons name="chevron-forward" size={24} color="#666" />
      </TouchableOpacity>
    );
  };

  const renderCommanderItem = ({ item }) => (
    <TouchableOpacity 
      style={styles.commanderItem}
      onPress={() => handleCreateDeck(item)}
    >
      <Image 
        source={{ uri: item.imageUrlSmall || item.imageUrl }} 
        style={styles.commanderImage}
        resizeMode="cover"
      />
      <View style={styles.commanderInfo}>
        <Text style={styles.commanderName} numberOfLines={1}>{item.name}</Text>
        <Text style={styles.commanderType} numberOfLines={1}>{item.typeLine}</Text>
        <Text style={styles.commanderColors}>
          {getColorIdentityDisplay(item.colorIdentity)}
        </Text>
      </View>
      <Ionicons name="add-circle" size={28} color="#6B4FA2" />
    </TouchableOpacity>
  );

  const renderDeckCard = ({ item }) => (
    <TouchableOpacity 
      style={styles.deckCardItem}
      onPress={() => {
        setSelectedCard(item);
        setShowEditCardModal(true);
      }}
      onLongPress={() => handleRemoveCard(item)}
    >
      <View style={styles.deckCardQuantity}>
        <Text style={styles.deckCardQuantityText}>{item.quantity}x</Text>
      </View>
      <View style={styles.deckCardInfo}>
        <Text style={styles.deckCardName} numberOfLines={1}>{item.name}</Text>
        <Text style={styles.deckCardType} numberOfLines={1}>{item.typeLine}</Text>
      </View>
      {item.manaCost && (
        <Text style={styles.deckCardMana}>{item.manaCost}</Text>
      )}
    </TouchableOpacity>
  );

  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <Ionicons name="albums-outline" size={80} color="#444" />
      <Text style={styles.emptyTitle}>Aucun deck</Text>
      <Text style={styles.emptyText}>
        Créez votre premier deck pour commencer à construire !
      </Text>
      <TouchableOpacity style={styles.createButton} onPress={openNewDeckModal}>
        <Ionicons name="add" size={24} color="#FFF" />
        <Text style={styles.createButtonText}>Créer un deck</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.title}>Mes Decks</Text>
        <TouchableOpacity style={styles.addButton} onPress={openNewDeckModal}>
          <Ionicons name="add-circle" size={32} color="#6B4FA2" />
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#6B4FA2" />
        </View>
      ) : decks.length === 0 ? (
        renderEmptyState()
      ) : (
        <FlatList
          data={decks}
          keyExtractor={(item) => item.id}
          renderItem={renderDeckItem}
          contentContainerStyle={[styles.listContent, { paddingBottom: 100 + insets.bottom }]}
        />
      )}

      {/* New Deck Modal */}
      <Modal
        visible={showNewDeckModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowNewDeckModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { paddingBottom: insets.bottom + 20 }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Nouveau Deck</Text>
              <TouchableOpacity onPress={() => setShowNewDeckModal(false)}>
                <Ionicons name="close" size={28} color="#FFF" />
              </TouchableOpacity>
            </View>

            <Text style={styles.inputLabel}>Nom du deck</Text>
            <TextInput
              style={styles.textInput}
              placeholder="Ex: Mon deck Atraxa"
              placeholderTextColor="#666"
              value={newDeckName}
              onChangeText={setNewDeckName}
            />

            <Text style={styles.inputLabel}>Format</Text>
            <ScrollView 
              horizontal 
              showsHorizontalScrollIndicator={false}
              style={styles.formatList}
            >
              {FORMATS.map(format => (
                <TouchableOpacity
                  key={format.id}
                  style={[
                    styles.formatChip,
                    newDeckFormat === format.id && styles.formatChipActive
                  ]}
                  onPress={() => setNewDeckFormat(format.id)}
                >
                  <Text style={[
                    styles.formatChipText,
                    newDeckFormat === format.id && styles.formatChipTextActive
                  ]}>{format.name}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <TouchableOpacity 
              style={styles.primaryButton}
              onPress={proceedToCommanderSelection}
            >
              <Text style={styles.primaryButtonText}>
                {(newDeckFormat === 'commander' || newDeckFormat === 'brawl') 
                  ? 'Choisir un commandant' 
                  : 'Créer le deck'}
              </Text>
              <Ionicons name="arrow-forward" size={20} color="#FFF" />
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Commander Selection Modal */}
      <Modal
        visible={showCommanderModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowCommanderModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContentFull, { paddingBottom: insets.bottom + 20, paddingTop: insets.top + 20 }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Choisir un commandant</Text>
              <TouchableOpacity onPress={() => {
                setShowCommanderModal(false);
                setShowNewDeckModal(true);
              }}>
                <Ionicons name="close" size={28} color="#FFF" />
              </TouchableOpacity>
            </View>

            <Text style={styles.modalSubtitle}>
              Créatures légendaires dans votre collection
            </Text>

            {loadingCommanders ? (
              <ActivityIndicator size="large" color="#6B4FA2" style={{ marginTop: 40 }} />
            ) : commanders.length === 0 ? (
              <View style={styles.noCommandersContainer}>
                <Ionicons name="alert-circle-outline" size={60} color="#666" />
                <Text style={styles.noCommandersText}>
                  Aucune créature légendaire dans votre collection
                </Text>
                <Text style={styles.noCommandersHint}>
                  Scannez ou ajoutez des cartes légendaires pour les utiliser comme commandant
                </Text>
                <TouchableOpacity 
                  style={styles.secondaryButton}
                  onPress={() => handleCreateDeck(null)}
                >
                  <Text style={styles.secondaryButtonText}>Créer sans commandant</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <FlatList
                data={commanders}
                keyExtractor={(item) => item.id}
                renderItem={renderCommanderItem}
                contentContainerStyle={styles.commanderList}
              />
            )}

            <TouchableOpacity 
              style={styles.skipButton}
              onPress={() => handleCreateDeck(null)}
            >
              <Text style={styles.skipButtonText}>Créer sans commandant</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Deck Detail Modal */}
      <Modal
        visible={showDeckDetailModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => {
          setShowDeckDetailModal(false);
          setSelectedDeck(null);
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContentFull, { paddingBottom: insets.bottom + 20, paddingTop: insets.top + 20 }]}>
            {selectedDeck && (
              <>
                <View style={styles.modalHeader}>
                  <View style={styles.deckDetailHeader}>
                    <Text style={styles.modalTitle} numberOfLines={1}>{selectedDeck.name}</Text>
                    <Text style={styles.deckDetailFormat}>
                      {FORMATS.find(f => f.id === selectedDeck.format)?.name || selectedDeck.format}
                    </Text>
                  </View>
                  <TouchableOpacity onPress={() => {
                    setShowDeckDetailModal(false);
                    setSelectedDeck(null);
                  }}>
                    <Ionicons name="close" size={28} color="#FFF" />
                  </TouchableOpacity>
                </View>

                {selectedDeck.commander && (
                  <View style={styles.commanderBanner}>
                    <Image 
                      source={{ uri: selectedDeck.commander.imageUrl }} 
                      style={styles.commanderBannerImage}
                    />
                    <View style={styles.commanderBannerInfo}>
                      <Text style={styles.commanderBannerLabel}>Commandant</Text>
                      <Text style={styles.commanderBannerName}>{selectedDeck.commander.name}</Text>
                      <Text style={styles.commanderBannerColors}>
                        {getColorIdentityDisplay(selectedDeck.commander.colorIdentity)}
                      </Text>
                    </View>
                  </View>
                )}

                <View style={styles.deckStats}>
                  <View style={styles.deckStat}>
                    <Text style={styles.deckStatValue}>{getTotalCards(selectedDeck)}</Text>
                    <Text style={styles.deckStatLabel}>Cartes</Text>
                  </View>
                  <View style={styles.deckStat}>
                    <Text style={styles.deckStatValue}>{selectedDeck.cards?.length || 0}</Text>
                    <Text style={styles.deckStatLabel}>Uniques</Text>
                  </View>
                </View>

                <View style={styles.deckActions}>
                  <TouchableOpacity 
                    style={styles.deckActionButton}
                    onPress={() => handleExportDeck(selectedDeck)}
                  >
                    <Ionicons name="share-outline" size={20} color="#6B4FA2" />
                    <Text style={styles.deckActionText}>Exporter</Text>
                  </TouchableOpacity>
                  <TouchableOpacity 
                    style={[styles.deckActionButton, styles.deckActionButtonDanger]}
                    onPress={() => handleDeleteDeck(selectedDeck)}
                  >
                    <Ionicons name="trash-outline" size={20} color="#F44336" />
                    <Text style={[styles.deckActionText, styles.deckActionTextDanger]}>Supprimer</Text>
                  </TouchableOpacity>
                </View>

                <Text style={styles.sectionTitle}>Cartes du deck</Text>
                
                {(!selectedDeck.cards || selectedDeck.cards.length === 0) ? (
                  <View style={styles.emptyDeckCards}>
                    <Text style={styles.emptyDeckCardsText}>Aucune carte dans ce deck</Text>
                    <Text style={styles.emptyDeckCardsHint}>
                      Ajoutez des cartes depuis votre collection ou importez une decklist
                    </Text>
                  </View>
                ) : (
                  <FlatList
                    data={selectedDeck.cards}
                    keyExtractor={(item, index) => `${item.id}-${index}`}
                    renderItem={renderDeckCard}
                    contentContainerStyle={styles.deckCardsList}
                  />
                )}
              </>
            )}
          </View>
        </View>
      </Modal>

      {/* Edit Card Quantity Modal */}
      <Modal
        visible={showEditCardModal}
        animationType="fade"
        transparent={true}
        onRequestClose={() => {
          setShowEditCardModal(false);
          setSelectedCard(null);
        }}
      >
        <View style={styles.editModalOverlay}>
          <View style={[styles.editModalContent, { paddingBottom: insets.bottom + 20 }]}>
            {selectedCard && (
              <>
                <Text style={styles.editModalTitle}>{selectedCard.name}</Text>
                <Text style={styles.editModalSubtitle}>Quantité</Text>
                
                <View style={styles.quantityControls}>
                  <TouchableOpacity 
                    style={styles.quantityButton}
                    onPress={() => {
                      const newQty = Math.max(0, (selectedCard.quantity || 1) - 1);
                      handleUpdateCardQuantity(selectedCard, newQty);
                    }}
                  >
                    <Ionicons name="remove" size={28} color="#FFF" />
                  </TouchableOpacity>
                  
                  <Text style={styles.quantityValue}>{selectedCard.quantity || 1}</Text>
                  
                  <TouchableOpacity 
                    style={styles.quantityButton}
                    onPress={() => {
                      const newQty = (selectedCard.quantity || 1) + 1;
                      handleUpdateCardQuantity(selectedCard, newQty);
                    }}
                  >
                    <Ionicons name="add" size={28} color="#FFF" />
                  </TouchableOpacity>
                </View>

                <TouchableOpacity 
                  style={styles.removeCardButton}
                  onPress={() => {
                    setShowEditCardModal(false);
                    handleRemoveCard(selectedCard);
                  }}
                >
                  <Ionicons name="trash-outline" size={20} color="#F44336" />
                  <Text style={styles.removeCardButtonText}>Retirer du deck</Text>
                </TouchableOpacity>

                <TouchableOpacity 
                  style={styles.cancelButton}
                  onPress={() => {
                    setShowEditCardModal(false);
                    setSelectedCard(null);
                  }}
                >
                  <Text style={styles.cancelButtonText}>Fermer</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#121212' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  title: { fontSize: 28, fontWeight: 'bold', color: '#FFF' },
  addButton: { padding: 4 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  listContent: { paddingHorizontal: 16 },
  
  // Deck Item
  deckItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E1E1E',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  deckImageContainer: { marginRight: 12 },
  deckImage: { width: 60, height: 84, borderRadius: 6 },
  deckImagePlaceholder: {
    width: 60,
    height: 84,
    borderRadius: 6,
    backgroundColor: '#2A2A2A',
    justifyContent: 'center',
    alignItems: 'center',
  },
  deckInfo: { flex: 1 },
  deckName: { fontSize: 16, fontWeight: '600', color: '#FFF', marginBottom: 4 },
  deckCommander: { fontSize: 13, color: '#AAA', marginBottom: 6 },
  deckMeta: { flexDirection: 'row', alignItems: 'center' },
  deckFormat: { fontSize: 12, color: '#6B4FA2', marginRight: 12 },
  deckCount: { fontSize: 12, color: '#666' },
  
  // Empty State
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 40 },
  emptyTitle: { fontSize: 22, fontWeight: 'bold', color: '#FFF', marginTop: 20, marginBottom: 8 },
  emptyText: { fontSize: 14, color: '#888', textAlign: 'center', marginBottom: 24 },
  createButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#6B4FA2',
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 12,
  },
  createButtonText: { color: '#FFF', fontSize: 16, fontWeight: '600', marginLeft: 8 },
  
  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.9)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#1E1E1E', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20 },
  modalContentFull: { flex: 1, backgroundColor: '#1E1E1E', padding: 20 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 22, fontWeight: 'bold', color: '#FFF', flex: 1 },
  modalSubtitle: { fontSize: 14, color: '#888', marginBottom: 16 },
  
  inputLabel: { fontSize: 14, color: '#888', marginBottom: 8, marginTop: 12 },
  textInput: {
    backgroundColor: '#2A2A2A',
    borderRadius: 12,
    padding: 14,
    color: '#FFF',
    fontSize: 16,
  },
  
  formatList: { marginVertical: 12 },
  formatChip: {
    backgroundColor: '#2A2A2A',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    marginRight: 10,
  },
  formatChipActive: { backgroundColor: '#6B4FA2' },
  formatChipText: { color: '#AAA', fontSize: 14 },
  formatChipTextActive: { color: '#FFF', fontWeight: '600' },
  
  primaryButton: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#6B4FA2',
    borderRadius: 12,
    padding: 16,
    marginTop: 20,
  },
  primaryButtonText: { color: '#FFF', fontSize: 16, fontWeight: '600', marginRight: 8 },
  
  // Commander Selection
  commanderList: { paddingBottom: 20 },
  commanderItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2A2A2A',
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
  },
  commanderImage: { width: 50, height: 70, borderRadius: 6, marginRight: 12 },
  commanderInfo: { flex: 1 },
  commanderName: { fontSize: 15, fontWeight: '500', color: '#FFF', marginBottom: 2 },
  commanderType: { fontSize: 12, color: '#888', marginBottom: 4 },
  commanderColors: { fontSize: 14 },
  
  noCommandersContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 32 },
  noCommandersText: { fontSize: 16, color: '#888', textAlign: 'center', marginTop: 16 },
  noCommandersHint: { fontSize: 13, color: '#666', textAlign: 'center', marginTop: 8 },
  
  secondaryButton: {
    backgroundColor: '#2A2A2A',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 10,
    marginTop: 20,
  },
  secondaryButtonText: { color: '#AAA', fontSize: 14 },
  
  skipButton: { alignItems: 'center', padding: 16 },
  skipButtonText: { color: '#6B4FA2', fontSize: 14 },
  
  // Deck Detail
  deckDetailHeader: { flex: 1 },
  deckDetailFormat: { fontSize: 13, color: '#6B4FA2', marginTop: 4 },
  
  commanderBanner: {
    flexDirection: 'row',
    backgroundColor: '#2A2A2A',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  commanderBannerImage: { width: 60, height: 84, borderRadius: 6 },
  commanderBannerInfo: { flex: 1, marginLeft: 12, justifyContent: 'center' },
  commanderBannerLabel: { fontSize: 11, color: '#888', marginBottom: 4 },
  commanderBannerName: { fontSize: 16, fontWeight: '600', color: '#FFF', marginBottom: 4 },
  commanderBannerColors: { fontSize: 16 },
  
  deckStats: { flexDirection: 'row', marginBottom: 16 },
  deckStat: {
    flex: 1,
    backgroundColor: '#2A2A2A',
    borderRadius: 10,
    padding: 12,
    marginRight: 8,
    alignItems: 'center',
  },
  deckStatValue: { fontSize: 24, fontWeight: 'bold', color: '#FFF' },
  deckStatLabel: { fontSize: 12, color: '#888', marginTop: 4 },
  
  deckActions: { flexDirection: 'row', marginBottom: 16 },
  deckActionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2A2A2A',
    borderRadius: 10,
    padding: 12,
    marginRight: 8,
  },
  deckActionButtonDanger: { marginRight: 0 },
  deckActionText: { color: '#6B4FA2', fontSize: 14, marginLeft: 6 },
  deckActionTextDanger: { color: '#F44336' },
  
  sectionTitle: { fontSize: 16, fontWeight: '600', color: '#FFF', marginBottom: 12 },
  
  deckCardsList: { paddingBottom: 20 },
  deckCardItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#252525',
    borderRadius: 8,
    padding: 10,
    marginBottom: 6,
  },
  deckCardQuantity: {
    backgroundColor: '#6B4FA2',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginRight: 10,
  },
  deckCardQuantityText: { color: '#FFF', fontSize: 13, fontWeight: '600' },
  deckCardInfo: { flex: 1 },
  deckCardName: { color: '#FFF', fontSize: 14, fontWeight: '500' },
  deckCardType: { color: '#888', fontSize: 11, marginTop: 2 },
  deckCardMana: { color: '#AAA', fontSize: 12 },
  
  emptyDeckCards: { alignItems: 'center', paddingVertical: 40 },
  emptyDeckCardsText: { color: '#888', fontSize: 15 },
  emptyDeckCardsHint: { color: '#666', fontSize: 12, marginTop: 8, textAlign: 'center' },
  
  // Edit Card Modal
  editModalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'center', alignItems: 'center' },
  editModalContent: { backgroundColor: '#1E1E1E', borderRadius: 20, padding: 24, width: '80%', alignItems: 'center' },
  editModalTitle: { fontSize: 18, fontWeight: '600', color: '#FFF', textAlign: 'center', marginBottom: 8 },
  editModalSubtitle: { fontSize: 13, color: '#888', marginBottom: 16 },
  
  quantityControls: { flexDirection: 'row', alignItems: 'center', marginBottom: 24 },
  quantityButton: {
    backgroundColor: '#6B4FA2',
    borderRadius: 12,
    width: 48,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
  },
  quantityValue: { fontSize: 32, fontWeight: 'bold', color: '#FFF', marginHorizontal: 32 },
  
  removeCardButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    marginBottom: 8,
  },
  removeCardButtonText: { color: '#F44336', fontSize: 14, marginLeft: 8 },
  
  cancelButton: { padding: 12 },
  cancelButtonText: { color: '#888', fontSize: 14 },
});

export default DecksScreen;
