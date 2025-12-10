import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  TouchableOpacity,
  Alert,
  Modal,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { 
  searchCardsByName, 
  searchCardsByNameAnyLang,
  searchCardInLanguage,
  LANGUAGES 
} from '../services/scryfallApi';
import { loadSettings, saveSettings } from '../services/storageService';
import { useCollection } from '../context/CollectionContext';
import CardItem from '../components/CardItem';
import SearchBar from '../components/SearchBar';

const SearchScreen = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [currentQuery, setCurrentQuery] = useState('');
  const [searchLanguage, setSearchLanguage] = useState('fr'); // Default French
  const [showLanguageModal, setShowLanguageModal] = useState(false);
  
  const { addCardToCollection, isCardInCollection, getCardQuantity } = useCollection();

  // Load saved language preference
  useEffect(() => {
    loadSettings().then(settings => {
      if (settings.searchLanguage) {
        setSearchLanguage(settings.searchLanguage);
      }
    });
  }, []);

  // Save language preference when changed
  const handleLanguageChange = async (lang) => {
    setSearchLanguage(lang);
    setShowLanguageModal(false);
    
    const settings = await loadSettings();
    await saveSettings({ ...settings, searchLanguage: lang });
    
    // Re-search if there's a current query
    if (currentQuery) {
      handleSearch(currentQuery, lang);
    }
  };

  const handleSearch = useCallback(async (query, lang = searchLanguage) => {
    if (!query.trim()) return;
    
    setLoading(true);
    setError(null);
    setCurrentQuery(query);
    setCurrentPage(1);
    
    try {
      let data;
      
      if (lang === 'any') {
        // Search in all languages
        data = await searchCardsByNameAnyLang(query);
      } else if (lang === 'en') {
        // Standard English search
        data = await searchCardsByName(query);
      } else {
        // Search in specific language (French, German, etc.)
        data = await searchCardsByName(query, 1, lang);
      }
      
      setResults(data.data || []);
      setHasMore(data.has_more || false);
    } catch (err) {
      // If language-specific search fails, try any language as fallback
      try {
        const fallbackData = await searchCardsByNameAnyLang(query);
        setResults(fallbackData.data || []);
        setHasMore(fallbackData.has_more || false);
      } catch (fallbackErr) {
        setError(err.message || 'Failed to search cards');
        setResults([]);
      }
    } finally {
      setLoading(false);
    }
  }, [searchLanguage]);

  const loadMore = useCallback(async () => {
    if (!hasMore || loading) return;
    
    setLoading(true);
    try {
      let data;
      
      if (searchLanguage === 'any') {
        data = await searchCardsByNameAnyLang(currentQuery, currentPage + 1);
      } else if (searchLanguage === 'en') {
        data = await searchCardsByName(currentQuery, currentPage + 1);
      } else {
        data = await searchCardsByName(currentQuery, currentPage + 1, searchLanguage);
      }
      
      setResults(prev => [...prev, ...(data.data || [])]);
      setCurrentPage(prev => prev + 1);
      setHasMore(data.has_more || false);
    } catch (err) {
      console.error('Load more error:', err);
    } finally {
      setLoading(false);
    }
  }, [currentQuery, currentPage, hasMore, loading, searchLanguage]);

  const handleAddToCollection = useCallback(async (card) => {
    const success = await addCardToCollection(card, 1);
    if (success) {
      Alert.alert('Ajouté !', `${card.printed_name || card.name} ajouté à la collection.`);
    }
  }, [addCardToCollection]);

  const getCurrentLanguage = () => {
    if (searchLanguage === 'any') {
      return { name: 'Toutes', flag: '🌍' };
    }
    return LANGUAGES[searchLanguage] || LANGUAGES.en;
  };

  const renderLanguageSelector = () => (
    <TouchableOpacity 
      style={styles.languageButton}
      onPress={() => setShowLanguageModal(true)}
    >
      <Text style={styles.languageFlag}>{getCurrentLanguage().flag}</Text>
      <Text style={styles.languageText}>{getCurrentLanguage().name}</Text>
      <Ionicons name="chevron-down" size={16} color="#888" />
    </TouchableOpacity>
  );

  const renderFilters = () => (
    <View style={styles.filtersContainer}>
      <TouchableOpacity 
        style={styles.filterChip}
        onPress={() => handleSearch('type:creature ' + currentQuery)}
      >
        <Text style={styles.filterText}>Créatures</Text>
      </TouchableOpacity>
      <TouchableOpacity 
        style={styles.filterChip}
        onPress={() => handleSearch('type:instant OR type:sorcery ' + currentQuery)}
      >
        <Text style={styles.filterText}>Sorts</Text>
      </TouchableOpacity>
      <TouchableOpacity 
        style={styles.filterChip}
        onPress={() => handleSearch('type:artifact ' + currentQuery)}
      >
        <Text style={styles.filterText}>Artefacts</Text>
      </TouchableOpacity>
      <TouchableOpacity 
        style={styles.filterChip}
        onPress={() => handleSearch('is:commander ' + currentQuery)}
      >
        <Text style={styles.filterText}>Commandants</Text>
      </TouchableOpacity>
    </View>
  );

  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <Ionicons name="search" size={80} color="#444" />
      <Text style={styles.emptyTitle}>Rechercher des cartes</Text>
      <Text style={styles.emptyText}>
        Trouvez n'importe quelle carte Magic: The Gathering en français ou anglais
      </Text>
      <View style={styles.tipContainer}>
        <Text style={styles.tipTitle}>Conseils de recherche :</Text>
        <Text style={styles.tipText}>• Tapez le nom en français ou anglais</Text>
        <Text style={styles.tipText}>• "Éclair" trouvera Lightning Bolt</Text>
        <Text style={styles.tipText}>• "c:blue" pour la couleur</Text>
        <Text style={styles.tipText}>• "cmc:3" pour le coût de mana</Text>
        <Text style={styles.tipText}>• "t:creature" pour le type</Text>
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
            <Text style={styles.loadMoreText}>Charger plus</Text>
            <Ionicons name="chevron-down" size={20} color="#FFF" />
          </>
        )}
      </TouchableOpacity>
    );
  };

  const renderCardItem = ({ item }) => {
    // Show French name if available
    const displayName = item.printed_name || item.name;
    const showOriginalName = item.printed_name && item.printed_name !== item.name;
    
    return (
      <CardItem
        card={{
          ...item,
          displayName,
          showOriginalName,
        }}
        onAddToCollection={handleAddToCollection}
        showQuantity={true}
        quantity={getCardQuantity(item.id)}
      />
    );
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.title}>Recherche</Text>
        {renderLanguageSelector()}
      </View>

      <SearchBar
        placeholder={`Rechercher en ${getCurrentLanguage().name.toLowerCase()}...`}
        onSearch={(q) => handleSearch(q)}
        showAutocomplete={true}
      />

      {results.length > 0 && renderFilters()}

      {loading && results.length === 0 ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#6B4FA2" />
          <Text style={styles.loadingText}>Recherche...</Text>
        </View>
      ) : error ? (
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle" size={60} color="#F44336" />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity 
            style={styles.retryButton}
            onPress={() => handleSearch(currentQuery)}
          >
            <Text style={styles.retryText}>Réessayer</Text>
          </TouchableOpacity>
        </View>
      ) : results.length === 0 && currentQuery ? (
        <View style={styles.noResultsContainer}>
          <Ionicons name="search-outline" size={60} color="#888" />
          <Text style={styles.noResultsText}>
            Aucune carte trouvée pour "{currentQuery}"
          </Text>
          <TouchableOpacity 
            style={styles.tryAnyLangButton}
            onPress={() => handleSearch(currentQuery, 'any')}
          >
            <Text style={styles.tryAnyLangText}>Chercher dans toutes les langues</Text>
          </TouchableOpacity>
        </View>
      ) : results.length === 0 ? (
        renderEmptyState()
      ) : (
        <FlatList
          data={results}
          keyExtractor={(item) => item.id}
          renderItem={renderCardItem}
          contentContainerStyle={styles.listContent}
          ListFooterComponent={renderFooter}
          onEndReached={loadMore}
          onEndReachedThreshold={0.5}
        />
      )}

      {/* Language Selection Modal */}
      <Modal
        visible={showLanguageModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowLanguageModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { paddingBottom: insets.bottom + 20 }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Langue de recherche</Text>
              <TouchableOpacity onPress={() => setShowLanguageModal(false)}>
                <Ionicons name="close" size={28} color="#FFF" />
              </TouchableOpacity>
            </View>
            
            <Text style={styles.modalSubtitle}>
              Choisissez la langue pour rechercher les noms de cartes
            </Text>

            {/* Any language option */}
            <TouchableOpacity
              style={[
                styles.languageOption,
                searchLanguage === 'any' && styles.languageOptionSelected,
              ]}
              onPress={() => handleLanguageChange('any')}
            >
              <Text style={styles.languageOptionFlag}>🌍</Text>
              <View style={styles.languageOptionInfo}>
                <Text style={styles.languageOptionName}>Toutes les langues</Text>
                <Text style={styles.languageOptionDesc}>Recherche multilingue</Text>
              </View>
              {searchLanguage === 'any' && (
                <Ionicons name="checkmark-circle" size={24} color="#6B4FA2" />
              )}
            </TouchableOpacity>

            {/* Individual languages */}
            {Object.values(LANGUAGES).map((lang) => (
              <TouchableOpacity
                key={lang.code}
                style={[
                  styles.languageOption,
                  searchLanguage === lang.code && styles.languageOptionSelected,
                ]}
                onPress={() => handleLanguageChange(lang.code)}
              >
                <Text style={styles.languageOptionFlag}>{lang.flag}</Text>
                <View style={styles.languageOptionInfo}>
                  <Text style={styles.languageOptionName}>{lang.name}</Text>
                </View>
                {searchLanguage === lang.code && (
                  <Ionicons name="checkmark-circle" size={24} color="#6B4FA2" />
                )}
              </TouchableOpacity>
            ))}
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
  languageButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2A2A2A',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
  },
  languageFlag: {
    fontSize: 18,
    marginRight: 6,
  },
  languageText: {
    color: '#FFF',
    fontSize: 14,
    marginRight: 4,
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
    paddingBottom: 120,
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
    paddingHorizontal: 32,
  },
  noResultsText: {
    color: '#888',
    fontSize: 16,
    marginTop: 12,
    textAlign: 'center',
  },
  tryAnyLangButton: {
    marginTop: 16,
    padding: 12,
  },
  tryAnyLangText: {
    color: '#6B4FA2',
    fontSize: 14,
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#1E1E1E',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFF',
  },
  modalSubtitle: {
    color: '#888',
    fontSize: 14,
    marginBottom: 20,
  },
  languageOption: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2A2A2A',
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
  },
  languageOptionSelected: {
    backgroundColor: '#3A3A4A',
    borderWidth: 1,
    borderColor: '#6B4FA2',
  },
  languageOptionFlag: {
    fontSize: 28,
    marginRight: 16,
  },
  languageOptionInfo: {
    flex: 1,
  },
  languageOptionName: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '500',
  },
  languageOptionDesc: {
    color: '#888',
    fontSize: 12,
    marginTop: 2,
  },
});

export default SearchScreen;