import { qualityFrom, reviewItem } from '../src/logic/srs';
import { AUTOMATIC_STREAK } from '../src/constants/thresholds';
import type { ItemRecord } from '../src/types';

const BASE_RECORD: ItemRecord = {
  itemId: 'j_a',
  state: 'new',
  reps: 0,
  correctCount: 0,
  incorrectCount: 0,
  introduced: false,
  lastReactionTimeMs: null,
  bestReactionTimeMs: null,
  fastCorrectStreak: 0,
  interval: 0,
  easeFactor: 2.5,
  nextDue: null,
  lastSeen: null,
};

const THRESHOLD = 1200;

// ── qualityFrom ────────────────────────────────────────────────────────────

describe('qualityFrom', () => {
  test('wrong → 0', () => {
    expect(qualityFrom(false, 500, THRESHOLD)).toBe(0);
  });
  test('wrong, slow → 0', () => {
    expect(qualityFrom(false, 3000, THRESHOLD)).toBe(0);
  });
  test('correct + slow → 3', () => {
    expect(qualityFrom(true, 2000, THRESHOLD)).toBe(3);
  });
  test('correct exactly at threshold → 3 (not fast)', () => {
    expect(qualityFrom(true, THRESHOLD, THRESHOLD)).toBe(3);
  });
  test('correct + fast → 5', () => {
    expect(qualityFrom(true, 800, THRESHOLD)).toBe(5);
  });
  test('correct just under threshold → 5', () => {
    expect(qualityFrom(true, THRESHOLD - 1, THRESHOLD)).toBe(5);
  });
});

// ── Interval progression ───────────────────────────────────────────────────

describe('reviewItem – interval progression', () => {
  test('first correct rep (interval 0) → interval 1', () => {
    const r = reviewItem(BASE_RECORD, { correct: true, reactionTimeMs: 2000 }, THRESHOLD);
    expect(r.interval).toBe(1);
  });

  test('second correct rep (interval 1) → interval 6', () => {
    const r1 = reviewItem(BASE_RECORD, { correct: true, reactionTimeMs: 2000 }, THRESHOLD);
    const r2 = reviewItem(r1, { correct: true, reactionTimeMs: 2000 }, THRESHOLD);
    expect(r2.interval).toBe(6);
  });

  test('third correct rep (interval 6) → round(interval × ease)', () => {
    const r1 = reviewItem(BASE_RECORD, { correct: true, reactionTimeMs: 2000 }, THRESHOLD);
    const r2 = reviewItem(r1, { correct: true, reactionTimeMs: 2000 }, THRESHOLD);
    const r3 = reviewItem(r2, { correct: true, reactionTimeMs: 2000 }, THRESHOLD);
    expect(r3.interval).toBe(Math.round(6 * r2.easeFactor));
  });
});

// ── Wrong answer ───────────────────────────────────────────────────────────

describe('reviewItem – wrong answer', () => {
  test('wrong answer resets interval to 1', () => {
    let r = reviewItem(BASE_RECORD, { correct: true, reactionTimeMs: 2000 }, THRESHOLD);
    r = reviewItem(r, { correct: true, reactionTimeMs: 2000 }, THRESHOLD); // interval now 6
    r = reviewItem(r, { correct: false, reactionTimeMs: 0 }, THRESHOLD);
    expect(r.interval).toBe(1);
  });

  test('wrong answer decreases ease', () => {
    const before = BASE_RECORD.easeFactor;
    const r = reviewItem(BASE_RECORD, { correct: false, reactionTimeMs: 0 }, THRESHOLD);
    expect(r.easeFactor).toBeLessThan(before);
  });

  test('ease never drops below 1.3 — single wrong on near-floor ease', () => {
    const r = reviewItem(
      { ...BASE_RECORD, easeFactor: 1.35 },
      { correct: false, reactionTimeMs: 0 },
      THRESHOLD,
    );
    expect(r.easeFactor).toBeCloseTo(1.3, 5);
  });
});

// ── Ease floor ─────────────────────────────────────────────────────────────

describe('reviewItem – ease floor', () => {
  test('ease never drops below 1.3 after many wrong answers', () => {
    let r = BASE_RECORD;
    for (let i = 0; i < 15; i++) {
      r = reviewItem(r, { correct: false, reactionTimeMs: 0 }, THRESHOLD);
    }
    expect(r.easeFactor).toBeGreaterThanOrEqual(1.3);
  });
});

// ── fastCorrectStreak ──────────────────────────────────────────────────────

