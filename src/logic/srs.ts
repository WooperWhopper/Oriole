// Automaticity-tuned spaced-repetition scheduler. See docs/srs.md.
import type { ItemRecord, DrillResult } from '../types';

export function scoreRep(_record: ItemRecord, _result: DrillResult): ItemRecord {
  // TODO: implement SM-2 variant with reaction-time quality scoring
  throw new Error('srs.scoreRep not implemented');
}
