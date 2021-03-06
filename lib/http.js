var path = require("path");
var fs = require("fs");
var mime = require('mime');
var http = require("http");
var url = require("url");
var qs = require('querystring');
var formidable = require('formidable');
var _ = require('lodash');
var asynk = require('asynk');

module.exports = function(synapps) {
  function processHttpRequest(req, response) {
    if (req.type === 'jsonp') {
      // jsonp
      synapps._scheduler.send(req).done(function(result) {
        response.writeHead(200, { 'content-type': 'text/json' });
        response.end(result.callback + '(' + JSON.stringify(result.data) + ');');
      }).fail(function(err) {
        response.writeHead(500, { "Content-Type": "text/plain" });
        if (err && err.notification && err.notification.type === 'ERROR') {
          response.write(err.notification.msg);
          return response.end();
        } else if (_.isObject(err)) {
          if (err instanceof Error) {
            err = err.message;
          } else {
            err = JSON.stringify(err);
          }
          response.write(err);
        } else {
          response.write(err);
        }
        response.end();
      });
    } else {
      // http
      synapps._scheduler.send(req).done(function(result) {
        response.writeHead(200, result.headers);
        if (!result.data) {
          return response.end();
        } else if (result.headers['content-type'] === 'text/json') {
          response.write(JSON.stringify(result.data));
        } else {
          if (_.isString(result.data) || _.isBuffer(result.data)) {
            response.write(result.data);
          } else {
            synapps.debug('error', 'invalid response type ' + typeof result.data);
          }
        }
        response.end();
      }).fail(function(err) {
        response.writeHead(500, { "Content-Type": "text/plain" });
        if (err && err.notification && err.notification.type === 'ERROR') {
          response.write(err.notification.msg);
          return response.end();
        } else if (_.isObject(err)) {
          if (err instanceof Error) {
            err = err.message;
          } else {
            err = JSON.stringify(err);
          }
          response.write(err);
        } else {
          response.write(err);
        }
        response.end();
      });
    }
  }

  var server = http.createServer(function(request, response) {

    var uri = url.parse(request.url).pathname;
    var pathChunk = path.normalize(uri).split(path.sep);
    pathChunk = pathChunk.slice(1, pathChunk.length);
    var apiDir = synapps._config.apiDir;

    if (pathChunk[0] === apiDir && pathChunk[1] === 'socket.io') {
      return;
    } else if (pathChunk[0] === apiDir) {
      var req;
      if (request.method.toLowerCase() === 'post') {
        var form = new formidable.IncomingForm();
        form.parse(request, function(err, fields, files) {
          if (err) {
            response.writeHead(500, { "Content-Type": "text/plain" });
            response.write("#INVALID_POST_DATA");
            return response.end();
          }

          asynk.each(_.keys(files), function(fileName, cb) {
            var file = files[fileName];
            fs.readFile(file.path, function(err, buffer) {
              if (err) {
                return cb(err);
              }
              fields[fileName] = buffer;
              cb();
            });
          }).parallel().done(function(buffers) {
            // HTTP post request
            req = {
              type: 'http',
              request: pathChunk[1],
              sessionID: fields.sessionID,
              data: fields
            };
            processHttpRequest(req, response);
          }).fail(function(err) {
            response.writeHead(500, { "Content-Type": "text/plain" });
            response.write("#INVALID_POST_DATA");
            return response.end();
          });
        });

      } else {
        var urlData = url.parse(request.url, true).query;
        if (urlData.callback) {
          // JSONP request
          req = {
            type: 'jsonp',
            request: urlData.request,
            sessionID: null,
            data: urlData.data,
            callback: urlData.callback
          };
        } else {
          // HTTP request
          req = {
            type: 'http',
            request: pathChunk[1],
            sessionID: null,
            data: urlData
          };
        }
        processHttpRequest(req, response);
      }
    } else if (synapps._config.staticDir) {
      var filename = path.join(synapps._config.staticDir, uri);
      fs.exists(filename, function(exists) {
        if (!exists) {
          response.writeHead(404, { "Content-Type": "text/plain" });
          response.write("#404_NOT_FOUND");
          response.end();
          return;
        }

        if (fs.statSync(filename).isDirectory()) {
          filename = path.join(filename, 'index.html');
        }

        fs.readFile(filename, "binary", function(err, file) {
          if (err) {
            response.writeHead(500, { "Content-Type": "text/plain" });
            response.write("#INTERNAL_SERVER_ERROR");
            response.end();
            return;
          }
          var contentType = mime.lookup(filename) || 'application/octet-stream';
          response.writeHead(200, { "Content-Type": contentType });
          response.write(file, "binary");
          response.end();
        });
      });
    }
  })
  return server;
};