describe('reviewItem – fastCorrectStreak', () => {
  test('increments on fast-correct', () => {
    const r = reviewItem(BASE_RECORD, { correct: true, reactionTimeMs: 500 }, THRESHOLD);
    expect(r.fastCorrectStreak).toBe(1);
  });

  test('increments further on consecutive fast-correct', () => {
    let r = reviewItem(BASE_RECORD, { correct: true, reactionTimeMs: 500 }, THRESHOLD);
    r = reviewItem(r, { correct: true, reactionTimeMs: 500 }, THRESHOLD);
    expect(r.fastCorrectStreak).toBe(2);
  });

  test('resets to 0 on wrong answer', () => {
    let r = reviewItem(BASE_RECORD, { correct: true, reactionTimeMs: 500 }, THRESHOLD);
    r = reviewItem(r, { correct: false, reactionTimeMs: 0 }, THRESHOLD);
    expect(r.fastCorrectStreak).toBe(0);
  });

  test('resets to 0 on slow-correct answer', () => {
    let r = reviewItem(BASE_RECORD, { correct: true, reactionTimeMs: 500 }, THRESHOLD);
    r = reviewItem(r, { correct: true, reactionTimeMs: 2000 }, THRESHOLD);
    expect(r.fastCorrectStreak).toBe(0);
  });
});

// ── State transitions ──────────────────────────────────────────────────────

describe('reviewItem – state transitions', () => {
  test('first rep transitions from new → learning', () => {
    const r = reviewItem(BASE_RECORD, { correct: true, reactionTimeMs: 2000 }, THRESHOLD);
    expect(r.state).toBe('learning');
  });

  test('reaches automatic after AUTOMATIC_STREAK consecutive fast-correct reps', () => {
    let r = BASE_RECORD;
    for (let i = 0; i < AUTOMATIC_STREAK; i++) {
      r = reviewItem(r, { correct: true, reactionTimeMs: 500 }, THRESHOLD);
    }
    expect(r.state).toBe('automatic');
  });

  test('not automatic before AUTOMATIC_STREAK fast-correct reps', () => {
    let r = BASE_RECORD;
    for (let i = 0; i < AUTOMATIC_STREAK - 1; i++) {
      r = reviewItem(r, { correct: true, reactionTimeMs: 500 }, THRESHOLD);
    }
    expect(r.state).toBe('learning');
  });

  test('automatic does not regress on wrong answer', () => {
    let r = BASE_RECORD;
    for (let i = 0; i < AUTOMATIC_STREAK; i++) {
      r = reviewItem(r, { correct: true, reactionTimeMs: 500 }, THRESHOLD);
    }
    expect(r.state).toBe('automatic');
    r = reviewItem(r, { correct: false, reactionTimeMs: 0 }, THRESHOLD);
    expect(r.state).toBe('automatic');
  });

  test('automatic does not regress on slow-correct answer', () => {
    let r = BASE_RECORD;
    for (let i = 0; i < AUTOMATIC_STREAK; i++) {
      r = reviewItem(r, { correct: true, reactionTimeMs: 500 }, THRESHOLD);
    }
    r = reviewItem(r, { correct: true, reactionTimeMs: 2000 }, THRESHOLD);
    expect(r.state).toBe('automatic');
  });

  test('interval still resets on wrong even when automatic', () => {
    let r = BASE_RECORD;
    for (let i = 0; i < AUTOMATIC_STREAK; i++) {
      r = reviewItem(r, { correct: true, reactionTimeMs: 500 }, THRESHOLD);
    }
    // Push interval past 1 with another fast rep
    r = reviewItem(r, { correct: true, reactionTimeMs: 500 }, THRESHOLD);
    expect(r.interval).toBeGreaterThan(1);
    r = reviewItem(r, { correct: false, reactionTimeMs: 0 }, THRESHOLD);
    expect(r.interval).toBe(1);
    expect(r.state).toBe('automatic');
  });
});

// ── bestReactionTimeMs ─────────────────────────────────────────────────────

describe('reviewItem – bestReactionTimeMs', () => {
  test('set on first correct rep', () => {
    const r = reviewItem(BASE_RECORD, { correct: true, reactionTimeMs: 800 }, THRESHOLD);
    expect(r.bestReactionTimeMs).toBe(800);
  });

  test('updated when a faster time arrives', () => {
    let r = reviewItem(BASE_RECORD, { correct: true, reactionTimeMs: 800 }, THRESHOLD);
    r = reviewItem(r, { correct: true, reactionTimeMs: 600 }, THRESHOLD);
    expect(r.bestReactionTimeMs).toBe(600);
  });

  test('not updated when a slower time arrives', () => {
    let r = reviewItem(BASE_RECORD, { correct: true, reactionTimeMs: 800 }, THRESHOLD);
    r = reviewItem(r, { correct: true, reactionTimeMs: 1000 }, THRESHOLD);
    expect(r.bestReactionTimeMs).toBe(800);
  });

  test('not updated on wrong answer', () => {
    let r = reviewItem(BASE_RECORD, { correct: true, reactionTimeMs: 800 }, THRESHOLD);
    r = reviewItem(r, { correct: false, reactionTimeMs: 0 }, THRESHOLD);
    expect(r.bestReactionTimeMs).toBe(800);
  });
});
