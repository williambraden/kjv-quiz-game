# Version History

This document tracks the project’s release and feature history. Use it to summarize what changed, what was added, and whether the update is major or minor.

## v0.5.1 - Stats display clarification

Date: 2026-09-24

### Scope
- Clarified profile summary rows as combined single-player and local multiplayer totals
- Removed stale duplicate stats writers from `quiz.js` after the stats-service extraction
- Confirmed local multiplayer writes only to `multiplayerStats`

### Files affected
- quiz.js
- VERSION_HISTORY.md

### Testing notes
- VS Code reports no errors in the updated files

## v0.5.0 - First game-code modularization

Date: 2026-09-24

### Scope
- Extracted profile and statistics responsibilities from the monolithic game script
- Added `profile-stats-service.js` for stats defaults, normalization, combined display totals, and stats writes
- Added `profile-service.js` for profile CRUD, profile loading, admin loading, and role helpers
- Added `quiz-data.js` for the Old Testament, New Testament, and combined Bible book lists
- Added `navigation.js` for screen switching, main-menu setup, and mode-button bindings
- Added `scoreboard.js` for live score rendering and score animations
- Added `local-multiplayer.js` for player setup, saved options, and local match startup
- Preserved existing global function names and UI behavior during the transition
- Loaded the new services before `quiz.js` from the main page

### Files affected
- index.html
- quiz.js
- profile-stats-service.js
- profile-service.js
- VERSION_HISTORY.md

### Testing notes
- VS Code reports no errors in the extracted services, main script, or HTML
- Gameplay logic remains in `quiz.js` for the next extraction phase

## v0.4.3 - Profile metadata editing

Date: 2026-09-24

### Scope
- Added online-capable versus local-only access selection to profile editing
- Keep normalized profile names synchronized when a profile is renamed
- Preserve the existing access mode when opening the edit form

### Files affected
- quiz.js
- VERSION_HISTORY.md

### Testing notes
- VS Code reports no errors in the updated files

## v0.4.2 - Profile avatar picker

Date: 2026-09-24

### Scope
- Added selectable emoji avatar options during profile creation
- Added the same avatar picker during profile editing
- Preserved the existing avatar value when opening the edit form

### Files affected
- quiz.js
- VERSION_HISTORY.md

### Testing notes
- VS Code reports no errors in the updated files

## v0.4.1 - Profile average display formatting

Date: 2026-09-24

### Scope
- Format displayed average scores to one decimal place
- Preserve full numeric precision in Firestore for future calculations

### Files affected
- quiz.js
- VERSION_HISTORY.md

### Testing notes
- VS Code reports no errors in the updated files

## v0.4.0 - Device profile memory and online access metadata

Date: 2026-09-24

### Scope
- Profile selection now shows only profiles remembered on the current device
- Added a name-and-PIN login path for profiles marked online-capable
- Added profile access metadata distinguishing online-capable and local-only profiles
- Added normalized profile names to support cross-device lookup
- Newly created or selected profiles are remembered locally for future device sessions
- Existing profiles remain online-capable by default when read for compatibility

### Files affected
- index.html
- quiz.js
- VERSION_HISTORY.md

### Testing notes
- VS Code reports no errors in the updated app files
- Firebase Rules must permit the authenticated name lookup query for online login

## v0.3.2 - Podium ranking and color refinement

Date: 2026-09-24

### Scope
- Corrected two-player podium placement to gold and silver
- Improved contrast between gold and bronze podium colors

### Files affected
- quiz.js
- VERSION_HISTORY.md

### Testing notes
- VS Code reports no errors in the updated files
- Removed a duplicate podium-place declaration that prevented the application script from loading

## v0.3.1 - Multiplayer result names and stats display

Date: 2026-09-24

### Scope
- Resolve selected profile names before local multiplayer matches
- Show saved profile names in final multiplayer results
- Add detailed local multiplayer statistics to the profile page

### Files affected
- quiz.js
- VERSION_HISTORY.md

### Testing notes
- VS Code reports no errors in the updated files

## v0.3.0 - Local multiplayer profiles and separate stats

Date: 2026-09-24

### Scope
- Added saved-profile selection or name entry for each local multiplayer player
- Added a separate `multiplayerStats` bucket so local multiplayer does not inflate single-player stats
- Added profile-page combined totals while retaining separate single-player and local multiplayer point totals
- Added automatic local multiplayer stat updates for selected profiles; name-only players remain session guests
- Resolved selected profile names before local multiplayer matches so final results show profile names instead of default player labels
- Added a detailed local multiplayer stats section to the profile page
- Improved podium colors so gold and bronze are visually distinct
- Corrected two-player podium ranking so players receive gold and silver instead of bronze and silver

### Files affected
- index.html
- quiz.js
- VERSION_HISTORY.md

### Testing notes
- VS Code reports no errors in the updated app files
- Existing profiles receive an empty multiplayer stats bucket through read-time normalization; no profile reset is required

## Versioning

- Major version: significant product or architecture changes
- Minor version: feature additions, workflow improvements, or backend updates that do not rewrite the app
- Patch version: small fixes, bug patches, and refinements

Convention:
- v0.1.0 = initial playable version
- v0.2.0 = new features or major app flow changes
- v0.2.1 = bug fix or minor improvement

---

## v0.2.2 - Main menu load and local reset correction

Date: 2026-09-24

### Scope
- Removed an orphaned leaderboard button line that caused `quiz.js` to fail parsing
- Restored the main page functions, including leaderboard and reset handlers
- Moved the reset button from the main menu into local multiplayer options
- Clarified that reset only clears the current local multiplayer scoreboard and does not erase Firebase lifetime stats
- Guarded the reset handler so it ignores calls outside local multiplayer mode

### Files affected
- index.html
- quiz.js
- VERSION_HISTORY.md

