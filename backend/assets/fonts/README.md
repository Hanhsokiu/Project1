Noto Serif Regular and Bold, downloaded unchanged from the archived official
`notofonts/noto-fonts` repository, `hinted/ttf/NotoSerif/`. License: OFL.txt.
Embedded locally so PDF rendering needs neither a network connection nor OS fonts.

Sources:
- https://github.com/notofonts/noto-fonts/tree/main/hinted/ttf/NotoSerif
- https://github.com/notofonts/noto-fonts/blob/main/LICENSE

These are bundled with the backend at `assets/fonts`, including in Docker's COPY.
Run the compiled app from backend as documented; the renderer resolves relative to
its module, independent of the current directory.
