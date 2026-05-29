# WSProxy Error Handling & Troubleshooting Guide

## Common WSProxy Errors & Solutions

### 1. "Create Access is denied!"

**Cause:** Attempting to create an Automation without `setClientId`

**Solution:**
```javascript
api.setClientId({
    "ID": Platform.Function.AuthenticatedMemberID(),
    "UserID": Platform.Function.AuthenticatedEmployeeID()
});
var result = api.createItem("Automation", config);
api.resetClientIds();
```

**Applies to:** Automation, some Attribute operations

---

### 2. Status === "undefined" (describe() method)

**Cause:** `describe()` doesn't return a top-level `Status` property

**Solution:**
```javascript
var desc = api.describe("DataExtension");
var props = desc.Results[0].Properties;  // Nested in Results[0]
var hasData = desc.Results && desc.Results.length > 0;  // Check Results existence
```

**Note:** This is expected behavior. Check `Results` length instead of `Status`.

---

### 3. "Data Extension not found" or empty Results

**Cause:** Filter value mismatch or incorrect DE CustomerKey

**Solution:**
```javascript
// Verify DE exists first
var check = api.retrieve("DataExtension", ["CustomerKey"], {
    Property: "CustomerKey",
    SimpleOperator: "equals",
    Value: customerKey
});

if (check.Status === "OK" && check.Results.length > 0) {
    // Proceed
} else {
    // DE doesn't exist or wrong key
}
```

---

### 4. "HasMoreRows" is true but getNextBatch() returns empty

**Cause:** RequestID expired or pagination context lost

**Solution:**
```javascript
// Safe pagination pattern
var allResults = [];
var moreData = true;
var reqID = null;

while (moreData && allResults.length < 10000) {  // Add safety limit
    var data = reqID == null
        ? api.retrieve(objectType, cols, filter)
        : api.getNextBatch(objectType, reqID);

    if (data && data.Status === "OK" && data.Results) {
        moreData = data.HasMoreRows;
        reqID = data.RequestID;
        allResults = allResults.concat(data.Results);
    } else {
        moreData = false;  // Break on any error
    }
}
```

---

### 5. Timeout on large retrieve operations

**Cause:** Retrieving too many records or complex filters

**Solution:**
```javascript
// Option 1: Reduce batch size, filter more aggressively
var filter = {
    LeftOperand: {
        Property: "CreatedDate",
        SimpleOperator: "greaterThanOrEqual",
        Value: "2025-01-01T00:00:00.000Z"
    },
    LogicalOperator: "AND",
    RightOperand: {
        Property: "Status",
        SimpleOperator: "equals",
        Value: "Active"
    }
};

// Option 2: Use setBatchSize for smaller pages
api.setBatchSize(1000);  // Default 2500, reduce for stability

// Option 3: Add requestID to avoid fresh request
var opts = { BatchSize: 500 };
var props = { QueryAllAccounts: false };
var data = api.retrieve(objectType, cols, filter, opts, props);
```

---

### 6. "isNull" filter not working

**Cause:** `isNull` and `isNotNull` still require a `Value` property

**Solution:**
```javascript
// WRONG
{ Property: "Email", SimpleOperator: "isNull" }

// CORRECT
{ Property: "Email", SimpleOperator: "isNull", Value: " " }
```

---

### 7. Complex filter with OR not returning results

**Cause:** Parentheses/nesting not supported; only single AND/OR level

**Solution:**
```javascript
// WRONG - nested conditions
{
    LeftOperand: { /* A */ },
    LogicalOperator: "AND",
    RightOperand: {
        LeftOperand: { /* B */ },
        LogicalOperator: "OR",
        RightOperand: { /* C */ }
    }
}

// CORRECT - only one level
{
    LeftOperand: { Property: "A", ... },
    LogicalOperator: "OR",
    RightOperand: { Property: "B", ... }
}
// Then filter C in application logic
```

---

### 8. "SendClassification doesn't match SenderProfile"

**Cause:** TriggeredSendDefinition SendClassification not linked to SenderProfile

**Solution:**
```javascript
// Ensure SendClassification is linked to the SenderProfile in SFMC UI first
// OR use matching pairs verified in the system

var config = {
    Name: "My_TSD",
    CustomerKey: GUID(),
    SendClassification: {
        CustomerKey: "Default Transactional"  // Must be linked to sender below
    },
    Email: { ID: 123 },
    List: { CustomerKey: "All Subscribers" },
    SenderProfile: {
        CustomerKey: "default"  // Sender must have Default Transactional linked
    }
};
```

