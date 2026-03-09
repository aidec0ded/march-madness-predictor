/**
 * Few-shot example narratives for the AI matchup narrative prompt.
 *
 * These examples demonstrate the desired style, structure, and level
 * of data grounding. They teach the model:
 * 1. How to structure the 5-section output
 * 2. How to synthesize interaction effects (not just list stats)
 * 3. How to incorporate pool context into the recommendation
 * 4. How to be direct with recommendations without hedging
 */

export const EXAMPLE_NARRATIVES = [
  {
    context:
      "Round of 64. 3-seed (strong, experienced, moderate tempo) vs 14-seed (undersized, 3PT-dependent, fast pace). Medium pool.",
    narrative: `## Rating Profile

The 3-seed holds a commanding efficiency edge at +18.7 AdjEM versus +2.1, a gap that typically translates to a 12-point spread. Both KenPom and Torvik agree within a point, lending confidence to the composite. The 3-seed ranks in the top 15 nationally in defensive efficiency.

## Stylistic Matchup

This is a pace-control game. The 14-seed wants to push tempo (72.4 adj) to generate extra possessions and create variance with a 41% three-point attempt rate. The 3-seed prefers a methodical pace (65.8 adj). If the 3-seed dictates tempo — and their defensive possession length of 17.2 seconds suggests they can — the game stays in the mid-60s possessions range, compressing outcomes and limiting the 14-seed's paths to an upset. The 14-seed's 34.2% three-point percentage on high volume makes them a classic boom/bust team.

## Key Factors

The critical interaction is the 14-seed's offensive rebounding rate of just 23.1% against the 3-seed's height advantage (76.8" vs 74.1") and defensive rebounding. When the threes aren't falling — and with a 34.2% rate, they won't in roughly half of simulations — the 14-seed has no second-chance mechanism. Additionally, the 3-seed's roster experience (2.68 years) versus the 14-seed's (1.42 years) is a meaningful edge in a tournament setting.

## How This Game Plays Out

Expect the 3-seed to control pace from the opening tip. The 14-seed will launch threes early — if they connect on 5+ in the first half, this stays competitive into the final 10 minutes. More likely, the 3-seed builds a double-digit lead by halftime through defensive stops and free throw line trips (FT Rate 38.2% vs 28.1%), and the 14-seed's three-point variance never materializes.

## Recommendation

Take the 3-seed at 84% win probability. In a medium pool, their ownership at 91% is reasonable and the leverage score doesn't flag this as an avoid. This is not the matchup to get cute — save your contrarian picks for tighter games where the edge is thinner and the ownership skew is greater.`,
  },
];
