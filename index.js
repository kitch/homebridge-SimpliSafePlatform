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
      ss.login_via_credentials(config.username, config.password)
      .then(function(){
        return platform.updateSensors(true);
      });
      platform.log("Is up and monitoring.")
      setInterval(
        function(){
            platform.updateSensors();
        },
        platform.config.refresh_timer
      );
    }.bind(this));
  }
}

SimpliSafe.prototype.updateSensors = function(cached = false){
  var platform = this;

  return ss.get_Sensors(cached)
    .then(function () {
      var system = ss.sensors
      system[platform.config.SerialNumber] = {'type': ss.SensorTypes.SecuritySystem, 'serial': platform.config.SerialNumber, 'state': ss.AlarmState, 'name': 'SimpliSafe Alarm System'}
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

          SystemAccessory.getService(Service.AccessoryInformation)
            .setCharacteristic(Characteristic.SerialNumber, sensor)
            .setCharacteristic(Characteristic.Name, ss.sensors[sensor].name)
            .setCharacteristic(Characteristic.Manufacturer, 'SimpliSafe')
            .setCharacteristic(Characteristic.HardwareRevision, ss.sysVersion);
          platform.accessories.push(SystemAccessory);
          platform.api.registerPlatformAccessories("homebridge-platform-simplisafe", "homebridge-platform-simplisafe", [SystemAccessory]);
        }
        switch (ss.sensors[sensor].type) {
          case ss.SensorTypes.SecuritySystem:
            if (!SystemAccessory.getService(Service.SecuritySystem)) {
                SystemAccessory.addService(Service.SecuritySystem, ss.sensors[sensor].name);
                SystemAccessory.getService(Service.AccessoryInformation).setCharacteristic(Characteristic.Model, 'SimpliSafe Alarm System');
                SystemAccessory.getService(Service.SecuritySystem)
                  .getCharacteristic(Characteristic.SecuritySystemCurrentState)
                  .on('get', (callback)=>platform.getAlarmState(callback));
                SystemAccessory.getService(Service.SecuritySystem)
                  .getCharacteristic(Characteristic.SecuritySystemTargetState)
                  .on('get', (callback)=> platform.getAlarmState(callback))
                  .on('set', (state, callback)=> {
                     platform.setAlarmState(state, callback);
                     SystemAccessory.getService(Service.SecuritySystem).setCharacteristic(Characteristic.SecuritySystemCurrentState, state);
                  });
            }
            break;
          case ss.SensorTypes.ContactSensor:
            if (!SystemAccessory.getService(Service.ContactSensor)) {
              SystemAccessory.addService(Service.ContactSensor, ss.sensors[sensor].name);
              SystemAccessory.getService(Service.AccessoryInformation).setCharacteristic(Characteristic.Model, ss.SensorTypes[ss.sensors[sensor].type].replace('Sensor', ' Sensor'));
            };
            if (ss.sensors[sensor].entryStatus == 'closed') {
              SystemAccessory.getService(Service.ContactSensor).getCharacteristic(Characteristic.ContactSensorState).updateValue(Characteristic.ContactSensorState.CONTACT_DETECTED);
            } else {
              SystemAccessory.getService(Service.ContactSensor).getCharacteristic(Characteristic.ContactSensorState).updateValue(Characteristic.ContactSensorState.CONTACT_NOT_DETECTED);
            };
            break;
          case ss.SensorTypes.TemperatureSensor:
            if (!SystemAccessory.getService(Service.TemperatureSensor)) {
              SystemAccessory.addService(Service.TemperatureSensor, ss.sensors[sensor].name);
              SystemAccessory.getService(Service.AccessoryInformation).setCharacteristic(Characteristic.Model, ss.SensorTypes[ss.sensors[sensor].type].replace('Sensor', ' Sensor'));
            };
            SystemAccessory.getService(Service.TemperatureSensor).getCharacteristic(Characteristic.CurrentTemperature).updateValue((ss.sensors[sensor].temp-32) * 5/9);
            break;
        };
      });
    });
}

SimpliSafe.prototype.getAlarmState = function(callback){
    var platform = this;
  		ss.getAlarmState()
      .then(function(state) {
          platform.log(state)
          switch (state.toLowerCase()) {
            case 'home':
            case 'home_count':
              callback(null, Characteristic.SecuritySystemTargetState.STAY_ARM);
              break;
            case 'away':
            case 'away_count':
            case 'alarm_count':
              callback(null, Characteristic.SecuritySystemTargetState.AWAY_ARM);
              break;
            case 'off':
              callback(null, Characteristic.SecuritySystemTargetState.DISARM);
              break;
          };
  		}, function() {
  			callback(new Error('Failed to get alarm state'))
  });
};

SimpliSafe.prototype.setAlarmState = function(state, callback) {
// Set state in simplisafe 'off' or 'home' or 'away'
	var platform = this;
  var ssState;
  switch (state) {
		case Characteristic.SecuritySystemTargetState.STAY_ARM:
		case Characteristic.SecuritySystemTargetState.NIGHT_ARM:
			ssState = "home";
			break;
		case Characteristic.SecuritySystemTargetState.AWAY_ARM :
			ssState = "away";
			break;
		case Characteristic.SecuritySystemTargetState.DISARM:
			ssState = "off";
			break;
  }
  ss.setAlarmState(ssState)
  .then(function() {
			callback(null, state);
		});
}

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
