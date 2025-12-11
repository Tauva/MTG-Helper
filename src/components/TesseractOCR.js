import React, { useRef, useCallback, useEffect } from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { WebView } from 'react-native-webview';

/**
 * OCR Component using Tesseract.js in a WebView
 * Optimized for Magic: The Gathering card name detection
 */
const TesseractOCR = ({ imageBase64, onResult, onProgress, onError, visible = true }) => {
  const webViewRef = useRef(null);
  const hasStarted = useRef(false);

  // HTML page with image preprocessing and optimized Tesseract settings
  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
      <script src="https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js"></script>
      <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { 
          background: #1E1E1E; 
          color: white;
          font-family: -apple-system, BlinkMacSystemFont, sans-serif;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          min-height: 100vh;
          padding: 12px;
        }
        .container { width: 100%; max-width: 320px; text-align: center; }
        .preview-container { display: flex; gap: 8px; justify-content: center; margin-bottom: 12px; }
        .preview-box { text-align: center; }
        .preview-label { font-size: 10px; color: #888; margin-bottom: 4px; }
        #preview, #processedPreview { 
          max-width: 100px; 
          max-height: 140px; 
          border-radius: 6px; 
          border: 2px solid #6B4FA2;
        }
        #status { font-size: 13px; color: #AAA; margin-bottom: 6px; }
        #progressContainer { width: 100%; height: 6px; background: #333; border-radius: 3px; overflow: hidden; margin-bottom: 8px; }
        #progressBar { height: 100%; background: linear-gradient(90deg, #6B4FA2, #9B6FD2); width: 0%; transition: width 0.2s ease; }
        #percentage { font-size: 22px; font-weight: bold; color: #6B4FA2; margin-bottom: 4px; }
        .spinner { width: 36px; height: 36px; border: 3px solid #333; border-top-color: #6B4FA2; border-radius: 50%; animation: spin 1s linear infinite; margin: 12px auto; }
        @keyframes spin { to { transform: rotate(360deg); } }
        canvas { display: none; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="preview-container">
          <div class="preview-box">
            <div class="preview-label">Original</div>
            <img id="preview" />
          </div>
          <div class="preview-box">
            <div class="preview-label">Traité</div>
            <img id="processedPreview" />
          </div>
        </div>
        <div class="spinner" id="spinner"></div>
        <div id="progressContainer"><div id="progressBar"></div></div>
        <div id="percentage">0%</div>
        <div id="status">Initialisation...</div>
      </div>
      <canvas id="canvas"></canvas>
      
      <script>
        let isProcessing = false;
        
        function sendToRN(type, data) {
          if (window.ReactNativeWebView) {
            window.ReactNativeWebView.postMessage(JSON.stringify({ type, data }));
          }
        }
        
        function updateProgress(percent) {
          const p = Math.round(percent);
          document.getElementById('progressBar').style.width = p + '%';
          document.getElementById('percentage').innerText = p + '%';
          sendToRN('progress', p);
        }
        
        function updateStatus(text) {
          document.getElementById('status').innerText = text;
        }
        
        function hideSpinner() {
          document.getElementById('spinner').style.display = 'none';
        }
        
        // Preprocess image for better OCR - focus on card name area
        async function preprocessImage(base64Image) {
          return new Promise((resolve) => {
            const img = new Image();
            img.onload = () => {
              const canvas = document.getElementById('canvas');
              const ctx = canvas.getContext('2d');
              
              // Card name is typically in the top 15-20% of the card
              const cropTop = 0.03;  // Start 3% from top
              const cropHeight = 0.12; // Take 12% height (name area)
              
              const sourceY = Math.floor(img.height * cropTop);
              const sourceH = Math.floor(img.height * cropHeight);
              const sourceX = Math.floor(img.width * 0.05); // 5% margin left
              const sourceW = Math.floor(img.width * 0.90); // 90% width
              
              // Scale up for better OCR
              const scale = 3;
              canvas.width = sourceW * scale;
              canvas.height = sourceH * scale;
              
              // Draw cropped and scaled
              ctx.drawImage(img, sourceX, sourceY, sourceW, sourceH, 0, 0, canvas.width, canvas.height);
              
              // Get image data for processing
              const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
              const data = imageData.data;
              
              // Convert to grayscale and increase contrast
              for (let i = 0; i < data.length; i += 4) {
                // Grayscale
                const gray = 0.299 * data[i] + 0.587 * data[i+1] + 0.114 * data[i+2];
                
                // Increase contrast
                let contrasted = ((gray - 128) * 1.8) + 128;
                contrasted = Math.max(0, Math.min(255, contrasted));
                
                // Slight threshold to clean up
                const final = contrasted > 140 ? 255 : (contrasted < 80 ? 0 : contrasted);
                
                data[i] = data[i+1] = data[i+2] = final;
              }
              
              ctx.putImageData(imageData, 0, 0);
              
              // Show processed preview
              document.getElementById('processedPreview').src = canvas.toDataURL('image/png');
              
              resolve(canvas.toDataURL('image/png'));
            };
            img.src = base64Image;
          });
        }
        
        // Clean and extract potential card names from OCR text
        function extractCardNames(text) {
          const lines = text.split(/[\\n\\r]+/)
            .map(line => line.trim())
            .filter(line => line.length > 1);
          
          const potentialNames = [];
          
          for (let line of lines) {
            // Clean the line
            let cleaned = line
              .replace(/[|\\[\\]{}()_=+*#@!<>]/g, '') // Remove special chars
              .replace(/[0-9]{2,}/g, '') // Remove long numbers
              .replace(/\\s+/g, ' ')
              .trim();
            
            // Common OCR mistakes for MTG cards
            cleaned = cleaned
              .replace(/^[Il1|]+\\s+/, '') // Leading I, l, 1, |
              .replace(/\\s+[Il1|]+$/, '') // Trailing
              .replace(/,,/g, ',')
              .replace(/\\.\\./g, '.')
              .trim();
            
            if (cleaned.length < 2 || cleaned.length > 45) continue;
            if (/^[0-9\\/\\+\\-\\s]+$/.test(cleaned)) continue;
            if (/^[WUBRG0-9]+$/.test(cleaned)) continue;
            
            // Skip common non-name patterns
            const skipPatterns = [
              /^(creature|instant|sorcery|enchantment|artifact|land|planeswalker)$/i,
              /^(legendary|tribal|snow|basic)$/i,
              /^(flying|trample|flash|deathtouch|lifelink|vigilance|haste|reach|menace|hexproof|indestructible)$/i,
              /^(tap|untap|draw|discard|destroy|exile|return|add|remove)$/i,
              /^(illus|artist|wizards|coast|tm|magic|the gathering)$/i,
              /^[0-9]+\\/[0-9]+$/, // P/T
              /^\\d{4}$/, // Year
            ];
            
            if (skipPatterns.some(p => p.test(cleaned))) continue;
            
            // Good candidate
            potentialNames.push(cleaned);
          }
          
          return [...new Set(potentialNames)].slice(0, 8);
        }
        
        async function performOCR(base64Image) {
          if (isProcessing) return;
          isProcessing = true;
          
          try {
            updateStatus('Chargement image...');
            updateProgress(5);
            
            // Show original preview
            document.getElementById('preview').src = base64Image;
            hideSpinner();
            
            updateStatus('Prétraitement...');
            updateProgress(10);
            
            // Preprocess - crop to name area and enhance
            const processedImage = await preprocessImage(base64Image);
            
            updateStatus('Analyse OCR...');
            updateProgress(20);
            
            // OCR with optimized settings for card names
            const result = await Tesseract.recognize(
              processedImage,
              'eng',
              {
                logger: m => {
                  if (m.status === 'recognizing text') {
                    const percent = Math.round(25 + (m.progress * 65));
                    updateProgress(percent);
                  }
                }
              }
            );
            
            updateProgress(92);
            updateStatus('Extraction texte...');
            
            const rawText = result.data.text;
            const confidence = result.data.confidence;
            const cardNames = extractCardNames(rawText);
            
            // Also try full image if cropped didn't work well
            let fullImageNames = [];
            if (cardNames.length === 0 || confidence < 40) {
              updateStatus('Analyse complète...');
              const fullResult = await Tesseract.recognize(base64Image, 'eng');
              fullImageNames = extractCardNames(fullResult.data.text);
            }
            
            const allNames = [...new Set([...cardNames, ...fullImageNames])].slice(0, 8);
            
            updateProgress(100);
            updateStatus('Terminé !');
            
            sendToRN('result', {
              success: allNames.length > 0,
              rawText: rawText,
              cardNames: allNames,
              bestGuess: allNames[0] || '',
              confidence: Math.round(confidence)
            });
            
          } catch (error) {
            updateStatus('Erreur: ' + error.message);
            sendToRN('error', { message: error.message });
          } finally {
            isProcessing = false;
          }
        }
        
        function handleMessage(event) {
          try {
            const data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
            if (data.type === 'image' && data.base64) {
              performOCR(data.base64);
            }
          } catch (e) {
            console.error('Message parse error:', e);
          }
        }
        
        window.addEventListener('message', handleMessage);
        document.addEventListener('message', handleMessage);
        
        setTimeout(() => sendToRN('ready', true), 100);
      </script>
    </body>
    </html>
  `;

  const sendImage = useCallback(() => {
    if (imageBase64 && webViewRef.current && !hasStarted.current) {
      hasStarted.current = true;
      setTimeout(() => {
        webViewRef.current?.postMessage(JSON.stringify({
          type: 'image',
          base64: imageBase64
        }));
      }, 500);
    }
  }, [imageBase64]);

  const handleMessage = useCallback((event) => {
    try {
      const message = JSON.parse(event.nativeEvent.data);
      
      switch (message.type) {
        case 'ready':
          sendImage();
          break;
        case 'progress':
          onProgress?.(message.data);
          break;
        case 'result':
          onResult?.(message.data);
          break;
        case 'error':
          onError?.(message.data?.message || 'OCR Error');
          break;
      }
    } catch (error) {
      console.error('WebView message error:', error);
    }
  }, [sendImage, onResult, onProgress, onError]);

  useEffect(() => {
    hasStarted.current = false;
  }, [imageBase64]);

  if (!visible) return null;

  return (
    <View style={styles.container}>
      <WebView
        ref={webViewRef}
        source={{ html: htmlContent }}
        style={styles.webview}
        onMessage={handleMessage}
        onLoad={sendImage}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        originWhitelist={['*']}
        mixedContentMode="always"
        allowFileAccess={true}
        allowUniversalAccessFromFileURLs={true}
        scrollEnabled={false}
        bounces={false}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    height: 260,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#1E1E1E',
    marginBottom: 16,
  },
  webview: {
    flex: 1,
    backgroundColor: 'transparent',
  },
});

export default TesseractOCR;
