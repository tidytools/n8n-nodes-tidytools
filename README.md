# n8n-nodes-tidytools

An [n8n](https://n8n.io/) community node for [TidyTools](https://apify.com/tidytools). One node, five operations:

| Resource | Operation | What you get | Runs on | Credential |
|---|---|---|---|---|
| Contact | Extract | Emails, phones (E.164), social profiles, address, contact form and contact pages of a company website | RapidAPI | TidyTools RapidAPI API |
| SEO Audit | Audit | 0–100 score, grade and issues with fixes for one page (title, meta, headings, canonical, indexability, structured data, links, speed hints…) | RapidAPI | TidyTools RapidAPI API |
| AI Extract | Extract | The fields you name (or a JSON Schema) from one public web page, as JSON | RapidAPI | TidyTools RapidAPI API |
| Classification | Classify | Industry and business model, page type, topic, IAB category, sentiment, content moderation or your own labels for websites or texts | Apify | TidyTools Apify API |
| Transcription | Transcribe | Transcripts with timestamps of audio/video files, cloud shares, YouTube/TikTok/Loom links and podcast feeds; optional speaker labels, summary, meeting notes | Apify | TidyTools Apify API |

The node can also be used as a tool by n8n AI agents.

[Installation](#installation) · [Credentials](#credentials) · [Operations](#operations) · [Pricing](#pricing) · [Example workflows](#example-workflows) · [Compatibility](#compatibility) · [Responsible use](#responsible-use)

## Installation

After npm publication: in n8n, use **Settings → Community Nodes → Install** and enter `n8n-nodes-tidytools`, confirm. See the [n8n community nodes installation guide](https://docs.n8n.io/integrations/community-nodes/installation/). Self-hosted with npm: `npm install n8n-nodes-tidytools` in your n8n custom folder.

Cloud users can discover and install this node from the nodes panel only after n8n verifies it. Publication and Creator Portal review are still pending.

## Credentials

### TidyTools RapidAPI API (Contact, SEO Audit, AI Extract)

1. Sign in at [rapidapi.com](https://rapidapi.com/) (free account).
2. Subscribe your app to the APIs you want to use. Each has a free plan:
   - [Website Contact Extractor](https://rapidapi.com/tidytools/api/website-contact-extractor1/pricing)
   - [SEO Audit API](https://rapidapi.com/tidytools/api/seo-audit-api15/pricing)
   - [AI Web Data Extractor API](https://rapidapi.com/tidytools/api/ai-web-data-extractor-api-any-page-to-structured-json/pricing)
3. Copy the key: any API page → **Endpoints** → the `X-RapidAPI-Key` value in the code snippet (or **My Apps → your app → Authorization**).
4. In n8n: **Credentials → New → TidyTools RapidAPI API**, paste the key. Under **Test With**, pick an API your app is subscribed to; the test makes one request to it (on example.com).

### TidyTools Apify API (Classification, Transcription)

1. Sign in at [console.apify.com](https://console.apify.com/) (the free plan includes monthly credit).
2. **Settings → API & Integrations** → copy your personal API token.
3. In n8n: **Credentials → New → TidyTools Apify API**, paste the token.

Classification and transcription run the TidyTools Actors [AI Website & Text Classifier](https://apify.com/tidytools/ai-page-classifier) and [Audio & Video Transcriber](https://apify.com/tidytools/audio-transcriber) on your Apify account; results are billed there per event (see [Pricing](#pricing)).

## Operations

Every operation reads its inputs per item, so you can map them from a previous node, e.g. `{{ $json.website }}`.

### Output controls

**Raw** (the default) returns every field listed below. Turn on **Simplify** to return at most ten useful top-level fields for each resource. For AI agent tools, **Output** offers **Raw**, **Simplified**, and **Selected Fields**. Selected Fields shows a resource-specific multi-select and always keeps an available item identifier (id, input, url, or domain). Failure details remain visible. Selecting **Simplified** or **Selected Fields** in Output takes precedence over Simplify. AI Extract's custom fields stay inside the `data` field; choose `data` to include them. These controls change only n8n's returned item shape; they do not change the API request or charge.

### Contact → Extract

- **Website**: a domain (`stripe.com`), a URL or an email address (its domain is used).
- Options: **Max Pages** (1–8, default 5, home page included), **Render** (`auto`: plain HTTP, a real browser only when needed; `never`: HTTP only), **Include Details** (where each value was found), **Return Unreadable Sites as Items**, **Custom RapidAPI Host**.
- Output (one item per website): `success`, `url`, `domain`, `finalUrl`, `organizationName`, `primaryEmail`, `primaryPhone`, `emails`, `phones`, `faxes`, `socialProfiles` (instagram, facebook, x, youtube, tiktok, pinterest), `address`, `addressDetails`, `country`, `logo`, `contactFormUrl`, `contactPages`, `foundAnything`, `title`, `language`, `renderedWith`, `pagesChecked`, `pagesFailed`, and with details on `emailDetails`, `phoneDetails`, `socialProfileSources`, `organization`, `contactForms`, `otherSocialLinks`.

### SEO Audit → Audit

- **Page URL** (a bare domain works).
- Options: **Check Links** (status of up to 50 links), **Link Scope**, **Site Checks** (robots.txt, sitemap, canonical target), **Include Links**, **Render** (`auto`, `never`, `always`), **Timeout (Ms)**, **Return Unreadable Sites as Items**, **Custom RapidAPI Host**.
- Output: `success`, `url`, `finalUrl`, `statusCode`, `score`, `grade`, `summary`, `categoryScores`, `issues` (severity, code, message, fix), `title`, `metaDescription`, `headings`, `canonical`, `indexability`, `sitemap`, `hreflang`, `social`, `structuredData`, `images`, `links`, `content`, `mobile`, `performance`, `technical`, `renderedWith`, `durationMs`.

### AI Extract → Extract

- **Page URL** (public HTML page; read over plain HTTP, robots.txt respected).
- **Define Output By**: **Field Names** (up to 50, comma-separated or one per line; each value is text or null) or **JSON Schema** (type object, 1–50 properties, typed values).
- Options: **Instructions**, **Max Characters** (page text sent to the model, 1,000–24,000), **Max Output Tokens**, **Timeout (Ms)**, **Return Unreadable Sites as Items**, **Custom RapidAPI Host**.
- Output: `success`, `url`, `finalUrl`, `statusCode`, `title`, `renderedWith`, `data` (your fields: use `{{ $json.data.price }}`), `truncated`, `sourceChars`, `charsSent`, `model`, `usage`.

**Unreadable sites.** For the three RapidAPI operations, a site that blocks the request, does not resolve, has no such page or is not HTML returns an item `{ "success": false, "error": { "code": "target_blocked" | "target_unreachable" | "target_error" | "unsupported_content" | "robots_disallowed", "message": "…" } }` instead of stopping the workflow. Turn **Return Unreadable Sites as Items** off to fail the node instead. Key, subscription, quota and input errors always fail the node (use n8n's **On Error** setting to continue).

**Custom RapidAPI Host** only accepts a RapidAPI host (`<name>.p.rapidapi.com`, as shown on the API's RapidAPI Endpoints page); anything else fails the node before a request is made, so your RapidAPI key is never sent to another server.

### Classification → Classify

- **Input Type**: **URLs or Domains** (one or more per item, comma-separated or one per line) or **Texts** (one text per item).
- **Classify By**: Industry and Business Model (default), Page Type, Topic, IAB Categories, Sentiment, Content Moderation, Custom Labels (2–100, one per line, optionally `Label: description`).
- Options: **Analysis Depth** (quick 4k / standard 12k / deep 32k characters; each has its own price), **Multiple Labels**, **Extra Instructions**, **Page Fetching**, **Combine All Items Into One Run** (recommended for lists: one Apify run for all items instead of one per item), **Max Total Charge (USD)**, **Max Wait (Seconds)** (default 300).
- Output (one item per classified site or text): `input`, `url`, `title`, `label`, `labels`, `confidence`, `businessModel`, `companySummary`, `reason`, `language`, `siteStatus`, `charged`, and `error` / `errorType` for rows that could not be classified (not charged).

### Transcription → Transcribe

- **Source**: **Media URLs** (audio/video files up to 2 GB, Google Drive/Dropbox/OneDrive shares, YouTube, TikTok, Instagram Reels, Loom, Wistia, Streamable…) or **Podcast Feed** (RSS or Apple Podcasts link, with **Episodes**: how many of the newest).
- Options: **Language**, **Engine** (fast / accurate), **Speaker Labels**, **Word Timestamps**, **AI Summary and Chapters**, **Meeting Notes**, **Vocabulary Hints**, **Max Minutes per File**, **Source File ID** and **Resume Store Name** (a retried workflow gets the saved transcript back without a new charge), **Combine All Items Into One Run**, **Max Total Charge (USD)**, **Max Wait (Seconds)** (default 900).
- Output (one item per file or episode): `input`, `url`, `episodeTitle`, `success`, `language`, `durationSeconds`, `billedMinutes`, `wordCount`, `text`, `segments`, `paragraphs`, `summary`, `srtUrl`, `vttUrl`, `txtUrl`, `meetingNotesUrl`, `speakers`, `charged`, and `error` / `errorType` for files that could not be transcribed (not charged).

**Long recordings.** The node waits with Apify's long poll up to **Max Wait (Seconds)**. If the run is still going, the node fails with the run ID; the run continues in Apify and its results stay in the run's dataset.

## Pricing

- **RapidAPI operations**: your RapidAPI plan of each API (free plans: Website Contact Extractor 50 requests/month, SEO Audit API 200 audits/month, AI Web Data Extractor 50 requests/month; paid plans on each API's pricing page).
- **Apify operations**, billed per event to your Apify account: transcription $0.006 per audio minute ($0.015 with speaker labels), AI summary $0.01 per file, translated subtitles $0.002 per minute and language; classification $3 / $4 / $8 per 1,000 items (quick / standard / deep). Rows that fail are not charged. Prices are the Apify Store prices at release; the Actor pages show the current ones.

## Example workflows

Import from **Workflows → Import from File**:

- [`examples/lead-enrichment.json`](examples/lead-enrichment.json): a website list → contacts → industry (one combined classification run).
- [`examples/seo-audit-and-ai-extract.json`](examples/seo-audit-and-ai-extract.json): audit a page and extract fields from another.
- [`examples/podcast-transcription.json`](examples/podcast-transcription.json): newest podcast episode with summary, and a 5-second sample file.

Select your credentials on the TidyTools nodes after importing.

## Compatibility

n8n 1.x with community nodes enabled (`n8nNodesApiVersion` 1, built with `@n8n/node-cli`). No runtime dependencies.

## Responsible use

The Contact operation returns only information a company publishes on its own public website: nothing is guessed, generated or bought, and nothing behind a login is read. You are responsible for using contact data in line with the laws that apply to you (for example GDPR, CAN-SPAM and anti-spam rules). We never solve CAPTCHAs: blocked sites are reported as such.

## Development

```bash
npm install
npm run build      # n8n-node build
npm run lint       # n8n-node lint
npm test           # node --test (Node 22.18+), no network
RAPIDAPI_KEY=... APIFY_TOKEN=... node scripts/live-check.mjs   # one real call per operation
```

## Support

Issues: [GitHub](https://github.com/tidytools/n8n-nodes-tidytools/issues) · Email: tidytools@yukai.uk

## License

[MIT](LICENSE)
