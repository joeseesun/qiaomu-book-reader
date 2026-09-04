# Bundled reading fonts

Qiaomu Book Reader embeds five Chinese reading fonts into `main.js` so BRAT
and manual three-file installs do not depend on fonts installed on the device.
The gzip payloads contain byte-identical copies of the upstream Regular fonts;
their character sets, names and outlines are not modified.

| File | Upstream font | Upstream release | Source file |
| --- | --- | --- | --- |
| `SourceHanSerifCN-Regular.otf.gz` | Source Han Serif CN | 2.003R | `SourceHanSerifCN-Regular.otf` |
| `SourceHanSansCN-Regular.otf.gz` | Source Han Sans CN | 2.005R | `SourceHanSansCN-Regular.otf` |
| `LXGWWenKaiGBScreen-Regular.ttf.gz` | LXGW WenKai GB Screen | v1.522 | `LXGWWenKaiGBScreen.ttf` |
| `LXGWZhenKaiGB-Regular.ttf.gz` | LXGW ZhenKai GB | v0.825 | `LXGWZhenKaiGB-Regular.ttf` |
| `ZhuqueFangsong-Regular.ttf.gz` | Zhuque Fangsong technical preview | v0.212 prerelease | `ZhuqueFangsong-Regular.ttf` |

Gzip is only a release container: the plugin restores the byte-identical
upstream OTF/TTF before passing it to the browser FontFace API. The font files
are not subsetted, renamed or otherwise modified.

Upstream SHA-256 values before gzip packaging:

- `SourceHanSerifCN-Regular.otf`: `3754ea669c530e2473354f8f6d9f79680a44d7e26ec7d00eeabee4a7e0753c5d`
- `SourceHanSansCN-Regular.otf`: `e2bc8a2e7f37474b774fff8db758681ece40bb6947a90d571bce9dd60671a8e4`
- `LXGWWenKaiGBScreen.ttf`: `23ec023913e1851925eb94462c4b0ccd1d78bb89533745aaa8cc682ccd339dc0`
- `LXGWZhenKaiGB-Regular.ttf`: `40876902a7ce25268ab710ad8fe6e2b63bc002aa4b68d22fd45fc1243726ced5`
- `ZhuqueFangsong-Regular.ttf`: `558c62730844fe54ba220146ed62f859d4e2880188d92d985f8921c6e3743bc4`

Upstream projects:

- https://github.com/adobe-fonts/source-han-serif
- https://github.com/adobe-fonts/source-han-sans
- https://github.com/lxgw/LxgwWenKai-Screen
- https://github.com/lxgw/LxgwZhenKai
- https://github.com/TrionesType/zhuque

All five fonts are distributed under the SIL Open Font License 1.1. The full
license is in `OFL.txt` and is also embedded in the release `main.js` banner so
it remains present in BRAT's three-file installation model.

Zhuque Fangsong v0.212 is the upstream project's latest official technical
preview. It is exposed as an optional reading font rather than the plugin's
default, and its upstream status is recorded here so it is not mistaken for a
production-stable font release.
