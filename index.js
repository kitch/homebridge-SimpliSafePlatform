//homebridge-platform-simplisafe
var API = require('./client/api.js');

var Accessory, Service, Characteristic, UUIDGen;

module.exports = function(homebridge) {
  Accessory = homebridge.platformAccessory;
  Service = homebridge.hap.Service;
  Characteristic = homebridge.hap.Characteristic;
  UUIDGen = homebridge.hap.uuid;
  homebridge.registerPlatform("homebridge-platform-simplisafe", "homebridge-platform-simplisafe", SimpliSafe, true);
}

var ss; //SimpliSafe Client

function SimpliSafe(log, config, api) {
  var platform = this;
  this.log = log;
  this.config = config;
  this.accessories = [];
  var ssClient = new API(log);
  ss = new API(config.SerialNumber);

  if (api) {
      this.api = api;
      this.api.on('didFinishLaunching', function() {
        //Time to loging and update Statusses
        ss.login_via_credentials(config.username, config.password)
        .then(function(){
          return platform.updateSensors();
          //platform.api.unregisterPlatformAccessories("homebridge-platform-simplisafe", "homebridge-platform-simplisafe", platform.accessories);
          //platform.accessories = [];
          //platform.log(platform.accessories);
          return;
        });
      }.bind(this));
  }
}

SimpliSafe.prototype.updateSensors = function(){
  var platform = this;

  return ss.getSensor(false)
  .then(function () {
    var system = ss.sensors
    system[platform.config.SerialNumber] = {'type': ss.SensorTypes.SecuritySystem, 'serial': platform.config.SerialNumber, 'state': ss.getAlarmState, 'name': 'SimpliSafe Alarm V' + ss.sysVersion}

    if (ss.sysVersion===2){
      platform.log('Updating statuses for verison 2 System.')
      Object.keys(system).forEach(sensor=> {
        var SystemAccessory;
        if (![ss.SensorTypes.SecuritySystem, ss.SensorTypes.ContactSensor, ss.SensorTypes.TemperatureSensor].includes(ss.sensors[sensor].type)) return;
        platform.accessories.forEach(accessory=> {
          if (accessory.context.SerialNumber != sensor) return;
          SystemAccessory = accessory;
        });
        if (!SystemAccessory) {
          platform.log('Found new sensor', sensor, ss.sensors[sensor].name);
          SystemAccessory = new Accessory(ss.SensorTypes[ss.sensors[sensor].type] + ' ' + sensor, UUIDGen.generate(ss.SensorTypes[ss.sensors[sensor].type] + ' ' + sensor));
          SystemAccessory.context.SerialNumber = sensor;
          platform.accessories.push(SystemAccessory);
          platform.api.registerPlatformAccessories("homebridge-platform-simplisafe", "homebridge-platform-simplisafe", [SystemAccessory]);
        }
        switch (ss.sensors[sensor].type) {
          case ss.SensorTypes.SecuritySystem:
            if (!SystemAccessory.getService(Service.SecuritySystemCurrentState)) SystemAccessory.addService(Service.SecuritySystemCurrentState);
            //if (!SystemAccessory.getService(Service.SecuritySystemTargetState)) SystemAccessory.addService(Service.SecuritySystemTargetState, ss.sensors[sensor].name);
              /*switch (ss.sensors[sensor].state.toLowerCase()) {
          			case "home":
          			case 'home_count':
                  SystemAccessory.getService(Service.SecuritySystemCurrentState).getCharacteristic(Characteristic.SecuritySystemCurrentState).updateValue(Characteristic.SecuritySystemCurrentState.STAY_ARM);
          				break;
          			case "away":
          			case 'away_count':
          			case 'alarm_count':
                  SystemAccessory.getService(Service.SecuritySystemCurrentState).getCharacteristic(Characteristic.SecuritySystemCurrentState).updateValue(Characteristic.SecuritySystemCurrentState.AWAY_ARM);
          				break;
          			case "off":
                  SystemAccessory.getService(Service.SecuritySystemCurrentState).getCharacteristic(Characteristic.SecuritySystemCurrentState).updateValue(Characteristic.SecuritySystemCurrentState.DISARMED);
                  break;
              }*/
            break;
          case ss.SensorTypes.ContactSensor:
            if (!SystemAccessory.getService(Service.ContactSensor)) SystemAccessory.addService(Service.ContactSensor, ss.sensors[sensor].name);
            if (ss.sensors[sensor].entryStatus == 'closed') {
              SystemAccessory.getService(Service.ContactSensor).getCharacteristic(Characteristic.ContactSensorState).updateValue(Characteristic.ContactSensorState.CONTACT_DETECTED);
            } else {
              SystemAccessory.getService(Service.ContactSensor).getCharacteristic(Characteristic.ContactSensorState).updateValue(Characteristic.ContactSensorState.CONTACT_NOT_DETECTED);
            }
            break;
          case ss.SensorTypes.TemperatureSensor:
            if (!SystemAccessory.getService(Service.TemperatureSensor)) SystemAccessory.addService(Service.TemperatureSensor, ss.sensors[sensor].name);
            SystemAccessory.getService(Service.TemperatureSensor).getCharacteristic(Characteristic.CurrentTemperature).updateValue((ss.sensors[sensor].temp-32) * 5/9);
            break;
        };
      });
      //if (!FoundSensor && FoundAccessory) platform.log('Found one to remove');//remove Accessory
    } else if (ss.sysVersion===3){
    }
    platform.log('Finish updating Sensors Status');
  });

}


// Function invoked when homebridge tries to restore cached accessory.
// Developer can configure accessory at here (like setup event handler).
// Update current value.
SimpliSafe.prototype.configureAccessory = async function(accessory) {
  var platform = this;

  // Set the accessory to reachable if plugin can currently process the accessory,
  // otherwise set to false and update the reachability later by invoking
  // accessory.updateReachability()
  accessory.reachable = true;
  platform.accessories.push(accessory);
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
