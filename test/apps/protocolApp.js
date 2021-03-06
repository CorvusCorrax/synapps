var synapps = require('../../index');
var _ = require('lodash');
var hostHelper = require('../helpers/host');

var protocolApp = synapps();

protocolApp.set('name', 'protocolApp');
protocolApp.set('ipcLocalPort', 8006);
protocolApp.set('debug', 'error');

protocolApp.route('test', {
  ping: [
    {},
    function(req) {
      req.resolve({response: 'PONG'});
    }
  ],
  room: [
    {},
    function(req) {
      req.socket.join('ROOM');
      req.resolve({});
      req.socket.to('ROOM').emit('room', {room: 'ROOM'});
    }
  ]
});

hostHelper(protocolApp);
