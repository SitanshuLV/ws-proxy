<script runat="server">
Platform.Load("Core", "1");

var api = new Script.Util.WSProxy();

// ============================================================
// CAMPAIGN SETUP INTEGRATION
// End-to-end workflow to create a complete email campaign
// ============================================================

// ------ MAIN WORKFLOW ------
/**
 * Sets up a complete email campaign from scratch
 * Steps:
 * 1. Create campaign folder
 * 2. Create sendable data extension
 * 3. Create email
 * 4. Create send definition
 * 5. Create triggered send definition
 * 6. Create automation with query activity
 * 7. Start automation
 * 8. Send test email
 */
function setupCampaign(config) {
    // config = {
    //   campaignName: "My Campaign",
    //   folderPath: "Campaigns/Q1",
    //   deDescription: "Campaign subscriber list",
    //   emailName: "Welcome Email",
    //   emailSubject: "Welcome!",
    //   emailContent: "<h1>Welcome</h1>",
    //   senderProfileKey: "default",
    //   queryName: "Active Subscribers Query",
    //   queryDefinition: "SELECT * FROM DE WHERE Status = 'Active'",
    //   automationName: "Campaign Automation",
    //   sendListID: 123,
    //   categoryID: 0,
    //   daysToRun: 7
    // }

    var workflow = {
        success: false,
        steps: [],
        errors: [],
        folderID: null,
        deKey: null,
        emailID: null,
        sendDefinitionID: null,
        tsdID: null,
        automationID: null,
        overallStatus: "STARTED"
    };

    try {
        // Step 1: Create folder
        workflow.steps.push("Creating campaign folder...");
        var folderRes = createCampaignFolder(config.campaignName, config.folderPath);
        if (!folderRes.success) {
            workflow.errors.push("Folder creation failed: " + folderRes.error);
            workflow.overallStatus = "FAILED_AT_FOLDER";
            return workflow;
        }
        workflow.folderID = folderRes.folderID;
        workflow.steps.push("✓ Folder created: " + workflow.folderID);

        // Step 2: Create sendable data extension
        workflow.steps.push("Creating data extension...");
        var deRes = createCampaignDataExtension(
            config.campaignName + "_Subscribers",
            config.campaignName + "_Subscribers",
            config.deDescription,
            workflow.folderID
        );
        if (!deRes.success) {
            workflow.errors.push("DE creation failed: " + deRes.error);
            workflow.overallStatus = "FAILED_AT_DE";
            return workflow;
        }
        workflow.deKey = deRes.customerKey;
        workflow.steps.push("✓ Data Extension created: " + workflow.deKey);

        // Step 3: Create email
        workflow.steps.push("Creating email...");
        var emailRes = createCampaignEmail(
            config.emailName,
            config.emailSubject,
            config.emailContent,
            workflow.folderID
        );
        if (!emailRes.success) {
            workflow.errors.push("Email creation failed: " + emailRes.error);
            workflow.overallStatus = "FAILED_AT_EMAIL";
            return workflow;
        }
        workflow.emailID = emailRes.emailID;
        workflow.steps.push("✓ Email created: " + workflow.emailID);

        // Step 4: Create send definition
        workflow.steps.push("Creating send definition...");
        var sendDefRes = createCampaignSendDefinition(
            config.campaignName + "_SendDef",
            workflow.emailID,
            config.sendListID,
            config.senderProfileKey,
            config.categoryID,
            workflow.folderID
        );
        if (!sendDefRes.success) {
            workflow.errors.push("SendDefinition creation failed: " + sendDefRes.error);
            workflow.overallStatus = "FAILED_AT_SENDDEF";
            return workflow;
        }
        workflow.sendDefinitionID = sendDefRes.sendDefinitionID;
        workflow.steps.push("✓ SendDefinition created: " + workflow.sendDefinitionID);

        // Step 5: Create triggered send definition
        workflow.steps.push("Creating triggered send definition...");
        var tsdRes = createCampaignTriggeredSend(
            config.campaignName + "_TSD",
            workflow.emailID,
            workflow.deKey,
            config.senderProfileKey,
            workflow.folderID
        );
        if (!tsdRes.success) {
            workflow.errors.push("TriggeredSend creation failed: " + tsdRes.error);
            workflow.overallStatus = "FAILED_AT_TSD";
            return workflow;
        }
        workflow.tsdID = tsdRes.tsdID;
        workflow.steps.push("✓ TriggeredSend created: " + workflow.tsdID);

        // Step 6: Create automation with query activity
        workflow.steps.push("Creating automation...");
        var automationRes = createCampaignAutomation(
            config.automationName,
            config.queryName,
            config.queryDefinition,
            workflow.tsdID,
            config.daysToRun
        );
        if (!automationRes.success) {
            workflow.errors.push("Automation creation failed: " + automationRes.error);
            workflow.overallStatus = "FAILED_AT_AUTOMATION";
            return workflow;
        }
        workflow.automationID = automationRes.automationID;
        workflow.steps.push("✓ Automation created: " + workflow.automationID);

        // Step 7: Start automation (optional, can be done manually)
        workflow.steps.push("Starting automation...");
        var startRes = startAutomation(workflow.automationID);
        if (!startRes.success) {
            workflow.errors.push("Automation start failed: " + startRes.error);
            workflow.overallStatus = "FAILED_AT_START";
            return workflow;
        }
        workflow.steps.push("✓ Automation started");

        workflow.success = true;
        workflow.overallStatus = "COMPLETE";
        return workflow;

    } catch (e) {
        workflow.errors.push("Unexpected error: " + Stringify(e));
        workflow.overallStatus = "FAILED_EXCEPTION";
        return workflow;
    }
}

