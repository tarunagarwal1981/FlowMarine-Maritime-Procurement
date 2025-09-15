import React, {useState, useCallback} from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  ScrollView,
  Alert,
  Share,
  Platform,
  Dimensions,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import RNFS from 'react-native-fs';
import {captureScreen} from 'react-native-view-shot';

const {width: screenWidth} = Dimensions.get('window');

export interface ExportFormat {
  key: string;
  label: string;
  icon: string;
  mimeType: string;
  extension: string;
}

export interface ShareOption {
  key: string;
  label: string;
  icon: string;
  action: (data: any, format: ExportFormat) => Promise<void>;
}

interface DataExportShareProps {
  data: any;
  title?: string;
  filename?: string;
  visible: boolean;
  onClose: () => void;
  customFormats?: ExportFormat[];
  customShareOptions?: ShareOption[];
  includeScreenshot?: boolean;
  onExportStart?: (format: ExportFormat) => void;
  onExportComplete?: (format: ExportFormat, success: boolean) => void;
}

const defaultFormats: ExportFormat[] = [
  {
    key: 'json',
    label: 'JSON Data',
    icon: 'code',
    mimeType: 'application/json',
    extension: 'json',
  },
  {
    key: 'csv',
    label: 'CSV Spreadsheet',
    icon: 'table-chart',
    mimeType: 'text/csv',
    extension: 'csv',
  },
  {
    key: 'pdf',
    label: 'PDF Report',
    icon: 'picture-as-pdf',
    mimeType: 'application/pdf',
    extension: 'pdf',
  },
  {
    key: 'screenshot',
    label: 'Screenshot',
    icon: 'photo-camera',
    mimeType: 'image/png',
    extension: 'png',
  },
];

