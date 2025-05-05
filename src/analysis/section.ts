import { createSection, Section, Weighted } from '@tobrien/minorprompt';
import { Parameters } from '../types';

/**
 * Checks if an object is a Section
 */
export const isSection = (object: any): boolean => {
    return object !== undefined && object !== null && typeof object === 'object' && 'items' in object;
}

/**
 * Replaces parameter placeholders in a section with their actual values
 */
export const replaceParameters = <T extends Weighted>(section: Section<T>, parameters: Parameters): Section<T> => {
    let returnSection: Section<T>;

    const items = section.items.map((item) => {
        if (isSection(item)) {
            const section = item as Section<T>;
            return replaceParameters(section, parameters);
        } else {
            const weighted = item as T;
            for (const [key, value] of Object.entries(parameters)) {
                weighted.text = weighted.text.replace(new RegExp(`{{parameters.${key}}}`, 'g'), value.value.toString());
            }
        }
        return item;
    });

    if (section.title) {
        let title = section.title;
        for (const [key, value] of Object.entries(parameters)) {
            title = title.replace(new RegExp(`{{parameters.${key}}}`, 'g'), value.value.toString());
        }
        returnSection = createSection<T>(title);
    } else {
        // TODO: There should be a better way to create a section with no title.
        returnSection = createSection<T>('');
    }

    returnSection.items = items;
    return returnSection;
} 