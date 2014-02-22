/**
 * Copyright (c) ActiveState 2014 - ALL RIGHTS RESERVED.
 */

'use strict';

var Async = require('async');
var AsyncCache = require('async-cache');
var Cache = require('./lib/cache');
var Config = require('./lib/config');
var Constants = require('./lib/constants');
var Fs = require('fs');
var Handlers = require('./lib/handlers');
var Http = require('http');
var Https = require('https');
var Lactate = require('lactate');
var Log = require('log');
var Registry = require('./lib/registry');

/* Generic logger */
var log = new Log(Config.logLevel);

Config.log = log;

/* Upstream Proxy */
var registry = new Registry(Config);

/* HTTP asset caching server */
Config.cacheServer = Lactate.dir(Config.cacheDir, Config.cacheOptions);

/**
 * If the file cannot be found locally, proxy to the upstream registry as
 * a last resort
 */
Config.cacheServer.notFound(function (req, res) {
    registry.proxyUpstream(req, res);
});

/* Global async disk cache */
Config.cache.fsStats = new AsyncCache({
    max: 5000,
    maxAge: Config.cacheExpiry,
    load: function(path, cb) {

        log.info('Cache MISS: ', path);

        var cache = new Cache(Config);
        Async.waterfall([
            function (done) {
                cache.existsDisk(path, done);
            },
            function (exists, done) {
                if (exists) {
                    cache.diskExpired(path, done);
                } else {
                    done(null, null, null);
                }
            },
            function (expired, stats, done) {
                if (!expired && stats) {
                    done(null, Constants.CACHE_VALID);
                } else {
                    done(null, Constants.CACHE_NOT_EXIST);
                }
            }
        ],
        function (err, valid) {
            cb(err, valid);
        });
    }
});

/**
 * Primary HTTP/HTTPS request dispatcher
 *
 * @param {Object} req - HTTP.req
 * @param {Object} res - HTTP.res
 */
var serveRequest = function (req, res) {
    req.headers.host = Config.upstreamHost;

    log.info(req.method + ' ' + req.url);

    /* /package/latest */
    if (req.url.match(/^\/[_-\w.]+?\/latest\/?$/)) {
        Handlers.serveLatestPackageMeta(req, res, Config);

    /* /package/<semver> */
    } else if (req.url.match(/^\/[_-\w.]+?\/[0-9]+\.[0-9]+\.[0-9]+/)) {
        Handlers.servePackageVersionMeta(req, res, Config);

    /* /-/all/ */
    } else if (req.url.match(/\/-\/all\/.*/)) {
        registry.proxyUpstream(req, res);

    /* /-/<package name>-<version.tgz> */
    } else if (req.url.match(/^\/[_-\w.]+?\/-\/.*\.tgz/)) {
        Handlers.servePackageTarball(req, res, Config);

    /* /package */
    } else if (req.url.match(/^\/[_-\w.]+?$/)) {
        Handlers.servePackageMeta(req, res, Config);

    /* void */
    } else {
        registry.proxyUpstream(req, res);
    }
};

/**
 * The main HTTP server
 */
if (Config.httpEnabled) {
    var httpServer = Http.createServer(serveRequest);

    httpServer.listen(Config.httpPort, Config.bindAddress, function () {
        log.info('Lazy mirror (HTTP) is listening @ ' + Config.bindAddress + ':' + Config.httpPort + ' External host: ' + Config.serverAddress);
    });
}

/**
 * The main HTTPS server
 */
if (Config.httpsEnabled) {

    if (!Config.httpsKey || !Config.httpsCert) {
        throw new Error('Missing https_cert or http_key option');
    }

    var httpsOptions = {
        key: Fs.readFileSync(Config.httpsKey),
        cert: Fs.readFileSync(Config.httpsCert),
    };

    var httpsServer = Https.createServer(httpsOptions, serveRequest);

    httpsServer.listen(Config.httpsPort, Config.bindAddress, function () {
        log.info('Lazy mirror (HTTPS) is listening @ ' + Config.bindAddress + ':' + Config.httpsPort + ' External host: ' + Config.serverAddress);
    });
}


