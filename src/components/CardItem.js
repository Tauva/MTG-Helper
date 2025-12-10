import React, { useState } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ScrollView,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const { width: screenWidth } = Dimensions.get('window');

const CardItem = ({ 
  card, 
  onPress, 
  onAddToCollection, 
  onRemoveFromCollection,
  showQuantity = false,
  quantity = 0,
  compact = false,
}) => {
  const [modalVisible, setModalVisible] = useState(false);
  const [imageError, setImageError] = useState(false);

  const imageUrl = card.imageUrl || 
    card.image_uris?.normal || 
    card.card_faces?.[0]?.image_uris?.normal ||
    card.imageUrlSmall ||
    card.image_uris?.small;

  const handlePress = () => {
    if (onPress) {
      onPress(card);
    } else {
      setModalVisible(true);
    }
  };

  const renderManaSymbols = (manaCost) => {
    if (!manaCost) return null;
    
    const symbols = manaCost.match(/\{[^}]+\}/g) || [];
    const colorMap = {
      'W': '#F8E7B9',
      'U': '#0E68AB',
      'B': '#150B00',
      'R': '#D3202A',
      'G': '#00733E',
      'C': '#CAC5C0',
    };

    return (
      <View style={styles.manaContainer}>
        {symbols.map((symbol, index) => {
          const inner = symbol.replace(/[{}]/g, '');
          const isNumeric = /^\d+$/.test(inner);
          const color = colorMap[inner] || '#888';
          
          return (
            <View 
              key={index} 
              style={[
                styles.manaSymbol, 
                { backgroundColor: isNumeric ? '#CAC5C0' : color }
              ]}
            >
              <Text style={[
                styles.manaText,
                { color: inner === 'B' ? '#FFF' : '#000' }
              ]}>
                {inner}
              </Text>
            </View>
          );
        })}
      </View>
    );
  };

  const getRarityColor = (rarity) => {
    switch (rarity) {
      case 'common': return '#1A1718';
      case 'uncommon': return '#707883';
      case 'rare': return '#A58E4A';
      case 'mythic': return '#BF4427';
      default: return '#666';
    }
  };

  if (compact) {
    return (
      <TouchableOpacity style={styles.compactCard} onPress={handlePress}>
        {imageUrl && !imageError ? (
          <Image
            source={{ uri: imageUrl }}
            style={styles.compactImage}
            onError={() => setImageError(true)}
            resizeMode="cover"
          />
        ) : (
          <View style={[styles.compactImage, styles.placeholderImage]}>
            <Ionicons name="image-outline" size={30} color="#666" />
          </View>
        )}
        {showQuantity && quantity > 0 && (
          <View style={styles.quantityBadge}>
            <Text style={styles.quantityText}>{quantity}</Text>
          </View>
        )}
      </TouchableOpacity>
    );
  }

  return (
    <>
      <TouchableOpacity style={styles.card} onPress={handlePress}>
        <View style={styles.cardContent}>
          {imageUrl && !imageError ? (
            <Image
              source={{ uri: imageUrl }}
              style={styles.cardImage}
              onError={() => setImageError(true)}
              resizeMode="contain"
            />
          ) : (
            <View style={[styles.cardImage, styles.placeholderImage]}>
              <Ionicons name="image-outline" size={40} color="#666" />
            </View>
          )}
          <View style={styles.cardInfo}>
            <Text style={styles.cardName} numberOfLines={2}>
              {card.name}
            </Text>
            {renderManaSymbols(card.manaCost || card.mana_cost)}
            <Text style={styles.typeLine} numberOfLines={1}>
              {card.typeLine || card.type_line}
            </Text>
            <View style={styles.cardMeta}>
              <Text style={[styles.rarity, { color: getRarityColor(card.rarity) }]}>
                {card.rarity?.charAt(0).toUpperCase() + card.rarity?.slice(1)}
              </Text>
              <Text style={styles.setName}>
                {card.setName || card.set_name}
              </Text>
            </View>
            {card.prices?.usd && (
              <Text style={styles.price}>${card.prices.usd}</Text>
            )}
            {showQuantity && (
              <View style={styles.quantityContainer}>
                <Text style={styles.quantityLabel}>Owned: </Text>
                <Text style={styles.quantityValue}>{quantity}</Text>
              </View>
            )}
          </View>
        </View>
        <View style={styles.cardActions}>
          {onAddToCollection && (
            <TouchableOpacity 
              style={styles.actionButton}
              onPress={() => onAddToCollection(card)}
            >
              <Ionicons name="add-circle" size={28} color="#4CAF50" />
            </TouchableOpacity>
          )}
          {onRemoveFromCollection && quantity > 0 && (
            <TouchableOpacity 
              style={styles.actionButton}
              onPress={() => onRemoveFromCollection(card.id || card.scryfallId)}
            >
              <Ionicons name="remove-circle" size={28} color="#F44336" />
            </TouchableOpacity>
          )}
        </View>
      </TouchableOpacity>

      {/* Card Detail Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <TouchableOpacity 
              style={styles.closeButton}
              onPress={() => setModalVisible(false)}
            >
              <Ionicons name="close" size={28} color="#FFF" />
            </TouchableOpacity>
            <ScrollView showsVerticalScrollIndicator={false}>
              {imageUrl && (
                <Image
                  source={{ uri: imageUrl }}
                  style={styles.modalImage}
                  resizeMode="contain"
                />
              )}
              <Text style={styles.modalTitle}>{card.name}</Text>
              {renderManaSymbols(card.manaCost || card.mana_cost)}
              <Text style={styles.modalType}>
                {card.typeLine || card.type_line}
              </Text>
              {(card.oracleText || card.oracle_text) && (
                <Text style={styles.modalOracle}>
                  {card.oracleText || card.oracle_text}
                </Text>
              )}
              <View style={styles.modalMeta}>
                <Text style={styles.modalMetaItem}>
                  Set: {card.setName || card.set_name}
                </Text>
                <Text style={styles.modalMetaItem}>
                  Rarity: {card.rarity}
                </Text>
                {card.prices && (
                  <>
                    {card.prices.usd && (
                      <Text style={styles.modalMetaItem}>
                        USD: ${card.prices.usd}
                      </Text>
                    )}
                    {card.prices.usd_foil && (
                      <Text style={styles.modalMetaItem}>
                        Foil: ${card.prices.usd_foil}
                      </Text>
                    )}
                  </>
                )}
              </View>
              <View style={styles.modalActions}>
                {onAddToCollection && (
                  <TouchableOpacity 
                    style={[styles.modalButton, styles.addButton]}
                    onPress={() => {
                      onAddToCollection(card);
                      setModalVisible(false);
                    }}
                  >
                    <Ionicons name="add" size={20} color="#FFF" />
                    <Text style={styles.modalButtonText}>Add to Collection</Text>
                  </TouchableOpacity>
                )}
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#2A2A2A',
    borderRadius: 12,
    marginHorizontal: 16,
    marginVertical: 8,
    flexDirection: 'row',
    overflow: 'hidden',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  cardContent: {
    flex: 1,
    flexDirection: 'row',
    padding: 12,
  },
  cardImage: {
    width: 80,
    height: 112,
    borderRadius: 6,
  },
  placeholderImage: {
    backgroundColor: '#444',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardInfo: {
    flex: 1,
    marginLeft: 12,
    justifyContent: 'center',
  },
  cardName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFF',
    marginBottom: 4,
  },
  manaContainer: {
    flexDirection: 'row',
    marginVertical: 4,
    flexWrap: 'wrap',
  },
  manaSymbol: {
    width: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 2,
    marginBottom: 2,
  },
  manaText: {
    fontSize: 11,
    fontWeight: 'bold',
  },
  typeLine: {
    fontSize: 12,
    color: '#AAA',
    marginBottom: 4,
  },
  cardMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  rarity: {
    fontSize: 12,
    fontWeight: '600',
  },
  setName: {
    fontSize: 11,
    color: '#888',
    flex: 1,
    textAlign: 'right',
  },
  price: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#4CAF50',
    marginTop: 4,
  },
  quantityContainer: {
    flexDirection: 'row',
    marginTop: 4,
  },
  quantityLabel: {
    fontSize: 12,
    color: '#888',
  },
  quantityValue: {
    fontSize: 12,
    color: '#FFF',
    fontWeight: 'bold',
  },
  cardActions: {
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  actionButton: {
    padding: 4,
  },
  compactCard: {
    width: (screenWidth - 48) / 3,
    aspectRatio: 0.715,
    margin: 4,
    borderRadius: 8,
    overflow: 'hidden',
    elevation: 2,
  },
  compactImage: {
    width: '100%',
    height: '100%',
  },
  quantityBadge: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    backgroundColor: '#4CAF50',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  quantityText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: 'bold',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: screenWidth - 32,
    maxHeight: '90%',
    backgroundColor: '#1E1E1E',
    borderRadius: 16,
    padding: 20,
  },
  closeButton: {
    position: 'absolute',
    top: 10,
    right: 10,
    zIndex: 1,
    padding: 4,
  },
  modalImage: {
    width: '100%',
    height: 350,
    borderRadius: 12,
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFF',
    marginBottom: 8,
    textAlign: 'center',
  },
  modalType: {
    fontSize: 16,
    color: '#AAA',
    marginBottom: 12,
    textAlign: 'center',
  },
  modalOracle: {
    fontSize: 14,
    color: '#DDD',
    lineHeight: 20,
    marginBottom: 16,
    padding: 12,
    backgroundColor: '#2A2A2A',
    borderRadius: 8,
  },
  modalMeta: {
    marginBottom: 16,
  },
  modalMetaItem: {
    fontSize: 14,
    color: '#AAA',
    marginBottom: 4,
  },
  modalActions: {
    marginTop: 8,
  },
  modalButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  addButton: {
    backgroundColor: '#4CAF50',
  },
  modalButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
});

export default CardItem;
