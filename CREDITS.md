# Oriole — Third-Party Credits

## Content Sources

### Word List — National Institute of Korean Language (NIKL)
- **Source:** 한국어 학습용 어휘 목록 (Korean Learner Vocabulary List)
- **Publisher:** National Institute of the Korean Language (국립국어원), Republic of Korea
- **URL:** https://www.korean.go.kr/front/etcData/etcDataView.do?mn_id=46&etc_seq=71
- **Licence:** KOGL Type 1 (공공누리 제1유형) — equivalent to CC-BY. Free to use and redistribute with attribution.
- **Attribution required:** Yes — the source must be clearly credited as the National Institute of the Korean Language (국립국어원).

> **TODO (before shipping):** The app's About / Credits screen **must** display the following attribution:
> *"Korean vocabulary list sourced from the National Institute of the Korean Language (국립국어원), 한국어 학습용 어휘 목록, licensed under KOGL Type 1."*

---

### Meanings — kengdic
- **Source:** kengdic Korean–English dictionary
- **Author:** Joe Speigle (original); maintained by Nathan Glenn (garfieldnate)
- **URL:** https://github.com/garfieldnate/kengdic
- **Licence:** MPL-2.0 or LGPL v2.0+ (dual licence, user's choice)
- **Attribution required:** Yes — credit the source when distributing derived data.

> **TODO (before shipping):** The app's About / Credits screen **must** display the following attribution:
> *"English glosses sourced from kengdic by Joe Speigle (github.com/garfieldnate/kengdic), licensed under MPL-2.0 / LGPL."*

---

## Build-Time Tooling

### Romaniser — KOROMAN
- **Package:** `koroman` (npm)
- **Author:** Donghe Youn / Daissue (gerosyab)
- **URL:** https://github.com/gerosyab/koroman
- **Licence:** MIT
- **Usage:** Build-time only. Not bundled in the shipped app.
- **Attribution:** Not legally required (MIT), but acknowledged here as good practice.

---

## Notes

- All sources listed above are used **build-time only** to generate `assets/content/korean.json`.
- The romaniser (`koroman`) is applied with pronunciation rules enabled and a small correction shim for two known failures (있다 → itta, 십육 → simnyuk); see `scripts/romanize.ts`.
- The phrase tier (~12 items) is **provisional** and was drafted from standard Korean learner resources. It has **not** been native-speaker validated. A native-speaker review of all romanisations and meanings is required before release.
