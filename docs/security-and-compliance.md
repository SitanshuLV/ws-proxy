# WSProxy Security & Compliance Guide

## Authentication & Authorization

### 1. Platform Authentication (Built-in, Secure)

**WSProxy uses platform authentication by default — No credentials needed:**

```javascript
var api = new Script.Util.WSProxy();
// Already authenticated via SFMC platform
```

**Benefits:**
- No API keys or passwords in code
- Inherits user/BU permissions automatically
- Audit trail through SFMC logs
- No credential rotation needed

---

### 2. Minimal Permission Model

**WSProxy respects SFMC role-based permissions:**

| Permission | Can Perform |
|-----------|-------------|
| Create Email | Create Email objects |
| Manage DataExtensions | CRUD DataExtension/rows |
| Manage Automations | Retrieve automations, start/stop |
| List Subscriber | CRUD Subscribers, Lists |
| View Tracking Events | Retrieve tracking data |

**Best Practice:**
```javascript
// Create service account with minimal permissions
// Grant only required operations:
// - If script only reads DEs: "View DataExtensions" only
// - If script updates subscribers: "List Subscriber" only
// - If script creates automation activities: "Manage Automations" only
```

---

## Data Protection

### 1. PII Handling Best Practices

**Never log or expose PII:**

```javascript
// WRONG: Logs personal information
Write("Processing: " + subscriber.EmailAddress);

// WRONG: Stores PII unencrypted in DE
api.createItem("DataExtensionObject", {
    CustomerKey: logDEKey,
    Properties: [
        { Name: "Email", Value: subscriber.EmailAddress },
        { Name: "FullName", Value: subscriber.FullName }
    ]
});

// CORRECT: Use hash or placeholder
var emailHash = Platform.Function.MD5(subscriber.EmailAddress);
Write("Processing: " + emailHash);

api.createItem("DataExtensionObject", {
    CustomerKey: logDEKey,
    Properties: [
        { Name: "EmailHash", Value: emailHash },
        { Name: "ProcessedAt", Value: new Date().toISOString() }
    ]
});
```

### 2. GDPR / CCPA Compliance

**Export subscriber data on request:**

```javascript
function exportSubscriberData(subscriberKey) {
    try {
        // Retrieve all subscriber data
        var res = api.retrieve("Subscriber",
            ["SubscriberKey", "EmailAddress", "Status", "CreatedDate", "ModifiedDate"],
            { Property: "SubscriberKey", SimpleOperator: "equals", Value: subscriberKey }
        );

        if (res.Status === "OK" && res.Results.length > 0) {
            var data = res.Results[0];
            // Create encrypted export file or secure delivery
            return { success: true, data: data };
        }
        return { success: false, error: "Subscriber not found" };
    } catch (e) {
        return { success: false, error: Stringify(e) };
    }
}
```

**Delete subscriber on request (GDPR Right to be Forgotten):**

```javascript
function deleteSubscriberDataForGDPR(subscriberKey) {
    try {
        // Delete from main subscriber list
        api.deleteItem("Subscriber", { SubscriberKey: subscriberKey });

        // Delete from any DE tracking
        var tracking = api.retrieve("DataExtensionObject[tracking_de_key]", ["SubscriberKey"],
            { Property: "SubscriberKey", SimpleOperator: "equals", Value: subscriberKey }
        );

        if (tracking.Status === "OK") {
            for (var i = 0; i < tracking.Results.length; i++) {
                api.deleteItem("DataExtensionObject", {
                    CustomerKey: "tracking_de_key",
                    Keys: [{ Name: "SubscriberKey", Value: subscriberKey }]
                });
            }
        }

        // Log deletion for compliance
        logComplianceAction("GDPR_DELETE", subscriberKey);

        return { success: true };
    } catch (e) {
        return { success: false, error: Stringify(e) };
    }
}
```

---

## Cross-BU Access Control

### 1. Safe Business Unit Switching

