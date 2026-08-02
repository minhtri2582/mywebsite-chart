# Azure SDK access to Azure Blob Storage via Private Endpoint

This guidance covers two common developer scenarios:

1. AKS Pod authenticates using Managed Identity and accesses Azure Blob Storage through a private endpoint.
2. Local developer uses Azure CLI token to authenticate from their workstation.

---

## 1. Architecture and networking

For Azure Blob Storage behind a private endpoint, the critical pieces are:

- Storage account with a **Private Endpoint** configured for `blob` (and optionally `file` / `queue` / `table`).
- A **Private DNS zone** such as `privatelink.blob.core.windows.net` linked to the VNet where the AKS nodes run.
- AKS Pod network must resolve the storage account FQDN to the private endpoint IP.
- The app must still authenticate to Azure AD, so outbound connectivity to Microsoft identity endpoints is required unless using a private link for Azure AD.

### Important notes

- Private endpoint controls **data plane** access to the storage account; it does not replace Azure AD authentication.
- Managed Identity or Azure CLI token grants work only if the client can reach Azure AD / Microsoft identity endpoints.
- Developers on a laptop usually need VPN/ExpressRoute or a bastion/jump host to reach the storage account private endpoint.

---

## 2. AKS Pod with Managed Identity

### Recommended approach

Use Azure AD workload identity or pod-managed identity for AKS and acquire a token via the Azure SDK.

- If using Azure AD workload identity: configure the pod to use a federated identity credential.
- If using Azure Managed Identity on a node or user-assigned identity: assign Storage Blob Data Reader/Contributor to the identity.

### Required role

For Blob access, assign one of these roles on the storage account or container:

- `Storage Blob Data Reader` for read-only access.
- `Storage Blob Data Contributor` for write/delete operations.

### SDK authentication

Preferred option in code:

- `DefaultAzureCredential` for languages that support it.
- `ManagedIdentityCredential` when you want explicit managed identity usage.

#### Python example

```python
from azure.identity import DefaultAzureCredential
from azure.storage.blob import BlobServiceClient

credential = DefaultAzureCredential()
account_url = "https://<storage-account-name>.blob.core.windows.net"
blob_service_client = BlobServiceClient(account_url=account_url, credential=credential)

container_client = blob_service_client.get_container_client("my-container")
blob_client = container_client.get_blob_client("example.txt")
content = blob_client.download_blob().readall()
print(content)
```

#### .NET example

```csharp
using Azure.Identity;
using Azure.Storage.Blobs;

var credential = new DefaultAzureCredential();
var serviceClient = new BlobServiceClient(new Uri("https://<storage-account-name>.blob.core.windows.net"), credential);
var containerClient = serviceClient.GetBlobContainerClient("my-container");
var blobClient = containerClient.GetBlobClient("example.txt");
var response = await blobClient.DownloadAsync();
```

#### JavaScript/TypeScript example

```js
const { DefaultAzureCredential } = require("@azure/identity");
const { BlobServiceClient } = require("@azure/storage-blob");

const credential = new DefaultAzureCredential();
const serviceClient = new BlobServiceClient(
  `https://${storageAccountName}.blob.core.windows.net`,
  credential
);
```

### AKS-specific requirements

- If using Azure AD Pod Identity, ensure the identity is bound to the pod and annotated correctly.
- If using Azure AD Workload Identity, ensure the following environment variables are set in the pod spec:
  - `AZURE_CLIENT_ID`
  - `AZURE_TENANT_ID`
  - `AZURE_FEDERATED_TOKEN_FILE`
- Confirm the pod can resolve the storage account endpoint to the private IP:
  - `nslookup <storage-account-name>.blob.core.windows.net`
- Confirm the pod can reach Azure AD:
  - `curl -I https://login.microsoftonline.com` or equivalent.

---

## 3. Developer local flow using Azure CLI token

Developers may want to use the Azure CLI to obtain an access token and then run code locally.

### Azure CLI token command

```bash
az login
az account get-access-token --resource https://storage.azure.com/
```

This returns an access token that is valid for the storage resource.

### Use with Azure SDK

The `AzureCliCredential` or `DefaultAzureCredential` already understands the Azure CLI session.

#### Python example

```python
from azure.identity import AzureCliCredential
from azure.storage.blob import BlobServiceClient

credential = AzureCliCredential()
account_url = "https://<storage-account-name>.blob.core.windows.net"
blob_service_client = BlobServiceClient(account_url=account_url, credential=credential)
```

#### JavaScript example

```js
const { AzureCliCredential } = require("@azure/identity");
const { BlobServiceClient } = require("@azure/storage-blob");

const credential = new AzureCliCredential();
const serviceClient = new BlobServiceClient(
  `https://${storageAccountName}.blob.core.windows.net`,
  credential
);
```

### If you want to pass a raw token manually

Use this only when SDK credential helpers are not viable.

#### Python example

```python
from azure.identity import AzureCliCredential
from azure.core.credentials import AccessToken
from azure.storage.blob import BlobServiceClient
import subprocess, json

result = subprocess.run(
    ["az", "account", "get-access-token", "--resource", "https://storage.azure.com/", "--output", "json"],
    capture_output=True,
    text=True,
)
access_token = json.loads(result.stdout)["accessToken"]
credential = AccessToken(access_token, 0)
service_client = BlobServiceClient(
    account_url="https://<storage-account-name>.blob.core.windows.net",
    credential=credential,
)
```

> Note: Most SDKs prefer using the built-in `AzureCliCredential` instead of manually constructing tokens.

---

## 4. Developer environment requirements

### Network access

A local developer must have network access to the private endpoint to reach the storage account. This usually means:

- VPN into the Azure VNet where the private endpoint exists, or
- Using a jump host / bastion inside the private network, or
- Azure Dev Box / Cloud Shell with network access to the private endpoint.

If the local machine cannot resolve the private endpoint DNS or cannot route to the private IP, the SDK will fail even though authentication succeeds.

### DNS

Ensure the developer machine or VPN client resolves the storage account host to the private endpoint address:

- `<storage-account-name>.blob.core.windows.net` → private endpoint IP

If using private DNS zone, ensure the zone is linked to the correct VNet and DNS resolution is working.

---

## 5. Troubleshooting

- `AuthenticationFailed`: verify managed identity / Azure CLI token is valid and the identity has blob access roles.
- `DNS resolution failed`: verify private DNS zone and VNet links.
- `Network unreachable` or `Connection timed out`: verify the pod or developer workstation can reach the private endpoint and Azure AD endpoints.
- `403 Forbidden`: verify role assignment is applied to the correct principal and the storage account resource.

---

## 6. Summary

- Use **Managed Identity** in AKS pods with `DefaultAzureCredential`/`ManagedIdentityCredential`.
- Use **Azure CLI token** for local dev with `AzureCliCredential` or `DefaultAzureCredential`.
- Private endpoint provides network-level access control; authentication still requires Azure AD.
- Local dev needs a network path to the private endpoint (VPN/jumpbox) in addition to valid Azure credentials.
