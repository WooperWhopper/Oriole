// Core drill loop — session queue → recognition drill → session summary.
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../App';
import type { ContentItem, ItemRecord } from '../types';
import type { DrillPhase } from '../logic/drill';
import { getAllItems, getItem } from '../data/content';
import {
  loadProfile,
  getAllRecords,
  getMeta,
  getSettings,
  upsertRecords,
  setMeta,
  freshRecord,
} from '../data/profile';
import { buildSessionQueue } from '../logic/session';
import { reviewItem } from '../logic/srs';
import { getOptions } from '../logic/distractors';
import { checkKoreanVoice, speak } from '../audio/speech';
import { AUTOMATIC_THRESHOLD_MS } from '../constants/thresholds';
import {
  updateStreak,
  computeSessionSpeedPoint,
  recomputeAutomaticByTier,
  checkTierAdvancement,
  averageSpeedMs,
} from '../logic/stats';
import DrillCard from '../components/DrillCard';
import Feedback from '../components/Feedback';

type Nav = NativeStackNavigationProp<RootStackParamList>;

// Tunable auto-advance delays (ms)
const ADVANCE_CORRECT_MS = 1200;
const ADVANCE_INCORRECT_MS = 2000;

interface SessionResult {
  item: ContentItem;
  correct: boolean;
  reactionTimeMs: number;
  updatedRecord: ItemRecord;
}

interface SessionSummary {
  total: number;
  correctCount: number;
  incorrectCount: number;
  sessionMedianMs: number | null;
  priorAverageMs: number | null;
  newlyAutomatic: ContentItem[];
  streakDays: number;
  tierAdvanced: boolean;
}

// ── Session summary view ─────────────────────────────────────────────────────

