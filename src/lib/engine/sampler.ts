/**
 * Game outcome sampler and seeded pseudo-random number generator.
 *
 * Provides deterministic random number generation via the mulberry32 PRNG
 * algorithm and a simple game outcome sampler that converts a win probability
 * into a binary outcome. The seeded PRNG enables reproducible simulation
 * results for testing and debugging.
 *
 * All functions are pure (no side effects beyond consuming PRNG state).
 */

// ---------------------------------------------------------------------------
// Seeded PRNG
// ---------------------------------------------------------------------------

/**
 * Creates a deterministic pseudo-random number generator using the mulberry32 algorithm.
 *
 * Mulberry32 is a fast, well-distributed 32-bit PRNG suitable for simulation work.
 * Given the same seed, the generator always produces the same sequence of numbers.
 * This allows reproducible simulation results for testing, debugging, and
 * comparative analysis.
 *
 * @param seed - An integer seed value. Different seeds produce different sequences.
 * @returns A function that returns a new pseudo-random number in [0, 1) each time
 *   it is called. The sequence is deterministic for a given seed.
 *
 * @example
 * ```ts
 * const rng = createSeededRandom(42);
 * rng(); // always returns the same first value for seed 42
 * rng(); // always returns the same second value for seed 42
 * ```
 */
export function createSeededRandom(seed: number): () => number {
  let state = seed | 0;

  return function mulberry32(): number {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------------------------------------------------------------------------
// Game outcome sampler
// ---------------------------------------------------------------------------

/**
 * Samples a single game outcome based on the win probability for team A.
 *
 * Compares a random value to the provided win probability. If the random
 * value is less than the probability, team A wins; otherwise, team B wins.
 *
 * The second parameter can be either:
 * - A number in [0, 1): used directly as the random draw
 * - A function returning a number in [0, 1): called to produce the random draw
 * - Omitted: defaults to Math.random()
 *
 * @param winProbabilityA - The probability (0-1) that team A wins the game
 * @param random - A random value (number) or random generator function.
 *   Defaults to Math.random if omitted.
 * @returns 'A' if team A wins, 'B' if team B wins
 *
 * @example
 * ```ts
 * // With a direct random value
 * sampleGameOutcome(0.7, 0.3); // 'A' (0.3 < 0.7)
 * sampleGameOutcome(0.7, 0.8); // 'B' (0.8 >= 0.7)
 *
 * // With a seeded PRNG function
 * const rng = createSeededRandom(42);
 * sampleGameOutcome(0.7, rng); // deterministic result
 * ```
 */
export function sampleGameOutcome(
  winProbabilityA: number,
  random: number | (() => number) = Math.random
): "A" | "B" {
  const randomValue = typeof random === "number" ? random : random();
  return randomValue < winProbabilityA ? "A" : "B";
}
