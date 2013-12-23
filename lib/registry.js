/**
 * Copyright (c) ActiveState 2013 - ALL RIGHTS RESERVED.
 */

var Async = require('async');
var Fs = require('fs');
var Http = require('http');
var Https = require('https');
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
    this.log = opts.log;
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

    this.log.info("proxy req " + req_method + " " + req.url + " " + headers.host);

    var options = {
        host: this.config.upstream_host,
        port: this.config.upstream_port,
        path: url,
        method: req_method,
        headers: headers,
        rejectUnauthorized: !this.config.upstream_verify_ssl
    };

    var req_func = this.config.upstream_use_https ? Https.request : Http.request;

    var proxy_req = req_func(options, function(response) {

        res.statusCode = response.statusCode;

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

    this.log.debug("proxy req GET METADATA: " + pkg);

    var proto = this.config.upstream_use_https ? 'https' : 'http';
    var verify_ssl = this.config.upstream_verify_ssl;

    var request_opts = {
        url: proto + '://' + this.config.upstream_host + '/' + pkg,
        strictSSL: verify_ssl
    };

    Request(request_opts, function(err, response, body){
        if (err) return cb(err);

        if (response.statusCode !== 200) {
            var error = new Error('Invalid response code fetching metadata: ', response.statusCode);
            error.code = response.statusCode;
            cb(error);
        }

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

    var registry = this;
    var proto = registry.config.upstream_use_https ? 'https' : 'http';
    var target_file = pkg.cache.getTarballPath(pkg.name, pkg.version);
    var target_dir = Path.dirname(target_file);
    var verify_ssl = registry.config.upstream_verify_ssl;

    Async.series([
        function(done) {
        Mkdirp(target_dir, done);
    },
    function(done) {

        registry.log.debug("proxy req GET TARBALL: " + pkg.name + '@' + pkg.version);

        var request_opts = {
            url: proto + '://' + pkg.config.upstream_host + '/' + pkg.name + '/-/' + pkg.name + '-' + pkg.version + '.tgz',
            strictSSL: verify_ssl
        };

        Request(request_opts)
        .on('error', done)
        .on('response', function(res) {
            if (res.statusCode !== 200) {
                var error = new Error('Invalid response fetching tarball from remote repository: ' + res.statusCode);
                error.code = res.statusCode;
                done(error);
            }
        })
        .pipe(Fs.createWriteStream(target_file))
        .on('finish', done);

        /*
           Request({url: 'http://' + pkg.config.upstream_host + '/' + pkg.name + '/-/' + pkg.name + '-' + pkg.version + '.tgz', encoding: null}, function(err, res, body) {
           if (err) { return done(err); }
           if (res.statusCode !== 200) {
           var error = new Error('Invalid response code: ' + res.statusCode);
           error.code = res.statusCode;
           return done(error);
           }
           Fs.writeFile(target_file, body, 'binary', done);
           });
         */
    }], function(err) {
        if (!err) { pkg.config.cache.fsStats.set(target_file, true); }
        cb(err, target_file);
    });
};

module.exports = Registry;
