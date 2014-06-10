/// <reference path="chrome.d.ts"/>
/// <reference path="core.ts"/>
/// <reference path="obex.ts"/>
/// <reference path="bluetooth.ts"/>
// See https://www.bluetooth.org/en-us/specification/assigned-numbers/service-discovery
var kOBEXObjectPush = '00001105-0000-1000-8000-00805f9b34fb';
var kOBEXFileTransfer = '00001106-0000-1000-8000-00805f9b34fb';

function log(msg) {
    var msg_str = (typeof (msg) == 'object') ? JSON.stringify(msg) : msg;
    console.log(msg_str);

    var l = document.getElementById('log');
    if (l) {
        l.innerText += msg_str + '\n';
    }
}

function ClearChildren(element) {
    while (element.firstChild) {
        element.removeChild(element.firstChild);
    }
}

function CreateActionButton(label, caption, callback) {
    var button = document.createElement("input");
    button.setAttribute("type", "button");
    button.setAttribute("value", caption);
    button.onclick = callback;

    var labelElement = document.createElement("label");
    labelElement.textContent = label;
    labelElement.appendChild(button);
    return labelElement;
}

function GetDeviceProfilesClick(device) {
    ClearChildren(document.getElementById("profile-list"));
    device.uuids.forEach(function (uuid) {
        DisplayProfile(uuid);
    });
}

function sendPutRequest(socketId, callback) {
    var request = new Obex.PutRequestBuilder();
    request.isFinal = true;
    request.length = 3;
    request.name = "hello.txt";
    request.body = new Obex.ByteArrayView(new ArrayBuffer(3));
    var view = request.body;
    view.setUint8(0, 'a'.charCodeAt(0));
    view.setUint8(1, 'b'.charCodeAt(0));
    view.setUint8(2, 'c'.charCodeAt(0));

    var requestProcessor = new Bluetooth.RequestProcessor(socketId);
    requestProcessor.sendRequest(request, function (response) {
        console.log("response.code=" + response.opCode);
        console.log("response.isFinal=" + response.isFinal);

        var headers = new Obex.HeaderListParser(response.data).parse();
        console.log(headers);
        callback(socketId, response);
    });
}

function sendConnectRequest(socketId, callback) {
    var request = new Obex.ConnectRequestBuilder();
    request.count = 1;
    request.length = 100;

    var requestProcessor = new Bluetooth.RequestProcessor(socketId);
    requestProcessor.sendRequest(request, function (response) {
        console.log("response.code=" + response.opCode);
        console.log("response.isFinal=" + response.isFinal);
        var connectResponse = new Obex.ConnectResponse(response);
        console.log(connectResponse);
        callback(socketId, connectResponse);
    });
}

function sendDisconnectRequest(socketId, callback) {
    var request = new Obex.DisconnectRequestBuilder();

    var requestProcessor = new Bluetooth.RequestProcessor(socketId);
    requestProcessor.sendRequest(request, function (response) {
        console.log("response.code=" + response.opCode);
        console.log("response.isFinal=" + response.isFinal);
        console.log(response);
        callback(socketId, response);
    });
}

function processObjectPushConnection(socket) {
    console.log("Connection opened from peer client.");
    //  var parser = new Obex.PacketParser();
    //  parser.setHandler(packet => {
    //  });
    //  readPoll(socket, (data) => {
    //    parser.addData(new Obex.ByteArrayView(data));
    //  });
}

function ObjectPushClick(device) {
    var uuid = kOBEXObjectPush.toLowerCase();
    var profile = { uuid: uuid };

    chrome.bluetoothSocket.create({}, function (createInfo) {
        chrome.bluetoothSocket.connect(createInfo.socketId, device.address, profile.uuid, function () {
            if (chrome.runtime.lastError) {
                log("Error connecting to Object Push profile: " + chrome.runtime.lastError.message);
                return;
            }
            sendPutRequest(createInfo.socketId, function (socketId, response) {
                chrome.bluetoothSocket.disconnect(socketId, function () {
                    console.log("Socket disconnected!");
                });
            });
        });
    });
}

function ListDevicesClick() {
    var table = document.getElementById("device-list");
    ClearChildren(table);
    chrome.bluetooth.getDevices(function (devices) {
        devices.forEach(function (device) {
            log('Got device.');

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

            //
            var getProfilesAction = CreateActionButton("", "Get Profiles", function () {
                GetDeviceProfilesClick(device);
            });
            td.appendChild(getProfilesAction);

            //
            var objectPushAction = CreateActionButton("", "Push", function () {
                ObjectPushClick(device);
            });
            td.appendChild(objectPushAction);
        });
        log('Done getting devices.');
    });
}

