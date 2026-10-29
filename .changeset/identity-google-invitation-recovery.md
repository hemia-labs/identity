---
"backend": minor
"frontend": minor
---

Recover a deleted Identity account through a new or resent invitation and its previously linked Google account, preserving the same user ID. Bind the invitation cookie to signed OAuth state, validate its signed issuance date after deletion, and require the verified Google email to match the invitation. Keep locked, suspended and replacement accounts protected, invalidate old sessions and OAuth tokens, and audit the recovery.

Show an explicit user-not-found message for deleted Google accounts signing in without a recovery invitation. Organization membership still requires explicit invitation acceptance in Access.
