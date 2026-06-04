// Full-screen flash overlay + haptic fired the instant the learner answers.
// Mount a new instance (via key prop) for each answer to retrigger the animation.
import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet } from 'react-native';
import * as Haptics from 'expo-haptics';

interface Props {
  correct: boolean;
}

export default function Feedback({ correct }: Props): React.ReactElement {
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Fire haptic immediately on mount
    Haptics.notificationAsync(
      correct
        ? Haptics.NotificationFeedbackType.Success
        : Haptics.NotificationFeedbackType.Error,
    ).catch(() => {
      // Haptics silently unavailable — not a problem
    });

    // Flash in fast, fade out slowly so the reveal content becomes visible
    Animated.sequence([
      Animated.timing(opacity, {
        toValue: 0.38,
        duration: 55,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 0,
        duration: 340,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  return (
    <Animated.View
      style={[
        StyleSheet.absoluteFill,
        styles.overlay,
        { opacity, backgroundColor: correct ? '#22c55e' : '#ef4444' },
      ]}
      pointerEvents="none"
    />
  );
}

const styles = StyleSheet.create({
  overlay: {
    zIndex: 10,
  },
});
