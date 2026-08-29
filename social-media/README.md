# Social media exports

Finished clips for posting, not site assets. Deliberately **outside `public/`**
so they are not served or bundled into the build — nothing on the site links to
them, and a 1MB video shipping with every deploy for no reason is worth
avoiding. Move a file into `public/` only if a page starts using it.

| file | what it is | format |
| --- | --- | --- |
| `nobhad-codes-intro-square.mp4` | Intro, card flip each way, paw exit. Light take then dark. | 1080x1080, H.264, 30fps, 25s |

Remade with `bash scripts/capture/social-square.sh` — see
`scripts/capture/README.md` for what the capture scripts do and the things
worth knowing before changing them.
