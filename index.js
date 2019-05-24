//homebridge-platform-simplisafe

/*
var http = require('http');
var Accessory, Service, Characteristic, UUIDGen;

module.exports = function(homebridge) {
  // Accessory must be created from PlatformAccessory Constructor
  Accessory = homebridge.platformAccessory;

  // Service and Characteristic are from hap-nodejs
  Service = homebridge.hap.Service;
  Characteristic = homebridge.hap.Characteristic;
  UUIDGen = homebridge.hap.uuid;

  // For platform plugin to be considered as dynamic platform plugin,
  // registerPlatform(pluginName, platformName, constructor, dynamic), dynamic must be true
  homebridge.registerPlatform("homebridge-platform-simplisafe", "homebridge-platform-simplisafe", SimpliSafe, true);
}

// Platform constructor
// config may be null
// api may be null if launched from old homebridge version
function SimpliSafe(log, config, api) {
  log("SimpliSafe Init");
  var platform = this;
  this.log = log;
  this.config = config;
  this.accessories = [];
  var ssClient = new API(log);
  SSAPI.login_via_credentials();
  var systems = SSAPI.get_systems();
  platform.log(systems);

      platform.log('System: ' + system.serial);
      for (let serial in system.sensors){
          var sensor_attrs = system.sensors[serial];
          //console.log(sensor_attrs);
          platform.log('Sensor: ' + serial + ' (name: ' + sensor_attrs.name + ', type: ' + sensor_attrs._type + ', triggered: ' + sensor_attrs.triggered +')');
      }




  this.requestServer = http.createServer(function(request, response) {
    if (request.url === "/add") {
      this.addAccessory(new Date().toISOString());
      response.writeHead(204);
      response.end();
    }

    if (request.url == "/reachability") {
      this.updateAccessoriesReachability();
      response.writeHead(204);
      response.end();
    }

    if (request.url == "/remove") {
      this.removeAccessory();
      response.writeHead(204);
      response.end();
    }
  }.bind(this));

  this.requestServer.listen(18081, function() {
    platform.log("Server Listening...");
  });

  if (api) {
      // Save the API object as plugin needs to register new accessory via this object
      this.api = api;

      // Listen to event "didFinishLaunching", this means homebridge already finished loading cached accessories.
      // Platform Plugin should only register new accessory that doesn't exist in homebridge after this event.
      // Or start discover new accessories.
      this.api.on('didFinishLaunching', function() {
        platform.log("DidFinishLaunching");
        for (let accessory in this.accessories){
          var acc = this.accessories[accessory];
          platform.log(acc.context.SerialNumber);
        };
        //platform.log(this.accessories);
      }.bind(this));
  }
}

// Function invoked when homebridge tries to restore cached accessory.
// Developer can configure accessory at here (like setup event handler).
// Update current value.
SimpliSafe.prototype.configureAccessory = function(accessory) {
  //this.log(accessory.displayName, "Configure Accessory");
  var platform = this;

  // Set the accessory to reachable if plugin can currently process the accessory,
  // otherwise set to false and update the reachability later by invoking
  // accessory.updateReachability()
  accessory.reachable = false;
  accessory.updateReachability();

  accessory.on('identify', function(paired, callback) {
    platform.log(accessory.displayName, "Identify!!!");
    callback();
  });
//platform.log(accessory);
  if (accessory.getService(Service.Lightbulb)) {
    accessory.getService(Service.Lightbulb).getCharacteristic(Characteristic.On).on('set', function (value, callback){
      platform.on_Event(accessory.UUID, value, callback);
    });
  };
  //platform.log(accessory.displayName, accessory.services);
  this.accessories.push(accessory);

}

SimpliSafe.prototype.on_Event = function(accessoryID, value, callback) {
for (let accessory in this.accessories){
  var acc = this.accessories[accessory];
  if (acc.context.SerialNumber === 'D0001') {
    acc.getService(Service.ContactSensor).getCharacteristic(Characteristic.ContactSensorState).updateValue(value ? Characteristic.ContactSensorState.CONTACT_NOT_DETECTED : Characteristic.ContactSensorState.CONTACT_DETECTED);
  }

}
  //this.log(accessoryID);
  //this.log(accessory.displayName, "Light -> " + value);
  callback();
}

SimpliSafe.prototype.configurationRequestHandler = function(context, request, callback) {
  this.log("Context: ", JSON.stringify(context));
  this.log("Request: ", JSON.stringify(request));

  // Check the request response
  if (request && request.response && request.response.inputs && request.response.inputs.name) {
    this.addAccessory(request.response.inputs.name);

    // Invoke callback with config will let homebridge save the new config into config.json
    // Callback = function(response, type, replace, config)
    // set "type" to platform if the plugin is trying to modify platforms section
    // set "replace" to true will let homebridge replace existing config in config.json
    // "config" is the data platform trying to save
    callback(null, "platform", true, {"platform":"SamplePlatform", "otherConfig":"SomeData"});
    return;
  }

  // - UI Type: Input
  // Can be used to request input from user
  // User response can be retrieved from request.response.inputs next time
  // when configurationRequestHandler being invoked

  var respDict = {
    "type": "Interface",
    "interface": "input",
    "title": "Add Accessory",
    "items": [
      {
        "id": "name",
        "title": "Name",
        "placeholder": "Fancy Light"
      }//,
      // {
      //   "id": "pw",
      //   "title": "Password",
      //   "secure": true
      // }
    ]
  }

  // - UI Type: List
  // Can be used to ask user to select something from the list
  // User response can be retrieved from request.response.selections next time
  // when configurationRequestHandler being invoked

  // var respDict = {
  //   "type": "Interface",
  //   "interface": "list",
  //   "title": "Select Something",
  //   "allowMultipleSelection": true,
  //   "items": [
  //     "A","B","C"
  //   ]
  // }

  // - UI Type: Instruction
  // Can be used to ask user to do something (other than text input)
  // Hero image is base64 encoded image data. Not really sure the maximum length HomeKit allows.

  // var respDict = {
  //   "type": "Interface",
  //   "interface": "instruction",
  //   "title": "Almost There",
  //   "detail": "Please press the button on the bridge to finish the setup.",
  //   "heroImage": "base64 image data",
  //   "showActivityIndicator": true,
  // "showNextButton": true,
  // "buttonText": "Login in browser",
  // "actionURL": "https://google.com"
  // }

  // Plugin can set context to allow it track setup process
  context.ts = "Hello";

  // Invoke callback to update setup UI
  callback(respDict);
}


// Sample function to show how developer can add accessory dynamically from outside event
SimpliSafe.prototype.addAccessory = function(accessoryName) {
  this.log("Add Accessory");
  var platform = this;

  var newAccessory = new Accessory(accessoryName, UUIDGen.generate('LightBulb'));
  newAccessory.on('identify', function(paired, callback) {
    platform.log(newAccessory.displayName, "Identify!!!");
    callback();
  });
  // Plugin can save context on accessory to help restore accessory in configureAccessory()
  // newAccessory.context.something = "Something"
  newAccessory.context.SerialNumber = 'L0001';
  // Make sure you provided a name for service, otherwise it may not visible in some HomeKit apps
  newAccessory.addService(Service.Lightbulb, "Test Light").getCharacteristic(Characteristic.On).on('set',  function (value, callback){
    platform.on_Event(newAccessory.displayName, value, callback);
  });

  this.accessories.push(newAccessory);
  this.api.registerPlatformAccessories("homebridge-platform-simplisafe", "homebridge-platform-simplisafe", [newAccessory]);


  var newAccessory = new Accessory(accessoryName, UUIDGen.generate('Door'));
  newAccessory.on('identify', function(paired, callback) {
    platform.log(newAccessory.displayName, "Identify!!!");
    callback();
  });
  newAccessory.context.SerialNumber = 'D0001';

  newAccessory.addService(Service.ContactSensor, "Test Door");

  this.accessories.push(newAccessory);
  this.api.registerPlatformAccessories("homebridge-platform-simplisafe", "homebridge-platform-simplisafe", [newAccessory]);
}

SimpliSafe.prototype.updateAccessoriesReachability = function() {
  this.log("Update Reachability");
  for (var index in this.accessories) {
    var accessory = this.accessories[index];
    accessory.updateReachability(false);
  }
}

// Sample function to show how developer can remove accessory dynamically from outside event
SimpliSafe.prototype.removeAccessory = function() {
  this.log("Remove Accessory");
  this.api.unregisterPlatformAccessories("homebridge-platform-simplisafe", "homebridge-platform-simplisafe", this.accessories);

  this.accessories = [];
}

*/
var API = require('./client/api.js');
async function main() {
  var ss = new API(SerialNumber);
  await ss.login_via_credentials(username, password);
};

main();
