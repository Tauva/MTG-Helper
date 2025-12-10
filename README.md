# MTG Collection App

Une application mobile React Native / Expo pour gérer votre collection de cartes Magic: The Gathering.

## 🎯 Fonctionnalités

### ✅ Scanner de cartes
- Capture photo avec la caméra
- Recherche manuelle par nom de carte
- Auto-complétion via l'API Scryfall
- Ajout rapide à la collection

### ✅ Gestion de collection
- Ajout de cartes par recherche, scan ou import de decklist
- Vue liste ou grille
- Tri par nom, CMC, rareté, date d'ajout, prix
- Recherche dans la collection
- Statistiques (total de cartes, valeur estimée)

### ✅ Import/Export
- Import de decklists (format standard : "4 Lightning Bolt")
- Export en JSON (backup complet)
- Export en CSV (compatible Excel/Google Sheets)
- Import depuis fichier

### ✅ Gestion de decks
- Création de decks par format (Commander, Standard, Modern, etc.)
- Suggestions EDHREC basées sur votre collection
- Recommandations pour un commandant donné

## 🚀 Installation et Génération de l'APK

### Prérequis

1. **Node.js** (v18 ou supérieur)
2. **npm** ou **yarn**
3. **Compte Expo** (gratuit) : https://expo.dev/signup

### Étapes pour générer l'APK

#### 1. Installer les dépendances

```bash
cd mtg-collection-app
npm install
```

#### 2. Installer EAS CLI globalement

```bash
npm install -g eas-cli
```

#### 3. Se connecter à Expo

```bash
eas login
# Entrez vos identifiants Expo
```

#### 4. Configurer le projet (première fois uniquement)

```bash
eas build:configure
```

Cela va créer/mettre à jour votre `eas.json` et vous demander de confirmer les paramètres.

#### 5. Générer l'APK

Pour un APK de preview (recommandé pour tester) :

```bash
eas build --platform android --profile preview
```

Pour un APK de production :

```bash
eas build --platform android --profile production
```

#### 6. Télécharger l'APK

Une fois la compilation terminée (5-15 minutes), vous recevrez un lien pour télécharger l'APK. Vous pouvez aussi le trouver sur https://expo.dev dans votre dashboard.

### Alternative : Build local

Si vous préférez compiler localement (nécessite Android Studio) :

```bash
# Prebuild pour générer le projet natif
npx expo prebuild

# Ouvrir Android Studio
# Ou compiler en ligne de commande :
cd android
./gradlew assembleRelease
```

L'APK sera dans `android/app/build/outputs/apk/release/`

## 📱 Installation de l'APK

1. Transférez l'APK sur votre téléphone Android
2. Activez "Sources inconnues" dans les paramètres de sécurité
3. Ouvrez le fichier APK pour l'installer

## 🔧 Structure du projet

```
mtg-collection-app/
├── App.js                      # Point d'entrée avec navigation
├── app.json                    # Configuration Expo
├── eas.json                    # Configuration EAS Build
├── package.json
├── assets/                     # Images et icônes
└── src/
    ├── components/
    │   ├── CardItem.js         # Composant carte
    │   └── SearchBar.js        # Barre de recherche
    ├── context/
    │   └── CollectionContext.js # État global de la collection
    ├── screens/
    │   ├── CollectionScreen.js  # Écran principal
    │   ├── SearchScreen.js      # Recherche Scryfall
    │   ├── ScannerScreen.js     # Scanner de cartes
    │   ├── DecksScreen.js       # Gestion des decks
    │   └── ImportScreen.js      # Import/Export
    └── services/
        ├── scryfallApi.js       # API Scryfall
        ├── edhrecApi.js         # API EDHREC
        └── storageService.js    # Stockage local
```

## 🌐 APIs utilisées

### Scryfall API
- Recherche de cartes
- Auto-complétion
- Images des cartes
- Prix
- Informations complètes

Documentation : https://scryfall.com/docs/api

### EDHREC (non-officiel)
- Recommandations de cartes pour Commander
- Statistiques de popularité
- Synergies

Note : EDHREC n'a pas d'API publique officielle. L'intégration utilise leurs endpoints JSON internes.

## 📝 Formats de decklist supportés

```
4 Lightning Bolt
4x Counterspell
2 Sol Ring
1 Black Lotus

// Commentaires ignorés
# Aussi ignorés

Sideboard
2 Negate
```

## 🛠️ Personnalisation

### Changer le thème de couleurs

Modifiez les couleurs dans chaque fichier de style. La couleur principale est `#6B4FA2` (violet).

### Ajouter de nouvelles fonctionnalités

1. Créez un nouveau screen dans `src/screens/`
2. Ajoutez-le à la navigation dans `App.js`
3. Utilisez `useCollection()` pour accéder à la collection

## ⚠️ Limitations connues

1. **Scanner de cartes** : L'OCR automatique n'est pas implémenté. L'utilisateur doit entrer le nom manuellement après la capture. Pour un vrai OCR, il faudrait intégrer un service comme Google Cloud Vision ou Tesseract.

2. **EDHREC** : Comme il n'y a pas d'API officielle, certaines fonctionnalités peuvent cesser de fonctionner si EDHREC modifie leur structure.

3. **Stockage** : Les données sont stockées localement. Si vous désinstallez l'app, utilisez l'export pour sauvegarder.

## 📄 Licence

Ce projet est fourni à titre éducatif. Magic: The Gathering est une marque déposée de Wizards of the Coast.

## 🤝 Contribuer

Les contributions sont bienvenues ! N'hésitez pas à ouvrir des issues ou des pull requests.

---

Développé avec ❤️ pour la communauté Magic: The Gathering


#TODO fix résolution galaxy a24 bouton bare reste en avant 
#TODO Fix scan 