// ------ HELPER FUNCTIONS ------

function createCampaignFolder(campaignName, folderPath) {
    try {
        var res = api.createItem("DataFolder", {
            Name: campaignName,
            Description: "Campaign: " + campaignName,
            ContentType: "email",
            Parent: {
                ID: getRootFolderID()
            }
        });

        if (res.Status === "OK") {
            return { success: true, folderID: res.Results[0].NewID };
        }
        return { success: false, error: Stringify(res) };
    } catch (e) {
        return { success: false, error: Stringify(e) };
    }
}

function getRootFolderID() {
    try {
        var res = api.retrieve("DataFolder", ["ID"],
            {
                LeftOperand: { Property: "ParentID", SimpleOperator: "isNull", Value: " " },
                LogicalOperator: "AND",
                RightOperand: { Property: "ContentType", SimpleOperator: "equals", Value: "email" }
            }
        );

        if (res.Status === "OK" && res.Results.length > 0) {
            return res.Results[0].ID;
        }
        return 0;
    } catch (e) {
        return 0;
    }
}

function createCampaignDataExtension(name, customerKey, description, folderID) {
    try {
        var config = {
            Name: name,
            CustomerKey: customerKey,
            Description: description,
            IsSendable: true,
            SendableDataExtensionField: {
                Name: "Email"
            },
            Fields: [
                {
                    Name: "SubscriberID",
                    FieldType: "Number",
                    IsPrimaryKey: true,
                    IsRequired: true
                },
                {
                    Name: "Email",
                    FieldType: "EmailAddress",
                    IsRequired: true
                },
                {
                    Name: "FirstName",
                    FieldType: "Text",
                    MaxLength: 100
                },
                {
                    Name: "Status",
                    FieldType: "Text",
                    MaxLength: 50
                },
                {
                    Name: "CreatedDate",
                    FieldType: "Date"
                }
            ]
        };

        if (folderID) {
            config.CategoryID = folderID;
        }

        var res = api.createItem("DataExtension", config);

        if (res.Status === "OK") {
            return { success: true, customerKey: customerKey, deID: res.Results[0].NewID };
        }
        return { success: false, error: Stringify(res) };
    } catch (e) {
        return { success: false, error: Stringify(e) };
    }
}

function createCampaignEmail(name, subject, content, folderID) {
    try {
        var config = {
            Name: name,
            CustomerKey: Platform.Function.GUID(),
            Subject: subject,
            HTMLBody: content,
            TextBody: "See email client for full message",
            IsActive: true,
            CategoryID: folderID || 0
        };

        var res = api.createItem("Email", config);

        if (res.Status === "OK") {
            return { success: true, emailID: res.Results[0].NewID };
        }
        return { success: false, error: Stringify(res) };
    } catch (e) {
        return { success: false, error: Stringify(e) };
    }
}

function createCampaignSendDefinition(name, emailID, listID, senderProfileKey, categoryID, folderID) {
    try {
        var config = {
            Name: name,
            CustomerKey: Platform.Function.GUID(),
            Email: {
                ID: emailID
            },
            List: {
                ID: listID
            },
            SenderProfile: {
                CustomerKey: senderProfileKey || "default"
            },
            CategoryID: categoryID || 0
        };

        var res = api.createItem("SendDefinition", config);

        if (res.Status === "OK") {
            return { success: true, sendDefinitionID: res.Results[0].NewID };
        }
        return { success: false, error: Stringify(res) };
    } catch (e) {
        return { success: false, error: Stringify(e) };
    }
}

