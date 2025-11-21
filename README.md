# GLITCH PORTFOLIO

A futuristic glitch-art portfolio built with Three.js and custom GLSL shaders.

## Quick Start
```bash
./start.sh
```

Then open: http://localhost:8000

## Controls

- **SHIFT×2** - Chaos Mode
- **SPACE** - Freeze Frame
- **1-4** - Switch Scenes
- **Mouse** - Parallax Camera

## Customize

Edit `index.html` line 36 to change your name:
```html
<h1 class="glitch-text" data-text="YOUR_NAME">YOUR_NAME</h1>
```

Edit `css/main.css` lines 12-20 to change colors.

## Structure
```
glitch-portfolio/
├── index.html
├── css/main.css
├── js/
│   ├── main.js
│   ├── modules/
│   └── shaders/
└── assets/
```

## Built With

- Three.js r168
- Custom GLSL Shaders
- Pure JavaScript (no frameworks)

**Press SHIFT twice when it loads!** 🌊⚡💾
