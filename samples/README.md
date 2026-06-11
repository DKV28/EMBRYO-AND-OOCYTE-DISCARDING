# Samples — local test fixtures (PHI, DO NOT COMMIT)

These are **real patient embryo-destruction records** and the target spreadsheet,
used as golden-master fixtures for the parser/transform tests. They contain
protected health information (patient names, PIDs, dates of birth) and are
git-ignored by `.gitignore`. **Never commit or push them.**

Fixture file names are anonymized here on purpose — keep patient names out of source
control. Rename your local copies to match these names so the golden test finds them:

| Fixture file | Role |
|------|------|
| `sample-1-single-location.pdf` | Input — single storage location, 3 cassettes / 3 tec |
| `sample-2-grouped-cassettes.pdf` | Input — 6 tec grouped into 2 cassettes (one location) |
| `sample-3-two-locations.pdf` | Input — two storage locations (multi-row case) |
| `desired_output.xlsx` | Golden-master output the generated Excel must match |
| `specs.jpeg` | Annotated field-mapping reference (one PDF page) |

The three sample PDFs correspond to cases **No. 2, 3, 4** in `desired_output.xlsx`.
When run through the tool on their own they become cases 1, 2, 3.

For CI (which won't have these files), add anonymized fixtures later.
