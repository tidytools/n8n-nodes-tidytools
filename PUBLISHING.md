# Publishing and n8n verification

Source audit: [verification checklist](docs/verification-checklist.md). This directory is currently inside the private GetMoney repository. The workflow here is a template; GitHub Actions only reads it when this package is at the root of a public standalone repository.

## Local checks before handoff

Run from this directory: npm install --no-audit --no-fund, npm run lint, npm run typecheck, npm test, npm run build and npm pack --dry-run. Check that the pack list contains dist, three example workflows, README.md, LICENSE and package.json, and contains English-only documentation. Offline tests cover all five operations. Live checks and importing the example workflows into n8n require the package and credentials; keep those results separate.

## User publication steps

1. Sign in to npm. The package name is unscoped (n8n-nodes-tidytools), so an npm organization is optional. Confirm that the name is available and that the publishing account owns it.
2. Create or choose a public GitHub repository at the exact repository URL in package.json. Put the contents of this directory, including .github/workflows, at its root. Before making that repository public, confirm every copied document and node interface string is in English; do not include local translations or other non-English notes. The npm repository metadata and GitHub repository must match exactly for provenance.
3. For the first publication, configure an npm granular publish token with the narrowest scope available for an unpublished package as GitHub Actions secret NPM_TOKEN. This must be done by the user; do not put the token in source or this ticket. The first release cannot use npm Trusted Publishing until the npm package settings exist.
4. Check package.json version and CHANGELOG.md. Push a matching v-prefixed tag, for example v0.1.0. The publish workflow checks the version and npm >=11.5.1, installs dependencies, runs lint/typecheck/test/build, and publishes with npm provenance. It is intentionally not run by this task's executor.
5. Check the GitHub Actions result, npm package version and provenance badge. Then set npm Trusted Publishers to the same GitHub owner, repository and publish.yml workflow. Remove the NPM_TOKEN secret before pushing the next version tag to confirm OIDC-only publishing.
6. Run the n8n community package scanner on the published name, import and run examples with valid credentials in n8n, then submit through the [Creator Portal](https://creators.n8n.io/nodes). n8n decides whether a node spanning TidyTools operations on RapidAPI and Apify satisfies its one-service rule. Also resolve the Apify OAuth gap in the verification checklist before claiming full UX compliance.

Publication, token setup, external live checks and Creator Portal submission are user/external steps. Do not mark the package verified until n8n approves it.

## Endpoint checks

The RapidAPI credential test calls one request on the selected subscribed Contact or SEO API, using example.com. The Apify credential test calls /v2/users/me. A valid key without a subscription to the selected RapidAPI API may fail the test. Real credential tests have not been completed by this source review.
