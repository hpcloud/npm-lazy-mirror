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

    var registry = this;

    var request_defaults = {
        strictSSL: this.config.upstream_verify_ssl
    };

    this.config.getProxyConfig(function(err, c){
        if(!err) {
            request_defaults.proxy = c.https_proxy || c.http_proxy;
            registry.http_proxy = c.http_proxy;
            registry.https_proxy = c.https_proxy || c.http_proxy;
        }
        Request.defaults(request_defaults);
    });

    return this;
};

/**
 * Pass thru proxy function to the upstream registry
 *
 * @param {Object} req - Http.Request
 * @param {Object} res - Http.Response
 */
Registry.prototype.proxyUpstream = function(req, res) {

    var registry = this;
    var req_method = req.method;
    var proto = this.config.upstream_use_https ? 'https:' : 'http:';
    var port = this.config.upstream_port;
    var url = Url.parse(req.url);
    var headers = req.headers;

    this.log.info("proxying request to registry " + req_method + " " + req.url + " " + headers.host);

    url.hostname = registry.config.upstream_host;
    url.protocol = proto;
    url.port = port;

    var options = {
        url: Url.format(url),
        headers: headers,
        strictSSL: this.config.upstream_verify_ssl
    };

    if (registry.http_proxy) { options.proxy = registry.http_proxy; }
    if (registry.https_proxy) { options.proxy = registry.https_proxy; }

    Request(options)
    .on('error', function(err) {
        registry.log.error('Error proxying to upstream registry: ' + err);
    })
    .on('response', function(resp) {
        registry.log.debug('UPSTREAM REGISTRY RES:: CODE: ' + req.statusCode + ' HEADERS: ' + resp.headers);
    })
    .pipe(res)
    .on('finish', function(){});
};


/**
 * Gets the JSON metadata for all versions of a package.
 *
 * @param {String} pkg - the package name
 * @callback cb - (error, meta)
 */
Registry.prototype.getMeta = function(pkg, cb) {

    var registry = this;

    this.log.debug("proxy req GET METADATA: " + pkg);

    var proto = this.config.upstream_use_https ? 'https' : 'http';

    var request_opts = {
        url: proto + '://' + this.config.upstream_host + '/' + pkg,
        strictSSL: this.config.upstream_verify_ssl
    };

    if (registry.http_proxy) { request_opts.proxy = registry.http_proxy; }
    if (registry.https_proxy) { request_opts.proxy = registry.https_proxy; }

    Request(request_opts, function(err, response, body){
        if (err) { return cb(err); }

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

    Async.series([
        function(done) {
        Mkdirp(target_dir, done);
    },
    function(done) {

        registry.log.debug("proxy req GET TARBALL: " + pkg.name + '@' + pkg.version);

        var request_opts = {
            url: proto + '://' + pkg.config.upstream_host + '/' + pkg.name + '/-/' + pkg.name + '-' + pkg.version + '.tgz',
            strictSSL: registry.config.upstream_verify_ssl
        };

        if (registry.http_proxy) { request_opts.proxy = registry.http_proxy; }
        if (registry.https_proxy) { request_opts.proxy = registry.https_proxy; }

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

    }], function(err) {
        if (!err) { pkg.config.cache.fsStats.set(target_file, true); }
        cb(err, target_file);
    });
};

module.exports = Registry;
