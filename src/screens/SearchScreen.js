import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { searchCardsByName } from '../services/scryfallApi';
import { useCollection } from '../context/CollectionContext';
import CardItem from '../components/CardItem';
import SearchBar from '../components/SearchBar';

const SearchScreen = ({ navigation }) => {
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [currentQuery, setCurrentQuery] = useState('');
  
  const { addCardToCollection, isCardInCollection, getCardQuantity } = useCollection();

  const handleSearch = useCallback(async (query) => {
    if (!query.trim()) return;
    
    setLoading(true);
    setError(null);
    setCurrentQuery(query);
    setCurrentPage(1);
    
    try {
      const data = await searchCardsByName(query);
      setResults(data.data || []);
      setHasMore(data.has_more || false);
    } catch (err) {
      setError(err.message || 'Failed to search cards');
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadMore = useCallback(async () => {
    if (!hasMore || loading) return;
    
    setLoading(true);
    try {
      const data = await searchCardsByName(currentQuery, currentPage + 1);
      setResults(prev => [...prev, ...(data.data || [])]);
      setCurrentPage(prev => prev + 1);
      setHasMore(data.has_more || false);
    } catch (err) {
      console.error('Load more error:', err);
    } finally {
      setLoading(false);
    }
  }, [currentQuery, currentPage, hasMore, loading]);

  const handleAddToCollection = useCallback(async (card) => {
    const success = await addCardToCollection(card, 1);
    if (success) {
      Alert.alert('Added!', `${card.name} added to collection.`);
    }
  }, [addCardToCollection]);

  const renderFilters = () => (
    <View style={styles.filtersContainer}>
      <TouchableOpacity 
        style={styles.filterChip}
        onPress={() => handleSearch('type:creature ' + currentQuery)}
      >
        <Text style={styles.filterText}>Creatures</Text>
      </TouchableOpacity>
      <TouchableOpacity 
        style={styles.filterChip}
        onPress={() => handleSearch('type:instant OR type:sorcery ' + currentQuery)}
      >
        <Text style={styles.filterText}>Spells</Text>
      </TouchableOpacity>
      <TouchableOpacity 
        style={styles.filterChip}
        onPress={() => handleSearch('type:artifact ' + currentQuery)}
      >
        <Text style={styles.filterText}>Artifacts</Text>
      </TouchableOpacity>
      <TouchableOpacity 
        style={styles.filterChip}
        onPress={() => handleSearch('is:commander ' + currentQuery)}
      >
        <Text style={styles.filterText}>Commanders</Text>
      </TouchableOpacity>
    </View>
  );

  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <Ionicons name="search" size={80} color="#444" />
      <Text style={styles.emptyTitle}>Search for Cards</Text>
      <Text style={styles.emptyText}>
        Find any Magic: The Gathering card using Scryfall's powerful search
      </Text>
      <View style={styles.tipContainer}>
        <Text style={styles.tipTitle}>Search Tips:</Text>
        <Text style={styles.tipText}>• Type card names directly</Text>
        <Text style={styles.tipText}>• Use "c:blue" for color</Text>
        <Text style={styles.tipText}>• Use "cmc:3" for mana value</Text>
        <Text style={styles.tipText}>• Use "t:creature" for type</Text>
        <Text style={styles.tipText}>• Use "o:flying" for oracle text</Text>
      </View>
    </View>
  );

  const renderFooter = () => {
    if (!hasMore) return null;
    return (
      <TouchableOpacity 
        style={styles.loadMoreButton}
        onPress={loadMore}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color="#FFF" />
        ) : (
          <>
            <Text style={styles.loadMoreText}>Load More</Text>
            <Ionicons name="chevron-down" size={20} color="#FFF" />
          </>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Search Cards</Text>
      </View>

      <SearchBar
        placeholder="Search Magic cards..."
        onSearch={handleSearch}
        showAutocomplete={true}
      />

      {results.length > 0 && renderFilters()}

      {loading && results.length === 0 ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#6B4FA2" />
          <Text style={styles.loadingText}>Searching...</Text>
        </View>
      ) : error ? (
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle" size={60} color="#F44336" />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity 
            style={styles.retryButton}
            onPress={() => handleSearch(currentQuery)}
          >
            <Text style={styles.retryText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      ) : results.length === 0 && currentQuery ? (
        <View style={styles.noResultsContainer}>
          <Ionicons name="search-outline" size={60} color="#888" />
          <Text style={styles.noResultsText}>
            No cards found for "{currentQuery}"
          </Text>
        </View>
      ) : results.length === 0 ? (
        renderEmptyState()
      ) : (
        <FlatList
          data={results}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <CardItem
              card={item}
              onAddToCollection={handleAddToCollection}
              showQuantity={true}
              quantity={getCardQuantity(item.id)}
            />
          )}
          contentContainerStyle={styles.listContent}
          ListFooterComponent={renderFooter}
          onEndReached={loadMore}
          onEndReachedThreshold={0.5}
        />
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
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#FFF',
  },
  filtersContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 8,
    flexWrap: 'wrap',
  },
  filterChip: {
    backgroundColor: '#2A2A2A',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginRight: 8,
    marginBottom: 8,
  },
  filterText: {
    color: '#FFF',
    fontSize: 12,
  },
  listContent: {
    paddingBottom: 100,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#888',
    marginTop: 12,
    fontSize: 16,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  errorText: {
    color: '#F44336',
    fontSize: 16,
    textAlign: 'center',
    marginTop: 12,
  },
  retryButton: {
    backgroundColor: '#6B4FA2',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 16,
  },
  retryText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
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
    marginBottom: 24,
  },
  tipContainer: {
    backgroundColor: '#2A2A2A',
    padding: 16,
    borderRadius: 12,
    width: '100%',
  },
  tipTitle: {
    color: '#6B4FA2',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  tipText: {
    color: '#AAA',
    fontSize: 13,
    lineHeight: 22,
  },
  noResultsContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  noResultsText: {
    color: '#888',
    fontSize: 16,
    marginTop: 12,
  },
  loadMoreButton: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#6B4FA2',
    marginHorizontal: 16,
    marginVertical: 16,
    paddingVertical: 12,
    borderRadius: 8,
  },
  loadMoreText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
    marginRight: 8,
  },
});

export default SearchScreen;
