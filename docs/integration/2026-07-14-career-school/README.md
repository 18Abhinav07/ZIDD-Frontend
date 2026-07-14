# Career/School Integration Attestation

Repository: `ZIDD-Frontend`

- Frozen Career parent: `42d601d54fd0a6728522b5e5fcecceb81ae83e6c`
- Frozen School parent: `8dd40b2c13002f94dc3b76e270c66c6366fa9956`
- Merge base: `186ceba71d19777eedbcdbf84aaafc132706e26d`
- Resolved core tree: `4217e66455c753a925635fcc9d7c282a1cd9009d`
- Ownership rows: `136`
- Manual/integration patch paths: `48`
- Manifest SHA-256: `1eee9c1ca2d9962e78bffb062acdd5020ab4e90645440d01e966c963b0deedd8`
- Patch SHA-256: `5e80b74c5771617399fd31751420a66109c46a0f91e85b0719b22ffb04d0f954`

The ownership manifest covers every path changed by the frozen School parent and
every resolved application path that differs from the frozen Career parent.
Attestation metadata under this directory is excluded from the core tree to
avoid recursive self-hashing; `manifest.lock` binds the manifest and patch.

Reproduce from a clean clone:

```bash
python3 scripts/reproduce_career_school_integration.py   --career 42d601d54fd0a6728522b5e5fcecceb81ae83e6c   --school 8dd40b2c13002f94dc3b76e270c66c6366fa9956   --manifest docs/integration/2026-07-14-career-school/ownership-manifest.tsv   --patch docs/integration/2026-07-14-career-school/career-preimage.patch   --lock docs/integration/2026-07-14-career-school/manifest.lock
```