function DisplayAdapterState(state) {
    var table = document.getElementById("adapter-state");
    var row = document.createElement("tr");
    table.appendChild(row);

    var td = document.createElement("td");
    td.innerText = state.address;
    row.appendChild(td);

    var td = document.createElement("td");
    td.innerText = state.name;
    row.appendChild(td);

    var td = document.createElement("td");
    td.innerText = state.powered;
    row.appendChild(td);

    var td = document.createElement("td");
    td.innerText = state.available;
    row.appendChild(td);

    var td = document.createElement("td");
    td.innerText = state.discovering;
    row.appendChild(td);
}

function DisplayProfile(uuid) {
    var table = document.getElementById("profile-list");
    var row = document.createElement("tr");
    table.appendChild(row);

    var td = document.createElement("td");
    td.innerText = uuid;
    row.appendChild(td);

    var td = document.createElement("td");

    //td.innerText = profile.name;
    row.appendChild(td);

    var td = document.createElement("td");

    //td.innerText = profile.channel;
    row.appendChild(td);

    var td = document.createElement("td");

    //td.innerText = profile.psm;
    row.appendChild(td);

    var td = document.createElement("td");

    //td.innerText = profile.requireAuthentication;
    row.appendChild(td);

    var td = document.createElement("td");

    //td.innerText = profile.requireAuthorization;
    row.appendChild(td);

    var td = document.createElement("td");

    //td.innerText = profile.autoConnect;
    row.appendChild(td);

    var td = document.createElement("td");

    //td.innerText = profile.version;
    row.appendChild(td);

    var td = document.createElement("td");

    //td.innerText = profile.features;
    row.appendChild(td);
}

function DisplayService(service) {
    var table = document.getElementById("service-list");
    var row = document.createElement("tr");
    table.appendChild(row);

    var td = document.createElement("td");
    td.innerText = service.name;
    row.appendChild(td);

    var td = document.createElement("td");
    td.innerText = service.uuid;
    row.appendChild(td);
}

function GetAdapterStateClick() {
    chrome.bluetooth.getAdapterState(DisplayAdapterState);
}

function RegisterObjectPushProfile() {
    var profile = {
        uuid: kOBEXObjectPush
    };
    // TODO: use "Listen" API
    //chrome.bluetooth.addProfile(profile, function () {
    //  if (chrome.runtime.lastError)
    //    log("Error registering profile: " + chrome.runtime.lastError.message);
    //  else {
    //    log("Profile successfully registed.");
    //    var getDeviceCallback = (device: Bluetooth.Device) => {
    //      Bluetooth.connectionDispatcher.setHandler(device, profile, (socket: Bluetooth.Socket) => {
    //        processObjectPushConnection(socket);
    //      });
    //    };
    //    chrome.bluetooth.getDevices(devices => devices.forEach(device => getDeviceCallback(device)));
    //  }
    //});
}

function UnregisterObjectPushProfile() {
    var profile = {
        uuid: kOBEXObjectPush
    };
    //chrome.bluetooth.removeProfile(profile, function () {
    //  if (chrome.runtime.lastError)
    //    log("Error unregistering profile: " + chrome.runtime.lastError.message);
    //  else
    //    log("Profile successfully unregistered.");
    //});
}

function OnAdapterStateChanged(state) {
    log("OnAdapterStateChanged");
    DisplayAdapterState(state);
}

function Setup() {
    document.getElementById('list-devices').onclick = ListDevicesClick;
    document.getElementById('get-adapter-state').onclick = GetAdapterStateClick;
    document.getElementById('register-object-push-profile').onclick = RegisterObjectPushProfile;
    document.getElementById('unregister-object-push-profile').onclick = UnregisterObjectPushProfile;
    chrome.bluetooth.onAdapterStateChanged.addListener(OnAdapterStateChanged);

    var request = new Obex.PutRequestBuilder();
    request.isFinal = true;
    request.length = 3;
    request.name = "hello.txt";
    request.body = new Obex.ByteArrayView(new ArrayBuffer(3));
    var view = request.body;
    view.setUint8(0, 'a'.charCodeAt(0));
    view.setUint8(1, 'b'.charCodeAt(0));
    view.setUint8(2, 'c'.charCodeAt(0));
    //var stream = new Obex.ByteStream();
    //request.serialize(stream);
    //Obex.dumpArrayBuffer(stream.toArrayBuffer());
}

window.onload = function () {
    Setup();
};
//# sourceMappingURL=main.js.map
