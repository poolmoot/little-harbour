<div align="center">

# ⚓ Little Harbour

**A cosy 3D harbour business game that runs in your browser.**
Catch fish, race the spoilage clock, and grow a tiny dock into a seafood empire.

![Three.js](https://img.shields.io/badge/Three.js-000000?style=for-the-badge&logo=threedotjs&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-646CFF?style=for-the-badge&logo=vite&logoColor=white)
![Vitest](https://img.shields.io/badge/Vitest-6E9F18?style=for-the-badge&logo=vitest&logoColor=white)
![Deployed on Vercel](https://img.shields.io/badge/Vercel-000000?style=for-the-badge&logo=vercel&logoColor=white)

</div>

## ✨ Highlights

- 🌊 **Hand-written water shader**, day/night cycle, weather and storms
- 🎨 **Zero downloaded assets.** Every model, texture and sound is generated in code
- 🎵 **Procedural music and ambience** with Web Audio
- 📈 **Tycoon depth:** boats, crews, contracts, buildings and a legendary King Fish
- ⚡ **Light and smooth:** instancing, adaptive quality, 60 fps target

## 🚀 Run it

```bash
npm install
npm run dev     # http://localhost:5173
npm run check   # type check + tests
npm run build   # production build in dist/
```

## 🧱 How it's built

| Layer | Folder | Job |
| --- | --- | --- |
| Rules | `src/sim/` | Pure TypeScript game logic, seeded RNG, fully unit tested |
| Drawing | `src/view/` | Three.js scene, reads state, never changes it |
| Interface | `src/ui/` | HTML HUD and windows over the canvas |
| Sound | `src/audio/` | Web Audio music and effects |

Game rules and rendering are strictly separated, and a test enforces it.
A scripted player checks that the game's pacing stays fun.

## 🛠 Stack

Three.js · TypeScript (strict) · Vite · Vitest · no backend, saves to `localStorage`
