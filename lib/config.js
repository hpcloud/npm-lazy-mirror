/**
 * Copyright (c) ActiveState 2013 - ALL RIGHTS RESERVED.
 */

var Config = require('../config/config');
var PackageJSON = require('../package');
var Lactate = require('lactate');

var Optimist = require('optimist')
        .usage('Usage: $0 -p <port> -r <external_dns> -c <file cache dir>')
        .describe({
            a: "The external DNS name this mirror should serve on",
            b: "The local interface bind address",
            c: "The full directory path the cache directory (no trailing slash)",
            p: "The HTTP port for the lazy mirror to listen on (default:2000)",
            C: "The path to the JSON configuration file",
            cache_expiry: "Expire the upstream registry cache assets on this value (ms), default: 24 hours",
            cache_mem: "The maxmium size in MB of registry data to keep in memory. A larger allocation reduces disk hits and improves performance, default: 200",
            http_enabled: "Enable the HTTP server on -p, this is true if neither --http_enabled or --https_enabled are supplied",
            https_enabled: "Enable the HTTPS server on --https_port",
            https_key: "The path to the private SSL key",
            https_cert: "The path to the private SSL certificate",
            https_port: "The HTTPS port (requires --https_enabled), default: 443",
            real_external_port: "If this mirror is behind a proxy, set this flag to the real external port for client connections",
            upstream_host: "The upstream registry host, default: registry.npmjs.org",
            upstream_port: "The default upstream registry port, default: 80",
            upstream_use_https: "Use HTTPS only when proxying to the upstream registry, default: false",
            upstream_verify_ssl: "Verify the upstream registry's SSL certificates, default: false"
        });

Argv = Optimist.argv;

var config = {};

/* CLI specific */
if (Argv.h) {
    console.log(Optimist.help());
    process.exit();

} else if (Argv.v) {
    console.log('npm-lazy-mirror: ' + PackageJSON.version);
    process.exit();

} else if (Argv.C) {
    Config = require(Argv.C);
}

/* Local server options */
config.http_port = Argv.p || Argv.port || Config.http_port || 2000;
config.server_address = Argv.a || Argv.address || Config.server_address || 'localhost';
config.bind_address = Argv.b || Argv.bind_address || Config.bind_address || '127.0.0.1';
config.http_enabled = Argv.http_enabled || Config.http_enabled;

/* Local server HTTPS options */
config.https_port = Argv.https_port || Config.https_port || 443;
config.https_enabled = Argv.https_enabled || Config.https_enabled;

if (!config.http_enabled && !config.https_enabled) {
    config.http_enabled = true;
}

config.real_external_port = Argv.real_external_port || (config.https_enabled ? config.https_port : config.http_port);

/* Logging */
config.log_level = Argv.log_level || Config.log_level || 'info';

config.https_key = Argv.https_key || Config.https_key || null;
config.https_cert = Argv.https_cert || Config.https_cert || null;

/* Upstream Registry */
config.upstream_host = Argv.upstream_host || Config.upstream_host || 'registry.npmjs.org';
config.upstream_port = Argv.upstream_port || Config.upstream_port || 80;
config.upstream_use_https = Argv.upstream_use_https || Config.upstream_use_https || false;
config.upstream_verify_ssl = Argv.upstream_verify_ssl || Config.upstream_verify_ssl || false;

/* Caching options */
config.cache = {};
config.cache_dir = Argv.c || Argv.cache_dir || Config.cache_dir || '/tmp/files';
config.cache_expiry = Argv.cache_expiry || Config.cache_expiry || 24 * 60 * 60 * 1000; // 24 Hours
config.cache_mem = Argv.cache_mem || Config.cache_mem || 200; // MB
config.cache_options = {  cache: {
    expire: 60 * 60 * 1000,
    max_keys: 500,
    max_size: config.cache_mem
}};

module.exports = config;
