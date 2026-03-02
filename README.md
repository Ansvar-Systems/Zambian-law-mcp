# Zambian Law MCP Server

**The zambialii.org alternative for the AI age.**

[![npm version](https://badge.fury.io/js/@ansvar%2Fzambian-law-mcp.svg)](https://www.npmjs.com/package/@ansvar/zambian-law-mcp)
[![MCP Registry](https://img.shields.io/badge/MCP-Registry-blue)](https://registry.modelcontextprotocol.io)
[![License](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)
[![GitHub stars](https://img.shields.io/github/stars/Ansvar-Systems/Zambian-law-mcp?style=social)](https://github.com/Ansvar-Systems/Zambian-law-mcp)
[![CI](https://github.com/Ansvar-Systems/Zambian-law-mcp/actions/workflows/ci.yml/badge.svg)](https://github.com/Ansvar-Systems/Zambian-law-mcp/actions/workflows/ci.yml)
[![Database](https://img.shields.io/badge/database-pre--built-green)](https://github.com/Ansvar-Systems/Zambian-law-mcp)
[![Provisions](https://img.shields.io/badge/provisions-9%2C469-blue)](https://github.com/Ansvar-Systems/Zambian-law-mcp)

Query **1,114 Zambian statutes** -- from the Data Protection Act No. 3 of 2021 and Penal Code Chapter 87 to the Employment Code Act, Companies Act, and more -- directly from Claude, Cursor, or any MCP-compatible client.

If you're building legal tech, compliance tools, or doing Zambian legal research, this is your verified reference database.

Built by [Ansvar Systems](https://ansvar.eu) -- Stockholm, Sweden

---

## Why This Exists

Zambian legal research means navigating zambialii.org, parliament.gov.zm, and zla.org.zm (Zambia Law Development Commission). Whether you're:
- A **lawyer** validating citations in a brief or contract
- A **compliance officer** checking obligations under the Data Protection Act No. 3 of 2021
- A **legal tech developer** building tools on Zambian law
- A **researcher** tracing provisions across 1,114 statutes spanning Chapters and Acts

...you shouldn't need dozens of browser tabs and manual PDF cross-referencing. Ask Claude. Get the exact provision. With context.

This MCP server makes Zambian law **searchable, cross-referenceable, and AI-readable**.

---

## Quick Start

### Use Remotely (No Install Needed)

> Connect directly to the hosted version -- zero dependencies, nothing to install.

**Endpoint:** `https://zambian-law-mcp.vercel.app/mcp`

| Client | How to Connect |
|--------|---------------|
| **Claude.ai** | Settings > Connectors > Add Integration > paste URL |
| **Claude Code** | `claude mcp add zambian-law --transport http https://zambian-law-mcp.vercel.app/mcp` |
| **Claude Desktop** | Add to config (see below) |
| **GitHub Copilot** | Add to VS Code settings (see below) |

**Claude Desktop** -- add to `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "zambian-law": {
      "type": "url",
      "url": "https://zambian-law-mcp.vercel.app/mcp"
    }
  }
}
```

**GitHub Copilot** -- add to VS Code `settings.json`:

```json
{
  "github.copilot.chat.mcp.servers": {
    "zambian-law": {
      "type": "http",
      "url": "https://zambian-law-mcp.vercel.app/mcp"
    }
  }
}
```

### Use Locally (npm)

```bash
npx @ansvar/zambian-law-mcp
```

**Claude Desktop** -- add to `claude_desktop_config.json`:

**macOS:** `~/Library/Application Support/Claude/claude_desktop_config.json`
**Windows:** `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "zambian-law": {
      "command": "npx",
      "args": ["-y", "@ansvar/zambian-law-mcp"]
    }
  }
}
```

**Cursor / VS Code:**

```json
{
  "mcp.servers": {
    "zambian-law": {
      "command": "npx",
      "args": ["-y", "@ansvar/zambian-law-mcp"]
    }
  }
}
```

---

## Example Queries

Once connected, just ask naturally:

- *"What does the Data Protection Act No. 3 of 2021 say about personal data processing?"*
- *"Find provisions in the Penal Code Chapter 87 on fraud"*
- *"What are the employer obligations under the Employment Code Act No. 3 of 2019?"*
- *"Search for labour rights under Zambian law"*
- *"Is the Competition and Consumer Protection Act still in force?"*
- *"What does the Companies Act No. 10 of 2017 say about director duties?"*
- *"Validate the citation 'Section 21, Data Protection Act No. 3 of 2021'"*
- *"Build a legal stance on data breach notification obligations under Zambian law"*
- *"Find provisions on money laundering in the Prohibition and Prevention of Money Laundering Act"*

---

## What's Included

| Category | Count | Details |
|----------|-------|---------|
| **Statutes** | 1,114 statutes | Comprehensive Zambian legislation |
| **Provisions** | 9,469 sections | Full-text searchable with FTS5 |
| **Database Size** | ~17 MB | Optimized SQLite, portable |
| **Data Sources** | zambialii.org | Zambia Legal Information Institute |
| **Language** | English | Official statute language of Zambia |
| **Freshness Checks** | Automated | Drift detection against official sources |

**Verified data only** -- every citation is validated against official sources (Zambia LII, Parliament of Zambia). Zero LLM-generated content.

---

## See It In Action

### Why This Works

**Verbatim Source Text (No LLM Processing):**
- All statute text is ingested from zambialii.org official publications
- Provisions are returned **unchanged** from SQLite FTS5 database rows
- Zero LLM summarization or paraphrasing -- the database contains statute text, not AI interpretations

**Smart Context Management:**
- Search returns ranked provisions with BM25 scoring (safe for context)
- Provision retrieval gives exact text by statute name and section number
- Cross-references help navigate without loading everything at once

**Technical Architecture:**
```
zambialii.org --> Parse --> SQLite --> FTS5 snippet() --> MCP response
                   ^                        ^
            Provision parser         Verbatim database query
```

### Traditional Research vs. This MCP

| Traditional Approach | This MCP Server |
|---------------------|-----------------|
| Search Zambia LII by Act name or Chapter | Search by plain English: *"data protection consent"* |
| Navigate multi-section statutes manually | Get the exact provision with context |
| Manual cross-referencing between Acts | `build_legal_stance` aggregates across sources |
| "Is this statute still in force?" -- check manually | `check_currency` tool -- answer in seconds |
| Find international alignment -- dig manually | `get_eu_basis` -- linked frameworks instantly |
| No API, no integration | MCP protocol -- AI-native |

**Traditional:** Browse Zambia LII --> Navigate Chapter index --> Ctrl+F --> Cross-reference SADC frameworks --> Repeat

**This MCP:** *"What are Zambia's data protection requirements under the Data Protection Act No. 3 of 2021?"* --> Done.

---

## Available Tools (13)

### Core Legal Research Tools (8)

| Tool | Description |
|------|-------------|
| `search_legislation` | FTS5 full-text search across 9,469 provisions with BM25 ranking |
| `get_provision` | Retrieve specific provision by statute name and section number |
| `validate_citation` | Validate citation against database -- zero-hallucination check |
| `build_legal_stance` | Aggregate citations from multiple statutes for a legal topic |
| `format_citation` | Format citations per Zambian legal conventions (full/short/pinpoint) |
| `check_currency` | Check if a statute is in force, amended, or repealed |
| `list_sources` | List all available statutes with metadata and data provenance |
| `about` | Server info, capabilities, dataset statistics, and coverage summary |

### International Law Integration Tools (5)

| Tool | Description |
|------|-------------|
| `get_eu_basis` | Get international frameworks that a Zambian statute aligns with |
| `get_zambian_implementations` | Find Zambian laws aligning with a specific international framework |
| `search_eu_implementations` | Search international documents with Zambian alignment counts |
| `get_provision_eu_basis` | Get international law references for a specific provision |
| `validate_eu_compliance` | Check alignment status of Zambian statutes against international standards |

---

## International Law Alignment

Zambia is not an EU member state, but Zambian legislation aligns with key international frameworks:

- **Data Protection Act No. 3 of 2021** aligns with SADC Model Law on Data Protection and shares core GDPR principles -- consent, purpose limitation, data subject rights, breach notification
- **SADC membership** means Zambian trade and commercial law aligns with the SADC Treaty framework and Protocol on Trade
- **African Union membership** connects Zambian law to the AU Convention on Cyber Security and Personal Data Protection (Malabo Convention)
- **Commonwealth membership** means Zambian common law draws on shared precedents with UK, Australian, Canadian, and other Commonwealth jurisdictions
- **Employment Code Act** reflects ILO core conventions on fundamental labour rights

Zambia's legal system follows a **common law tradition** (English common law as received law) combined with statutory legislation enacted by Parliament.

The international alignment tools allow you to explore these relationships -- checking which Zambian provisions correspond to international standards, and vice versa.

> **Note:** Zambia is not an EU member state. International cross-references reflect alignment and shared principles, not direct transposition. Verify compliance obligations against the specific applicable framework for your jurisdiction.

---

## Data Sources & Freshness

All content is sourced from authoritative Zambian legal databases:

- **[Zambia Legal Information Institute (zambialii.org)](https://zambialii.org/)** -- Open access Zambian legal database
- **[Parliament of Zambia](https://parliament.gov.zm/)** -- Official Acts of Parliament
- **[Zambia Law Development Commission](https://zla.org.zm/)** -- Law reform and legislation

### Data Provenance

| Field | Value |
|-------|-------|
| **Authority** | Zambia Legal Information Institute / Parliament of Zambia |
| **Retrieval method** | Official statute downloads from zambialii.org |
| **Language** | English |
| **Coverage** | 1,114 statutes, 9,469 provisions |
| **Database size** | ~17 MB |

### Automated Freshness Checks

A GitHub Actions workflow monitors all data sources:

| Check | Method |
|-------|--------|
| **Statute amendments** | Drift detection against known provision anchors |
| **New statutes** | Comparison against parliament.gov.zm index |
| **Repealed statutes** | Status change detection |

**Verified data only** -- every citation is validated against official sources. Zero LLM-generated content.

---

## Security

This project uses multiple layers of automated security scanning:

| Scanner | What It Does | Schedule |
|---------|-------------|----------|
| **CodeQL** | Static analysis for security vulnerabilities | Weekly + PRs |
| **Semgrep** | SAST scanning (OWASP top 10, secrets, TypeScript) | Every push |
| **Gitleaks** | Secret detection across git history | Every push |
| **Trivy** | CVE scanning on filesystem and npm dependencies | Daily |
| **Socket.dev** | Supply chain attack detection | PRs |
| **Dependabot** | Automated dependency updates | Weekly |

See [SECURITY.md](SECURITY.md) for the full policy and vulnerability reporting.

---

## Important Disclaimers

### Legal Advice

> **THIS TOOL IS NOT LEGAL ADVICE**
>
> Statute text is sourced from official Zambian legal publications (Zambia LII, Parliament of Zambia). However:
> - This is a **research tool**, not a substitute for professional legal counsel
> - **Court case coverage is not included** -- do not rely solely on this for case law research
> - **Verify critical citations** against primary sources for court filings
> - **International cross-references** reflect alignment relationships, not direct transposition
> - **Subsidiary legislation** (statutory instruments, regulations) has limited coverage -- verify completeness

**Before using professionally, read:** [DISCLAIMER.md](DISCLAIMER.md) | [SECURITY.md](SECURITY.md)

### Client Confidentiality

Queries go through the Claude API. For privileged or confidential matters, use on-premise deployment. Consult the **Law Association of Zambia (LAZ)** guidance on client confidentiality obligations.

---

## Development

### Setup

```bash
git clone https://github.com/Ansvar-Systems/Zambian-law-mcp
cd Zambian-law-mcp
npm install
npm run build
npm test
```

### Running Locally

```bash
npm run dev                                       # Start MCP server
npx @anthropic/mcp-inspector node dist/index.js   # Test with MCP Inspector
```

### Data Management

```bash
npm run ingest           # Ingest statutes from zambialii.org
npm run build:db         # Rebuild SQLite database
npm run drift:detect     # Run drift detection against anchors
npm run check-updates    # Check for amendments and new statutes
npm run census           # Generate coverage census
```

### Performance

- **Search Speed:** <100ms for most FTS5 queries
- **Database Size:** ~17 MB (efficient, portable)
- **Reliability:** 100% ingestion success rate across 1,114 statutes

---

## Related Projects: Complete Compliance Suite

This server is part of **Ansvar's Compliance Suite** -- MCP servers that work together for end-to-end compliance coverage:

### [@ansvar/eu-regulations-mcp](https://github.com/Ansvar-Systems/EU_compliance_MCP)
**Query 49 EU regulations directly from Claude** -- GDPR, AI Act, DORA, NIS2, MiFID II, eIDAS, and more. Full regulatory text with article-level search. `npx @ansvar/eu-regulations-mcp`

### [@ansvar/security-controls-mcp](https://github.com/Ansvar-Systems/security-controls-mcp)
**Query 261 security frameworks** -- ISO 27001, NIST CSF, SOC 2, CIS Controls, SCF, and more. `npx @ansvar/security-controls-mcp`

### [@ansvar/us-regulations-mcp](https://github.com/Ansvar-Systems/US_Compliance_MCP)
**Query US federal and state compliance laws** -- HIPAA, CCPA, SOX, GLBA, FERPA, and more. `npx @ansvar/us-regulations-mcp`

### [@ansvar/sanctions-mcp](https://github.com/Ansvar-Systems/Sanctions-MCP)
**Offline-capable sanctions screening** -- OFAC, EU, UN sanctions lists. `pip install ansvar-sanctions-mcp`

**108 national law MCPs** covering Zambia, South Africa, Kenya, Nigeria, Ghana, Zimbabwe, Botswana, Tanzania, Australia, UK, Canada, and more.

---

## Contributing

Contributions welcome! See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

Priority areas:
- Court case law expansion (Supreme Court and High Court decisions)
- Statutory instruments and subsidiary legislation
- Historical statute versions and amendment tracking
- Zambia Law Development Commission reports integration

---

## Roadmap

- [x] Core statute database with FTS5 search
- [x] Full corpus ingestion (1,114 statutes, 9,469 provisions)
- [x] International law alignment tools (SADC, AU, Commonwealth)
- [x] Vercel Streamable HTTP deployment
- [x] npm package publication
- [ ] Supreme Court and High Court case law
- [ ] Statutory instruments and subsidiary legislation
- [ ] Historical statute versions (amendment tracking)
- [ ] SADC framework cross-references

---

## Citation

If you use this MCP server in academic research:

```bibtex
@software{zambian_law_mcp_2026,
  author = {Ansvar Systems AB},
  title = {Zambian Law MCP Server: AI-Powered Legal Research Tool},
  year = {2026},
  url = {https://github.com/Ansvar-Systems/Zambian-law-mcp},
  note = {1,114 Zambian statutes with 9,469 provisions}
}
```

---

## License

Apache License 2.0. See [LICENSE](./LICENSE) for details.

### Data Licenses

- **Statutes & Legislation:** Parliament of Zambia / Zambia LII (open access)
- **International Metadata:** Public domain

---

## About Ansvar Systems

We build AI-accelerated compliance and legal research tools for the global market. This MCP server started as our internal reference tool for Southern African legal research -- turns out everyone building compliance tools for the SADC region has the same research frustrations.

So we're open-sourcing it. Navigating 1,114 Zambian statutes shouldn't require a law degree.

**[ansvar.eu](https://ansvar.eu)** -- Stockholm, Sweden

---

<p align="center">
  <sub>Built with care in Stockholm, Sweden</sub>
</p>
