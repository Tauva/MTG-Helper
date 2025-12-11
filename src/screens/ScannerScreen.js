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
  KeyboardAvoidingView,
  Platform,
  Keyboard,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { 
  getCardByFuzzyName, 
  searchCardsByName,
  searchCardInAnyLanguage,
  getAutocomplete,
} from '../services/scryfallApi';
import { loadSettings } from '../services/storageService';
import { useCollection } from '../context/CollectionContext';
import TesseractOCR from '../components/TesseractOCR';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

const ScannerScreen = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const [permission, requestPermission] = useCameraPermissions();
  const [scanning, setScanning] = useState(false);
  const [foundCard, setFoundCard] = useState(null);
  const [showCardModal, setShowCardModal] = useState(false);
  const [manualName, setManualName] = useState('');
  const [showInputModal, setShowInputModal] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [autocompleteSuggestions, setAutocompleteSuggestions] = useState([]);
  const [processing, setProcessing] = useState(false);
  const [imageBase64, setImageBase64] = useState(null);
  const [searchLanguage, setSearchLanguage] = useState('fr');
  const [ocrProgress, setOcrProgress] = useState(0);
  const [isOcrRunning, setIsOcrRunning] = useState(false);
  const [ocrSuggestions, setOcrSuggestions] = useState([]);
  const [ocrConfidence, setOcrConfidence] = useState(0);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  
  const cameraRef = useRef(null);
  const inputRef = useRef(null);
  const debounceRef = useRef(null);
  
  const { addCardToCollection } = useCollection();

  useEffect(() => {
    if (!permission?.granted) {
      requestPermission();
    }
    loadSettings().then(settings => {
      if (settings?.searchLanguage) {
        setSearchLanguage(settings.searchLanguage);
      }
    });

    // Keyboard listeners for proper positioning
    const keyboardWillShow = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      (e) => setKeyboardHeight(e.endCoordinates.height)
    );
    const keyboardWillHide = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => setKeyboardHeight(0)
    );

    return () => {
      keyboardWillShow.remove();
      keyboardWillHide.remove();
    };
  }, [permission]);

  // Autocomplete handler
  const handleNameChange = (text) => {
    setManualName(text);
    
    if (debounceRef.current) clearTimeout(debounceRef.current);
    
    if (text.length >= 2) {
      debounceRef.current = setTimeout(async () => {
        try {
          const result = await getAutocomplete(text);
          setAutocompleteSuggestions(result.data?.slice(0, 5) || []);
        } catch (e) {
          setAutocompleteSuggestions([]);
        }
      }, 250);
    } else {
      setAutocompleteSuggestions([]);
    }
  };

  // Take picture and start OCR
  const takePicture = async () => {
    if (!cameraRef.current || scanning) return;
    
    setScanning(true);
    
    try {
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.85,
        base64: true,
        skipProcessing: true,
      });
      
      // Start OCR
      setImageBase64(`data:image/jpeg;base64,${photo.base64}`);
      setIsOcrRunning(true);
      setOcrProgress(0);
      setOcrSuggestions([]);
      setOcrConfidence(0);
      setShowInputModal(true);
      
    } catch (error) {
      console.error('Camera error:', error);
      Alert.alert('Erreur', 'Impossible de capturer l\'image');
    } finally {
      setScanning(false);
    }
  };

  // Pick from gallery
  const pickImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.85,
        base64: true,
      });

      if (!result.canceled && result.assets[0]) {
        setImageBase64(`data:image/jpeg;base64,${result.assets[0].base64}`);
        setIsOcrRunning(true);
        setOcrProgress(0);
        setOcrSuggestions([]);
        setOcrConfidence(0);
        setShowInputModal(true);
      }
    } catch (error) {
      console.error('Image picker error:', error);
    }
  };

  // OCR callbacks
  const handleOCRResult = (result) => {
    setIsOcrRunning(false);
    setOcrProgress(100);
    setOcrConfidence(result.confidence || 0);
    
    if (result.success && result.cardNames?.length > 0) {
      setManualName(result.bestGuess || result.cardNames[0]);
      setOcrSuggestions(result.cardNames);
    }
    
    // Focus input after short delay
    setTimeout(() => inputRef.current?.focus(), 400);
  };

  const handleOCRProgress = (progress) => {
    setOcrProgress(progress);
  };

  const handleOCRError = (error) => {
    console.error('OCR Error:', error);
    setIsOcrRunning(false);
    setOcrProgress(0);
    setTimeout(() => inputRef.current?.focus(), 300);
  };

  // Search card
  const searchCard = async (name) => {
    if (!name?.trim()) return;
    
    Keyboard.dismiss();
    setProcessing(true);
    setAutocompleteSuggestions([]);
    
    try {
      // Try fuzzy search first
      const card = await getCardByFuzzyName(name, searchLanguage);
      showFoundCard(card);
    } catch (error) {
      // Try any language
      try {
        const card = await searchCardInAnyLanguage(name);
        showFoundCard(card);
      } catch (e) {
        // Get suggestions
        try {
          const results = await searchCardsByName(name, 1, searchLanguage);
          if (results.data?.length > 0) {
            setSuggestions(results.data.slice(0, 10));
          } else {
            Alert.alert('Non trouvé', `Aucune carte trouvée pour "${name}"`);
          }
        } catch (searchErr) {
          Alert.alert('Erreur', 'Carte non trouvée. Vérifiez l\'orthographe.');
        }
      }
    } finally {
      setProcessing(false);
    }
  };

  const showFoundCard = (card) => {
    setFoundCard(card);
    setShowInputModal(false);
    setShowCardModal(true);
    resetInputState();
  };

  const resetInputState = () => {
    setManualName('');
    setSuggestions([]);
    setAutocompleteSuggestions([]);
    setOcrSuggestions([]);
    setImageBase64(null);
  };

  // Add card to collection
  const handleAddCard = async () => {
    if (!foundCard) return;
    
    const success = await addCardToCollection(foundCard, 1);
    if (success) {
      const displayName = foundCard.printed_name || foundCard.name;
      Alert.alert('Ajouté !', `${displayName} ajouté à la collection.`);
      setShowCardModal(false);
      setFoundCard(null);
    }
  };

  // Selection handlers
  const selectSuggestion = (card) => {
    setFoundCard(card);
    setSuggestions([]);
    setShowInputModal(false);
    setShowCardModal(true);
    resetInputState();
  };

  const selectAutocomplete = (name) => {
    setManualName(name);
    setAutocompleteSuggestions([]);
    searchCard(name);
  };

  const selectOcrSuggestion = (name) => {
    setManualName(name);
  };

  const closeInputModal = () => {
    Keyboard.dismiss();
    setShowInputModal(false);
    setIsOcrRunning(false);
    resetInputState();
    setOcrProgress(0);
    setOcrConfidence(0);
  };

  // Permission states
  if (!permission) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color="#6B4FA2" />
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        <View style={styles.permissionContainer}>
          <Ionicons name="camera-outline" size={80} color="#888" />
          <Text style={styles.permissionTitle}>Accès caméra requis</Text>
          <Text style={styles.permissionText}>
            Nous avons besoin de la caméra pour scanner vos cartes Magic
          </Text>
          <TouchableOpacity style={styles.permissionButton} onPress={requestPermission}>
            <Text style={styles.permissionButtonText}>Autoriser</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.alternativeButton} 
            onPress={() => {
              setShowInputModal(true);
              setTimeout(() => inputRef.current?.focus(), 300);
            }}
          >
            <Text style={styles.alternativeText}>Ou entrer le nom manuellement</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Camera */}
      <CameraView ref={cameraRef} style={styles.camera} facing="back">
        <View style={[styles.overlay, { paddingTop: insets.top }]}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>Scanner</Text>
            <TouchableOpacity 
              style={styles.helpButton}
              onPress={() => Alert.alert(
                'Comment scanner',
                '📷 Photographiez votre carte Magic\n\n🔍 L\'OCR analyse toute la carte et extrait le texte\n\n✏️ Vérifiez/corrigez le nom détecté\n\n✅ Recherchez et ajoutez à la collection\n\n💡 Conseil : Une bonne luminosité améliore la détection !'
              )}
            >
              <Ionicons name="help-circle" size={28} color="#FFF" />
            </TouchableOpacity>
          </View>

          {/* Card Frame */}
          <View style={styles.frameContainer}>
            <View style={styles.cardFrame}>
              <View style={styles.cornerTL} />
              <View style={styles.cornerTR} />
              <View style={styles.cornerBL} />
              <View style={styles.cornerBR} />
            </View>
            <Text style={styles.frameHint}>Cadrez votre carte</Text>
          </View>

          {/* Controls */}
          <View style={[styles.controls, { paddingBottom: Math.max(insets.bottom, 20) + 16 }]}>
            <TouchableOpacity style={styles.controlButton} onPress={pickImage}>
              <View style={styles.controlIconBg}>
                <Ionicons name="images" size={24} color="#FFF" />
              </View>
              <Text style={styles.controlText}>Galerie</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.captureButton, scanning && styles.captureDisabled]}
              onPress={takePicture}
              disabled={scanning}
            >
              {scanning ? (
                <ActivityIndicator color="#FFF" />
              ) : (
                <View style={styles.captureInner} />
              )}
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.controlButton} 
              onPress={() => {
                setShowInputModal(true);
                setTimeout(() => inputRef.current?.focus(), 300);
              }}
            >
              <View style={styles.controlIconBg}>
                <Ionicons name="create" size={24} color="#FFF" />
              </View>
              <Text style={styles.controlText}>Manuel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </CameraView>

      {/* Input Modal */}
      <Modal
        visible={showInputModal}
        animationType="slide"
        transparent={true}
        onRequestClose={closeInputModal}
      >
        <View style={styles.inputModalContainer}>
          {/* Backdrop - tap to dismiss keyboard */}
          <TouchableOpacity 
            style={styles.inputModalBackdrop} 
            activeOpacity={1}
            onPress={Keyboard.dismiss}
          />
          
          {/* Content - positioned above keyboard */}
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={styles.inputModalContent}
            keyboardVerticalOffset={0}
          >
            <View style={[
              styles.inputModalInner,
              { 
                paddingBottom: Platform.OS === 'android' 
                  ? Math.max(insets.bottom, 16) 
                  : Math.max(insets.bottom, 16),
                marginBottom: Platform.OS === 'android' ? keyboardHeight : 0,
              }
            ]}>
              {/* Header */}
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>
                  {isOcrRunning ? 'Analyse OCR...' : 'Rechercher une carte'}
                </Text>
                <TouchableOpacity onPress={closeInputModal} hitSlop={{top:10,bottom:10,left:10,right:10}}>
                  <Ionicons name="close-circle" size={32} color="#666" />
                </TouchableOpacity>
              </View>

              {/* OCR Component */}
              {isOcrRunning && imageBase64 && (
                <TesseractOCR
                  imageBase64={imageBase64}
                  onResult={handleOCRResult}
                  onProgress={handleOCRProgress}
                  onError={handleOCRError}
                  visible={isOcrRunning}
                />
              )}

              {/* After OCR - show results */}
              {!isOcrRunning && (
                <>
                  {/* OCR Confidence badge */}
                  {ocrConfidence > 0 && (
                    <View style={styles.ocrResultBadge}>
                      <Ionicons 
                        name={ocrConfidence > 50 ? "checkmark-circle" : "alert-circle"} 
                        size={18} 
                        color={ocrConfidence > 50 ? "#4CAF50" : "#FF9800"} 
                      />
                      <Text style={styles.ocrResultText}>
                        OCR : {ocrConfidence}% confiance
                      </Text>
                    </View>
                  )}

                  {/* OCR Suggestions chips */}
                  {ocrSuggestions.length > 1 && (
                    <View style={styles.ocrChipsContainer}>
                      <Text style={styles.ocrChipsLabel}>Texte détecté :</Text>
                      <ScrollView 
                        horizontal 
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={styles.ocrChipsScroll}
                      >
                        {ocrSuggestions.slice(0, 6).map((text, i) => (
                          <TouchableOpacity
                            key={i}
                            style={[
                              styles.ocrChip,
                              manualName === text && styles.ocrChipActive
                            ]}
                            onPress={() => selectOcrSuggestion(text)}
                          >
                            <Text style={[
                              styles.ocrChipText,
                              manualName === text && styles.ocrChipTextActive
                            ]}>{text}</Text>
                          </TouchableOpacity>
                        ))}
                      </ScrollView>
                    </View>
                  )}

                  {/* Search Input */}
                  <View style={styles.searchInputContainer}>
                    <Ionicons name="search" size={20} color="#888" />
                    <TextInput
                      ref={inputRef}
                      style={styles.searchInput}
                      placeholder="Nom de la carte (FR ou EN)..."
                      placeholderTextColor="#666"
                      value={manualName}
                      onChangeText={handleNameChange}
                      returnKeyType="search"
                      onSubmitEditing={() => searchCard(manualName)}
                      autoCapitalize="none"
                      autoCorrect={false}
                    />
                    {manualName.length > 0 && (
                      <TouchableOpacity onPress={() => { setManualName(''); setAutocompleteSuggestions([]); }}>
                        <Ionicons name="close-circle" size={20} color="#888" />
                      </TouchableOpacity>
                    )}
                  </View>

                  {/* Autocomplete dropdown */}
                  {autocompleteSuggestions.length > 0 && (
                    <View style={styles.autocompleteList}>
                      {autocompleteSuggestions.map((name, i) => (
                        <TouchableOpacity
                          key={i}
                          style={styles.autocompleteItem}
                          onPress={() => selectAutocomplete(name)}
                        >
                          <Ionicons name="return-down-forward" size={16} color="#6B4FA2" />
                          <Text style={styles.autocompleteText}>{name}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}

                  {/* Search Button */}
                  <TouchableOpacity 
                    style={[styles.searchButton, (!manualName.trim() || processing) && styles.searchButtonDisabled]}
                    onPress={() => searchCard(manualName)}
                    disabled={processing || !manualName.trim()}
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

                  {/* Search Results */}
                  {suggestions.length > 0 && (
                    <View style={styles.resultsContainer}>
                      <Text style={styles.resultsTitle}>Résultats ({suggestions.length})</Text>
                      <ScrollView 
                        style={styles.resultsList}
                        keyboardShouldPersistTaps="handled"
                        showsVerticalScrollIndicator={true}
                      >
                        {suggestions.map((card) => (
                          <TouchableOpacity
                            key={card.id}
                            style={styles.resultItem}
                            onPress={() => selectSuggestion(card)}
                          >
                            <View style={styles.resultInfo}>
                              <Text style={styles.resultName} numberOfLines={1}>
                                {card.printed_name || card.name}
                              </Text>
                              {card.printed_name && card.printed_name !== card.name && (
                                <Text style={styles.resultNameEn} numberOfLines={1}>
                                  {card.name}
                                </Text>
                              )}
                              <Text style={styles.resultSet} numberOfLines={1}>
                                {card.set_name}
                              </Text>
                            </View>
                            <Ionicons name="chevron-forward" size={20} color="#666" />
                          </TouchableOpacity>
                        ))}
                      </ScrollView>
                    </View>
                  )}
                </>
              )}
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      {/* Found Card Modal */}
      <Modal
        visible={showCardModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => { setShowCardModal(false); setFoundCard(null); }}
      >
        <View style={styles.cardModalOverlay}>
          <View style={[styles.cardModalContent, { paddingBottom: Math.max(insets.bottom, 16) }]}>
            <TouchableOpacity 
              style={styles.cardModalClose}
              onPress={() => { setShowCardModal(false); setFoundCard(null); }}
            >
              <Ionicons name="close-circle" size={36} color="#666" />
            </TouchableOpacity>

            {foundCard && (
              <ScrollView showsVerticalScrollIndicator={false} bounces={false}>
                <Image
                  source={{ 
                    uri: foundCard.image_uris?.normal || foundCard.card_faces?.[0]?.image_uris?.normal 
                  }}
                  style={styles.cardImage}
                  resizeMode="contain"
                />
                <Text style={styles.cardName}>
                  {foundCard.printed_name || foundCard.name}
                </Text>
                {foundCard.printed_name && foundCard.printed_name !== foundCard.name && (
                  <Text style={styles.cardNameEn}>({foundCard.name})</Text>
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
                  style={styles.scanAgainButton}
                  onPress={() => { setShowCardModal(false); setFoundCard(null); }}
                >
                  <Text style={styles.scanAgainText}>Scanner une autre carte</Text>
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
  container: { flex: 1, backgroundColor: '#121212' },
  camera: { flex: 1 },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)' },
  
  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  title: { fontSize: 26, fontWeight: 'bold', color: '#FFF' },
  helpButton: { padding: 4 },
  
  // Frame
  frameContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  cardFrame: {
    width: screenWidth * 0.82,
    height: screenWidth * 0.82 * 1.4,
    position: 'relative',
  },
  cornerTL: { position: 'absolute', top: 0, left: 0, width: 36, height: 36, borderLeftWidth: 4, borderTopWidth: 4, borderColor: '#6B4FA2', borderTopLeftRadius: 10 },
  cornerTR: { position: 'absolute', top: 0, right: 0, width: 36, height: 36, borderRightWidth: 4, borderTopWidth: 4, borderColor: '#6B4FA2', borderTopRightRadius: 10 },
  cornerBL: { position: 'absolute', bottom: 0, left: 0, width: 36, height: 36, borderLeftWidth: 4, borderBottomWidth: 4, borderColor: '#6B4FA2', borderBottomLeftRadius: 10 },
  cornerBR: { position: 'absolute', bottom: 0, right: 0, width: 36, height: 36, borderRightWidth: 4, borderBottomWidth: 4, borderColor: '#6B4FA2', borderBottomRightRadius: 10 },
  frameHint: { color: '#FFF', fontSize: 15, marginTop: 20, backgroundColor: 'rgba(0,0,0,0.6)', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 25 },
  
  // Controls
  controls: { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center', paddingHorizontal: 16 },
  controlButton: { alignItems: 'center' },
  controlIconBg: { width: 52, height: 52, borderRadius: 26, backgroundColor: 'rgba(255,255,255,0.15)', justifyContent: 'center', alignItems: 'center' },
  controlText: { color: '#FFF', fontSize: 12, marginTop: 6 },
  captureButton: { width: 76, height: 76, borderRadius: 38, backgroundColor: '#6B4FA2', justifyContent: 'center', alignItems: 'center', borderWidth: 4, borderColor: '#FFF' },
  captureDisabled: { opacity: 0.5 },
  captureInner: { width: 60, height: 60, borderRadius: 30, backgroundColor: '#FFF' },
  
  // Permission
  permissionContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 32 },
  permissionTitle: { fontSize: 22, fontWeight: 'bold', color: '#FFF', marginTop: 20, marginBottom: 10 },
  permissionText: { fontSize: 14, color: '#888', textAlign: 'center', marginBottom: 24, lineHeight: 20 },
  permissionButton: { backgroundColor: '#6B4FA2', paddingHorizontal: 28, paddingVertical: 14, borderRadius: 10 },
  permissionButtonText: { color: '#FFF', fontSize: 16, fontWeight: '600' },
  alternativeButton: { marginTop: 20 },
  alternativeText: { color: '#6B4FA2', fontSize: 14 },
  
  // Input Modal
  inputModalContainer: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)' },
  inputModalBackdrop: { flex: 1 },
  inputModalContent: { justifyContent: 'flex-end' },
  inputModalInner: { backgroundColor: '#1A1A1A', borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 20, maxHeight: screenHeight * 0.85 },
  
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  modalTitle: { fontSize: 20, fontWeight: '700', color: '#FFF' },
  
  // OCR Result
  ocrResultBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#252525', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, alignSelf: 'flex-start', marginBottom: 12 },
  ocrResultText: { color: '#CCC', fontSize: 13, marginLeft: 6 },
  
  // OCR Chips
  ocrChipsContainer: { marginBottom: 14 },
  ocrChipsLabel: { color: '#888', fontSize: 12, marginBottom: 8 },
  ocrChipsScroll: { paddingRight: 20 },
  ocrChip: { backgroundColor: '#2A2A2A', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 18, marginRight: 8, borderWidth: 1, borderColor: '#3A3A3A' },
  ocrChipActive: { backgroundColor: '#6B4FA2', borderColor: '#6B4FA2' },
  ocrChipText: { color: '#DDD', fontSize: 13 },
  ocrChipTextActive: { color: '#FFF', fontWeight: '600' },
  
  // Search Input
  searchInputContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#252525', borderRadius: 14, paddingHorizontal: 14, height: 52, marginBottom: 12 },
  searchInput: { flex: 1, color: '#FFF', fontSize: 16, marginLeft: 10, marginRight: 10 },
  
  // Autocomplete
  autocompleteList: { backgroundColor: '#252525', borderRadius: 12, marginBottom: 12, overflow: 'hidden' },
  autocompleteItem: { flexDirection: 'row', alignItems: 'center', padding: 14, borderBottomWidth: 1, borderBottomColor: '#333' },
  autocompleteText: { color: '#FFF', fontSize: 15, marginLeft: 10 },
  
  // Search Button
  searchButton: { backgroundColor: '#6B4FA2', borderRadius: 14, height: 52, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
  searchButtonDisabled: { opacity: 0.4 },
  searchButtonText: { color: '#FFF', fontSize: 16, fontWeight: '600', marginLeft: 8 },
  
  // Results
  resultsContainer: { marginTop: 4 },
  resultsTitle: { color: '#888', fontSize: 13, marginBottom: 10 },
  resultsList: { maxHeight: 220 },
  resultItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#252525', padding: 14, borderRadius: 12, marginBottom: 8 },
  resultInfo: { flex: 1 },
  resultName: { color: '#FFF', fontSize: 15, fontWeight: '500' },
  resultNameEn: { color: '#888', fontSize: 12, fontStyle: 'italic', marginTop: 2 },
  resultSet: { color: '#666', fontSize: 12, marginTop: 4 },
  
  // Card Modal
  cardModalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.95)', justifyContent: 'flex-end' },
  cardModalContent: { backgroundColor: '#1A1A1A', borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 20, maxHeight: '92%' },
  cardModalClose: { position: 'absolute', top: 12, right: 12, zIndex: 10 },
  cardImage: { width: '100%', height: 340, borderRadius: 14, marginTop: 24, marginBottom: 16, backgroundColor: '#252525' },
  cardName: { fontSize: 24, fontWeight: 'bold', color: '#FFF', textAlign: 'center' },
  cardNameEn: { fontSize: 14, color: '#888', textAlign: 'center', fontStyle: 'italic', marginTop: 4 },
  cardType: { fontSize: 14, color: '#AAA', textAlign: 'center', marginTop: 6 },
  cardSet: { fontSize: 13, color: '#666', textAlign: 'center', marginTop: 4 },
  cardPrice: { fontSize: 20, fontWeight: 'bold', color: '#4CAF50', textAlign: 'center', marginTop: 12 },
  addButton: { backgroundColor: '#4CAF50', borderRadius: 14, height: 54, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: 20 },
  addButtonText: { color: '#FFF', fontSize: 17, fontWeight: '600', marginLeft: 10 },
  scanAgainButton: { padding: 16, alignItems: 'center' },
  scanAgainText: { color: '#6B4FA2', fontSize: 15 },
});

export default ScannerScreen;
