var tcp = require('../../tcp');
var instance_skel = require('../../instance_skel');
var TelnetSocket = require('../../telnet');
var debug;
var log;


function instance(system, id, config) {
	var self = this;

	// Request id counter
	self.request_id = 0;
	self.login = false;
	// super-constructor
	instance_skel.apply(this, arguments);
	self.status(1,'Initializing');
	self.actions(); // export actions

	return self;
}

instance.prototype.updateConfig = function(config) {
	var self = this;
	self.config = config;
	self.init_tcp();
};

instance.prototype.incomingData = function(data) {
	var self = this;
	debug(data);

	// Match part of the copyright response from unit when a connection is made.
	// Send Info request which should reply with Matrix setup, eg: "V8X4 A8X4"
	if (self.login === false && data.match("Welcome to MATRIXPRO-II DVI 16x16")) {
		self.status(self.STATUS_WARNING,'Logging in');
		self.socket.write("I"+ "\n");
	}

	if (self.login === false && data.match("Password:")) {
		self.status(self.STATUS_WARNING,'Logging in');
		self.socket.write(""+ "\n");
	}

	// Match first letter of expected response from unit.
	else if (self.login === false && data.match("TELNET control")) {
		self.login = true;
		self.status(self.STATUS_OK);
		debug("logged in");
	}
	else if (self.login === false && data.match('login incorrect')) {
		self.log('error', "incorrect username/password (expected no password)");
		self.status(self.STATUS_ERROR, 'Incorrect user/pass');
	}
	else {
		debug("data nologin", data);
	}
};

instance.prototype.init = function() {
	var self = this;

	debug = self.debug;
	log = self.log;

	self.init_tcp();
};

instance.prototype.init_tcp = function() {
	var self = this;
	var receivebuffer = '';

	if (self.socket !== undefined) {
		self.socket.destroy();
		delete self.socket;
		self.login = false;
	}

	if (self.config.host) {
		self.socket = new TelnetSocket(self.config.host, 23);

		self.socket.on('status_change', function (status, message) {
			if (status !== self.STATUS_OK) {
				self.status(status, message);
			}
		});

		self.socket.on('error', function (err) {
			debug("Network error", err);
			self.log('error',"Network error: " + err.message);
		});

		self.socket.on('connect', function () {
			debug("Connected");
			self.login = false;
		});

		self.socket.on('error', function (err) {
			debug("Network error", err);
			self.log('error',"Network error: " + err.message);
			self.login = false;
		});

		// if we get any data, display it to stdout
		self.socket.on("data", function(buffer) {
			var indata = buffer.toString("utf8");
			self.incomingData(indata);
		});

		self.socket.on("iac", function(type, info) {
			// tell remote we WONT do anything we're asked to DO
			if (type == 'DO') {
				socket.write(new Buffer([ 255, 252, info ]));
			}

			// tell the remote DONT do whatever they WILL offer
			if (type == 'WILL') {
				socket.write(new Buffer([ 255, 254, info ]));
			}
		});
	}
};

instance.prototype.CHOICES_INOUT = [
	{ label: '1', id: '1' },
	{ label: '2', id: '2' },
	{ label: '3', id: '3' },
	{ label: '4', id: '4' },
	{ label: '5', id: '5' },
	{ label: '6', id: '6' },
	{ label: '7', id: '7' },
	{ label: '8', id: '8' },
	{ label: '9', id: '9' },
	{ label: '10', id: '10' },
	{ label: '11', id: '11' },
	{ label: '12', id: '12' },
	{ label: '13', id: '13' },
	{ label: '14', id: '14' },
	{ label: '15', id: '15' },
	{ label: '16', id: '16' }
];

// Return config fields for web config
instance.prototype.config_fields = function () {
	var self = this;

	return [
		{
			type: 'text',
			id: 'info',
			width: 12,
			label: 'Information',
			value: 'This will establish a telnet connection to the matrix'
		},
		{
			type: 'textinput',
			id: 'host',
			label: 'MatrixPro-II IP address',
			width: 12,
			default: '192.168.0.246',
			regex: self.REGEX_IP
		}
	]
};

// When module gets deleted
instance.prototype.destroy = function() {
	var self = this;

	if (self.socket !== undefined) {
		self.socket.destroy();
	}

	debug("destroy", self.id);;
};

instance.prototype.actions = function(system) {
	var self = this;
	var actions = {
		'route': {
			label: 'Route input to output',
			options: [{
					type: 'dropdown',
					label: 'input',
					id: 'input',
					default: '1',
					choices: self.CHOICES_INOUT
			}, {
				type: 'dropdown',
				label: 'output',
				id: 'output',
				default: '1',
				choices: self.CHOICES_INOUT
			}]
		},
		'inputToAll': {
			label: 'Route input to all outputs',
			options: [{
					type: 'dropdown',
					label: 'input',
					id: 'input',
					default: '1',
					choices: self.CHOICES_INOUT
			}]
		}
	};

	self.setActions(actions);
}

instance.prototype.action = function(action) {

	var self = this;
	var id = action.action;
	var opt = action.options;
	var cmd;

	switch (id) {
		case 'route':
			cmd = `LINK=${opt.input}^${opt.output}!`;
			break;

		case 'inputToAll':
			cmd = `LINK=${opt.input}!`;
			break;

	}

	if (cmd !== undefined) {
			if (self.tcp !== undefined) {
					debug('sending ', cmd, "to", self.tcp.host);
					self.tcp.send(cmd);
			}
	}

	if (cmd !== undefined) {

		if (self.socket !== undefined && self.socket.connected) {
			self.socket.write(cmd+"\n");
		} else {
			debug('Socket not connected :(');
		}

	}
};

instance_skel.extendedBy(instance);
exports = module.exports = instance;
