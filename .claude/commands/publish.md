## npm publish workflow for frourio-framework-prisma-generators

Run the full release pipeline: version bump, build, PR, merge, and npm publish.

### Versioning

Version format: `{prisma_major}.{prisma_minor}.0-rev{N}`

- The major.minor MUST match Prisma's `@prisma/client` version in `package.json` dependencies
- The `-revN` suffix is our own revision counter for changes independent of Prisma
- First release for a Prisma version: `7.7.0-rev1`
- Subsequent releases: `7.7.0-rev2`, `7.7.0-rev3`, etc.
- When Prisma bumps: reset to `X.Y.0-rev1`

Examples:
- Prisma 7.7.0, first release → `7.7.0-rev1`
- Prisma 7.7.0, second release → `7.7.0-rev2`
- Prisma 7.8.0, first release → `7.8.0-rev1`

### Steps

1. **Determine version**: Read `@prisma/client` version from `package.json` dependencies. Check `npm view frourio-framework-prisma-generators versions --json` for published versions. Use the next `-revN` for the current Prisma major.minor.

2. **Typecheck**: Run `npm run typecheck` and confirm it passes.

3. **Test**: Run `npm run test` and confirm it passes.

4. **Build & Generate**: Run `npm run generate` and confirm models are generated correctly. Verify that `lib/generators/repository/` exists (repository generator must be included).

5. **Bump version**: Update `version` in `package.json`, then run `npm install --package-lock-only` to sync `package-lock.json`.

6. **Commit version bump**: Commit the version change files (`package.json`, `package-lock.json`).

7. **Push & Create PR**: Push the branch and create a PR to `main` with a summary of changes.

8. **Merge PR**: After PR is created, merge it to `main`.

9. **Checkout main & pull**: Switch to `main` and pull the merged changes.

10. **Build package**: Run `./package.sh` to build the publishable package.

11. **Verify package**: Confirm `package/lib/generators/repository/` exists. Confirm `package/package.json` has both `bin` entries (model and repository generators).

12. **Handle lock file changes**: If `npm update` causes uncommitted changes, commit them before proceeding.

13. **Publish**: Run `cd package && npm publish`. Authentication is configured in `~/.npmrc`.

14. **Tag**: Create and push a git tag: `git tag v{version} && git push origin v{version}`.

15. **Push main**: Push the final state of `main` to origin.

### Notes
- Always check `npm view frourio-framework-prisma-generators versions --json` to verify which versions are already published.
- The `package:publish` script may fail on `check-uncommitted` if `npm update` modifies `package-lock.json`. In that case, build and publish manually with `./package.sh && cd package && npm publish`.
- `@types/node` is in `dependencies` (not devDependencies) to prevent npm peer resolution issues on Node 24+.