function createCampaignTriggeredSend(name, emailID, deCustomerKey, senderProfileKey, folderID) {
    try {
        var config = {
            Name: name,
            CustomerKey: Platform.Function.GUID(),
            Email: {
                ID: emailID
            },
            List: {
                CustomerKey: deCustomerKey
            },
            SenderProfile: {
                CustomerKey: senderProfileKey || "default"
            },
            CategoryID: folderID || 0,
            SendClassification: {
                CustomerKey: "Default Transactional"
            }
        };

        var res = api.createItem("TriggeredSendDefinition", config);

        if (res.Status === "OK") {
            return { success: true, tsdID: res.Results[0].NewID };
        }
        return { success: false, error: Stringify(res) };
    } catch (e) {
        return { success: false, error: Stringify(e) };
    }
}

function createCampaignAutomation(automationName, queryName, queryDefinition, tsdID, daysToRun) {
    try {
        // Set client ID for Automation creation (required)
        var memberID = Platform.Function.AuthenticatedMemberID();
        var employeeID = Platform.Function.AuthenticatedEmployeeID();

        api.setClientId({
            "ID": memberID,
            "UserID": employeeID
        });

        // Create automation with schedule
        var automationConfig = {
            Name: automationName,
            CustomerKey: Platform.Function.GUID(),
            Description: "Campaign automation for triggered send",
            Recurrence: {
                RecurrenceType: "Daily",
                DayOfWeek: null,
                DayOfMonth: null,
                MonthOfYear: null,
                WeekOfMonth: null,
                HourOfDay: 0,
                MinuteOfHour: 0,
                TimeZoneName: "UTC",
                StartDate: new Date(),
                EndDate: new Date(new Date().getTime() + daysToRun * 24 * 60 * 60 * 1000)
            }
        };

        var automationRes = api.createItem("Automation", automationConfig);

        if (automationRes.Status !== "OK") {
            api.resetClientIds();
            return { success: false, error: Stringify(automationRes) };
        }

        var automationID = automationRes.Results[0].NewID;

        // Create query activity
        var queryActivityConfig = {
            Name: queryName,
            CustomerKey: Platform.Function.GUID(),
            Description: "Query activity for segmentation",
            QueryDefinitionID: null, // We'll create one
            TargetUpdateType: 0,
            TargetObjectID: null
        };

        var queryRes = api.createItem("Activity", queryActivityConfig);

        if (queryRes.Status !== "OK") {
            api.resetClientIds();
            return { success: false, error: "Query activity creation failed: " + Stringify(queryRes) };
        }

        // Create triggered send activity
        var tsdActivityConfig = {
            Name: "Send Email Activity",
            CustomerKey: Platform.Function.GUID(),
            TriggeredSendDefinitionID: tsdID
        };

        var tsdActivityRes = api.createItem("Activity", tsdActivityConfig);

        if (tsdActivityRes.Status !== "OK") {
            api.resetClientIds();
            return { success: false, error: "TSD activity creation failed: " + Stringify(tsdActivityRes) };
        }

        api.resetClientIds();
        return { success: true, automationID: automationID };

    } catch (e) {
        api.resetClientIds();
        return { success: false, error: Stringify(e) };
    }
}

function startAutomation(automationID) {
    try {
        var res = api.performItem("Automation", {
            ObjectID: automationID,
            Name: "Start"
        });

        return { success: res.Status === "OK", result: res };
    } catch (e) {
        return { success: false, error: Stringify(e) };
    }
}

// ============================================================
// USAGE EXAMPLE
// ============================================================

/*
var campaignConfig = {
    campaignName: "Spring_Promo_2025",
    folderPath: "Campaigns/Spring",
    deDescription: "Subscribers for spring promo campaign",
    emailName: "Spring Promotion",
    emailSubject: "Save 30% this spring!",
    emailContent: "<h1>Spring Sale</h1><p>Get 30% off everything</p>",
    senderProfileKey: "default",
    queryName: "Active_Spring_Subscribers",
    queryDefinition: "SELECT * FROM [dataext_key] WHERE Status = 'Active'",
    automationName: "Spring_Promo_Automation",
    sendListID: 123,
    categoryID: 0,
    daysToRun: 30
};

var result = setupCampaign(campaignConfig);
Write(Stringify(result, null, 2));

// Log workflow steps
for (var i = 0; i < result.steps.length; i++) {
    Write(result.steps[i] + "<br>");
}

// Log any errors
if (result.errors.length > 0) {
    Write("<strong>Errors:</strong><br>");
    for (var i = 0; i < result.errors.length; i++) {
        Write(result.errors[i] + "<br>");
    }
}

// Summary
Write("<br><strong>Campaign Setup Complete</strong>");
Write("Status: " + result.overallStatus);
Write("Folder ID: " + result.folderID);
Write("DE Key: " + result.deKey);
Write("Email ID: " + result.emailID);
Write("Automation ID: " + result.automationID);
*/

</script>
