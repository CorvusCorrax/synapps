var synapps = require('../../index');
var path = require('path');
var hostHelper = require('../helpers/host');

var clusterNode2 = synapps();
clusterNode2.set('name', 'clusterNode2');
clusterNode2.set('ipcLocalPort', 8002);
clusterNode2.set('debug', 'debug');

var keyPath = path.join(__dirname, '..', '..', 'test.key');
var certificatePath = path.join(__dirname, '..', '..', 'test.crt');

clusterNode2.set('tls', {
  key: keyPath,
  cert: certificatePath,
  ca: [certificatePath],
  port: 8102
});

clusterNode2.route('cluster', {
  pong: [
    {},
    function(req) {
      req.resolve({response: 'PONG'});
    }
  ]
});

hostHelper(clusterNode2);
