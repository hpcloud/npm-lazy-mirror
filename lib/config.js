var Argv = require('optimist').argv;
var Config = require('../config/config.json');
var Lactate = require('lactate');

var config = {};

/* Local server options */
config.server_port = Argv.p || Argv.port || Config.server_port || 2000;
config.server_address = Argv.a || Argv.address || Config.server_address || 'localhost';
config.bind_address = Argv.b || Argv.bind_address || Config.bind_address || '127.0.0.1';
config.http_enabled = Argv.http_enabled || Config.http_enabled || true;

/* Logging */
config.log_level = Argv.log_level || Config.log_level || 'info';


/* Local server HTTPS options */
config.https_port = Argv.https_port || Config.https_port || 443;
config.https_enabled = Argv.https_enabled || Config.https_enabled || false;

config.https_key = Argv.https_key || Config.https_key || null;
config.https_cert = Argv.https_cert || Config.https_cert || null;

/* Upstream Registry */
config.upstream_host = Argv.upstream_host || Config.upstream_host || 'registry.npmjs.org';
config.upstream_port = Argv.upstream_port || Config.upstream_port || 80;

/* Caching options */
config.cache_dir = Argv.c || Argv.cache_dir || Config.cache_dir || '/tmp/files';
config.cache_expiry = Argv.cache_expiry || Config.cache_expiry || 24 * 60 * 60 * 1000; // 24 Hours
config.cache_mem = Argv.cache_mem || Config.cache_mem || 200; // MB
config.cache_options = {  cache: {
    expire: 60 * 60 * 1000,
    max_keys: 500,
    max_size: config.cache_mem
}};

module.exports = config;
