(function (window, document) {
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

    var labelElement = document.createElement("label")
    labelElement.textContent = label;
    labelElement.appendChild(button);
    return labelElement;
  }

  function GetDeviceProfilesClick(device) {
    ClearChildren(document.getElementById("profile-list"));
    chrome.bluetooth.getProfiles({ device: device }, function (profiles) {
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
        var getProfilesAction = CreateActionButton("", "Get Profiles", function () {
          GetDeviceProfilesClick(device);
        });
        td.appendChild(getProfilesAction);
        var getServicesAction = CreateActionButton("", "Get Services", function () {
          GetDeviceServicesClick(device);
        });
        td.appendChild(getServicesAction);
        row.appendChild(td);
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

  var kFtpProfile = "0000000A-0000-1000-8000-00805F9B34FB";

  function AddFtpProfileClick() {
    var profile = {
      uuid: kFtpProfile
    };
    chrome.bluetooth.addProfile(profile, function () {
      if (chrome.runtime.lastError)
        log("Error adding profile: " + chrome.runtime.lastError.message);
      else
        log("Profile added.");
    });
  }

  function RemoveFtpProfileClick() {
    var profile = {
      uuid: kFtpProfile
    };
    chrome.bluetooth.removeProfile(profile, function () {
      if (chrome.runtime.lastError)
        log("Error removing profile: " + chrome.runtime.lastError.message);
      else
        log("Profile removed.");
    });
  }

  function OnAdapterStateChanged(state) {
    log("OnAdapterStateChanged");
    DisplayAdapterState(state);
  }

  function OnConnection(socket) {
    log("OnConnection");
  }

  function Setup() {
    document.getElementById('list-devices').onclick = ListDevicesClick;
    document.getElementById('get-adapter-state').onclick = GetAdapterStateClick;
    document.getElementById('add-ftp-profile').onclick = AddFtpProfileClick;
    document.getElementById('remove-ftp-profile').onclick = RemoveFtpProfileClick;
    chrome.bluetooth.onAdapterStateChanged.addListener(OnAdapterStateChanged);
    chrome.bluetooth.onConnection.addListener(OnConnection);
  }

  window.onload = function() {
    Setup();
  }
})(window, document);



var kUUID = '00001101-0000-1000-8000-00805f9b34fb';

var level = 1;
var pin = 0;
function runAtInterval(socket) {
  return function() {
    var buffer = new ArrayBuffer(4);
    var view = new Uint8Array(buffer);

    // Set the level of pin0 to level
    // constants taken from here:
    // https://github.com/ytai/ioio/wiki/
    view[2] = 4;
    view[3] = pin << 2 | level;
    level = (level == 0) ? 1 : 0;

    chrome.bluetooth.write({socketId:socket.id, data:buffer},
        function(bytes) {
          if (chrome.runtime.lastError) {
            log('Write error: ' + chrome.runtime.lastError.message);
          } else {
            log('wrote ' + bytes + ' bytes');
          }
        });
  };
}

var socketId_;
var intervalId_;
var connectCallback = function(socket) {
  if (socket) {
    log('Connected!  Socket ID is: ' + socket.id + ' on service ' +
        socket.serviceUuid);
    socketId_ = socket.id;

    // Set pin0 as output.
    var buffer = new ArrayBuffer(2);
    var view = new Uint8Array(buffer);
    // constants taken from here:
    // https://github.com/ytai/ioio/wiki/
    view[0] = 3;
    view[1] = pin << 2 | 2;
    chrome.bluetooth.write({socketId:socket.id, data:buffer},
        function(bytes) {
          if (chrome.runtime.lastError) {
            log('Write error: ' + chrome.runtime.lastError.message);
          } else {
            log('wrote ' + bytes + ' bytes');
          }
        });

    intervalId_ = window.setInterval(runAtInterval(socket), 1000);
  } else {
    log('Failed to connect.');
  }
};

var connectToDevice = function(result) {
  if (chrome.runtime.lastError) {
    log('Error searching for a device to connect to.');
    return;
  }
  if (result.length == 0) {
    log('No devices found to connect to.');
    return;
  }
  for (var i in result) {
    var device = result[i];
    log('Connecting to device: ' + device.name + ' @ ' + device.address);
    chrome.bluetooth.connect(
        {deviceAddress: device.address, serviceUuid: kUUID}, connectCallback);
  }
};

//chrome.bluetooth.getDevices({uuid: kUUID}, connectToDevice);
