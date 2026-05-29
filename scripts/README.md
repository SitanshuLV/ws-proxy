# WSProxy Scripts Index

All scripts are SSJS (Server-Side JavaScript) for Salesforce Marketing Cloud.
Paste into a **CloudPage** or **Script Activity** to run.

## Scripts

| Script | SOAP Objects | Functions | Status |
|--------|-------------|-----------|--------|
| `wsproxy-test.ssjs` | DataExtension, DataExtensionObject, DataExtensionField | 12-step end-to-end test | Tested |
| `data-extensions.ssjs` | DataExtension, DataExtensionObject, DataExtensionField | createDE, createSendableDE, createRetentionDE, getDEByName, getDEByKey, getAllDEs, moveDEToFolder, deleteDE, clearDE, describeDE, insertRow, upsertRow, insertRows, upsertRows, getRows, getAllRows, deleteRow, deleteRows, getFields, addFields, updateFieldDefault | Ready |
| `folders.ssjs` | DataFolder | createFolder, getFolderByName, getFolderByID, getFoldersByType, getRootFolder, getFolderPath, getDEFolder, deleteFolder, deleteFolderByName | Ready |
| `subscribers.ssjs` | Subscriber, ListSubscriber | createSubscriber, upsertSubscriber, createSubscribersBatch, getSubscriber, getSubscriberByEmail, getSubscribersByStatus, updateSubscriberEmail, updateSubscriberListStatus, unsubscribeFromList, deleteSubscriber, getSubscriberLists | Ready |
| `lists.ssjs` | List, ListSubscriber | createList, getListByName, getListByID, getAllLists, getListsByType, updateList, deleteList, getListSubscribers, getListActiveCount | Ready |
| `triggered-sends.ssjs` | TriggeredSendDefinition, TriggeredSend | createTSD, getTSDs, getTSD, startTSD, stopTSD, sendTriggeredEmail, sendTriggeredEmailBatch | Ready |
| `emails.ssjs` | Email, EmailContentCheck | createEmail, getEmailByID, getEmailByName, getAllEmails, updateEmail, deleteEmail, checkEmailContent | Ready |
| `tracking-events.ssjs` | SentEvent, OpenEvent, ClickEvent, BounceEvent, UnsubEvent, NotSentEvent | getSentEvents, getOpenEvents, getClickEvents, getBounceEvents, getUnsubEvents, getNotSentEvents (each with ByJob, ByDate variants), getHardBounces, getClickEventsByURL, getJobTrackingReport, storeEventsToDE | Ready |
| `automations.ssjs` | Automation, QueryDefinition, ImportDefinition, ScriptActivity, Activity | **Create:** createAutomation, createQueryActivity, createQueryActivitiesBulk, createImportDefinition, createScriptActivity. **Retrieve:** getAllAutomations, getAutomationsByStatus, getRunningAutomations, getScheduledAutomations, getErroredAutomations, getAutomationByName, getAutomationByKey, getQueryActivities, getQueryActivityByName, getImportDefinitions, getActivities, getAutomationSummary. **Actions:** startAutomation, startAutomationByName, updateQueryActivity, deleteQueryActivity | Ready |
| `log-unsub-event.ssjs` | (Execute: LogUnsubEvent) | oneClickUnsub, logUnsubEvent, handleUnsubPage, batchUnsub | Ready |
| `utilities.ssjs` | (Any) | retrieveAll, retrieveWithLimit, describeObject, safeCall, processBatch, retrieveFromBU, createInBU, retrieveAllAccounts, simpleFilter, complexFilter, dateFilter, formatDERows, writeJSON, writeTable | Ready |

## SOAP Object Coverage

| Object | Script(s) |
|--------|-----------|
| DataExtension | data-extensions.ssjs |
| DataExtensionObject | data-extensions.ssjs |
| DataExtensionField | data-extensions.ssjs |
| DataFolder | folders.ssjs |
| Subscriber | subscribers.ssjs |
| List | lists.ssjs |
| ListSubscriber | subscribers.ssjs, lists.ssjs |
| TriggeredSendDefinition | triggered-sends.ssjs |
| TriggeredSend | triggered-sends.ssjs |
| Email | emails.ssjs |
| EmailContentCheck | emails.ssjs |
| SentEvent | tracking-events.ssjs |
| OpenEvent | tracking-events.ssjs |
| ClickEvent | tracking-events.ssjs |
| BounceEvent | tracking-events.ssjs |
| UnsubEvent | tracking-events.ssjs |
| NotSentEvent | tracking-events.ssjs |
| Automation | automations.ssjs |
| QueryDefinition | automations.ssjs |
| ImportDefinition | automations.ssjs |
| ScriptActivity | automations.ssjs |
| Activity | automations.ssjs |
| LogUnsubEvent (execute) | log-unsub-event.ssjs |

## WSProxy Methods Covered

| Method | Used In |
|--------|---------|
| `createItem()` | data-extensions, folders, subscribers, lists, triggered-sends, emails, automations |
| `createBatch()` | data-extensions, subscribers, tracking-events |
| `updateItem()` | data-extensions, folders, subscribers, lists, emails |
| `updateBatch()` | data-extensions |
| `deleteItem()` | data-extensions, folders, lists, emails |
| `deleteBatch()` | data-extensions |
| `retrieve()` | All scripts |
| `getNextBatch()` | data-extensions, folders, subscribers, lists, triggered-sends, tracking-events, automations, utilities |
| `describe()` | data-extensions, utilities |
| `execute()` | log-unsub-event |
| `performItem()` | data-extensions, triggered-sends, emails, automations |
| `setClientId()` | utilities |
| `resetClientIds()` | utilities |
| `setBatchSize()` | (available in utilities via opts) |
