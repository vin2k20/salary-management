import { Faker, base, en, en_AU, en_CA, en_IN, en_US } from '@faker-js/faker';
import type { CountryCode } from '@salary/shared';
import { addDays, daysBetween } from './dates.ts';

const localeByCountry = { IN: en_IN, US: en_US, CA: en_CA, AU: en_AU } as const;

/** A Faker instance with a fixed seed, so the same seed always gives the same values. */
export function seededFaker(seed: number, country?: CountryCode): Faker {
  const locale = country ? [localeByCountry[country], en, base] : [en, base];
  const faker = new Faker({ locale });
  faker.seed(seed);
  return faker;
}

export function pickWeighted<T>(faker: Faker, weights: [T, number][]): T {
  return faker.helpers.weightedArrayElement(weights.map(([value, weight]) => ({ value, weight })));
}

/** A random YYYY-MM-DD date from `from` to `to`, both included. */
export function dateBetween(faker: Faker, from: string, to: string): string {
  return addDays(from, faker.number.int({ min: 0, max: Math.max(0, daysBetween(from, to)) }));
}
