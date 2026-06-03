// Progress tab: speed curve over time, automatic item counts, endgame history.
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../App';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export default function ProgressScreen(): React.ReactElement {
  const navigation = useNavigation<Nav>();
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Progress</Text>
      <TouchableOpacity style={styles.button} onPress={() => navigation.navigate('WordsCollection')}>
        <Text style={styles.buttonText}>Words you can read</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 },
  title: { fontSize: 24, fontWeight: '600' },
  button: { backgroundColor: '#2563eb', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 8 },
  buttonText: { color: '#fff', fontSize: 16 },
});
