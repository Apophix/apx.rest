---
"apx.rest": patch
---

Fix configs with more than one entry in `apis`. The config reader saved the first entry and ignored later ones, so every iteration generated the first client again and the other clients were never written. Each entry in `apis` now uses its own settings.
