# Shahr Azad: Los Santos

A professional, multi-language, GTA-like 3D open-world game for the web.

- **Play:** open `index.html` on GitHub Pages, or run a local static server.
- **Languages (programming):** HTML, CSS, JavaScript (ES modules), GLSL (shaders), Python (build script), Markdown, JSON.
- **Languages (interface):** Persian (فارسی), English, Arabic (العربية) — switch with the buttons on the top-left.
- **Engine:** WebGL with no libraries and no external assets. All models are boxes built in code, in the low-poly style of the PS2 era.
- **Gameplay:** third-person camera, walk, enter/exit cars, traffic, pedestrians, police wanted stars, gold coins, 3 missions, minimap, saved money and progress in `localStorage`.

## Structure

```
index.html          HTML shell + HUD
css/style.css       CSS styling
js/main.js          Game logic, input, camera, rendering
js/engine.js        WebGL engine + matrix math
js/world.js         City grid, buildings, parks, palms
js/i18n.js          Persian / English / Arabic strings
shaders/*.glsl      GLSL vertex + fragment shaders
tools/build.py      Python: check that all JS files parse
manifest.json       PWA manifest
```

## Build check (Python)

```bash
python3 tools/build.py
```

This only checks syntax and file sizes; it does not change the game.

## Controls

- Keyboard: `W` gas, `S` brake, `A`/`D` steering, `E` enter/exit, `Space` handbrake.
- Mobile: joystick up = gas, left/right = steering; left buttons are gas, brake and enter.
