var _ = require('lodash');
var Argv = require('optimist').argv;
var Cache = require('./lib/cache');
var Config = require('./config/config.json');
var Http = require('http');
var Lactate = require('lactate');
var Package = require('./lib/package');
var Path = require('path');
var Registry = require('./lib/registry');
var Url = require('url');

var config = {};

/* Local server options */
config.server_port = Argv.p || Argv.port || Config.server_port || 2000;
config.server_address = Argv.a || Argv.address || Config.server_address || 'localhost';

/* Upstream Registry */
config.upstream_host = Argv.upstream_host || Config.upstream_host || 'registry.npmjs.org';
config.upstream_port = Argv.upstream_port || Config.upstream_port || 80;

/* Caching options */
config.cache_dir = Argv.cache_dir || Config.cache_dir || '/tmp/files';
config.cache_expiry = Argv.cache_expiry || Config.cache_expiry || 24 * 60 * 60 * 1000; // 24 Hours
config.cache_mem = Argv.cache_mem || Config.cache_mem || 200; // MB
config.cache_options = {  cache: {
    expire: 60 * 60 * 1000,
    max_keys: 500,
    max_size: config.cache_mem
}};

config.cache_server = Lactate.dir(config.cache_dir, config.cache_options);

/**
 * If the file cannot be found locally, proxy to the upstream registry as
 * a last resort
 */
config.cache_server.notFound(function(req, res) {
    registry.proxyUpstream(req, res);
});


/* In-memory caching HTTP proxy */
var cache = new Cache(config);

/* Upstream Proxy */
var registry = new Registry(config);

/**
 * Handle generic errors
 *
 * @param {Object} req - Http.req
 * @param {Object} res - Http.res
 * @param {Object} err - err object
 */
var internalErr = function(req, res, err) {
    console.error(err);
    res.statusCode = 500;
    res.end('Internal server error ' + err);
};

/**
 * Serves the entire metadata for a package
 *
 * @param {Object} req - Http.req
 * @param {Object} res - Http.res
 */
var servePackageMeta = function(req, res) {
        var p =  new Package({
            name: req.url,
            config: config
            })
        .getMeta(function(err, meta) {
            if (err) { return internalErr(req, res, err); }
            meta = meta.replace(config.cache_dir, '');
            config.cache_server.serve(meta, req, res);
        });
};

/**
 * Serves the version subset metadata for a package
 *
 * @param {Object} req - Http.req
 * @param {Object} res - Http.res
 */
var servePackageVersionMeta = function(req, res) {

    var p =  new Package({
        name: req.url,
        config: config
        })
    .getVersionMeta(function(err, meta) {
        if (err || !meta) { return internalErr(req, res, err); }
        meta = meta.replace(config.cache_dir, '');
        config.cache_server.serve(meta, req, res);
    });
};

/**
 * Serves the latest version subset metadata for a package
 *
 * @param {Object} req - Http.req
 * @param {Object} res - Http.res
 */
var serveLatestPackageMeta = function(req, res) {

    var p =  new Package({
        name: req.url,
        config: config
        })
    .getLatestVersionMeta(function(err, meta) {
        if (err || !meta) { return internalErr(req, res, err); }
        meta = meta.replace(config.cache_dir, '');
        config.cache_server.serve(meta, req, res);
    });

};

/**
 * Serves the binary .tgz for a package, as requisitioned from the 'dist' key
 * in the package metadata.
 *
 * @param {Object} req - Http.req
 * @param {Object} res - Http.res
 */
var servePackageTarball = function(req, res) {

    var name = _.compact(_.without(req.url.split('/'), '-'));
    if (name.length !== 2) {
        return internalErr(req, res);
    } else {
        name = Path.basename(name[1], '.tgz');
    }

    var p =  new Package({
        name: name,
        config: config
        })
    .getTarball(function(err, tarball) {
        if (err || !tarball) { return internalErr(req, res, err); }
        tarball = tarball.replace(config.cache_dir, '');
        config.cache_server.serve(tarball, req, res);
    });
};

/**
 * The main HTTP server
 */
var server = Http.createServer(function (req, res) {

    req.headers.host = config.upstream_host;

    console.log(req.method + ' ' + req.url);

    /* /package/<semver> */
    if (req.url.match(/^\/[a-z0-9_-].*?\/[0-9]+\.[0-9]+\.[0-9]+$/)) {
        servePackageVersionMeta(req, res);

    /* /package/latest */
    } else if (req.url.match(/^\/[a-z0-9_-].*?\/latest$/)) {
        serverLatestPackageMeta(req, res);

    /* /-/all/ */
    } else if (req.url.match(/\/-\/all\/.*/)) {
        registry.proxyUpstream(req, res);

    /* /-/<package name>-<version.tgz */
    } else if (req.url.match(/^\/[a-z0-9_-].*?\/-\/.*\.tgz/)) {
        servePackageTarball(req, res);

    /* /package */
    } else if (req.url.match(/^\/[a-z0-9_-].*?$/)) {
        servePackageMeta(req, res);

    /* void */
    } else {
        registry.proxyUpstream(req, res);
    }

});

server.listen(config.server_port, config.server_address, function(){
    console.log('Lazy mirror is listening @ ' + config.server_address + ':' + config.server_port);
});


