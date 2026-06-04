import type { ContentItem } from '../src/types';

// Mock the content data layer before importing anything that depends on it
jest.mock('../src/data/content', () => ({
  getItem: jest.fn(),
  getItemsByTier: jest.fn(),
}));

import { getOptions } from '../src/logic/distractors';
import { getItem, getItemsByTier } from '../src/data/content';

const mockGetItem = getItem as jest.Mock;
const mockGetItemsByTier = getItemsByTier as jest.Mock;

function makeItem(
  id: string,
  romanization: string,
  order = 1,
  tier: ContentItem['tier'] = 'jamo',
  distractorIds: string[] = [],
): ContentItem {
  return { id, tier, hangul: id, romanization, meaning: null, order, distractorIds };
}

const TARGET = makeItem('j_a', 'a', 1, 'jamo');
const D1 = makeItem('j_b', 'b', 2, 'jamo');
const D2 = makeItem('j_c', 'c', 3, 'jamo');
const D3 = makeItem('j_d', 'd', 4, 'jamo');

beforeEach(() => {
  jest.clearAllMocks();
});

describe('getOptions – standard case (3 distractors resolve)', () => {
  function setup() {
    const item = { ...TARGET, distractorIds: ['j_b', 'j_c', 'j_d'] };
    mockGetItem.mockImplementation((id: string) =>
      [D1, D2, D3].find((d) => d.id === id),
    );
    return item;
  }

  test('returns exactly 4 options', () => {
    const options = getOptions(setup());
    expect(options).toHaveLength(4);
  });

  test('correct answer is present exactly once', () => {
    const options = getOptions(setup());
    expect(options.filter((o) => o.id === TARGET.id)).toHaveLength(1);
  });

  test('all 3 distractor ids are represented', () => {
    const options = getOptions(setup());
    const ids = options.map((o) => o.id);
    expect(ids).toContain('j_b');
    expect(ids).toContain('j_c');
    expect(ids).toContain('j_d');
  });
});

describe('getOptions – fallback when fewer than 3 distractors resolve', () => {
  test('exactly 4 options returned when only 1 distractor resolves', () => {
    const item = { ...TARGET, distractorIds: ['j_b', 'j_missing1', 'j_missing2'] };
    mockGetItem.mockImplementation((id: string) => (id === 'j_b' ? D1 : undefined));
    mockGetItemsByTier.mockReturnValue([
      TARGET,
      D1,
      makeItem('j_e', 'e', 5),
      makeItem('j_f', 'f', 6),
    ]);

    const options = getOptions(item);
    expect(options).toHaveLength(4);
  });

  test('correct answer still present exactly once with fallback', () => {
    const item = { ...TARGET, distractorIds: ['j_b', 'j_missing1', 'j_missing2'] };
    mockGetItem.mockImplementation((id: string) => (id === 'j_b' ? D1 : undefined));
    mockGetItemsByTier.mockReturnValue([
      TARGET,
      D1,
      makeItem('j_e', 'e', 5),
      makeItem('j_f', 'f', 6),
    ]);

    const options = getOptions(item);
    expect(options.filter((o) => o.id === TARGET.id)).toHaveLength(1);
  });

  test('exactly 4 options returned when 0 distractors resolve', () => {
    const item = { ...TARGET, distractorIds: [] };
    mockGetItem.mockReturnValue(undefined);
    mockGetItemsByTier.mockReturnValue([
      TARGET,
      makeItem('j_b', 'b', 2),
      makeItem('j_c', 'c', 3),
      makeItem('j_d', 'd', 4),
    ]);

    const options = getOptions(item);
    expect(options).toHaveLength(4);
  });

  test('correct answer not duplicated in fallback options', () => {
    // distractorIds accidentally contains the correct item's id — must not double it
    const item = { ...TARGET, distractorIds: ['j_a', 'j_b', 'j_c'] };
    mockGetItem.mockImplementation((id: string) => {
      if (id === 'j_a') return TARGET; // same as correct item
      if (id === 'j_b') return D1;
      if (id === 'j_c') return D2;
      return undefined;
    });
    mockGetItemsByTier.mockReturnValue([TARGET, D1, D2, D3]);

    const options = getOptions(item);
    expect(options.filter((o) => o.id === TARGET.id)).toHaveLength(1);
    expect(options).toHaveLength(4);
  });
});
