import { jest } from '@jest/globals';

// @ts-ignore
const mockCreateSection = jest.fn((title) => ({
    title,
    items: []
}));

jest.unstable_mockModule('@tobrien/minorprompt', () => ({
    createSection: mockCreateSection,
}));

describe('Section Tests', () => {
    let isSection: (object: any) => boolean;
    let replaceParameters: <T extends any>(section: any, parameters: any) => any;

    beforeEach(async () => {
        // @ts-ignore
        const sectionModule = await import('../../src/analysis/section');
        isSection = sectionModule.isSection;
        replaceParameters = sectionModule.replaceParameters;
    });

    describe('isSection', () => {
        it('should return true for an object with items property', () => {
            const section = { items: [] };
            expect(isSection(section)).toBe(true);
        });

        it('should return false for an object without items property', () => {
            const notSection = { foo: 'bar' };
            expect(isSection(notSection)).toBe(false);
        });

        it('should return false for null', () => {
            expect(isSection(null)).toBe(false);
        });

        it('should return false for non-objects', () => {
            expect(isSection('string')).toBe(false);
            expect(isSection(123)).toBe(false);
            expect(isSection(undefined)).toBe(false);
        });
    });

    describe('replaceParameters', () => {
        it('should replace parameters in text items', () => {
            const section = {
                title: 'Test Section',
                items: [
                    { text: 'Hello {{parameters.name}}', weight: 1 }
                ]
            };
            const parameters = {
                name: { value: 'World' }
            };

            const result = replaceParameters(section, parameters);
            expect(result.items[0].text).toBe('Hello World');
        });

        it('should replace parameters in section title', () => {
            const section = {
                title: 'Hello {{parameters.name}}',
                items: []
            };
            const parameters = {
                name: { value: 'World' }
            };

            const result = replaceParameters(section, parameters);
            expect(result.title).toBe('Hello World');
        });

        it('should handle nested sections', () => {
            const nestedSection = {
                title: 'Nested Section',
                items: [
                    { text: 'Nested {{parameters.adjective}}', weight: 1 }
                ]
            };

            const section = {
                title: 'Parent Section',
                items: [
                    { text: 'Parent {{parameters.noun}}', weight: 1 },
                    nestedSection
                ]
            };

            const parameters = {
                adjective: { value: 'cool' },
                noun: { value: 'test' }
            };

            const result = replaceParameters(section, parameters);
            expect(result.items[0].text).toBe('Parent test');

            // @ts-ignore - We know this is a section
            const resultNestedSection = result.items[1];
            expect(resultNestedSection.title).toBe('Nested Section');
            expect(resultNestedSection.items[0].text).toBe('Nested cool');
        });

        it('should handle multiple parameter replacements in a string', () => {
            const section = {
                title: 'Test',
                items: [
                    { text: '{{parameters.greeting}} {{parameters.name}}!', weight: 1 }
                ]
            };
            const parameters = {
                greeting: { value: 'Hello' },
                name: { value: 'World' }
            };

            const result = replaceParameters(section, parameters);
            expect(result.items[0].text).toBe('Hello World!');
        });
    });
});