function SessionSummaryView({
  summary,
  onDone,
}: {
  summary: SessionSummary;
  onDone: () => void;
}): React.ReactElement {
  const { total, correctCount, incorrectCount, sessionMedianMs, priorAverageMs,
          newlyAutomatic, streakDays, tierAdvanced } = summary;
  const speedImproved =
    sessionMedianMs !== null &&
    priorAverageMs !== null &&
    sessionMedianMs < priorAverageMs;

  return (
    <SafeAreaView style={sum.container}>
      <ScrollView contentContainerStyle={sum.content}>
        <Text style={sum.heading}>Session complete</Text>

        {/* Speed headline */}
        {sessionMedianMs !== null && (
          <View style={sum.card}>
            <Text style={sum.speedNumber}>{sessionMedianMs} ms</Text>
            <Text style={sum.speedLabel}>avg reaction time</Text>
            {priorAverageMs !== null && (
              <Text style={[sum.speedCompare, speedImproved && sum.speedGood]}>
                {speedImproved
                  ? `↓ Faster than your ${priorAverageMs} ms average`
                  : `Your average: ${priorAverageMs} ms`}
              </Text>
            )}
          </View>
        )}

        {/* Correct / incorrect */}
        <View style={sum.card}>
          <Text style={sum.stat}>
            <Text style={sum.correct}>{correctCount} correct</Text>
            {'  '}
            <Text style={sum.incorrect}>{incorrectCount} incorrect</Text>
            {'  '}
            <Text style={sum.muted}>of {total}</Text>
          </Text>
        </View>

        {/* Newly automatic */}
        {newlyAutomatic.length > 0 && (
          <View style={sum.card}>
            <Text style={sum.winHeading}>
              {newlyAutomatic.length === 1 ? '1 item' : `${newlyAutomatic.length} items`} now automatic
            </Text>
            {newlyAutomatic.slice(0, 6).map((item) => (
              <Text key={item.id} style={sum.winItem}>
                {item.hangul}
                {item.meaning ? `  ·  ${item.meaning}` : ''}
              </Text>
            ))}
            {newlyAutomatic.length > 6 && (
              <Text style={sum.muted}>+ {newlyAutomatic.length - 6} more</Text>
            )}
          </View>
        )}

        {/* Tier advancement */}
        {tierAdvanced && (
          <View style={[sum.card, sum.tierCard]}>
            <Text style={sum.tierText}>Tier unlocked — next level!</Text>
          </View>
        )}

        {/* Streak */}
        <Text style={sum.streak}>
          {streakDays}-day streak
        </Text>

        <TouchableOpacity style={sum.btn} onPress={onDone}>
          <Text style={sum.btnText}>Back to Home</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

// ── Main screen ──────────────────────────────────────────────────────────────

export default function DrillScreen(): React.ReactElement {
  const navigation = useNavigation<Nav>();

  const [loading, setLoading] = useState(true);
  const [emptyQueue, setEmptyQueue] = useState(false);

  const [queue, setQueue] = useState<ContentItem[]>([]);
  const [index, setIndex] = useState(0);
  const [phase, setPhase] = useState<DrillPhase>('presenting');
  const [answeredId, setAnsweredId] = useState<string | null>(null);
  const [options, setOptions] = useState<ContentItem[]>([]);

  // Feedback flash — remounted via key to retrigger animation each answer
  const [feedbackKey, setFeedbackKey] = useState(0);
  const [feedbackCorrect, setFeedbackCorrect] = useState(true);

  const [koreanVoiceAvailable, setKoreanVoiceAvailable] = useState(false);
  const [sessionSummary, setSessionSummary] = useState<SessionSummary | null>(null);

  // Refs for values needed in callbacks / timers without stale closure issues
  const presentedAtRef = useRef<number | null>(null);
  const updatedRecordsRef = useRef<Record<string, ItemRecord>>({});
  const initialRecordsRef = useRef<Record<string, ItemRecord>>({});
  const sessionResultsRef = useRef<SessionResult[]>([]);
  const advanceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const queueRef = useRef<ContentItem[]>([]);
  const indexRef = useRef(0);
  const sessionEndedRef = useRef(false); // guard against double-calls

  // ── Load and build queue ─────────────────────────────────────────────────

  useEffect(() => {
    let cancelled = false;

    (async () => {
      await loadProfile();
      const [settings, hasKo] = await Promise.all([
        getSettings(),
        checkKoreanVoice(),
      ]);
      if (cancelled) return;

      setKoreanVoiceAvailable(hasKo);

      const allItems = getAllItems();
      const records = getAllRecords();
      const meta = getMeta();

      const q = buildSessionQueue(
        records,
        allItems,
        meta.currentTier,
        settings.sessionLength,
      );

      if (q.length === 0) {
        setEmptyQueue(true);
        setLoading(false);
        return;
      }

      updatedRecordsRef.current = { ...records };
      initialRecordsRef.current = { ...records };
      sessionResultsRef.current = [];
      sessionEndedRef.current = false;
      queueRef.current = q;
      indexRef.current = 0;
      presentedAtRef.current = null; // DrillCard's onReady sets this

      setQueue(q);
      setOptions(getOptions(q[0]));
      setIndex(0);
      setPhase('presenting');
      setLoading(false);
    })();

    return () => {
      cancelled = true;
      if (advanceTimerRef.current) clearTimeout(advanceTimerRef.current);
    };
  }, []);

  // ── Session end ──────────────────────────────────────────────────────────

  const endSession = useCallback(async () => {
    if (sessionEndedRef.current) return;
    sessionEndedRef.current = true;

    const results = sessionResultsRef.current;
    if (results.length === 0) {
      navigation.goBack();
      return;
    }

    const allItems = getAllItems();
    const updatedRecords = updatedRecordsRef.current;

    await upsertRecords(Object.values(updatedRecords));

    let meta = getMeta();
    const priorSpeedHistory = [...meta.speedHistory];

    meta = updateStreak(meta);
    meta = { ...meta, sessionsCompleted: meta.sessionsCompleted + 1 };

    const correctRTs = results
      .filter((r) => r.correct)
      .map((r) => r.reactionTimeMs);
    const speedPoint = computeSessionSpeedPoint(correctRTs);
    if (speedPoint) {
      meta = { ...meta, speedHistory: [...meta.speedHistory, speedPoint] };
    }

    meta = {
      ...meta,
      automaticByTier: recomputeAutomaticByTier(updatedRecords, getItem),
    };

    const nextTier = checkTierAdvancement(
      updatedRecords,
      allItems,
      meta.currentTier,
    );
    const tierAdvanced = nextTier !== null;
    if (nextTier) {
      meta = { ...meta, currentTier: nextTier };
    }

    await setMeta(meta);

    const initRecs = initialRecordsRef.current;
    const newlyAutomatic = [
      ...new Map(
        results
          .filter(
            (r) =>
              r.updatedRecord.state === 'automatic' &&
              initRecs[r.item.id]?.state !== 'automatic',
          )
          .map((r) => [r.item.id, r.item]),
      ).values(),
    ];

    setSessionSummary({
      total: results.length,
      correctCount: results.filter((r) => r.correct).length,
      incorrectCount: results.filter((r) => !r.correct).length,
      sessionMedianMs: speedPoint?.medianReactionMs ?? null,
      priorAverageMs: averageSpeedMs(priorSpeedHistory),
      newlyAutomatic,
      streakDays: meta.currentStreakDays,
      tierAdvanced,
    });
  }, [navigation]);

  // ── Advance to next item ─────────────────────────────────────────────────

  // Stored in a ref so the setTimeout closure always calls the latest version
  const endSessionRef = useRef(endSession);
  useEffect(() => {
    endSessionRef.current = endSession;
  }, [endSession]);

  const goNextRef = useRef(() => {});
  goNextRef.current = () => {
    const nextIndex = indexRef.current + 1;
    const q = queueRef.current;

    if (nextIndex >= q.length) {
      endSessionRef.current();
      return;
    }

    const nextItem = q[nextIndex];

    // TODO: if nextItem.tier === 'word' && !(updatedRecordsRef.current[nextItem.id]?.introduced ?? false),
    //   route to the WordIntroduction sub-flow before recognition. (Next task.)
    //   For now, fall through to recognition for all tiers.

    indexRef.current = nextIndex;
    setIndex(nextIndex);
    setAnsweredId(null);
    setOptions(getOptions(nextItem));
    presentedAtRef.current = null; // DrillCard's onReady will set this
    setPhase('presenting');
  };

  const goNext = useCallback(() => {
    goNextRef.current();
  }, []);

  // ── Handle learner's answer ──────────────────────────────────────────────

  const handleAnswer = useCallback(
    (tapped: ContentItem) => {
      const item = queueRef.current[indexRef.current];
      if (!item) return;

      const rt =
        presentedAtRef.current !== null
          ? Date.now() - presentedAtRef.current
          : 500; // fallback if clock wasn't set
      const correct = tapped.id === item.id;

      setAnsweredId(tapped.id);
      setPhase('revealing');
      setFeedbackCorrect(correct);
      setFeedbackKey((k) => k + 1);

      // Score with SRS
      const threshold = AUTOMATIC_THRESHOLD_MS[item.tier];
      const existing =
        updatedRecordsRef.current[item.id] ?? freshRecord(item);
      const updated = reviewItem(
        existing,
        { correct, reactionTimeMs: rt },
        threshold,
      );
      updatedRecordsRef.current[item.id] = updated;
      sessionResultsRef.current.push({
        item,
        correct,
        reactionTimeMs: rt,
        updatedRecord: updated,
      });

      // Audio in reveal — skip jamo tier (bare-jamo TTS is unreliable)
      if (koreanVoiceAvailable && item.tier !== 'jamo') {
        speak(item.hangul);
      }

      // Auto-advance
      const delay = correct ? ADVANCE_CORRECT_MS : ADVANCE_INCORRECT_MS;
      if (advanceTimerRef.current) clearTimeout(advanceTimerRef.current);
      advanceTimerRef.current = setTimeout(goNext, delay);
    },
    [koreanVoiceAvailable, goNext],
  );

  // ── RT clock start (called by DrillCard after it renders) ────────────────

  const handleReady = useCallback(() => {
    presentedAtRef.current = Date.now();
  }, []);

  // ── Replay audio ─────────────────────────────────────────────────────────

  const handleReplay = useCallback(() => {
    const item = queueRef.current[indexRef.current];
    if (item && koreanVoiceAvailable && item.tier !== 'jamo') {
      speak(item.hangul);
    }
  }, [koreanVoiceAvailable]);

  // ── Render ────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <View style={styles.center}>
        <Text style={styles.loadingText}>Loading…</Text>
      </View>
    );
  }

  if (emptyQueue) {
    return (
      <View style={styles.center}>
        <Text style={styles.heading}>All caught up!</Text>
        <Text style={styles.subtext}>No items due right now.</Text>
        <TouchableOpacity style={styles.btn} onPress={() => navigation.goBack()}>
          <Text style={styles.btnText}>Back to Home</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (sessionSummary) {
    return (
      <SessionSummaryView
        summary={sessionSummary}
        onDone={() => navigation.goBack()}
      />
    );
  }

  const item = queue[index];
  if (!item) return <View />;

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Full-screen feedback flash — remounted each answer via key */}
      <Feedback key={feedbackKey} correct={feedbackCorrect} />

      {/* Progress indicator */}
      <View style={styles.progressRow}>
        <Text style={styles.progressText}>
          {index + 1} / {queue.length}
        </Text>
      </View>

      {/* Drill card: stimulus + reveal + options */}
      <DrillCard
        item={item}
        options={options}
        phase={phase}
        answeredId={answeredId}
        correctId={item.id}
        onAnswer={handleAnswer}
        onReady={handleReady}
        koreanVoiceAvailable={koreanVoiceAvailable}
        onReplay={handleReplay}
      />
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#fff',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    padding: 24,
  },
  loadingText: {
    fontSize: 16,
    color: '#6b7280',
  },
  heading: {
    fontSize: 22,
    fontWeight: '700',
    color: '#111827',
    textAlign: 'center',
  },
  subtext: {
    fontSize: 15,
    color: '#6b7280',
    textAlign: 'center',
  },
  progressRow: {
    alignItems: 'center',
    paddingTop: 8,
    paddingBottom: 4,
  },
  progressText: {
    fontSize: 13,
    color: '#9ca3af',
    fontWeight: '500',
    letterSpacing: 0.5,
  },
  btn: {
    backgroundColor: '#2563eb',
    paddingHorizontal: 28,
    paddingVertical: 13,
    borderRadius: 10,
    marginTop: 8,
  },
  btnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

const sum = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  content: {
    padding: 24,
    gap: 16,
  },
  heading: {
    fontSize: 26,
    fontWeight: '700',
    color: '#111827',
    textAlign: 'center',
    marginBottom: 4,
  },
  card: {
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#f3f4f6',
    alignItems: 'center',
  },
  speedNumber: {
    fontSize: 40,
    fontWeight: '800',
    color: '#1d4ed8',
    letterSpacing: -1,
  },
  speedLabel: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 2,
  },
  speedCompare: {
    marginTop: 8,
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
  },
  speedGood: {
    color: '#15803d',
    fontWeight: '600',
  },
  stat: {
    fontSize: 15,
    color: '#374151',
  },
  correct: {
    color: '#15803d',
    fontWeight: '600',
  },
  incorrect: {
    color: '#dc2626',
    fontWeight: '600',
  },
  muted: {
    color: '#9ca3af',
  },
  winHeading: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 8,
  },
  winItem: {
    fontSize: 18,
    color: '#374151',
    marginTop: 4,
  },
  tierCard: {
    backgroundColor: '#eff6ff',
    borderColor: '#bfdbfe',
  },
  tierText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1d4ed8',
  },
  streak: {
    textAlign: 'center',
    fontSize: 14,
    color: '#6b7280',
  },
  btn: {
    backgroundColor: '#2563eb',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 8,
  },
  btnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
