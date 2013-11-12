var Async = require('async');
var Fs = require('fs');
var Http = require('http');
var Mkdirp = require('mkdirp');
var Path = require('path');
var Request = require('request');
var Url = require('url');

/**
 * Provides a class for interacting with the remote registry.
 *
 * @constructor
 * @param {Object} opts - Options
 */
var Registry = function (opts) {
    this.config = opts || {};
    return this;
};

/**
 * Generic proxy function to the upstream registry
 *
 * @param {Object} req - Http.Request
 * @param {Object} res - Http.Response
 */
Registry.prototype.proxyUpstream = function(req, res) {

    var req_method = req.method,
    url = Url.parse(req.url).pathname,
    headers = req.headers;

    console.log("proxy req " + req_method + " " + req.url + " " + headers.host);

    var options = {
        host: this.config.upstream_host,
        port: this.config.upstream_port,
        path: url,
        method: req_method,
        headers: headers
    };

    var proxy_req = Http.request(options, function(response) {
        response.on('data', function (chunk) {
            res.write(chunk);
        });
        response.on('end', function(){
            res.end();
        });
    }).on('error', function(e) {
        console.log('problem with proxy req: ' + e.message);
    });

    req.on('data', function(req_data) {
        proxy_req.write(req_data);
    });
    req.on('end', function() {
        proxy_req.end();
    });
    req.on('error', function(e) {
        console.log('problem with req: ' + e.message);
    });
};


/**
 * Gets the JSON metadata for all versions of a package.
 *
 * @param {String} pkg - the package name
 * @callback cb - (error, meta)
 */
Registry.prototype.getMeta = function(pkg, cb) {
    Request('http://' + this.config.upstream_host + '/' + pkg, function(err, response, body){
        if (err) return cb(err);

        var meta;
        try {
            meta = JSON.parse(body);
        } catch (e) {
            return cb(e);
        }

        return cb(null, meta);
    });
};

/**
 * Retrieves the tarball for a specific version of a package.
 *
 * @param {Object} pkg - the package {name, version}
 * @callback cb - (error, meta)
 */
Registry.prototype.getTarball = function(pkg, cb) {
    var target_file = pkg.cache.getTarballPath(pkg.name, pkg.version);
    var target_dir = Path.dirname(target_file);

    Async.series([
        function(done) {
            Mkdirp(target_dir, done);
        },
        function(done) {
            Request({url: 'http://' + pkg.config.upstream_host + '/' + pkg.name + '/-/' + pkg.name + '-' + pkg.version + '.tgz', encoding: null}, function(err, res, body) {
                if (err) { return done(err); }
                if (res.statusCode !== 200) { return done(new Error('Invalid response code: ' + res.statusCode)); }
                Fs.writeFile(target_file, body, 'binary', done);
            });
        }
    ], function(err) {
        cb(err, target_file);
    });
};

module.exports = Registry;
