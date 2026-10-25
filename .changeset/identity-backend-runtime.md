---
"backend": patch
---

Reduce the Debian slim backend runtime by excluding package managers, development headers and dependency-only documentation, type declarations and source maps. Preserve Node 22, native modules, compiled migrations and the operational TypeORM CLI.
