# WSProxy Performance & Optimization Guide

## Batch vs Loop Performance

### Anti-Pattern: Loop (SLOW)
```javascript
var emails = ["a@test.com", "b@test.com", "c@test.com"];
for (var i = 0; i < emails.length; i++) {
    // 3 separate API calls = 3 round trips
    api.createItem("DataExtensionObject", {
        CustomerKey: deKey,
        Properties: [{ Name: "Email", Value: emails[i] }]
    });
}
```

**Overhead:**
- 3 separate network round trips
- 3 authentication checks
- 3 SOAP envelope creations
- Total execution time: ~3-9 seconds (3s per call)

### Optimized: Batch (FAST)
```javascript
var rows = [];
for (var i = 0; i < emails.length; i++) {
    rows.push({
        CustomerKey: deKey,
        Properties: [{ Name: "Email", Value: emails[i] }]
    });
}
// 1 API call for all 3 rows
api.createBatch("DataExtensionObject", rows);
```

**Benefits:**
- 1 network round trip
- 1 authentication check
- Single SOAP envelope
- Total execution time: ~1 second

**Impact:** 3-9x faster for batch operations

---

## Pagination Optimization

### Pattern 1: Set Batch Size Before Retrieve
```javascript
// Smaller batches = less memory per page, more round trips
api.setBatchSize(500);  // Smaller = more stable on large queries

var result = api.retrieve("DataExtension", cols, filter);
if (result.Status === "OK") {
    // Process first 500
    var moreData = result.HasMoreRows;
    var reqID = result.RequestID;
}
```

### Pattern 2: Process-As-You-Go (Lower Memory)
```javascript
var totalProcessed = 0;
var moreData = true;
var reqID = null;

while (moreData) {
    var data = reqID == null
        ? api.retrieve(objectType, cols, filter)
        : api.getNextBatch(objectType, reqID);

    if (data && data.Status === "OK") {
        // Process data.Results immediately
        for (var i = 0; i < data.Results.length; i++) {
            processRow(data.Results[i]);  // Don't accumulate
        }
        totalProcessed += data.Results.length;
        moreData = data.HasMoreRows;
        reqID = data.RequestID;
    } else {
        moreData = false;
    }
}
```

**Benefits:**
- Constant memory usage regardless of dataset size
- Can handle millions of rows
- Process results immediately (e.g., send email per row)

### Pattern 3: Accumulate with Safety Limit
```javascript
var allResults = [];
var moreData = true;
var reqID = null;
var MAX_RECORDS = 50000;  // Safety limit

while (moreData && allResults.length < MAX_RECORDS) {
    var data = reqID == null
        ? api.retrieve(objectType, cols, filter)
        : api.getNextBatch(objectType, reqID);

    if (data && data.Status === "OK") {
        allResults = allResults.concat(data.Results);
        moreData = data.HasMoreRows && allResults.length < MAX_RECORDS;
        reqID = data.RequestID;
    } else {
        moreData = false;
    }
}
```

---

## Filter Optimization

### Slow: Retrieve all, filter in code
```javascript
// Retrieves ALL DEs, then filters in SSJS (wasteful)
var allDEs = api.retrieve("DataExtension", cols,
    { Property: "CustomerKey", SimpleOperator: "isNotNull", Value: " " });

var activeDEs = [];
for (var i = 0; i < allDEs.Results.length; i++) {
    if (allDEs.Results[i].Status === "Active") {
        activeDEs.push(allDEs.Results[i]);
    }
}
```

### Fast: Filter at API level
```javascript
// Only retrieves active DEs (1 API call, smaller payload)
var activeDEs = api.retrieve("DataExtension", cols,
    { Property: "Status", SimpleOperator: "equals", Value: "Active" });
```

**Best Practices:**
1. **Always filter date ranges** to reduce scope
   ```javascript
   { Property: "CreatedDate", SimpleOperator: "greaterThanOrEqual", Value: "2025-01-01" }
   ```

2. **Use most selective filter first**
   ```javascript
   // Better: Status is more selective
   { Property: "Status", SimpleOperator: "equals", Value: "Active" }
   // vs searching all with CustomerKey isNotNull
   ```

3. **Avoid pattern matching on large text fields**
   ```javascript
   // SLOW on millions of records
   { Property: "Name", SimpleOperator: "like", Value: "%test%" }

   // Use exact match instead
   { Property: "Name", SimpleOperator: "equals", Value: "test_name" }
   ```

---

## Batch Upsert Optimization

### Pattern: Update with SaveAction instead of create
```javascript
// For 10,000 rows (insert or update)

// SLOW: Try create, catch error, update (2x API calls)
for (var i = 0; i < rows.length; i++) {
    try {
        api.createItem("DataExtensionObject", rows[i]);
    } catch (e) {
        api.updateItem("DataExtensionObject", rows[i]);
    }
}

// FAST: Single batch with UpdateAdd
api.updateBatch("DataExtensionObject", rows, {
    SaveOptions: [{
        PropertyName: '*',
        SaveAction: 'UpdateAdd'  // Insert or update in one call
    }]
});
```

**Impact:** 2x faster, half the API calls

---

## Chunking Large Batches

### Problem: 50,000 row batch timeout
```javascript
var allRows = [/* 50,000 rows */];
api.createBatch("DataExtensionObject", allRows);  // Timeout!
```

