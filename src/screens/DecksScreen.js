import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  Modal,
  Alert,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useCollection } from '../context/CollectionContext';
import { generateDeckSuggestions } from '../services/edhrecApi';
import { getCardByFuzzyName } from '../services/scryfallApi';

const DecksScreen = ({ navigation }) => {
  const { 
    decks, 
    collection,
    createNewDeck, 
    deleteExistingDeck,
  } = useCollection();
  
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showSuggestModal, setShowSuggestModal] = useState(false);
  const [newDeckName, setNewDeckName] = useState('');
  const [newDeckFormat, setNewDeckFormat] = useState('commander');
  const [commanderName, setCommanderName] = useState('');
  const [suggestions, setSuggestions] = useState(null);
  const [loading, setLoading] = useState(false);

  const formats = ['commander', 'standard', 'modern', 'legacy', 'vintage', 'pauper'];

  const handleCreateDeck = async () => {
    if (!newDeckName.trim()) {
      Alert.alert('Error', 'Please enter a deck name');
      return;
    }

    const deck = await createNewDeck({
      name: newDeckName,
      format: newDeckFormat,
    });

    if (deck) {
      setShowCreateModal(false);
      setNewDeckName('');
      Alert.alert('Success', 'Deck created!');
    }
  };

  const handleDeleteDeck = (deckId, deckName) => {
    Alert.alert(
      'Delete Deck',
      `Are you sure you want to delete "${deckName}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Delete', 
          style: 'destructive',
          onPress: () => deleteExistingDeck(deckId)
        },
      ]
    );
  };

  const handleGetSuggestions = async () => {
    if (!commanderName.trim()) {
      Alert.alert('Error', 'Please enter a commander name');
      return;
    }

    setLoading(true);
    try {
      // First verify the commander exists
      const commander = await getCardByFuzzyName(commanderName);
      
      // Then get suggestions
      const result = await generateDeckSuggestions(commander.name, collection);
      
      if (result) {
        setSuggestions({
          commander: commander,
          ...result,
        });
      } else {
        Alert.alert('Error', 'Could not find recommendations for this commander');
      }
    } catch (error) {
      Alert.alert('Error', 'Commander not found. Please check the spelling.');
    } finally {
      setLoading(false);
    }
  };

  const renderDeckItem = ({ item }) => (
    <TouchableOpacity
      style={styles.deckCard}
      onPress={() => navigation.navigate('DeckDetail', { deck: item })}
    >
      <View style={styles.deckInfo}>
        <View style={styles.deckHeader}>
          <Text style={styles.deckName}>{item.name}</Text>
          <View style={[styles.formatBadge, { backgroundColor: getFormatColor(item.format) }]}>
            <Text style={styles.formatText}>{item.format}</Text>
          </View>
        </View>
        <Text style={styles.cardCount}>
          {item.cards?.length || 0} cards
        </Text>
        {item.commander && (
          <Text style={styles.commanderText}>
            Commander: {item.commander.name}
          </Text>
        )}
        <Text style={styles.dateText}>
          Updated: {new Date(item.updatedAt).toLocaleDateString()}
        </Text>
      </View>
      <TouchableOpacity
        style={styles.deleteButton}
        onPress={() => handleDeleteDeck(item.id, item.name)}
      >
        <Ionicons name="trash-outline" size={22} color="#F44336" />
      </TouchableOpacity>
    </TouchableOpacity>
  );

  const getFormatColor = (format) => {
    const colors = {
      commander: '#6B4FA2',
      standard: '#2196F3',
      modern: '#FF9800',
      legacy: '#4CAF50',
      vintage: '#9C27B0',
      pauper: '#795548',
    };
    return colors[format] || '#666';
  };

  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <Ionicons name="layers-outline" size={80} color="#444" />
      <Text style={styles.emptyTitle}>No Decks Yet</Text>
      <Text style={styles.emptyText}>
        Create your first deck or get suggestions based on your collection!
      </Text>
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>My Decks</Text>
        <TouchableOpacity
          style={styles.headerButton}
          onPress={() => setShowCreateModal(true)}
        >
          <Ionicons name="add-circle" size={28} color="#6B4FA2" />
        </TouchableOpacity>
      </View>

      <View style={styles.actionButtons}>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => setShowCreateModal(true)}
        >
          <Ionicons name="add" size={20} color="#FFF" />
          <Text style={styles.actionButtonText}>New Deck</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionButton, styles.suggestButton]}
          onPress={() => setShowSuggestModal(true)}
        >
          <Ionicons name="bulb" size={20} color="#FFF" />
          <Text style={styles.actionButtonText}>Get Suggestions</Text>
        </TouchableOpacity>
      </View>

      {decks.length > 0 ? (
        <FlatList
          data={decks}
          keyExtractor={(item) => item.id}
          renderItem={renderDeckItem}
          contentContainerStyle={styles.listContent}
        />
      ) : (
        renderEmptyState()
      )}

      {/* Create Deck Modal */}
      <Modal
        visible={showCreateModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowCreateModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Create New Deck</Text>
              <TouchableOpacity onPress={() => setShowCreateModal(false)}>
                <Ionicons name="close" size={28} color="#FFF" />
              </TouchableOpacity>
            </View>

            <TextInput
              style={styles.input}
              placeholder="Deck name..."
              placeholderTextColor="#666"
              value={newDeckName}
              onChangeText={setNewDeckName}
            />

            <Text style={styles.label}>Format</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={styles.formatOptions}>
                {formats.map((format) => (
                  <TouchableOpacity
                    key={format}
                    style={[
                      styles.formatOption,
                      newDeckFormat === format && styles.formatOptionSelected,
                    ]}
                    onPress={() => setNewDeckFormat(format)}
                  >
                    <Text style={[
                      styles.formatOptionText,
                      newDeckFormat === format && styles.formatOptionTextSelected,
                    ]}>
                      {format.charAt(0).toUpperCase() + format.slice(1)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>

            <TouchableOpacity
              style={styles.createButton}
              onPress={handleCreateDeck}
            >
              <Text style={styles.createButtonText}>Create Deck</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Suggestions Modal */}
      <Modal
        visible={showSuggestModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => {
          setShowSuggestModal(false);
          setSuggestions(null);
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, styles.suggestModalContent]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Deck Suggestions</Text>
              <TouchableOpacity onPress={() => {
                setShowSuggestModal(false);
                setSuggestions(null);
                setCommanderName('');
              }}>
                <Ionicons name="close" size={28} color="#FFF" />
              </TouchableOpacity>
            </View>

            {!suggestions ? (
              <>
                <Text style={styles.suggestInfo}>
                  Enter a commander name to get deck suggestions based on your collection and EDHREC data.
                </Text>
                <TextInput
                  style={styles.input}
                  placeholder="Commander name..."
                  placeholderTextColor="#666"
                  value={commanderName}
                  onChangeText={setCommanderName}
                />
                <TouchableOpacity
                  style={[styles.createButton, loading && styles.buttonDisabled]}
                  onPress={handleGetSuggestions}
                  disabled={loading}
                >
                  <Text style={styles.createButtonText}>
                    {loading ? 'Loading...' : 'Get Suggestions'}
                  </Text>
                </TouchableOpacity>
              </>
            ) : (
              <ScrollView showsVerticalScrollIndicator={false}>
                <Text style={styles.commanderTitle}>
                  {suggestions.commander?.name}
                </Text>
                
                {suggestions.fromCollection?.length > 0 && (
                  <View style={styles.suggestSection}>
                    <Text style={styles.suggestSectionTitle}>
                      From Your Collection ({suggestions.fromCollection.length})
                    </Text>
                    {suggestions.fromCollection.slice(0, 10).map((card, index) => (
                      <View key={index} style={styles.suggestCard}>
                        <Text style={styles.suggestCardName}>{card.name}</Text>
                        {card.synergy && (
                          <Text style={styles.synergyText}>
                            +{Math.round(card.synergy * 100)}% synergy
                          </Text>
                        )}
                      </View>
                    ))}
                  </View>
                )}

                {suggestions.toAcquire?.length > 0 && (
                  <View style={styles.suggestSection}>
                    <Text style={styles.suggestSectionTitle}>
                      Suggested to Acquire ({suggestions.toAcquire.length})
                    </Text>
                    {suggestions.toAcquire.slice(0, 10).map((card, index) => (
                      <View key={index} style={styles.suggestCard}>
                        <Text style={styles.suggestCardName}>{card.name}</Text>
                        {card.inclusion && (
                          <Text style={styles.inclusionText}>
                            In {card.inclusion}% of decks
                          </Text>
                        )}
                      </View>
                    ))}
                  </View>
                )}

                <TouchableOpacity
                  style={styles.createButton}
                  onPress={async () => {
                    const deck = await createNewDeck({
                      name: `${suggestions.commander?.name} Deck`,
                      format: 'commander',
                      commander: suggestions.commander,
                    });
                    if (deck) {
                      setShowSuggestModal(false);
                      setSuggestions(null);
                      setCommanderName('');
                      Alert.alert('Success', 'Deck created! Add suggested cards manually.');
                    }
                  }}
                >
                  <Text style={styles.createButtonText}>Create This Deck</Text>
                </TouchableOpacity>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#121212',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#FFF',
  },
  headerButton: {
    padding: 4,
  },
  actionButtons: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#6B4FA2',
    paddingVertical: 12,
    borderRadius: 12,
  },
  suggestButton: {
    backgroundColor: '#4CAF50',
  },
  actionButtonText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 8,
  },
  listContent: {
    paddingBottom: 100,
  },
  deckCard: {
    backgroundColor: '#2A2A2A',
    marginHorizontal: 16,
    marginVertical: 8,
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
  },
  deckInfo: {
    flex: 1,
  },
  deckHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  deckName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFF',
    marginRight: 8,
  },
  formatBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  formatText: {
    color: '#FFF',
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  cardCount: {
    fontSize: 14,
    color: '#AAA',
    marginBottom: 2,
  },
  commanderText: {
    fontSize: 12,
    color: '#6B4FA2',
    marginBottom: 2,
  },
  dateText: {
    fontSize: 11,
    color: '#666',
  },
  deleteButton: {
    padding: 8,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  emptyTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#FFF',
    marginTop: 20,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: '#888',
    textAlign: 'center',
    lineHeight: 20,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    justifyContent: 'center',
  },
  modalContent: {
    backgroundColor: '#1E1E1E',
    marginHorizontal: 16,
    borderRadius: 16,
    padding: 20,
  },
  suggestModalContent: {
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFF',
  },
  input: {
    backgroundColor: '#2A2A2A',
    borderRadius: 12,
    padding: 16,
    color: '#FFF',
    fontSize: 16,
    marginBottom: 16,
  },
  label: {
    color: '#888',
    fontSize: 14,
    marginBottom: 8,
  },
  formatOptions: {
    flexDirection: 'row',
    marginBottom: 20,
  },
  formatOption: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#2A2A2A',
    marginRight: 8,
  },
  formatOptionSelected: {
    backgroundColor: '#6B4FA2',
  },
  formatOptionText: {
    color: '#888',
    fontSize: 14,
  },
  formatOptionTextSelected: {
    color: '#FFF',
  },
  createButton: {
    backgroundColor: '#6B4FA2',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  createButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
  suggestInfo: {
    color: '#AAA',
    fontSize: 14,
    marginBottom: 16,
    lineHeight: 20,
  },
  commanderTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#6B4FA2',
    textAlign: 'center',
    marginBottom: 16,
  },
  suggestSection: {
    marginBottom: 20,
  },
  suggestSectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFF',
    marginBottom: 12,
  },
  suggestCard: {
    backgroundColor: '#2A2A2A',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  suggestCardName: {
    color: '#FFF',
    fontSize: 14,
    flex: 1,
  },
  synergyText: {
    color: '#4CAF50',
    fontSize: 12,
  },
  inclusionText: {
    color: '#888',
    fontSize: 12,
  },
});

export default DecksScreen;