**Only access authorized BUs:**

```javascript
function retrieveFromAuthorizedBU(buID) {
    // Verify BU is authorized for this script
    var authorizedBUs = [1001, 1002, 1003];
    if (authorizedBUs.indexOf(buID) === -1) {
        return { success: false, error: "Unauthorized BU access" };
    }

    try {
        api.setClientId({ "ID": buID });
        var result = api.retrieve("DataExtension", ["Name", "CustomerKey"]);
        api.resetClientIds();
        return { success: true, result: result };
    } catch (e) {
        api.resetClientIds();
        return { success: false, error: Stringify(e) };
    }
}
```

### 2. Never Hardcode BU IDs

```javascript
// WRONG: Hardcoded BU access
var buID = 1234567;
api.setClientId({ "ID": buID });

// CORRECT: Use configuration or request context
var buID = Platform.Function.AuthenticatedMemberID();
// OR retrieve from secure config table
var config = api.retrieve("Config_DE", ["BU_ID"], ...);
```

---

## Input Validation

### 1. Sanitize Filter Values

**Prevent filter injection:**

```javascript
// WRONG: Direct user input
var userInput = RequestParameter.GetQueryStringParameter("name");
var filter = { Property: "Name", SimpleOperator: "equals", Value: userInput };
var res = api.retrieve("DataExtension", cols, filter);

// CORRECT: Validate and sanitize
var userInput = RequestParameter.GetQueryStringParameter("name");
if (!userInput || userInput.length === 0 || userInput.length > 100) {
    return { success: false, error: "Invalid input" };
}

// Only allow alphanumeric, underscore, hyphen
if (!/^[a-zA-Z0-9_-]+$/.test(userInput)) {
    return { success: false, error: "Invalid characters" };
}

var filter = { Property: "Name", SimpleOperator: "equals", Value: userInput };
var res = api.retrieve("DataExtension", cols, filter);
```

### 2. Validate Property Names

```javascript
// WRONG: Allow arbitrary properties in retrieve
function unsafeRetrieve(objectType, userColumns) {
    return api.retrieve(objectType, userColumns);  // User could request Password!
}

// CORRECT: Whitelist allowed properties
function safeRetrieve(objectType, userColumns) {
    var allowedProps = {
        "Subscriber": ["SubscriberKey", "EmailAddress", "Status"],
        "DataExtension": ["Name", "CustomerKey", "CategoryID"],
        // etc
    };

    var allowed = allowedProps[objectType] || [];
    var safe = [];

    for (var i = 0; i < userColumns.length; i++) {
        if (allowed.indexOf(userColumns[i]) !== -1) {
            safe.push(userColumns[i]);
        }
    }

    if (safe.length === 0) {
        return { success: false, error: "No valid properties requested" };
    }

    return api.retrieve(objectType, safe);
}
```

---

## Audit Logging

### 1. Log All Destructive Operations

```javascript
function logAuditEvent(action, objectType, objectID, details) {
    try {
        var timestamp = new Date().toISOString();
        var userID = Platform.Function.AuthenticatedEmployeeID();
        var buID = Platform.Function.AuthenticatedMemberID();

        api.createItem("DataExtensionObject", {
            CustomerKey: "audit_log_de_key",
            Properties: [
                { Name: "Timestamp", Value: timestamp },
                { Name: "Action", Value: action },  // "DELETE", "UPDATE", "CREATE"
                { Name: "ObjectType", Value: objectType },
                { Name: "ObjectID", Value: objectID },
                { Name: "UserID", Value: String(userID) },
                { Name: "BusinessUnitID", Value: String(buID) },
                { Name: "Details", Value: details },
                { Name: "IPAddress", Value: Request.ClientIP() }  // If available
            ]
        });
    } catch (e) {
        // Log errors shouldn't break main flow, but should be reported
        Write("Audit logging failed: " + Stringify(e));
    }
}

// Usage
function deleteDE(customerKey) {
    logAuditEvent("DELETE", "DataExtension", customerKey, "Deleted via automation");
    return api.deleteItem("DataExtension", { CustomerKey: customerKey });
}
```

