/// <reference path="chrome.d.ts"/>
/// <reference path="obex.ts"/>

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

var connectCallback = [];
function OnConnection(socket: Bluetooth.Socket) {
  try {
    log("OnConnection: socket id=" + socket.id + ", device name=" + socket.device.name + ", profile id=" + socket.profile.uuid);
    var uuid = socket.profile.uuid.toLowerCase();
    if (connectCallback[uuid]) {
      connectCallback[uuid](socket);
    }
  }
  catch (e) {
    console.error(e);
    throw e;
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

  var labelElement = document.createElement("label")
  labelElement.textContent = label;
  labelElement.appendChild(button);
  return labelElement;
}

function GetDeviceProfilesClick(device) {
  ClearChildren(document.getElementById("profile-list"));
  chrome.bluetooth.getProfiles({ device: device }, (profiles) => {
    profiles.forEach(function (profile) {
      DisplayProfile(profile);
    });
  })
}

function GetDeviceServicesClick(device) {
  ClearChildren(document.getElementById("service-list"));
  chrome.bluetooth.getServices({ deviceAddress: device.address }, function (services) {
    services.forEach(function (service) {
      DisplayService(service);
    });
  })
}

function readPoll(socket: Bluetooth.Socket, callback: (data: ArrayBuffer) => void) {
  chrome.bluetooth.read({ socket: socket }, (result?: ArrayBuffer) => {
    if (chrome.runtime.lastError) {
      log("Error reading packet from peer: " + chrome.runtime.lastError.message);
      return;
    }

    if (result.byteLength === 0) {
      console.log("Nothing received from peer. Polling again in 1000 ms.");
      window.setTimeout(() => readPoll(socket, callback), 1000);
      return;
    }

    console.log("Received packet from peer.")
    Obex.dumpArrayBuffer(result);
    callback(result);
  });
}

function sendPutRequest(socket: Bluetooth.Socket) {
  var builder = new Obex.PutRequestBuilder();
  //builder.isFinal = false;
  ////builder.name = "hello.txt";
  //builder.length = 100;
  ////builder.body = new Uint8Array(100);
  builder.isFinal = true;
  builder.length = 3;
  builder.name = "hello.txt";
  builder.body = new Uint8Array(3);
  var view = new DataView(builder.body.buffer);
  view.setUint8(0, 'a'.charCodeAt(0));
  view.setUint8(1, 'a'.charCodeAt(0));
  view.setUint8(2, 'c'.charCodeAt(0));

  var stream = new Obex.ByteStream();
  builder.serialize(stream);
  var buffer = stream.toArrayBuffer();
  Obex.dumpArrayBuffer(buffer);

  chrome.bluetooth.write({ socket: socket, data: buffer }, (result: number) => {
    if (chrome.runtime.lastError) {
      log("Error sending packet to peer: " + chrome.runtime.lastError.message);
      return;
    }
    console.log("PUT packet send to peer (byte length=" + result + ").");

    readPoll(socket, result => {
      var parser = new Obex.ResponseParser();
      parser.setHandler(response => {
        console.log("response.code=" + response.code);
        console.log("response.isFinal=" + response.isFinal);

        var headers = new Obex.HeaderListParser(response.data).parse();
        console.log(headers);
      });
      parser.addData(new Uint8Array(result));
    });
  });
}

function sendConnectRequest(socket: Bluetooth.Socket, callback: (socket: Bluetooth.Socket, response: Obex.ConnectResponse) => void) {
  var builder = new Obex.ConnectRequestBuilder();
  builder.count = 1;
  builder.length = 100;

  var stream = new Obex.ByteStream();
  builder.serialize(stream);
  var buffer = stream.toArrayBuffer();
  Obex.dumpArrayBuffer(buffer);

  chrome.bluetooth.write({ socket: socket, data: buffer }, (result: number) => {
    if (chrome.runtime.lastError) {
      log("Error sending packet to peer: " + chrome.runtime.lastError.message);
      return;
    }
    console.log("CONNECT packet send to peer (result code=" + result + ").");

    readPoll(socket, result => {
      var parser = new Obex.ResponseParser();
      parser.setHandler(response => {
        console.log("response.code=" + response.code);
        console.log("response.isFinal=" + response.isFinal);
        var connectResponse = new Obex.ConnectResponse(response);

        console.log(connectResponse);
        callback(socket, connectResponse);
      });
      parser.addData(new Uint8Array(result));
    });
  });
}

function sendDisconnectRequest(socket: Bluetooth.Socket, response: Obex.ConnectResponse): void {
  var builder = new Obex.DisconnectRequestBuilder();

  var stream = new Obex.ByteStream();
  builder.serialize(stream);
  var buffer = stream.toArrayBuffer();
  Obex.dumpArrayBuffer(buffer);

  chrome.bluetooth.write({ socket: socket, data: buffer }, (result: number) => {
    if (chrome.runtime.lastError) {
      log("Error sending packet to peer: " + chrome.runtime.lastError.message);
      return;
    }
    console.log("DISCONNECT packet send to peer (result code=" + result + ").");

    readPoll(socket, result => {
      var parser = new Obex.ResponseParser();
      parser.setHandler(response => {
        console.log("response.code=" + response.code);
        console.log("response.isFinal=" + response.isFinal);
        console.log(response);
      });
      parser.addData(new Uint8Array(result));
    });
  });
}

function ObjectPushClick(device) {
  var uuid = kOBEXObjectPush.toLowerCase();
  var profile = { uuid: uuid };

  //connectCallback[uuid] = (socket) => {
  //  sendConnectRequest(socket, (socket, response) => {
  //    sendDisconnectRequest(socket, response);
  //  });
  //};
  connectCallback[uuid] = sendPutRequest;

  chrome.bluetooth.connect({ device: device, profile: profile }, function () {
    if (chrome.runtime.lastError)
      log("Error connecting to Object Push profile: " + chrome.runtime.lastError.message);
    else
      log("Successfully connected to Object Push profile.");
  })
}

function ListDevicesClick() {
  var table = document.getElementById("device-list");
  ClearChildren(table);
  chrome.bluetooth.getDevices({
    deviceCallback: function (device) {
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
      td.innerText = device.paired;
      row.appendChild(td);

      var td = document.createElement("td");
      td.innerText = device.connected;
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
      var getServicesAction = CreateActionButton("", "Get Services", function () {
        GetDeviceServicesClick(device);
      });
      td.appendChild(getServicesAction);
      //
      var objectPushAction = CreateActionButton("", "Push", function () {
        ObjectPushClick(device);
      });
      td.appendChild(objectPushAction);
    }
  },
  function () {
    log('Done getting devices.')
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

function DisplayProfile(profile) {
  var table = document.getElementById("profile-list");
  var row = document.createElement("tr");
  table.appendChild(row);

  var td = document.createElement("td");
  td.innerText = profile.uuid;
  row.appendChild(td);

  var td = document.createElement("td");
  td.innerText = profile.name;
  row.appendChild(td);

  var td = document.createElement("td");
  td.innerText = profile.channel;
  row.appendChild(td);

  var td = document.createElement("td");
  td.innerText = profile.psm;
  row.appendChild(td);

  var td = document.createElement("td");
  td.innerText = profile.requireAuthentication;
  row.appendChild(td);

  var td = document.createElement("td");
  td.innerText = profile.requireAuthorization;
  row.appendChild(td);

  var td = document.createElement("td");
  td.innerText = profile.autoConnect;
  row.appendChild(td);

  var td = document.createElement("td");
  td.innerText = profile.version;
  row.appendChild(td);

  var td = document.createElement("td");
  td.innerText = profile.features;
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
  chrome.bluetooth.addProfile(profile, function () {
    if (chrome.runtime.lastError)
      log("Error registering profile: " + chrome.runtime.lastError.message);
    else
      log("Profile successfully registed.");
  });
}

function UnregisterObjectPushProfile() {
  var profile = {
    uuid: kOBEXObjectPush
  };
  chrome.bluetooth.removeProfile(profile, function () {
    if (chrome.runtime.lastError)
      log("Error unregistering profile: " + chrome.runtime.lastError.message);
    else
      log("Profile successfully unregistered.");
  });
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
  chrome.bluetooth.onConnection.addListener(OnConnection);
}

window.onload = function() {
  Setup();
}
