var assert = require('assert');
var Client = require('./helpers/index');
var asynk = require('asynk');
var processHelper = require('./helpers/process');

describe('cluster', function() {
  var clusterNode1 = processHelper('clusterNode1');
  var clusterNode2 = processHelper('clusterNode2');
  var client;

  before(function(done) {
    clusterNode1.on('register', function(identity) {
      if (identity === 'clusterNode2') {
        asynk.when(ready1, ready2).asCallback(done);
      }
    });

    var ready1 = clusterNode1.start(8051);
    var ready2 = clusterNode2.start(8052);

    client = new Client('localhost', 8051);
  });

  it('request second node through first', function(done) {
    client.http.emit('cluster:ping').asCallback(function(err, data) {
      if (err) {
        return done(err);
      }
      assert(data.response);
      assert.strictEqual(data.response, 'PONG');
      done();
    });
  });

  it('request an unknown node', function(done) {
    client.http.emit('cluster:wrongNode').asCallback(function(err, data) {
      assert(!data);
      assert(err);
      assert.strictEqual(err.message, 'wrongNode is not registered');
      done();
    });
  });

  it('request a dead node', function(done) {
    clusterNode2.stop().done(function() {
      client.http.emit('cluster:ping').asCallback(function(err, data) {
        assert(!data);
        assert(err);
        assert.strictEqual(err.message, 'clusterNode2 is not registered');
        done();
      });
    });
  });

  after(function(done) {
    var kill1 = clusterNode1.stop();
    var kill2 = clusterNode2.stop();

    asynk.when(kill1, kill2).asCallback(done);
  });
});
