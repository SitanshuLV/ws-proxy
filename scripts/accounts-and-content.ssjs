<script runat="server">
Platform.Load("Core", "1");

var api = new Script.Util.WSProxy();

// ============================================================
// ACCOUNT OPERATIONS
// ============================================================

// ------ RETRIEVE current account info ------
function getCurrentAccount() {
    try {
        var res = api.retrieve("Account",
            ["ID", "Name", "Email", "Address", "Phone", "Website", "CreatedDate", "CustomerID"],
            { Property: "ID", SimpleOperator: "isNotNull", Value: " " }
        );
        if (res.Status === "OK" && res.Results.length > 0) {
            return { success: true, account: res.Results[0] };
        }
        return { success: false, error: "Account not found" };
    } catch (e) {
        return { success: false, error: Stringify(e) };
    }
}

// ------ RETRIEVE all account users ------
function getAccountUsers() {
    var allResults = [];
    var moreData = true;
    var reqID = null;

    try {
        while (moreData) {
            var data = reqID == null
                ? api.retrieve("AccountUser",
                    ["ID", "Name", "Email", "Status", "IsAccountOwner", "CreatedDate", "LastModifiedDate"],
                    { Property: "Name", SimpleOperator: "isNotNull", Value: " " }
                )
                : api.getNextBatch("AccountUser", reqID);

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
        return { success: true, users: allResults, count: allResults.length };
    } catch (e) {
        return { success: false, error: Stringify(e) };
    }
}

// ------ RETRIEVE account user by name ------
function getAccountUserByName(name) {
    try {
        var res = api.retrieve("AccountUser",
            ["ID", "Name", "Email", "Status", "IsAccountOwner", "CreatedDate"],
            { Property: "Name", SimpleOperator: "equals", Value: name }
        );
        if (res.Status === "OK" && res.Results.length > 0) {
            return { success: true, user: res.Results[0] };
        }
        return { success: false, error: "User not found" };
    } catch (e) {
        return { success: false, error: Stringify(e) };
    }
}

// ------ GET account permissions/features ------
function getAccountPermissions() {
    try {
        var res = api.retrieve("Permission",
            ["Name", "ID", "IsAccountWide", "IsEnabled", "Category"],
            { Property: "IsEnabled", SimpleOperator: "equals", Value: "true" }
        );
        if (res.Status === "OK") {
            return { success: true, permissions: res.Results, count: res.Results.length };
        }
        return { success: false, error: res };
    } catch (e) {
        return { success: false, error: Stringify(e) };
    }
}

// ============================================================
// CONTENT / ASSET OPERATIONS
// Content Builder stores: Images, Documents, Blocks, Templates
// ============================================================

// ------ RETRIEVE content/assets by type ------
function getContentByType(contentType) {
    // contentType: "image", "document", "block", "template", etc.
    try {
        var res = api.retrieve("ContentAsset",
            ["ID", "Name", "AssetType", "Description", "CreatedDate", "ModifiedDate", "Status", "Folder"],
            { Property: "AssetType", SimpleOperator: "equals", Value: contentType }
        );
        if (res.Status === "OK") {
            return { success: true, assets: res.Results, count: res.Results.length };
        }
        return { success: false, error: res };
    } catch (e) {
        return { success: false, error: Stringify(e) };
    }
}

// ------ RETRIEVE content by name ------
function getContentByName(name) {
    try {
        var res = api.retrieve("ContentAsset",
            ["ID", "Name", "AssetType", "Description", "CreatedDate", "Status"],
            { Property: "Name", SimpleOperator: "equals", Value: name }
        );
        if (res.Status === "OK" && res.Results.length > 0) {
            return { success: true, asset: res.Results[0] };
        }
        return { success: false, error: "Asset not found" };
    } catch (e) {
        return { success: false, error: Stringify(e) };
    }
}

// ------ RETRIEVE all content/assets (paginated) ------
function getAllContent() {
    var allResults = [];
    var moreData = true;
    var reqID = null;

    try {
        while (moreData) {
            var data = reqID == null
                ? api.retrieve("ContentAsset",
                    ["ID", "Name", "AssetType", "CreatedDate", "ModifiedDate", "Status"],
                    { Property: "Name", SimpleOperator: "isNotNull", Value: " " }
                )
                : api.getNextBatch("ContentAsset", reqID);

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
        return { success: true, assets: allResults, count: allResults.length };
    } catch (e) {
        return { success: false, error: Stringify(e) };
    }
}

// ------ CREATE content asset (generic) ------
function createContentAsset(name, assetType, description) {
    var config = {
        Name: name,
        AssetType: assetType || "generic",
        Description: description || "",
        Status: "Active"
    };

    try {
        var res = api.createItem("ContentAsset", config);
        if (res.Status === "OK") {
            return { success: true, assetID: res.Results[0].NewID, result: res };
        }
        return { success: false, error: res };
    } catch (e) {
        return { success: false, error: Stringify(e) };
    }
}

// ------ UPDATE content asset ------
function updateContentAsset(assetID, updates) {
    // updates = { Name, Description, Status }
    var config = { ID: assetID };
    if (updates.Name) config.Name = updates.Name;
    if (updates.Description) config.Description = updates.Description;
    if (updates.Status) config.Status = updates.Status;

    try {
        var res = api.updateItem("ContentAsset", config);
        return { success: res.Status === "OK", result: res };
    } catch (e) {
        return { success: false, error: Stringify(e) };
    }
}

// ------ DELETE content asset ------
function deleteContentAsset(assetID) {
    try {
        var res = api.deleteItem("ContentAsset", { ID: assetID });
        return { success: res.Status === "OK", result: res };
    } catch (e) {
        return { success: false, error: Stringify(e) };
    }
}

// ============================================================
// EMAIL TEMPLATE OPERATIONS
// ============================================================

// ------ RETRIEVE email templates ------
function getEmailTemplates() {
    var allResults = [];
    var moreData = true;
    var reqID = null;

    try {
        while (moreData) {
            var data = reqID == null
                ? api.retrieve("EmailTemplate",
                    ["ID", "Name", "Description", "CreatedDate", "ModifiedDate", "Status", "CategoryID"],
                    { Property: "Name", SimpleOperator: "isNotNull", Value: " " }
                )
                : api.getNextBatch("EmailTemplate", reqID);

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
        return { success: true, templates: allResults, count: allResults.length };
    } catch (e) {
        return { success: false, error: Stringify(e) };
    }
}

// ------ RETRIEVE email template by name ------
function getEmailTemplateByName(name) {
    try {
        var res = api.retrieve("EmailTemplate",
            ["ID", "Name", "Description", "CreatedDate", "Status"],
            { Property: "Name", SimpleOperator: "equals", Value: name }
        );
        if (res.Status === "OK" && res.Results.length > 0) {
            return { success: true, template: res.Results[0] };
        }
        return { success: false, error: "Template not found" };
    } catch (e) {
        return { success: false, error: Stringify(e) };
    }
}

// ============================================================
// USAGE EXAMPLES
// ============================================================

/*
// --- Get current account ---
var acct = getCurrentAccount();
Write("Account: " + acct.account.Name);

// --- Get all account users ---
var users = getAccountUsers();
for (var i = 0; i < users.users.length; i++) {
    Write(users.users[i].Name + " (" + users.users[i].Email + ")<br>");
}

// --- Get account permissions ---
var perms = getAccountPermissions();
Write("Enabled features: " + perms.count);

// --- Get all content assets ---
var assets = getAllContent();
Write("Total assets: " + assets.count);

// --- Find asset by name ---
var asset = getContentByName("Logo_Header");

// --- Create content asset ---
var newAsset = createContentAsset("Campaign_Banner", "image", "Q1 2025 campaign banner");

// --- Get all email templates ---
var templates = getEmailTemplates();
for (var t = 0; t < templates.templates.length; t++) {
    Write(templates.templates[t].Name + "<br>");
}
*/

</script>
