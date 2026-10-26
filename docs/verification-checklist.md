# n8n verification checklist

Checked 2026-10-25 against [n8n verification guidelines](https://docs.n8n.io/connect/create-nodes/build-your-node/reference/verification-guidelines/), [submission instructions](https://docs.n8n.io/connect/create-nodes/deploy-your-node/submit-community-nodes/) and [npm provenance instructions](https://docs.npmjs.com/generating-provenance-statements/), [npm Trusted Publishing](https://docs.npmjs.com/trusted-publishers/) and [n8n UX guidelines](https://docs.n8n.io/connect/create-nodes/build-your-node/reference/ux-guidelines/). “Meets” means source evidence exists. “Does not meet” also covers external steps that are still unverified. A workflow template is not proof of a published package.

| Requirement | Status and evidence/location |
|---|---|
| n8n-node CLI conventions | Meets in source: package.json scripts, tsconfig.json, nodes/, credentials/. Scaffold origin is unverified. |
| Package naming and metadata | Meets: package.json name n8n-nodes-tidytools, community keyword and n8n manifest; test/description.test.mts checks wiring. |
| Unique action node for one service | Does not meet conclusively: nodes/TidyTools/TidyTools.node.ts is an action node for TidyTools, but README.md describes both RapidAPI and Apify credentials. n8n may view this as two services or a proxy layer. Catalog uniqueness is unverified. |
| Five requested operations | Meets in source: nodes/TidyTools/descriptions.ts has Contact/Extract, Transcription/Transcribe (audio), AI Extract/Extract, Classification/Classify and SEO Audit/Audit; TidyTools.node.ts dispatches each. Offline tests cover all five. |
| Public matching GitHub repository | Does not meet: package.json points to tidytools/n8n-nodes-tidytools, but a public standalone repository with this package at its root is unverified. .github/workflows/publish.yml is a template inside the GetMoney monorepo. |
| npm author/maintainer matches repository | Does not meet: package.json author is TidyTools; npm owner and repository maintainer cannot be matched before publication. Registry lookup of n8n-nodes-tidytools returned E404 on 2026-10-25. |
| MIT license | Meets: LICENSE and package.json. |
| README, authentication and examples | Meets in source: README.md and examples/*.json; offline structural checks in test/description.test.mts. Actual n8n import is unverified. |
| No runtime dependencies | Meets in source: package.json has no dependencies; n8n-workflow is a peer dependency. |
| No environment or filesystem access in node | Meets in source: nodes/ and credentials/ use n8n APIs and parameters. Development-only scripts/live-check.mjs is outside the published dist. |
| TypeScript, error handling and English source text | Meets in source: nodes/**/*.ts, credentials/*.ts, README.md, PUBLISHING.md and docs/*.md. The local Chinese translation was removed; verify the public repository again before submission. |
| Credential tests | Meets in source: credentials/TidyToolsRapidApi.credentials.ts calls selected Contact or SEO endpoint; credentials/TidyToolsApifyApi.credentials.ts calls Apify /v2/users/me. test/description.test.mts checks wiring. Real-key success is unverified. RapidAPI test consumes one request. |
| Linter and community scanner | Does not meet fully: local lint/build/test results appear in YUK-707 handoff; scanner against published npm package is pending. |
| GitHub Actions publication with npm provenance | Does not meet yet: .github/workflows/publish.yml requests id-token: write, installs/checks npm >=11.5.1 on Node 24, and uses npm publish --provenance, but has not run from a public matching repository. |
| npm publication and Creator Portal approval | Does not meet: user steps in PUBLISHING.md are pending. No verification badge can be claimed. |

Recheck current n8n guidelines, the tarball (npm pack --dry-run) and published npm provenance before Creator Portal submission.

## UX guideline audit

Source: [n8n UX guidelines](https://docs.n8n.io/connect/create-nodes/build-your-node/reference/ux-guidelines/) read on 2026-10-25. "Not applicable" means the node has no operation of that kind, not that the guideline was skipped. Runtime behavior is covered by test/output.test.mts; local n8n UI and AI-agent imports remain unverified.

| Guideline | Status and evidence/location |
|---|---|
| Credential secrets are password fields | Meets in source: credentials/TidyToolsRapidApi.credentials.ts and credentials/TidyToolsApifyApi.credentials.ts; test/description.test.mts checks both. |
| Include OAuth if available | Does not meet: [Apify documents OAuth 2.0 for integrations](https://docs.apify.com/integrations/integrate/#authentication-methods), but credentials/TidyToolsApifyApi.credentials.ts and TidyTools.node.ts expose only API-token authentication. RapidAPI APIs here use its default X-RapidAPI-Key flow; OAuth for these specific APIs is unverified. OAuth client setup and live flow need a separate implementation and external registration before claiming full UX compliance. |
| CRUD and common resource operations | Meets (not applicable): these five services perform extraction, audit, classification or transcription, not record CRUD. nodes/TidyTools/descriptions.ts names the actions accordingly. |
| Resource Locator, From list default | Meets (not applicable): Website, Page URL, Media URLs and Podcast Feed URL accept arbitrary external URLs; there is no service-owned item list to retrieve. See nodes/TidyTools/descriptions.ts. |
| Consistency with other nodes | Meets in source: Resource → Operation → required inputs → Options, with item linking in TidyTools.node.ts and sorted options checked in test/description.test.mts. Visual comparison in local n8n remains unverified. |
| Sorting for Get Many | Meets (not applicable): no Get Many or searchable list operation in nodes/TidyTools/descriptions.ts. |
| Delete confirmation output | Meets (not applicable): no Delete operation. |
| Simplify output when endpoint has over ten fields | Meets in source: nodes/TidyTools/output.ts adds Simplify and returns at most ten useful fields for all five resources; TidyTools.node.ts applies it to RapidAPI, Apify and combined runs. test/output.test.mts covers it. |
| AI tool Output: Simplified, Raw, Selected Fields | Meets in source: usableAsTool in TidyTools.node.ts; Output and resource-specific Selected Fields multi-select in output.ts cover the README.md top-level result fields (including `meetingNotesUrl` and `pagesChecked`), retain an available identifier, and allow selecting custom `data` as a whole. test/output.test.mts covers the modes and omitted-field regression. Live AI-agent UI behavior remains unverified. |
| Title Case node name, parameter labels and dropdown titles | Meets in source: TidyTools.node.ts (`displayName`), descriptions.ts and output.ts (`displayName` and option `name`). n8n-node lint is the final check. |
| Sentence case actions, node/parameter descriptions, hints and dropdown descriptions | Meets in source for case: TidyTools.node.ts, descriptions.ts and output.ts. See separate rows below for the stricter operation-content rules. |
| Service terminology, plain words, consistent naming | Meets in source: README.md and descriptions.ts use the same five resource and operation names. A reviewer should verify terminology in the local UI. |
| Example placeholders start with "e.g." and demo fields use camel case | Meets in source: URL, field, language and other examples in descriptions.ts use the prefix; example field names are lower camel case. "Add option" is an action placeholder, not example content. |
| Operation `name`: Title Case; omit the resource when selected above; name a different object when needed | Meets in source: descriptions.ts has a Resource selector above the five one-word operation names (Extract, Classify, Audit and Transcribe). No operation acts on a nested record type. |
| Operation `action`: sentence case, include the resource/object, omit articles | Does not meet fully: descriptions.ts has sentence-case actions with a target object, but Contact says "a website" and SEO Audit says "a page"; the guideline omits articles, and the action text does not consistently use the resource's label. |
| Operation `description`: sentence case, include the resource and add helpful detail | Does not meet fully: descriptions.ts has sentence-case subtext with extra detail, but the Contact description says only "home page and likely contact pages" without explicitly naming contact details; the AI Extract description does not name structured data. |
| CRUD vocabulary and child-object names | Meets (not applicable): descriptions.ts has no Create, Get, Get Many, Update, Insert or Delete operations and no child-entity operation. The five actions use their actual extraction/audit/classification/transcription verbs. |
| Quote parameter or field names when referring to them in copy | Does not meet: descriptions.ts refers to Check Links, Source File ID and Resume Store Name without single quotation marks; transport.ts uses double quotes around "Max Wait (Seconds)" in the timeout hint. |
| Boolean descriptions begin with "Whether" | Meets in source: all boolean descriptions in descriptions.ts and output.ts begin with "Whether"; test/description.test.mts checks this recursively. |
| Error message says what happened, names the triggering parameter when known, includes item index when available and avoids blame words | Does not meet fully: TidyTools.node.ts and transport.ts pass `itemIndex` for many errors, and several messages identify the failing value. Validation messages such as "Schema is not valid JSON" and "Fields must list..." do not consistently use the display labels "Schema"/"Fields" and some messages use "error" or raw API wording. |
| Error description tells the user how to recover and avoids blame words | Does not meet fully: transport.ts gives recovery hints for RapidAPI 401/403/429 and Apify timeouts, but other HTTP statuses and local validation errors in TidyTools.node.ts have no actionable description; Apify failed-run description is only the status message and run URL. |
