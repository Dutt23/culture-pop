import { describe, expect, it } from 'vitest';
import { fromOrigin } from './labels';

describe('fromOrigin', () => {
  it('lower-cases a leading article before a common noun', () => {
    expect(fromOrigin('The fantasy series Game of Thrones')).toBe(
      'From the fantasy series Game of Thrones',
    );
    expect(fromOrigin('A 1990s cartoon')).toBe('From a 1990s cartoon');
  });

  it('keeps a proper name and other origins as written', () => {
    expect(fromOrigin('The Chainsmokers')).toBe('From The Chainsmokers');
    expect(fromOrigin('Swahili, spoken across East Africa')).toBe(
      'From Swahili, spoken across East Africa',
    );
  });
});
