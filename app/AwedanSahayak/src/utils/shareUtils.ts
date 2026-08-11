/**
 * Safe share utilities — handles UTF-8 text without deprecated APIs.
 */
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';
import { Platform } from 'react-native';

/** Share plain text via expo-sharing by writing to temp file. */
export async function sharePlainText(text: string, dialogTitle: string): Promise<void> {
  const isAvail = await Sharing.isAvailableAsync();
  if (!isAvail) return;

  // For Android, write to a temp file and share
  const tempFile = `${FileSystem.cacheDirectory}share_${Date.now()}.txt`;
  await FileSystem.writeAsStringAsync(tempFile, text, { encoding: FileSystem.EncodingType.UTF8 });
  await Sharing.shareAsync(tempFile, {
    mimeType: 'text/plain',
    dialogTitle,
    UTI: 'public.plain-text',
  }).catch(() => {});
}
