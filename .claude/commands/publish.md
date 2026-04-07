## npm publish workflow for frourio-framework-prisma-generators

Run the full release pipeline: version bump, build, PR, merge, and npm publish.

### Steps

1. **Determine version**: Read `@prisma/client` version from `package.json` dependencies. The package version MUST align with Prisma's major.minor (e.g., Prisma 7.6.0 -> package 7.6.0). If a same major.minor version is already published, use the next patch (e.g., 7.6.1).

2. **Typecheck**: Run `npm run typecheck` and confirm it passes.

3. **Build & Generate**: Run `npm run generate` and confirm models are generated correctly.

4. **Bump version**: Update `version` in both `package.json` and `package/package.json`, then run `npm install --package-lock-only` to sync `package-lock.json`.

5. **Commit version bump**: Commit the version change files (`package.json`, `package/package.json`, `package-lock.json`).

6. **Push & Create PR**: Push the branch and create a PR to `main` with a summary of changes.

7. **Merge PR**: After PR is created, merge it to `main`.

8. **Checkout main & pull**: Switch to `main` and pull the merged changes.

9. **Build package**: Run `./package.sh` to build the publishable package.

10. **Handle lock file changes**: If `npm update` causes uncommitted changes, commit them before proceeding.

11. **Publish**: Run `cd package && npm publish`. Authentication is configured in `~/.npmrc`.

12. **Push main**: Push the final state of `main` to origin.

### Notes
- Always check `npm view frourio-framework-prisma-generators versions --json` to verify which versions are already published.
- The `package:publish` script may fail on `check-uncommitted` if `npm update` modifies `package-lock.json`. In that case, build and publish manually with `./package.sh && cd package && npm publish`.
