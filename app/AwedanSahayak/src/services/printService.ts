/**
 * Print Service — Android native/system print via expo-print.
 *
 * Opens the system print dialog for any PDF file on disk.
 * No custom printer drivers — uses Android's built-in print framework.
 *
 * Expo SDK 57: Uses modern expo-print API only.
 * No deprecated expo-file-system imports needed.
 */

import * as Print from 'expo-print';
import { Alert } from 'react-native';

/**
 * Print a PDF file using the Android system print dialog.
 *
 * @param pdfUri  Local file:// URI to the generated PDF
 * @param documentName  Display name in the print dialog (e.g. "आवेदन पत्र")
 * @returns true if the print dialog opened, false on error or cancel
 */
export async function printPdf(
  pdfUri: string,
  _documentName: string = 'आवेदन पत्र',
): Promise<boolean> {
  try {
    // Open Android system print dialog directly.
    // Print.printAsync handles file URI validation internally.
    await Print.printAsync({ uri: pdfUri });
    return true;
  } catch (err: any) {
    const message: string = err?.message ?? String(err);

    // User cancelled — not an error
    if (
      message.includes('cancel') ||
      message.includes('Cancel') ||
      message.includes('cancelled') ||
      message.includes(' Cancelled')
    ) {
      return false;
    }

    // Print service unavailable
    if (
      message.includes('not available') ||
      message.includes('unavailable') ||
      message.includes('No print')
    ) {
      Alert.alert(
        'प्रिंट सेवा उपलब्ध नहीं है',
        'प्रिंट सेवा उपलब्ध नहीं है। कृपया अपने मोबाइल में प्रिंटर/Print Service जांचें।\n\nPrint service unavailable. Please check your printer or print service settings.',
      );
      return false;
    }

    // Missing file
    if (
      message.includes('not found') ||
      message.includes('No such file') ||
      message.includes('ENOENT') ||
      message.includes('exist')
    ) {
      Alert.alert(
        'प्रिंट त्रुटि',
        'PDF फाइल नहीं मिली। कृपया पहले PDF बनाएं।\n\nPDF file not found. Please generate PDF first.',
      );
      return false;
    }

    // Other errors
    Alert.alert(
      'प्रिंट त्रुटि',
      'प्रिंट करने में त्रुटि हुई। कृपया पुनः प्रयास करें।\n\n' +
        message.substring(0, 100),
    );
    return false;
  }
}

export default printPdf;
