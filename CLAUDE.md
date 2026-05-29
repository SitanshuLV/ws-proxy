# WSProxy Project Instructions

## Project Purpose
SFMC (Salesforce Marketing Cloud) Server-Side JavaScript (SSJS) code using WSProxy for SOAP API operations.

## Key Constraint
Claude's training data on SFMC WSProxy is incomplete. **Always verify against the docs in `docs/` before generating code.** When in doubt, use `describe()` to discover object properties at runtime.

## Code Style
- All SSJS scripts must start with `<script runat="server">` and `Platform.Load("Core", "1");`
- Initialize WSProxy once: `var api = new Script.Util.WSProxy();`
- Always check `result.Status === "OK"` before processing results
- Use try/catch around all WSProxy calls
- Use pagination (`getNextBatch`) for any retrieve that could return > 2500 rows
- Use `createBatch`/`updateBatch` for multi-row operations (not loops of `createItem`)
- Prefer `UpdateAdd` SaveAction for upsert operations

## Reference Files
- `docs/wsproxy-reference.md` — Method signatures, parameters, filter syntax
- `docs/wsproxy-cookbook.md` — Copy-paste code examples for all operations
- `docs/soap-objects.md` — SOAP object types, properties, status codes

## Common Gotchas
- `execute()` takes `(properties, requestName)` — properties array FIRST
- DE row retrieval uses `"DataExtensionObject[CustomerKey]"` syntax
- `AutomationActivity` and `AutomationActivityInstance` must be referenced as `Activity` and `ActivityInstance`
- `isNull`/`isNotNull` filters still require a `Value` property (use `" "`)
- `SendClassification` must match the `SenderProfile` in TriggeredSendDefinitions
- `describe()` has NO top-level `Status` — properties are in `Results[0].Properties`, not `Results`
- `configure()` method is documented but may not work — avoid unless tested

## Trusted Documentation Sources
1. https://developer.salesforce.com/docs/marketing/marketing-cloud/guide/ssjs_WSProxy_useSSJS.html
2. https://ssjs.guide/wsproxy/
3. https://www.ssjsdocs.xyz/
4. https://ampscript.xyz/how-tos/how-to-use-wsproxy-to-work-with-data-extensions-in-ssjs/
5. https://sfmarketing.cloud/tag/wsproxy/
6. https://gortonington.com/sfmc-server-side-javascript-5-wsproxy/
7. https://github.com/jdeblank/sfmc_dev
