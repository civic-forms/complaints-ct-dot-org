# Security Deposit Complaint Helper (working name)

A free, open-source web app that helps Connecticut tenants fill out the State
Department of Banking's Rental Security Deposit Complaint Form and send it from
their own email. Everything runs in the browser; nothing is sent to a server.

Work in progress. See `CLAUDE.md` for the full specification. The complete
README (privacy model, updating the form template, maintenance commands, form
revision log) comes in Phase 6.

## Development

Requires Node 24 (`.nvmrc`) and pnpm via Corepack (`corepack enable pnpm`).

```sh
pnpm install
pnpm dev        # local dev server
pnpm check      # Biome lint + format check
pnpm typecheck
pnpm test
pnpm build
```

## Form template tools

```sh
pnpm form:dump [path/to/form.pdf]   # AcroForm field inventory
pnpm form:text [path/to/form.pdf]   # printed text + verbatim.json check
```

Both default to the committed template and write JSON to `scripts/out/`
(gitignored).

## License

MIT
