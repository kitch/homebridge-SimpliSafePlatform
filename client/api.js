
var websession = require('https');

const URL_HOSTNAME = 'api.simplisafe.com';
const URL_BASE = 'https://api.simplisafe.com/v1';
const DEFAULT_AUTH_USERNAME = '.2074.0.0.com.simplisafe.mobile';
const DEFAULT_USER_AGENT = 'SimpliSafe/2105 CFNetwork/902.2 Darwin/17.7.0';

//const SYSTEM_MAP = {2: SystemV2, 3: SystemV3};

function BasicAuth(login, password){
  return "Basic " +  Buffer.from(login + ':' + password).toString('base64');
}

function uuid4() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
};

var _websession = websession;

var logFunc;

function log(msg) {
	if (logFunc) {
		logFunc(msg);
	}
}

function logErr(msg, err) {
	var fullMsg = msg + (err ? (' ' + err.message) : '')
	log(fullMsg)
}

function SSClient(SerialNumber, loggerFunc) {
  logFunc = loggerFunc;
  this.serial = SerialNumber;
  this.sensors = [];
}

SSClient.prototype.login_via_token = function(email, refresh_token) {
	var thisObj = this
	return this._authenticate(
    {
      'grant_type': 'refresh_token',
      'username': email,
      'refresh_token': refresh_token
    })
		.then(function() {
			return thisObj.getUserId()
		}, function(err) {
			logErr('SS3Client: Failed to login', err)
			throw err
		})
		.then(function() {
			return thisObj.getSystemID()
		});
}

SSClient.prototype.login_via_credentials = function(email, password) {
	var self = this
	return self._authenticate(
    {
      "grant_type": "password",
      "device_id": "WebApp",
      "username": email,
      "password": password
    })
		.then(function() {
			return self.getUserId()
		}, function(err) {
			   logErr('SS3Client: Failed to login', err)
			throw err
		})
		.then(function() {
			return self.getSystemID()
		})
}

SSClient.prototype._authenticate = function(payload_data) {
	var self = this;
	return self.request({
      method:'POST',
      endpoint:'api/token',
      data: payload_data,
      auth: BasicAuth(uuid4() + DEFAULT_AUTH_USERNAME, '')
	  })
    .then(function(parsedBody) {
		   self.access_token = parsedBody.access_token;
		   self.expires_in = parsedBody.expires_in;
		   self.token_type = parsedBody.token_type;
       self.refresh_token = parsedBody.refresh_token;
       self.token_expire = new Date(Date.now() + ((parsedBody.expires_in-60) * 1000));
	    }, function(err) {
		      logErr('SSClient: Failed to initToken:', err);
		      throw err;
	    });
}

SSClient.prototype.getUserId = function() {
	var self = this;
  return self.request({
    method:'GET',
    endpoint: 'api/authCheck'
  })
  .then(function(parsedBody) {
    self.user_id = parsedBody.userId;
  }, function(err) {
      logErr('SSClient: Failed to get userID:', err);
      throw err;
  });
}

SSClient.prototype.getSystemID = function() {
	var self = this;
	return self.request({
    method: 'GET',
    endpoint: 'users/' + self.user_id + '/subscriptions',
    params: {'activeOnly': 'true'}
  })
	.then(function(parsedBody) {
    for (let subscription of parsedBody.subscriptions){
      if (subscription.location.system.serial === self.serial) {
          self.subId = subscription.sid;
          self.sysVersion = subscription.location.system.version;
          self.getAlarmState = subscription.location.system.alarmState;
          return;
        }
    }
	})
}

//SSClient.prototype.getAlarmState = function() {return this._state;}


/**
 * Set the alarm state
 *
 * @param state One of 'off', 'home', 'away'
 * @returns {*|PromiseLike<T>|Promise<T>}
 */
SSClient.prototype.setAlarmState = function(value) {
	var self = this;
  if (self.getAlarmState == value) return true;
  if (self.sysVersion==2) {
    self.request({
      method:'post',
      endpoint:'subscriptions/' + self.subId + '/state',
      params:{'state': value}
    })
    .then(function(parsedBody){
      if (!parsedBody) return false;
      if (state_resp.success) {
        self.getAlarmState = SystemStates[state_resp.requestedState];
        return true;
      }
    })
  } else if (self.sysVersion==3) {
    self.request({
      method:'post',
      endpoint:'ss3/subscriptions/' + self.subId + '/state/' + value
    })
    .then(function(parsedBody){
      if (!parsedBody) return false;
      if (state_resp.success) {
        self.getAlarmState = state_resp['state'];
        return true;
      };
    })
  }
  return false;
}

SSClient.prototype.getSensors = async function(SerialNumber = 'all') {
	var self = this
  var cached;
  if (SerialNumber == 'all') {cached=true;} else {cached=false;}
  if (self.sysVersion==2) {
  	return await self.request({
      method:'GET',
      endpoint: 'subscriptions/' + self.subId + '/settings',
      params:{'settingsType': 'all', 'cached': cached.toString().toLowerCase()}
    }).then (function(parsedBody){
      for (var sensor_data of parsedBody.settings.sensors) {
        if (!sensor_data['serial']) break;
        if (sensor_data['serial'] === SerialNumber) {
           return sensor_data;
        } else {
           self.sensors[sensor_data['serial']] = sensor_data;
        }
      }
      return self.sensors
    });
  } else if (self.sysVersion==3) {
    return await self.request({
      method:'GET',
      endpoint:'ss3/subscriptions/' + self.subId + '/sensors',
      params:{'forceUpdate': cached.toString().toLowerCase()}
    })
    .then (function(parsedBody){
      for (var sensor_data of parsedBody.sensors) {
        if (sensor_data.serial === SerialNumber) {
           return sensor_data;
        } else {
          self.sensors[sensor_data['serial']] = sensor_data;
        }
      }
      return self.sensors;
    });
  }
  //return self.sensors;
}

SSClient.prototype.request = async function({method='', endpoint='', headers={}, params={}, data={}, json={}, ...kwargs}){
  var self = this;
  /*if (_access_token_expire && Date.now() >= _access_token_expire && !_actively_refreshing){
          _actively_refreshing = true;
          await _refresh_access_token(this._refresh_token)
  }*/
  var url = new URL(URL_BASE + '/' + endpoint);
  if (params){
    Object.keys(params).forEach(item=> {
        url.searchParams.append(item.toString(), params[item]);
    });
  };

  if (!kwargs.auth) headers['Authorization'] = self.token_type + ' ' + self.access_token; else headers['Authorization'] = kwargs.auth;

  headers={
          ...headers,
          'Content-Type': 'application/json; charset=utf-8',
          'User-Agent': DEFAULT_USER_AGENT,
  };

  var options = {
    method: method,
    headers: headers
  }

  return new Promise((resolve, reject) => {
    const req = websession.request(url.href, options, (res) => {
      res.setEncoding('utf8');
      var body='';
      res.on('data', (chunk) => { body += chunk;}) ;
      res.on('end', () => {
        if (typeof res.headers['content-type']!=='undefined' && res.headers['content-type'].indexOf('application/json') > -1) {
          resolve(JSON.parse(body));
        } else {
          resolve(body);
        }
      });
    });

    req.on('error', (e) => {
      console.error(`problem with request: ${e.message}`);
    });

    if (data) req.write(JSON.stringify(data));
    req.end();
  });
};//End of function Request

module.exports = SSClient;
