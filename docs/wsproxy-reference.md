# WSProxy Method Reference

> **Source-verified documentation** compiled from official Salesforce docs, ssjs.guide, ssjsdocs.xyz, ampscript.xyz, sfmarketing.cloud, and community resources.

## What is WSProxy?

WSProxy is the native SSJS interface to the Salesforce Marketing Cloud SOAP API. It enables SOAP object manipulation using JavaScript-like syntax without raw XML. It is faster than legacy SSJS Core library methods (which are wrappers around AMPScript) and provides better error handling with JSON objects instead of arrays.

**Key facts:**
- Native to the platform — no external libraries needed
- No `Platform.Load` required (though often included for other Core functions)
- Available in **all non-send contexts** (CloudPages, Script Activities, Landing Pages)
- Same SOAP API restrictions as other access methods
- Supports all common SOAP operations: Create, Retrieve, Update, Delete, Perform, Execute, Describe

---

## Initialization

```javascript
var api = new Script.Util.WSProxy();
```

No parameters required. Declare once, reuse for all subsequent calls.

---

## Method Index

| Method | Description | Returns |
|--------|-------------|---------|
| [`retrieve()`](#retrieve) | Retrieve SOAP objects with optional filtering | `{ Status, RequestID, Results, HasMoreRows }` |
| [`getNextBatch()`](#getnextbatch) | Get next page of retrieve results | `{ Status, RequestID, Results, HasMoreRows }` |
| [`createItem()`](#createitem) | Create a single SOAP object | `{ Status, RequestID, Results }` |
| [`createBatch()`](#createbatch) | Create multiple SOAP objects | `{ Status, RequestID, Results }` |
| [`updateItem()`](#updateitem) | Update a single SOAP object | `{ Status, RequestID, Results }` |
| [`updateBatch()`](#updatebatch) | Update multiple SOAP objects | `{ Status, RequestID, Results }` |
| [`deleteItem()`](#deleteitem) | Delete a single SOAP object | `{ Status, RequestID, Results }` |
| [`deleteBatch()`](#deletebatch) | Delete multiple SOAP objects | `{ Status, RequestID, Results }` |
| [`describe()`](#describe) | Get SOAP object metadata | `{ Status, RequestID, Results }` |
| [`execute()`](#execute) | Execute a named SOAP operation | `{ Status, RequestID, Results }` |
| [`performItem()`](#performitem) | Perform an action on a single object | `{ Status, StatusMessage, RequestID, Results }` |
| [`performBatch()`](#performbatch) | Perform an action on multiple objects | `{ Status, StatusMessage, RequestID, Results }` |
| [`setBatchSize()`](#setbatchsize) | Set page size for retrieve pagination | `void` |
| [`setClientId()`](#setclientid) | Switch Business Unit context | `void` |
| [`resetClientIds()`](#resetclientids) | Clear BU override | `void` |

---

## Response Structure

All methods return a JavaScript object:

```javascript
{
    Status: "OK",              // "OK" on success, "Error" on failure
    RequestID: "abc-123-...",  // SFMC request tracking ID
    Results: [...]             // Array of result objects (or count for some ops)
}
```

Retrieve responses additionally include:
```javascript
{
    HasMoreRows: true/false    // Whether more pages exist
}
```

Perform responses additionally include:
```javascript
{
    StatusMessage: "..."       // Descriptive status text
}
```

**Always check `Status` before processing results:**
```javascript
if (result.Status !== "OK") {
    // Handle error
    Write("Error: " + Stringify(result));
}
```

---

## Method Details

### retrieve

Fetch records from any SOAP API object with optional filtering and pagination.

```javascript
var result = api.retrieve(objectType, columns, filter, options, requestProps);
```

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `objectType` | String | Yes | SOAP object name (e.g. `"DataExtension"`, `"Subscriber"`) |
| `columns` | Array | Yes | Property names to return (e.g. `["Name", "CustomerKey"]`) |
| `filter` | Object | No | Filter specification (SimpleFilter or ComplexFilter) |
| `options` | Object | No | Retrieve options (e.g. `{ BatchSize: 300 }`) |
| `requestProps` | Object | No | Request properties (e.g. `{ QueryAllAccounts: true }`) |

#### Simple Filter

```javascript
var filter = {
    Property: "Status",
    SimpleOperator: "equals",
    Value: "active"
};
```

**SimpleOperator values:** `equals`, `notEquals`, `greaterThan`, `lessThan`, `greaterThanOrEqual`, `lessThanOrEqual`, `isNull`, `isNotNull`, `between`, `IN`, `like`

#### Between Filter (for dates)

```javascript
var filter = {
    Property: "EventDate",
    SimpleOperator: "between",
    Value: ["2024-01-01T00:00:00.000Z", "2024-12-31T23:59:59.999Z"]
};
```

#### IN Filter

```javascript
var filter = {
    Property: "Status",
    SimpleOperator: "IN",
    Value: [0, 1, 2, 3]
};
```

#### Complex Filter (AND/OR)

```javascript
var filter = {
    LeftOperand: {
        Property: "DataExtension.CustomerKey",
        SimpleOperator: "equals",
        Value: customerKey
    },
    LogicalOperator: "AND",
    RightOperand: {
        Property: "Name",
        SimpleOperator: "equals",
        Value: "LastName"
    }
};
```

**LogicalOperator values:** `AND`, `OR`

#### Data Extension Rows

Use the special notation `DataExtensionObject[CustomerKey]` to retrieve DE rows:

```javascript
var result = api.retrieve(
    "DataExtensionObject[" + customerKey + "]",
    ["FirstName", "LastName", "EmailAddress"]
);
```

---

### getNextBatch

Continue retrieving the next page of results when `HasMoreRows` is `true`.

```javascript
var nextPage = api.getNextBatch(objectType, requestId);
```

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `objectType` | String | Yes | Same object type as the original retrieve |
| `requestId` | String | Yes | `RequestID` from the previous response |

#### Pagination Pattern

```javascript
var moreData = true;
var reqID = null;
var allResults = [];

while (moreData) {
    var data = reqID == null
        ? api.retrieve(objectType, cols, filter)
        : api.getNextBatch(objectType, reqID);

    if (data != null) {
        moreData = data.HasMoreRows;
        reqID = data.RequestID;
        for (var i = 0; i < data.Results.length; i++) {
            allResults.push(data.Results[i]);
        }
    } else {
        moreData = false;
    }
}
```

#### Alternative Pagination with ContinueRequest

```javascript
var opts = { BatchSize: 300 };
var props = { QueryAllAccounts: false };

while (moreData) {
    moreData = false;
    if (reqID) props.ContinueRequest = reqID;
    var data = api.retrieve("Automation", cols, filter, opts, props);
    if (data != null) {
        moreData = data.HasMoreRows;
        reqID = data.RequestID;
        // process data.Results
    }
}
```

---

### createItem

Create a single SOAP object.

```javascript
var result = api.createItem(objectType, properties, options);
```

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `objectType` | String | Yes | SOAP object type (e.g. `"DataExtension"`, `"Subscriber"`) |
| `properties` | Object | Yes | Fields and values for the new object |
| `options` | Object | No | CreateOptions (e.g. SaveOptions for upsert behavior) |

#### SaveOptions (for Upsert)

```javascript
var options = {
    SaveOptions: [{
        PropertyName: '*',
        SaveAction: 'UpdateAdd'
    }]
};
var result = api.createItem('DataExtensionObject', props, options);
```

**SaveAction values:** `UpdateAdd`, `AddOnly`, `UpdateOnly`, `Delete`, `Nothing`

---

### createBatch

Create multiple SOAP objects in a single call.

```javascript
var result = api.createBatch(objectType, propertiesArray);
```

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `objectType` | String | Yes | SOAP object type |
| `propertiesArray` | Array | Yes | Array of property objects |

Returns the same number of result items as objects passed in.

---

### updateItem

Update a single SOAP object.

```javascript
var result = api.updateItem(objectType, properties, options);
```

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `objectType` | String | Yes | SOAP object type |
| `properties` | Object | Yes | Fields to update (must include identifying key) |
| `options` | Object | No | UpdateOptions |

---

### updateBatch

Update multiple SOAP objects in a single call.

```javascript
var result = api.updateBatch(objectType, propertiesArray);
```

---

### deleteItem

Delete a single SOAP object.

```javascript
var result = api.deleteItem(objectType, properties);
```

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `objectType` | String | Yes | SOAP object type |
| `properties` | Object | Yes | Object with identifying key (e.g. `{ ObjectID: "..." }`) |

---

### deleteBatch

Delete multiple SOAP objects in a single call.

```javascript
var result = api.deleteBatch(objectType, propertiesArray);
```

---

### describe

Get metadata about a SOAP object — useful for discovering retrievable properties.

```javascript
var result = api.describe(objectType);
```

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `objectType` | String | Yes | SOAP object name |

#### Discover Retrievable Properties

```javascript
var desc = api.describe("DataExtension");
var metadata = desc.Results;
for (var i = 0; i < metadata.length; i++) {
    if (metadata[i].IsRetrievable) {
        Write(metadata[i].Name + "<br>");
    }
}
```

---

### execute

Execute a named SOAP operation (e.g. LogUnsubEvent).

```javascript
var result = api.execute(properties, requestName);
```

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `properties` | Array | Yes | Array of `{ Name, Value }` objects |
| `requestName` | String | Yes | Operation name (e.g. `"LogUnsubEvent"`) |

**Note:** Parameter order is `(properties, requestName)` — properties come first.

---

### performItem

Perform an action on a single SOAP object.

```javascript
var result = api.performItem(objectType, properties, action, performOptions);
```

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `objectType` | String | Yes | SOAP object type |
| `properties` | Object | Yes | Object identification properties |
| `action` | String | Yes | Action verb (e.g. `"start"`, `"stop"`, `"ClearData"`) |
| `performOptions` | Object | No | Additional options |

**Common action verbs:** `start`, `stop`, `pause`, `resume`, `ClearData`, `publish`

---

### performBatch

Perform an action on multiple SOAP objects.

```javascript
var result = api.performBatch(objectType, propertiesArray, action, performOptions);
```

---

### setBatchSize

Set the number of records returned per retrieve page.

```javascript
api.setBatchSize(500);
```

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `batchSize` | Number | Yes | Records per page (default: 2500) |

---

### setClientId

Switch context to a different Business Unit.

```javascript
api.setClientId({ "ID": 1234567 });
```

Use `Platform.Function.AuthenticatedMemberID()` for the current BU:

```javascript
api.setClientId({ "ID": Platform.Function.AuthenticatedMemberID() });
```

---

### resetClientIds

Clear any Business Unit override, reverting to the default context.

```javascript
api.resetClientIds();
```

---

## Filter Quick Reference

| Operator | Example | Notes |
|----------|---------|-------|
| `equals` | `{ Property: "Name", SimpleOperator: "equals", Value: "Test" }` | Exact match |
| `notEquals` | `{ Property: "Status", SimpleOperator: "notEquals", Value: 0 }` | Not equal |
| `greaterThan` | `{ Property: "ID", SimpleOperator: "greaterThan", Value: 100 }` | Greater than |
| `lessThan` | `{ Property: "ID", SimpleOperator: "lessThan", Value: 100 }` | Less than |
| `greaterThanOrEqual` | `{ Property: "ID", SimpleOperator: "greaterThanOrEqual", Value: 50 }` | >= |
| `lessThanOrEqual` | `{ Property: "ID", SimpleOperator: "lessThanOrEqual", Value: 50 }` | <= |
| `isNull` | `{ Property: "Email", SimpleOperator: "isNull", Value: " " }` | Null check (Value required but ignored) |
| `isNotNull` | `{ Property: "Email", SimpleOperator: "isNotNull", Value: " " }` | Not null check |
| `between` | `{ Property: "EventDate", SimpleOperator: "between", Value: ["2024-01-01", "2024-12-31"] }` | Range (inclusive), Value is array |
| `IN` | `{ Property: "Status", SimpleOperator: "IN", Value: [1, 2, 3] }` | Membership, Value is array |
| `like` | `{ Property: "Name", SimpleOperator: "like", Value: "%test%" }` | Pattern match with % wildcard |

---

## Sources

- [Salesforce Developer Docs - WSProxy](https://developer.salesforce.com/docs/marketing/marketing-cloud/guide/ssjs_WSProxy_useSSJS.html)
- [ssjs.guide - Function Index](https://ssjs.guide/function-index/)
- [ssjs.guide - WSProxy](https://ssjs.guide/wsproxy/)
- [ssjsdocs.xyz](https://www.ssjsdocs.xyz/)
- [ampscript.xyz - WSProxy with Data Extensions](https://ampscript.xyz/how-tos/how-to-use-wsproxy-to-work-with-data-extensions-in-ssjs/)
- [sfmarketing.cloud - WSProxy articles](https://sfmarketing.cloud/tag/wsproxy/)
- [Gortonington - WSProxy](https://gortonington.com/sfmc-server-side-javascript-5-wsproxy/)
