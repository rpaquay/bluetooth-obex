/// <reference path="chrome.d.ts"/>
/// <reference path="core.ts"/>
/// <reference path="obex.ts"/>
/// <reference path="bluetooth.ts"/>
var SendFile;
(function (SendFile) {
    // See https://www.bluetooth.org/en-us/specification/assigned-numbers/service-discovery
    var kOBEXObjectPush = '00001105-0000-1000-8000-00805f9b34fb';

    function log(msg) {
        var msg_str = (typeof (msg) == 'object') ? JSON.stringify(msg) : msg;
        console.log(msg_str);

        var ul = document.getElementById('messages-ul');
        if (ul) {
            var li = document.createElement("li");
            li.className = "message";

            var div = document.createElement("div");
            div.className = "content";

            var span = document.createElement("span");
            span.innerText = msg;

            ul.appendChild(li);
            li.appendChild(div);
            div.appendChild(span);
        }
    }

    function clearChildren(element) {
        while (element.firstChild) {
            element.removeChild(element.firstChild);
        }
    }

    function createActionButton(label, caption, callback) {
        var button = document.createElement("input");
        button.setAttribute("type", "button");
        button.setAttribute("value", caption);
        button.onclick = callback;

        var labelElement = document.createElement("label");
        labelElement.textContent = label;
        labelElement.appendChild(button);
        return labelElement;
    }

    function registerObexPushProfile(callback) {
        var uuid = kOBEXObjectPush.toLowerCase();
        var profile = { uuid: uuid };
        callback(profile);
        //chrome.bluetooth.addProfile(profile, () => {
        //  if (chrome.runtime.lastError) {
        //    log("Error adding \"Obex Push\" profile: " + chrome.runtime.lastError.message + " (continue anyways).");
        //  }
        //  callback(profile);
        //  return;
        //});
    }

    function sendFileToSocket(socketId, name, contents, callback) {
        var requestProcessor = new Bluetooth.RequestProcessor(socketId);
        var processor = new Bluetooth.SendFileProcessor(requestProcessor, name, contents);
        processor.setErrorHandler(function (message) {
            log("Error sending file: " + message);
            callback();
            return;
        });
        var sendFileCallback = function (finished) {
            log("Packet at offset " + processor.fileOffset + " of " + processor.fileLength + " sent to peer device.");
            if (finished) {
                log("File \"" + name + "\" successfully sent.");
                callback();
            } else {
                processor.sendNextRequest(sendFileCallback);
            }
        };
        processor.sendNextRequest(sendFileCallback);
    }

    function sendFileToDevice(device, fileName, contents) {
        log("Sending file \"" + fileName + "\" of length " + contents.byteLength + ".");

        registerObexPushProfile(function (profile) {
            chrome.bluetoothSocket.create({}, function (createInfo) {
                chrome.bluetoothSocket.connect(createInfo.socketId, device.address, profile.uuid, function () {
                    if (chrome.runtime.lastError) {
                        log("Error connecting to Object Push profile: " + chrome.runtime.lastError.message);
                        return;
                    }
                    sendFileToSocket(createInfo.socketId, fileName, contents, function () {
                        chrome.bluetoothSocket.disconnect(createInfo.socketId, function () {
                            log("Socket closed.");
                        });
                    });
                });
            });
        });
    }

    function sendFileAction(device) {
        chrome.fileSystem.chooseEntry({ type: 'openFile' }, function (readOnlyEntry) {
            readOnlyEntry.file(function (file) {
                var reader = new FileReader();
                reader.onerror = function (e) {
                    log("Error loading file: " + e.message);
                };
                reader.onloadend = function (e) {
                    log("File loaded successfully!");
                    sendFileToDevice(device, file.name, reader.result);
                };
                reader.readAsArrayBuffer(file);
            });
        });
    }

    function displayDevices() {
        log('Getting list of devices...');
        var table = document.getElementById("device-list");
        clearChildren(table);
        chrome.bluetooth.getDevices(function (devices) {
            devices.forEach(function (device) {
                var row = document.createElement("tr");
                table.appendChild(row);

                var td = document.createElement("td");
                td.innerText = device.address;
                row.appendChild(td);

                var td = document.createElement("td");
                td.innerText = device.name;
                row.appendChild(td);

                var td = document.createElement("td");
                td.innerText = device.paired.toString();
                row.appendChild(td);

                var td = document.createElement("td");
                td.innerText = device.connected.toString();
                row.appendChild(td);

                // Actions
                var td = document.createElement("td");
                row.appendChild(td);
                var objectPushAction = createActionButton("", "Send File...", function () {
                    sendFileAction(device);
                });
                td.appendChild(objectPushAction);
            });

            log('Done getting devices.');
        });
    }

    function Setup() {
        displayDevices();
    }

    window.onload = function () {
        Setup();
    };
})(SendFile || (SendFile = {}));
//# sourceMappingURL=send_file.js.map
