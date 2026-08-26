# shir-openu.github.io

Source of the portfolio site of Shir Sivroni, PhD — mathematics subject-matter review, scientific QA, interactive STEM learning tools, data analysis and research prototypes.

**Live:** <https://shir-openu.github.io/>

## What is here

A static GitHub Pages site. Each section is a self-contained folder of browser-only pages;
there is no build step, no framework and no server component.

| Path | Content |
|---|---|
| [`ode/`](https://shir-openu.github.io/ode/) | Interactive ordinary-differential-equation tools: direction fields, differential operators, equation solvers |
| [`ode-first-order/`](https://shir-openu.github.io/ode-first-order/) | Animated lessons on first-order ODEs: isoclines, initial value problems, envelopes, orthogonal families, singular solutions |
| [`hopfield/`](https://shir-openu.github.io/hopfield/) | Hopfield-network energy-landscape visualization and interactive network implementation |
| [`publications/`](https://shir-openu.github.io/publications/) | Peer-reviewed research and LaTeX typesetting samples |
| [`demos/`](https://shir-openu.github.io/demos/) | Small demos: symbolic maths solver, descriptive statistics, regression and correlation |
| [`kids/`](https://shir-openu.github.io/kids/) | Interactive geometry exercises for children |
| `beacon.js` | Page-load counter. GitHub publishes no analytics for Pages, so visits are counted here |

## Built with

HTML · CSS · vanilla JavaScript · MathJax · SVG and Canvas. No dependencies to install.

## How to run locally

```bash
git clone https://github.com/shir-openu/shir-openu.github.io.git
cd shir-openu.github.io
python -m http.server 8000
```

Then open <http://localhost:8000/>. A plain static server is required because some pages
fetch neighbouring files; opening `index.html` directly from the filesystem may block those
requests.

## Status

Actively maintained. Individual project folders are at different stages — several are
research prototypes rather than finished products, and each one says so on its own page.

## Contact

Shir Sivroni, PhD — [shirsivroni@gmail.com](mailto:shirsivroni@gmail.com) ·
[LinkedIn](https://www.linkedin.com/in/shir-sivroni-51b335400) ·
[ORCID](https://orcid.org/0009-0000-2597-2824)

Available for clearly scoped contract work performed 100% remotely from home in Israel.