### Solution: Chunk into smaller batches
```javascript
function batchCreateInChunks(objectType, rows, chunkSize) {
    chunkSize = chunkSize || 2000;
    var results = [];

    for (var i = 0; i < rows.length; i += chunkSize) {
        var chunk = rows.slice(i, Math.min(i + chunkSize, rows.length));
        var res = api.createBatch(objectType, chunk);
        results.push({
            chunkIndex: Math.floor(i / chunkSize),
            status: res.Status,
            count: chunk.length
        });

        if (res.Status !== "OK") {
            Write("Chunk " + (i / chunkSize) + " failed: " + Stringify(res));
        }
    }

    return results;
}

// Usage
var results = batchCreateInChunks("DataExtensionObject", allRows, 2000);
```

**Recommended chunk sizes:**
- 2000-5000 rows: Standard batch operations
- 500-1000 rows: Complex operations or large properties
- 100-500 rows: Very large properties or tight timeout budget

---

## Cross-BU Performance

### Slow: Multiple setClientId calls
```javascript
for (var buID of buList) {
    api.setClientId({ "ID": buID });
    var res = api.retrieve("DataExtension", cols);
    api.resetClientIds();
    // Process res
}
```

**Issue:** setClientId is expensive; calling once per BU in loop is slow

### Fast: Single pass per BU
```javascript
function retrieveFromAllBUs(objectType, cols, filter) {
    var allResults = {};

    for (var buID of buList) {
        api.setClientId({ "ID": buID });

        // Retrieve all pages for this BU before switching
        var moreData = true;
        var reqID = null;
        allResults[buID] = [];

        while (moreData) {
            var data = reqID == null
                ? api.retrieve(objectType, cols, filter)
                : api.getNextBatch(objectType, reqID);

            if (data && data.Status === "OK") {
                allResults[buID] = allResults[buID].concat(data.Results);
                moreData = data.HasMoreRows;
                reqID = data.RequestID;
            } else {
                moreData = false;
            }
        }

        api.resetClientIds();
    }

    return allResults;
}
```

**Benefit:** Single setClientId per BU, complete pagination before switching

---

## Memory Management

### Anti-Pattern: Accumulate unbounded
```javascript
var allRecords = [];
var moreData = true;

while (moreData) {
    var data = api.retrieve(objectType, cols, filter);  // Adds 2500 rows
    allRecords = allRecords.concat(data.Results);  // Could reach 100k+ rows
    moreData = data.HasMoreRows;
    // Script runs out of memory!
}
```

### Pattern: Process and discard
```javascript
var processed = 0;
var moreData = true;
var reqID = null;

while (moreData) {
    var data = reqID == null
        ? api.retrieve(objectType, cols, filter)
        : api.getNextBatch(objectType, reqID);

    if (data && data.Status === "OK") {
        // Process each row, don't store
        for (var i = 0; i < data.Results.length; i++) {
            sendEmailToSubscriber(data.Results[i]);
        }
        processed += data.Results.length;
        moreData = data.HasMoreRows;
        reqID = data.RequestID;
    } else {
        moreData = false;
    }
}
```

**Memory profile:** O(1) vs O(n)

---

## Timeout Prevention

### 60-Second Script Timeout Issues

**Cause 1: Large unoptimized retrieve**
```javascript
// WRONG: Retrieves 100k subscribers, takes 45+ seconds
api.retrieve("Subscriber", ["*"], { Property: "Status", SimpleOperator: "isNotNull", Value: " " });
```

**Solution:**
```javascript
// RIGHT: Add filter, use pagination
var chunk = api.retrieve("Subscriber",
    ["SubscriberKey", "EmailAddress", "Status"],  // Only needed columns
    { Property: "CreatedDate", SimpleOperator: "greaterThanOrEqual", Value: "2025-01-01" },
    { BatchSize: 1000 }
);
```

**Cause 2: Nested loops with API calls**
```javascript
// WRONG: O(n²) API calls
for (var i = 0; i < subscribers.length; i++) {
    for (var j = 0; j < lists.length; j++) {
        api.updateItem("Subscriber", { ... });  // 1000 x 10 = 10k calls
    }
}
```

**Solution:**
```javascript
// RIGHT: Single batch operation
var updates = [];
for (var i = 0; i < subscribers.length; i++) {
    updates.push({ SubscriberKey: subscribers[i], Lists: lists });
}
api.updateBatch("Subscriber", updates);  // 1 call
```

---

## Benchmarks (Approximate)

| Operation | Single | Batch (2000) | Time Saved |
|-----------|--------|--------------|-----------|
| Create row | 0.3s | 0.5s total | 99.75% |
| Update row | 0.3s | 0.5s total | 99.75% |
| Retrieve 2500 | 1-3s | — | — |
| Retrieve 50k (paginated) | — | 15-20s | Depends on filter |
| Cross-BU retrieve | 3s per BU | 2.5-2.8s per BU | 10% (setClientId) |

---

## Checklist

- [ ] Use **batch operations** instead of loops
- [ ] **Filter at API level**, not in code
- [ ] Add **date range filters** to scope retrievals
- [ ] Set **setBatchSize(1000-2000)** for large operations
- [ ] Use **pagination** for > 2500 records
- [ ] Process rows **as you fetch**, don't accumulate
- [ ] Use **UpdateAdd SaveAction** for upserts instead of try/create/catch
- [ ] Chunk **large batches** (50k+) into 2000-5000 row chunks
- [ ] **Minimize setClientId** calls in loops
- [ ] Monitor script **execution time** and add timeouts
- [ ] **Log errors** to a debug DE for troubleshooting
