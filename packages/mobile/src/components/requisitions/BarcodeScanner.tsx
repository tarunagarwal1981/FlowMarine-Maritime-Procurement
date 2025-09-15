import React, {useState, useEffect} from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Modal,
  Dimensions,
} from 'react-native';
import QRCodeScanner from 'react-native-qrcode-scanner';
import {BarcodeMask} from 'react-native-barcode-mask';
import Icon from 'react-native-vector-icons/MaterialIcons';
import {check, request, PERMISSIONS, RESULTS} from 'react-native-permissions';

interface BarcodeScannerProps {
  onScan: (data: string) => void;
  onClose: () => void;
}

const {width, height} = Dimensions.get('window');

const BarcodeScanner: React.FC<BarcodeScannerProps> = ({onScan, onClose}) => {
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [isScanning, setIsScanning] = useState(true);
  const [flashOn, setFlashOn] = useState(false);

  useEffect(() => {
    checkCameraPermission();
  }, []);

  const checkCameraPermission = async () => {
    try {
      const result = await check(PERMISSIONS.ANDROID.CAMERA);
      
      if (result === RESULTS.GRANTED) {
        setHasPermission(true);
      } else if (result === RESULTS.DENIED) {
        const requestResult = await request(PERMISSIONS.ANDROID.CAMERA);
        setHasPermission(requestResult === RESULTS.GRANTED);
      } else {
        setHasPermission(false);
      }
    } catch (error) {
      console.error('Camera permission error:', error);
      setHasPermission(false);
    }
  };

  const handleBarCodeScanned = (e: any) => {
    if (!isScanning) return;

    setIsScanning(false);
    
    // Validate the scanned data
    const scannedData = e.data.trim();
    
    if (scannedData) {
      onScan(scannedData);
    } else {
      Alert.alert(
        'Invalid Code',
        'The scanned code appears to be invalid. Please try again.',
        [
          {
            text: 'Try Again',
            onPress: () => setIsScanning(true),
          },
          {
            text: 'Cancel',
            onPress: onClose,
          },
        ]
      );
    }
  };

  const toggleFlash = () => {
    setFlashOn(!flashOn);
  };

  const handleManualEntry = () => {
    Alert.prompt(
      'Manual Entry',
      'Enter the barcode, IMPA code, or ISSA code manually:',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'OK',
          onPress: (text) => {
            if (text && text.trim()) {
              onScan(text.trim());
            }
          },
        },
      ],
      'plain-text'
    );
  };

  if (hasPermission === null) {
    return (
      <Modal visible={true} transparent animationType="slide">
        <View style={styles.permissionContainer}>
          <Text style={styles.permissionText}>Requesting camera permission...</Text>
        </View>
      </Modal>
    );
  }

  if (hasPermission === false) {
    return (
      <Modal visible={true} transparent animationType="slide">
        <View style={styles.permissionContainer}>
          <Icon name="camera-alt" size={64} color="#6b7280" />
          <Text style={styles.permissionTitle}>Camera Permission Required</Text>
          <Text style={styles.permissionText}>
            Please grant camera permission to scan barcodes and QR codes.
          </Text>
          <View style={styles.permissionButtons}>
            <TouchableOpacity style={styles.permissionButton} onPress={checkCameraPermission}>
              <Text style={styles.permissionButtonText}>Grant Permission</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.cancelButton} onPress={onClose}>
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    );
  }

  return (
    <Modal visible={true} transparent={false} animationType="slide">
      <View style={styles.container}>
        <QRCodeScanner
          onRead={handleBarCodeScanned}
          flashMode={flashOn ? 'torch' : 'off'}
          showMarker={false}
          cameraStyle={styles.camera}
          customMarker={
            <View style={styles.markerContainer}>
              <BarcodeMask
                width={280}
                height={200}
                showAnimatedLine={isScanning}
                lineAnimationDuration={1500}
                backgroundColor="rgba(0, 0, 0, 0.6)"
                maskOpacity={0.6}
                edgeColor="#3b82f6"
                edgeWidth={4}
                edgeHeight={20}
                edgeRadius={8}
                animatedLineColor="#3b82f6"
                animatedLineHeight={2}
              />
              <View style={styles.instructionContainer}>
                <Text style={styles.instructionText}>
                  Position the barcode or QR code within the frame
                </Text>
                <Text style={styles.supportedFormats}>
                  Supports: Barcodes, QR codes, IMPA codes, ISSA codes
                </Text>
              </View>
            </View>
          }
        />

        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <Icon name="close" size={24} color="#ffffff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Scan Code</Text>
          <TouchableOpacity style={styles.flashButton} onPress={toggleFlash}>
            <Icon 
              name={flashOn ? "flash-on" : "flash-off"} 
              size={24} 
              color="#ffffff" 
            />
          </TouchableOpacity>
        </View>

        {/* Bottom Controls */}
        <View style={styles.bottomControls}>
          <TouchableOpacity style={styles.manualButton} onPress={handleManualEntry}>
            <Icon name="keyboard" size={20} color="#3b82f6" />
            <Text style={styles.manualButtonText}>Manual Entry</Text>
          </TouchableOpacity>
          
          {!isScanning && (
            <TouchableOpacity 
              style={styles.retryButton} 
              onPress={() => setIsScanning(true)}
            >
              <Icon name="refresh" size={20} color="#ffffff" />
              <Text style={styles.retryButtonText}>Scan Again</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Scanning Status */}
        <View style={styles.statusContainer}>
          <View style={[styles.statusIndicator, {backgroundColor: isScanning ? '#10b981' : '#6b7280'}]}>
            <Text style={styles.statusText}>
              {isScanning ? 'Scanning...' : 'Tap to scan again'}
            </Text>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  camera: {
    height: height,
    width: width,
  },
  markerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  instructionContainer: {
    position: 'absolute',
    bottom: 150,
    left: 20,
    right: 20,
    alignItems: 'center',
  },
  instructionText: {
    fontSize: 16,
    color: '#ffffff',
    textAlign: 'center',
    marginBottom: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  supportedFormats: {
    fontSize: 12,
    color: '#d1d5db',
    textAlign: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 6,
  },
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 50,
    paddingHorizontal: 20,
    paddingBottom: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
  },
  closeButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#ffffff',
  },
  flashButton: {
    padding: 8,
  },
  bottomControls: {
    position: 'absolute',
    bottom: 80,
    left: 20,
    right: 20,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 16,
  },
  manualButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
  },
  manualButtonText: {
    fontSize: 14,
    color: '#3b82f6',
    marginLeft: 8,
    fontWeight: '600',
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#3b82f6',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    fontSize: 14,
    color: '#ffffff',
    marginLeft: 8,
    fontWeight: '600',
  },
  statusContainer: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    right: 20,
    alignItems: 'center',
  },
  statusIndicator: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  statusText: {
    fontSize: 12,
    color: '#ffffff',
    fontWeight: '600',
  },
  permissionContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    padding: 20,
  },
  permissionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#ffffff',
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  permissionText: {
    fontSize: 16,
    color: '#d1d5db',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 22,
  },
  permissionButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  permissionButton: {
    backgroundColor: '#3b82f6',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  permissionButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
  },
  cancelButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#6b7280',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  cancelButtonText: {
    fontSize: 16,
    color: '#d1d5db',
  },
});

export default BarcodeScanner;