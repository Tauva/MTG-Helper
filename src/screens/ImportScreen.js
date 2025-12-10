import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Alert,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Ionicons } from '@expo/vector-icons';
import { parseDeckList } from '../services/scryfallApi';
import { useCollection } from '../context/CollectionContext';
import { 
  exportCollectionToJSON, 
  exportCollectionToCSV,
  importCollectionFromJSON 
} from '../services/storageService';

const ImportScreen = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const [decklistText, setDecklistText] = useState('');
  const [loading, setLoading] = useState(false);
  const [parseResults, setParseResults] = useState(null);
  
  const { addCardsToCollection, collection } = useCollection();

  const handleParseDeckList = async () => {
    if (!decklistText.trim()) {
      Alert.alert('Error', 'Please enter a decklist');
      return;
    }

    setLoading(true);
    try {
      const results = await parseDeckList(decklistText);
      setParseResults(results);
      
      const found = results.filter(r => r.found).length;
      const notFound = results.filter(r => !r.found).length;
      
      Alert.alert(
        'Parse Complete',
        `Found ${found} cards, ${notFound} not found.`,
        [
          { text: 'OK' }
        ]
      );
    } catch (error) {
      Alert.alert('Error', 'Failed to parse decklist');
    } finally {
      setLoading(false);
    }
  };

  const handleAddToCollection = async () => {
    if (!parseResults) return;

    const cardsToAdd = parseResults
      .filter(r => r.found && r.cardData)
      .map(r => ({
        card: r.cardData,
        quantity: r.quantity,
      }));

    if (cardsToAdd.length === 0) {
      Alert.alert('Error', 'No valid cards to add');
      return;
    }

    setLoading(true);
    try {
      const success = await addCardsToCollection(cardsToAdd);
      if (success) {
        Alert.alert('Success', `Added ${cardsToAdd.length} cards to collection!`);
        setDecklistText('');
        setParseResults(null);
        navigation.goBack();
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to add cards');
    } finally {
      setLoading(false);
    }
  };

  const handleImportFile = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/json', 'text/plain'],
      });

      if (result.canceled) return;

      const file = result.assets[0];
      const content = await FileSystem.readAsStringAsync(file.uri);

      if (file.name.endsWith('.json')) {
        const importResult = await importCollectionFromJSON(content);
        if (importResult.success) {
          Alert.alert(
            'Import Complete',
            `Imported ${importResult.cardsImported} cards and ${importResult.decksImported} decks.`
          );
        } else {
          Alert.alert('Error', importResult.error || 'Failed to import');
        }
      } else {
        // Treat as decklist text
        setDecklistText(content);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to read file');
    }
  };

  const handleExportJSON = async () => {
    try {
      const json = await exportCollectionToJSON();
      if (!json) {
        Alert.alert('Error', 'Failed to export collection');
        return;
      }

      const filename = `mtg_collection_${Date.now()}.json`;
      const filepath = `${FileSystem.documentDirectory}${filename}`;
      
      await FileSystem.writeAsStringAsync(filepath, json);
      
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(filepath, {
          mimeType: 'application/json',
          dialogTitle: 'Export Collection',
        });
      } else {
        Alert.alert('Success', `File saved to ${filepath}`);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to export collection');
    }
  };

  const handleExportCSV = async () => {
    try {
      const csv = await exportCollectionToCSV();
      if (!csv) {
        Alert.alert('Error', 'Failed to export collection');
        return;
      }

      const filename = `mtg_collection_${Date.now()}.csv`;
      const filepath = `${FileSystem.documentDirectory}${filename}`;
      
      await FileSystem.writeAsStringAsync(filepath, csv);
      
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(filepath, {
          mimeType: 'text/csv',
          dialogTitle: 'Export Collection',
        });
      } else {
        Alert.alert('Success', `File saved to ${filepath}`);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to export collection');
    }
  };

  return (
    <ScrollView 
      style={styles.container} 
      contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]}
    >
      <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={28} color="#FFF" />
        </TouchableOpacity>
        <Text style={styles.title}>Import / Export</Text>
        <View style={{ width: 28 }} />
      </View>

      {/* Import Decklist Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>
          <Ionicons name="document-text" size={20} color="#6B4FA2" /> Import Decklist
        </Text>
        <Text style={styles.sectionDescription}>
          Paste a decklist in standard format (e.g., "4 Lightning Bolt" or "4x Lightning Bolt")
        </Text>

        <TextInput
          style={styles.textArea}
          placeholder="4 Lightning Bolt&#10;2 Counterspell&#10;1 Sol Ring&#10;..."
          placeholderTextColor="#666"
          multiline
          numberOfLines={10}
          value={decklistText}
          onChangeText={setDecklistText}
          textAlignVertical="top"
        />

        <View style={styles.buttonRow}>
          <TouchableOpacity
            style={[styles.button, styles.secondaryButton]}
            onPress={handleImportFile}
          >
            <Ionicons name="document" size={20} color="#6B4FA2" />
            <Text style={styles.secondaryButtonText}>Import File</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.button, styles.primaryButton, loading && styles.buttonDisabled]}
            onPress={handleParseDeckList}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#FFF" size="small" />
            ) : (
              <>
                <Ionicons name="checkmark-circle" size={20} color="#FFF" />
                <Text style={styles.primaryButtonText}>Parse</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        {/* Parse Results */}
        {parseResults && (
          <View style={styles.resultsContainer}>
            <Text style={styles.resultsTitle}>Parse Results</Text>
            
            <View style={styles.resultsSummary}>
              <View style={styles.summaryItem}>
                <Text style={styles.summaryValue}>
                  {parseResults.filter(r => r.found).length}
                </Text>
                <Text style={styles.summaryLabel}>Found</Text>
              </View>
              <View style={styles.summaryItem}>
                <Text style={[styles.summaryValue, styles.errorText]}>
                  {parseResults.filter(r => !r.found).length}
                </Text>
                <Text style={styles.summaryLabel}>Not Found</Text>
              </View>
            </View>

            <ScrollView style={styles.resultsList} nestedScrollEnabled>
              {parseResults.map((result, index) => (
                <View key={index} style={styles.resultItem}>
                  <View style={styles.resultInfo}>
                    <Text style={[
                      styles.resultName,
                      !result.found && styles.resultNameError
                    ]}>
                      {result.name}
                    </Text>
                    <Text style={styles.resultQuantity}>x{result.quantity}</Text>
                  </View>
                  <Ionicons
                    name={result.found ? 'checkmark-circle' : 'close-circle'}
                    size={20}
                    color={result.found ? '#4CAF50' : '#F44336'}
                  />
                </View>
              ))}
            </ScrollView>

            <TouchableOpacity
              style={[styles.button, styles.addButton]}
              onPress={handleAddToCollection}
              disabled={loading}
            >
              <Ionicons name="add-circle" size={20} color="#FFF" />
              <Text style={styles.primaryButtonText}>
                Add {parseResults.filter(r => r.found).length} Cards to Collection
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Export Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>
          <Ionicons name="download" size={20} color="#4CAF50" /> Export Collection
        </Text>
        <Text style={styles.sectionDescription}>
          Export your collection ({collection.length} unique cards) for backup or use in other apps.
        </Text>

        <View style={styles.buttonRow}>
          <TouchableOpacity
            style={[styles.button, styles.exportButton]}
            onPress={handleExportJSON}
          >
            <Ionicons name="code-slash" size={20} color="#FFF" />
            <Text style={styles.primaryButtonText}>JSON</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.button, styles.exportButton]}
            onPress={handleExportCSV}
          >
            <Ionicons name="grid" size={20} color="#FFF" />
            <Text style={styles.primaryButtonText}>CSV</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Help Section */}
      <View style={styles.helpSection}>
        <Text style={styles.helpTitle}>Supported Formats</Text>
        <Text style={styles.helpText}>• Standard decklist: "4 Card Name"</Text>
        <Text style={styles.helpText}>• With x: "4x Card Name"</Text>
        <Text style={styles.helpText}>• Single card: "Card Name"</Text>
        <Text style={styles.helpText}>• Comments: // or # at start of line</Text>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#121212',
  },
  content: {
    paddingBottom: 32,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFF',
  },
  section: {
    backgroundColor: '#1E1E1E',
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 16,
    padding: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFF',
    marginBottom: 8,
  },
  sectionDescription: {
    fontSize: 14,
    color: '#888',
    marginBottom: 16,
    lineHeight: 20,
  },
  textArea: {
    backgroundColor: '#2A2A2A',
    borderRadius: 12,
    padding: 16,
    color: '#FFF',
    fontSize: 14,
    minHeight: 150,
    marginBottom: 16,
    fontFamily: 'monospace',
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
  },
  button: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
  },
  primaryButton: {
    backgroundColor: '#6B4FA2',
  },
  secondaryButton: {
    backgroundColor: '#2A2A2A',
    borderWidth: 1,
    borderColor: '#6B4FA2',
  },
  exportButton: {
    backgroundColor: '#4CAF50',
  },
  addButton: {
    backgroundColor: '#4CAF50',
    marginTop: 16,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  primaryButtonText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '600',
  },
  secondaryButtonText: {
    color: '#6B4FA2',
    fontSize: 14,
    fontWeight: '600',
  },
  resultsContainer: {
    marginTop: 20,
    padding: 16,
    backgroundColor: '#2A2A2A',
    borderRadius: 12,
  },
  resultsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFF',
    marginBottom: 12,
  },
  resultsSummary: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#3A3A3A',
  },
  summaryItem: {
    alignItems: 'center',
  },
  summaryValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#4CAF50',
  },
  summaryLabel: {
    fontSize: 12,
    color: '#888',
  },
  errorText: {
    color: '#F44336',
  },
  resultsList: {
    maxHeight: 200,
  },
  resultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#3A3A3A',
  },
  resultInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  resultName: {
    color: '#FFF',
    fontSize: 14,
    flex: 1,
  },
  resultNameError: {
    color: '#F44336',
  },
  resultQuantity: {
    color: '#888',
    fontSize: 12,
    marginRight: 12,
  },
  helpSection: {
    marginHorizontal: 16,
    padding: 16,
  },
  helpTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#888',
    marginBottom: 8,
  },
  helpText: {
    fontSize: 12,
    color: '#666',
    lineHeight: 20,
  },
});

export default ImportScreen;