### 2. Audit Trail for Batch Operations

```javascript
function auditBatchOperation(operationType, objectType, count) {
    var timestamp = new Date().toISOString();
    var userID = Platform.Function.AuthenticatedEmployeeID();

    api.createItem("DataExtensionObject", {
        CustomerKey: "batch_audit_log_key",
        Properties: [
            { Name: "Timestamp", Value: timestamp },
            { Name: "Operation", Value: operationType },  // "UPSERT", "DELETE", "CREATE"
            { Name: "ObjectType", Value: objectType },
            { Name: "RecordCount", Value: String(count) },
            { Name: "UserID", Value: String(userID) },
            { Name: "Status", Value: "COMPLETED" }
        ]
    });
}
```

---

## Error Handling Security

### 1. Don't Expose Technical Details

```javascript
// WRONG: Reveals system details to users
try {
    var res = api.retrieve(...);
} catch (e) {
    Write("Error: " + Stringify(e));  // User sees stack trace!
}

// CORRECT: Log details, show generic message
try {
    var res = api.retrieve(...);
} catch (e) {
    // Log full error for debugging
    logAuditEvent("ERROR", "API_CALL", "", Stringify(e));
    // Show user-safe message
    Write("An error occurred. Please contact support with code ABC123.");
}
```

### 2. Sensitive Error Information

```javascript
// WRONG: Logs contain sensitive data
var errorLog = {
    error: e.message,
    request: { customerKey: deKey, filter: filter }  // De key exposed
};

// CORRECT: Hash sensitive values
var errorLog = {
    error: e.message,
    requestHash: Platform.Function.MD5(deKey),
    timestamp: new Date().toISOString()
};
```

---

## Permission Matrix Example

```javascript
var PERMISSION_MATRIX = {
    "Reader": {
        "DataExtension": ["retrieve"],
        "Subscriber": ["retrieve"],
        "Automation": ["retrieve"]
    },
    "Editor": {
        "DataExtension": ["retrieve", "update", "delete"],
        "Subscriber": ["retrieve", "update"],
        "Automation": ["retrieve", "perform"]
    },
    "Administrator": {
        "DataExtension": ["create", "retrieve", "update", "delete"],
        "Subscriber": ["create", "retrieve", "update", "delete"],
        "Automation": ["create", "retrieve", "update", "delete", "perform"]
    }
};

function checkPermission(userRole, objectType, operation) {
    var allowed = PERMISSION_MATRIX[userRole];
    if (!allowed || !allowed[objectType]) {
        return false;
    }
    return allowed[objectType].indexOf(operation) !== -1;
}

// Usage
if (!checkPermission(userRole, "DataExtension", "delete")) {
    return { success: false, error: "Permission denied" };
}
```

---

## Compliance Checklist

- [ ] **No hardcoded credentials** — Use platform authentication
- [ ] **Minimal permissions** — Grant only required operations
- [ ] **PII protection** — Don't log or expose personal data
- [ ] **Input validation** — Sanitize user input
- [ ] **Audit logging** — Log all destructive operations
- [ ] **Error handling** — Don't expose technical details
- [ ] **BU access control** — Verify authorized BUs only
- [ ] **Data retention** — Delete data per policy
- [ ] **Encryption** — Sensitive data encrypted at rest
- [ ] **Access logs** — Who did what and when

---

## Security Resources

- [SFMC Trust and Compliance](https://www.salesforce.com/content/dam/web/en_us/www/documents/compliance/Salesforce%20Trust%20-%20Compliance%20Datasheet.pdf)
- [GDPR Regulation](https://gdpr-info.eu/)
- [CCPA Privacy Rights](https://oag.ca.gov/privacy/ccpa)
- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