### Testing notes
- VS Code reports no errors in `quiz.js` or `index.html`
- Restored `screenMenu` to the screen-navigation registry so main menu buttons can switch views
- Restored the missing `editProfile` function declaration that caused an illegal top-level `return`
- Normalized older local multiplayer settings so missing talent data no longer breaks scoreboard startup
- Applied the same normalization when continuing a saved local game
- Limited Edit Profile access to the profile details view
- Removed the guest-profile status display from profile details
- Added saved-profile selection or name entry for each local multiplayer player
- Added a separate `multiplayerStats` bucket so local multiplayer does not inflate single-player stats
- Added profile-page combined totals while retaining separate single-player and local multiplayer point totals
- Added automatic local multiplayer stat updates for selected profiles; name-only players remain session guests

---

## v0.2.1 - Leaderboard and profile stats tracking

Date: 2026-09-24

### Scope
- Added a leaderboard screen and menu entry accessible from the main page
- Sorted leaderboard entries by total points, wins, and best score for quick comparison
- Connected the leaderboard to the saved profile lifetime stats so it reflects real player data
- Kept the leaderboard ready for future group rankings and achievement-based sorting

### Files affected
- index.html
- quiz.js
- VERSION_HISTORY.md

### Notes
- This updates the user-facing profile experience so the app can compare saved players as they progress
- The leaderboard now reflects data already captured by the profile stats model without needing a reset

---

## v0.1.0 - Initial project baseline

Date: 2026-09-24

### Current state
- Browser-based Bible quiz app with main menu, single-player, and local multiplayer flow
- Firebase initialized for anonymous auth and Firestore access
- Profile selection and PIN-protected profile access implemented
- Admin/group request and developer approval workflow started
- Lifetime stats and progression concepts planned for future work
- Local multiplayer supports player naming and session-based guest flow
- Developer dashboard exists for reviewing admin requests and managing admin/profile records

### Included features
- Basic Bible quiz gameplay
- Scoreboard and timer logic
- Multiple quiz styles including multiple choice, fill-in-the-blank, and scramble
- Player and round configuration screens
- Profile selection screen and profile creation flow
- Admin/group registration request process
- Developer approval gating for admin status

### Current known concerns
- PIN hashing/validation logic is inconsistent and should be standardized
- Backend structure should be simplified to match the actual app needs
- Firebase collections and security rules should be clarified before expanding profile/stat features
- Developer dashboard is useful but should be treated as a management tool, not a core requirement for app functionality

### Notes
- This version serves as the foundation for expanding into profile-based leaderboards, achievements, campaign progression, and online multiplayer
- Future versions should separate the game logic, backend data model, and admin tooling more cleanly

---

## v0.1.1 - Planning and backend alignment

Date: 2026-09-24

### Scope
- Clarified the project direction around profiles, lifetime stats, local guest players, and future online multiplayer support
- Decided that Firebase is the actual backend system while the dashboard is a convenience layer rather than a core requirement
- Established a working pattern for tracking feature changes in this document as the project evolves

### Decisions
- The app should prioritize profile-based play, lifetime progression, and scalable backend structure
- Local multiplayer will support both saved profiles and session-based guest players
- Firebase should house persistent player and admin data, while online multiplayer live state can be separated later if needed
- GitHub is treated as version control and deployment tracking, not as the required place for every backend test

### Notes
- This entry marks the shift from raw app building into structured product planning and backend architecture
- The next implementation steps should focus on standardizing profile PIN logic and defining the Firestore schema

---

## v0.1.2 - Profile ownership model defined

Date: 2026-09-24

### Decision
- Standardized the long-term profile model around a separate profile document ID plus an explicit ownerUid field
- Chose this over forcing the auth UID to equal the profile document ID
- Kept the developer dashboard as a management layer for searching and editing profiles efficiently

### Why this model
- Supports multiple profiles per user in the future
- Makes dashboard-based profile lookups and edits simpler
- Keeps profile identity separate from auth identity
- Aligns with the current app direction around group/admin records and lifetime stats

### Planned implementation
- Store profileId as the Firestore document ID
- Store ownerUid, name, avatar, color, role, adminId, pinHash, createdAt, updatedAt, and lifetimeStats in the profile document
- Use developer rules for global profile management and owner-based editing via ownerUid
- Keep local guest players out of Firestore unless explicitly converted into a saved profile

---

## v0.2.0 - Standardized profile PIN and ownership model

Date: 2026-09-24

### Scope
- Standardized all profile PIN checks to a single SHA-256 hash flow
- Kept profile document IDs separate from auth UID while storing explicit ownerUid metadata
- Prevented profile edits from overwriting the profile object and dropping key fields
- Updated the developer dashboard to treat hashed PINs as non-reversible values

### Files affected
- quiz.js
- developer-dashboard.js
- VERSION_HISTORY.md

### Notes
- This update fixes the real logic mismatch that was preventing a stable profile system from working reliably
- The app now aligns with the Firebase design we agreed on before expanding into lifetime stats and progression features

---

## Planned next updates

### Upcoming: v0.2.0
- Standardize profile PIN hashing and validation
- Finalize Firestore schema for profiles, stats, groups, admins, and achievements
- Add consistent lifetime stats structure for single-player and multiplayer
- Define how guest profiles and saved profiles work in local multiplayer
- Prepare foundation for campaign progression and unlock systems

### Later: v0.3.0+
- Add online multiplayer room flow
- Add realtime sync across devices
- Add leaderboard and achievement tracking
- Add campaign/book unlock progression
- Expand admin/group management tooling as needed

---

## Change log conventions

When updating this document, add entries in reverse chronological order with:
- version number
- date
- short summary of changes
- type: major / minor / patch
- key files affected
- testing notes if applicable
