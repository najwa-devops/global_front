# Project Structure Roadmap

## 1. Goal
Adopt a feature-first MVVM architecture that keeps behavior stable while making the codebase easier to maintain and extend.

## 2. Target Structure
```text
src/
  app/
    ...routes

  core/
    api/
      httpClient.ts
    lib/
      ...legacy domain modules being normalized
    services/
      authService.ts
    utils/
    config/

  features/
    auth/
      model/
      viewmodel/
      view/
    dashboard/
      model/
      viewmodel/
      view/
    ocr/
      model/
      viewmodel/
      view/
    bank/
      model/
      viewmodel/
      view/
    navigation/
      model/
      viewmodel/
      view/

  shared/
    components/
    hooks/
    styles/

  App.tsx
```

## 3. Current Progress (Done)
- Core layer initialized:
  - `src/core/api/httpClient.ts`
  - `src/core/services/authService.ts`
  - `src/core/config/index.ts`
  - `src/core/utils/index.ts`
- Physical relocation completed:
  - root `app/` moved to `src/app/`
  - root `components/` moved to `src/shared/components/`
  - root `hooks/` moved to `src/shared/hooks/`
  - root `lib/` moved to `src/core/lib/`
- Feature folders created and partially migrated:
  - `auth`, `dashboard`, `ocr`, `bank`, `navigation`
- Entry pages already wired to feature views in key flows:
  - `src/app/login/page.tsx`
  - `src/app/dashboard/page.tsx`
  - `src/app/ocr/[id]/page.tsx`
  - `src/app/bank/ocr/[id]/page.tsx`
  - `src/app/bank-1/ocr/[id]/page.tsx`
- Heavy OCR/Bank UI files moved under `src/features/*/view/`.
- Backward-compatible re-export layers kept in:
  - `src/models/*`
  - `src/view-models/*`
  - `src/config/navigation.config.ts`

## 4. Migration Principles
1. No behavior regressions: keep existing API contracts and UI behavior.
2. Incremental migration: move one feature at a time.
3. Compatibility first: keep thin wrappers/re-exports until all imports are migrated.
4. Type safety gate: every phase must pass `npx tsc --noEmit`.
5. Avoid big-bang rename operations.

## 5. Post-Migration Plan

### Phase A: Wrapper Cleanup
- Remove remaining compatibility re-exports in:
  - `src/models/*`
  - `src/view-models/*`
  - `src/config/navigation.config.ts`
- Enforce direct feature imports only.

### Phase B: Core Normalization
- Gradually split `src/core/lib/*` into:
  - `src/core/utils/*` for cross-cutting helpers
  - `src/features/*/model/*` for feature-owned domain logic

### Phase C: Shared Governance
- Keep `src/shared/*` strictly for reusable, presentational, cross-feature modules.
- Move feature-specific components out of shared space.

## 6. Owner and Timeline (Proposed)

### Roles
- Tech Lead:
  - Validate architecture boundaries (`core` vs `shared` vs `features`)
  - Approve wrapper removals and final cleanup PRs
- Feature Owners (Auth, OCR, Bank, Navigation, Dashboard):
  - Execute migration for assigned feature
  - Ensure page entrypoints remain thin
- QA/Reviewer:
  - Run regression checks on migrated routes
  - Validate no user-flow breakages

### Weekly Plan
1. Week 1 (Wrapper cleanup)
- Owner: Tech Lead + feature owners
- Scope:
  - Remove `src/models/*` and `src/view-models/*` compatibility layers
  - Remove `src/config/navigation.config.ts` compatibility re-export
- Exit criteria:
  - No imports from compatibility paths remain
  - `npx tsc --noEmit` clean

2. Week 2 (Core/feature boundaries hardening)
- Owner: Tech Lead
- Scope:
  - Move feature-owned logic from `src/core/lib/*` into `src/features/*/model/*`
  - Keep only truly cross-cutting utilities under `src/core/*`
- Exit criteria:
  - `src/core/lib/*` minimized to cross-feature modules
  - No duplicated domain mapping logic

3. Week 3 (Shared governance + regression)
- Owner: QA/Reviewer + Tech Lead
- Scope:
  - Ensure `src/shared/*` contains only reusable modules
  - Regression test key routes: login, dashboard, OCR, bank, dossiers
- Exit criteria:
  - Build + typecheck green
  - Critical user flows pass smoke/regression checks

### Delivery Cadence
- PR size target: 300-700 lines changed (except mechanical import updates)
- Review SLA: 1 business day
- Merge rule: no failing typecheck/build, no unresolved architecture comments

## 7. Import Rules (Target)
- Feature-to-feature import: only through explicit public modules when possible.
- Feature internals should not import from legacy paths.
- Use aliases:
  - `@/app/...`
  - `@/components/...` -> resolves to `src/shared/components/*`
  - `@/hooks/...` -> resolves to `src/shared/hooks/*`
  - `@/lib/...` -> resolves to `src/core/lib/*`
  - `@/src/features/...`
  - `@/src/core/...`
  - `@/src/shared/...`

## 8. Definition of Done Per Feature
A feature migration is complete when:
1. `model`, `viewmodel`, and `view` folders exist and are used.
2. `src/app/*` pages are thin entrypoints only.
3. No imports from legacy `src/models/*` or `src/view-models/*` for that feature.
4. No logic-heavy code remains outside `src/features/*/view/` for that feature.
5. Type check passes.

## 9. Tracking Checklist
- [x] Core skeleton created
- [x] Auth feature bootstrap
- [x] Dashboard feature bootstrap
- [x] OCR feature bootstrap
- [x] Bank feature bootstrap
- [x] Navigation feature bootstrap
- [x] OCR full migration complete
- [x] Bank full migration complete
- [x] Navigation full migration complete
- [x] Shared extraction complete
- [x] Legacy wrapper removal complete

## 10. Commands for Validation
```bash
npx tsc --noEmit
npm run build
```

## 11. Risks and Mitigation
- Risk: broken imports during file moves.
  - Mitigation: keep compatibility wrappers and migrate imports in batches.
- Risk: hidden behavior regressions in large pages.
  - Mitigation: move orchestration first, then view files, then cleanup.
- Risk: duplicated logic during transition.
  - Mitigation: model functions become single source of truth early.
