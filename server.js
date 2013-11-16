var _ = require('lodash');
var AsyncCache = require('async-cache');
var Cache = require('./lib/cache');
var Config = require('./lib/config');
var Fs = require('fs');
var Handlers = require('./lib/handlers');
var Http = require('http');
var Https = require('https');
var Lactate = require('lactate');
var Log = require('log');
var Package = require('./lib/package');
var Path = require('path');
var Registry = require('./lib/registry');
var Url = require('url');

/* Upstream Proxy */
var registry = new Registry(Config);

/* Generic logger */
var log = new Log(Config.log_level);

Config.log = log;

/* HTTP asset caching server */
Config.cache_server = Lactate.dir(Config.cache_dir, Config.cache_options);

/**
 * If the file cannot be found locally, proxy to the upstream registry as
 * a last resort
 */
Config.cache_server.notFound(function(req, res) {
    registry.proxyUpstream(req, res);
});

/* Global async disk cache */
Config.cache.fsStats = new AsyncCache({
    max: 5000,
    maxAge: Config.cache_expiry,
    load: function(path, cb) {

        log.debug('Cache MISS: ', path);

        var cache = new Cache(Config);
        cache.existsDisk(path, cb);
    }
});

/**
 * Primary HTTP/HTTPS request dispatcher
 *
 * @param {Object} req - HTTP.req
 * @param {Object} res - HTTP.res
 */
var serveRequest = function(req, res) {
    req.headers.host = Config.upstream_host;

    log.info(req.method + ' ' + req.url);

    /* /package/latest */
    if (req.url.match(/^\/[a-z0-9_-]+?\/latest\/?$/)) {
        Handlers.serveLatestPackageMeta(req, res, Config);

    /* /package/<semver> */
    } else if (req.url.match(/^\/[a-z0-9_-]+?\/[0-9]+\.[0-9]+\.[0-9]+$/)) {
        Handlers.servePackageVersionMeta(req, res, Config);

    /* /-/all/ */
    } else if (req.url.match(/\/-\/all\/.*/)) {
        registry.proxyUpstream(req, res);

    /* /-/<package name>-<version.tgz */
    } else if (req.url.match(/^\/[a-z0-9_-]+?\/-\/.*\.tgz/)) {
        Handlers.servePackageTarball(req, res, Config);

    /* /package */
    } else if (req.url.match(/^\/[a-z0-9_-]+?$/)) {
        Handlers.servePackageMeta(req, res, Config);

    /* void */
    } else {
        registry.proxyUpstream(req, res);
    }
};

/**
 * The main HTTP server
 */
if (Config.http_enabled) {
    var http_server = Http.createServer(serveRequest);

    http_server.listen(Config.server_port, Config.bind_address, function(){
        log.info('Lazy mirror (HTTP) is listening @ ' + Config.bind_address + ':' + Config.server_port + ' External host: ' + Config.server_address);
    });
}

/**
 * The main HTTPS server
 */
if (Config.https_enabled) {

    if (!Config.https_key || !Config.https_cert) {
        throw new Error('Missing https_cert or http_key option');
    }

    var https_options = {
        key: Fs.readFileSync(Config.https_key),
        cert: Fs.readFileSync(Config.https_cert),
    };

    var https_server = Https.createServer(https_options, serveRequest);

    https_server.listen(Config.server_port, Config.bind_address, function(){
        log.info('Lazy mirror (HTTPS) is listening @ ' + Config.bind_address + ':' + Config.https_port + ' External host: ' + Config.server_address);
    });
}


