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
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { getCardByFuzzyName, searchCardsByName } from '../services/scryfallApi';
import { useCollection } from '../context/CollectionContext';

const ScannerScreen = ({ navigation }) => {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanning, setScanning] = useState(false);
  const [foundCard, setFoundCard] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [manualName, setManualName] = useState('');
  const [showManualInput, setShowManualInput] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [processing, setProcessing] = useState(false);
  const cameraRef = useRef(null);
  
  const { addCardToCollection } = useCollection();

  useEffect(() => {
    if (!permission?.granted) {
      requestPermission();
    }
  }, [permission]);

  const takePicture = async () => {
    if (!cameraRef.current || scanning) return;
    
    setScanning(true);
    setProcessing(true);
    
    try {
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.8,
        base64: false,
      });
      
      Alert.alert(
        'Card Captured',
        'Automatic card recognition is limited. Please enter the card name manually or try searching.',
        [
          {
            text: 'Enter Name',
            onPress: () => setShowManualInput(true),
          },
          {
            text: 'Search Instead',
            onPress: () => navigation.navigate('Search'),
          },
        ]
      );
    } catch (error) {
      console.error('Camera error:', error);
      Alert.alert('Error', 'Failed to capture image');
    } finally {
      setScanning(false);
      setProcessing(false);
    }
  };

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
    });

    if (!result.canceled) {
      setShowManualInput(true);
    }
  };

  const searchCard = async (name) => {
    if (!name.trim()) return;
    
    setProcessing(true);
    try {
      const card = await getCardByFuzzyName(name);
      setFoundCard(card);
      setShowModal(true);
      setShowManualInput(false);
      setManualName('');
    } catch (error) {
      try {
        const results = await searchCardsByName(name);
        if (results.data && results.data.length > 0) {
          setSuggestions(results.data.slice(0, 5));
        } else {
          Alert.alert('Not Found', `No cards found matching "${name}"`);
        }
      } catch (searchError) {
        Alert.alert('Error', 'Card not found. Please check the spelling.');
      }
    } finally {
      setProcessing(false);
    }
  };

  const handleAddCard = async () => {
    if (!foundCard) return;
    
    const success = await addCardToCollection(foundCard, 1);
    if (success) {
      Alert.alert('Added!', `${foundCard.name} added to collection.`);
      setShowModal(false);
      setFoundCard(null);
    }
  };

  const selectSuggestion = (card) => {
    setFoundCard(card);
    setSuggestions([]);
    setShowModal(true);
    setShowManualInput(false);
  };

  if (!permission) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#6B4FA2" />
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.container}>
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
        <View style={styles.overlay}>
          <View style={styles.header}>
            <Text style={styles.title}>Scan Card</Text>
            <TouchableOpacity 
              style={styles.helpButton}
              onPress={() => Alert.alert(
                'How to Scan',
                '1. Position the card within the frame\n2. Ensure good lighting\n3. Tap the capture button\n4. Enter the card name if needed'
              )}
            >
              <Ionicons name="help-circle" size={28} color="#FFF" />
            </TouchableOpacity>
          </View>

          <View style={styles.scanArea}>
            <View style={styles.cornerTL} />
            <View style={styles.cornerTR} />
            <View style={styles.cornerBL} />
            <View style={styles.cornerBR} />
            <Text style={styles.scanHint}>Position card here</Text>
          </View>

          <View style={styles.controls}>
            <TouchableOpacity style={styles.controlButton} onPress={pickImage}>
              <Ionicons name="images" size={24} color="#FFF" />
              <Text style={styles.controlText}>Gallery</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.captureButton, scanning && styles.captureButtonDisabled]}
              onPress={takePicture}
              disabled={scanning}
            >
              {processing ? (
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
              <Text style={styles.controlText}>Manual</Text>
            </TouchableOpacity>
          </View>
        </View>
      </CameraView>

      <Modal
        visible={showManualInput}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowManualInput(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.manualInputContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Enter Card Name</Text>
              <TouchableOpacity onPress={() => {
                setShowManualInput(false);
                setManualName('');
                setSuggestions([]);
              }}>
                <Ionicons name="close" size={28} color="#FFF" />
              </TouchableOpacity>
            </View>

            <TextInput
              style={styles.textInput}
              placeholder="Card name..."
              placeholderTextColor="#666"
              value={manualName}
              onChangeText={setManualName}
              autoFocus
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
                  <Text style={styles.searchButtonText}>Search</Text>
                </>
              )}
            </TouchableOpacity>

            {suggestions.length > 0 && (
              <ScrollView style={styles.suggestionsContainer}>
                <Text style={styles.suggestionsTitle}>Did you mean:</Text>
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

      <Modal
        visible={showModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.cardModalContent}>
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
                <Text style={styles.cardName}>{foundCard.name}</Text>
                <Text style={styles.cardType}>{foundCard.type_line}</Text>
                <Text style={styles.cardSet}>{foundCard.set_name}</Text>
                
                {foundCard.prices?.usd && (
                  <Text style={styles.cardPrice}>${foundCard.prices.usd}</Text>
                )}

                <TouchableOpacity style={styles.addButton} onPress={handleAddCard}>
                  <Ionicons name="add-circle" size={24} color="#FFF" />
                  <Text style={styles.addButtonText}>Add to Collection</Text>
                </TouchableOpacity>

                <TouchableOpacity 
                  style={styles.scanAnotherButton}
                  onPress={() => {
                    setShowModal(false);
                    setFoundCard(null);
                  }}
                >
                  <Text style={styles.scanAnotherText}>Scan Another</Text>
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
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    paddingTop: 48,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFF',
  },
  helpButton: {
    padding: 4,
  },
  scanArea: {
    flex: 1,
    marginHorizontal: 32,
    marginVertical: 48,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  cornerTL: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: 40,
    height: 40,
    borderLeftWidth: 4,
    borderTopWidth: 4,
    borderColor: '#6B4FA2',
  },
  cornerTR: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 40,
    height: 40,
    borderRightWidth: 4,
    borderTopWidth: 4,
    borderColor: '#6B4FA2',
  },
  cornerBL: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    width: 40,
    height: 40,
    borderLeftWidth: 4,
    borderBottomWidth: 4,
    borderColor: '#6B4FA2',
  },
  cornerBR: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 40,
    height: 40,
    borderRightWidth: 4,
    borderBottomWidth: 4,
    borderColor: '#6B4FA2',
  },
  scanHint: {
    color: '#FFF',
    fontSize: 16,
    textAlign: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  controls: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingBottom: 48,
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
    justifyContent: 'center',
  },
  manualInputContainer: {
    backgroundColor: '#1E1E1E',
    marginHorizontal: 16,
    borderRadius: 16,
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
    marginHorizontal: 16,
    borderRadius: 16,
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
