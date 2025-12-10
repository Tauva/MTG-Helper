import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Modal,
  Image,
  TextInput,
  ScrollView,
  Dimensions,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { 
  getCardByFuzzyName, 
  searchCardsByName,
  searchCardInAnyLanguage,
  LANGUAGES 
} from '../services/scryfallApi';
import { loadSettings } from '../services/storageService';
import { recognizeCardFromImage } from '../services/ocrService';
import { useCollection } from '../context/CollectionContext';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

const ScannerScreen = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const [permission, requestPermission] = useCameraPermissions();
  const [scanning, setScanning] = useState(false);
  const [foundCard, setFoundCard] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [manualName, setManualName] = useState('');
  const [showManualInput, setShowManualInput] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [processing, setProcessing] = useState(false);
  const [ocrProgress, setOcrProgress] = useState(0);
  const [ocrResults, setOcrResults] = useState(null);
  const [searchLanguage, setSearchLanguage] = useState('fr');
  const cameraRef = useRef(null);
  
  const { addCardToCollection } = useCollection();

  useEffect(() => {
    if (!permission?.granted) {
      requestPermission();
    }
    // Load language preference
    loadSettings().then(settings => {
      if (settings.searchLanguage) {
        setSearchLanguage(settings.searchLanguage);
      }
    });
  }, [permission]);

  const processImageWithOCR = async (imageUri) => {
    setProcessing(true);
    setOcrProgress(0);
    
    try {
      // Crop to top portion of image where card name is
      const manipulated = await ImageManipulator.manipulateAsync(
        imageUri,
        [
          { crop: { originX: 0, originY: 0, width: screenWidth, height: screenHeight * 0.25 } }
        ],
        { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG }
      );
      
      const ocrResult = await recognizeCardFromImage(
        manipulated.uri,
        (progress) => setOcrProgress(progress)
      );
      
      setOcrResults(ocrResult);
      
      if (ocrResult.success && ocrResult.bestGuess) {
        // Try to find the card with the OCR result
        await searchCard(ocrResult.bestGuess);
      } else {
        // Show manual input with OCR suggestions
        setShowManualInput(true);
        if (ocrResult.cardNames.length > 0) {
          setManualName(ocrResult.cardNames[0]);
        }
      }
    } catch (error) {
      console.error('OCR processing error:', error);
      Alert.alert(
        'OCR Error',
        'Could not process image. Please enter the card name manually.',
        [{ text: 'OK', onPress: () => setShowManualInput(true) }]
      );
    } finally {
      setProcessing(false);
      setOcrProgress(0);
    }
  };

  const takePicture = async () => {
    if (!cameraRef.current || scanning) return;
    
    setScanning(true);
    
    try {
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.8,
        base64: false,
      });
      
      await processImageWithOCR(photo.uri);
    } catch (error) {
      console.error('Camera error:', error);
      Alert.alert('Error', 'Failed to capture image');
    } finally {
      setScanning(false);
    }
  };

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      await processImageWithOCR(result.assets[0].uri);
    }
  };

  const searchCard = async (name) => {
    if (!name.trim()) return;
    
    setProcessing(true);
    try {
      // First try fuzzy search with language support
      const card = await getCardByFuzzyName(name, searchLanguage);
      setFoundCard(card);
      setShowModal(true);
      setShowManualInput(false);
      setManualName('');
      setSuggestions([]);
      setOcrResults(null);
    } catch (error) {
      // Try searching in any language as fallback
      try {
        const card = await searchCardInAnyLanguage(name);
        setFoundCard(card);
        setShowModal(true);
        setShowManualInput(false);
        setManualName('');
        setSuggestions([]);
        setOcrResults(null);
      } catch (anyLangError) {
        // Try regular search
        try {
          const results = await searchCardsByName(name, 1, searchLanguage);
          if (results.data && results.data.length > 0) {
            setSuggestions(results.data.slice(0, 5));
            if (!showManualInput) {
              setShowManualInput(true);
              setManualName(name);
            }
          } else {
            Alert.alert('Non trouvé', `Aucune carte trouvée pour "${name}"`);
          }
        } catch (searchError) {
          Alert.alert('Erreur', 'Carte non trouvée. Vérifiez l\'orthographe.');
        }
      }
    } finally {
      setProcessing(false);
    }
  };

  const handleAddCard = async () => {
    if (!foundCard) return;
    
    const success = await addCardToCollection(foundCard, 1);
    if (success) {
      const displayName = foundCard.printed_name || foundCard.name;
      Alert.alert('Ajouté !', `${displayName} ajouté à la collection.`);
      setShowModal(false);
      setFoundCard(null);
    }
  };

  const selectSuggestion = (card) => {
    setFoundCard(card);
    setSuggestions([]);
    setShowModal(true);
    setShowManualInput(false);
    setOcrResults(null);
  };

  if (!permission) {
    return (
      <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        <ActivityIndicator size="large" color="#6B4FA2" />
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        <View style={styles.permissionContainer}>
          <Ionicons name="camera-outline" size={80} color="#888" />
          <Text style={styles.permissionTitle}>Camera Permission Required</Text>
          <Text style={styles.permissionText}>
            We need camera access to scan your Magic cards
          </Text>
          <TouchableOpacity 
            style={styles.permissionButton}
            onPress={requestPermission}
          >
            <Text style={styles.permissionButtonText}>Grant Permission</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.alternativeButton}
            onPress={() => setShowManualInput(true)}
          >
            <Text style={styles.alternativeText}>Or enter card name manually</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <CameraView 
        ref={cameraRef}
        style={styles.camera}
        facing="back"
      >
        <View style={[styles.overlay, { paddingTop: insets.top }]}>
          <View style={styles.header}>
            <Text style={styles.title}>Scanner</Text>
            <TouchableOpacity 
              style={styles.helpButton}
              onPress={() => Alert.alert(
                'Comment scanner',
                '1. Positionnez le nom de la carte dans le cadre\n2. Assurez un bon éclairage\n3. Appuyez sur le bouton de capture\n4. L\'OCR va essayer de lire le nom\n5. Confirmez ou corrigez le nom\n\n💡 Fonctionne en français et anglais !'
              )}
            >
              <Ionicons name="help-circle" size={28} color="#FFF" />
            </TouchableOpacity>
          </View>

          {/* Scan Frame - positioned for card name */}
          <View style={styles.scanAreaContainer}>
            <Text style={styles.scanAreaLabel}>Alignez le nom de la carte ici</Text>
            <View style={styles.scanArea}>
              <View style={styles.cornerTL} />
              <View style={styles.cornerTR} />
              <View style={styles.cornerBL} />
              <View style={styles.cornerBR} />
            </View>
          </View>

          {/* OCR Progress */}
          {processing && (
            <View style={styles.progressContainer}>
              <ActivityIndicator size="large" color="#6B4FA2" />
              <Text style={styles.progressText}>
                {ocrProgress > 0 ? `Processing... ${Math.round(ocrProgress)}%` : 'Capturing...'}
              </Text>
            </View>
          )}

          {/* Controls */}
          <View style={[styles.controls, { paddingBottom: insets.bottom + 20 }]}>
            <TouchableOpacity style={styles.controlButton} onPress={pickImage}>
              <Ionicons name="images" size={24} color="#FFF" />
              <Text style={styles.controlText}>Galerie</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.captureButton, (scanning || processing) && styles.captureButtonDisabled]}
              onPress={takePicture}
              disabled={scanning || processing}
            >
              {scanning || processing ? (
                <ActivityIndicator color="#FFF" size="small" />
              ) : (
                <View style={styles.captureInner} />
              )}
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.controlButton}
              onPress={() => setShowManualInput(true)}
            >
              <Ionicons name="create" size={24} color="#FFF" />
              <Text style={styles.controlText}>Manuel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </CameraView>

      {/* Manual Input Modal */}
      <Modal
        visible={showManualInput}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowManualInput(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.manualInputContainer, { marginBottom: insets.bottom }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {ocrResults ? 'Confirmer le nom' : 'Entrer le nom'}
              </Text>
              <TouchableOpacity onPress={() => {
                setShowManualInput(false);
                setManualName('');
                setSuggestions([]);
                setOcrResults(null);
              }}>
                <Ionicons name="close" size={28} color="#FFF" />
              </TouchableOpacity>
            </View>

            {/* OCR Results Info */}
            {ocrResults && (
              <View style={styles.ocrInfo}>
                <Ionicons name="scan" size={16} color="#6B4FA2" />
                <Text style={styles.ocrInfoText}>
                  OCR détecté : "{ocrResults.bestGuess}" ({Math.round(ocrResults.confidence)}% confiance)
                </Text>
              </View>
            )}

            {/* OCR Alternative Suggestions */}
            {ocrResults && ocrResults.cardNames.length > 1 && (
              <View style={styles.ocrAlternatives}>
                <Text style={styles.ocrAlternativesTitle}>Autres possibilités :</Text>
                <View style={styles.ocrAlternativesRow}>
                  {ocrResults.cardNames.slice(1, 4).map((name, index) => (
                    <TouchableOpacity
                      key={index}
                      style={styles.ocrAlternativeChip}
                      onPress={() => setManualName(name)}
                    >
                      <Text style={styles.ocrAlternativeText}>{name}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}

            <TextInput
              style={styles.textInput}
              placeholder="Nom de la carte (FR ou EN)..."
              placeholderTextColor="#666"
              value={manualName}
              onChangeText={setManualName}
              autoFocus={!ocrResults}
              returnKeyType="search"
              onSubmitEditing={() => searchCard(manualName)}
            />

            <TouchableOpacity 
              style={styles.searchButton}
              onPress={() => searchCard(manualName)}
              disabled={processing}
            >
              {processing ? (
                <ActivityIndicator color="#FFF" />
              ) : (
                <>
                  <Ionicons name="search" size={20} color="#FFF" />
                  <Text style={styles.searchButtonText}>Rechercher</Text>
                </>
              )}
            </TouchableOpacity>

            {suggestions.length > 0 && (
              <ScrollView style={styles.suggestionsContainer}>
                <Text style={styles.suggestionsTitle}>Vouliez-vous dire :</Text>
                {suggestions.map((card) => (
                  <TouchableOpacity
                    key={card.id}
                    style={styles.suggestionItem}
                    onPress={() => selectSuggestion(card)}
                  >
                    <Text style={styles.suggestionName}>{card.name}</Text>
                    <Text style={styles.suggestionSet}>{card.set_name}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      {/* Found Card Modal */}
      <Modal
        visible={showModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.cardModalContent, { marginBottom: insets.bottom }]}>
            <TouchableOpacity 
              style={styles.closeButton}
              onPress={() => {
                setShowModal(false);
                setFoundCard(null);
              }}
            >
              <Ionicons name="close" size={28} color="#FFF" />
            </TouchableOpacity>

            {foundCard && (
              <ScrollView showsVerticalScrollIndicator={false}>
                <Image
                  source={{ 
                    uri: foundCard.image_uris?.normal || 
                         foundCard.card_faces?.[0]?.image_uris?.normal 
                  }}
                  style={styles.cardImage}
                  resizeMode="contain"
                />
                <Text style={styles.cardName}>
                  {foundCard.printed_name || foundCard.name}
                </Text>
                {foundCard.printed_name && foundCard.printed_name !== foundCard.name && (
                  <Text style={styles.cardNameEnglish}>({foundCard.name})</Text>
                )}
                <Text style={styles.cardType}>{foundCard.type_line}</Text>
                <Text style={styles.cardSet}>{foundCard.set_name}</Text>
                
                {foundCard.prices?.usd && (
                  <Text style={styles.cardPrice}>${foundCard.prices.usd}</Text>
                )}

                <TouchableOpacity style={styles.addButton} onPress={handleAddCard}>
                  <Ionicons name="add-circle" size={24} color="#FFF" />
                  <Text style={styles.addButtonText}>Ajouter à la collection</Text>
                </TouchableOpacity>

                <TouchableOpacity 
                  style={styles.scanAnotherButton}
                  onPress={() => {
                    setShowModal(false);
                    setFoundCard(null);
                  }}
                >
                  <Text style={styles.scanAnotherText}>Scanner une autre carte</Text>
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
  camera: {
    flex: 1,
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFF',
  },
  helpButton: {
    padding: 4,
  },
  scanAreaContainer: {
    flex: 1,
    justifyContent: 'flex-start',
    alignItems: 'center',
    paddingTop: 20,
  },
  scanAreaLabel: {
    color: '#FFF',
    fontSize: 14,
    marginBottom: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 4,
  },
  scanArea: {
    width: screenWidth - 64,
    height: 80,
    position: 'relative',
  },
  cornerTL: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: 30,
    height: 30,
    borderLeftWidth: 4,
    borderTopWidth: 4,
    borderColor: '#6B4FA2',
  },
  cornerTR: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 30,
    height: 30,
    borderRightWidth: 4,
    borderTopWidth: 4,
    borderColor: '#6B4FA2',
  },
  cornerBL: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    width: 30,
    height: 30,
    borderLeftWidth: 4,
    borderBottomWidth: 4,
    borderColor: '#6B4FA2',
  },
  cornerBR: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 30,
    height: 30,
    borderRightWidth: 4,
    borderBottomWidth: 4,
    borderColor: '#6B4FA2',
  },
  progressContainer: {
    position: 'absolute',
    top: '40%',
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  progressText: {
    color: '#FFF',
    fontSize: 16,
    marginTop: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  controls: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  controlButton: {
    alignItems: 'center',
    padding: 12,
  },
  controlText: {
    color: '#FFF',
    fontSize: 12,
    marginTop: 4,
  },
  captureButton: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#6B4FA2',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 4,
    borderColor: '#FFF',
  },
  captureButtonDisabled: {
    opacity: 0.5,
  },
  captureInner: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#FFF',
  },
  permissionContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  permissionTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#FFF',
    marginTop: 20,
    marginBottom: 8,
  },
  permissionText: {
    fontSize: 14,
    color: '#888',
    textAlign: 'center',
    marginBottom: 24,
  },
  permissionButton: {
    backgroundColor: '#6B4FA2',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  permissionButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
  alternativeButton: {
    marginTop: 16,
  },
  alternativeText: {
    color: '#6B4FA2',
    fontSize: 14,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    justifyContent: 'flex-end',
  },
  manualInputContainer: {
    backgroundColor: '#1E1E1E',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
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
  ocrInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2A2A2A',
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  ocrInfoText: {
    color: '#AAA',
    fontSize: 13,
    marginLeft: 8,
    flex: 1,
  },
  ocrAlternatives: {
    marginBottom: 12,
  },
  ocrAlternativesTitle: {
    color: '#888',
    fontSize: 12,
    marginBottom: 8,
  },
  ocrAlternativesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  ocrAlternativeChip: {
    backgroundColor: '#3A3A3A',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginRight: 8,
    marginBottom: 8,
  },
  ocrAlternativeText: {
    color: '#FFF',
    fontSize: 12,
  },
  textInput: {
    backgroundColor: '#2A2A2A',
    borderRadius: 12,
    padding: 16,
    color: '#FFF',
    fontSize: 16,
    marginBottom: 16,
  },
  searchButton: {
    backgroundColor: '#6B4FA2',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  suggestionsContainer: {
    marginTop: 16,
    maxHeight: 200,
  },
  suggestionsTitle: {
    color: '#888',
    fontSize: 14,
    marginBottom: 8,
  },
  suggestionItem: {
    backgroundColor: '#2A2A2A',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  suggestionName: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '500',
  },
  suggestionSet: {
    color: '#888',
    fontSize: 12,
    marginTop: 2,
  },
  cardModalContent: {
    backgroundColor: '#1E1E1E',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    maxHeight: '90%',
  },
  closeButton: {
    position: 'absolute',
    top: 10,
    right: 10,
    zIndex: 1,
    padding: 4,
  },
  cardImage: {
    width: '100%',
    height: 350,
    borderRadius: 12,
    marginBottom: 16,
  },
  cardName: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#FFF',
    textAlign: 'center',
    marginBottom: 4,
  },
  cardNameEnglish: {
    fontSize: 14,
    color: '#888',
    textAlign: 'center',
    marginBottom: 4,
    fontStyle: 'italic',
  },
  cardType: {
    fontSize: 14,
    color: '#AAA',
    textAlign: 'center',
    marginBottom: 4,
  },
  cardSet: {
    fontSize: 14,
    color: '#888',
    textAlign: 'center',
    marginBottom: 8,
  },
  cardPrice: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#4CAF50',
    textAlign: 'center',
    marginBottom: 16,
  },
  addButton: {
    backgroundColor: '#4CAF50',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  addButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  scanAnotherButton: {
    padding: 12,
    alignItems: 'center',
  },
  scanAnotherText: {
    color: '#6B4FA2',
    fontSize: 16,
  },
});

export default ScannerScreen;