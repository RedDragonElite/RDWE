# Sound credits

All recordings below were taken from [Stunt Rally 3](https://github.com/stuntrally/stuntrally3)
(`data/sounds/`), trimmed into loops / converted to mono MP3 for this game.

| Files | Source | Author | License |
|---|---|---|---|
| `engines/*.mp3` (su-mid, su-ss, b-i6r, gv8, v8f, v12d, b-v8, ds8, electric) | engines recorded at steady rpm in [engine-sim](https://github.com/ange-yaghi/engine-sim), cut + EQ | CryHam | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) |
| `car/crash01–12.mp3` | crash hits cut from freesound.org #121668, #121665, #121664, #121685 | Halleck, edited by CryHam | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) |
| `car/gear_shift1.mp3`, `car/gear_shift4a.mp3` | cut from the crash hits above | Halleck / CryHam | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) |
| `car/turbo2.mp3` | made from noise in Audacity | CryHam | [CC0](https://creativecommons.org/publicdomain/zero/1.0/) |
| `car/turbo4.mp3` | from freesound.org #87606 "fuchslienshroud.wav" | shimsewn, edited by CryHam | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) |

Changes: trimmed to seamless loops with a baked crossfade, loudness-normalised, resampled to 22.05 kHz mono, MP3 64 kbit/s.

Gunshots are not recordings: they are rendered at start-up from a physical model (Friedlander
blast wave, ground bounce, facade reflections, urban reverb tail, microphone overload) in
`js/audio/samples.js`.
