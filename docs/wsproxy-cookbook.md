# WSProxy Code Cookbook

> Ready-to-use code examples verified against official Salesforce docs and community sources.

## Table of Contents

1. [Initialization](#1-initialization)
2. [Data Extensions](#2-data-extensions)
3. [Data Extension Rows (Records)](#3-data-extension-rows)
4. [Data Extension Fields](#4-data-extension-fields)
5. [Folders](#5-folders)
6. [Subscribers](#6-subscribers)
7. [Lists](#7-lists)
8. [Triggered Sends](#8-triggered-sends)
9. [Tracking Events](#9-tracking-events)
10. [Automations](#10-automations)
11. [Unsubscribe (LogUnsubEvent)](#11-unsubscribe-logunsubevent)
12. [Cross-BU Operations](#12-cross-bu-operations)
13. [Error Handling Patterns](#13-error-handling-patterns)
14. [Pagination Pattern](#14-pagination-pattern)

---

## 1. Initialization

```javascript
<script runat="server">
Platform.Load("Core", "1");

var api = new Script.Util.WSProxy();
</script>
```

---

## 2. Data Extensions

### Create a Data Extension

```javascript
var fields = [
    { "Name": "EmailAddress", "FieldType": "EmailAddress", "IsPrimaryKey": true, "IsRequired": true, "MaxLength": 254 },
    { "Name": "FirstName", "FieldType": "Text", "MaxLength": 50 },
    { "Name": "LastName", "FieldType": "Text", "MaxLength": 80 },
    { "Name": "Status", "FieldType": "Text", "MaxLength": 20, "DefaultValue": "Active" },
    { "Name": "CreatedDate", "FieldType": "Date" },
    { "Name": "Score", "FieldType": "Number" },
    { "Name": "IsSubscribed", "FieldType": "Boolean", "DefaultValue": "true" }
];

var config = {
    "CustomerKey": String(Platform.Function.GUID()).toUpperCase(),
    "Name": "My_Data_Extension",
    "CategoryID": 0,  // 0 = root Data Extensions folder
    "Fields": fields
};

var result = api.createItem("DataExtension", config);

if (result.Status === "OK") {
    Write("DE created: " + result.Results[0].NewObjectID);
} else {
    Write("Error: " + Stringify(result));
}
```

### Create a Sendable Data Extension

```javascript
var config = {
    "CustomerKey": String(Platform.Function.GUID()).toUpperCase(),
    "Name": "Sendable_DE",
    "CategoryID": 0,
    "IsSendable": true,
    "SendableDataExtensionField": {
        "Name": "EmailAddress",
        "FieldType": "EmailAddress"
    },
    "SendableSubscriberField": {
        "Name": "Subscriber Key"
    },
    "Fields": [
        { "Name": "EmailAddress", "FieldType": "EmailAddress", "IsPrimaryKey": true, "IsRequired": true },
        { "Name": "FirstName", "FieldType": "Text", "MaxLength": 50 }
    ]
};

var result = api.createItem("DataExtension", config);
```

### Create a Data Extension with Data Retention

```javascript
var config = {
    "CustomerKey": String(Platform.Function.GUID()).toUpperCase(),
    "Name": "Temp_Tracking_DE",
    "CategoryID": 0,
    "DataRetentionPeriodLength": 7,
    "DataRetentionPeriod": "Days",
    "RowBasedRetention": true,
    "ResetRetentionPeriodOnImport": true,
    "DeleteAtEndOfRetentionPeriod": true,
    "Fields": [
        { "Name": "SubscriberKey", "FieldType": "Text", "MaxLength": 254, "IsPrimaryKey": true },
        { "Name": "EventDate", "FieldType": "Date" }
    ]
};

var result = api.createItem("DataExtension", config);
```

### Retrieve Data Extension CustomerKey by Name

```javascript
var result = api.retrieve("DataExtension", ["CustomerKey", "ObjectID"], {
    Property: "Name",
    SimpleOperator: "equals",
    Value: "My_Data_Extension"
});

if (result.Status === "OK" && result.Results.length > 0) {
    var customerKey = result.Results[0].CustomerKey;
}
```

### Retrieve All Data Extension Names

```javascript
var result = api.retrieve("DataExtension", ["Name", "CustomerKey", "CategoryID"], {
    Property: "CustomerKey",
    SimpleOperator: "isNotNull",
    Value: " "
});

var deNames = [];
for (var k in result.Results) {
    var nm = result.Results[k].Name;
    // Skip system DEs (prefixed with underscore)
    if (nm.indexOf("_") !== 0) {
        deNames.push(nm);
    }
}
```

### Update Data Extension (Move to Different Folder)

```javascript
var result = api.updateItem("DataExtension", {
    "CustomerKey": customerKey,
    "CategoryID": 12345  // Target folder ID
});
```

### Delete a Data Extension

```javascript
// First retrieve the ObjectID
var req = api.retrieve("DataExtension", ["ObjectID"], {
    Property: "DataExtension.CustomerKey",
    SimpleOperator: "equals",
    Value: customerKey
});

if (req.Status === "OK" && req.Results.length > 0) {
    var result = api.deleteItem("DataExtension", {
        "ObjectID": req.Results[0].ObjectID
    });
}
```

---

## 3. Data Extension Rows

### Insert a Single Row

```javascript
var props = {
    CustomerKey: customerKey,
    Properties: [
        { "Name": "EmailAddress", "Value": "john@example.com" },
        { "Name": "FirstName", "Value": "John" },
        { "Name": "LastName", "Value": "Smith" }
    ]
};

var result = api.createItem("DataExtensionObject", props);
```

### Upsert a Row (Insert or Update)

```javascript
var props = {
    CustomerKey: customerKey,
    Properties: [
        { "Name": "EmailAddress", "Value": "john@example.com" },
        { "Name": "FirstName", "Value": "John" },
        { "Name": "LastName", "Value": "Doe" }
    ]
};

var options = {
    SaveOptions: [{
        PropertyName: '*',
        SaveAction: 'UpdateAdd'
    }]
};

var result = api.updateItem("DataExtensionObject", props, options);
```

### Batch Insert Rows

```javascript
var rows = [
    {
        CustomerKey: customerKey,
        Properties: [
            { "Name": "EmailAddress", "Value": "alice@example.com" },
            { "Name": "FirstName", "Value": "Alice" }
        ]
    },
    {
        CustomerKey: customerKey,
        Properties: [
            { "Name": "EmailAddress", "Value": "bob@example.com" },
            { "Name": "FirstName", "Value": "Bob" }
        ]
    }
];

var result = api.createBatch("DataExtensionObject", rows);
```

### Retrieve Rows from a Data Extension

```javascript
// Use DataExtensionObject[CustomerKey] syntax
var result = api.retrieve(
    "DataExtensionObject[" + customerKey + "]",
    ["EmailAddress", "FirstName", "LastName"]
);

if (result.Status === "OK") {
    for (var i = 0; i < result.Results.length; i++) {
        var row = result.Results[i].Properties;
        // row is an array of { Name, Value } objects
    }
}
```

### Retrieve Rows with Filter

```javascript
var result = api.retrieve(
    "DataExtensionObject[" + customerKey + "]",
    ["EmailAddress", "FirstName", "Status"],
    {
        Property: "Status",
        SimpleOperator: "equals",
        Value: "Active"
    }
);
```

### Update a Row

```javascript
var props = {
    CustomerKey: customerKey,
    Properties: [
        { "Name": "LastName", "Value": "Updated-Name" },
        { "Name": "EmailAddress", "Value": "john@example.com" }  // Primary key for identification
    ]
};

var options = {
    SaveOptions: [{
        PropertyName: 'EmailAddress',
        SaveAction: 'UpdateAdd'
    }]
};

var result = api.updateItem("DataExtensionObject", props, options);
```

### Delete a Row

```javascript
var result = api.deleteItem("DataExtensionObject", {
    CustomerKey: customerKey,
    Keys: [
        { Name: "EmailAddress", Value: "john@example.com" }
    ]
});
```

### Clear All Rows from a Data Extension

```javascript
var result = api.performItem(
    "DataExtension",
    { CustomerKey: customerKey },
    "ClearData",
    {}
);
```

---

## 4. Data Extension Fields

### Add New Fields to an Existing DE

```javascript
var newFields = [
    { "Name": "PhoneNumber", "FieldType": "Phone" },
    { "Name": "Country", "FieldType": "Text", "MaxLength": 50 },
    { "Name": "Age", "FieldType": "Number" }
];

var result = api.updateItem("DataExtension", {
    "CustomerKey": customerKey,
    "Fields": newFields
});
```

### Retrieve Field Definitions

```javascript
var result = api.retrieve(
    "DataExtensionField",
    ["Name", "FieldType", "MaxLength", "IsPrimaryKey", "IsRequired", "DefaultValue"],
    {
        Property: "DataExtension.CustomerKey",
        SimpleOperator: "equals",
        Value: customerKey
    }
);

for (var i = 0; i < result.Results.length; i++) {
    var field = result.Results[i];
    Write(field.Name + " (" + field.FieldType + ")<br>");
}
```

### Update a Field's Attributes

```javascript
// First retrieve the field's ObjectID
var fieldReq = api.retrieve("DataExtensionField", ["ObjectID"], {
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
});

if (fieldReq.Status === "OK" && fieldReq.Results.length > 0) {
    var result = api.updateItem("DataExtension", {
        CustomerKey: customerKey,
        Fields: [{
            Name: "LastName",
            DefaultValue: "Unknown",
            ObjectID: fieldReq.Results[0].ObjectID
        }]
    });
}
```

---

## 5. Folders

### Create a Data Extension Folder

```javascript
// First find the parent folder ID
var parentReq = api.retrieve("DataFolder", ["ID"], {
    Property: "Name",
    SimpleOperator: "equals",
    Value: "Data Extensions"
});

if (parentReq.Status === "OK" && parentReq.Results.length > 0) {
    var config = {
        "Name": "My_New_Folder",
        "Description": "Created via WSProxy",
        "ParentFolder": {
            ID: parentReq.Results[0].ID,
            IDSpecified: true
        },
        "IsActive": true,
        "ContentType": "dataextension"
    };

    var result = api.createItem("DataFolder", config);
}
```

### Retrieve All Data Extension Folders

```javascript
var result = api.retrieve("DataFolder", ["ID", "Name", "ParentFolder.ID"], {
    Property: "ContentType",
    SimpleOperator: "equals",
    Value: "dataextension"
});
```

### Retrieve Folder of a Specific DE

```javascript
var deReq = api.retrieve("DataExtension", ["CategoryID"], {
    Property: "DataExtension.CustomerKey",
    SimpleOperator: "equals",
    Value: customerKey
});

if (deReq.Status === "OK" && deReq.Results.length > 0) {
    var folderReq = api.retrieve("DataFolder", ["Name"], {
        Property: "ID",
        SimpleOperator: "equals",
        Value: deReq.Results[0].CategoryID
    });
}
```

### Delete a Folder

```javascript
var result = api.deleteItem("DataFolder", { "ObjectID": folderObjectId });
```

---

## 6. Subscribers

### Create a Subscriber

```javascript
var result = api.createItem("Subscriber", {
    EmailAddress: "jane@example.com",
    SubscriberKey: "sub_jane_001",
    Lists: [{
        ID: 123,        // List ID
        Status: "Active"
    }]
});
```

### Retrieve a Subscriber

```javascript
var result = api.retrieve("Subscriber", ["SubscriberKey", "EmailAddress", "Status", "CreatedDate"], {
    Property: "SubscriberKey",
    SimpleOperator: "equals",
    Value: "sub_jane_001"
});
```

### Update Subscriber Email

```javascript
var result = api.updateItem("Subscriber", {
    SubscriberKey: "sub_jane_001",
    EmailAddress: "jane.new@example.com"
});
```

### Update Subscriber Status on a Publication List

```javascript
var result = api.updateItem("Subscriber", {
    SubscriberKey: "sub_jane_001",
    Lists: [{
        ID: 456,           // Publication List ID
        Status: "Unsubscribed"
    }]
});
```

---

## 7. Lists

### Retrieve List Subscribers

```javascript
var result = api.retrieve(
    "ListSubscriber",
    ["SubscriberKey", "ListID", "Status", "CreatedDate"],
    {
        Property: "ListID",
        SimpleOperator: "equals",
        Value: 123
    }
);
```

### Retrieve All Lists

```javascript
var result = api.retrieve("List", ["ID", "ListName", "Description", "Type"], {
    Property: "Type",
    SimpleOperator: "equals",
    Value: "Public"
});
```

---

## 8. Triggered Sends

### Create a Triggered Send Definition

```javascript
var config = {
    Name: "Welcome_Email_TSD",
    CustomerKey: Platform.Function.GUID(),
    SendClassification: {
        CustomerKey: "Default Transactional"
    },
    Email: {
        ID: 123188  // Email asset ID
    },
    List: {
        CustomerKey: "All Subscribers - 123"
    },
    SendSourceDataExtension: {
        CustomerKey: "S0M3-GU1D-K3Y"
    },
    SenderProfile: {
        CustomerKey: "default"
    }
};

var result = api.createItem("TriggeredSendDefinition", config);
```

**Note:** `SendClassification` must be linked to the referenced `SenderProfile`.

### Send a Triggered Email (Basic)

```javascript
var tsDef = {
    TriggeredSendDefinition: {
        CustomerKey: "My_TSD_External_Key"
    },
    Subscribers: [{
        EmailAddress: "recipient@example.com",
        SubscriberKey: "recipient@example.com"
    }]
};

var result = api.createItem("TriggeredSend", tsDef);

if (result.Status === "OK") {
    Write("Email sent successfully");
} else {
    Write("Send failed: " + Stringify(result));
}
```

### Send a Triggered Email with Personalization

```javascript
var tsDef = {
    TriggeredSendDefinition: {
        CustomerKey: "Welcome_Email_Key"
    },
    Subscribers: [{
        EmailAddress: "jane@example.com",
        SubscriberKey: "jane@example.com",
        Attributes: [
            { Name: "FirstName", Value: "Jane" },
            { Name: "LastName", Value: "Doe" },
            { Name: "CompanyName", Value: "Acme Corp" }
        ]
    }]
};

var result = api.createItem("TriggeredSend", tsDef);
```

### Send to Multiple Subscribers

```javascript
var tsDef = {
    TriggeredSendDefinition: {
        CustomerKey: "Notification_Key"
    },
    Subscribers: [
        {
            EmailAddress: "user1@example.com",
            SubscriberKey: "user1",
            Attributes: [{ Name: "FirstName", Value: "Alice" }]
        },
        {
            EmailAddress: "user2@example.com",
            SubscriberKey: "user2",
            Attributes: [{ Name: "FirstName", Value: "Bob" }]
        }
    ]
};

var result = api.createItem("TriggeredSend", tsDef);
```

### Start/Stop a Triggered Send Definition

```javascript
// Start
var result = api.performItem(
    "TriggeredSendDefinition",
    { CustomerKey: "My_TSD_Key" },
    "start",
    {}
);

// Stop
var result = api.performItem(
    "TriggeredSendDefinition",
    { CustomerKey: "My_TSD_Key" },
    "stop",
    {}
);
```

### Retrieve Triggered Send Definitions

```javascript
var result = api.retrieve(
    "TriggeredSendDefinition",
    ["Name", "CustomerKey", "TriggeredSendStatus", "CreatedDate"],
    {
        Property: "TriggeredSendStatus",
        SimpleOperator: "equals",
        Value: "Active"
    }
);
```

---

## 9. Tracking Events

All tracking event objects share common properties: `BatchID`, `ClientID`, `EventDate`, `SendID`, `SubscriberKey`, `TriggeredSendDefinitionObjectID`.

### Retrieve Sent Events

```javascript
var cols = ["SendID", "SubscriberKey", "EventDate", "BatchID", "ListID", "TriggeredSendDefinitionObjectID"];

var filter = {
    Property: "EventDate",
    SimpleOperator: "between",
    Value: ["2024-01-01T00:00:00.000Z", "2024-12-31T23:59:59.999Z"]
};

var result = api.retrieve("SentEvent", cols, filter);
```

### Retrieve Open Events

```javascript
var result = api.retrieve("OpenEvent",
    ["SendID", "SubscriberKey", "EventDate", "BatchID"],
    {
        Property: "SendID",
        SimpleOperator: "equals",
        Value: 12345
    }
);
```

### Retrieve Click Events

```javascript
var result = api.retrieve("ClickEvent",
    ["SendID", "SubscriberKey", "EventDate", "URL", "BatchID"],
    {
        Property: "EventDate",
        SimpleOperator: "greaterThan",
        Value: "2024-06-01T00:00:00.000Z"
    }
);
```

### Retrieve Bounce Events

```javascript
var result = api.retrieve("BounceEvent",
    ["SendID", "SubscriberKey", "EventDate", "BounceCategory", "BounceType", "SMTPCode"],
    {
        Property: "SendID",
        SimpleOperator: "equals",
        Value: 12345
    }
);
```

### Retrieve Unsubscribe Events

```javascript
var result = api.retrieve("UnsubEvent",
    ["SendID", "SubscriberKey", "EventDate", "BatchID"],
    filter
);
```

### Retrieve Not Sent Events

```javascript
var result = api.retrieve("NotSentEvent",
    ["SendID", "SubscriberKey", "EventDate", "BatchID"],
    filter
);
```

### Full Tracking Data Retrieval with Pagination

```javascript
function retrieveTrackingEvents(eventType, cols, filter) {
    var api = new Script.Util.WSProxy();
    var moreData = true;
    var reqID = null;
    var allResults = [];

    while (moreData) {
        var data = reqID == null
            ? api.retrieve(eventType, cols, filter)
            : api.getNextBatch(eventType, reqID);

        if (data != null && data.Status === "OK") {
            moreData = data.HasMoreRows;
            reqID = data.RequestID;
            for (var i = 0; i < data.Results.length; i++) {
                allResults.push(data.Results[i]);
            }
        } else {
            moreData = false;
        }
    }
    return allResults;
}

// Usage
var sentEvents = retrieveTrackingEvents("SentEvent", cols, filter);
var openEvents = retrieveTrackingEvents("OpenEvent", cols, filter);
```

---

## 10. Automations

### Retrieve All Automations

```javascript
var cols = [
    "Name", "Description", "CustomerKey", "IsActive",
    "CreatedDate", "ModifiedDate", "Status", "ProgramID",
    "CategoryID", "LastRunTime", "ScheduledTime",
    "LastSaveDate", "ModifiedBy", "LastSavedBy",
    "CreatedBy", "AutomationType", "RecurrenceID"
];

var filter = {
    Property: "Status",
    SimpleOperator: "IN",
    Value: [-1, 0, 1, 2, 3, 4, 5, 6, 7, 8]
};

var opts = { BatchSize: 300 };
var props = { QueryAllAccounts: false };
var allAutomations = [];
var moreData = true;
var reqID = null;

while (moreData) {
    moreData = false;
    if (reqID) props.ContinueRequest = reqID;
    var data = api.retrieve("Automation", cols, filter, opts, props);
    if (data != null) {
        moreData = data.HasMoreRows;
        reqID = data.RequestID;
        for (var i = 0; i < data.Results.length; i++) {
            allAutomations.push(data.Results[i]);
        }
    }
}
```

**Note:** The documented object names `AutomationActivity` and `AutomationActivityInstance` must be referenced as `Activity` and `ActivityInstance` respectively.

### Start an Automation

```javascript
var result = api.performItem(
    "Automation",
    { ObjectID: automationObjectId },
    "start",
    {}
);
```

---

## 11. Unsubscribe (LogUnsubEvent)

### One-Click Unsubscribe via Execute

```javascript
var subkey = Attribute.GetValue("_subscriberkey");
var jid = Attribute.GetValue("jobid");
var lid = Attribute.GetValue("listid");
var bid = Attribute.GetValue("_JobSubscriberBatchID");

var props = [
    { Name: "SubscriberKey", Value: subkey },
    { Name: "JobID", Value: jid },
    { Name: "ListID", Value: lid },
    { Name: "BatchID", Value: bid },
    { Name: "Reason", Value: "User requested unsubscribe" }
];

try {
    var result = api.execute(props, "LogUnsubEvent");
    if (result.Status === "OK") {
        Write("Unsubscribed successfully");
    }
} catch (e) {
    Write("Error: " + Stringify(e));
}
```

**Note:** The `execute()` method takes `(properties, requestName)` — properties array first, then the operation name.

---

## 12. Cross-BU Operations

### Retrieve from a Different Business Unit

```javascript
var api = new Script.Util.WSProxy();

// Switch to target BU
api.setClientId({ "ID": 7654321 });

var result = api.retrieve("DataExtension", ["Name", "CustomerKey"], {
    Property: "CustomerKey",
    SimpleOperator: "isNotNull",
    Value: " "
});

// Reset back to default BU
api.resetClientIds();
```

### Query Across All Accounts

```javascript
var result = api.retrieve(
    "DataExtension",
    ["Name", "CustomerKey", "Client.ID"],
    filter,
    {},
    { QueryAllAccounts: true }
);
```

---

## 13. Error Handling Patterns

### Basic Try/Catch

```javascript
try {
    var result = api.createItem("DataExtension", config);

    if (result.Status === "OK") {
        Write("Success: " + Stringify(result.Results));
    } else {
        Write("API Error: " + result.Status);
        if (result.Results && result.Results.length > 0) {
            Write(" - " + result.Results[0].StatusMessage);
        }
    }
} catch (e) {
    Write("Exception: " + Stringify(e));
}
```

### Batch Operation Error Checking

```javascript
var result = api.createBatch("DataExtensionObject", rows);

if (result.Status === "OK") {
    for (var i = 0; i < result.Results.length; i++) {
        if (result.Results[i].StatusCode !== "OK") {
            Write("Row " + i + " failed: " + result.Results[i].StatusMessage + "<br>");
        }
    }
} else {
    Write("Batch failed entirely: " + Stringify(result));
}
```

---

## 14. Pagination Pattern

### Reusable Paginated Retrieve Function

```javascript
function retrieveAll(objectType, cols, filter) {
    var api = new Script.Util.WSProxy();
    var allResults = [];
    var moreData = true;
    var reqID = null;

    while (moreData) {
        var data;
        if (reqID == null) {
            data = api.retrieve(objectType, cols, filter);
        } else {
            data = api.getNextBatch(objectType, reqID);
        }

        if (data != null && data.Status === "OK") {
            moreData = data.HasMoreRows;
            reqID = data.RequestID;
            for (var i = 0; i < data.Results.length; i++) {
                allResults.push(data.Results[i]);
            }
        } else {
            moreData = false;
        }
    }

    return allResults;
}
```

---

## Field Type Reference

| FieldType | Description | Notes |
|-----------|-------------|-------|
| `Text` | String data | Requires `MaxLength` |
| `Number` | Integer | |
| `Date` | Date/datetime | |
| `Boolean` | True/false | |
| `EmailAddress` | Email validation | Max 254 chars |
| `Phone` | Phone number | |
| `Decimal` | Decimal number | Supports `Scale` property |
| `Locale` | Locale code | |

---

## Sources

- [Salesforce Developer Docs](https://developer.salesforce.com/docs/marketing/marketing-cloud/guide/ssjs_WSProxy_useSSJS.html)
- [ssjs.guide](https://ssjs.guide/wsproxy/)
- [ssjsdocs.xyz](https://www.ssjsdocs.xyz/)
- [ampscript.xyz](https://ampscript.xyz/how-tos/how-to-use-wsproxy-to-work-with-data-extensions-in-ssjs/)
- [sfmarketing.cloud](https://sfmarketing.cloud/tag/wsproxy/)
- [GitHub: jdeblank/sfmc_dev](https://github.com/jdeblank/sfmc_dev)
