-- Add seed_matchups column to tournament_sites.
-- For R64/R32 pod sites, this stores which seed lines play at this venue.
-- Example: {1,16,8,9} means the 1v16 and 8v9 games are at this site.
-- NULL means "all games for this round/region" (S16/E8/F4/NCG behavior).

ALTER TABLE tournament_sites
  ADD COLUMN seed_matchups INTEGER[] DEFAULT NULL;

-- Validate seed values are 1-16 when present
ALTER TABLE tournament_sites
  ADD CONSTRAINT tournament_sites_seed_matchups_range
  CHECK (
    seed_matchups IS NULL
    OR (
      array_length(seed_matchups, 1) > 0
      AND seed_matchups <@ ARRAY[1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16]
    )
  );
