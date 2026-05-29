<script runat="server">
Platform.Load("Core", "1");

var api = new Script.Util.WSProxy();

// ============================================================
// FOLDER (DataFolder) OPERATIONS
// ============================================================

// ------ CREATE a folder ------
function createFolder(name, parentFolderID, contentType, description) {
    var config = {
        "Name": name,
        "Description": description || "",
        "ParentFolder": {
            ID: parentFolderID,
            IDSpecified: true
        },
        "IsActive": true,
        "ContentType": contentType || "dataextension"
    };

    try {
        var res = api.createItem("DataFolder", config);
        if (res.Status === "OK") {
            return { success: true, folderID: res.Results[0].NewID, result: res };
        }
        return { success: false, error: res };
    } catch (e) {
        return { success: false, error: Stringify(e) };
    }
}

// ------ RETRIEVE folder by Name ------
function getFolderByName(folderName, contentType) {
    var filter;
    if (contentType) {
        filter = {
            LeftOperand: {
                Property: "Name",
                SimpleOperator: "equals",
                Value: folderName
            },
            LogicalOperator: "AND",
            RightOperand: {
                Property: "ContentType",
                SimpleOperator: "equals",
                Value: contentType
            }
        };
    } else {
        filter = {
            Property: "Name",
            SimpleOperator: "equals",
            Value: folderName
        };
    }

    try {
        var res = api.retrieve("DataFolder", ["ID", "Name", "ParentFolder.ID", "ContentType", "ObjectID"], filter);
        if (res.Status === "OK" && res.Results.length > 0) {
            return { success: true, folder: res.Results[0] };
        }
        return { success: false, error: "Folder not found" };
    } catch (e) {
        return { success: false, error: Stringify(e) };
    }
}

// ------ RETRIEVE folder by ID ------
function getFolderByID(folderID) {
    try {
        var res = api.retrieve("DataFolder", ["ID", "Name", "ParentFolder.ID", "ContentType", "ObjectID"], {
            Property: "ID",
            SimpleOperator: "equals",
            Value: folderID
        });
        if (res.Status === "OK" && res.Results.length > 0) {
            return { success: true, folder: res.Results[0] };
        }
        return { success: false, error: "Folder not found" };
    } catch (e) {
        return { success: false, error: Stringify(e) };
    }
}

// ------ RETRIEVE all folders by ContentType ------
function getFoldersByType(contentType) {
    var allResults = [];
    var moreData = true;
    var reqID = null;

    try {
        while (moreData) {
            var data = reqID == null
                ? api.retrieve("DataFolder", ["ID", "Name", "ParentFolder.ID", "ContentType"], {
                    Property: "ContentType",
                    SimpleOperator: "equals",
                    Value: contentType
                })
                : api.getNextBatch("DataFolder", reqID);

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
        return { success: true, folders: allResults, count: allResults.length };
    } catch (e) {
        return { success: false, error: Stringify(e) };
    }
}

// ------ GET the root folder for a content type ------
function getRootFolder(contentType) {
    return getFolderByName("Data Extensions", contentType || "dataextension");
}

// ------ GET folder path (breadcrumb) ------
function getFolderPath(folderID) {
    var path = [];
    var currentID = folderID;
    var maxDepth = 20; // Safety limit

    try {
        while (currentID && maxDepth > 0) {
            var res = api.retrieve("DataFolder", ["ID", "Name", "ParentFolder.ID"], {
                Property: "ID",
                SimpleOperator: "equals",
                Value: currentID
            });

            if (res.Status === "OK" && res.Results.length > 0) {
                path.unshift(res.Results[0].Name);
                var parentID = res.Results[0]["ParentFolder.ID"] || res.Results[0].ParentFolder ? res.Results[0].ParentFolder.ID : null;
                if (parentID === currentID || !parentID || parentID === 0) break;
                currentID = parentID;
            } else {
                break;
            }
            maxDepth--;
        }
        return { success: true, path: path.join(" > ") };
    } catch (e) {
        return { success: false, error: Stringify(e) };
    }
}

// ------ GET folder for a specific Data Extension ------
function getDEFolder(customerKey) {
    try {
        var deReq = api.retrieve("DataExtension", ["CategoryID"], {
            Property: "CustomerKey",
            SimpleOperator: "equals",
            Value: customerKey
        });

        if (deReq.Status === "OK" && deReq.Results.length > 0) {
            return getFolderByID(deReq.Results[0].CategoryID);
        }
        return { success: false, error: "DE not found" };
    } catch (e) {
        return { success: false, error: Stringify(e) };
    }
}

// ------ DELETE a folder ------
function deleteFolder(folderObjectID) {
    try {
        var res = api.deleteItem("DataFolder", { "ObjectID": folderObjectID });
        return { success: res.Status === "OK", result: res };
    } catch (e) {
        return { success: false, error: Stringify(e) };
    }
}

// ------ DELETE a folder by Name ------
function deleteFolderByName(folderName, contentType) {
    var folder = getFolderByName(folderName, contentType);
    if (folder.success) {
        return deleteFolder(folder.folder.ObjectID);
    }
    return folder;
}

// ============================================================
// USAGE EXAMPLES
// ============================================================

/*
// --- Get root Data Extensions folder ---
var root = getRootFolder("dataextension");
Write("Root folder ID: " + root.folder.ID);

// --- Create subfolder ---
var newFolder = createFolder("Campaign_Tracking", root.folder.ID, "dataextension", "Tracking DEs");
Write("New folder ID: " + newFolder.folderID);

// --- List all DE folders ---
var allFolders = getFoldersByType("dataextension");
for (var i = 0; i < allFolders.folders.length; i++) {
    Write(allFolders.folders[i].Name + " (ID: " + allFolders.folders[i].ID + ")<br>");
}

// --- Get folder path ---
var path = getFolderPath(12345);
Write("Path: " + path.path);

// --- Delete folder ---
deleteFolderByName("Campaign_Tracking", "dataextension");
*/

</script>
