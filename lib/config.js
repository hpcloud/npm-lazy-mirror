/**
 * Copyright (c) ActiveState 2014 - ALL RIGHTS RESERVED.
 */

'use strict';

var Config = require('../config/config-defaults');
var PackageJSON = require('../package');
var Lactate = require('lactate');
var Npm = require('npm');
var FS = require('fs');

var Optimist = require('optimist')
.usage('Usage: $0 -p <port> -a <external_dns> -c <file cache dir>')
.describe({
    server_address: 'The external DNS name this mirror should serve on [default: localhost]',
    bind_address: 'The local interface bind address [default: 127.0.0.1]',
    cache_dir: 'The full directory path the cache directory (no trailing slash) [default: /tmp/files]',
    http_port: 'The HTTP port for the lazy mirror to listen on [default: 2000]',
    config: 'The path to the JSON configuration file',
    cache_expiry: 'Expire the upstream registry cache assets on this value (ms) [default: 24 hours]',
    cache_mem: 'The maxmium size in MB of registry data to keep in memory. A larger allocation reduces disk hits and improves performance [default: 200]',
    http_enabled: 'Enable the HTTP server on -p, this is true if neither --http_enabled or --https_enabled are supplied',
    https_enabled: 'Enable the HTTPS server on --https_port',
    https_key: 'The path to the private SSL key',
    https_cert: 'The path to the private SSL certificate',
    https_port: 'The HTTPS port (requires --https_enabled) [default: 443]',
    http_proxy: 'Specify a HTTP proxy to traverse before making outbound requests',
    https_proxy: 'Specify a HTTPS proxy to traverse before making outbound requests',
    package_blacklist: 'Full path to a JSON configuration file of blacklisted packages',
    permit_stale_resources: 'Continue to serve stale resources if the upstream registry cannot be contacted',
    real_external_port: 'If this mirror is behind a proxy, set this flag to the real external port for client connections',
    upstream_host: 'The upstream registry host [default: registry.npmjs.org]',
    upstream_port: 'The default upstream registry port [default: 80]',
    upstream_db_path: 'The default upstream registry database path, default: none (requires a leading slash)',
    upstream_use_https: 'Use HTTPS only when proxying to the upstream registry [default: false]',
    upstream_verify_ssl: 'Verify the upstream registry\'s SSL certificates [default: false]',
    log_level: 'Logging level [default: info]',
    version: 'Print version and exit',
    help: 'This help screen'
})
.alias({
    'server_address': 'a',
    'bind_address': 'b',
    'cache_dir': 'c',
    'http_port': ['port','p'],
    'config': 'C',
    'version': 'v',
    'help': 'h'
});

var Argv = Optimist.argv,
    config = {};

/* CLI specific */
if (Argv.help) {
    console.log(Optimist.help());
    process.exit();

} else if (Argv.version) {
    console.log('npm-lazy-mirror: ' + PackageJSON.version);
    process.exit();

} else if (Argv.config) {
    Config = JSON.parse(FS.readFileSync(Argv.config));
}

/* Local server options */
config.httpPort = Argv.http_port || Config.http_port || 2000;
config.serverAddress = Argv.server_address || Config.server_address || 'localhost';
config.bindAddress = Argv.bind_address || Config.bind_address || '127.0.0.1';
config.httpEnabled = Argv.http_enabled || Config.http_enabled;

/* Local server HTTPS options */
config.httpsPort = Argv.https_port || Config.https_port || 443;
config.httpsEnabled = Argv.https_enabled || Config.https_enabled;

if (!config.httpEnabled && !config.httpsEnabled) {
    config.httpEnabled = true;
}

config.realExternalPort = Argv.real_external_port || (config.httpsEnabled ? config.httpsPort : config.httpPort);

/* Logging */
config.logLevel = Argv.log_level || Config.log_level || 'info';

config.httpsKey = Argv.https_key || Config.https_key || null;
config.httpsCert = Argv.https_cert || Config.https_cert || null;

/* Upstream Registry */
config.upstreamHost = Argv.upstream_host || Config.upstream_host || 'registry.npmjs.org';
config.upstreamPort = Argv.upstream_port || Config.upstream_port || 80;
config.upstreamUseHttps = Argv.upstream_use_https || Config.upstream_use_https || false;
config.upstreamVerifySSL = Argv.upstream_verify_ssl || Config.upstream_verify_ssl || false;
config.upstreamDBPath = Argv.upstream_db_path || Config.upstream_db_path || '';

/* Caching options */
config.cache = {};
config.cacheDir = Argv.cache_dir || Config.cache_dir || '/tmp/files';
config.cacheExpiry = Argv.cache_expiry || Config.cache_expiry || 24 * 60 * 60 * 1000; // 24 Hours
config.cacheMem = Argv.cache_mem || Config.cache_mem || 200; // MB
config.cacheOptions = {
    cache: {
        expire: 60 * 60,
        max_keys: 500,
        max_size: config.cache_mem
    }
};
config.cachePermitStale = Argv.permit_stale_resources || Config.permit_stale_resources || false;

/* HTTP/S proxy */
config.getProxyConfig = function(cb) {
    Npm.load(function(err, npm) {
        if (err) { return (err); }
        return cb(null, {
            httpProxy: Argv.http_proxy || Config.http_proxy || Npm.config.get('proxy') || process.env.HTTP_PROXY,
            httpsProxy: Argv.https_proxy || Config.https_proxy || Npm.config.get('https-proxy') || process.env.HTTPS_PROXY
        });
    });
};

/* Package Blacklist */
config.packageBlacklist = (function() {
    if (Argv.package_blacklist || Config.package_blacklist) {
        return require(Argv.package_blacklist || Config.package_blacklist);
    }
})();

module.exports = config;
