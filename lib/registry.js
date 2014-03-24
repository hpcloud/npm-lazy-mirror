/**
 * Copyright (c) ActiveState 2014 - ALL RIGHTS RESERVED.
 */

'use strict';

var Async = require('async');
var Constants = require('./constants');
var Fs = require('fs');
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

    var requestDefaults = {
        strictSSL: this.config.upstreamVerifySSL
    };

    this.config.getProxyConfig(function (err, c){
        if (!err) {
            requestDefaults.proxy = c.httpsProxy || c.httpProxy;
            registry.httpProxy = c.httpProxy;
            registry.httpsProxy = c.httpsProxy || c.httpProxy;
        }
        Request.defaults(requestDefaults);
    });

    return this;
};

/**
 * Pass thru proxy function to the upstream registry
 *
 * @param {Object} req - Http.Request
 * @param {Object} res - Http.Response
 */
Registry.prototype.proxyUpstream = function (req, res) {

    var registry = this;
    var reqMethod = req.method;
    var proto = this.config.upstreamUseHttps ? 'https:' : 'http:';
    var port = this.config.upstreamPort;
    var url = Url.parse(req.url);
    var headers = req.headers;

    this.log.info('proxying request to registry ' + reqMethod + ' ' + req.url + ' ' + headers.host);

    url.hostname = registry.config.upstreamHost;
    url.protocol = proto;
    url.port = port;
    url.pathname = registry.config.upstreamDBPath + req.url;

    var options = {
        url: Url.format(url),
        headers: headers,
        strictSSL: this.config.upstreamVerifySSL
    };

    if (registry.httpProxy) { options.proxy = registry.httpProxy; }
    if (registry.httpsProxy) { options.proxy = registry.httpsProxy; }

    new Request(options)
    .on('error', function (err) {
        registry.log.error('Error proxying to upstream registry: ' + err);
    })
    .on('response', function (resp) {
        registry.log.debug('UPSTREAM REGISTRY RES:: CODE: ' + req.statusCode + ' HEADERS: ' + resp.headers);
    })
    .pipe(res)
    .on('finish', function () {
        //TODO log request to separate access log
    });
};


/**
 * Gets the JSON metadata for all versions of a package.
 *
 * @param {String} pkg - the package name
 * @callback cb - (error, meta)
 */
Registry.prototype.getMeta = function (pkg, cb) {

    var registry = this;

    this.log.debug('proxy req GET METADATA: ' + pkg);

    var proto = this.config.upstreamUseHttps ? 'https' : 'http';

    var requestOpts = {
        url: proto + '://' + this.config.upstreamHost + ':' + this.config.upstreamPort + this.config.upstreamDBPath + '/' + pkg,
        strictSSL: this.config.upstreamVerifySSL
    };

    if (registry.httpProxy) { requestOpts.proxy = registry.httpProxy; }
    if (registry.httpsProxy) { requestOpts.proxy = registry.httpsProxy; }

    new Request(requestOpts, function (err, response, body) {
        if (err) { return cb(err); }

        if (response.statusCode !== 200) {
            var error = new Error('Invalid response code fetching metadata: ', response.statusCode);
            error.code = response.statusCode;
            return cb(error);
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
Registry.prototype.getTarball = function (pkg, cb) {

    var registry = this;
    var proto = registry.config.upstreamUseHttps ? 'https' : 'http';
    var targetFile = pkg.cache.getTarballPath(pkg.name, pkg.version);
    var targetDir = Path.dirname(targetFile);

    Async.series([
        function (done) {
            new Mkdirp(targetDir, done);
        },
        function (done) {
            var requestOpts = {
                url: proto + '://' + pkg.config.upstreamHost + ':' + this.config.upstreamPort + this.config.upstreamDBPath + '/' + pkg.name + '/-/' + pkg.name + '-' + pkg.version + '.tgz',
                strictSSL: registry.config.upstreamVerifySSL
            };

            if (registry.httpProxy) { requestOpts.proxy = registry.httpProxy; }
            if (registry.httpsProxy) { requestOpts.proxy = registry.httpsProxy; }

            var r = new Request(requestOpts)
            .on('response', function (res) {
                if (res.statusCode !== 200) {
                    var error = new Error('Invalid response fetching tarball from remote repository: ' + res.statusCode);
                    error.code = res.statusCode;
                    return done(error);
                }
                r.pipe(Fs.createWriteStream(targetFile))
                .on('finish', done)
                .on('error', done);
            })
            .on('error', done);
        }
    ], function (err) {
        if (!err) { pkg.config.cache.fsStats.set(targetFile, Constants.CACHE_VALID); }
        cb(err, targetFile);
    });
};

module.exports = Registry;
