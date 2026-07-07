/**
 * MyApplicationPreviewScreen — preview for applications opened from
 * the My Applications tab. Shares the same UI as ApplicationPreviewScreen.
 */

import React from 'react';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { MyApplicationsStackParamList } from '../navigation/MyApplicationsStack';
import { ApplicationPreviewContent } from './ApplicationPreviewScreen';

// ── Types ───────────────────────────────────────────────────────────

type Props = NativeStackScreenProps<MyApplicationsStackParamList, 'MyApplicationPreview'>;

// ── Component ───────────────────────────────────────────────────────

export default function MyApplicationPreviewScreen({ route, navigation }: Props) {
  const { applicationName, generatedText, officeType } = route.params;

  return (
    <ApplicationPreviewContent
      applicationName={applicationName}
      generatedText={generatedText}
      officeType={officeType}
      onGoBack={() => navigation.goBack()}
    />
  );
}
