// "Words you can now read" — browsable collection of automatic word items with meanings.
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

export default function WordsCollectionScreen(): React.ReactElement {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Words Collection</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 24, fontWeight: '600' },
});
