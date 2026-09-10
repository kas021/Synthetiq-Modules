# Recommended catalogue order

Owner-requested official video recommendations, in catalogue order:

1. AniKoto (`anikoto-v4`)
2. Synthetiq One (`synthetiq-one-v1`)
3. Synthetiq Anime (`synthetiq-anime-v1`)
4. Synthetiq Movies (`synthetiq-movies-v1`)
5. AniKage (`anikage-v1`)
6. YFlix (`yflix-v1`)
7. DramaCool (`dramacool-v1`)

All seven entries have `presentation.recommended: true`. Other catalogue
entries keep their relative order and existing presentation. No module ZIPs,
versions, playback code, bundle bytes or default selections change. Bundle 112
remains the current package; this is a signed catalogue metadata refresh.
Player's manual repository Check refreshes presentation and repository position
even when there is no newer module version to install.

## Existing app limitation

Player 8.5.33+95 (`2c7ba4b5`) sorts Recommended again after repository ordering:
`lib/widgets/module_source_selector.dart`, `_categoryPriority`, pins AniKoto,
Synthetiq One and Synthetiq Movies to positions 0, 1 and 2. The model exposes no
remote priority override. Consequently that build will display Movies before
Anime, even with this correct catalogue order, when all seven are installed and
linked to the same official repository. Other repositories or missing modules
can further affect the visible list.

The exact on-device request is not claimed complete. A separately authorized
app update must remove that Recommended-only hardcoded ranking or make it honor
the repository order. Do not rename module IDs, alter their code, or claim that
repository metadata alone overrides this logic. App code was not edited here.
