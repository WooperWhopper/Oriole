// Tappable romanisation option in the drill.
import React from 'react';
import { StyleSheet, Text, TouchableOpacity } from 'react-native';
import type { ContentItem } from '../types';
import type { DrillPhase } from '../logic/drill';

interface Props {
  item: ContentItem;
  isCorrect: boolean;  // this option is the right answer
  isChosen: boolean;   // learner tapped this option
  phase: DrillPhase;
  onPress: () => void;
}

export default function OptionButton({
  item,
  isCorrect,
  isChosen,
  phase,
  onPress,
}: Props): React.ReactElement {
  const answered = phase === 'answered' || phase === 'revealing';

  let backgroundColor = '#f3f4f6';
  let borderColor = '#e5e7eb';

  if (answered) {
    if (isCorrect) {
      backgroundColor = '#dcfce7';
      borderColor = '#22c55e';
    } else if (isChosen) {
      backgroundColor = '#fee2e2';
      borderColor = '#ef4444';
    }
  }

  return (
    <TouchableOpacity
      style={[styles.button, { backgroundColor, borderColor }]}
      onPress={onPress}
      disabled={answered}
      activeOpacity={0.7}
    >
      <Text style={styles.text}>{item.romanization}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    width: '100%',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 10,
    alignItems: 'center',
    marginBottom: 10,
    borderWidth: 1.5,
  },
  text: {
    fontSize: 17,
    fontWeight: '500',
    color: '#111827',
    letterSpacing: 0.2,
  },
});