---

### 9. Row upsert not working (insert-only)

**Cause:** Missing SaveOptions or wrong SaveAction

**Solution:**
```javascript
// WRONG - creates duplicate on update
var res = api.createItem("DataExtensionObject", {
    CustomerKey: deKey,
    Properties: [{ Name: "Email", Value: "test@test.com" }]
});

// CORRECT - upsert
var res = api.updateItem("DataExtensionObject", {
    CustomerKey: deKey,
    Properties: [{ Name: "Email", Value: "test@test.com" }]
}, {
    SaveOptions: [{
        PropertyName: '*',
        SaveAction: 'UpdateAdd'  // Upsert: insert if new, update if exists
    }]
});
```

---

### 10. "AutomationActivity" not found

**Cause:** Documentation uses wrong name; must use "Activity"

**Solution:**
```javascript
// WRONG
var res = api.retrieve("AutomationActivity", [...]);

// CORRECT
var res = api.retrieve("Activity", [...]);
```

Same for `AutomationActivityInstance` → use `ActivityInstance`.

---

## HTTP Status Codes from SFMC

| Code | Meaning | Common Cause | Solution |
|------|---------|--------------|----------|
| 400 | Bad Request | Malformed filter, invalid value | Check filter syntax, verify property names |
| 401 | Unauthorized | Auth token expired | Re-authenticate, check setClientId |
| 403 | Forbidden | Permission denied, create access | Add setClientId for create operations |
| 404 | Not Found | Object doesn't exist | Verify CustomerKey, ObjectID |
| 429 | Too Many Requests | Rate limited | Implement backoff, reduce batch frequency |
| 500 | Server Error | SFMC backend issue | Retry after delay, contact Salesforce |
| 503 | Service Unavailable | SFMC maintenance | Wait and retry |

---

## Debug Pattern

```javascript
function debugWSProxyCall(objectType, operation, params) {
    var log = [];

    try {
        log.push("[ " + new Date().toISOString() + " ] " + objectType + " " + operation);
        log.push("Params: " + Stringify(params));

        var result;
        if (operation === "retrieve") {
            result = api.retrieve(objectType, params.columns, params.filter);
        } else if (operation === "createItem") {
            result = api.createItem(objectType, params.properties);
        }

        log.push("Result Status: " + (result.Status || "undefined"));
        log.push("Result Count: " + (result.Results ? result.Results.length : 0));

        if (result.Status !== "OK") {
            log.push("ERROR: " + Stringify(result));
        }

        // Write to DE for debugging
        api.createItem("DataExtensionObject", {
            CustomerKey: "debug_log_de_key",
            Properties: [
                { Name: "Timestamp", Value: new Date().toISOString() },
                { Name: "ObjectType", Value: objectType },
                { Name: "Operation", Value: operation },
                { Name: "Status", Value: result.Status || "error" },
                { Name: "Count", Value: String(result.Results ? result.Results.length : 0) },
                { Name: "Log", Value: log.join(" | ") }
            ]
        });

        return result;
    } catch (e) {
        log.push("EXCEPTION: " + Stringify(e));
        Write(log.join("<br>"));
        return { success: false, error: Stringify(e) };
    }
}
```

---

## Performance Warning Signs

| Symptom | Likely Cause | Action |
|---------|--------------|--------|
| Script timeout (60s limit) | Pagination, large retrieves | Add filter, reduce batch size, break into steps |
| "Too many requests" errors | Rapid API calls in loop | Implement throttle, batch operations |
| Memory exceeded | Very large result sets | Paginate, delete as you go, use setBatchSize(500) |
| Slow response times (>30s) | Complex filters, cross-BU queries | Simplify filter, add createdDate range |

---

## Key Takeaways

1. **Always check `Status`** before accessing `Results`
2. **Use try/catch** around all WSProxy calls
3. **Verify object/property names** against docs (AutomationActivity → Activity)
4. **Pagination is required** for results > 2500 rows
5. **Filters need Values** even for isNull/isNotNull
6. **setClientId required** for Automation creation
7. **Batch operations preferred** over loops for multi-row operations
8. **describe()** is your friend for discovering properties at runtime

---

## Resources

- [Salesforce WSProxy Docs](https://developer.salesforce.com/docs/marketing/marketing-cloud/guide/ssjs_WSProxy_useSSJS.html)
- [SSJS Docs](https://www.ssjsdocs.xyz/)
- [SFMC Stack Overflow](https://stackoverflow.com/questions/tagged/salesforce-marketing-cloud)
