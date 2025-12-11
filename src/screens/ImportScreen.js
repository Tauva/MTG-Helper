import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  ActivityIndicator,
  Alert,
  Share,
  Modal,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { parseDeckList } from '../services/scryfallApi';
import {
  exportCollectionToJSON,
  exportCollectionToCSV,
  exportCollectionToDecklist,
  addDecklistToCollection,
  createDeckFromDecklist,
} from '../services/storageService';
import { useCollection } from '../context/CollectionContext';

const ImportScreen = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const [decklistText, setDecklistText] = useState('');
  const [parsing, setParsing] = useState(false);
  const [parsedCards, setParsedCards] = useState([]);
  const [showResults, setShowResults] = useState(false);
  const [importing, setImporting] = useState(false);
  const [showImportOptions, setShowImportOptions] = useState(false);
  const [deckName, setDeckName] = useState('');
  
  const { refreshCollection } = useCollection();

  const handleParseDeckList = async () => {
    if (!decklistText.trim()) {
      Alert.alert('Erreur', 'Veuillez coller une liste de cartes');
      return;
    }
    setParsing(true);
    try {
      const results = await parseDeckList(decklistText, 'any');
      setParsedCards(results);
      setShowResults(true);
      setDeckName(`Import ${new Date().toLocaleDateString('fr-FR')}`);
    } catch (error) {
      Alert.alert('Erreur', 'Impossible de parser la liste');
    } finally {
      setParsing(false);
    }
  };

  const handleImportToCollection = async () => {
    setImporting(true);
    try {
      await addDecklistToCollection(parsedCards);
      await refreshCollection();
      Alert.alert('Importé !', `${parsedCards.filter(c => c.found).length} cartes ajoutées.`);
      resetForm();
    } catch (error) {
      Alert.alert('Erreur', 'Impossible d\'importer');
    } finally {
      setImporting(false);
      setShowImportOptions(false);
    }
  };

  const handleImportAsDeck = async () => {
    if (!deckName.trim()) {
      Alert.alert('Erreur', 'Veuillez entrer un nom pour le deck');
      return;
    }
    setImporting(true);
    try {
      await addDecklistToCollection(parsedCards);
      await createDeckFromDecklist(deckName.trim(), 'commander', parsedCards);
      await refreshCollection();
      Alert.alert('Importé !', `Deck "${deckName}" créé. Cartes ajoutées à la collection.`);
      resetForm();
    } catch (error) {
      Alert.alert('Erreur', 'Impossible de créer le deck');
    } finally {
      setImporting(false);
      setShowImportOptions(false);
    }
  };

  const handleImportDeckOnly = async () => {
    if (!deckName.trim()) {
      Alert.alert('Erreur', 'Veuillez entrer un nom pour le deck');
      return;
    }
    setImporting(true);
    try {
      await createDeckFromDecklist(deckName.trim(), 'commander', parsedCards);
      Alert.alert('Deck créé !', `Deck "${deckName}" créé (sans ajout à la collection).`);
      resetForm();
    } catch (error) {
      Alert.alert('Erreur', 'Impossible de créer le deck');
    } finally {
      setImporting(false);
      setShowImportOptions(false);
    }
  };

  const resetForm = () => {
    setDecklistText('');
    setParsedCards([]);
    setShowResults(false);
    setDeckName('');
  };

  const handlePaste = async () => {
    const text = await Clipboard.getStringAsync();
    if (text) setDecklistText(text);
  };

  const handleExport = async (type) => {
    try {
      let data;
      if (type === 'json') data = await exportCollectionToJSON();
      else if (type === 'csv') data = await exportCollectionToCSV();
      else data = await exportCollectionToDecklist();
      
      if (data) {
        await Share.share({ message: data, title: `Collection (${type.toUpperCase()})` });
      }
    } catch (error) {
      Alert.alert('Erreur', 'Export impossible');
    }
  };

  const handleCopyDecklist = async () => {
    const decklist = await exportCollectionToDecklist();
    if (decklist) {
      await Clipboard.setStringAsync(decklist);
      Alert.alert('Copié !', 'Decklist copiée dans le presse-papier');
    }
  };

  const stats = {
    found: parsedCards.filter(c => c.found).length,
    notFound: parsedCards.filter(c => !c.found).length,
    total: parsedCards.reduce((s, c) => s + c.quantity, 0),
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: 100 + insets.bottom }]}>
        <Text style={styles.title}>Import / Export</Text>

        {/* Import Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            <Ionicons name="download-outline" size={18} color="#6B4FA2" /> Importer
          </Text>
          <Text style={styles.hint}>Format: "4 Lightning Bolt" ou "4x Éclair"</Text>

          <TextInput
            style={styles.input}
            placeholder={"4 Lightning Bolt\n2 Counterspell\n1 Sol Ring"}
            placeholderTextColor="#555"
            multiline
            value={decklistText}
            onChangeText={setDecklistText}
            textAlignVertical="top"
          />

          <View style={styles.row}>
            <TouchableOpacity style={styles.btnSecondary} onPress={handlePaste}>
              <Ionicons name="clipboard" size={18} color="#6B4FA2" />
              <Text style={styles.btnSecondaryText}>Coller</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.btnPrimary, parsing && styles.disabled]} 
              onPress={handleParseDeckList}
              disabled={parsing}
            >
              {parsing ? <ActivityIndicator color="#FFF" size="small" /> : (
                <>
                  <Ionicons name="search" size={18} color="#FFF" />
                  <Text style={styles.btnPrimaryText}>Analyser</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* Results */}
        {showResults && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Résultats</Text>
            <View style={styles.statsRow}>
              <View style={[styles.stat, {backgroundColor: '#1B3D1B'}]}>
                <Text style={styles.statVal}>{stats.found}</Text>
                <Text style={styles.statLbl}>Trouvées</Text>
              </View>
              <View style={[styles.stat, {backgroundColor: '#3D1B1B'}]}>
                <Text style={styles.statVal}>{stats.notFound}</Text>
                <Text style={styles.statLbl}>Non trouvées</Text>
              </View>
              <View style={styles.stat}>
                <Text style={styles.statVal}>{stats.total}</Text>
                <Text style={styles.statLbl}>Total</Text>
              </View>
            </View>

            <View style={styles.preview}>
              {parsedCards.slice(0, 8).map((c, i) => (
                <View key={i} style={[styles.previewItem, !c.found && styles.previewNotFound]}>
                  <Text style={styles.previewQty}>{c.quantity}x</Text>
                  <Text style={styles.previewName} numberOfLines={1}>
                    {c.cardData?.name || c.name}
                  </Text>
                  <Ionicons 
                    name={c.found ? "checkmark-circle" : "close-circle"} 
                    size={16} 
                    color={c.found ? "#4CAF50" : "#F44336"} 
                  />
                </View>
              ))}
              {parsedCards.length > 8 && (
                <Text style={styles.more}>+{parsedCards.length - 8} autres</Text>
              )}
            </View>

            <TouchableOpacity style={styles.btnPrimary} onPress={() => setShowImportOptions(true)}>
              <Ionicons name="add-circle" size={18} color="#FFF" />
              <Text style={styles.btnPrimaryText}>Importer</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.btnCancel} onPress={resetForm}>
              <Text style={styles.btnCancelText}>Annuler</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Export Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            <Ionicons name="share-outline" size={18} color="#6B4FA2" /> Exporter la collection
          </Text>

          <TouchableOpacity style={styles.exportBtn} onPress={() => handleExport('decklist')}>
            <Ionicons name="document-text" size={22} color="#6B4FA2" />
            <View style={styles.exportInfo}>
              <Text style={styles.exportTitle}>Decklist (MTGO/Arena)</Text>
              <Text style={styles.exportDesc}>Format texte compatible</Text>
            </View>
            <Ionicons name="share-outline" size={20} color="#666" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.exportBtn} onPress={handleCopyDecklist}>
            <Ionicons name="copy" size={22} color="#6B4FA2" />
            <View style={styles.exportInfo}>
              <Text style={styles.exportTitle}>Copier la decklist</Text>
              <Text style={styles.exportDesc}>Dans le presse-papier</Text>
            </View>
            <Ionicons name="clipboard" size={20} color="#666" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.exportBtn} onPress={() => handleExport('csv')}>
            <Ionicons name="grid" size={22} color="#6B4FA2" />
            <View style={styles.exportInfo}>
              <Text style={styles.exportTitle}>CSV (Excel)</Text>
              <Text style={styles.exportDesc}>Tableur avec détails</Text>
            </View>
            <Ionicons name="share-outline" size={20} color="#666" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.exportBtn} onPress={() => handleExport('json')}>
            <Ionicons name="code" size={22} color="#6B4FA2" />
            <View style={styles.exportInfo}>
              <Text style={styles.exportTitle}>JSON (Backup)</Text>
              <Text style={styles.exportDesc}>Sauvegarde complète</Text>
            </View>
            <Ionicons name="share-outline" size={20} color="#666" />
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Import Options Modal */}
      <Modal visible={showImportOptions} transparent animationType="slide">
        <View style={styles.modalBg}>
          <View style={[styles.modal, { paddingBottom: insets.bottom + 20 }]}>
            <Text style={styles.modalTitle}>Comment importer ?</Text>
            
            <TextInput
              style={styles.modalInput}
              placeholder="Nom du deck (optionnel)"
              placeholderTextColor="#666"
              value={deckName}
              onChangeText={setDeckName}
            />

            <TouchableOpacity style={styles.optionBtn} onPress={handleImportToCollection} disabled={importing}>
              <Ionicons name="library" size={24} color="#4CAF50" />
              <View style={styles.optionInfo}>
                <Text style={styles.optionTitle}>Collection uniquement</Text>
                <Text style={styles.optionDesc}>Ajouter les cartes à ma collection</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity style={styles.optionBtn} onPress={handleImportAsDeck} disabled={importing}>
              <Ionicons name="albums" size={24} color="#2196F3" />
              <View style={styles.optionInfo}>
                <Text style={styles.optionTitle}>Deck + Collection</Text>
                <Text style={styles.optionDesc}>Créer un deck ET ajouter à la collection</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity style={styles.optionBtn} onPress={handleImportDeckOnly} disabled={importing}>
              <Ionicons name="layers" size={24} color="#FF9800" />
              <View style={styles.optionInfo}>
                <Text style={styles.optionTitle}>Deck uniquement</Text>
                <Text style={styles.optionDesc}>Créer un deck sans modifier la collection</Text>
              </View>
            </TouchableOpacity>

            {importing && <ActivityIndicator color="#6B4FA2" style={{marginTop: 16}} />}

            <TouchableOpacity style={styles.btnCancel} onPress={() => setShowImportOptions(false)}>
              <Text style={styles.btnCancelText}>Annuler</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#121212' },
  scroll: { padding: 20 },
  title: { fontSize: 28, fontWeight: 'bold', color: '#FFF', marginBottom: 20 },
  section: { backgroundColor: '#1E1E1E', borderRadius: 16, padding: 16, marginBottom: 16 },
  sectionTitle: { fontSize: 16, fontWeight: '600', color: '#FFF', marginBottom: 8 },
  hint: { fontSize: 12, color: '#888', marginBottom: 12 },
  input: { backgroundColor: '#252525', borderRadius: 12, padding: 14, color: '#FFF', fontSize: 14, minHeight: 120, marginBottom: 12 },
  row: { flexDirection: 'row', gap: 10 },
  btnPrimary: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#6B4FA2', borderRadius: 10, padding: 14, gap: 8 },
  btnPrimaryText: { color: '#FFF', fontSize: 15, fontWeight: '600' },
  btnSecondary: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#252525', borderRadius: 10, padding: 14, gap: 6 },
  btnSecondaryText: { color: '#6B4FA2', fontSize: 14 },
  disabled: { opacity: 0.5 },
  statsRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  stat: { flex: 1, backgroundColor: '#252525', borderRadius: 10, padding: 12, alignItems: 'center' },
  statVal: { fontSize: 22, fontWeight: 'bold', color: '#FFF' },
  statLbl: { fontSize: 11, color: '#888', marginTop: 4 },
  preview: { backgroundColor: '#252525', borderRadius: 10, padding: 10, marginBottom: 12 },
  previewItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6 },
  previewNotFound: { opacity: 0.5 },
  previewQty: { color: '#6B4FA2', fontSize: 13, fontWeight: '600', width: 30 },
  previewName: { flex: 1, color: '#FFF', fontSize: 13 },
  more: { color: '#666', fontSize: 12, textAlign: 'center', marginTop: 8 },
  btnCancel: { alignItems: 'center', padding: 12, marginTop: 8 },
  btnCancelText: { color: '#888', fontSize: 14 },
  exportBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#252525', borderRadius: 12, padding: 14, marginBottom: 10 },
  exportInfo: { flex: 1, marginLeft: 12 },
  exportTitle: { color: '#FFF', fontSize: 15, fontWeight: '500' },
  exportDesc: { color: '#888', fontSize: 12, marginTop: 2 },
  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.9)', justifyContent: 'flex-end' },
  modal: { backgroundColor: '#1E1E1E', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20 },
  modalTitle: { fontSize: 20, fontWeight: 'bold', color: '#FFF', marginBottom: 16, textAlign: 'center' },
  modalInput: { backgroundColor: '#252525', borderRadius: 12, padding: 14, color: '#FFF', fontSize: 15, marginBottom: 16 },
  optionBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#252525', borderRadius: 12, padding: 16, marginBottom: 10 },
  optionInfo: { flex: 1, marginLeft: 14 },
  optionTitle: { color: '#FFF', fontSize: 15, fontWeight: '500' },
  optionDesc: { color: '#888', fontSize: 12, marginTop: 2 },
});

export default ImportScreen;
