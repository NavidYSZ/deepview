# Known Bugs and Fixes

## Flackern beim Expand/Display-Toggle
- **Symptom:** Beim Hover/Klick auf ▼ oder beim Display-Button flackerten Karten; Unterkarten erschienen millisekundenweise oder alles verschwand.
- **Ursache:** Mehrfache Rebuilds durch rekursive `rebuildGraph`-Aufrufe und State-getriebene Effekte (expanded/showAll), plus Positions-Mischung (alte Positionen in neues Layout injiziert).
- **Fix:** Expanded/ShowAll auf Refs umgestellt; `rebuildGraph` wird nur einmal pro Aktion aufgerufen und nutzt explizit übergebene Sets/Flags. Keine `useEffect`-Rebuilds, keine Positions-Overrides; neue Karten erhalten nur Fade-In, bestehende bleiben unverändert.