const DataExportShare: React.FC<DataExportShareProps> = ({
  data,
  title = 'Analytics Data',
  filename = 'analytics_export',
  visible,
  onClose,
  customFormats = [],
  customShareOptions = [],
  includeScreenshot = true,
  onExportStart,
  onExportComplete,
}) => {
  const [selectedFormat, setSelectedFormat] = useState<ExportFormat | null>(null);
  const [exporting, setExporting] = useState(false);
  const [showShareOptions, setShowShareOptions] = useState(false);

  const formats = [
    ...defaultFormats.filter(format => 
      includeScreenshot || format.key !== 'screenshot'
    ),
    ...customFormats,
  ];

  const shareOptions: ShareOption[] = [
    {
      key: 'native',
      label: 'Share',
      icon: 'share',
      action: async (exportedData: any, format: ExportFormat) => {
        try {
          if (format.key === 'screenshot') {
            await Share.share({
              url: exportedData.uri,
              title: title,
            });
          } else {
            await Share.share({
              url: exportedData.uri,
              title: title,
              message: `${title} - ${format.label}`,
            });
          }
        } catch (error) {
          console.error('Share error:', error);
          Alert.alert('Error', 'Failed to share data');
        }
      },
    },
    {
      key: 'email',
      label: 'Email',
      icon: 'email',
      action: async (exportedData: any, format: ExportFormat) => {
        try {
          const subject = encodeURIComponent(`${title} - ${format.label}`);
          const body = encodeURIComponent(`Please find attached ${title} exported as ${format.label}.`);
          const mailtoUrl = `mailto:?subject=${subject}&body=${body}`;
          
          await Share.share({
            url: exportedData.uri,
            title: title,
            message: `${title} - ${format.label}`,
          });
        } catch (error) {
          console.error('Email share error:', error);
          Alert.alert('Error', 'Failed to share via email');
        }
      },
    },
    {
      key: 'save',
      label: 'Save to Files',
      icon: 'save',
      action: async (exportedData: any, format: ExportFormat) => {
        try {
          // On iOS, files are automatically saved to the Files app when shared
          // On Android, we can save to Downloads folder
          if (Platform.OS === 'android') {
            const downloadPath = `${RNFS.DownloadDirectoryPath}/${filename}.${format.extension}`;
            await RNFS.copyFile(exportedData.uri, downloadPath);
            Alert.alert('Success', `File saved to Downloads folder`);
          } else {
            await Share.share({
              url: exportedData.uri,
              title: 'Save File',
            });
          }
        } catch (error) {
          console.error('Save error:', error);
          Alert.alert('Error', 'Failed to save file');
        }
      },
    },
    ...customShareOptions,
  ];

  const convertToCSV = useCallback((data: any): string => {
    if (Array.isArray(data)) {
      if (data.length === 0) return '';
      
      const headers = Object.keys(data[0]);
      const csvHeaders = headers.join(',');
      const csvRows = data.map(row => 
        headers.map(header => {
          const value = row[header];
          // Escape commas and quotes in CSV
          if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
            return `"${value.replace(/"/g, '""')}"`;
          }
          return value;
        }).join(',')
      );
      
      return [csvHeaders, ...csvRows].join('\n');
    } else if (typeof data === 'object') {
      // Convert object to key-value CSV
      const entries = Object.entries(data);
      return entries.map(([key, value]) => `${key},${value}`).join('\n');
    }
    
    return String(data);
  }, []);

  const generatePDF = useCallback(async (data: any): Promise<string> => {
    // This is a simplified PDF generation
    // In a real app, you'd use a library like react-native-pdf-lib
    const htmlContent = `
      <html>
        <head>
          <title>${title}</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 20px; }
            h1 { color: #1e40af; }
            table { border-collapse: collapse; width: 100%; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
            th { background-color: #f2f2f2; }
          </style>
        </head>
        <body>
          <h1>${title}</h1>
          <pre>${JSON.stringify(data, null, 2)}</pre>
        </body>
      </html>
    `;
    
    // Save HTML file (in a real app, convert to PDF)
    const htmlPath = `${RNFS.DocumentDirectoryPath}/${filename}.html`;
    await RNFS.writeFile(htmlPath, htmlContent, 'utf8');
    return htmlPath;
  }, [title, filename]);

  const takeScreenshot = useCallback(async (): Promise<string> => {
    try {
      const uri = await captureScreen({
        format: 'png',
        quality: 0.8,
      });
      return uri;
    } catch (error) {
      console.error('Screenshot error:', error);
      throw new Error('Failed to capture screenshot');
    }
  }, []);

  const exportData = useCallback(async (format: ExportFormat) => {
    setExporting(true);
    onExportStart?.(format);

    try {
      let exportedData: { uri: string; content?: string };

      switch (format.key) {
        case 'json':
          const jsonContent = JSON.stringify(data, null, 2);
          const jsonPath = `${RNFS.DocumentDirectoryPath}/${filename}.json`;
          await RNFS.writeFile(jsonPath, jsonContent, 'utf8');
          exportedData = { uri: `file://${jsonPath}`, content: jsonContent };
          break;

        case 'csv':
          const csvContent = convertToCSV(data);
          const csvPath = `${RNFS.DocumentDirectoryPath}/${filename}.csv`;
          await RNFS.writeFile(csvPath, csvContent, 'utf8');
          exportedData = { uri: `file://${csvPath}`, content: csvContent };
          break;

        case 'pdf':
          const pdfPath = await generatePDF(data);
          exportedData = { uri: `file://${pdfPath}` };
          break;

        case 'screenshot':
          const screenshotUri = await takeScreenshot();
          exportedData = { uri: screenshotUri };
          break;

        default:
          throw new Error(`Unsupported format: ${format.key}`);
      }

      setSelectedFormat(format);
      setShowShareOptions(true);
      onExportComplete?.(format, true);

      // Store exported data for sharing
      (exportData as any).lastExport = exportedData;
    } catch (error) {
      console.error('Export error:', error);
      Alert.alert('Export Error', `Failed to export data as ${format.label}`);
      onExportComplete?.(format, false);
    } finally {
      setExporting(false);
    }
  }, [data, filename, convertToCSV, generatePDF, takeScreenshot, onExportStart, onExportComplete]);

  const handleShare = useCallback(async (shareOption: ShareOption) => {
    if (!selectedFormat || !(exportData as any).lastExport) return;

    try {
      await shareOption.action((exportData as any).lastExport, selectedFormat);
      setShowShareOptions(false);
      onClose();
    } catch (error) {
      console.error('Share error:', error);
      Alert.alert('Share Error', 'Failed to share data');
    }
  }, [selectedFormat, onClose]);

  const renderFormatOption = (format: ExportFormat) => (
    <TouchableOpacity
      key={format.key}
      style={styles.formatOption}
      onPress={() => exportData(format)}
      disabled={exporting}
    >
      <View style={styles.formatIcon}>
        <Icon name={format.icon} size={24} color="#1e40af" />
      </View>
      <View style={styles.formatInfo}>
        <Text style={styles.formatLabel}>{format.label}</Text>
        <Text style={styles.formatDescription}>
          Export as {format.extension.toUpperCase()} file
        </Text>
      </View>
      <Icon name="chevron-right" size={20} color="#94a3b8" />
    </TouchableOpacity>
  );

  const renderShareOption = (option: ShareOption) => (
    <TouchableOpacity
      key={option.key}
      style={styles.shareOption}
      onPress={() => handleShare(option)}
    >
      <View style={styles.shareIcon}>
        <Icon name={option.icon} size={24} color="#059669" />
      </View>
      <Text style={styles.shareLabel}>{option.label}</Text>
    </TouchableOpacity>
  );

  return (
    <>
      {/* Export Format Selection Modal */}
      <Modal
        visible={visible && !showShareOptions}
        transparent
        animationType="slide"
        onRequestClose={onClose}
      >
        <View style={styles.modalOverlay}>
          <TouchableOpacity
            style={styles.modalBackdrop}
            activeOpacity={1}
            onPress={onClose}
          />
          <View style={styles.exportModal}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Export Data</Text>
              <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                <Icon name="close" size={24} color="#64748b" />
              </TouchableOpacity>
            </View>
            
            <ScrollView style={styles.formatList}>
              <Text style={styles.sectionTitle}>Choose Export Format</Text>
              {formats.map(renderFormatOption)}
            </ScrollView>
            
            {exporting && (
              <View style={styles.exportingOverlay}>
                <View style={styles.exportingContent}>
                  <Icon name="hourglass-empty" size={32} color="#1e40af" />
                  <Text style={styles.exportingText}>Exporting...</Text>
                </View>
              </View>
            )}
          </View>
        </View>
      </Modal>

      {/* Share Options Modal */}
      <Modal
        visible={showShareOptions}
        transparent
        animationType="slide"
        onRequestClose={() => setShowShareOptions(false)}
      >
        <View style={styles.modalOverlay}>
          <TouchableOpacity
            style={styles.modalBackdrop}
            activeOpacity={1}
            onPress={() => setShowShareOptions(false)}
          />
          <View style={styles.shareModal}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Share Export</Text>
              <TouchableOpacity
                onPress={() => setShowShareOptions(false)}
                style={styles.closeButton}
              >
                <Icon name="close" size={24} color="#64748b" />
              </TouchableOpacity>
            </View>
            
            <View style={styles.shareContent}>
              <Text style={styles.shareDescription}>
                {selectedFormat?.label} export ready to share
              </Text>
              
              <View style={styles.shareOptions}>
                {shareOptions.map(renderShareOption)}
              </View>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalBackdrop: {
    flex: 1,
  },
  exportModal: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
  },
  shareModal: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '60%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1e293b',
  },
  closeButton: {
    padding: 4,
  },
  formatList: {
    flex: 1,
    padding: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 16,
  },
  formatOption: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  formatIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#e0f2fe',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  formatInfo: {
    flex: 1,
  },
  formatLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1e293b',
  },
  formatDescription: {
    fontSize: 14,
    color: '#64748b',
    marginTop: 2,
  },
  shareContent: {
    padding: 20,
  },
  shareDescription: {
    fontSize: 14,
    color: '#64748b',
    textAlign: 'center',
    marginBottom: 24,
  },
  shareOptions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    flexWrap: 'wrap',
    gap: 16,
  },
  shareOption: {
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#f0fdf4',
    minWidth: 80,
  },
  shareIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#dcfce7',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  shareLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#059669',
    textAlign: 'center',
  },
  exportingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  exportingContent: {
    alignItems: 'center',
    padding: 32,
  },
  exportingText: {
    fontSize: 16,
    color: '#1e40af',
    fontWeight: '600',
    marginTop: 16,
  },
});

export default DataExportShare;