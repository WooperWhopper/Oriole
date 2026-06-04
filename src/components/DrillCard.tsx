// Hangul stimulus + reveal section (when answering) + 4 romanisation OptionButtons.
import React, { useEffect } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import type { ContentItem } from '../types';
import type { DrillPhase } from '../logic/drill';
import OptionButton from './OptionButton';

interface Props {
  item: ContentItem;
  options: ContentItem[];        // 4 items, shuffled, correct included once
  phase: DrillPhase;
  answeredId: string | null;     // id of the tapped option; null while presenting
  correctId: string;             // item.id
  onAnswer: (tapped: ContentItem) => void;
  onReady: () => void;           // called after render — signals RT clock start
  koreanVoiceAvailable: boolean;
  onReplay: () => void;
}

export default function DrillCard({
  item,
  options,
  phase,
  answeredId,
  correctId,
  onAnswer,
  onReady,
  koreanVoiceAvailable,
  onReplay,
}: Props): React.ReactElement {
  // Start the RT clock once this item is rendered and interactive
  useEffect(() => {
    if (phase === 'presenting') {
      onReady();
    }
    // item.id is the key dep: fires for each new item shown, not on phase change
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item.id]);

  const revealing = phase === 'revealing' || phase === 'answered';
  const showSpeaker =
    revealing && koreanVoiceAvailable && item.tier !== 'jamo';

  return (
    <View style={styles.container}>
      {/* Stimulus */}
      <View style={styles.stimulusArea}>
        <Text style={styles.hangul}>{item.hangul}</Text>

        {/* Reveal: romanisation + meaning + speaker */}
        {revealing && (
          <View style={styles.reveal}>
            <View style={styles.revealRow}>
              <Text style={styles.romanization}>{item.romanization}</Text>
              {showSpeaker && (
                <TouchableOpacity
                  onPress={onReplay}
                  style={styles.speakerBtn}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Text style={styles.speakerIcon}>🔊</Text>
                </TouchableOpacity>
              )}
            </View>
            {item.meaning !== null && (
              <Text style={styles.meaning}>{item.meaning}</Text>
            )}
          </View>
        )}
      </View>

      {/* Options */}
      <View style={styles.optionsArea}>
        {options.map((opt) => (
          <OptionButton
            key={opt.id}
            item={opt}
            isCorrect={opt.id === correctId}
            isChosen={opt.id === answeredId}
            phase={phase}
            onPress={() => {
              if (phase !== 'presenting') return;
              onAnswer(opt);
            }}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  stimulusArea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  hangul: {
    fontSize: 72,
    fontWeight: '700',
    color: '#111827',
    letterSpacing: 2,
    textAlign: 'center',
  },
  reveal: {
    marginTop: 20,
    alignItems: 'center',
  },
  revealRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  romanization: {
    fontSize: 22,
    fontWeight: '600',
    color: '#374151',
    letterSpacing: 0.3,
  },
  speakerBtn: {
    padding: 4,
  },
  speakerIcon: {
    fontSize: 20,
  },
  meaning: {
    marginTop: 4,
    fontSize: 15,
    color: '#6b7280',
    fontStyle: 'italic',
  },
  optionsArea: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
});
