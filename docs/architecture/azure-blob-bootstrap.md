# Azure Blob bootstrap (ops)

Synawood media lives in a private Azure Blob container. The app uses the SDK +
`AZURE_STORAGE_*` env vars. Bootstrap and debug with the Azure CLI when authenticated.

## Provisioned resources

Synawood uses a **dedicated** storage account (not shared with other products):

| Thing | Value |
|---|---|
| Resource group | `marketing-os-rg` (westeurope) |
| Storage account | `stmktgosc6a868` (StorageV2, Standard_LRS, TLS1_2, no public blob access) |
| Container | `marketing-os` (private) |
| Local uploads folder | `local/` — all dev/test writes; safe to purge without touching production |

## Create / verify container

```bash
# Confirm identity
az account show --query '{name:name,id:id}' -o table

# Set names (example)
export AZ_RG='<resource-group>'
export AZ_ACCOUNT='<storage-account>'
export AZ_CONTAINER='marketing-os'

# Create container if missing (private)
az storage container create \
  --account-name "$AZ_ACCOUNT" \
  --name "$AZ_CONTAINER" \
  --auth-mode login \
  --public-access off

# List to confirm
az storage container show \
  --account-name "$AZ_ACCOUNT" \
  --name "$AZ_CONTAINER" \
  --auth-mode login \
  -o table
```

## Connection string for local app

Prefer a scoped key in `.env.local` as `AZURE_STORAGE_CONNECTION_STRING`.
Keep `AZURE_BLOB_LOCAL_PREFIX=true` so smoke/dev writes land under
`local/marketing-os/{productId}/...` (single top-level `local/` folder).

## Smoke test

From repo root (after `npm install` and env configured):

```bash
npm run smoke:blob
```

This puts, reads, and deletes a tiny text object under the local prefix.
