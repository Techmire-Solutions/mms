import { describe, expect, it } from 'vitest';
import { academicTerminologySchema, normalizeAcademicTerminology, resolveAcademicTerm } from './academicTerminology.js';

describe('normalizeAcademicTerminology', () => {
  it('given mixed input, should keep only known languages/keys with trimmed non-empty labels when normalized', () => {
    // Arrange
    const raw = {
      en: { class: { singular: '  Darja ', plural: 'Darjat' }, section: { singular: ' ', plural: '' }, bogus: { singular: 'x', plural: 'y' } },
      de: { class: { singular: 'Klasse', plural: 'Klassen' } },
      ur: 'not-an-object',
    };

    // Act
    const normalized = normalizeAcademicTerminology(raw);

    // Assert
    expect(normalized).toEqual({ en: { class: { singular: 'Darja', plural: 'Darjat' } } });
    expect(academicTerminologySchema.safeParse(normalized).success).toBe(true);
  });

  it('given non-object input, should return an empty map when normalized', () => {
    // Arrange
    const inputs: unknown[] = [null, 'x', 42];

    // Act
    const results = inputs.map((input) => normalizeAcademicTerminology(input));

    // Assert
    expect(results).toEqual([{}, {}, {}]);
  });
});

describe('resolveAcademicTerm', () => {
  it('given a partial override, should fall back per field to the translation labels when resolved', () => {
    // Arrange
    const terminology = { ur: { section: { singular: 'Group', plural: '' } } };
    const fallback = { singular: 'Section', plural: 'Sections' };

    // Act
    const urdu = resolveAcademicTerm(terminology, 'ur', 'section', fallback);
    const english = resolveAcademicTerm(terminology, 'en', 'section', fallback);

    // Assert
    expect(urdu).toEqual({ singular: 'Group', plural: 'Sections' });
    expect(english).toEqual(fallback);
  });
});
