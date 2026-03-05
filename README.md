# Philosophia — Western Thought in 3D

An interactive 3D exploration of the major philosophers of Western civilization, spanning 600 BCE to 1951 CE. Each philosopher is rendered as a glowing node in a galaxy overworld; clicking a node transports you into a unique 3D environment representing that philosopher's worldview, built with procedural shaders and interactive hotspots.

## Philosophers

| Philosopher | Period | World |
|---|---|---|
| Plato | 428–348 BCE | Allegory of the Cave — firelit cavern with ascending Platonic Forms |
| Aristotle | 384–322 BCE | Greek garden with taxonomy trees, the Unmoved Mover, and celestial spheres |
| Descartes | 1596–1650 | Baroque study that dissolves into pure cogito and Cartesian grid |
| Spinoza | 1632–1677 | Infinite crystal lattice of Substance with streaming attributes |
| Hume | 1711–1776 | Misty archipelago of impressions connected by fraying bridges |
| Kant | 1724–1804 | Cathedral of cognition — stone columns, frosted windows, sealed door to the noumenal |
| Hegel | 1770–1831 | Dialectical helix rising through thesis, antithesis, and synthesis |
| Nietzsche | 1844–1900 | Ruins under a cycling eternal sky with a spiral staircase and Zarathustra's mountain |
| Wittgenstein | 1889–1951 | Tractatus logic space divided from the Investigations marketplace by a wall of silence |

Each world contains clickable hotspot markers that open detailed panels on the philosopher's key concepts and arguments.

## Stack

- **Three.js** — 3D rendering, custom ShaderMaterials, post-processing
- **Vite** — build tool and dev server
- **GSAP** — scene transition animations
- **Vanilla JS** — no framework

## Features

- Galaxy overworld with 6,000 stars, FBM nebulae, and animated influence lines between philosophers
- Procedural materials on all surfaces: cave stone, marble, ash ground, volcanic rock, wood grain, mossy rock, dark polished stone
- UnrealBloom post-processing with per-world bloom strength
- Custom OrbitControls — drag to orbit (works even over UI panels), scroll to zoom
- Sliding concept panel with philosophical content for each hotspot
- Fully responsive

## Running locally

```bash
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173).
