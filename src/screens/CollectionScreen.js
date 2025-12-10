import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useCollection } from '../context/CollectionContext';
import CardItem from '../components/CardItem';
import SearchBar from '../components/SearchBar';

const CollectionScreen = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const { 
    collection, 
    loading, 
    refresh,
    removeCardFromCollection,
    getCollectionStats,
    searchCollection,
  } = useCollection();
  
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState('list'); // 'list' or 'grid'
  const [sortBy, setSortBy] = useState('name'); // 'name', 'color', 'cmc', 'rarity', 'date'
  const [filterMenuVisible, setFilterMenuVisible] = useState(false);

  const stats = useMemo(() => getCollectionStats(), [collection]);

  const filteredAndSorted = useMemo(() => {
    let result = searchQuery 
      ? searchCollection(searchQuery)
      : [...collection];
    
    // Sort
    result.sort((a, b) => {
      switch (sortBy) {
        case 'name':
          return (a.name || '').localeCompare(b.name || '');
        case 'cmc':
          return (a.cmc || 0) - (b.cmc || 0);
        case 'rarity':
          const rarityOrder = { common: 0, uncommon: 1, rare: 2, mythic: 3 };
          return (rarityOrder[b.rarity] || 0) - (rarityOrder[a.rarity] || 0);
        case 'date':
          return new Date(b.addedAt || 0) - new Date(a.addedAt || 0);
        case 'price':
          return (parseFloat(b.prices?.usd) || 0) - (parseFloat(a.prices?.usd) || 0);
        default:
          return 0;
      }
    });
    
    return result;
  }, [collection, searchQuery, sortBy, searchCollection]);

  const handleRemoveCard = (cardId) => {
    Alert.alert(
      'Remove Card',
      'Remove one copy from collection?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Remove', 
          style: 'destructive',
          onPress: () => removeCardFromCollection(cardId, 1)
        },
      ]
    );
  };

  const renderHeader = () => (
    <View style={styles.statsContainer}>
      <View style={styles.statCard}>
        <Text style={styles.statValue}>{stats.totalCards}</Text>
        <Text style={styles.statLabel}>Total Cards</Text>
      </View>
      <View style={styles.statCard}>
        <Text style={styles.statValue}>{stats.uniqueCards}</Text>
        <Text style={styles.statLabel}>Unique</Text>
      </View>
      <View style={styles.statCard}>
        <Text style={styles.statValue}>${stats.totalValue}</Text>
        <Text style={styles.statLabel}>Value</Text>
      </View>
    </View>
  );

  const renderControls = () => (
    <View style={styles.controlsContainer}>
      <View style={styles.sortContainer}>
        <Text style={styles.sortLabel}>Sort: </Text>
        <TouchableOpacity 
          style={styles.sortButton}
          onPress={() => {
            const options = ['name', 'cmc', 'rarity', 'date', 'price'];
            const currentIndex = options.indexOf(sortBy);
            const nextIndex = (currentIndex + 1) % options.length;
            setSortBy(options[nextIndex]);
          }}
        >
          <Text style={styles.sortButtonText}>
            {sortBy.charAt(0).toUpperCase() + sortBy.slice(1)}
          </Text>
          <Ionicons name="swap-vertical" size={16} color="#FFF" />
        </TouchableOpacity>
      </View>
      <View style={styles.viewToggle}>
        <TouchableOpacity 
          style={[styles.viewButton, viewMode === 'list' && styles.viewButtonActive]}
          onPress={() => setViewMode('list')}
        >
          <Ionicons 
            name="list" 
            size={20} 
            color={viewMode === 'list' ? '#FFF' : '#888'} 
          />
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.viewButton, viewMode === 'grid' && styles.viewButtonActive]}
          onPress={() => setViewMode('grid')}
        >
          <Ionicons 
            name="grid" 
            size={20} 
            color={viewMode === 'grid' ? '#FFF' : '#888'} 
          />
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <Ionicons name="albums-outline" size={80} color="#444" />
      <Text style={styles.emptyTitle}>Your Collection is Empty</Text>
      <Text style={styles.emptyText}>
        Start adding cards by searching, scanning, or importing a decklist!
      </Text>
      <TouchableOpacity 
        style={styles.emptyButton}
        onPress={() => navigation.navigate('Search')}
      >
        <Ionicons name="search" size={20} color="#FFF" />
        <Text style={styles.emptyButtonText}>Search Cards</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.title}>My Collection</Text>
        <TouchableOpacity 
          style={styles.headerButton}
          onPress={() => navigation.navigate('Import')}
        >
          <Ionicons name="add-circle" size={28} color="#6B4FA2" />
        </TouchableOpacity>
      </View>

      <SearchBar
        placeholder="Search collection..."
        value={searchQuery}
        onChangeText={setSearchQuery}
        onSearch={setSearchQuery}
        onClear={() => setSearchQuery('')}
        showAutocomplete={false}
      />

      {collection.length > 0 ? (
        <>
          {renderHeader()}
          {renderControls()}
          <FlatList
            data={filteredAndSorted}
            keyExtractor={(item) => item.id || item.scryfallId}
            numColumns={viewMode === 'grid' ? 3 : 1}
            key={viewMode}
            renderItem={({ item }) => (
              <CardItem
                card={item}
                compact={viewMode === 'grid'}
                showQuantity={true}
                quantity={item.quantity}
                onRemoveFromCollection={handleRemoveCard}
                onPress={() => navigation.navigate('CardDetail', { card: item })}
              />
            )}
            contentContainerStyle={styles.listContent}
            refreshControl={
              <RefreshControl
                refreshing={loading}
                onRefresh={refresh}
                tintColor="#6B4FA2"
              />
            }
            ListEmptyComponent={
              searchQuery ? (
                <View style={styles.noResults}>
                  <Text style={styles.noResultsText}>
                    No cards found matching "{searchQuery}"
                  </Text>
                </View>
              ) : null
            }
          />
        </>
      ) : (
        renderEmptyState()
      )}
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
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  statCard: {
    backgroundColor: '#2A2A2A',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    flex: 1,
    marginHorizontal: 4,
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#6B4FA2',
  },
  statLabel: {
    fontSize: 12,
    color: '#888',
    marginTop: 4,
  },
  controlsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  sortContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sortLabel: {
    color: '#888',
    fontSize: 14,
  },
  sortButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2A2A2A',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  sortButtonText: {
    color: '#FFF',
    fontSize: 14,
    marginRight: 4,
  },
  viewToggle: {
    flexDirection: 'row',
    backgroundColor: '#2A2A2A',
    borderRadius: 8,
    overflow: 'hidden',
  },
  viewButton: {
    padding: 8,
    paddingHorizontal: 12,
  },
  viewButtonActive: {
    backgroundColor: '#6B4FA2',
  },
  listContent: {
    paddingBottom: 120,
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
  emptyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#6B4FA2',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 25,
    marginTop: 24,
  },
  emptyButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  noResults: {
    padding: 32,
    alignItems: 'center',
  },
  noResultsText: {
    color: '#888',
    fontSize: 14,
  },
});

export default CollectionScreen;
