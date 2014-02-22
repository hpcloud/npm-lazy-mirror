/**
 * Copyright (c) ActiveState 2013 - ALL RIGHTS RESERVED.
 */

'use strict';

var Async = require('async');
var Constants = require('./constants');
var Fs = require('fs');
var Mkdirp = require('mkdirp');
var Path = require('path');
var Url = require('url');

/**
 * Simple cache get/set operations for disk ops
 *
 * @constructor
 * @param {Object} opts - the main server config object
 * @returns {Cache}
 */
var Cache = function(opts) {

    if (!this instanceof Cache) {
        return new Cache(opts);
    }

    if (!opts) { return new Error('Options object not supplied'); }
    if (!opts.cacheDir) { return new Error('Cache directory not supplied'); }

    this.cacheDir = opts.cacheDir;
    this.config = opts;
    this.fsStats = opts.cache.fsStats;
    this.metaFolder = 'meta';
    this.tgzFolder = 'tgz';

    return this;
};

/**
 * Checks the mtime of the file has not exceeded the configured maximum expiry
 *
 * @param {string} path - file path
 * @callback cb - (err, bool, fs.Stats)
 */
Cache.prototype.diskExpired = function(path, cb) {

    var cache = this;

    Fs.stat(path, function(err, stats) {

        if (err) { return cb (err); }
        var now = Date.now();
        var mtime = stats.mtime.getTime();

        if ( (now - mtime) >= cache.config.cacheExpiry ) {
            return cb(null, true, stats);
        }

        return cb(null, false, stats);
    });
};

/**
 * Checks if the requested resource exists on the disk. This is an expensive I/O
 * op so should be checked with AsyncCache first.
 *
 * @param {string} path - file path
 * @callback cb - (err, bool)
 */
Cache.prototype.existsDisk = function(path, cb) {

    Fs.exists(path, function(exists) {
        cb(null, exists);
    });
};

/**
 * Checks if the requested resource is valid
 *
 * @param {Object} opts - type, name, version
 * @callback cb - (err, bool)
 */
Cache.prototype.validate = function(opts, cb) {

    if (!opts.type) { return cb(new Error('Type not supplied')); }
    if (!opts.name) { return cb(new Error('Name not supplied')); }
    if (!opts.version) { opts.version = ''; }

    var cache = this,
        path;
    if (opts.type === Constants.TYPE_META) {
        path = cache.getMetaPath(opts.name);
    } else if (opts.type === Constants.TYPE_TGZ) {
        path = cache.getTarballPath(opts.name, opts.version);
    } else {
        return cb(new Error('Unknown type: ' + opts.type));
    }
    cache.fsStats.get(path, cb);
};

/**
 * Overrides all the dist/tarball keys in the package metadata to point
 * to this mirror.
 *
 * @param {Object} pkg_json - The package metadata
 * @callback cb - (err, new_json)
 */
Cache.prototype.overrrideTarballUrls = function(pkgJson, cb) {

    var cache = this;

    // If the server is running with HTTPS enabled, default to that protocol
    var protocol = cache.config.httpsEnabled ? 'https:' : 'http';

    var changeDistUrl = function(ver, done) {
        ver = pkgJson.versions[ver];
        if (ver.dist && ver.dist.tarball) {
            var distUrl = Url.parse(ver.dist.tarball);
            distUrl.host = null;
            distUrl.hostname = cache.config.serverAddress;
            distUrl.port = cache.config.realExternalPort;
            distUrl.protocol = protocol;
            ver.dist.tarball = Url.format(distUrl);
            done();
        } else {
            done();
        }
    };

    if (!pkgJson.versions) { return cb(null, pkgJson); }

    Async.each(Object.keys(pkgJson.versions), changeDistUrl, function(err) {
        return cb(err, pkgJson);
    });

};

/**
 * Sets the metadata for a package
 *
 * @param {string} pkg - The package name
 * @param {Object} meta - The original package metadata
 * @callback cb - (err, pkg_json)
 */
Cache.prototype.setMeta = function(pkg, meta, cb) {

    var cache = this;
    var path = this.getMetaPath(pkg);
    var dir = Path.dirname(path);
    var pkgJson;

    Async.series([
        function(done) {
            new Mkdirp(dir, done);
        },
        function(done){
            Fs.writeFile(path + '.orig', JSON.stringify(meta), done);
        },
        function(done) {
            cache.overrrideTarballUrls(meta, function(err, json){
                if (err) { return done(err); }
                pkgJson = json;
                done();
            });
        },
        function(done) {
            Fs.writeFile(path, JSON.stringify(pkgJson), done);
        }
    ], function(err) {
        cb(err, pkgJson);
    });
};


/**
 * Sets the metadata for a specific package version
 *
 * @param {Object} pkg - The package (./lib/package) object
 * @param {Object} meta - The original package metadata
 * @callback cb - (err)
 */
Cache.prototype.setMetaVersion = function(pkg, meta, cb) {

    var path = this.getMetaVersionPath(pkg.name, pkg.version);
    var dir = Path.dirname(path);

    new Mkdirp(dir, function(err) {
        if (err) { return cb(err); }
        Fs.writeFile(path, JSON.stringify(meta), cb);
    });

};

/**
 * Gets the metadata filepath for a package
 *
 * @param {string} pkg - The package name
 * @returns {string}
 */
Cache.prototype.getMetaPath = function(name) {
    return Path.join(this.cacheDir, name, this.metaFolder, name + '.json');
};

/**
 * Gets the metadata filepath for a specific package version
 *
 * @param {string} pkg - The package name
 * @param {string} version - The package version
 * @returns {string}
 */
Cache.prototype.getMetaVersionPath = function(name, version) {
    return Path.join(this.cacheDir, name, this.metaFolder, name + '-' + version + '.json');
};

/**
 * Async wrapper for getMetaPath
 *
 * @param {string} pkg - The package name
 * @callback (err, path)
 */
Cache.prototype.getMeta = function(name, cb) {

    if (!name) { return cb(new Error('Name not supplied')); }
    return cb(null, this.getMetaPath(name));
};

/**
 * Async wrapper for getMetaVersionPath
 *
 * @param {string} pkg - The package name
 * @param {string} version - The package version
 * @callback (err, path)
 */
Cache.prototype.getMetaVersion = function(name, version, cb) {

    if (!name) { return cb(new Error('Name not supplied')); }
    if (!version) { return cb(new Error('Version not supplied')); }

    return cb(null, this.getMetaVersionPath(name, version));
};


/**
 * Gets the path to the tarball for a specific package version
 *
 * @param {string} pkg - The package name
 * @param {string} version - The package version
 * @returns {string}
 */
Cache.prototype.getTarballPath = function(name, version) {
    return Path.join(this.cacheDir, name, this.tgzFolder, name + '-' + version + '.tgz');
};

/**
 * Async wrapper for getTarballPath
 *
 * @param {string} pkg - The package name
 * @param {string} version - The package version
 * @callback (err, path)
 */
Cache.prototype.getTarball = function(name, version, cb) {

    if (!name) { return cb(new Error('Name not supplied')); }
    if (!version) { return cb(new Error('Version not supplied')); }

    return cb(null, this.getTarballPath(name, version));
};

module.exports = Cache;
