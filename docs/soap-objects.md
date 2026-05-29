# SOAP Objects Quick Reference for WSProxy

> All objects usable as the first parameter in WSProxy methods.

## Data Management

| Object | WSProxy Methods | Key Properties | Common Operations |
|--------|----------------|----------------|-------------------|
| `DataExtension` | create, retrieve, update, delete, perform | `Name`, `CustomerKey`, `ObjectID`, `CategoryID`, `Fields`, `IsSendable` | Create DE, move to folder, clear data |
| `DataExtensionObject` | create, retrieve, update, delete | `CustomerKey`, `Properties`, `Keys` | CRUD on DE rows |
| `DataExtensionField` | retrieve, update | `Name`, `FieldType`, `MaxLength`, `IsPrimaryKey`, `IsRequired`, `DefaultValue`, `ObjectID` | Get/update field definitions |
| `DataFolder` | create, retrieve, delete | `Name`, `ID`, `ObjectID`, `ParentFolder`, `ContentType`, `IsActive` | Organize content folders |

## Subscriber Management

| Object | WSProxy Methods | Key Properties | Common Operations |
|--------|----------------|----------------|-------------------|
| `Subscriber` | create, retrieve, update, delete | `SubscriberKey`, `EmailAddress`, `Status`, `Lists`, `CreatedDate` | Manage subscribers |
| `List` | create, retrieve, update, delete | `ID`, `ListName`, `Description`, `Type`, `CustomerKey` | Manage lists |
| `ListSubscriber` | retrieve | `SubscriberKey`, `ListID`, `Status`, `CreatedDate` | Query list membership |

## Email & Sends

| Object | WSProxy Methods | Key Properties | Common Operations |
|--------|----------------|----------------|-------------------|
| `TriggeredSendDefinition` | create, retrieve, update, perform | `Name`, `CustomerKey`, `TriggeredSendStatus`, `Email`, `List`, `SendClassification`, `SenderProfile` | Create/start/stop TSD |
| `TriggeredSend` | create | `TriggeredSendDefinition`, `Subscribers` | Fire triggered email |
| `Email` | create, retrieve, update, delete | `ID`, `Name`, `Subject`, `HTMLBody`, `CustomerKey` | Manage email content |
| `EmailContentCheck` | perform | `ID` | Content validation |

## Tracking Events

| Object | WSProxy Methods | Shared Properties | Unique Properties |
|--------|----------------|-------------------|-------------------|
| `SentEvent` | retrieve | `SendID`, `SubscriberKey`, `EventDate`, `BatchID`, `ListID`, `TriggeredSendDefinitionObjectID` | — |
| `OpenEvent` | retrieve | (same as above) | — |
| `ClickEvent` | retrieve | (same as above) | `URL` |
| `BounceEvent` | retrieve | (same as above) | `BounceCategory`, `BounceType`, `SMTPCode` |
| `UnsubEvent` | retrieve | (same as above) | — |
| `NotSentEvent` | retrieve | (same as above) | — |

## Automation Studio

| Object | WSProxy Methods | Key Properties | Notes |
|--------|----------------|----------------|-------|
| `Automation` | create, retrieve, perform | `Name`, `CustomerKey`, `ObjectID`, `ProgramID`, `Status`, `IsActive`, `CategoryID`, `LastRunTime`, `ScheduledTime`, `AutomationType` | `setClientId` required for create; use `start` action with perform |
| `QueryDefinition` | create, retrieve, update, delete | `Name`, `CustomerKey`, `ObjectID`, `QueryText`, `TargetType`, `TargetUpdateType`, `DataExtensionTarget`, `CategoryID`, `Status` | SQL Query Activity |
| `ImportDefinition` | create, retrieve | `Name`, `CustomerKey`, `ObjectID`, `UpdateType`, `DestinationObject`, `SourceObject`, `FieldMappingType` | Import Activity |
| `ScriptActivity` | create | `Name`, `CustomerKey`, `Script`, `CategoryID` | SSJS Script Activity |
| `Activity` | retrieve | — | Docs say `AutomationActivity` but use `Activity` |
| `ActivityInstance` | retrieve | — | Docs say `AutomationActivityInstance` but use `ActivityInstance` |

## Execute Operations

| Operation Name | Properties Array | Description |
|---------------|-----------------|-------------|
| `LogUnsubEvent` | `SubscriberKey`, `JobID`, `ListID`, `BatchID`, `Reason` | Log unsubscribe event tracked against a send |

## Perform Actions

| Object | Action Verb | Description |
|--------|------------|-------------|
| `DataExtension` | `ClearData` | Delete all rows from a DE |
| `TriggeredSendDefinition` | `start` | Activate a TSD |
| `TriggeredSendDefinition` | `stop` | Deactivate a TSD |
| `Automation` | `start` | Run an automation |
| `EmailContentCheck` | — | Check email content validity |

## Automation Status Codes

| Code | Status |
|------|--------|
| `-1` | Error |
| `0` | Building/Idle |
| `1` | Ready |
| `2` | Running |
| `3` | Paused |
| `4` | Stopped |
| `5` | Scheduled |
| `6` | Awaiting Confirmation |
| `7` | Inactive/Deactivated |
| `8` | Completed |

## ContentType Values for DataFolder

| Value | Folder Contains |
|-------|----------------|
| `dataextension` | Data Extensions |
| `email` | Emails |
| `template` | Templates |
| `filterdefinition` | Filters |
| `list` | Lists |
| `triggered_send` | Triggered Send Definitions |
| `queryactivity` | Query Activities |
| `automations` | Automations |

## Subscriber Status Values

| Status | Description |
|--------|-------------|
| `Active` | Subscribed and receiving emails |
| `Unsubscribed` | Opted out |
| `Held` | Temporarily held (bounce) |
| `Bounced` | Hard bounce |
| `Deleted` | Removed |

---

## Sources

- [Salesforce SOAP API Object Reference](https://developer.salesforce.com/docs/marketing/marketing-cloud/guide/ssjs_WSProxy_useSSJS.html)
- [ssjs.guide](https://ssjs.guide/function-index/)
- [ssjsdocs.xyz](https://www.ssjsdocs.xyz/)
- [sfmarketing.cloud](https://sfmarketing.cloud/tag/wsproxy/)
- [Gortonington](https://gortonington.com/sfmc-server-side-javascript-5-wsproxy/)
