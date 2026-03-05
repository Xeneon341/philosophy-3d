# Philosophia — Western Thought in 3D

An interactive 3D exploration of eleven major philosophers of Western civilization, spanning 428 BCE to 1951 CE. Each philosopher is rendered as a glowing node in a galaxy overworld; clicking a node transports you into a unique 3D environment representing that philosopher's worldview, built with procedural shaders and interactive hotspots.

## Philosophers

| Philosopher | Period | World |
|---|---|---|
| Plato | 428–348 BCE | Allegory of the Cave — firelit cavern with puppet masters, ascending Platonic Forms, and particle stream |
| Aristotle | 384–322 BCE | Greek garden with taxonomy trees, circling birds, the Unmoved Mover, and pulsing celestial spheres |
| Aquinas | 1225–1274 | Gothic cathedral with stained-glass lancet windows, Great Chain of Being, pews, candles, and incense |
| Descartes | 1596–1650 | Baroque study with desk and quill that dissolves into pure cogito, then a Cartesian grid of geometric solids |
| Spinoza | 1632–1677 | Infinite crystal lattice of Substance with streaming attribute particles and a luminous central node |
| Hume | 1711–1776 | Misty archipelago of sense impressions — flame, apple, thunder, ice, sweetness, pain — on rocky islands connected by fraying bridges |
| Kant | 1724–1804 | Cathedral of cognition with frosted phenomenal windows, a filled moral-law star, and a sealed noumenal door |
| Hegel | 1770–1831 | Double-helix dialectic spiraling upward — thesis and antithesis strands, synthesis nodes, rising lava dais |
| Nietzsche | 1844–1900 | Ruins under a cycling eternal sky, a fallen "God is Dead" monument, Zarathustra's mountain, and a spiral staircase |
| Foucault | 1926–1984 | Panopticon watchtower with surveillance ring, prison cells, archive wall, and animated prisoner figures |
| Wittgenstein | 1889–1951 | Tractatus logic space (cold, propositional) divided by a wall of silence from the Investigations marketplace (warm, language-games) |

Each world contains clickable hotspot markers that open detailed panels on the philosopher's key concepts and arguments.

## Stack

- **Three.js** — 3D rendering, custom ShaderMaterials, UnrealBloom post-processing
- **Vite** — build tool and dev server
- **GSAP** — scene transition animations
- **Vanilla JS** — no framework

## Features

- Galaxy overworld with 6,000 stars, FBM nebulae, and animated influence lines between philosophers
- Procedural materials on all surfaces: cave stone, marble, ash ground, volcanic rock, wood grain, mossy rock, dark polished stone
- Per-world custom sky shaders — each world has a unique atmospheric background
- Custom OrbitControls — drag to orbit, scroll to zoom
- Sliding concept panel with philosophical content for each hotspot
- Fully responsive

## Running locally

```bash
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173).
